//! Reconciliation R1, R8, R9 against a partner statement (spec Sections 40B.6, 40C.11). The
//! statement goes through `camt.053` rendering and parsing, as a real one would arrive.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use std::collections::BTreeSet;

use aletheia_gateway::reconcile::{Break, Expected, Movement, freezes_headroom, reconcile};
use aletheia_rails::iso::camt::{Direction, Entry, Statement, parse_statement, render_camt053};
use aletheia_rails_model::{Amount, CurrencyCode, Uetr};

const OUT_1: &str = "eb6305c9-1f7f-49de-aed0-16487c27b42d";
const OUT_2: &str = "0f6c1a4e-5b2d-4c7e-9a31-6d2e8b7f4c10";
const IN_1: &str = "7a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const IN_2: &str = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";

fn entry(reference: &str, cents: u128, direction: Direction, uetr: Option<&str>) -> Entry {
    Entry {
        entry_ref: reference.to_owned(),
        amount: Amount {
            minor_units: cents,
            currency: CurrencyCode::new("EUR").unwrap(),
        },
        direction,
        uetr: uetr.map(|u| Uetr::new(u).unwrap()),
        end_to_end_id: None,
    }
}

/// Opening 10,000.00; two settled outbound legs (500.00, 250.00), one inbound credit (1,200.00).
fn statement(entries: Vec<Entry>, closing: i128) -> Statement {
    let s = Statement {
        message_id: "STMT-20261005".to_owned(),
        account: "DE89370400440532013000".to_owned(),
        currency: CurrencyCode::new("EUR").unwrap(),
        opening: Some(1_000_000),
        closing: Some(closing),
        entries,
    };
    // Through the wire format and back.
    let xml = render_camt053(&s, 2, "2026-10-05T23:59:00Z");
    parse_statement(xml.as_bytes(), 2).unwrap()
}

fn clean_entries() -> Vec<Entry> {
    vec![
        entry("E1", 50_000, Direction::Debit, Some(OUT_1)),
        entry("E2", 25_000, Direction::Debit, Some(OUT_2)),
        entry("E3", 120_000, Direction::Credit, Some(IN_1)),
    ]
}

fn expected() -> Expected {
    Expected {
        settled: vec![
            Movement {
                uetr: OUT_1.to_owned(),
                amount: 50_000,
            },
            Movement {
                uetr: OUT_2.to_owned(),
                amount: 25_000,
            },
        ],
        minted: vec![Movement {
            uetr: IN_1.to_owned(),
            amount: 120_000,
        }],
        open_inbound_cases: BTreeSet::new(),
        expected_closing: Some(1_045_000),
    }
}

#[test]
fn a_matching_statement_has_no_breaks() {
    let s = statement(clean_entries(), 1_045_000);
    assert_eq!(s.entries.len(), 3);
    assert_eq!(reconcile(&s, &expected()), []);
}

#[test]
fn each_mismatch_is_a_typed_break() {
    // R1: the statement's own arithmetic.
    let s = statement(clean_entries(), 1_045_001);
    let kinds: Vec<_> = reconcile(&s, &expected()).iter().map(Break::kind).collect();
    assert!(
        kinds.contains(&"STATEMENT_DOES_NOT_ADD_UP") && kinds.contains(&"BALANCE_MISMATCH"),
        "{kinds:?}"
    );

    // R8: a settled leg missing from the statement.
    let mut entries = clean_entries();
    entries.remove(1);
    let s = statement(entries, 1_070_000);
    let mut e = expected();
    e.expected_closing = None;
    assert_eq!(
        reconcile(&s, &e),
        [Break::MissingOnStatement {
            uetr: OUT_2.to_owned()
        }]
    );

    // R8: an amount that differs from the chain.
    let mut entries = clean_entries();
    entries[0] = entry("E1", 50_001, Direction::Debit, Some(OUT_1));
    let s = statement(entries, 1_044_999);
    assert_eq!(
        reconcile(&s, &e),
        [Break::AmountMismatch {
            uetr: OUT_1.to_owned(),
            chain: 50_000,
            statement: 50_001
        }]
    );

    // R8: a credit nobody minted and no case covers; then the same with an open case.
    let mut entries = clean_entries();
    entries.push(entry("E4", 9_900, Direction::Credit, Some(IN_2)));
    let s = statement(entries, 1_054_900);
    assert_eq!(
        reconcile(&s, &e),
        [Break::UnexpectedCredit {
            entry_ref: "E4".to_owned()
        }]
    );
    let mut with_case = e.clone();
    with_case.open_inbound_cases.insert(IN_2.to_owned());
    assert_eq!(reconcile(&s, &with_case), []);

    // A duplicate booking.
    let mut entries = clean_entries();
    entries.push(entry("E5", 50_000, Direction::Debit, Some(OUT_1)));
    let s = statement(entries, 995_000);
    assert!(reconcile(&s, &e).contains(&Break::DuplicateStatementEntry {
        key: OUT_1.to_owned()
    }));
}

#[test]
fn breaks_above_the_threshold_freeze_r2_headroom() {
    let small = [Break::AmountMismatch {
        uetr: OUT_1.to_owned(),
        chain: 100,
        statement: 101,
    }];
    assert!(!freezes_headroom(&small, 500));
    assert!(freezes_headroom(&small, 0));
    // A break of unknown size always freezes.
    assert!(freezes_headroom(
        &[Break::UnexpectedCredit {
            entry_ref: "E9".to_owned()
        }],
        u128::MAX - 1
    ));
}
