//! The Aletheia Payment Network's on-chain part (spec Sections 40B, 40D.5; Phase 11): the
//! participant directory under governance, payments between banks' customers, limits,
//! de-duplication, returns, recalls, batches, account numbers, proxies and message anchors.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_core::apn::{
    Aan, Aic, ApnOp, Limits, ParticipantSpec, PaymentLeg, PaymentRef, role, status,
};
use aletheia_core::registry::{GovAction, RegistryOp, proposal_id};
use aletheia_core::{AssetId, ChainId, ErrorCode, Hash32, NetworkIdentity, NetworkKind, Payload};
use aletheia_execution::apn_model::Apn;
use aletheia_execution::{Receipt, ReceiptStatus};
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT, keys};

const EPOCH_SLOTS: u64 = 4;
/// Accounts: 0-2 the council, 3 bank A's settlement account, 4 bank B's, 5 Alice (bank A's
/// customer), 6 Bob (bank B's customer), 7 anyone.
const BANK_A: usize = 3;
const BANK_B: usize = 4;
const ALICE: usize = 5;
const BOB: usize = 6;
const ANYONE: usize = 7;

fn devnet() -> Devnet {
    let provisional = NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO);
    let council: Vec<String> = keys(3)
        .iter()
        .map(|k| {
            format!(
                "\"{}\"",
                aletheia_crypto::address::ed25519_account(&provisional, &k.public_key())
                    .to_text(NetworkKind::Devnet)
            )
        })
        .collect();
    let extra = format!(
        "\n[governance]\ncouncil = [{}]\nthreshold = 2\nepoch_slots = {EPOCH_SLOTS}\nvoting_epochs = 3\nexecution_window_epochs = 5\nmax_aey_capacity_increase = \"{}\"\n",
        council.join(", "),
        10 * ONE_AEY
    );
    Devnet::with_genesis_extra(8, 100 * ONE_AEY, 1_000 * ONE_ALNT, &extra)
}

fn submit(net: &mut Devnet, from: usize, payload: Payload) -> Receipt {
    let nonce = net.next_nonce(from);
    let mut body = net.body(from, nonce, payload);
    body.fee.eu_limit = 100_000;
    body.fee.max_fee = 100_000;
    let tx = net.sign(from, body);
    let (_, executed) = net.produce(vec![tx]).expect("the block is valid");
    executed.receipts[0].clone()
}

fn apn(net: &mut Devnet, from: usize, op: ApnOp) -> Receipt {
    submit(net, from, Payload::Apn(Box::new(op)))
}

fn ok(r: &Receipt) {
    assert_eq!(r.status, ReceiptStatus::Success, "{r:?}");
}

fn refused(r: &Receipt, code: ErrorCode) {
    assert_eq!(r.status, ReceiptStatus::FailedExecution, "{r:?}");
    assert_eq!(r.error_code, code.get(), "expected {code:?}: {r:?}");
}

/// Proposed by member 0, approved by member 1, executed after its timelock.
fn govern(net: &mut Devnet, action: GovAction) {
    let nonce = net.next_nonce(0);
    let id = proposal_id(&net.network, &net.address(0), nonce, &action);
    ok(&submit(
        net,
        0,
        Payload::Registry(Box::new(RegistryOp::GovPropose {
            action: action.clone(),
        })),
    ));
    ok(&submit(
        net,
        1,
        Payload::Registry(Box::new(RegistryOp::GovVote {
            proposal_id: id,
            approve: true,
        })),
    ));
    for _ in 0..(action.timelock_epochs() + 1) * EPOCH_SLOTS {
        net.produce(Vec::new()).unwrap();
    }
    ok(&submit(
        net,
        ANYONE,
        Payload::Registry(Box::new(RegistryOp::GovExecute { proposal_id: id })),
    ));
}

fn aic(text: &str) -> Aic {
    Aic::parse(text).unwrap()
}

fn bank_a() -> Aic {
    aic("BANKXLAA")
}

fn bank_b() -> Aic {
    aic("BNKBXLBB")
}

fn spec(net: &Devnet, code: Aic, account: usize, routing_code: u16) -> ParticipantSpec {
    ParticipantSpec {
        aic: code,
        legal_name_hash: h(1),
        lei: None,
        bic: None,
        role: role::DIRECT_PARTICIPANT,
        sponsor: None,
        settlement_address: net.address(account),
        routing_code,
        messaging_keys: Vec::new(),
        schemes: 0b1, // scheme 0: instant credit transfer
        limits: Limits {
            per_payment_max: 50 * ONE_AEY,
            daily_out_max: 60 * ONE_AEY,
            daily_in_max: 1_000 * ONE_AEY,
        },
    }
}

fn h(byte: u8) -> Hash32 {
    Hash32::from_bytes([byte; 32])
}

fn aan(body: &[u8; 16]) -> Aan {
    Aan::from_body(body).unwrap()
}

/// Both banks admitted; each gave its customer an account number.
fn network() -> Devnet {
    let mut net = devnet();
    let a = spec(&net, bank_a(), BANK_A, 1001);
    let b = spec(&net, bank_b(), BANK_B, 2002);
    govern(&mut net, GovAction::UpsertParticipant(Box::new(a)));
    govern(&mut net, GovAction::UpsertParticipant(Box::new(b)));
    let alice = net.address(ALICE);
    let bob = net.address(BOB);
    ok(&apn(
        &mut net,
        BANK_A,
        ApnOp::AanAssign {
            aan: aan(b"1001000000000005"),
            address: alice,
        },
    ));
    ok(&apn(
        &mut net,
        BANK_B,
        ApnOp::AanAssign {
            aan: aan(b"2002000000000006"),
            address: bob,
        },
    ));
    net
}

fn leg(net: &Devnet, to: usize, agent: Aic, amount: u128, uetr: u8) -> PaymentLeg {
    PaymentLeg {
        creditor: net.address(to),
        amount,
        creditor_agent: agent,
        uetr_hash: h(uetr),
        remittance_hash: h(0),
    }
}

fn pay(net: &mut Devnet, from: usize, agent: Aic, leg: PaymentLeg) -> Receipt {
    apn(
        net,
        from,
        ApnOp::Payment {
            debtor_agent: agent,
            leg,
            purpose: *b"SALA",
            scheme: 0,
        },
    )
}

fn aey(net: &Devnet, index: usize) -> u128 {
    net.balance(&net.address(index), AssetId::AEY).available
}

fn original(uetr: u8) -> PaymentRef {
    PaymentRef {
        debtor_agent: bank_a(),
        uetr_hash: h(uetr),
        leg: 0,
    }
}

// ---- the directory ----

#[test]
fn only_governance_admits_participants() {
    let mut net = devnet();
    let to_bob = leg(&net, BOB, bank_b(), ONE_AEY, 1);
    refused(
        &pay(&mut net, ALICE, bank_a(), to_bob),
        ErrorCode::ApnParticipantUnknown,
    );
    let a = spec(&net, bank_a(), BANK_A, 1001);
    govern(&mut net, GovAction::UpsertParticipant(Box::new(a)));
    let records = net.records();
    let view = net.view();
    let directory = Apn { records: &records };
    let admitted = directory.participant(&view, &bank_a()).unwrap().unwrap();
    assert_eq!(admitted.status, status::ACTIVE);
    assert_eq!(
        directory
            .participant_at(&view, &net.address(BANK_A))
            .unwrap()
            .unwrap()
            .spec
            .aic,
        bank_a()
    );
}

#[test]
fn governance_bounds_participant_records() {
    let mut net = devnet();
    // An indirect participant needs a sponsor: the proposal itself is refused.
    let mut indirect = spec(&net, bank_a(), BANK_A, 1001);
    indirect.role = role::INDIRECT_PARTICIPANT;
    let r = submit(
        &mut net,
        0,
        Payload::Registry(Box::new(RegistryOp::GovPropose {
            action: GovAction::UpsertParticipant(Box::new(indirect)),
        })),
    );
    refused(&r, ErrorCode::GovOutOfBounds);
    let r = submit(
        &mut net,
        0,
        Payload::Registry(Box::new(RegistryOp::GovPropose {
            action: GovAction::SetParticipantStatus {
                aic: bank_a(),
                status: 9,
            },
        })),
    );
    refused(&r, ErrorCode::GovOutOfBounds);
}

// ---- payments ----

#[test]
fn a_payment_settles_between_two_banks_customers_exactly_once() {
    let mut net = network();
    let (alice, bob) = (aey(&net, ALICE), aey(&net, BOB));
    let to_bob = leg(&net, BOB, bank_b(), 10 * ONE_AEY, 1);
    let r = pay(&mut net, ALICE, bank_a(), to_bob);
    ok(&r);
    assert_eq!(aey(&net, ALICE), alice - 10 * ONE_AEY);
    assert_eq!(aey(&net, BOB), bob + 10 * ONE_AEY);
    assert!(r.events.iter().any(|e| e.event_type
        == aletheia_execution::receipt::event_type("aletheia.apn.payment.settled.v1")));
    // The same agent and UETR again: refused, nothing moves.
    refused(
        &pay(&mut net, ALICE, bank_a(), to_bob),
        ErrorCode::PayDuplicate,
    );
    assert_eq!(aey(&net, BOB), bob + 10 * ONE_AEY);
}

#[test]
fn each_agent_must_serve_its_account() {
    let mut net = network();
    // Alice is bank A's customer, not bank B's.
    let to_bob = leg(&net, BOB, bank_b(), ONE_AEY, 2);
    refused(
        &pay(&mut net, ALICE, bank_b(), to_bob),
        ErrorCode::ApnRoutingMismatch,
    );
    // Bob is bank B's customer, so naming bank A as his agent fails.
    let wrong_creditor_agent = leg(&net, BOB, bank_a(), ONE_AEY, 3);
    refused(
        &pay(&mut net, ALICE, bank_a(), wrong_creditor_agent),
        ErrorCode::ApnRoutingMismatch,
    );
    // An account no participant serves cannot send.
    let from_anyone = leg(&net, BOB, bank_b(), ONE_AEY, 4);
    refused(
        &pay(&mut net, ANYONE, bank_a(), from_anyone),
        ErrorCode::ApnRoutingMismatch,
    );
    // A bank's own settlement account is served by that bank.
    let from_bank = leg(&net, BOB, bank_b(), ONE_AEY, 5);
    ok(&pay(&mut net, BANK_A, bank_a(), from_bank));
}

#[test]
fn limits_and_schemes_are_enforced() {
    let mut net = network();
    let too_big = leg(&net, BOB, bank_b(), 51 * ONE_AEY, 6);
    refused(
        &pay(&mut net, ALICE, bank_a(), too_big),
        ErrorCode::ApnLimitExceeded,
    );
    let first = leg(&net, BOB, bank_b(), 50 * ONE_AEY, 7);
    ok(&pay(&mut net, ALICE, bank_a(), first));
    // 50 + 20 is above bank A's daily outgoing maximum of 60.
    let second = leg(&net, BOB, bank_b(), 20 * ONE_AEY, 8);
    refused(
        &pay(&mut net, BANK_A, bank_a(), second),
        ErrorCode::ApnLimitExceeded,
    );
    // Bank A is certified for scheme 0 only.
    let other_scheme = leg(&net, BOB, bank_b(), ONE_AEY, 9);
    let r = apn(
        &mut net,
        ALICE,
        ApnOp::Payment {
            debtor_agent: bank_a(),
            leg: other_scheme,
            purpose: *b"SALA",
            scheme: 3,
        },
    );
    refused(&r, ErrorCode::ApnSchemeNotCertified);
}

#[test]
fn suspension_takes_effect_without_a_timelock() {
    let mut net = network();
    assert_eq!(
        GovAction::SetParticipantStatus {
            aic: bank_b(),
            status: status::SUSPENDED
        }
        .timelock_epochs(),
        0
    );
    govern(
        &mut net,
        GovAction::SetParticipantStatus {
            aic: bank_b(),
            status: status::SUSPENDED,
        },
    );
    let to_bob = leg(&net, BOB, bank_b(), ONE_AEY, 10);
    refused(
        &pay(&mut net, ALICE, bank_a(), to_bob),
        ErrorCode::ApnParticipantInactive,
    );
    govern(
        &mut net,
        GovAction::SetParticipantStatus {
            aic: bank_b(),
            status: status::ACTIVE,
        },
    );
    ok(&pay(&mut net, ALICE, bank_a(), to_bob));
}

// ---- returns and recalls ----

#[test]
fn returns_and_recalls_follow_the_original_payment() {
    let mut net = network();
    let alice_start = aey(&net, ALICE);
    let to_bob = leg(&net, BOB, bank_b(), 10 * ONE_AEY, 11);
    ok(&pay(&mut net, ALICE, bank_a(), to_bob));

    // Bob returns part; more than what is left is refused; only Bob may return.
    let ret = |amount| ApnOp::PaymentReturn {
        original: original(11),
        amount,
        reason: *b"AC04",
    };
    ok(&apn(&mut net, BOB, ret(4 * ONE_AEY)));
    assert_eq!(aey(&net, ALICE), alice_start - 6 * ONE_AEY);
    refused(
        &apn(&mut net, BOB, ret(7 * ONE_AEY)),
        ErrorCode::ApnReturnExceeds,
    );
    refused(
        &apn(&mut net, ANYONE, ret(ONE_AEY)),
        ErrorCode::ApnNotParticipant,
    );

    // Alice asks for the rest back; Bob accepts and the remaining 6 return.
    let request = ApnOp::RecallRequest {
        original: original(11),
        reason: *b"DUPL",
    };
    refused(
        &apn(&mut net, BOB, request.clone()),
        ErrorCode::ApnNotParticipant,
    );
    ok(&apn(&mut net, ALICE, request.clone()));
    refused(
        &apn(&mut net, ALICE, request),
        ErrorCode::ApnIllegalTransition,
    );
    let accept = ApnOp::RecallResponse {
        original: original(11),
        accept: true,
        reason: *b"CUST",
    };
    ok(&apn(&mut net, BOB, accept.clone()));
    assert_eq!(aey(&net, ALICE), alice_start);
    refused(&apn(&mut net, BOB, accept), ErrorCode::ApnIllegalTransition);

    // A payment that never settled cannot be returned.
    let unknown = ApnOp::PaymentReturn {
        original: original(99),
        amount: ONE_AEY,
        reason: *b"AC04",
    };
    refused(&apn(&mut net, BOB, unknown), ErrorCode::ApnPaymentUnknown);
}

#[test]
fn a_declined_recall_moves_nothing() {
    let mut net = network();
    let to_bob = leg(&net, BOB, bank_b(), 3 * ONE_AEY, 12);
    ok(&pay(&mut net, ALICE, bank_a(), to_bob));
    let bob = aey(&net, BOB);
    ok(&apn(
        &mut net,
        ALICE,
        ApnOp::RecallRequest {
            original: original(12),
            reason: *b"FRAD",
        },
    ));
    ok(&apn(
        &mut net,
        BOB,
        ApnOp::RecallResponse {
            original: original(12),
            accept: false,
            reason: *b"NOOR",
        },
    ));
    assert_eq!(aey(&net, BOB), bob);
}

// ---- batches ----

#[test]
fn a_non_atomic_batch_skips_failing_legs_and_an_atomic_one_reverts_all() {
    let mut net = network();
    let bob = aey(&net, BOB);
    let good = leg(&net, BOB, bank_b(), ONE_AEY, 20);
    let unserved = leg(&net, ANYONE, bank_b(), ONE_AEY, 21);
    let also_good = leg(&net, BOB, bank_b(), 2 * ONE_AEY, 22);
    let batch = |legs: Vec<PaymentLeg>, atomic| ApnOp::BatchPayment {
        debtor_agent: bank_a(),
        legs,
        purpose: *b"PAYR",
        atomic,
    };
    let r = apn(
        &mut net,
        BANK_A,
        batch(vec![good, unserved, also_good], false),
    );
    ok(&r);
    assert_eq!(aey(&net, BOB), bob + 3 * ONE_AEY);
    assert!(r.events.iter().any(|e| e.event_type
        == aletheia_execution::receipt::event_type("aletheia.apn.batch.skipped.v1")));

    let fresh = leg(&net, BOB, bank_b(), ONE_AEY, 23);
    let unserved_again = leg(&net, ANYONE, bank_b(), ONE_AEY, 24);
    refused(
        &apn(&mut net, BANK_A, batch(vec![fresh, unserved_again], true)),
        ErrorCode::ApnRoutingMismatch,
    );
    assert_eq!(
        aey(&net, BOB),
        bob + 3 * ONE_AEY,
        "nothing from the atomic batch"
    );
    // The reverted leg left no de-duplication entry: it can be sent again.
    ok(&pay(&mut net, BANK_A, bank_a(), fresh));
}

// ---- account numbers, proxies, anchors ----

#[test]
fn account_numbers_stay_in_the_assigning_banks_range() {
    let mut net = network();
    let bob = net.address(BOB);
    refused(
        &apn(
            &mut net,
            BANK_A,
            ApnOp::AanAssign {
                aan: aan(b"2002000000000099"),
                address: bob,
            },
        ),
        ErrorCode::ApnRoutingMismatch,
    );
    refused(
        &apn(
            &mut net,
            BANK_A,
            ApnOp::AanAssign {
                aan: aan(b"1001000000000005"),
                address: bob,
            },
        ),
        ErrorCode::ApnAlreadyExists,
    );
    refused(
        &apn(
            &mut net,
            ALICE,
            ApnOp::AanAssign {
                aan: aan(b"1001000000000777"),
                address: bob,
            },
        ),
        ErrorCode::ApnNotParticipant,
    );
    let records = net.records();
    let view = net.view();
    let mapping = Apn { records: &records }
        .aan(&view, &aan(b"1001000000000005"))
        .unwrap()
        .unwrap();
    assert_eq!(mapping.address, net.address(ALICE));
    assert_eq!(mapping.registrar, bank_a());
}

#[test]
fn proxies_belong_to_the_bank_that_registered_them() {
    let mut net = network();
    let alice = net.address(ALICE);
    let proxy = h(42);
    ok(&apn(
        &mut net,
        BANK_A,
        ApnOp::ProxyRegister {
            proxy,
            address: alice,
        },
    ));
    refused(
        &apn(
            &mut net,
            BANK_B,
            ApnOp::ProxyRegister {
                proxy,
                address: alice,
            },
        ),
        ErrorCode::ApnAlreadyExists,
    );
    refused(
        &apn(&mut net, BANK_B, ApnOp::ProxyRemove { proxy }),
        ErrorCode::ApnNotParticipant,
    );
    ok(&apn(&mut net, BANK_A, ApnOp::ProxyRemove { proxy }));
}

#[test]
fn message_anchors_are_written_once_by_a_participant() {
    let mut net = network();
    let anchor = ApnOp::MessageAnchor {
        batch_id: h(50),
        merkle_root: h(51),
        count: 12,
    };
    refused(
        &apn(&mut net, ALICE, anchor.clone()),
        ErrorCode::ApnNotParticipant,
    );
    ok(&apn(&mut net, BANK_A, anchor.clone()));
    refused(&apn(&mut net, BANK_B, anchor), ErrorCode::ApnAlreadyExists);
    let records = net.records();
    let view = net.view();
    let stored = Apn { records: &records }
        .anchor(&view, &h(50))
        .unwrap()
        .unwrap();
    assert_eq!((stored.count, stored.participant), (12, bank_a()));
}
