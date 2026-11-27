//! Protocol version 3: version 2 plus validator key rotation (types 67-68 and the Council's
//! `RotateValidatorKey`, ADR-074) and equivocation evidence (type 69, ADR-075). Every version-2 behaviour is reused unchanged; only what
//! version 3 adds lives here.

pub mod evidence;
pub mod rotation;

use aletheia_core::validator::ValidatorOp;
use aletheia_core::{AletheiaError, AssetId, Payload, TxType};
use aletheia_state::StateOverlay;

use crate::context::{BlockContext, Meter, PayloadOutcome, outcome};
use crate::model::Records;
use crate::receipt::{Event, Receipt};
use crate::rules::{v1, v2};
use crate::stateless::VerifiedTransaction;

pub fn tx_type_active(tx_type: TxType) -> bool {
    v2::tx_type_active(tx_type) || ValidatorOp::VERSION_3_TX_TYPES.contains(&tx_type.get())
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
        Payload::Validator(op) if matches!(op.as_ref(), ValidatorOp::SubmitEvidence(_)) => {
            let ValidatorOp::SubmitEvidence(evidence) = op.as_ref() else {
                unreachable!("matched above")
            };
            outcome(evidence::apply(
                records, overlay, evidence, ctx, meter, events,
            ))
        }
        Payload::Validator(op)
            if matches!(
                op.as_ref(),
                ValidatorOp::RotateConsensusKey { .. } | ValidatorOp::RotateTransportCert { .. }
            ) =>
        {
            outcome(rotation::apply(
                records, overlay, verified, op, ctx, meter, events,
            ))
        }
        _ => v2::run_payload(records, overlay, verified, ctx, meter, events, touched),
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

/// Version 2's balances: a rotation moves none.
pub fn touched_balances(tx: &VerifiedTransaction) -> Vec<(aletheia_core::Address, AssetId)> {
    v2::touched_balances(tx)
}

/// Version 1's end of block, then the validator registry's with this block's key rotations,
/// then rewards: version 2's order.
pub fn end_block(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    ctx: &BlockContext,
) -> Result<v1::Touched, AletheiaError> {
    let mut touched = v1::end_block(records, overlay, ctx)?;
    touched.extend(rotation::end_block(records, overlay, ctx)?);
    touched.extend(v2::rewards::end_block(records, overlay, ctx)?);
    Ok(touched)
}
