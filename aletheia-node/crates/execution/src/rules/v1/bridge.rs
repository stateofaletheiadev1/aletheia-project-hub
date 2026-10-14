//! Bridge, on-chain part, protocol version 1 (spec Section 40A; ADR-058). Tier B only: every
//! inbound message and every guardian control action carries a BLS aggregate signature by a
//! quorum of the route's guardian set. Tier A (light clients, `UpdateLightClient` 119) and
//! Tier B+ (an issuer co-signature) are not active.
//!
//! ```text
//! BridgeOut       AEY: the sender's AEY moves into bridge escrow (circulating → bridge_escrow)
//!                 a bridged asset: burned (it is released on the remote chain)
//! BridgeIn        a guardian-attested remote message, next in sequence on its route:
//!                 BurnAndRelease of AEY releases from escrow; LockAndMint mints the bridged asset;
//!                 at or above the large-transfer threshold it waits its delay instead
//! SettleDelayed   anyone, once a waiting message's delay has passed and it is not flagged
//! FlagMessage     a guardian quorum holds a waiting message for governance review
//! PauseRoute      a guardian quorum stops new messages until it resumes or the pause expires
//! ResumeRoute     a guardian quorum lifts its own pause (a council pause needs the council)
//! ```
//!
//! A pause only stops new messages: it never moves or freezes balances, and waiting messages
//! still settle. A second, validly attested message for a sequence already consumed is
//! equivocation: the transaction succeeds, moves nothing and pauses the route.

use aletheia_core::bridge::{
    ALETHEIA_CHAIN, Attestation, BridgeMessage, BridgeOp, GuardianSet, RouteAsset,
    attestation_digest, control, control_digest, direction, kind, to_remote_units,
};
use aletheia_core::{AceDecode, AceEncode, Address, AletheiaError, AssetId, ErrorCode, Hash32};
use aletheia_crypto::bls::{BlsPublicKey, BlsSignature, ProvenBlsPublicKey, verify_aggregate};
use aletheia_state::StateOverlay;

use crate::bridge_model::{Bridge, PendingInbound, RouteState};
use crate::context::{BlockContext, Meter, OutOfEu};
use crate::model::{FEE_POOL, Records, module_address};
use crate::receipt::{Event, event_type};
use crate::rules::v1::Touched;
use crate::rules::v1::balances::{credit, debit};
use crate::rules::v1::limits::{BRIDGE_EU, BRIDGE_SIGNER_EU, BRIDGE_VERIFY_EU};
use crate::stateless::VerifiedTransaction;

type Step = Result<Result<(), OutOfEu>, AletheiaError>;

/// Emits bridge events.
pub(crate) const BRIDGE_MODULE: Address = module_address(8);
/// Holds the AEY locked for outbound transfers, as available balance (ledger bucket
/// `bridge_escrow`).
pub const BRIDGE_ESCROW: Address = module_address(9);

/// The message format version this rule set reads.
pub const MESSAGE_VERSION: u16 = 1;

fn fail(code: ErrorCode, detail: impl Into<String>) -> AletheiaError {
    AletheiaError::new(code, detail.into())
}

fn bucket(what: &str) -> AletheiaError {
    fail(
        ErrorCode::MonetaryInvariantViolated,
        format!("the {what} figure is out of range"),
    )
}

/// The governance epoch, the clock of route limits, delays and pause expiry.
pub(crate) fn epoch(
    records: &Records,
    overlay: &StateOverlay<'_>,
    ctx: &BlockContext,
) -> Result<u64, AletheiaError> {
    let slots = crate::registry_model::Registry { records }
        .policy(overlay)?
        .map_or(crate::registry_model::DEFAULT_EPOCH_SLOTS, |p| {
            p.epoch_slots
        })
        .max(1);
    Ok(ctx.slot.get().checked_div(slots).unwrap_or(0))
}

/// Checks a guardian quorum attestation over `digest`. Every key's proof of possession is
/// re-proven here, as consensus does for validators, so a set registered by mistake with a
/// rogue key cannot forge an aggregate.
pub(crate) fn verify_quorum(
    records: &Records,
    set: &GuardianSet,
    attestation: &Attestation,
    digest: &Hash32,
) -> Result<(), AletheiaError> {
    let invalid = |detail: String| fail(ErrorCode::BridgeAttestationInvalid, detail);
    let count = u32::try_from(set.guardians.len()).unwrap_or(u32::MAX);
    if count < 64 && attestation.signers >> count != 0 {
        return Err(invalid(format!(
            "the signer bitmap names guardians beyond the set's {count}"
        )));
    }
    let signed = attestation.signers.count_ones();
    if signed < u32::from(set.threshold) || signed == 0 {
        return Err(invalid(format!(
            "{signed} guardians signed; set {} needs {}",
            set.set_id, set.threshold
        )));
    }
    let mut keys: Vec<ProvenBlsPublicKey> = Vec::new();
    for (index, guardian) in set.guardians.iter().enumerate() {
        let bit = u32::try_from(index)
            .ok()
            .and_then(|i| 1u64.checked_shl(i))
            .unwrap_or(0);
        if attestation.signers & bit == 0 {
            continue;
        }
        let proof = BlsSignature::from_bytes(&guardian.proof_of_possession)?;
        let key = BlsPublicKey::from_bytes(&guardian.public_key)?
            .prove_possession(records.network(), &proof)
            .map_err(|e| invalid(format!("guardian {index}: {}", e.detail())))?;
        keys.push(key);
    }
    let aggregate = BlsSignature::from_bytes(&attestation.aggregate)
        .map_err(|e| invalid(format!("aggregate signature: {}", e.detail())))?;
    let signers: Vec<&ProvenBlsPublicKey> = keys.iter().collect();
    verify_aggregate(&signers, digest, &aggregate).map_err(|e| invalid(e.detail().to_owned()))
}

struct Cx<'a, 'o> {
    bridge: Bridge<'a>,
    records: &'a Records,
    overlay: &'a mut StateOverlay<'o>,
    ctx: &'a BlockContext,
    epoch: u64,
    events: &'a mut Vec<Event>,
    touched: &'a mut Touched,
}

impl Cx<'_, '_> {
    fn emit(&mut self, schema: &str, topics: Vec<Hash32>, data: Vec<u8>) {
        self.events.push(Event {
            emitter: BRIDGE_MODULE,
            event_type: event_type(schema),
            topics,
            data,
        });
    }

    fn route(&self, route_id: u32) -> Result<RouteState, AletheiaError> {
        self.bridge.route(self.overlay, route_id)?.ok_or_else(|| {
            fail(
                ErrorCode::BridgeRouteUnknown,
                format!("no bridge route {route_id}"),
            )
        })
    }

    fn guardians(&self, state: &RouteState) -> Result<GuardianSet, AletheiaError> {
        self.bridge
            .guardians(self.overlay, state.route.guardian_set)?
            .ok_or_else(|| {
                fail(
                    ErrorCode::BridgeGuardianSetUnknown,
                    format!("no guardian set {}", state.route.guardian_set),
                )
            })
    }

    fn open(&self, state: &RouteState) -> Result<(), AletheiaError> {
        if state.is_paused(self.epoch) {
            return Err(fail(
                ErrorCode::BridgeRoutePaused,
                format!("bridge route {} is paused", state.route.route_id),
            ));
        }
        Ok(())
    }

    fn local_decimals(&self, asset: AssetId) -> Result<u8, AletheiaError> {
        Ok(self
            .records
            .asset(self.overlay, asset)?
            .ok_or_else(|| {
                fail(
                    ErrorCode::TxAssetUnknown,
                    format!("asset {asset} does not exist"),
                )
            })?
            .decimals)
    }

    /// Exact conversion (40A.5): refused if the remote token cannot hold the amount exactly.
    fn convertible(&self, entry: &RouteAsset, amount: u128) -> Result<(), AletheiaError> {
        let local = self.local_decimals(entry.asset)?;
        if to_remote_units(amount, local, entry.remote_decimals).is_none() {
            return Err(fail(
                ErrorCode::BridgeAmountNotConvertible,
                format!(
                    "{amount} at {local} decimals does not convert exactly to {} decimals",
                    entry.remote_decimals
                ),
            ));
        }
        Ok(())
    }

    /// Per-transaction and per-epoch limits (I12); counts the flow.
    fn count_flow(&self, state: &mut RouteState, amount: u128) -> Result<(), AletheiaError> {
        if amount > state.route.per_tx_max {
            return Err(fail(
                ErrorCode::BridgeLimitExceeded,
                format!(
                    "{amount} is above the route's per-transaction maximum {}",
                    state.route.per_tx_max
                ),
            ));
        }
        if state.flow_epoch != self.epoch {
            state.flow_epoch = self.epoch;
            state.epoch_flow = 0;
        }
        state.epoch_flow = state
            .epoch_flow
            .checked_add(amount)
            .filter(|flow| *flow <= state.route.per_epoch_max)
            .ok_or_else(|| {
                fail(
                    ErrorCode::BridgeLimitExceeded,
                    format!(
                        "the route's per-epoch maximum {} is reached",
                        state.route.per_epoch_max
                    ),
                )
            })?;
        Ok(())
    }

    /// Exposure (I12): AEY escrowed for the remote chain plus bridged assets minted here.
    fn within_exposure(&self, state: &RouteState, added: u128) -> Result<(), AletheiaError> {
        let exposure = state
            .escrowed
            .checked_add(state.minted)
            .and_then(|e| e.checked_add(added))
            .filter(|e| *e <= state.route.global_exposure_max);
        if exposure.is_none() {
            return Err(fail(
                ErrorCode::BridgeLimitExceeded,
                format!(
                    "the route's exposure maximum {} is reached",
                    state.route.global_exposure_max
                ),
            ));
        }
        Ok(())
    }

    fn supply(&self, asset: AssetId) -> Result<aletheia_monetary::SupplyLedger, AletheiaError> {
        self.records
            .supply_ledger(self.overlay, asset)?
            .ok_or_else(|| {
                fail(
                    ErrorCode::TxAssetUnknown,
                    format!("asset {asset} has no supply ledger"),
                )
            })
    }

    fn escrow_total(&mut self, amount: u128, add: bool) -> Result<(), AletheiaError> {
        let total = self.bridge.escrow_total(self.overlay)?;
        let next = if add {
            total.checked_add(amount)
        } else {
            total.checked_sub(amount)
        }
        .ok_or_else(|| bucket("I10 bridge escrow total"))?;
        self.overlay
            .put(self.bridge.escrow_total_key(), next.to_ace_bytes());
        Ok(())
    }

    /// `from`'s AEY into bridge escrow: circulating → bridge_escrow.
    fn escrow_in(
        &mut self,
        state: &mut RouteState,
        from: &Address,
        amount: u128,
    ) -> Result<(), AletheiaError> {
        debit(self.records, self.overlay, from, AssetId::AEY, amount)?;
        credit(
            self.records,
            self.overlay,
            &BRIDGE_ESCROW,
            AssetId::AEY,
            amount,
        )?;
        let mut supply = self.supply(AssetId::AEY)?;
        supply.circulating = supply
            .circulating
            .checked_sub(amount)
            .ok_or_else(|| bucket("circulating"))?;
        supply.bridge_escrow = supply
            .bridge_escrow
            .checked_add(amount)
            .ok_or_else(|| bucket("bridge escrow"))?;
        self.records
            .put_supply_ledger(self.overlay, AssetId::AEY, &supply);
        state.escrowed = state
            .escrowed
            .checked_add(amount)
            .ok_or_else(|| bucket("route escrow"))?;
        self.escrow_total(amount, true)?;
        self.touched.push((*from, AssetId::AEY));
        self.touched.push((BRIDGE_ESCROW, AssetId::AEY));
        Ok(())
    }

    /// AEY out of bridge escrow to `to`: bridge_escrow → circulating.
    fn escrow_out(
        &mut self,
        state: &mut RouteState,
        to: &Address,
        amount: u128,
    ) -> Result<(), AletheiaError> {
        state.escrowed = state.escrowed.checked_sub(amount).ok_or_else(|| {
            fail(
                ErrorCode::BridgeLimitExceeded,
                format!(
                    "route {} holds {} AEY in escrow, less than {amount}",
                    state.route.route_id, state.escrowed
                ),
            )
        })?;
        debit(
            self.records,
            self.overlay,
            &BRIDGE_ESCROW,
            AssetId::AEY,
            amount,
        )?;
        credit(self.records, self.overlay, to, AssetId::AEY, amount)?;
        let mut supply = self.supply(AssetId::AEY)?;
        supply.bridge_escrow = supply
            .bridge_escrow
            .checked_sub(amount)
            .ok_or_else(|| bucket("bridge escrow"))?;
        supply.circulating = supply
            .circulating
            .checked_add(amount)
            .ok_or_else(|| bucket("circulating"))?;
        self.records
            .put_supply_ledger(self.overlay, AssetId::AEY, &supply);
        self.escrow_total(amount, false)?;
        self.touched.push((BRIDGE_ESCROW, AssetId::AEY));
        self.touched.push((*to, AssetId::AEY));
        Ok(())
    }

    /// Mints a bridged asset against a verified remote lock (I11).
    fn mint_bridged(
        &mut self,
        state: &mut RouteState,
        asset: AssetId,
        to: &Address,
        amount: u128,
    ) -> Result<(), AletheiaError> {
        self.within_exposure(state, amount)?;
        credit(self.records, self.overlay, to, asset, amount)?;
        let mut supply = self.supply(asset)?;
        supply.issued_total = supply
            .issued_total
            .checked_add(amount)
            .ok_or_else(|| bucket("issued"))?;
        supply.circulating = supply
            .circulating
            .checked_add(amount)
            .ok_or_else(|| bucket("circulating"))?;
        self.records.put_supply_ledger(self.overlay, asset, &supply);
        state.minted = state
            .minted
            .checked_add(amount)
            .ok_or_else(|| bucket("route minted"))?;
        let mut flows = self.bridge.flows(self.overlay, asset)?;
        flows.locks = flows
            .locks
            .checked_add(amount)
            .ok_or_else(|| bucket("remote locks"))?;
        self.overlay
            .put(self.bridge.flows_key(asset), flows.to_ace_bytes());
        self.touched.push((*to, asset));
        Ok(())
    }

    /// Burns a bridged asset that the remote chain will release (I11).
    fn burn_bridged(
        &mut self,
        state: &mut RouteState,
        asset: AssetId,
        from: &Address,
        amount: u128,
    ) -> Result<(), AletheiaError> {
        state.minted = state.minted.checked_sub(amount).ok_or_else(|| {
            fail(
                ErrorCode::BridgeLimitExceeded,
                format!(
                    "route {} minted {} of asset {asset} still outstanding, less than {amount}",
                    state.route.route_id, state.minted
                ),
            )
        })?;
        debit(self.records, self.overlay, from, asset, amount)?;
        let mut supply = self.supply(asset)?;
        supply.burned_total = supply
            .burned_total
            .checked_add(amount)
            .ok_or_else(|| bucket("burned"))?;
        supply.circulating = supply
            .circulating
            .checked_sub(amount)
            .ok_or_else(|| bucket("circulating"))?;
        self.records.put_supply_ledger(self.overlay, asset, &supply);
        let mut flows = self.bridge.flows(self.overlay, asset)?;
        flows.releases = flows
            .releases
            .checked_add(amount)
            .ok_or_else(|| bucket("remote releases"))?;
        self.overlay
            .put(self.bridge.flows_key(asset), flows.to_ace_bytes());
        self.touched.push((*from, asset));
        Ok(())
    }

    /// Delivers an accepted inbound message: release AEY or mint the bridged asset.
    fn deliver(
        &mut self,
        state: &mut RouteState,
        message: &BridgeMessage,
        id: &Hash32,
    ) -> Result<(), AletheiaError> {
        let recipient = recipient(message)?;
        if message.kind == kind::BURN_AND_RELEASE {
            self.escrow_out(state, &recipient, message.amount)?;
        } else {
            self.mint_bridged(state, message.asset, &recipient, message.amount)?;
        }
        self.emit(
            "aletheia.bridge.in.settled.v1",
            vec![*id],
            message.to_ace_bytes(),
        );
        Ok(())
    }
}

/// An inbound message's recipient: an ordinary Aletheia address (never a module).
fn recipient(message: &BridgeMessage) -> Result<Address, AletheiaError> {
    let address = Address::from_ace_bytes(&message.recipient).map_err(|e| {
        fail(
            ErrorCode::BridgeWrongDestination,
            format!("the recipient is not an Aletheia address: {}", e.detail()),
        )
    })?;
    if address.is_native_module() {
        return Err(fail(
            ErrorCode::BridgeWrongDestination,
            "a bridge message cannot pay a native module",
        ));
    }
    Ok(address)
}

/// The route's entry for `asset` if it moves in `wanted` direction.
fn entry_for(state: &RouteState, asset: AssetId, wanted: u8) -> Result<RouteAsset, AletheiaError> {
    state
        .route
        .assets
        .iter()
        .find(|a| a.asset == asset && (a.direction == wanted || a.direction == direction::BOTH))
        .cloned()
        .ok_or_else(|| {
            fail(
                ErrorCode::BridgeAssetNotOnRoute,
                format!(
                    "asset {asset} does not move {} on route {}",
                    if wanted == direction::OUTBOUND {
                        "out"
                    } else {
                        "in"
                    },
                    state.route.route_id
                ),
            )
        })
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn apply(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    op: &BridgeOp,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
    touched: &mut Touched,
) -> Step {
    let body = &verified.transaction().body;
    let epoch = epoch(records, overlay, ctx)?;
    let mut cx = Cx {
        bridge: Bridge { records },
        records,
        overlay,
        ctx,
        epoch,
        events,
        touched,
    };
    let cost = match op {
        BridgeOp::BridgeOut { .. } | BridgeOp::SettleDelayed { .. } => BRIDGE_EU,
        BridgeOp::BridgeIn { attestation, .. }
        | BridgeOp::FlagMessage { attestation, .. }
        | BridgeOp::PauseRoute { attestation, .. }
        | BridgeOp::ResumeRoute { attestation, .. } => BRIDGE_VERIFY_EU.saturating_add(
            u64::from(attestation.signers.count_ones()).saturating_mul(BRIDGE_SIGNER_EU),
        ),
    };
    if meter.charge(cost).is_err() {
        return Ok(Err(OutOfEu));
    }
    match op {
        BridgeOp::BridgeOut {
            route_id,
            asset,
            recipient,
            amount,
            max_fee,
        } => bridge_out(
            &mut cx,
            body.sender,
            *route_id,
            *asset,
            recipient,
            *amount,
            *max_fee,
        )?,
        BridgeOp::BridgeIn {
            message,
            attestation,
        } => bridge_in(&mut cx, message, attestation)?,
        BridgeOp::SettleDelayed { message_id } => {
            let pending = cx.bridge.pending(cx.overlay, message_id)?.ok_or_else(|| {
                fail(
                    ErrorCode::BridgeMessageUnknown,
                    format!("no waiting bridge message {message_id}"),
                )
            })?;
            if pending.flagged || cx.epoch < pending.ready_epoch {
                return Err(fail(
                    ErrorCode::BridgeMessageHeld,
                    if pending.flagged {
                        "the message is flagged for governance review".to_owned()
                    } else {
                        format!("the message waits until epoch {}", pending.ready_epoch)
                    },
                ));
            }
            let mut state = cx.route(pending.message.route_id)?;
            cx.deliver(&mut state, &pending.message, message_id)?;
            cx.bridge.put_route(cx.overlay, &state);
            cx.overlay.delete(cx.bridge.pending_key(message_id));
        }
        BridgeOp::FlagMessage {
            route_id,
            message_id,
            attestation,
        } => {
            let state = cx.route(*route_id)?;
            let mut pending = cx.bridge.pending(cx.overlay, message_id)?.ok_or_else(|| {
                fail(
                    ErrorCode::BridgeMessageUnknown,
                    format!("no waiting bridge message {message_id}"),
                )
            })?;
            if pending.message.route_id != *route_id {
                return Err(fail(
                    ErrorCode::BridgeWrongDestination,
                    "the message is on another route",
                ));
            }
            let set = cx.guardians(&state)?;
            let digest = control_digest(records.network(), control::FLAG, *route_id, message_id, 0);
            verify_quorum(records, &set, attestation, &digest)?;
            pending.flagged = true;
            cx.overlay
                .put(cx.bridge.pending_key(message_id), pending.to_ace_bytes());
            cx.emit(
                "aletheia.bridge.flagged.v1",
                vec![*message_id],
                route_id.to_le_bytes().to_vec(),
            );
        }
        BridgeOp::PauseRoute {
            route_id,
            attestation,
        } => {
            let mut state = cx.route(*route_id)?;
            if state.is_paused(cx.epoch) {
                return Err(fail(
                    ErrorCode::BridgeRoutePaused,
                    format!("bridge route {route_id} is already paused"),
                ));
            }
            let set = cx.guardians(&state)?;
            let digest = control_digest(
                records.network(),
                control::PAUSE,
                *route_id,
                &Hash32::ZERO,
                state.pauses,
            );
            verify_quorum(records, &set, attestation, &digest)?;
            pause(&mut cx, &mut state, "guardians")?;
        }
        BridgeOp::ResumeRoute {
            route_id,
            attestation,
        } => {
            let mut state = cx.route(*route_id)?;
            if !state.is_paused(cx.epoch) {
                return Err(fail(
                    ErrorCode::TxFieldOutOfRange,
                    format!("bridge route {route_id} is not paused"),
                ));
            }
            if state.paused_until_epoch == u64::MAX {
                return Err(fail(
                    ErrorCode::BridgeRoutePaused,
                    "the council paused this route; only the council resumes it",
                ));
            }
            let set = cx.guardians(&state)?;
            let digest = control_digest(
                records.network(),
                control::RESUME,
                *route_id,
                &Hash32::ZERO,
                state.pauses,
            );
            verify_quorum(records, &set, attestation, &digest)?;
            state.paused = false;
            cx.bridge.put_route(cx.overlay, &state);
            cx.emit(
                "aletheia.bridge.route.resumed.v1",
                Vec::new(),
                route_id.to_le_bytes().to_vec(),
            );
        }
    }
    Ok(Ok(()))
}

/// A guardian pause (also the automatic one), which expires after the route's governed
/// number of epochs.
fn pause(cx: &mut Cx<'_, '_>, state: &mut RouteState, by: &str) -> Result<(), AletheiaError> {
    state.paused = true;
    state.paused_until_epoch = cx
        .epoch
        .saturating_add(u64::from(state.route.pause_expiry_epochs.max(1)));
    state.pauses = state.pauses.saturating_add(1);
    cx.bridge.put_route(cx.overlay, state);
    let route_id = state.route.route_id;
    cx.emit(
        "aletheia.bridge.route.paused.v1",
        Vec::new(),
        [route_id.to_le_bytes().as_slice(), by.as_bytes()].concat(),
    );
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn bridge_out(
    cx: &mut Cx<'_, '_>,
    sender: Address,
    route_id: u32,
    asset: AssetId,
    recipient: &[u8],
    amount: u128,
    max_fee: u128,
) -> Result<(), AletheiaError> {
    let mut state = cx.route(route_id)?;
    cx.open(&state)?;
    let entry = entry_for(&state, asset, direction::OUTBOUND)?;
    if asset != AssetId::AEY && !entry.bridged {
        return Err(fail(
            ErrorCode::BridgeAssetNotOnRoute,
            format!("asset {asset} is neither AEY nor bridged on route {route_id}"),
        ));
    }
    if recipient.len() != usize::from(state.route.remote_address_len) {
        return Err(fail(
            ErrorCode::BridgeWrongDestination,
            format!(
                "a recipient on route {route_id} is {} bytes, not {}",
                state.route.remote_address_len,
                recipient.len()
            ),
        ));
    }
    cx.convertible(&entry, amount)?;
    cx.count_flow(&mut state, amount)?;
    let fee = amount
        .checked_mul(u128::from(state.route.fee_bps))
        .and_then(|f| f.checked_div(10_000))
        .ok_or_else(|| bucket("bridge fee"))?;
    if fee > max_fee {
        return Err(fail(
            ErrorCode::BridgeLimitExceeded,
            format!("the bridge fee {fee} is above max_fee {max_fee}"),
        ));
    }
    if fee > 0 {
        debit(cx.records, cx.overlay, &sender, asset, fee)?;
        credit(cx.records, cx.overlay, &FEE_POOL, asset, fee)?;
        cx.touched.push((sender, asset));
        cx.touched.push((FEE_POOL, asset));
    }
    let message_kind = if asset == AssetId::AEY {
        cx.within_exposure(&state, amount)?;
        cx.escrow_in(&mut state, &sender, amount)?;
        kind::LOCK_AND_MINT
    } else {
        cx.burn_bridged(&mut state, asset, &sender, amount)?;
        kind::BURN_AND_RELEASE
    };
    state.out_sequence = state
        .out_sequence
        .checked_add(1)
        .ok_or_else(|| bucket("outbound sequence"))?;
    let message = BridgeMessage {
        version: MESSAGE_VERSION,
        source_chain: ALETHEIA_CHAIN,
        dest_chain: state.route.remote_chain_id,
        route_id,
        sequence: state.out_sequence,
        kind: message_kind,
        asset,
        remote_token: entry.remote_token.clone(),
        sender: sender.to_bytes().to_vec(),
        recipient: recipient.to_vec(),
        amount,
        fee,
        expiry_slot: u64::MAX,
    };
    let id = message.id(cx.records.network());
    cx.overlay
        .put(cx.bridge.outbound_key(&id), message.to_ace_bytes());
    cx.bridge.put_route(cx.overlay, &state);
    cx.emit("aletheia.bridge.out.v1", vec![id], message.to_ace_bytes());
    Ok(())
}

fn bridge_in(
    cx: &mut Cx<'_, '_>,
    message: &BridgeMessage,
    attestation: &Attestation,
) -> Result<(), AletheiaError> {
    let mut state = cx.route(message.route_id)?;
    if message.version != MESSAGE_VERSION
        || message.dest_chain != ALETHEIA_CHAIN
        || message.source_chain != state.route.remote_chain_id
    {
        return Err(fail(
            ErrorCode::BridgeWrongDestination,
            format!(
                "message version {} from chain {} to chain {} is not for route {} (version {MESSAGE_VERSION}, chain {} to {ALETHEIA_CHAIN})",
                message.version,
                message.source_chain,
                message.dest_chain,
                message.route_id,
                state.route.remote_chain_id
            ),
        ));
    }
    let id = message.id(cx.records.network());
    let set = cx.guardians(&state)?;
    let digest = attestation_digest(cx.records.network(), &id, message.route_id);

    if let Some(consumed) = cx
        .bridge
        .consumed(cx.overlay, message.route_id, message.sequence)?
    {
        if consumed == id {
            return Err(fail(
                ErrorCode::BridgeSequenceGap,
                format!("message {id} was already consumed"),
            ));
        }
        // A quorum signed two messages for one sequence: pause the route (40A.8).
        verify_quorum(cx.records, &set, attestation, &digest)?;
        if !state.is_paused(cx.epoch) {
            pause(cx, &mut state, "equivocation")?;
        }
        cx.emit(
            "aletheia.bridge.equivocation.v1",
            vec![consumed, id],
            message.sequence.to_le_bytes().to_vec(),
        );
        return Ok(());
    }

    cx.open(&state)?;
    let next = state
        .in_sequence
        .checked_add(1)
        .ok_or_else(|| bucket("inbound sequence"))?;
    if message.sequence != next {
        return Err(fail(
            ErrorCode::BridgeSequenceGap,
            format!(
                "route {} expects sequence {next}, not {}",
                message.route_id, message.sequence
            ),
        ));
    }
    if cx.ctx.slot.get() > message.expiry_slot {
        return Err(fail(
            ErrorCode::BridgeMessageExpired,
            format!("the message expired at slot {}", message.expiry_slot),
        ));
    }
    verify_quorum(cx.records, &set, attestation, &digest)?;

    let entry = entry_for(&state, message.asset, direction::INBOUND)?;
    let wanted = if message.asset == AssetId::AEY {
        kind::BURN_AND_RELEASE
    } else if entry.bridged {
        kind::LOCK_AND_MINT
    } else {
        0
    };
    if message.kind != wanted || message.remote_token != entry.remote_token {
        return Err(fail(
            ErrorCode::BridgeAssetNotOnRoute,
            format!(
                "kind {} of asset {} with that remote token does not match route {}",
                message.kind, message.asset, message.route_id
            ),
        ));
    }
    if message.amount == 0 {
        return Err(fail(
            ErrorCode::TxFieldOutOfRange,
            "a bridge message moves a positive amount",
        ));
    }
    recipient(message)?;
    cx.convertible(&entry, message.amount)?;
    cx.count_flow(&mut state, message.amount)?;

    state.in_sequence = next;
    cx.overlay.put(
        cx.bridge.consumed_key(message.route_id, message.sequence),
        id.to_ace_bytes(),
    );
    let threshold = state.route.large_transfer_threshold;
    if threshold > 0 && message.amount >= threshold {
        let ready_epoch = cx
            .epoch
            .saturating_add(u64::from(state.route.large_transfer_delay_epochs));
        let pending = PendingInbound {
            message: message.clone(),
            ready_epoch,
            flagged: false,
        };
        cx.overlay
            .put(cx.bridge.pending_key(&id), pending.to_ace_bytes());
        cx.emit(
            "aletheia.bridge.in.delayed.v1",
            vec![id],
            ready_epoch.to_le_bytes().to_vec(),
        );
    } else {
        cx.deliver(&mut state, message, &id)?;
    }
    cx.bridge.put_route(cx.overlay, &state);
    Ok(())
}

/// I10 and I12 after every block (I11 is checked per bridged asset). A violation makes the
/// block invalid.
pub(crate) fn end_block(
    records: &Records,
    overlay: &StateOverlay<'_>,
    ctx: &BlockContext,
) -> Result<(), AletheiaError> {
    let bridge = Bridge { records };
    let routes = bridge.route_ids(overlay)?;
    let violation = |detail: String| fail(ErrorCode::MonetaryInvariantViolated, detail);
    let total = bridge.escrow_total(overlay)?;
    let held = records.balance(overlay, &BRIDGE_ESCROW, AssetId::AEY)?;
    let ledger = records
        .supply_ledger(overlay, AssetId::AEY)?
        .map_or(0, |l| l.bridge_escrow);
    if held.available != total || held.locked != 0 || ledger != total {
        return Err(violation(format!(
            "I10: routes escrow {total} AEY, the escrow account holds {} (locked {}), the ledger records {ledger}",
            held.available, held.locked
        )));
    }
    if routes.is_empty() {
        return Ok(());
    }
    let epoch = epoch(records, overlay, ctx)?;
    let mut summed = 0u128;
    for route_id in routes {
        let state = bridge
            .route(overlay, route_id)?
            .ok_or_else(|| violation(format!("route {route_id} is listed but missing")))?;
        summed = summed
            .checked_add(state.escrowed)
            .ok_or_else(|| violation("I10: route escrows overflow".to_owned()))?;
        let exposure = state.escrowed.checked_add(state.minted);
        if exposure.is_none_or(|e| e > state.route.global_exposure_max)
            || (state.flow_epoch == epoch && state.epoch_flow > state.route.per_epoch_max)
        {
            return Err(violation(format!(
                "I12: route {route_id} is over its limits"
            )));
        }
    }
    if summed != total {
        return Err(violation(format!(
            "I10: routes escrow {summed} AEY in all, the total records {total}"
        )));
    }
    for asset in bridge.bridged_assets(overlay)? {
        let flows = bridge.flows(overlay, asset)?;
        let outstanding = records
            .supply_ledger(overlay, asset)?
            .map_or(Ok(0), |l| l.outstanding(asset))?;
        let backing = flows.locks.checked_sub(flows.releases);
        if backing.is_none_or(|b| outstanding > b) {
            return Err(violation(format!(
                "I11: bridged asset {asset} has {outstanding} outstanding against {} locked and {} released",
                flows.locks, flows.releases
            )));
        }
    }
    Ok(())
}

/// Registers or replaces a guardian set (governance). Production networks need at least 7
/// guardians; every network needs a two-thirds threshold and valid proofs of possession.
pub(crate) fn register_guardians(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    set: &GuardianSet,
) -> Result<(), AletheiaError> {
    let n = set.guardians.len();
    let minimum = if records.network().network_kind().allows_development_keys() {
        1
    } else {
        7
    };
    let two_thirds = n.saturating_mul(2).div_ceil(3);
    if n < minimum || usize::from(set.threshold) < two_thirds || usize::from(set.threshold) > n {
        return Err(fail(
            ErrorCode::GovOutOfBounds,
            format!(
                "a guardian set needs at least {minimum} guardians and a threshold of two thirds or more ({two_thirds} of {n})"
            ),
        ));
    }
    let distinct: std::collections::BTreeSet<_> =
        set.guardians.iter().map(|g| g.public_key).collect();
    if distinct.len() != n {
        return Err(fail(ErrorCode::GovOutOfBounds, "guardian keys repeat"));
    }
    for (index, guardian) in set.guardians.iter().enumerate() {
        let proof = BlsSignature::from_bytes(&guardian.proof_of_possession)?;
        BlsPublicKey::from_bytes(&guardian.public_key)?
            .prove_possession(records.network(), &proof)
            .map_err(|e| {
                fail(
                    ErrorCode::GovOutOfBounds,
                    format!("guardian {index}: {}", e.detail()),
                )
            })?;
    }
    overlay.put(
        Bridge { records }.guardians_key(set.set_id),
        set.to_ace_bytes(),
    );
    Ok(())
}

/// Opens or reconfigures a route (governance). A new route starts paused by the council;
/// a reconfigured one keeps its counters and pause. New limits may not be below what the
/// route already carries, and a bridged asset is created on first use.
pub(crate) fn upsert_route(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    route: &aletheia_core::bridge::BridgeRoute,
    epoch: u64,
) -> Result<(), AletheiaError> {
    let bridge = Bridge { records };
    if bridge.guardians(overlay, route.guardian_set)?.is_none() {
        return Err(fail(
            ErrorCode::BridgeGuardianSetUnknown,
            format!("no guardian set {}", route.guardian_set),
        ));
    }
    let mut bridged = bridge.bridged_assets(overlay)?;
    for entry in &route.assets {
        let exists = records.asset(overlay, entry.asset)?.is_some();
        if !entry.bridged {
            if entry.asset != AssetId::AEY {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    format!(
                        "asset {}: only AEY and bridged assets cross a route",
                        entry.asset
                    ),
                ));
            }
            continue;
        }
        if bridged.contains(&entry.asset) {
            continue;
        }
        if exists {
            return Err(fail(
                ErrorCode::GovOutOfBounds,
                format!(
                    "asset {} already exists and is not a bridged asset",
                    entry.asset
                ),
            ));
        }
        if u32::try_from(bridged.len()).unwrap_or(u32::MAX)
            >= crate::bridge_model::MAX_BRIDGED_ASSETS
        {
            return Err(fail(ErrorCode::GovOutOfBounds, "too many bridged assets"));
        }
        overlay.put(
            records.asset_key(entry.asset),
            crate::model::AssetConfig {
                decimals: entry.remote_decimals,
                transferable: true,
            }
            .to_ace_bytes(),
        );
        // Route exposure limits bound a bridged asset's supply, not issuance capacity.
        records.put_supply_ledger(
            overlay,
            entry.asset,
            &aletheia_monetary::SupplyLedger {
                authorized_capacity: u128::MAX,
                ..aletheia_monetary::SupplyLedger::default()
            },
        );
        bridged.push(entry.asset);
    }
    bridge.put_bridged_assets(overlay, &bridged);

    let state = match bridge.route(overlay, route.route_id)? {
        Some(mut state) => {
            let exposure = state.escrowed.saturating_add(state.minted);
            let flow = if state.flow_epoch == epoch {
                state.epoch_flow
            } else {
                0
            };
            if exposure > route.global_exposure_max || flow > route.per_epoch_max {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    format!(
                        "route {} carries exposure {exposure} and flow {flow}, above the new limits",
                        route.route_id
                    ),
                ));
            }
            state.route = route.clone();
            state
        }
        None => {
            let mut routes = bridge.route_ids(overlay)?;
            if u32::try_from(routes.len()).unwrap_or(u32::MAX) >= crate::bridge_model::MAX_ROUTES {
                return Err(fail(ErrorCode::GovOutOfBounds, "too many bridge routes"));
            }
            routes.push(route.route_id);
            bridge.put_route_ids(overlay, &routes);
            RouteState {
                route: route.clone(),
                paused: true,
                paused_until_epoch: u64::MAX,
                pauses: 0,
                out_sequence: 0,
                in_sequence: 0,
                flow_epoch: epoch,
                epoch_flow: 0,
                escrowed: 0,
                minted: 0,
            }
        }
    };
    bridge.put_route(overlay, &state);
    Ok(())
}

/// The council pauses (until it resumes) or resumes a route.
pub(crate) fn set_paused(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    route_id: u32,
    paused: bool,
) -> Result<(), AletheiaError> {
    let bridge = Bridge { records };
    let mut state = bridge.route(overlay, route_id)?.ok_or_else(|| {
        fail(
            ErrorCode::BridgeRouteUnknown,
            format!("no bridge route {route_id}"),
        )
    })?;
    state.paused = paused;
    if paused {
        state.paused_until_epoch = u64::MAX;
        state.pauses = state.pauses.saturating_add(1);
    }
    bridge.put_route(overlay, &state);
    Ok(())
}

/// Bounds of a route that do not depend on state.
pub(crate) fn check_route(route: &aletheia_core::bridge::BridgeRoute) -> Result<(), AletheiaError> {
    let out = |detail: &str| Err(fail(ErrorCode::GovOutOfBounds, detail));
    if route.remote_chain_id == ALETHEIA_CHAIN {
        return out("a route's remote chain cannot be Aletheia (chain 0)");
    }
    if route.verification != aletheia_core::bridge::verification::GUARDIANS {
        return out("only guardian verification (Tier B) is active");
    }
    if route.remote_address_len == 0
        || u32::from(route.remote_address_len) > aletheia_core::bridge::MAX_REMOTE_BYTES
    {
        return out("a remote address is 1 to 64 bytes");
    }
    if route.assets.is_empty() {
        return out("a route carries at least one asset");
    }
    let distinct: std::collections::BTreeSet<_> = route.assets.iter().map(|a| a.asset).collect();
    if distinct.len() != route.assets.len() {
        return out("a route lists each asset once");
    }
    for entry in &route.assets {
        if !(direction::OUTBOUND..=direction::BOTH).contains(&entry.direction) {
            return out("an asset direction is outbound, inbound or both");
        }
        if entry.remote_decimals > 36 {
            return out("a remote token has at most 36 decimals");
        }
        if entry.remote_token.is_empty() {
            return out("an asset names its remote token");
        }
        if entry.bridged && (entry.asset == AssetId::AEY || entry.asset == AssetId::ALNT) {
            return out("AEY and ALNT are native, never bridged");
        }
    }
    if route.per_tx_max == 0 || route.per_tx_max > route.per_epoch_max {
        return out("limits need 0 < per_tx_max <= per_epoch_max");
    }
    if route.fee_bps > 1_000 {
        return out("a bridge fee is at most 1000 basis points");
    }
    if route.pause_expiry_epochs == 0 {
        return out("a guardian pause expires after at least one epoch");
    }
    Ok(())
}
