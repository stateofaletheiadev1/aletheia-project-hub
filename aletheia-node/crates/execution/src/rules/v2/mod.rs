//! Protocol version 2 (ADR-069): version 1 plus the validator registry (types 64-66), the
//! validator governance actions and event-driven epoch transitions. Every version-1 behaviour is
//! reused unchanged; only what version 2 adds lives here.

pub mod rewards;
pub mod validators;

use aletheia_core::validator::ValidatorOp;
use aletheia_core::{AletheiaError, AssetId, Payload, TxType};
use aletheia_state::StateOverlay;

use crate::context::{BlockContext, Meter, PayloadOutcome, outcome};
use crate::model::Records;
use crate::receipt::{Event, Receipt};
use crate::rules::v1;
use crate::stateless::VerifiedTransaction;
use crate::validator_model::VALIDATOR_REGISTRY;

pub fn tx_type_active(tx_type: TxType) -> bool {
    v1::TX_TYPES.contains(&tx_type) || ValidatorOp::TX_TYPES.contains(&tx_type.get())
}

pub(crate) fn run_payload(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
    touched: &mut v1::Touched,
) -> Result<PayloadOutcome, AletheiaError> {
    match &verified.transaction().body.payload {
        Payload::Validator(op) => outcome(validators::apply(
            records, overlay, verified, op, ctx, meter, events, touched,
        )),
        _ => v1::run_payload(records, overlay, verified, ctx, meter, events, touched),
    }
}

pub fn apply_transaction(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    ctx: &BlockContext,
    index: u32,
) -> Result<(Receipt, v1::Touched), AletheiaError> {
    v1::apply_transaction_with(records, overlay, verified, ctx, index, run_payload)
}

/// Version 1's balances plus the bond a registration locks or a withdrawal or exit returns.
pub fn touched_balances(tx: &VerifiedTransaction) -> Vec<(aletheia_core::Address, AssetId)> {
    let mut touched = v1::touched_balances(tx);
    if let Payload::Validator(_) = &tx.transaction().body.payload {
        touched.push((tx.transaction().body.sender, AssetId::ALNT));
        touched.push((VALIDATOR_REGISTRY, AssetId::ALNT));
    }
    touched
}

/// Version 1's end of block, then the validator registry's (refunds and, when the block changed
/// the set, the next set and the closing of the epoch), then rewards.
pub fn end_block(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    ctx: &BlockContext,
) -> Result<v1::Touched, AletheiaError> {
    let mut touched = v1::end_block(records, overlay, ctx)?;
    touched.extend(validators::end_block(records, overlay)?);
    touched.extend(rewards::end_block(records, overlay, ctx)?);
    Ok(touched)
}
