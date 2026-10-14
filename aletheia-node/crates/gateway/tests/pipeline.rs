//! The gateway pipeline end to end (spec Sections 40, 40C.4, 40C.7, 40C.8): inbound credits
//! become mint operations exactly once, outbound payments become escrow locks, and only a
//! definitive status settles or releases an escrow.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use std::cell::Cell;
use std::path::PathBuf;

use aletheia_core::apn::{Aic, ApnOp, StandingAuthorization};
use aletheia_core::{Address, Hash32};
use aletheia_gateway::{
    ChainView, Gateway, GatewayConfig, InboxOutcome, LegState, MemoryAuditStore, Resolved,
    Screener, Screening, Stage, leg_id,
};
use aletheia_rails::ProfileSet;
use aletheia_rails::iso::{Outcome, TransactionStatus, render_pacs002, render_pacs008};
use aletheia_rails_model::{
    AEY_PER_CENT, AccountRef, AgentRef, Amount, Bic, CanonicalPayment, ChargeBearer, CountryCode,
    CurrencyCode, Date, Direction, Iban, Max16Text, Max35Text, Max140Text, Party, PostalAddress,
    Remittance, Settlement, Uetr,
};

const RAIL: &str = "sepa-sct-inst";
const PARTNER: &str = "COBADEFF";
const AT: &str = "2026-10-05T09:30:00Z";

fn today() -> Date {
    Date::parse("2026-10-05").unwrap()
}

fn profiles() -> ProfileSet {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../rails/profiles");
    ProfileSet::load(&dir, false).unwrap()
}

fn creditor_address() -> Address {
    Address::from_bytes([5; 20])
}

struct Chain {
    headroom: u128,
}

impl ChainView for Chain {
    fn participant_active(&self, _aic: &Aic) -> bool {
        true
    }
    fn resolve(&self, account: &AccountRef) -> Option<Resolved> {
        match account {
            AccountRef::Iban(iban) if iban.as_str() == "NL91ABNA0417164300" => Some(Resolved {
                address: creditor_address(),
                agent: Aic::parse("BANKXLAA").unwrap(),
            }),
            _ => None,
        }
    }
    fn standing_headroom(&self) -> u128 {
        self.headroom
    }
}

struct Screen(Screening, Cell<u32>);

impl Screener for Screen {
    fn screen(&self, _texts: &[(&'static str, &str)]) -> Screening {
        self.1.set(self.1.get() + 1);
        self.0.clone()
    }
}

fn clear() -> Screen {
    Screen(Screening::Clear, Cell::new(0))
}

fn gateway() -> Gateway<MemoryAuditStore> {
    let config = GatewayConfig {
        gateway: Aic::parse("GATEXLGG").unwrap(),
        standing: StandingAuthorization {
            authorization_id: Hash32::from_bytes([9; 32]),
            gateway: Aic::parse("GATEXLGG").unwrap(),
            max_total: 1_000_000 * AEY_PER_CENT,
            valid_until_epoch: 100,
            signatures: vec![aletheia_core::monetary::IndexedSignature {
                index: 0,
                signature: [1; 64],
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

/// From a German debtor to an APN customer whose IBAN is registered with bank A.
fn payment(msg_id: &str, uetr: &str, cents: u128) -> CanonicalPayment {
    CanonicalPayment {
        uetr: Uetr::new(uetr).unwrap(),
        end_to_end_id: Max35Text::new("E2E-1").unwrap(),
        instruction_id: None,
        message_id: Max35Text::new(msg_id).unwrap(),
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
        debtor: party("Mueller GmbH", "Frankfurt", "DE"),
        debtor_account: AccountRef::Iban(Iban::new("DE89370400440532013000").unwrap()),
        debtor_agent: AgentRef::Bic(Bic::new("COBADEFF").unwrap()),
        creditor: party("Ada Okafor", "Amsterdam", "NL"),
        creditor_account: AccountRef::Iban(Iban::new("NL91ABNA0417164300").unwrap()),
        creditor_agent: AgentRef::Bic(Bic::new("ABNANL2A").unwrap()),
        intermediaries: Vec::new(),
        purpose: None,
        remittance: Remittance::Unstructured(vec![Max140Text::new("Salary October").unwrap()]),
    }
}

const UETR_1: &str = "eb6305c9-1f7f-49de-aed0-16487c27b42d";
const UETR_2: &str = "0f6c1a4e-5b2d-4c7e-9a31-6d2e8b7f4c10";

fn message(p: &CanonicalPayment) -> Vec<u8> {
    let profile = profiles().at(RAIL, today()).unwrap().clone();
    render_pacs008(core::slice::from_ref(p), &profile, AT, "CLRG")
        .unwrap()
        .into_bytes()
}

fn never(_: &str) -> bool {
    false
}

// ---- inbound ----

#[test]
fn an_inbound_credit_becomes_one_mint_operation_exactly_once() {
    let mut gw = gateway();
    let chain = Chain {
        headroom: u128::MAX,
    };
    let raw = message(&payment("IN-1", UETR_1, 250_000));
    let result = gw.inbound_credit(RAIL, PARTNER, &raw, today(), AT, &chain, &clear(), &never);
    assert!(
        matches!(result.outcome, InboxOutcome::Accepted { .. }),
        "{result:?}"
    );
    let [
        ApnOp::ExternalInboundCredit {
            amount,
            creditor,
            rail,
            ..
        },
    ] = result.operations.as_slice()
    else {
        panic!("one inbound credit: {result:?}");
    };
    assert_eq!(*amount, 250_000 * AEY_PER_CENT);
    assert_eq!(*creditor, creditor_address());
    assert_eq!(*rail, 2);
    assert_eq!(
        gw.audit.stages(PARTNER, "IN-1"),
        [
            Stage::Received,
            Stage::Validated,
            Stage::Screened,
            Stage::Mapped
        ]
    );
    let rows = gw.audit.records().len();

    // The partner delivers the same message again: the same outcome, nothing new to sign.
    let again = gw.inbound_credit(RAIL, PARTNER, &raw, today(), AT, &chain, &clear(), &never);
    assert_eq!(again.outcome, result.outcome);
    assert!(again.operations.is_empty());
    assert_eq!(gw.audit.records().len(), rows);
    gw.audit.verify().unwrap();
}

#[test]
fn layer_four_rejects_unknown_creditors_and_holds_on_screening_or_headroom() {
    let chain = Chain {
        headroom: u128::MAX,
    };
    // A creditor account APN does not know.
    let mut gw = gateway();
    let mut unknown = payment("IN-2", UETR_1, 100);
    unknown.creditor_account = AccountRef::Iban(Iban::new("GB82WEST12345698765432").unwrap());
    let r = gw.inbound_credit(
        RAIL,
        PARTNER,
        &message(&unknown),
        today(),
        AT,
        &chain,
        &clear(),
        &never,
    );
    assert!(
        matches!(&r.outcome, InboxOutcome::Rejected { reason, .. } if reason == "AC01"),
        "{r:?}"
    );

    // A screening hit, and a screening outage, both hold: fail closed.
    for screening in [
        Screening::Hit("name match".to_owned()),
        Screening::Unavailable,
    ] {
        let mut gw = gateway();
        let screen = Screen(screening, Cell::new(0));
        let r = gw.inbound_credit(
            RAIL,
            PARTNER,
            &message(&payment("IN-3", UETR_1, 100)),
            today(),
            AT,
            &chain,
            &screen,
            &never,
        );
        assert!(matches!(r.outcome, InboxOutcome::Held { .. }), "{r:?}");
        assert!(r.operations.is_empty());
        assert_eq!(screen.1.get(), 1);
    }

    // R2: more than the standing authorization allows waits for a person.
    let mut gw = gateway();
    let low = Chain {
        headroom: 99 * AEY_PER_CENT,
    };
    let r = gw.inbound_credit(
        RAIL,
        PARTNER,
        &message(&payment("IN-4", UETR_1, 100)),
        today(),
        AT,
        &low,
        &clear(),
        &never,
    );
    assert!(matches!(r.outcome, InboxOutcome::Held { .. }), "{r:?}");
    assert_eq!(
        gw.audit.stages(PARTNER, "IN-4"),
        [Stage::Received, Stage::Held]
    );
}

#[test]
fn an_unreadable_message_is_rejected_and_recorded() {
    let mut gw = gateway();
    let chain = Chain {
        headroom: u128::MAX,
    };
    let r = gw.inbound_credit(
        RAIL,
        PARTNER,
        b"<!DOCTYPE x><x/>",
        today(),
        AT,
        &chain,
        &clear(),
        &never,
    );
    assert!(matches!(&r.outcome, InboxOutcome::Rejected { reason, .. } if reason == "FF01"));
    let rows = gw.audit.records();
    assert_eq!(rows.len(), 2);
    assert!(rows[0].entry.msg_id.starts_with("sha256:"));
    assert_eq!(rows[1].entry.stage, Stage::Rejected);
    gw.audit.verify().unwrap();
}

// ---- outbound ----

fn send(gw: &mut Gateway<MemoryAuditStore>, uetr: &str, cents: u128) -> ApnOp {
    let chain = Chain { headroom: 0 };
    gw.outbound(
        &payment(&format!("OUT-{}", &uetr[..8]), uetr, cents),
        &Aic::parse("BANKXLAA").unwrap(),
        cents * AEY_PER_CENT,
        today(),
        AT,
        AT,
        20_400,
        &chain,
        &never,
    )
    .unwrap()
}

fn status(
    gw: &mut Gateway<MemoryAuditStore>,
    uetr: &str,
    code: &str,
    reason: Option<&str>,
) -> Vec<ApnOp> {
    let profile = profiles().at(RAIL, today()).unwrap().clone();
    let report = render_pacs002(
        &format!("ST-{code}"),
        AT,
        &[TransactionStatus {
            original_message_id: format!("OUT-{}", &uetr[..8]),
            original_end_to_end_id: Some("E2E-1".to_owned()),
            original_uetr: Some(Uetr::new(uetr).unwrap()),
            status: code.to_owned(),
            outcome: Outcome::from_code(code).unwrap(),
            reason: reason.map(str::to_owned),
        }],
        &profile,
    )
    .unwrap();
    gw.status_report(RAIL, PARTNER, report.as_bytes(), today(), AT)
        .unwrap()
}

#[test]
fn an_outbound_payment_locks_escrow_and_queues_its_message() {
    let mut gw = gateway();
    let lock = send(&mut gw, UETR_1, 12_345);
    let ApnOp::ExternalLegLock {
        leg_id: id,
        amount,
        rail,
        ..
    } = lock
    else {
        panic!("{lock:?}");
    };
    assert_eq!(
        (id, amount, rail),
        (leg_id(UETR_1), 12_345 * AEY_PER_CENT, 2)
    );
    let queued = gw.outbox.get(UETR_1).unwrap();
    assert!(
        queued
            .message
            .contains("<IntrBkSttlmAmt Ccy=\"EUR\">123.45</IntrBkSttlmAmt>")
    );
    assert_eq!(gw.leg(UETR_1).unwrap().state, LegState::Locked);

    // An amount that is not whole cents never leaves.
    let chain = Chain { headroom: 0 };
    let refused = gw
        .outbound(
            &payment("OUT-X", UETR_2, 100),
            &Aic::parse("BANKXLAA").unwrap(),
            100 * AEY_PER_CENT + 1,
            today(),
            AT,
            AT,
            20_400,
            &chain,
            &never,
        )
        .unwrap_err();
    assert_eq!(refused.reason, "AM02");
    assert!(gw.outbox.get(UETR_2).is_none());
}

#[test]
fn only_a_definitive_status_settles_or_releases() {
    let mut gw = gateway();
    send(&mut gw, UETR_1, 500);
    // A time-out: investigating, nothing to sign, the escrow stays locked (I15).
    assert!(status(&mut gw, UETR_1, "PDNG", Some("AB05")).is_empty());
    assert_eq!(gw.leg(UETR_1).unwrap().state, LegState::Investigating);
    // The late acceptance after the time-out settles it.
    let settle = status(&mut gw, UETR_1, "ACSC", None);
    assert!(
        matches!(settle.as_slice(), [ApnOp::ExternalLegSettle { leg_id: id, .. }] if *id == leg_id(UETR_1))
    );
    assert_eq!(gw.leg(UETR_1).unwrap().state, LegState::Settled);
    // A duplicate or contradicting report afterwards changes nothing.
    assert!(status(&mut gw, UETR_1, "ACSC", None).is_empty());
    assert!(status(&mut gw, UETR_1, "RJCT", Some("AC04")).is_empty());

    send(&mut gw, UETR_2, 700);
    let release = status(&mut gw, UETR_2, "RJCT", Some("AC04"));
    assert!(
        matches!(release.as_slice(), [ApnOp::ExternalLegRelease { reason, .. }] if reason == b"AC04")
    );
    assert_eq!(gw.leg(UETR_2).unwrap().state, LegState::Released);
    gw.audit.verify().unwrap();
}
