//! Rail chaos against the chain (spec Section 40C.12, Phase 11 exit: "railsim chaos green with
//! I13-I15, R8-R9"). Outbound payments go through the gateway, their escrow locks and the
//! gateway's settle/release decisions are signed and executed on a devnet, and the simulated
//! partner answers with time-outs, late answers, duplicates, reordering or silence.
//!
//! After every run: each escrow's on-chain state is what the partner's definitive answer says
//! (I13), a leg with no definitive answer is still LOCKED (I15), the escrow account holds
//! exactly the AEY of LOCKED legs (I14, also checked by the chain after every block), and the
//! partner statement reconciles with the chain with no breaks (R8, R9).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use std::path::PathBuf;

use aletheia_core::apn::{Aic, ApnOp, Limits, ParticipantSpec, StandingAuthorization, role};
use aletheia_core::registry::{GovAction, RegistryOp, proposal_id};
use aletheia_core::{AssetId, ChainId, Hash32, NetworkIdentity, NetworkKind, Payload, Slot};
use aletheia_execution::apn_model::{Apn, day_of, escrow_status};
use aletheia_execution::rules::v1::apn::EXTERNAL_ESCROW;
use aletheia_execution::{Receipt, ReceiptStatus};
use aletheia_gateway::reconcile::{Expected, Movement, reconcile};
use aletheia_gateway::{ChainView, Gateway, GatewayConfig, MemoryAuditStore, Resolved, leg_id};
use aletheia_rails::ProfileSet;
use aletheia_rails_model::{
    AEY_PER_CENT, AccountRef, AgentRef, Amount, Bic, CanonicalPayment, ChargeBearer, CountryCode,
    CurrencyCode, Date, Direction, Iban, Max16Text, Max35Text, Max140Text, Party, PostalAddress,
    Remittance, Settlement, Uetr,
};
use aletheia_railsim::{Behaviour, RailSim};
use aletheia_test_harness::{Devnet, GENESIS_TIME_MS, ONE_AEY, ONE_ALNT, keys};

const EPOCH_SLOTS: u64 = 4;
const BANK: usize = 3;
const GATEWAY: usize = 4;
const RAIL: &str = "sepa-sct-inst";
const NOSTRO: &str = "DE89370400440532013000";
const OPENING_CENTS: i128 = 10_000_000;

fn bank_aic() -> Aic {
    Aic::parse("BANKXLAA").unwrap()
}

fn gateway_aic() -> Aic {
    Aic::parse("GATEXLGG").unwrap()
}

fn submit(net: &mut Devnet, from: usize, payload: Payload) -> Receipt {
    let nonce = net.next_nonce(from);
    let mut body = net.body(from, nonce, payload);
    body.fee.eu_limit = 100_000;
    body.fee.max_fee = 100_000;
    body.valid_from_slot = net.next_slot();
    body.expiry_slot = Slot::new(net.next_slot().get() + 7_000);
    let tx = net.sign(from, body);
    let (_, executed) = net.produce(vec![tx]).expect("the block is valid");
    executed.receipts[0].clone()
}

fn ok(r: &Receipt) {
    assert_eq!(r.status, ReceiptStatus::Success, "{r:?}");
}

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
        2,
        Payload::Registry(Box::new(RegistryOp::GovExecute { proposal_id: id })),
    ));
}

fn participant(net: &Devnet, aic: Aic, account: usize, kind: u8, routing: u16) -> ParticipantSpec {
    ParticipantSpec {
        aic,
        legal_name_hash: Hash32::from_bytes([1; 32]),
        lei: None,
        bic: None,
        role: kind,
        sponsor: None,
        settlement_address: net.address(account),
        routing_code: routing,
        messaging_keys: Vec::new(),
        schemes: 1,
        limits: Limits {
            per_payment_max: 50 * ONE_AEY,
            daily_out_max: 1_000 * ONE_AEY,
            daily_in_max: 1_000 * ONE_AEY,
        },
    }
}

/// A devnet with a council (accounts 0-2), bank A (account 3) and a gateway operator (4).
fn chain() -> Devnet {
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
    let mut net = Devnet::with_genesis_extra(5, 100 * ONE_AEY, 1_000 * ONE_ALNT, &extra);
    let bank = participant(&net, bank_aic(), BANK, role::DIRECT_PARTICIPANT, 1001);
    let gateway = participant(&net, gateway_aic(), GATEWAY, role::GATEWAY_OPERATOR, 3003);
    govern(&mut net, GovAction::UpsertParticipant(Box::new(bank)));
    govern(&mut net, GovAction::UpsertParticipant(Box::new(gateway)));
    net
}

struct Active;

impl ChainView for Active {
    fn participant_active(&self, _aic: &Aic) -> bool {
        true
    }
    fn resolve(&self, _account: &AccountRef) -> Option<Resolved> {
        None
    }
    fn standing_headroom(&self) -> u128 {
        0
    }
}

fn today() -> Date {
    Date::parse("2026-10-05").unwrap()
}

fn profiles() -> ProfileSet {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../crates/rails/profiles");
    ProfileSet::load(&dir, false).unwrap()
}

fn gateway() -> Gateway<MemoryAuditStore> {
    let config = GatewayConfig {
        gateway: gateway_aic(),
        standing: StandingAuthorization {
            authorization_id: Hash32::from_bytes([9; 32]),
            gateway: gateway_aic(),
            max_total: 0,
            valid_until_epoch: 0,
            signatures: vec![aletheia_core::monetary::IndexedSignature {
                index: 0,
                signature: [0; 64],
            }],
        },
        settlement_method: "CLRG".to_owned(),
    };
    Gateway::new(
        profiles(),
        config,
        aletheia_gateway::AuditLedger::new(MemoryAuditStore::default()),
    )
}

fn party(name: &str, town: &str, country: &str) -> Party {
    Party {
        name: Max140Text::new(name).unwrap(),
        postal_address: Some(PostalAddress {
            town_name: Some(Max35Text::new(town).unwrap()),
            country: Some(CountryCode::new(country).unwrap()),
            post_code: Some(Max16Text::new("1011").unwrap()),
            ..PostalAddress::default()
        }),
        lei: None,
        country_of_residence: None,
    }
}

fn uetr(i: usize) -> String {
    format!("{:08x}-0000-4000-8000-{:012x}", i + 1, i + 1)
}

/// A payment from bank A's customer out to a German beneficiary.
fn outbound(i: usize, cents: u128) -> CanonicalPayment {
    CanonicalPayment {
        uetr: Uetr::new(&uetr(i)).unwrap(),
        end_to_end_id: Max35Text::new(format!("E2E-{i}")).unwrap(),
        instruction_id: None,
        message_id: Max35Text::new(format!("OUT-{i}")).unwrap(),
        rail: RAIL.to_owned(),
        profile_version: "2025".to_owned(),
        direction: Direction::Outbound,
        settlement: Settlement {
            amount: Amount {
                minor_units: cents,
                currency: CurrencyCode::new("EUR").unwrap(),
            },
            date: Some(today()),
        },
        charge_bearer: ChargeBearer::Slev,
        debtor: party("Ada Okafor", "Amsterdam", "NL"),
        debtor_account: AccountRef::Iban(Iban::new("NL91ABNA0417164300").unwrap()),
        debtor_agent: AgentRef::Bic(Bic::new("ABNANL2A").unwrap()),
        creditor: party("Mueller GmbH", "Frankfurt", "DE"),
        creditor_account: AccountRef::Iban(Iban::new(NOSTRO).unwrap()),
        creditor_agent: AgentRef::Bic(Bic::new("COBADEFF").unwrap()),
        intermediaries: Vec::new(),
        purpose: None,
        remittance: Remittance::Unstructured(vec![
            Max140Text::new(format!("Payment {i}")).unwrap(),
        ]),
    }
}

fn escrow_state(net: &Devnet, uetr: &str) -> u8 {
    let records = net.records();
    let view = net.view();
    Apn { records: &records }
        .escrow(&view, &leg_id(uetr))
        .unwrap()
        .unwrap()
        .status
}

/// One run: each payment gets one behaviour; returns nothing, asserts everything.
fn run(behaviours: &[Behaviour]) {
    let mut net = chain();
    let mut gw = gateway();
    let profile = profiles().at(RAIL, today()).unwrap().clone();
    let mut sim = RailSim::new(profile, OPENING_CENTS).unwrap();
    let expiry_day = day_of(GENESIS_TIME_MS) + 1;
    let amounts: Vec<u128> = (0..behaviours.len())
        .map(|i| 100 * (u128::try_from(i).unwrap() + 1))
        .collect();

    for (i, behaviour) in behaviours.iter().enumerate() {
        let payment = outbound(i, amounts[i]);
        let lock = gw
            .outbound(
                &payment,
                &bank_aic(),
                amounts[i] * AEY_PER_CENT,
                today(),
                "t",
                "2026-10-05T09:00:00Z",
                expiry_day,
                &Active,
                &|_| false,
            )
            .unwrap();
        assert!(matches!(lock, ApnOp::ExternalLegLock { .. }));
        ok(&submit(&mut net, BANK, Payload::Apn(Box::new(lock))));
        let message = gw.outbox.get(&uetr(i)).unwrap().message.clone();
        sim.submit(&message, *behaviour).unwrap();
        gw.outbox.mark_sent(&uetr(i));
    }

    // Virtual time runs past every scheduled answer; each decision is signed and executed.
    for _ in 0..30 {
        for report in sim.advance(5) {
            let operations = gw
                .status_report(RAIL, "COBADEFF", &report, today(), "t")
                .unwrap();
            for op in operations {
                ok(&submit(&mut net, GATEWAY, Payload::Apn(Box::new(op))));
            }
        }
    }

    // I13 / I15: every leg is where the partner's definitive answer puts it, and nowhere else.
    let mut locked = 0u128;
    let mut settled = Vec::new();
    for (i, behaviour) in behaviours.iter().enumerate() {
        let state = escrow_state(&net, &uetr(i));
        match behaviour.settles() {
            Some(true) => {
                assert_eq!(state, escrow_status::SETTLED, "{behaviour:?}");
                settled.push(Movement {
                    uetr: uetr(i),
                    amount: amounts[i],
                });
            }
            Some(false) => assert_eq!(state, escrow_status::RELEASED, "{behaviour:?}"),
            None => {
                assert_eq!(state, escrow_status::LOCKED, "silence never releases (I15)");
                locked += amounts[i] * AEY_PER_CENT;
            }
        }
    }
    // I14, read from the chain.
    assert_eq!(net.balance(&EXTERNAL_ESCROW, AssetId::AEY).locked, locked);

    // R8 / R9: the partner statement against the chain.
    let total_settled: u128 = settled.iter().map(|m| m.amount).sum();
    let expected = Expected {
        settled,
        minted: Vec::new(),
        open_inbound_cases: Default::default(),
        expected_closing: Some(OPENING_CENTS - i128::try_from(total_settled).unwrap()),
    };
    assert_eq!(reconcile(&sim.statement(NOSTRO), &expected), []);
    gw.audit.verify().unwrap();
}

#[test]
fn every_behaviour_once() {
    run(&[
        Behaviour::Accept,
        Behaviour::Reject("AC04"),
        Behaviour::TimeoutThenAccept,
        Behaviour::TimeoutThenReject("AB06"),
        Behaviour::AcceptTwice,
        Behaviour::OutOfOrder,
        Behaviour::Silent,
    ]);
}

fn behaviour() -> impl proptest::strategy::Strategy<Value = Behaviour> {
    proptest::prop_oneof![
        proptest::strategy::Just(Behaviour::Accept),
        proptest::strategy::Just(Behaviour::Reject("AC04")),
        proptest::strategy::Just(Behaviour::TimeoutThenAccept),
        proptest::strategy::Just(Behaviour::TimeoutThenReject("AB06")),
        proptest::strategy::Just(Behaviour::AcceptTwice),
        proptest::strategy::Just(Behaviour::OutOfOrder),
        proptest::strategy::Just(Behaviour::Silent),
    ]
}

proptest::proptest! {
    #![proptest_config(proptest::prelude::ProptestConfig::with_cases(8))]

    /// Random mixes of partner behaviour: the invariants hold in every run.
    #[test]
    fn invariants_hold_under_random_partner_behaviour(behaviours in proptest::collection::vec(behaviour(), 1..6)) {
        run(&behaviours);
    }
}
