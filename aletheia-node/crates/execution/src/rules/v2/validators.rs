//! The validator registry and epoch transitions, protocol version 2 (spec Sections 19.1, 34;
//! ADR-069).
//!
//! ```text
//! RegisterValidator     operator     -> REGISTERED, bond locked in VALIDATOR_REGISTRY
//! WithdrawApplication   operator     REGISTERED -> REJECTED, bond returned
//! RequestExit           operator     ACTIVE -> EXITING; leaves when this block closes the epoch
//! ActivateValidator     governance   REGISTERED -> ACTIVE; joins when this block closes the epoch
//! RejectValidator       governance   REGISTERED -> REJECTED, bond returned at the end of the block
//! SuspendValidator      governance   member -> SUSPENDED; leaves when this block closes the epoch
//! ReinstateValidator    governance   SUSPENDED -> ACTIVE; rejoins when this block closes the epoch
//! SetValidatorPolicy    governance   minimum bond, largest set
//! ```
//!
//! A change to the set is recorded in the epoch state's `joining` / `leaving` lists and applied
//! by [`end_block`] of the same block, which writes the next epoch's set and closes the epoch.
//! [`begin_block`] classifies the next block against that state: open epoch, suffix block, or
//! the first block of the next epoch.

use aletheia_core::registry::GovAction;
use aletheia_core::validator::{ValidatorApplication, ValidatorOp, status};
use aletheia_core::{AceEncode, Address, AletheiaError, AssetId, ErrorCode, Hash32};
use aletheia_crypto::bls::{BlsPublicKey, BlsSignature};
use aletheia_state::{StateOverlay, StateView};

use crate::context::{BlockContext, Meter, OutOfEu};
use crate::model::{Records, ValidatorRecord};
use crate::receipt::{Event, event_type};
use crate::rules::v1::Touched;
use crate::rules::v1::balances::{credit, debit};
use crate::rules::v1::limits::{REGISTRY_EU, SIGNATURE_EU};
use crate::stateless::VerifiedTransaction;
use crate::validator_model::{
    VALIDATOR_REGISTRY, ValidatorEpochState, ValidatorPolicy, ValidatorRegistration, Validators,
};

fn fail(code: ErrorCode, detail: impl Into<String>) -> AletheiaError {
    AletheiaError::new(code, detail.into())
}

fn key_text(node_key: &[u8; 32]) -> String {
    aletheia_core::base16::encode(node_key)
}

fn emit(events: &mut Vec<Event>, schema: &str, node_key: &[u8; 32], data: Vec<u8>) {
    events.push(Event {
        emitter: VALIDATOR_REGISTRY,
        event_type: event_type(schema),
        topics: vec![Hash32::from_bytes(*node_key)],
        data,
    });
}

/// Where a block stands against the validator epoch, decided from its parent's state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EpochPosition {
    /// The epoch is open; the block belongs to it.
    Open,
    /// The parent closed the epoch and the block keeps its epoch: an empty no-op that only
    /// certifies the closing block (ADR-069 item 3).
    Suffix,
    /// The parent closed the epoch and the block opens the next one.
    Opening,
}

/// Classifies a block of epoch `epoch` against its parent's state, refusing any other epoch.
pub fn position(
    records: &Records,
    parent: &dyn StateView,
    epoch: u64,
) -> Result<EpochPosition, AletheiaError> {
    let state = Validators::new(records).epoch_state(parent)?;
    let position = match (state.closed, epoch) {
        (false, e) if e == state.epoch => Some(EpochPosition::Open),
        (true, e) if e == state.epoch => Some(EpochPosition::Suffix),
        (true, e) if Some(e) == state.epoch.checked_add(1) => Some(EpochPosition::Opening),
        _ => None,
    };
    position.ok_or_else(|| {
        fail(
            ErrorCode::BlkEpochMismatch,
            format!(
                "block in epoch {epoch}; the parent's state has epoch {} ({})",
                state.epoch,
                if state.closed { "closed" } else { "open" }
            ),
        )
    })
}

/// Start of a block that opens the next epoch: moves the epoch state forward. The closing
/// block's hash (the block's parent) seeds the new epoch's leader schedule.
pub fn begin_block(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    ctx: &BlockContext,
    position: EpochPosition,
) -> Result<(), AletheiaError> {
    if position == EpochPosition::Opening {
        let validators = Validators::new(records);
        let state = validators.epoch_state(overlay)?;
        validators.put_epoch_state(
            overlay,
            &ValidatorEpochState {
                epoch: ctx.epoch.get(),
                closed: false,
                opened_after: ctx.parent_hash,
                ..ValidatorEpochState::default()
            },
        );
        debug_assert!(!state.changes_set());
    }
    Ok(())
}

/// The current set, in validator-index order.
fn current_set(
    records: &Records,
    view: &dyn StateView,
    state: &ValidatorEpochState,
) -> Result<Vec<ValidatorRecord>, AletheiaError> {
    Validators::new(records)
        .set(view, state.epoch)?
        .ok_or_else(|| {
            fail(
                ErrorCode::StoCorrupt,
                format!("validator epoch {} has no recorded set", state.epoch),
            )
        })
}

/// The next set: the current members in order without those leaving, then those joining in
/// the order they were admitted.
fn next_set(
    records: &Records,
    view: &dyn StateView,
    state: &ValidatorEpochState,
) -> Result<Vec<ValidatorRecord>, AletheiaError> {
    let validators = Validators::new(records);
    let mut next: Vec<ValidatorRecord> = current_set(records, view, state)?
        .into_iter()
        .filter(|member| !state.leaving.contains(&member.node_key))
        .collect();
    for node_key in &state.joining {
        let registration = validators.registration(view, node_key)?.ok_or_else(|| {
            fail(
                ErrorCode::StoCorrupt,
                format!(
                    "joining validator {} has no registration",
                    key_text(node_key)
                ),
            )
        })?;
        next.push(registration.member());
    }
    Ok(next)
}

/// Refuses a change whose resulting set would be empty, too large, or hold a consensus key
/// twice (one key would then cast two votes).
fn check_bounds(
    records: &Records,
    view: &dyn StateView,
    state: &ValidatorEpochState,
) -> Result<(), AletheiaError> {
    let next = next_set(records, view, state)?;
    let policy = Validators::new(records).policy(view)?;
    let limit = usize::from(
        policy
            .max_validators
            .min(aletheia_core::block::MAX_VALIDATORS),
    );
    if next.is_empty() {
        return Err(fail(
            ErrorCode::ValSetBound,
            "the validator set cannot be left empty",
        ));
    }
    if next.len() > limit {
        return Err(fail(
            ErrorCode::ValSetBound,
            format!(
                "the validator set would have {} members; at most {limit}",
                next.len()
            ),
        ));
    }
    let mut keys = std::collections::BTreeSet::new();
    let mut nodes = std::collections::BTreeSet::new();
    for member in &next {
        if !keys.insert(member.consensus_key) || !nodes.insert(member.node_key) {
            return Err(fail(
                ErrorCode::ValKeyInvalid,
                format!(
                    "validator {} would share a key with another member",
                    key_text(&member.node_key)
                ),
            ));
        }
    }
    Ok(())
}

fn in_current_set(
    records: &Records,
    view: &dyn StateView,
    state: &ValidatorEpochState,
    node_key: &[u8; 32],
) -> Result<Option<ValidatorRecord>, AletheiaError> {
    Ok(current_set(records, view, state)?
        .into_iter()
        .find(|member| &member.node_key == node_key))
}

fn register(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    operator: Address,
    application: &ValidatorApplication,
    ctx: &BlockContext,
    events: &mut Vec<Event>,
    touched: &mut Touched,
) -> Result<(), AletheiaError> {
    let validators = Validators::new(records);
    let state = validators.epoch_state(overlay)?;
    let node_key = application.node_key;
    if let Some(existing) = validators.registration(overlay, &node_key)?
        && !matches!(existing.status, status::REMOVED | status::REJECTED)
    {
        return Err(fail(
            ErrorCode::ValAlreadyRegistered,
            format!(
                "node key {} is already registered ({})",
                key_text(&node_key),
                status::name(existing.status)
            ),
        ));
    }
    if in_current_set(records, overlay, &state, &node_key)?.is_some() {
        return Err(fail(
            ErrorCode::ValAlreadyRegistered,
            format!(
                "node key {} is already in the validator set",
                key_text(&node_key)
            ),
        ));
    }
    let proof = BlsSignature::from_bytes(&application.proof_of_possession)
        .map_err(|e| fail(ErrorCode::ValKeyInvalid, e.detail()))?;
    BlsPublicKey::from_bytes(&application.consensus_key)
        .and_then(|key| key.prove_possession(records.network(), &proof))
        .map_err(|e| fail(ErrorCode::ValKeyInvalid, e.detail()))?;
    let policy = validators.policy(overlay)?;
    if application.bond < policy.min_bond {
        return Err(fail(
            ErrorCode::ValBondTooLow,
            format!(
                "bond {} ALnT base units is below the minimum {}",
                application.bond, policy.min_bond
            ),
        ));
    }
    debit(records, overlay, &operator, AssetId::ALNT, application.bond)?;
    credit(
        records,
        overlay,
        &VALIDATOR_REGISTRY,
        AssetId::ALNT,
        application.bond,
    )?;
    touched.push((operator, AssetId::ALNT));
    touched.push((VALIDATOR_REGISTRY, AssetId::ALNT));
    let registration = ValidatorRegistration::from_application(
        operator,
        application,
        status::REGISTERED,
        ctx.slot.get(),
    );
    validators.put_registration(overlay, &registration);
    emit(
        events,
        "aletheia.validator.registered.v1",
        &node_key,
        operator.to_ace_bytes(),
    );
    Ok(())
}

/// The registration the sender operates, in one of `allowed` statuses.
fn operated(
    records: &Records,
    view: &dyn StateView,
    sender: &Address,
    node_key: &[u8; 32],
    allowed: &[u8],
) -> Result<ValidatorRegistration, AletheiaError> {
    let registration = Validators::new(records)
        .registration(view, node_key)?
        .ok_or_else(|| {
            fail(
                ErrorCode::ValNotFound,
                format!(
                    "no validator registration for node key {}",
                    key_text(node_key)
                ),
            )
        })?;
    if &registration.operator != sender {
        return Err(fail(
            ErrorCode::ValInvalidTransition,
            "only the validator's operator may do this",
        ));
    }
    if !allowed.contains(&registration.status) {
        return Err(fail(
            ErrorCode::ValInvalidTransition,
            format!(
                "validator {} is {}",
                key_text(node_key),
                status::name(registration.status)
            ),
        ));
    }
    Ok(registration)
}

fn refund(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    registration: &mut ValidatorRegistration,
    touched: &mut Touched,
) -> Result<(), AletheiaError> {
    if registration.bond > 0 {
        debit(
            records,
            overlay,
            &VALIDATOR_REGISTRY,
            AssetId::ALNT,
            registration.bond,
        )?;
        credit(
            records,
            overlay,
            &registration.operator,
            AssetId::ALNT,
            registration.bond,
        )?;
        touched.push((registration.operator, AssetId::ALNT));
        touched.push((VALIDATOR_REGISTRY, AssetId::ALNT));
        registration.bond = 0;
    }
    Ok(())
}

/// Operator transactions (types 64-66).
#[allow(clippy::too_many_arguments)]
pub(crate) fn apply(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    op: &ValidatorOp,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
    touched: &mut Touched,
) -> Result<Result<(), OutOfEu>, AletheiaError> {
    let units = match op {
        ValidatorOp::Register(_) => REGISTRY_EU.saturating_add(SIGNATURE_EU),
        ValidatorOp::WithdrawApplication { .. } | ValidatorOp::RequestExit { .. } => REGISTRY_EU,
    };
    if meter.charge(units).is_err() {
        return Ok(Err(OutOfEu));
    }
    let sender = verified.transaction().body.sender;
    let validators = Validators::new(records);
    match op {
        ValidatorOp::Register(application) => {
            register(records, overlay, sender, application, ctx, events, touched)?;
        }
        ValidatorOp::WithdrawApplication { node_key } => {
            let mut registration =
                operated(records, overlay, &sender, node_key, &[status::REGISTERED])?;
            refund(records, overlay, &mut registration, touched)?;
            registration.status = status::REJECTED;
            validators.put_registration(overlay, &registration);
            emit(
                events,
                "aletheia.validator.withdrawn.v1",
                node_key,
                Vec::new(),
            );
        }
        ValidatorOp::RequestExit { node_key } => {
            let mut registration =
                operated(records, overlay, &sender, node_key, &[status::ACTIVE])?;
            let mut state = validators.epoch_state(overlay)?;
            if state.joining.contains(node_key) {
                // Activated in this very block: it never joined, so leaving is a withdrawal.
                state.joining.retain(|k| k != node_key);
                registration.status = status::REMOVED;
                refund(records, overlay, &mut registration, touched)?;
            } else {
                state.leaving.push(*node_key);
                registration.status = status::EXITING;
            }
            check_bounds(records, overlay, &state)?;
            validators.put_epoch_state(overlay, &state);
            validators.put_registration(overlay, &registration);
            emit(
                events,
                "aletheia.validator.exiting.v1",
                node_key,
                Vec::new(),
            );
        }
    }
    Ok(Ok(()))
}

/// Governance actions on the registry, run by `GovExecute` once a proposal's timelock passed.
pub(crate) fn govern(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    action: &GovAction,
    events: &mut Vec<Event>,
) -> Result<(), AletheiaError> {
    let validators = Validators::new(records);
    let mut state = validators.epoch_state(overlay)?;
    let registration = |overlay: &StateOverlay<'_>, node_key: &[u8; 32]| {
        validators.registration(overlay, node_key)?.ok_or_else(|| {
            fail(
                ErrorCode::ValNotFound,
                format!(
                    "no validator registration for node key {}",
                    key_text(node_key)
                ),
            )
        })
    };
    let wrong = |node_key: &[u8; 32], found: u8, wanted: &str| {
        fail(
            ErrorCode::ValInvalidTransition,
            format!(
                "validator {} is {}, not {wanted}",
                key_text(node_key),
                status::name(found)
            ),
        )
    };
    match action {
        GovAction::ActivateValidator { node_key } => {
            let mut record = registration(overlay, node_key)?;
            if record.status != status::REGISTERED {
                return Err(wrong(node_key, record.status, "registered"));
            }
            state.joining.push(*node_key);
            record.status = status::ACTIVE;
            validators.put_registration(overlay, &record);
            check_bounds(records, overlay, &state)?;
            validators.put_epoch_state(overlay, &state);
            emit(
                events,
                "aletheia.validator.activated.v1",
                node_key,
                Vec::new(),
            );
        }
        GovAction::RejectValidator { node_key } => {
            let mut record = registration(overlay, node_key)?;
            if record.status != status::REGISTERED {
                return Err(wrong(node_key, record.status, "registered"));
            }
            record.status = status::REJECTED;
            validators.put_registration(overlay, &record);
            // The bond moves at the end of the block, where moved balances are reported.
            state.refunds.push(*node_key);
            validators.put_epoch_state(overlay, &state);
            emit(
                events,
                "aletheia.validator.rejected.v1",
                node_key,
                Vec::new(),
            );
        }
        GovAction::SuspendValidator { node_key } => {
            let member = in_current_set(records, overlay, &state, node_key)?;
            let existing = validators.registration(overlay, node_key)?;
            let mut record = match (existing, member) {
                (Some(record), _) if matches!(record.status, status::ACTIVE | status::EXITING) => {
                    record
                }
                (Some(record), _) => return Err(wrong(node_key, record.status, "active")),
                // A genesis validator has no registration: record it, bond-free, so it can be
                // reinstated later.
                (None, Some(member)) => ValidatorRegistration {
                    operator: VALIDATOR_REGISTRY,
                    consensus_key: member.consensus_key,
                    proof_of_possession: member.proof_of_possession,
                    node_key: member.node_key,
                    transport_cert_hash: Hash32::ZERO,
                    metadata_hash: Hash32::ZERO,
                    bond: 0,
                    status: status::ACTIVE,
                    registered_slot: 0,
                    joined_epoch: Some(0),
                    left_epoch: None,
                },
                (None, None) => {
                    return Err(fail(
                        ErrorCode::ValNotFound,
                        format!("node key {} is not a validator", key_text(node_key)),
                    ));
                }
            };
            if state.joining.contains(node_key) {
                state.joining.retain(|k| k != node_key);
            } else if !state.leaving.contains(node_key) {
                state.leaving.push(*node_key);
            }
            record.status = status::SUSPENDED;
            validators.put_registration(overlay, &record);
            check_bounds(records, overlay, &state)?;
            validators.put_epoch_state(overlay, &state);
            emit(
                events,
                "aletheia.validator.suspended.v1",
                node_key,
                Vec::new(),
            );
        }
        GovAction::ReinstateValidator { node_key } => {
            let mut record = registration(overlay, node_key)?;
            if record.status != status::SUSPENDED {
                return Err(wrong(node_key, record.status, "suspended"));
            }
            if state.leaving.contains(node_key) {
                // Suspended earlier in this block: it never left.
                state.leaving.retain(|k| k != node_key);
            } else {
                state.joining.push(*node_key);
            }
            record.status = status::ACTIVE;
            validators.put_registration(overlay, &record);
            check_bounds(records, overlay, &state)?;
            validators.put_epoch_state(overlay, &state);
            emit(
                events,
                "aletheia.validator.reinstated.v1",
                node_key,
                Vec::new(),
            );
        }
        GovAction::SetValidatorPolicy {
            min_bond,
            max_validators,
        } => {
            let policy = ValidatorPolicy {
                min_bond: *min_bond,
                max_validators: *max_validators,
            };
            let members = current_set(records, overlay, &state)?.len();
            if usize::from(*max_validators) < members {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    format!("the set already has {members} members; the maximum cannot be lower"),
                ));
            }
            validators.put_policy(overlay, &policy);
        }
        GovAction::SetRewardPolicy {
            period_slots,
            pool_payout,
            state_beneficiary,
        } => {
            crate::rules::v2::rewards::put_policy(
                records,
                overlay,
                &crate::rules::v2::rewards::RewardPolicy {
                    period_slots: *period_slots,
                    pool_payout: *pool_payout,
                    state_beneficiary: *state_beneficiary,
                },
            );
        }
        _ => {
            return Err(fail(
                ErrorCode::GovOutOfBounds,
                "not a validator registry action",
            ));
        }
    }
    Ok(())
}

/// End of every version-2 block: returns rejected bonds, and when the block changed the set,
/// writes the next epoch's set and closes the epoch. Returns the balances it moved.
pub fn end_block(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
) -> Result<Touched, AletheiaError> {
    let validators = Validators::new(records);
    let mut state = validators.epoch_state(overlay)?;
    let mut touched = Vec::new();
    if state.refunds.is_empty() && !state.changes_set() {
        return Ok(touched);
    }
    for node_key in core::mem::take(&mut state.refunds) {
        if let Some(mut record) = validators.registration(overlay, &node_key)? {
            refund(records, overlay, &mut record, &mut touched)?;
            validators.put_registration(overlay, &record);
        }
    }
    if state.changes_set() {
        check_bounds(records, overlay, &state)?;
        let next = next_set(records, overlay, &state)?;
        let next_epoch = state
            .epoch
            .checked_add(1)
            .ok_or_else(|| fail(ErrorCode::ArithmeticOverflow, "validator epoch overflows"))?;
        records.put_validator_set(overlay, next_epoch, &next);
        for node_key in &state.joining {
            if let Some(mut record) = validators.registration(overlay, node_key)? {
                record.joined_epoch = Some(next_epoch);
                record.left_epoch = None;
                validators.put_registration(overlay, &record);
            }
        }
        for node_key in &state.leaving {
            if let Some(mut record) = validators.registration(overlay, node_key)? {
                record.left_epoch = Some(next_epoch);
                if record.status == status::EXITING {
                    record.status = status::REMOVED;
                    refund(records, overlay, &mut record, &mut touched)?;
                }
                validators.put_registration(overlay, &record);
            }
        }
        state.joining.clear();
        state.leaving.clear();
        state.closed = true;
    }
    validators.put_epoch_state(overlay, &state);
    Ok(touched)
}

/// The set the block just executed commits to as next, when it closed the epoch.
pub fn closed_next_set(
    records: &Records,
    after: &dyn StateView,
    epoch: u64,
) -> Result<Option<Vec<ValidatorRecord>>, AletheiaError> {
    let state = Validators::new(records).epoch_state(after)?;
    if !state.closed || state.epoch != epoch {
        return Ok(None);
    }
    let next_epoch = epoch.saturating_add(1);
    Validators::new(records).set(after, next_epoch)
}
