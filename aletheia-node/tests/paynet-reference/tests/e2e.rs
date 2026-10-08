//! Reference PayNet end to end (spec Section 40D.10): wallet → PayNet → chain → merchant,
//! finality only from the stream, re-signed duplicates stopped by namespace 107, restarts at
//! every step with exactly-once effects, stream disconnects and resumption, HSM policy, and
//! reconciliation R4-R7.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use std::collections::BTreeSet;

use aletheia_core::apn::{ApnOp, PaymentLeg};
use aletheia_core::{AssetId, ErrorCode, Hash32, Payload, Slot};
use aletheia_execution::ReceiptStatus;
use aletheia_paynet_reference::setup::{BANK_A, MERCHANT, bank_a, bank_b, devnet};
use aletheia_paynet_reference::{
    Break, ChainSource, HsmPolicy, PayNet, PaymentState, Refusal, Store, reconcile,
};
use aletheia_test_harness::{Devnet, ONE_AEY};

fn policy() -> HsmPolicy {
    HsmPolicy {
        allowed_types: [128u16, 140].into_iter().collect(),
        per_transaction_max: 40 * ONE_AEY,
        per_hour_max: 200 * ONE_AEY,
        dual_control_above: 20 * ONE_AEY,
    }
}

fn start(net: &Devnet, store: Option<Store>) -> PayNet {
    let store = store.unwrap_or_else(|| Store {
        ledger_balance: net.balance(&net.address(BANK_A), AssetId::AEY).available,
        ..Store::default()
    });
    PayNet::start(bank_a(), BANK_A, policy(), store, net)
}

fn h(byte: u8) -> Hash32 {
    Hash32::from_bytes([byte; 32])
}

fn aey(net: &Devnet, index: usize) -> u128 {
    net.balance(&net.address(index), AssetId::AEY).available
}

#[test]
fn a_payment_is_settled_only_when_the_stream_says_so() {
    let mut net = devnet().unwrap();
    let mut paynet = start(&net, None);
    let merchant = net.address(MERCHANT);
    let before = aey(&net, MERCHANT);
    let state = paynet
        .pay(&mut net, merchant, bank_b(), 10 * ONE_AEY, h(1), false)
        .unwrap();
    // In a block, but PayNet does not call it final from the submission.
    assert_eq!(state, PaymentState::Submitted);
    assert_eq!(paynet.state(&h(1)), Some(PaymentState::Submitted));
    assert_eq!(aey(&net, MERCHANT), before + 10 * ONE_AEY);

    paynet.sync(&ChainSource(&net), 1_000).unwrap();
    assert_eq!(paynet.state(&h(1)), Some(PaymentState::Settled));
    assert_eq!(reconcile(&paynet, &net), []);
}

#[test]
fn a_re_signed_duplicate_is_stopped_by_the_chain() {
    let mut net = devnet().unwrap();
    let mut paynet = start(&net, None);
    let merchant = net.address(MERCHANT);
    paynet
        .pay(&mut net, merchant, bank_b(), 5 * ONE_AEY, h(2), false)
        .unwrap();
    paynet.sync(&ChainSource(&net), 1_000).unwrap();

    // PayNet's own retry is caught by simulation (the chain's namespace 107 answers).
    let retry = paynet.pay(&mut net, merchant, bank_b(), 5 * ONE_AEY, h(2), false);
    assert_eq!(
        retry,
        Err(Refusal::Simulation(ErrorCode::PayDuplicate.get()))
    );
    assert_eq!(
        paynet.state(&h(2)),
        Some(PaymentState::Settled),
        "a settled payment stays settled"
    );

    // A re-signed copy that skips simulation still fails on chain, fee charged, nothing moves.
    let before = aey(&net, MERCHANT);
    let nonce = net.next_nonce(BANK_A);
    let mut body = net.body(
        BANK_A,
        nonce,
        Payload::Apn(Box::new(ApnOp::Payment {
            debtor_agent: bank_a(),
            leg: PaymentLeg {
                creditor: merchant,
                amount: 5 * ONE_AEY,
                creditor_agent: bank_b(),
                uetr_hash: h(2),
                remittance_hash: Hash32::ZERO,
            },
            purpose: *b"GDSV",
            scheme: 0,
        })),
    );
    body.fee.eu_limit = 100_000;
    body.fee.max_fee = 100_000;
    body.valid_from_slot = net.next_slot();
    body.expiry_slot = Slot::new(net.next_slot().get() + 7_000);
    let tx = net.sign(BANK_A, body);
    let (_, executed) = net.produce(vec![tx]).unwrap();
    assert_eq!(executed.receipts[0].status, ReceiptStatus::FailedExecution);
    assert_eq!(
        executed.receipts[0].error_code,
        ErrorCode::PayDuplicate.get()
    );
    assert_eq!(aey(&net, MERCHANT), before);
}

#[test]
fn the_hsm_policy_limits_what_a_key_signs() {
    let mut net = devnet().unwrap();
    let mut paynet = start(&net, None);
    let merchant = net.address(MERCHANT);
    assert!(matches!(
        paynet.pay(&mut net, merchant, bank_b(), 41 * ONE_AEY, h(3), true),
        Err(Refusal::Policy(_))
    ));
    // Above the dual-control threshold: refused without, accepted with, a second approval.
    assert!(matches!(
        paynet.pay(&mut net, merchant, bank_b(), 25 * ONE_AEY, h(4), false),
        Err(Refusal::Policy(_))
    ));
    assert_eq!(
        paynet.pay(&mut net, merchant, bank_b(), 25 * ONE_AEY, h(4), true),
        Ok(PaymentState::Submitted)
    );
    // A type the key may not sign.
    let mut narrow = start(&net, Some(paynet.snapshot()));
    narrow.policy.allowed_types = BTreeSet::from([128u16]);
    assert!(matches!(
        narrow.anchor(&mut net, h(9), vec![h(10)]),
        Err(Refusal::Policy(_))
    ));
}

#[test]
fn a_restart_at_every_step_has_exactly_once_effects() {
    let mut net = devnet().unwrap();
    let merchant = net.address(MERCHANT);
    let mut store = None;
    for i in 0..4u8 {
        // Restart before paying.
        let mut paynet = start(&net, store.take());
        paynet
            .pay(
                &mut net,
                merchant,
                bank_b(),
                ONE_AEY * u128::from(i + 1),
                h(20 + i),
                false,
            )
            .unwrap();
        // Restart before syncing, sync, and restart and sync again (a resend).
        let snapshot = paynet.snapshot();
        let mut paynet = start(&net, Some(snapshot));
        paynet.sync(&ChainSource(&net), 1_000).unwrap();
        let mut paynet = start(&net, Some(paynet.snapshot()));
        paynet.sync(&ChainSource(&net), 1_000).unwrap();
        store = Some(paynet.snapshot());
    }
    let paynet = start(&net, store);
    for i in 0..4u8 {
        assert_eq!(paynet.state(&h(20 + i)), Some(PaymentState::Settled));
    }
    // R4 holds exactly: no settlement was applied twice to the ledger.
    assert_eq!(reconcile(&paynet, &net), []);
}

#[test]
fn a_lost_nonce_write_is_recovered_from_the_chain() {
    let mut net = devnet().unwrap();
    let merchant = net.address(MERCHANT);
    let mut paynet = start(&net, None);
    paynet
        .pay(&mut net, merchant, bank_b(), ONE_AEY, h(30), false)
        .unwrap();
    let mut stale = paynet.snapshot();
    stale.nonce = 0; // the database lost the increment
    let mut restarted = start(&net, Some(stale));
    assert_eq!(restarted.store.nonce, net.next_nonce(BANK_A));
    assert_eq!(
        restarted.pay(&mut net, merchant, bank_b(), ONE_AEY, h(31), false),
        Ok(PaymentState::Submitted)
    );
}

#[test]
fn anchors_recompute_and_orphan_escrows_are_found() {
    let mut net = devnet().unwrap();
    let mut paynet = start(&net, None);
    paynet
        .anchor(&mut net, h(40), vec![h(41), h(42), h(43)])
        .unwrap();
    paynet.sync(&ChainSource(&net), 1_000).unwrap();
    assert_eq!(reconcile(&paynet, &net), []);
    // R6: PayNet's message store no longer matches the anchored root.
    paynet.store.messages.insert(h(40), vec![h(41), h(42)]);
    assert!(reconcile(&paynet, &net).contains(&Break::AnchorMismatch { batch_id: h(40) }));
    // R7: an escrow with no live case or outbox item.
    paynet
        .store
        .messages
        .insert(h(40), vec![h(41), h(42), h(43)]);
    paynet.store.escrows.insert(h(44), false);
    assert_eq!(
        reconcile(&paynet, &net),
        [Break::OrphanEscrow { uetr_hash: h(44) }]
    );
}

proptest::proptest! {
    #![proptest_config(proptest::prelude::ProptestConfig::with_cases(12))]

    /// With a buffer so small the stream disconnects again and again, repeated syncs from the
    /// committed cursor end in the same state as one clean sync.
    #[test]
    fn stream_disconnects_and_resumes_converge(capacity in 1usize..4, payments in 1u8..5) {
        let mut net = devnet().unwrap();
        let merchant = net.address(MERCHANT);
        let mut paynet = start(&net, None);
        for i in 0..payments {
            paynet.pay(&mut net, merchant, bank_b(), ONE_AEY, h(50 + i), false).unwrap();
        }
        let mut clean = start(&net, Some(Store {
            ledger_balance: paynet.store.ledger_balance,
            ..paynet.snapshot()
        }));
        clean.sync(&ChainSource(&net), 10_000).unwrap();
        for _ in 0..200 {
            paynet.sync(&ChainSource(&net), capacity).unwrap();
            if paynet.store.cursor == clean.store.cursor {
                break;
            }
        }
        proptest::prop_assert_eq!(&paynet.store.payments, &clean.store.payments);
        proptest::prop_assert_eq!(paynet.store.ledger_balance, clean.store.ledger_balance);
        proptest::prop_assert_eq!(reconcile(&paynet, &net), vec![]);
    }
}
