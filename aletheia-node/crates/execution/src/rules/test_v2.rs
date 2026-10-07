//! Test-only protocol version 2 (feature `test-protocol-v2`, spec 62.1 Phase 3): version 1
//! plus the `TestRemark` transaction type, which costs 500 EU and changes nothing but the fee
//! and nonce. It exists so mixed-version replay and clean-halt behaviour can be tested before
//! any real upgrade. Never compiled into a release build.

use aletheia_core::{AletheiaError, Payload, TxType};
use aletheia_state::StateOverlay;

use crate::context::{BlockContext, Meter, PayloadOutcome};
use crate::model::Records;
use crate::receipt::{Event, Receipt};
use crate::rules::v1;
use crate::stateless::VerifiedTransaction;

pub const TX_TYPES: &[TxType] = &[
    TxType::TRANSFER,
    TxType::BATCH_TRANSFER,
    TxType::MINT,
    TxType::BURN,
    TxType::LOCK,
    TxType::UNLOCK,
    TxType::REDEEM,
    TxType::RESERVE_ATTESTATION,
    TxType::TEST_REMARK,
];
pub const REMARK_EU: u64 = 500;

fn run_payload(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Result<PayloadOutcome, AletheiaError> {
    match &verified.transaction().body.payload {
        Payload::TestRemark(_) => Ok(match meter.charge(REMARK_EU) {
            Ok(()) => PayloadOutcome::Success,
            Err(_) => PayloadOutcome::OutOfEu,
        }),
        _ => v1::run_payload(records, overlay, verified, ctx, meter, events),
    }
}

pub fn apply_transaction(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    ctx: &BlockContext,
    index: u32,
) -> Result<Receipt, AletheiaError> {
    v1::apply_transaction_with(records, overlay, verified, ctx, index, run_payload)
}
