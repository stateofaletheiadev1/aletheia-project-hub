//! Validator key rotation, protocol version 3 (spec Sections 19.2, 34; ADR-074).
//!
//! ```text
//! RotateConsensusKey   operator     new key + PoP; a member's takes effect when this block
//!                                   closes the epoch
//! RotateValidatorKey   governance   the same for any member, a genesis validator included
//! RotateTransportCert  operator     new certificate hash; the previous one is accepted for
//!                                   CERT_GRACE_SLOTS more
//! ```
//!
//! A member's rotation is recorded in the pending list and applied by [`end_block`] of the same
//! block, after version 2's set changes: the next epoch's set is the one version 2 wrote (or the
//! current one) with the rotated keys, and the epoch closes.

use aletheia_core::registry::GovAction;
use aletheia_core::validator::{ValidatorOp, status};
use aletheia_core::{AletheiaError, ErrorCode, Hash32};
use aletheia_crypto::bls::{BlsPublicKey, BlsSignature};
use aletheia_state::StateOverlay;

use crate::context::{BlockContext, Meter, OutOfEu};
use crate::model::{Records, ValidatorRecord};
use crate::receipt::Event;
use crate::rules::v1::Touched;
use crate::rules::v1::limits::{REGISTRY_EU, SIGNATURE_EU};
use crate::rules::v2::validators::{current_set, emit, fail, in_current_set, key_text, operated};
use crate::stateless::VerifiedTransaction;
use crate::validator_model::{CertGrace, VALIDATOR_REGISTRY, ValidatorRegistration, Validators};

/// How long a rotated-away transport certificate is still accepted: about a day of 500 ms
/// slots, time to restart the node onto the new certificate.
pub const CERT_GRACE_SLOTS: u64 = 172_800;

/// The consensus keys the next set would hold with every rotation and joiner of this block so
/// far, without `except`'s own.
fn keys_in_use(
    records: &Records,
    overlay: &StateOverlay<'_>,
    except: &[u8; 32],
) -> Result<Vec<[u8; aletheia_core::block::BLS_PUBLIC_KEY_LEN]>, AletheiaError> {
    let validators = Validators::new(records);
    let state = validators.epoch_state(overlay)?;
    let rotations = validators.rotations(overlay)?;
    let mut keys = Vec::new();
    let members = current_set(records, overlay, &state)?;
    for node_key in members
        .iter()
        .map(|m| m.node_key)
        .chain(state.joining.iter().copied())
    {
        if &node_key == except {
            continue;
        }
        let from_registration = rotations.contains(&node_key) || state.joining.contains(&node_key);
        let key = match (
            from_registration,
            validators.registration(overlay, &node_key)?,
        ) {
            (true, Some(registration)) => registration.consensus_key,
            _ => match members.iter().find(|m| m.node_key == node_key) {
                Some(member) => member.consensus_key,
                None => continue,
            },
        };
        keys.push(key);
    }
    Ok(keys)
}

/// Gives `registration` a new consensus key and, when it is a member staying in the set,
/// queues the change for the end of the block.
fn rotate_key(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    mut registration: ValidatorRegistration,
    consensus_key: &[u8; aletheia_core::block::BLS_PUBLIC_KEY_LEN],
    proof_of_possession: &[u8; aletheia_core::block::BLS_SIGNATURE_LEN],
    events: &mut Vec<Event>,
) -> Result<(), AletheiaError> {
    let node_key = registration.node_key;
    let proof = BlsSignature::from_bytes(proof_of_possession)
        .map_err(|e| fail(ErrorCode::ValKeyInvalid, e.detail()))?;
    BlsPublicKey::from_bytes(consensus_key)
        .and_then(|key| key.prove_possession(records.network(), &proof))
        .map_err(|e| fail(ErrorCode::ValKeyInvalid, e.detail()))?;
    if &registration.consensus_key == consensus_key {
        return Err(fail(
            ErrorCode::ValInvalidTransition,
            format!(
                "validator {} already has this consensus key",
                key_text(&node_key)
            ),
        ));
    }
    if keys_in_use(records, overlay, &node_key)?.contains(consensus_key) {
        return Err(fail(
            ErrorCode::ValKeyInvalid,
            "another validator holds this consensus key",
        ));
    }
    let validators = Validators::new(records);
    let state = validators.epoch_state(overlay)?;
    registration.consensus_key = *consensus_key;
    registration.proof_of_possession = *proof_of_possession;
    validators.put_registration(overlay, &registration);
    let stays = in_current_set(records, overlay, &state, &node_key)?.is_some()
        && !state.leaving.contains(&node_key);
    if stays {
        let mut rotations = validators.rotations(overlay)?;
        if !rotations.contains(&node_key) {
            rotations.push(node_key);
            validators.put_rotations(overlay, &rotations);
        }
    }
    emit(
        events,
        "aletheia.validator.key_rotated.v1",
        &node_key,
        consensus_key.to_vec(),
    );
    Ok(())
}

/// Operator rotations (types 67-68).
pub(crate) fn apply(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    op: &ValidatorOp,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Result<Result<(), OutOfEu>, AletheiaError> {
    let units = match op {
        ValidatorOp::RotateConsensusKey { .. } => REGISTRY_EU.saturating_add(SIGNATURE_EU),
        _ => REGISTRY_EU,
    };
    if meter.charge(units).is_err() {
        return Ok(Err(OutOfEu));
    }
    let sender = verified.transaction().body.sender;
    let validators = Validators::new(records);
    match op {
        ValidatorOp::RotateConsensusKey {
            node_key,
            consensus_key,
            proof_of_possession,
        } => {
            let registration = operated(
                records,
                overlay,
                &sender,
                node_key,
                &[status::REGISTERED, status::ACTIVE, status::SUSPENDED],
            )?;
            rotate_key(
                records,
                overlay,
                registration,
                consensus_key,
                proof_of_possession,
                events,
            )?;
        }
        ValidatorOp::RotateTransportCert {
            node_key,
            transport_cert_hash,
        } => {
            let mut registration = operated(
                records,
                overlay,
                &sender,
                node_key,
                &[
                    status::REGISTERED,
                    status::ACTIVE,
                    status::EXITING,
                    status::SUSPENDED,
                ],
            )?;
            if *transport_cert_hash == Hash32::ZERO {
                return Err(fail(
                    ErrorCode::ValKeyInvalid,
                    "a transport certificate hash cannot be zero",
                ));
            }
            if registration.transport_cert_hash == *transport_cert_hash {
                return Err(fail(
                    ErrorCode::ValInvalidTransition,
                    "this certificate is already the registered one",
                ));
            }
            let mut grace: Vec<CertGrace> = validators
                .cert_grace(overlay)?
                .into_iter()
                .filter(|entry| &entry.node_key != node_key)
                .collect();
            if registration.transport_cert_hash != Hash32::ZERO {
                grace.push(CertGrace {
                    node_key: *node_key,
                    previous: registration.transport_cert_hash,
                    until_slot: ctx.slot.get().saturating_add(CERT_GRACE_SLOTS),
                });
            }
            validators.put_cert_grace(overlay, &grace);
            registration.transport_cert_hash = *transport_cert_hash;
            validators.put_registration(overlay, &registration);
            emit(
                events,
                "aletheia.validator.cert_rotated.v1",
                node_key,
                transport_cert_hash.as_bytes().to_vec(),
            );
        }
        _ => {
            return Err(fail(
                ErrorCode::TxTypeNotActive,
                "not a key rotation operation",
            ));
        }
    }
    Ok(Ok(()))
}

/// The Council's `RotateValidatorKey` (ADR-074), run by `GovExecute` after its timelock.
pub(crate) fn govern(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    action: &GovAction,
    events: &mut Vec<Event>,
) -> Result<(), AletheiaError> {
    let GovAction::RotateValidatorKey {
        node_key,
        consensus_key,
        proof_of_possession,
    } = action
    else {
        return Err(fail(ErrorCode::GovOutOfBounds, "not a key rotation action"));
    };
    let validators = Validators::new(records);
    let state = validators.epoch_state(overlay)?;
    let member = in_current_set(records, overlay, &state, node_key)?;
    let registration = match (validators.registration(overlay, node_key)?, member) {
        (Some(registration), _)
            if !matches!(registration.status, status::REMOVED | status::REJECTED) =>
        {
            registration
        }
        (Some(registration), _) => {
            return Err(fail(
                ErrorCode::ValInvalidTransition,
                format!(
                    "validator {} is {}",
                    key_text(node_key),
                    status::name(registration.status)
                ),
            ));
        }
        // A genesis validator has no registration: record it, bond-free, as a suspension does.
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
    rotate_key(
        records,
        overlay,
        registration,
        consensus_key,
        proof_of_possession,
        events,
    )
}

/// End of every version-3 block: version 2's registry work, then this block's key rotations
/// (the next set with the new keys, and the epoch closed), then expired certificate grace.
pub fn end_block(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    ctx: &BlockContext,
) -> Result<Touched, AletheiaError> {
    let validators = Validators::new(records);
    let rotations = validators.rotations(overlay)?;
    let touched = crate::rules::v2::validators::end_block(records, overlay)?;
    if !rotations.is_empty() {
        validators.put_rotations(overlay, &[]);
        let mut state = validators.epoch_state(overlay)?;
        let next_epoch = state
            .epoch
            .checked_add(1)
            .ok_or_else(|| fail(ErrorCode::ArithmeticOverflow, "validator epoch overflows"))?;
        // Version 2 closed the epoch in this block if it changed the set; then its next set
        // is the base, otherwise the current one is.
        let mut next: Vec<ValidatorRecord> = if state.closed {
            validators.set(overlay, next_epoch)?.ok_or_else(|| {
                fail(
                    ErrorCode::StoCorrupt,
                    format!("validator epoch {next_epoch} has no recorded set"),
                )
            })?
        } else {
            current_set(records, overlay, &state)?
        };
        for member in &mut next {
            if rotations.contains(&member.node_key)
                && let Some(registration) = validators.registration(overlay, &member.node_key)?
            {
                member.consensus_key = registration.consensus_key;
                member.proof_of_possession = registration.proof_of_possession;
            }
        }
        let mut keys = std::collections::BTreeSet::new();
        if !next.iter().all(|member| keys.insert(member.consensus_key)) {
            return Err(fail(
                ErrorCode::ValKeyInvalid,
                "two validators would share a consensus key",
            ));
        }
        records.put_validator_set(overlay, next_epoch, &next);
        if !state.closed {
            state.closed = true;
            validators.put_epoch_state(overlay, &state);
        }
    }
    let grace = validators.cert_grace(overlay)?;
    let live: Vec<CertGrace> = grace
        .iter()
        .copied()
        .filter(|entry| entry.until_slot > ctx.slot.get())
        .collect();
    if live.len() != grace.len() {
        validators.put_cert_grace(overlay, &live);
    }
    Ok(touched)
}
