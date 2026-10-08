//! ISO 20022 layer 1: `pacs.008` and `pacs.002` to and from the canonical model (spec
//! Sections 40, 40C.4, 40C.12). The messages here are written for these tests; the scheme
//! operators' published samples belong in the conformance packs (`tests/rails/<rail>/`).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use std::path::PathBuf;

use aletheia_rails::iso::{
    Outcome, TransactionStatus, parse_pacs002, parse_pacs008, render_pacs002, render_pacs008,
};
use aletheia_rails::{ProfileSet, RailProfile, scheme_rules, usage_rules};
use aletheia_rails_model::{
    AccountRef, AgentRef, Amount, Bic, CanonicalPayment, ChargeBearer, CountryCode, CurrencyCode,
    Date, Direction, Iban, Max16Text, Max35Text, Max140Text, Party, PostalAddress, Remittance,
    Settlement, Uetr,
};

fn profile(rail: &str) -> RailProfile {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("profiles");
    ProfileSet::load(&dir, false)
        .unwrap()
        .at(rail, Date::parse("2026-10-05").unwrap())
        .unwrap()
        .clone()
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

fn payment(rail: &str, e2e: &str, cents: u128) -> CanonicalPayment {
    CanonicalPayment {
        uetr: Uetr::new("eb6305c9-1f7f-49de-aed0-16487c27b42d").unwrap(),
        end_to_end_id: Max35Text::new(e2e).unwrap(),
        instruction_id: Some(Max35Text::new("INSTR-1").unwrap()),
        message_id: Max35Text::new("MSG-20261005-1").unwrap(),
        rail: rail.to_owned(),
        profile_version: "2025".to_owned(),
        direction: Direction::Outbound,
        settlement: Settlement {
            amount: Amount {
                minor_units: cents,
                currency: CurrencyCode::new("EUR").unwrap(),
            },
            date: Some(Date::parse("2026-10-05").unwrap()),
        },
        charge_bearer: ChargeBearer::Slev,
        debtor: party("Aletheia Cooperative Bank", "Amsterdam", "NL"),
        debtor_account: AccountRef::Iban(Iban::new("NL91ABNA0417164300").unwrap()),
        debtor_agent: AgentRef::Bic(Bic::new("ABNANL2A").unwrap()),
        creditor: party("Mueller GmbH", "Frankfurt", "DE"),
        creditor_account: AccountRef::Iban(Iban::new("DE89370400440532013000").unwrap()),
        creditor_agent: AgentRef::Bic(Bic::new("COBADEFF").unwrap()),
        intermediaries: Vec::new(),
        purpose: Some("SUPP".to_owned()),
        remittance: Remittance::Unstructured(vec![Max140Text::new("Invoice 2026/42").unwrap()]),
    }
}

const CREATED: &str = "2026-10-05T09:30:00Z";

#[test]
fn a_rendered_payment_parses_back_to_itself() {
    let sct = profile("sepa-sct-inst");
    let original = payment("sepa-sct-inst", "INV-2026-0042", 12_500);
    let xml = render_pacs008(core::slice::from_ref(&original), &sct, CREATED, "CLRG").unwrap();
    assert!(xml.contains("urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08"));
    assert!(xml.contains("<IntrBkSttlmAmt Ccy=\"EUR\">125.00</IntrBkSttlmAmt>"));
    let parsed = parse_pacs008(xml.as_bytes(), &sct).unwrap();
    let mut expected = original;
    expected.direction = Direction::Inbound;
    assert_eq!(parsed, vec![expected]);
    // Rendering is pure.
    assert_eq!(xml, render_pacs008(&parsed, &sct, CREATED, "CLRG").unwrap());
}

#[test]
fn an_inbound_message_passes_all_three_layers() {
    let sct = profile("sepa-sct-inst");
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>INBOUND-0001</MsgId>
      <CreDtTm>2026-10-05T09:31:02Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId><EndToEndId>SALARY-OCT</EndToEndId></PmtId>
      <IntrBkSttlmAmt Ccy="EUR">2500.00</IntrBkSttlmAmt>
      <IntrBkSttlmDt>2026-10-05</IntrBkSttlmDt>
      <ChrgBr>SLEV</ChrgBr>
      <Dbtr><Nm>Mueller GmbH</Nm><PstlAdr><TwnNm>Frankfurt</TwnNm><Ctry>DE</Ctry></PstlAdr></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BICFI>COBADEFF</BICFI></FinInstnId></DbtrAgt>
      <CdtrAgt><FinInstnId><BICFI>ABNANL2A</BICFI></FinInstnId></CdtrAgt>
      <Cdtr><Nm>Ada Okafor</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>NL91ABNA0417164300</IBAN></Id></CdtrAcct>
      <RmtInf><Ustrd>Salary October</Ustrd></RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>"#;
    let payments = parse_pacs008(xml.as_bytes(), &sct).unwrap();
    assert_eq!(payments.len(), 1);
    let p = &payments[0];
    assert_eq!(p.settlement.amount.minor_units, 250_000);
    assert_eq!(p.debtor.name.as_str(), "Mueller GmbH");
    usage_rules(p, &sct).unwrap();
    scheme_rules(p, &sct, &|_| false).unwrap();
    // No UETR on SEPA: one is derived from what identifies the payment, the same every time.
    let again = parse_pacs008(xml.as_bytes(), &sct).unwrap();
    assert_eq!(again[0].uetr, p.uetr);
}

#[test]
fn version_count_and_required_fields_are_checked() {
    let sct = profile("sepa-sct-inst");
    let good = render_pacs008(
        &[payment("sepa-sct-inst", "E2E-1", 100)],
        &sct,
        CREATED,
        "CLRG",
    )
    .unwrap();
    let field = |xml: &str| parse_pacs008(xml.as_bytes(), &sct).unwrap_err().field;
    assert_eq!(
        field(&good.replace("pacs.008.001.08", "pacs.008.001.02")),
        "Document/@xmlns"
    );
    assert_eq!(
        field(&good.replace("<NbOfTxs>1</NbOfTxs>", "<NbOfTxs>2</NbOfTxs>")),
        "GrpHdr/NbOfTxs"
    );
    assert_eq!(field(&good.replace(">1.00<", ">x<")), "IntrBkSttlmAmt");
    assert_eq!(
        field(&good.replace(
            "<IntrBkSttlmAmt Ccy=\"EUR\">1.00",
            "<IntrBkSttlmAmt Ccy=\"EUR\">1.005"
        )),
        "IntrBkSttlmAmt"
    );
    assert_eq!(
        field(&good.replace("DE89370400440532013000", "DE89370400440532013001")),
        "CdtrAcct"
    );
    assert_eq!(field(&good.replace("<ChrgBr>SLEV</ChrgBr>", "")), "ChrgBr");
    // CBPR+ carries a UETR on every hop: a message without one is refused, not repaired.
    let cbpr = profile("swift-cbpr-plus");
    let mut p = payment("swift-cbpr-plus", "E2E-2", 100);
    p.charge_bearer = ChargeBearer::Shar;
    let xml = render_pacs008(&[p], &cbpr, CREATED, "INDA").unwrap();
    let no_uetr = xml.replace("<UETR>eb6305c9-1f7f-49de-aed0-16487c27b42d</UETR>", "");
    assert_eq!(
        parse_pacs008(no_uetr.as_bytes(), &cbpr).unwrap_err().field,
        "PmtId/UETR"
    );
}

#[test]
fn status_reports_say_whether_the_answer_is_definitive() {
    let sct = profile("sepa-sct-inst");
    let uetr = Uetr::new("eb6305c9-1f7f-49de-aed0-16487c27b42d").unwrap();
    let statuses = vec![
        TransactionStatus {
            original_message_id: "MSG-20261005-1".to_owned(),
            original_end_to_end_id: Some("E2E-1".to_owned()),
            original_uetr: Some(uetr),
            status: "ACSC".to_owned(),
            outcome: Outcome::Settled,
            reason: None,
        },
        TransactionStatus {
            original_message_id: "MSG-20261005-1".to_owned(),
            original_end_to_end_id: Some("E2E-2".to_owned()),
            original_uetr: None,
            status: "RJCT".to_owned(),
            outcome: Outcome::Rejected,
            reason: Some("AC04".to_owned()),
        },
        TransactionStatus {
            original_message_id: "MSG-20261005-1".to_owned(),
            original_end_to_end_id: Some("E2E-3".to_owned()),
            original_uetr: None,
            status: "PDNG".to_owned(),
            outcome: Outcome::Pending,
            reason: Some("AB05".to_owned()),
        },
    ];
    let xml = render_pacs002("STATUS-1", CREATED, &statuses, &sct).unwrap();
    let parsed = parse_pacs002(xml.as_bytes(), &sct).unwrap();
    assert_eq!(parsed, statuses);
    assert!(parsed[0].outcome.is_definitive() && parsed[1].outcome.is_definitive());
    // A time-out is not an answer: the escrow stays locked (I15).
    assert!(!parsed[2].outcome.is_definitive());
    let unknown = xml.replace("<TxSts>PDNG</TxSts>", "<TxSts>MAYBE</TxSts>");
    assert!(parse_pacs002(unknown.as_bytes(), &sct).is_err());
}

proptest::proptest! {
    /// `parse(render(p)) == p` for payments the profile can carry (40C.12 property).
    #[test]
    fn render_parse_round_trip(
        cents in 1u128..1_000_000_000_000u128,
        e2e in "[A-Z0-9-]{1,35}",
        lines in 0usize..=1,
        structured in proptest::bool::ANY,
    ) {
        let sct = profile("sepa-sct");
        let mut original = payment("sepa-sct", &e2e, cents);
        original.remittance = if structured {
            Remittance::Structured { creditor_reference: Max35Text::new("RF18539007547034").unwrap() }
        } else if lines == 0 {
            Remittance::None
        } else {
            Remittance::Unstructured(vec![Max140Text::new("Rent").unwrap()])
        };
        let xml = render_pacs008(core::slice::from_ref(&original), &sct, CREATED, "CLRG").unwrap();
        let parsed = parse_pacs008(xml.as_bytes(), &sct).unwrap();
        original.direction = Direction::Inbound;
        proptest::prop_assert_eq!(parsed, vec![original]);
    }
}
