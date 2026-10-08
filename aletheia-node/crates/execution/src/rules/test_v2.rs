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
    TxType::CONTRACT_DEPLOY,
    TxType::CONTRACT_CALL,
    TxType::new(48),
    TxType::new(49),
    TxType::new(50),
    TxType::new(51),
    TxType::new(52),
    TxType::new(53),
    TxType::new(56),
    TxType::new(57),
    TxType::new(59),
    TxType::new(60),
    TxType::new(61),
    TxType::new(62),
    TxType::new(63),
    TxType::new(80),
    TxType::new(81),
    TxType::new(82),
    TxType::new(112),
    TxType::new(113),
    TxType::new(114),
    TxType::new(115),
    TxType::new(116),
    TxType::new(117),
    TxType::new(128),
    TxType::new(129),
    TxType::new(130),
    TxType::new(131),
    TxType::new(132),
    TxType::new(133),
    TxType::new(134),
    TxType::new(135),
    TxType::new(136),
    TxType::new(137),
    TxType::new(138),
    TxType::new(139),
    TxType::new(140),
    TxType::new(141),
    TxType::new(142),
    TxType::new(143),
    TxType::new(144),
    TxType::new(145),
    TxType::new(146),
    TxType::new(147),
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
    touched: &mut v1::Touched,
) -> Result<PayloadOutcome, AletheiaError> {
    match &verified.transaction().body.payload {
        Payload::TestRemark(_) => Ok(match meter.charge(REMARK_EU) {
            Ok(()) => PayloadOutcome::Success,
            Err(_) => PayloadOutcome::OutOfEu,
        }),
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
