//! Single-node execution (spec Section 62, Phase 3): accounts, transfers, fees, receipts,
//! events, ordering.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_core::{AssetId, ErrorCode, Payload, Slot, TransferLeg};
use aletheia_execution::ReceiptStatus;
use aletheia_execution::model::FEE_POOL;
use aletheia_test_harness::{Devnet, EU_PRICE_AEY, ONE_AEY, ONE_ALNT};

const TRANSFER_EU: u128 = 2_000;

fn devnet() -> Devnet {
    Devnet::new(4, 1_000 * ONE_AEY, 1_000 * ONE_ALNT)
}

#[test]
fn a_transfer_moves_value_charges_the_fee_and_creates_the_account() {
    let mut net = devnet();
    let (a, b) = (net.address(0), net.address(1));
    let tx = net.transfer(0, 0, b, AssetId::AEY, 5 * ONE_AEY);
    let (_, executed) = net.produce(vec![tx]).unwrap();

    let receipt = &executed.receipts[0];
    assert_eq!(receipt.status, ReceiptStatus::Success);
    assert_eq!(receipt.eu_used, 2_000);
    assert_eq!(
        (receipt.fee_asset, receipt.fee_amount),
        (AssetId::ALNT, TRANSFER_EU)
    );
    assert_eq!(receipt.events.len(), 1);

    assert_eq!(net.balance(&a, AssetId::AEY).available, 995 * ONE_AEY);
    assert_eq!(net.balance(&b, AssetId::AEY).available, 1_005 * ONE_AEY);
    assert_eq!(
        net.balance(&a, AssetId::ALNT).available,
        1_000 * ONE_ALNT - TRANSFER_EU
    );
    assert_eq!(net.balance(&FEE_POOL, AssetId::ALNT).available, TRANSFER_EU);
    assert_eq!(net.account(&a).unwrap().next_nonce, 1);
    assert_eq!(net.account(&a).unwrap().pubkey_commitment, a.account_hash());
    assert!(
        net.account(&b).is_none(),
        "receiving does not create an account record"
    );
}

#[test]
fn a_failing_payload_is_reverted_but_still_pays_its_fee_and_uses_its_nonce() {
    let mut net = devnet();
    let (a, b) = (net.address(0), net.address(1));
    let tx = net.transfer(0, 0, b, AssetId::AEY, 2_000 * ONE_AEY);
    let (_, executed) = net.produce(vec![tx]).unwrap();
    let receipt = &executed.receipts[0];
    assert_eq!(receipt.status, ReceiptStatus::FailedExecution);
    assert_eq!(receipt.error(), Some(ErrorCode::InsufficientBalance));
    assert!(
        receipt.events.is_empty(),
        "events of a failed payload are discarded"
    );
    assert_eq!(net.balance(&a, AssetId::AEY).available, 1_000 * ONE_AEY);
    assert_eq!(net.balance(&b, AssetId::AEY).available, 1_000 * ONE_AEY);
    assert_eq!(
        net.balance(&a, AssetId::ALNT).available,
        1_000 * ONE_ALNT - TRANSFER_EU
    );
    assert_eq!(net.next_nonce(0), 1);
}

#[test]
fn running_out_of_eu_charges_the_whole_limit_and_reverts() {
    let mut net = devnet();
    let b = net.address(1);
    let mut body = net.body(
        0,
        0,
        Payload::Transfer(TransferLeg {
            recipient: b,
            asset: AssetId::AEY,
            amount: ONE_AEY,
        }),
    );
    body.fee.eu_limit = 1_999;
    body.fee.max_fee = 1_999;
    let (_, executed) = net.produce(vec![net.sign(0, body)]).unwrap();
    let receipt = &executed.receipts[0];
    assert_eq!(
        (receipt.status, receipt.eu_used, receipt.fee_amount),
        (ReceiptStatus::OutOfEu, 1_999, 1_999)
    );
    assert_eq!(net.balance(&b, AssetId::AEY).available, 1_000 * ONE_AEY);
}

#[test]
fn a_batch_transfer_is_all_or_nothing() {
    let mut net = devnet();
    let (b, c) = (net.address(1), net.address(2));
    let legs = vec![
        TransferLeg {
            recipient: b,
            asset: AssetId::AEY,
            amount: 600 * ONE_AEY,
        },
        TransferLeg {
            recipient: c,
            asset: AssetId::AEY,
            amount: 600 * ONE_AEY,
        },
    ];
    let tx = net.sign(0, net.body(0, 0, Payload::BatchTransfer(legs)));
    let (_, executed) = net.produce(vec![tx]).unwrap();
    assert_eq!(executed.receipts[0].status, ReceiptStatus::FailedExecution);
    assert_eq!(
        net.balance(&b, AssetId::AEY).available,
        1_000 * ONE_AEY,
        "first leg reverted too"
    );
    assert_eq!(
        executed.receipts[0].eu_used, 4_000,
        "both legs were metered before the second failed"
    );
}

#[test]
fn paying_fees_in_aey_uses_the_aey_price() {
    let mut net = devnet();
    let b = net.address(1);
    let mut body = net.body(
        0,
        0,
        Payload::Transfer(TransferLeg {
            recipient: b,
            asset: AssetId::ALNT,
            amount: ONE_ALNT,
        }),
    );
    body.fee.fee_asset = AssetId::AEY;
    body.fee.max_fee = 10_000 * EU_PRICE_AEY;
    let (_, executed) = net.produce(vec![net.sign(0, body)]).unwrap();
    assert_eq!(executed.receipts[0].fee_amount, TRANSFER_EU * EU_PRICE_AEY);
    assert_eq!(
        net.balance(&FEE_POOL, AssetId::AEY).available,
        TRANSFER_EU * EU_PRICE_AEY
    );
}

#[test]
fn spending_the_fee_asset_below_the_fee_fails_the_payload_not_the_block() {
    let mut net = Devnet::new(2, 0, 10_000);
    let b = net.address(1);
    // Sends everything but 1,000 Mites, then the 2,000-Mite fee cannot be paid from what is left.
    let tx = net.transfer(0, 0, b, AssetId::ALNT, 9_000);
    let (_, executed) = net.produce(vec![tx]).unwrap();
    assert_eq!(executed.receipts[0].status, ReceiptStatus::FailedExecution);
    assert_eq!(
        executed.receipts[0].error(),
        Some(ErrorCode::InsufficientBalance)
    );
    assert_eq!(
        net.balance(&net.address(0), AssetId::ALNT).available,
        10_000 - TRANSFER_EU
    );
}

#[test]
fn several_senders_and_sequential_nonces_in_one_block() {
    let mut net = devnet();
    let d = net.address(3);
    let txs = vec![
        net.transfer(0, 0, d, AssetId::AEY, ONE_AEY),
        net.transfer(0, 1, d, AssetId::AEY, ONE_AEY),
        net.transfer(1, 0, d, AssetId::AEY, ONE_AEY),
        net.transfer(2, 0, d, AssetId::AEY, ONE_AEY),
    ];
    let (_, executed) = net.produce(txs).unwrap();
    assert_eq!(executed.tx_count, 4);
    assert!(
        executed
            .receipts
            .iter()
            .all(|r| r.status == ReceiptStatus::Success)
    );
    assert_eq!(net.balance(&d, AssetId::AEY).available, 1_004 * ONE_AEY);
    assert_eq!(net.next_nonce(0), 2);
}

#[test]
fn blocks_out_of_canonical_order_are_invalid() {
    let mut net = devnet();
    let d = net.address(3);
    let txs = vec![
        net.transfer(0, 0, d, AssetId::AEY, 1),
        net.transfer(1, 0, d, AssetId::AEY, 1),
    ];
    let mut verified = net.verify(&txs).unwrap();
    // Try both orders; exactly one is canonical.
    let first = net.execute_ordered(verified.clone());
    if first.is_ok() {
        let mut other = devnet();
        verified.reverse();
        let error = other.execute_ordered(verified).unwrap_err();
        assert_eq!(error.code(), ErrorCode::BlkNotCanonicalOrder);
    } else {
        assert_eq!(first.unwrap_err().code(), ErrorCode::BlkNotCanonicalOrder);
    }
}

#[test]
fn a_nonce_gap_or_repeat_makes_the_block_invalid() {
    let mut net = devnet();
    let d = net.address(3);
    let gap = vec![
        net.transfer(0, 0, d, AssetId::AEY, 1),
        net.transfer(0, 2, d, AssetId::AEY, 1),
    ];
    assert_eq!(
        net.produce(gap).unwrap_err().code(),
        ErrorCode::BlkNotCanonicalOrder
    );
    let repeat = vec![
        net.transfer(0, 0, d, AssetId::AEY, 1),
        net.transfer(0, 0, d, AssetId::AEY, 2),
    ];
    assert_eq!(
        net.produce(repeat).unwrap_err().code(),
        ErrorCode::BlkNotCanonicalOrder
    );
}

#[test]
fn stateful_failures_make_the_block_invalid_and_charge_nothing() {
    let mut net = devnet();
    let d = net.address(3);

    let mut expired = net.body(
        0,
        0,
        Payload::Transfer(TransferLeg {
            recipient: d,
            asset: AssetId::AEY,
            amount: 1,
        }),
    );
    expired.expiry_slot = Slot::new(0);
    assert_eq!(
        net.produce(vec![net.sign(0, expired)]).unwrap_err().code(),
        ErrorCode::BlkInvalidTransaction
    );

    let mut cheap = net.body(
        0,
        0,
        Payload::Transfer(TransferLeg {
            recipient: d,
            asset: AssetId::AEY,
            amount: 1,
        }),
    );
    cheap.fee.max_fee = 9_999;
    let error = net.produce(vec![net.sign(0, cheap)]).unwrap_err();
    assert!(
        error.detail().contains("TX_MAX_FEE_INSUFFICIENT"),
        "{error}"
    );

    // Account 1 signs a transaction claiming account 0 as sender.
    let stolen = net.sign(
        1,
        net.body(
            0,
            0,
            Payload::Transfer(TransferLeg {
                recipient: d,
                asset: AssetId::AEY,
                amount: 1,
            }),
        ),
    );
    let error = net.produce(vec![stolen]).unwrap_err();
    assert!(error.detail().contains("TX_KEY_MISMATCH"), "{error}");

    assert_eq!(net.head.height.get(), 0, "no block was committed");
    assert_eq!(
        net.balance(&net.address(0), AssetId::ALNT).available,
        1_000 * ONE_ALNT
    );
}

#[test]
fn a_transaction_cannot_be_replayed_in_a_later_block() {
    let mut net = devnet();
    let d = net.address(3);
    let tx = net.transfer(0, 0, d, AssetId::AEY, ONE_AEY);
    net.produce(vec![tx.clone()]).unwrap();
    let error = net.produce(vec![tx]).unwrap_err();
    assert_eq!(
        error.code(),
        ErrorCode::BlkNotCanonicalOrder,
        "nonce 0 is no longer next"
    );
}

#[test]
fn self_transfers_conserve_the_balance() {
    let mut net = devnet();
    let a = net.address(0);
    net.produce(vec![net.transfer(0, 0, a, AssetId::AEY, 10 * ONE_AEY)])
        .unwrap();
    assert_eq!(net.balance(&a, AssetId::AEY).available, 1_000 * ONE_AEY);
}

#[test]
fn every_root_changes_with_content_and_header_hashes_chain() {
    let mut net = devnet();
    let d = net.address(3);
    let genesis_hash = net.head.block_hash(&net.network);
    let (p1, e1) = net
        .produce(vec![net.transfer(0, 0, d, AssetId::AEY, 1)])
        .unwrap();
    let (p2, e2) = net.produce(vec![]).unwrap();
    assert_eq!(p1.block.header.parent_hash, genesis_hash);
    assert_eq!(
        p2.block.header.parent_hash,
        p1.block.header.block_hash(&net.network)
    );
    assert_ne!(e1.tx_root, e2.tx_root);
    assert_ne!(e1.receipt_root, e2.receipt_root);
    assert_eq!(e2.tx_count, 0);
    assert_eq!(
        p2.block.header.state_root, p1.block.header.state_root,
        "an empty block changes no state"
    );
    assert_eq!(
        p2.block.header.protocol_time_ms,
        p1.block.header.protocol_time_ms + 500
    );
}
