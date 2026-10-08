//! Profiles load and are chosen by date; layers 2 and 3 refuse what each rail cannot carry,
//! naming the field and the ISO reason (spec Sections 40C.3, 40C.4).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use std::path::PathBuf;

use aletheia_rails::{ProfileSet, RailProfile, scheme_rules, usage_rules};
use aletheia_rails_model::{
    AccountRef, AgentRef, Amount, Bic, CanonicalPayment, ChargeBearer, CountryCode, CurrencyCode,
    Date, Direction, Iban, Max16Text, Max35Text, Max140Text, Party, PostalAddress, Remittance,
    Settlement, Uetr,
};

fn profiles() -> ProfileSet {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("profiles");
    ProfileSet::load(&dir, false).unwrap()
}

fn profile(rail: &str) -> RailProfile {
    profiles()
        .at(rail, Date::parse("2026-10-05").unwrap())
        .unwrap()
        .clone()
}

fn party(name: &str) -> Party {
    Party {
        name: Max140Text::new(name).unwrap(),
        postal_address: Some(PostalAddress {
            town_name: Some(Max35Text::new("Frankfurt").unwrap()),
            country: Some(CountryCode::new("DE").unwrap()),
            post_code: Some(Max16Text::new("60311").unwrap()),
            ..PostalAddress::default()
        }),
        lei: None,
        country_of_residence: None,
    }
}

/// A SEPA credit transfer of 125.00 EUR settling on Monday 2026-10-05.
fn payment() -> CanonicalPayment {
    let eur = CurrencyCode::new("EUR").unwrap();
    CanonicalPayment {
        uetr: Uetr::new("eb6305c9-1f7f-49de-aed0-16487c27b42d").unwrap(),
        end_to_end_id: Max35Text::new("INV-2026-0042").unwrap(),
        instruction_id: None,
        message_id: Max35Text::new("MSG-0001").unwrap(),
        rail: "sepa-sct".to_owned(),
        profile_version: "2025".to_owned(),
        direction: Direction::Outbound,
        settlement: Settlement {
            amount: Amount::parse("125.00", eur, 2).unwrap(),
            date: Some(Date::parse("2026-10-05").unwrap()),
        },
        charge_bearer: ChargeBearer::Slev,
        debtor: party("Aletheia Cooperative Bank"),
        debtor_account: AccountRef::Iban(Iban::new("DE89370400440532013000").unwrap()),
        debtor_agent: AgentRef::Bic(Bic::new("COBADEFF").unwrap()),
        creditor: party("Mueller GmbH"),
        creditor_account: AccountRef::Iban(Iban::new("NL91ABNA0417164300").unwrap()),
        creditor_agent: AgentRef::Bic(Bic::new("ABNANL2A").unwrap()),
        intermediaries: Vec::new(),
        purpose: Some("SUPP".to_owned()),
        remittance: Remittance::Unstructured(vec![Max140Text::new("Invoice 2026/42").unwrap()]),
    }
}

fn never_seen(_: &str) -> bool {
    false
}

fn layers(
    payment: &CanonicalPayment,
    profile: &RailProfile,
) -> Result<(), (u8, &'static str, &'static str)> {
    usage_rules(payment, profile)
        .and_then(|()| scheme_rules(payment, profile, &never_seen))
        .map_err(|r| (r.layer, r.reason, r.field))
}

// ---- profiles ----

#[test]
fn every_profile_loads_and_drafts_are_refused_in_production() {
    let set = profiles();
    let mut rails = set.rails();
    rails.sort_unstable();
    assert_eq!(
        rails,
        [
            "fednow",
            "fedwire",
            "sepa-sct",
            "sepa-sct-inst",
            "sepa-sdd-b2b",
            "sepa-sdd-core",
            "swift-cbpr-plus"
        ]
    );
    assert!(set.all().iter().all(|p| p.status == "draft"));
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("profiles");
    let refused = ProfileSet::load(&dir, true).unwrap_err();
    assert!(refused.detail.contains("draft"), "{refused}");
    // Each profile has a distinct content hash.
    let mut hashes: Vec<_> = set.all().iter().map(|p| p.hash).collect();
    hashes.sort_unstable();
    hashes.dedup();
    assert_eq!(hashes.len(), set.all().len());
}

#[test]
fn the_profile_in_force_is_chosen_by_date() {
    let base = profile("sepa-sct");
    let mut newer = base.clone();
    newer.effective_from = Date::parse("2027-03-01").unwrap();
    newer.version = "2027".to_owned();
    let set = ProfileSet::from_profiles(vec![base, newer]);
    assert_eq!(
        set.at("sepa-sct", Date::parse("2026-12-31").unwrap())
            .unwrap()
            .version,
        "2025"
    );
    assert_eq!(
        set.at("sepa-sct", Date::parse("2027-03-01").unwrap())
            .unwrap()
            .version,
        "2027"
    );
    assert!(
        set.at("sepa-sct", Date::parse("2024-01-01").unwrap())
            .is_none()
    );
}

#[test]
fn an_active_profile_needs_two_reviewers_and_a_date() {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("profiles/sepa-sct/2025.toml");
    let text = std::fs::read_to_string(dir).unwrap();
    let active = text.replace(
        "status              = \"draft\"",
        "status              = \"active\"",
    );
    assert!(
        RailProfile::parse("t.toml", "2025", &active).is_err(),
        "no reviewers"
    );
    let reviewed = active
        .replace(
            "reviewed_by         = []",
            "reviewed_by         = [\"payments-lead\", \"security-lead\"]",
        )
        .replace(
            "reviewed_on         = \"\"",
            "reviewed_on         = \"2026-10-08\"",
        );
    assert!(RailProfile::parse("t.toml", "2025", &reviewed).is_ok());
    let same_person = reviewed.replace("\"security-lead\"", "\"payments-lead\"");
    assert!(
        RailProfile::parse("t.toml", "2025", &same_person).is_err(),
        "two different people"
    );
    let transliterating = text.replace(
        "on_violation        = \"reject\"",
        "on_violation        = \"transliterate\"",
    );
    assert!(RailProfile::parse("t.toml", "2025", &transliterating).is_err());
    let unknown_field = format!("{text}\n[surprise]\nx = 1\n");
    assert!(RailProfile::parse("t.toml", "2025", &unknown_field).is_err());
}

// ---- layer 2 ----

#[test]
fn a_valid_sepa_payment_passes() {
    assert_eq!(layers(&payment(), &profile("sepa-sct")), Ok(()));
    assert_eq!(layers(&payment(), &profile("sepa-sct-inst")), Ok(()));
}

#[test]
fn characters_outside_the_set_are_refused_with_the_field_named() {
    let mut p = payment();
    p.creditor.name = Max140Text::new("Łukasz Nowak").unwrap();
    assert_eq!(
        layers(&p, &profile("sepa-sct")),
        Err((2, "FF01", "Cdtr/Nm"))
    );
    let mut p = payment();
    p.remittance = Remittance::Unstructured(vec![Max140Text::new("Rent & bills").unwrap()]);
    assert_eq!(
        layers(&p, &profile("sepa-sct")),
        Err((2, "FF01", "RmtInf/Ustrd"))
    );
}

#[test]
fn sepa_needs_ibans_and_one_remittance_line() {
    let mut p = payment();
    p.creditor_account = AccountRef::Other {
        scheme: Max35Text::new("BBAN").unwrap(),
        id: Max35Text::new("12345678").unwrap(),
    };
    assert_eq!(
        layers(&p, &profile("sepa-sct")),
        Err((2, "AC01", "CdtrAcct"))
    );
    let mut p = payment();
    p.remittance = Remittance::Unstructured(vec![
        Max140Text::new("line one").unwrap(),
        Max140Text::new("line two").unwrap(),
    ]);
    assert_eq!(
        layers(&p, &profile("sepa-sct")),
        Err((2, "FF01", "RmtInf/Ustrd"))
    );
}

#[test]
fn cbpr_plus_needs_bics_and_addresses() {
    let mut p = payment();
    p.rail = "swift-cbpr-plus".to_owned();
    p.charge_bearer = ChargeBearer::Shar;
    assert_eq!(layers(&p, &profile("swift-cbpr-plus")), Ok(()));
    let mut no_bic = p.clone();
    no_bic.creditor_agent = AgentRef::Aic(Max16Text::new("BANKXLAA").unwrap());
    assert_eq!(
        layers(&no_bic, &profile("swift-cbpr-plus")),
        Err((2, "RC01", "CdtrAgt"))
    );
    let mut no_address = p.clone();
    no_address.debtor.postal_address = None;
    assert_eq!(
        layers(&no_address, &profile("swift-cbpr-plus")),
        Err((2, "FF01", "Dbtr/PstlAdr"))
    );
    let mut unstructured = p;
    unstructured.creditor.postal_address = Some(PostalAddress {
        address_lines: vec![
            aletheia_rails_model::Max70Text::new("1 Main Street, Springfield").unwrap(),
        ],
        ..PostalAddress::default()
    });
    assert_eq!(
        layers(&unstructured, &profile("swift-cbpr-plus")),
        Err((2, "FF01", "Cdtr/PstlAdr"))
    );
}

// ---- layer 3 ----

#[test]
fn currency_amount_and_charge_bearer_follow_the_scheme() {
    let mut p = payment();
    p.settlement.amount = Amount::parse("10.00", CurrencyCode::new("GBP").unwrap(), 2).unwrap();
    assert_eq!(
        layers(&p, &profile("sepa-sct")),
        Err((3, "AM03", "IntrBkSttlmAmt/@Ccy"))
    );
    let mut p = payment();
    p.settlement.amount.minor_units = 0;
    assert_eq!(
        layers(&p, &profile("sepa-sct")),
        Err((3, "AM01", "IntrBkSttlmAmt"))
    );
    let mut p = payment();
    p.charge_bearer = ChargeBearer::Shar;
    assert_eq!(layers(&p, &profile("sepa-sct")), Err((3, "FF01", "ChrgBr")));
    // A scheme cap, where a profile sets one.
    let mut capped = profile("sepa-sct-inst");
    capped.limits.scheme_max_amount = "100.00".to_owned();
    assert_eq!(
        layers(&payment(), &capped),
        Err((3, "AM02", "IntrBkSttlmAmt"))
    );
}

#[test]
fn business_day_rails_refuse_weekend_settlement_and_instant_ones_do_not() {
    let mut p = payment();
    p.settlement.date = Some(Date::parse("2026-10-10").unwrap()); // a Saturday
    assert_eq!(
        layers(&p, &profile("sepa-sct")),
        Err((3, "DT01", "IntrBkSttlmDt"))
    );
    assert_eq!(layers(&p, &profile("sepa-sct-inst")), Ok(()));
}

#[test]
fn duplicates_are_refused_by_the_profile_key() {
    let p = payment();
    let sct = profile("sepa-sct");
    let key = aletheia_rails::layers::duplicate_key(&p, &sct);
    assert!(key.starts_with("e2e:INV-2026-0042|DE89370400440532013000|12500|2026-10-05"));
    let seen = |k: &str| k == key;
    assert_eq!(scheme_rules(&p, &sct, &seen).unwrap_err().reason, "DUPL");
    let cbpr = profile("swift-cbpr-plus");
    assert_eq!(
        aletheia_rails::layers::duplicate_key(&p, &cbpr),
        "uetr:eb6305c9-1f7f-49de-aed0-16487c27b42d"
    );
}
