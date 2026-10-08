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
    Aan, Aic, ApnOp, Limits, ParticipantSpec, PaymentLeg, PaymentRef, StandingAuthorization,
    frequency, mandate_id, request_id, role, schedule_id, status,
};
use aletheia_core::registry::{GovAction, RegistryOp, proposal_id};
use aletheia_core::{
    AssetId, ChainId, ErrorCode, Hash32, NetworkIdentity, NetworkKind, Payload, Slot,
};
use aletheia_execution::apn_model::{
    Apn, day_of, escrow_status, mandate_status, request_status, schedule_status,
};
use aletheia_execution::{Receipt, ReceiptStatus};
use aletheia_test_harness::{Devnet, GENESIS_TIME_MS, ONE_AEY, ONE_ALNT, keys};

const EPOCH_SLOTS: u64 = 4;
/// Accounts: 0-2 the council, 3 bank A's settlement account, 4 bank B's, 5 Alice (bank A's
/// customer), 6 Bob (bank B's customer), 7 anyone.
const BANK_A: usize = 3;
const BANK_B: usize = 4;
const ALICE: usize = 5;
const BOB: usize = 6;
const ANYONE: usize = 7;
/// A gateway operator's settlement account (used by the external-leg tests).
const GATEWAY: usize = 8;

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
    // A 2-of-3 Monetary Authority (authority keys from seeds 50-52) for inbound credits.
    let authority_keys: Vec<String> = (0..3u8)
        .map(|i| {
            let key = aletheia_crypto::Ed25519SigningKey::from_seed(&aletheia_crypto::Secret::new(
                [50 + i; 32],
            ));
            format!(
                "\"{}\"",
                aletheia_core::base16::encode(&key.public_key().to_bytes())
            )
        })
        .collect();
    let monetary = format!(
        "\n[monetary]\nauthority_keys = [{keys}]\nauthority_threshold = 2\nredemption_agents = [{keys}]\nattestors = [{keys}]\nattestor_threshold = 2\nattestor_threshold_large_deviation = 3\nmax_deviation_bps = 1000\nmax_attestation_age_slots = 20\nreserve_feed_id = 1\nenforce_reserve_ratio = false\nmin_reserve_ratio_bps = 10000\naey_authorized_capacity = \"{}\"\naey_epoch_issuance_cap = \"{}\"\n",
        2_000 * ONE_AEY,
        500 * ONE_AEY,
        keys = authority_keys.join(", "),
    );
    Devnet::with_genesis_extra(9, 100 * ONE_AEY, 1_000 * ONE_ALNT, &(extra + &monetary))
}

fn submit(net: &mut Devnet, from: usize, payload: Payload) -> Receipt {
    let nonce = net.next_nonce(from);
    let mut body = net.body(from, nonce, payload);
    body.fee.eu_limit = 100_000;
    body.fee.max_fee = 100_000;
    // Valid from the next slot, so transactions stay valid after skipped days.
    body.valid_from_slot = net.next_slot();
    body.expiry_slot = Slot::new(net.next_slot().get() + 7_000);
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

// ---- request-to-pay ----

fn today() -> u64 {
    day_of(GENESIS_TIME_MS)
}

#[test]
fn a_payment_request_settles_only_when_the_payer_accepts() {
    let mut net = network();
    let alice = net.address(ALICE);
    let nonce = net.next_nonce(BOB);
    let request = ApnOp::PaymentRequest {
        payer: alice,
        amount: 7 * ONE_AEY,
        creditor_agent: bank_b(),
        uetr_hash: h(60),
        remittance_hash: h(61),
        expires_day: today() + 30,
    };
    ok(&apn(&mut net, BOB, request));
    let id = request_id(&net.network, &net.address(BOB), nonce);
    let (alice_before, bob_before) = (aey(&net, ALICE), aey(&net, BOB));
    let answer = |accept| ApnOp::PaymentRequestResponse {
        request_id: id,
        accept,
        debtor_agent: bank_a(),
    };
    refused(
        &apn(&mut net, ANYONE, answer(true)),
        ErrorCode::ApnNotParticipant,
    );
    ok(&apn(&mut net, ALICE, answer(true)));
    assert_eq!(aey(&net, ALICE), alice_before - 7 * ONE_AEY);
    assert_eq!(aey(&net, BOB), bob_before + 7 * ONE_AEY);
    refused(
        &apn(&mut net, ALICE, answer(true)),
        ErrorCode::ApnRequestClosed,
    );
    let records = net.records();
    let view = net.view();
    let stored = Apn { records: &records }
        .request(&view, &id)
        .unwrap()
        .unwrap();
    assert_eq!(stored.status, request_status::PAID);
}

#[test]
fn a_declined_or_expired_request_pays_nothing() {
    let mut net = network();
    let alice = net.address(ALICE);
    let bob_before = aey(&net, BOB);
    let nonce = net.next_nonce(BOB);
    ok(&apn(
        &mut net,
        BOB,
        ApnOp::PaymentRequest {
            payer: alice,
            amount: ONE_AEY,
            creditor_agent: bank_b(),
            uetr_hash: h(62),
            remittance_hash: h(0),
            expires_day: today() + 1,
        },
    ));
    let id = request_id(&net.network, &net.address(BOB), nonce);
    ok(&apn(
        &mut net,
        ALICE,
        ApnOp::PaymentRequestResponse {
            request_id: id,
            accept: false,
            debtor_agent: bank_a(),
        },
    ));
    assert_eq!(aey(&net, BOB), bob_before);
    // A request whose last day already passed cannot be created.
    refused(
        &apn(
            &mut net,
            BOB,
            ApnOp::PaymentRequest {
                payer: alice,
                amount: ONE_AEY,
                creditor_agent: bank_b(),
                uetr_hash: h(63),
                remittance_hash: h(0),
                expires_day: today() - 1,
            },
        ),
        ErrorCode::TxFieldOutOfRange,
    );
    // The payee's bank must serve the payee.
    refused(
        &apn(
            &mut net,
            BOB,
            ApnOp::PaymentRequest {
                payer: alice,
                amount: ONE_AEY,
                creditor_agent: bank_a(),
                uetr_hash: h(64),
                remittance_hash: h(0),
                expires_day: today() + 1,
            },
        ),
        ErrorCode::ApnRoutingMismatch,
    );
}

// ---- mandates and direct debit ----

/// Alice authorizes Bob to debit her; returns the mandate id.
fn mandate(net: &mut Devnet, how_often: u8, max_amount: u128, first_day: u64) -> Hash32 {
    let bob = net.address(BOB);
    let nonce = net.next_nonce(ALICE);
    ok(&apn(
        net,
        ALICE,
        ApnOp::MandateCreate {
            creditor: bob,
            creditor_agent: bank_b(),
            debtor_agent: bank_a(),
            max_amount,
            frequency: how_often,
            first_day,
            final_day: first_day + 365,
        },
    ));
    mandate_id(&net.network, &net.address(ALICE), nonce)
}

fn debit(net: &mut Devnet, id: Hash32, amount: u128, uetr: u8) -> Receipt {
    apn(
        net,
        BOB,
        ApnOp::DirectDebit {
            mandate_id: id,
            amount,
            uetr_hash: h(uetr),
            remittance_hash: h(0),
        },
    )
}

#[test]
fn a_creditor_debits_within_the_mandate() {
    let mut net = network();
    let id = mandate(&mut net, frequency::MONTHLY, 5 * ONE_AEY, today());
    let (alice, bob) = (aey(&net, ALICE), aey(&net, BOB));
    refused(
        &debit(&mut net, id, 6 * ONE_AEY, 70),
        ErrorCode::ApnMandateLimit,
    );
    ok(&debit(&mut net, id, 5 * ONE_AEY, 71));
    assert_eq!(aey(&net, ALICE), alice - 5 * ONE_AEY);
    assert_eq!(aey(&net, BOB), bob + 5 * ONE_AEY);
    // Monthly: a second debit in the same month is refused.
    refused(
        &debit(&mut net, id, ONE_AEY, 72),
        ErrorCode::ApnMandateLimit,
    );
    // Only the creditor debits.
    let r = apn(
        &mut net,
        ANYONE,
        ApnOp::DirectDebit {
            mandate_id: id,
            amount: ONE_AEY,
            uetr_hash: h(73),
            remittance_hash: h(0),
        },
    );
    refused(&r, ErrorCode::ApnNotParticipant);
}

#[test]
fn frequencies_once_and_on_demand() {
    let mut net = network();
    let once = mandate(&mut net, frequency::ONCE, 2 * ONE_AEY, today());
    ok(&debit(&mut net, once, ONE_AEY, 74));
    refused(
        &debit(&mut net, once, ONE_AEY, 75),
        ErrorCode::ApnMandateLimit,
    );
    let any_time = mandate(&mut net, frequency::ON_DEMAND, 2 * ONE_AEY, today());
    ok(&debit(&mut net, any_time, ONE_AEY, 76));
    ok(&debit(&mut net, any_time, ONE_AEY, 77));
    // Each debit is still a payment: the same UETR twice is a duplicate.
    refused(
        &debit(&mut net, any_time, ONE_AEY, 77),
        ErrorCode::PayDuplicate,
    );
}

#[test]
fn the_debtor_controls_the_mandate() {
    let mut net = network();
    let id = mandate(&mut net, frequency::ON_DEMAND, 3 * ONE_AEY, today());
    let amend = |suspended| ApnOp::MandateAmend {
        mandate_id: id,
        max_amount: 3 * ONE_AEY,
        final_day: today() + 10,
        suspended,
    };
    refused(
        &apn(&mut net, BOB, amend(true)),
        ErrorCode::ApnNotParticipant,
    );
    ok(&apn(&mut net, ALICE, amend(true)));
    refused(
        &debit(&mut net, id, ONE_AEY, 80),
        ErrorCode::ApnMandateNotUsable,
    );
    ok(&apn(&mut net, ALICE, amend(false)));
    ok(&debit(&mut net, id, ONE_AEY, 81));
    // Either party may cancel; a cancelled mandate is final.
    ok(&apn(&mut net, BOB, ApnOp::MandateCancel { mandate_id: id }));
    refused(
        &debit(&mut net, id, ONE_AEY, 82),
        ErrorCode::ApnMandateNotUsable,
    );
    refused(
        &apn(&mut net, ALICE, amend(false)),
        ErrorCode::ApnMandateNotUsable,
    );
    let records = net.records();
    let view = net.view();
    let stored = Apn { records: &records }
        .mandate(&view, &id)
        .unwrap()
        .unwrap();
    assert_eq!(
        (stored.status, stored.debits),
        (mandate_status::CANCELLED, 1)
    );
}

#[test]
fn a_mandate_is_usable_only_inside_its_window() {
    let mut net = network();
    let later = mandate(&mut net, frequency::ON_DEMAND, ONE_AEY, today() + 5);
    refused(
        &debit(&mut net, later, ONE_AEY, 85),
        ErrorCode::ApnMandateNotUsable,
    );
    refused(
        &apn(
            &mut net,
            BOB,
            ApnOp::DirectDebit {
                mandate_id: h(9),
                amount: ONE_AEY,
                uetr_hash: h(86),
                remittance_hash: h(0),
            },
        ),
        ErrorCode::ApnRecordUnknown,
    );
}

// ---- scheduled payments ----

/// Slots in one day at the devnet's 500 ms slots.
const SLOTS_PER_DAY: u64 = 86_400_000 / 500;

/// Alice schedules a payment to Bob for `day`; returns its id.
fn schedule(net: &mut Devnet, amount: u128, uetr: u8, day: u64) -> (Hash32, Receipt) {
    let nonce = net.next_nonce(ALICE);
    let to_bob = leg(net, BOB, bank_b(), amount, uetr);
    let r = apn(
        net,
        ALICE,
        ApnOp::ScheduledPayment {
            debtor_agent: bank_a(),
            leg: to_bob,
            purpose: *b"RENT",
            execute_day: day,
        },
    );
    (schedule_id(&net.network, &net.address(ALICE), nonce), r)
}

fn scheduled(net: &Devnet, id: &Hash32) -> aletheia_execution::apn_model::ScheduleRecord {
    let records = net.records();
    let view = net.view();
    Apn { records: &records }
        .schedule(&view, id)
        .unwrap()
        .unwrap()
}

#[test]
fn a_scheduled_payment_runs_on_its_day_and_not_before() {
    let mut net = network();
    let (alice, bob) = (aey(&net, ALICE), aey(&net, BOB));
    let (id, r) = schedule(&mut net, 4 * ONE_AEY, 90, today() + 1);
    ok(&r);
    net.produce(Vec::new()).unwrap();
    assert_eq!(aey(&net, BOB), bob, "not before its day");
    assert_eq!(scheduled(&net, &id).status, schedule_status::PENDING);

    net.skip_slots(SLOTS_PER_DAY);
    assert_eq!(aey(&net, ALICE), alice - 4 * ONE_AEY);
    assert_eq!(aey(&net, BOB), bob + 4 * ONE_AEY);
    let record = scheduled(&net, &id);
    assert_eq!(record.status, schedule_status::EXECUTED);
    assert_eq!(record.executed_height, net.head.height.get());
    // Executed once: later blocks leave it alone.
    net.produce(Vec::new()).unwrap();
    assert_eq!(aey(&net, BOB), bob + 4 * ONE_AEY);
}

#[test]
fn an_unfunded_or_duplicate_scheduled_payment_fails_and_moves_nothing() {
    let mut net = network();
    let (too_much, r) = schedule(&mut net, 40 * ONE_AEY, 91, today() + 1);
    ok(&r);
    // Alice moves most of her AEY away before the day comes.
    let anyone = net.address(ANYONE);
    let away = aey(&net, ALICE) - 5 * ONE_AEY;
    ok(&submit(
        &mut net,
        ALICE,
        Payload::Transfer(aletheia_core::TransferLeg {
            recipient: anyone,
            asset: AssetId::AEY,
            amount: away,
        }),
    ));
    // Its UETR is used by a payment made today, so on its day it is a duplicate.
    let (duplicate, r) = schedule(&mut net, ONE_AEY, 92, today() + 1);
    ok(&r);
    let same_uetr = leg(&net, BOB, bank_b(), ONE_AEY, 92);
    ok(&pay(&mut net, ALICE, bank_a(), same_uetr));
    let (fine, r) = schedule(&mut net, 2 * ONE_AEY, 93, today() + 1);
    ok(&r);
    let bob = aey(&net, BOB);

    net.skip_slots(SLOTS_PER_DAY);
    let failed = scheduled(&net, &too_much);
    assert_eq!(failed.status, schedule_status::FAILED);
    assert_eq!(failed.result_code, ErrorCode::InsufficientBalance.get());
    let failed = scheduled(&net, &duplicate);
    assert_eq!(
        (failed.status, failed.result_code),
        (schedule_status::FAILED, ErrorCode::PayDuplicate.get())
    );
    // The others' failures did not stop it.
    assert_eq!(scheduled(&net, &fine).status, schedule_status::EXECUTED);
    assert_eq!(aey(&net, BOB), bob + 2 * ONE_AEY);
}

#[test]
fn a_payment_is_scheduled_only_for_a_future_day() {
    let mut net = network();
    let (_, r) = schedule(&mut net, ONE_AEY, 94, today());
    refused(&r, ErrorCode::TxFieldOutOfRange);
    // The debtor's agent must serve the debtor when it is scheduled.
    let to_bob = leg(&net, BOB, bank_b(), ONE_AEY, 95);
    let r = apn(
        &mut net,
        ALICE,
        ApnOp::ScheduledPayment {
            debtor_agent: bank_b(),
            leg: to_bob,
            purpose: *b"RENT",
            execute_day: today() + 2,
        },
    );
    refused(&r, ErrorCode::ApnRoutingMismatch);
}

#[test]
fn an_idle_chain_catches_up_on_missed_days() {
    let mut net = network();
    let bob = aey(&net, BOB);
    let (first, r) = schedule(&mut net, ONE_AEY, 96, today() + 1);
    ok(&r);
    let (second, r) = schedule(&mut net, ONE_AEY, 97, today() + 3);
    ok(&r);
    // No block for five days, then one block: both days are processed.
    net.skip_slots(5 * SLOTS_PER_DAY);
    assert_eq!(scheduled(&net, &first).status, schedule_status::EXECUTED);
    assert_eq!(scheduled(&net, &second).status, schedule_status::EXECUTED);
    assert_eq!(aey(&net, BOB), bob + 2 * ONE_AEY);
}

// ---- external legs: escrow and inbound credits ----

fn gateway_aic() -> Aic {
    aic("GATEXLGG")
}

fn authority(i: u8) -> aletheia_crypto::Ed25519SigningKey {
    aletheia_crypto::Ed25519SigningKey::from_seed(&aletheia_crypto::Secret::new([50 + i; 32]))
}

/// `network()` plus a gateway operator at account 8.
fn with_gateway() -> Devnet {
    let mut net = network();
    let mut gateway = spec(&net, gateway_aic(), GATEWAY, 3003);
    gateway.role = role::GATEWAY_OPERATOR;
    govern(&mut net, GovAction::UpsertParticipant(Box::new(gateway)));
    net
}

fn lock(net: &mut Devnet, from: usize, leg_id: u8, amount: u128) -> Receipt {
    apn(
        net,
        from,
        ApnOp::ExternalLegLock {
            leg_id: h(leg_id),
            amount,
            uetr_hash: h(leg_id),
            rail: 2, // SEPA Instant, by profile
            profile_hash: h(200),
            gateway: gateway_aic(),
            expiry_day: today() + 1,
        },
    )
}

fn escrowed(net: &Devnet) -> aletheia_execution::model::Balance {
    net.balance(
        &aletheia_execution::rules::v1::apn::EXTERNAL_ESCROW,
        AssetId::AEY,
    )
}

fn aey_supply(net: &Devnet) -> aletheia_monetary::SupplyLedger {
    net.records()
        .supply_ledger(&net.view(), AssetId::AEY)
        .unwrap()
        .unwrap()
}

fn escrow_status_of(net: &Devnet, leg_id: u8) -> u8 {
    let records = net.records();
    let view = net.view();
    Apn { records: &records }
        .escrow(&view, &h(leg_id))
        .unwrap()
        .unwrap()
        .status
}

#[test]
fn an_outbound_leg_is_escrowed_then_burned_when_the_rail_accepts() {
    let mut net = with_gateway();
    let (bank, supply) = (aey(&net, BANK_A), aey_supply(&net));
    ok(&lock(&mut net, BANK_A, 100, 10 * ONE_AEY));
    assert_eq!(aey(&net, BANK_A), bank - 10 * ONE_AEY);
    assert_eq!(escrowed(&net).locked, 10 * ONE_AEY);
    assert_eq!(aey_supply(&net).locked, supply.locked + 10 * ONE_AEY);

    let settle = ApnOp::ExternalLegSettle {
        leg_id: h(100),
        msg_id_hash: h(101),
    };
    refused(
        &apn(&mut net, BANK_B, settle.clone()),
        ErrorCode::ApnNotParticipant,
    );
    ok(&apn(&mut net, GATEWAY, settle.clone()));
    assert_eq!(escrowed(&net).locked, 0);
    let after = aey_supply(&net);
    assert_eq!(after.redeemed_total, supply.redeemed_total + 10 * ONE_AEY);
    assert_eq!(after.locked, supply.locked);
    assert_eq!(escrow_status_of(&net, 100), escrow_status::SETTLED);
    // I13: a settled leg never moves again.
    refused(
        &apn(&mut net, GATEWAY, settle),
        ErrorCode::ApnIllegalTransition,
    );
    let release = ApnOp::ExternalLegRelease {
        leg_id: h(100),
        reason: *b"AC04",
    };
    refused(
        &apn(&mut net, GATEWAY, release),
        ErrorCode::ApnIllegalTransition,
    );
}

#[test]
fn a_rejected_leg_returns_to_the_sender() {
    let mut net = with_gateway();
    let bank = aey(&net, BANK_A);
    ok(&lock(&mut net, BANK_A, 110, 5 * ONE_AEY));
    refused(
        &lock(&mut net, BANK_A, 110, ONE_AEY),
        ErrorCode::ApnAlreadyExists,
    );
    ok(&apn(
        &mut net,
        GATEWAY,
        ApnOp::ExternalLegRelease {
            leg_id: h(110),
            reason: *b"AC04",
        },
    ));
    assert_eq!(aey(&net, BANK_A), bank);
    assert_eq!(escrowed(&net).locked, 0);
    assert_eq!(escrow_status_of(&net, 110), escrow_status::RELEASED);
}

#[test]
fn only_participants_lock_and_only_through_a_gateway() {
    let mut net = with_gateway();
    // A customer account is not a participant's settlement account.
    refused(
        &lock(&mut net, ALICE, 120, ONE_AEY),
        ErrorCode::ApnNotParticipant,
    );
    // Naming a bank as the gateway is refused.
    let r = apn(
        &mut net,
        BANK_A,
        ApnOp::ExternalLegLock {
            leg_id: h(121),
            amount: ONE_AEY,
            uetr_hash: h(121),
            rail: 2,
            profile_hash: h(200),
            gateway: bank_b(),
            expiry_day: today() + 1,
        },
    );
    refused(&r, ErrorCode::ApnNotParticipant);
    // The gateway's per-payment maximum applies.
    refused(
        &lock(&mut net, BANK_A, 122, 51 * ONE_AEY),
        ErrorCode::ApnLimitExceeded,
    );
}

#[test]
fn an_expired_leg_stays_locked_until_a_definitive_answer() {
    let mut net = with_gateway();
    ok(&lock(&mut net, BANK_A, 130, 3 * ONE_AEY));
    // Days pass with no answer: I15, the escrow is never released by time alone.
    net.skip_slots(3 * SLOTS_PER_DAY);
    assert_eq!(escrow_status_of(&net, 130), escrow_status::LOCKED);
    assert_eq!(escrowed(&net).locked, 3 * ONE_AEY);
}

fn standing(net: &Devnet, id: u8, max_total: u128, signers: &[u8]) -> StandingAuthorization {
    let mut standing = StandingAuthorization {
        authorization_id: h(id),
        gateway: gateway_aic(),
        max_total,
        valid_until_epoch: 100,
        signatures: Vec::new(),
    };
    let digest = standing.digest(&net.network);
    standing.signatures = signers
        .iter()
        .map(|i| aletheia_core::monetary::IndexedSignature {
            index: *i,
            signature: authority(*i).sign(&digest).to_bytes(),
        })
        .collect();
    standing
}

fn inbound(
    net: &mut Devnet,
    from: usize,
    msg: u8,
    amount: u128,
    standing: StandingAuthorization,
) -> Receipt {
    let bob = net.address(BOB);
    apn(
        net,
        from,
        ApnOp::ExternalInboundCredit {
            rail: 2,
            uetr_hash: h(msg),
            msg_id_hash: h(msg),
            amount,
            creditor: bob,
            creditor_agent: bank_b(),
            standing,
        },
    )
}

#[test]
fn an_inbound_credit_mints_once_within_the_standing_authorization() {
    let mut net = with_gateway();
    let auth = standing(&net, 140, 15 * ONE_AEY, &[0, 1]);
    let (bob, supply) = (aey(&net, BOB), aey_supply(&net));
    ok(&inbound(&mut net, GATEWAY, 141, 10 * ONE_AEY, auth.clone()));
    assert_eq!(aey(&net, BOB), bob + 10 * ONE_AEY);
    assert_eq!(
        aey_supply(&net).issued_total,
        supply.issued_total + 10 * ONE_AEY
    );
    // The same message again: refused by its uniqueness key.
    refused(
        &inbound(&mut net, GATEWAY, 141, 10 * ONE_AEY, auth.clone()),
        ErrorCode::PayDuplicate,
    );
    // 10 + 10 is above the authorization's 15.
    refused(
        &inbound(&mut net, GATEWAY, 142, 10 * ONE_AEY, auth.clone()),
        ErrorCode::ApnStandingExhausted,
    );
    ok(&inbound(&mut net, GATEWAY, 143, 5 * ONE_AEY, auth.clone()));
    // Only the gateway named in the authorization, and only with enough signatures.
    refused(
        &inbound(&mut net, BANK_B, 144, ONE_AEY, auth),
        ErrorCode::ApnNotParticipant,
    );
    let weak = standing(&net, 145, 15 * ONE_AEY, &[0]);
    refused(
        &inbound(&mut net, GATEWAY, 146, ONE_AEY, weak),
        ErrorCode::MonetaryAuthorizationInvalid,
    );
}
