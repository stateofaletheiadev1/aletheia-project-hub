//! Reconciliation per partner nostro account (Sections 40B.6, 40C.11): three-way matching of
//! the chain, the gateway ledger and the bank statement.
//!
//! ```text
//! R1  opening balance + Σ credits − Σ debits = closing balance, as the statement reports it
//! R8  every SETTLED escrow has exactly one matching debit on the statement; every credit has
//!     exactly one ExternalInboundCredit or one open inbound case
//! R9  the statement's closing balance equals the gateway ledger's expected balance after the
//!     in-flight items, listed by UETR
//! ```
//!
//! A break is typed and opens a case; while a partner has an open break above the governed
//! threshold, its R2 headroom is frozen (the caller acts on [`freezes_headroom`]).

use std::collections::{BTreeMap, BTreeSet};

use aletheia_rails::iso::camt::{Direction, Statement};

/// A settled outbound leg or a minted inbound credit, as the chain and gateway know it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Movement {
    pub uetr: String,
    /// Minor units of the statement currency.
    pub amount: u128,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum Break {
    /// R1: the statement's own arithmetic does not add up.
    StatementDoesNotAddUp {
        expected_closing: i128,
        reported_closing: i128,
    },
    /// R8: a settled escrow has no debit on the statement.
    MissingOnStatement { uetr: String },
    /// R8: the statement entry and the chain disagree on the amount.
    AmountMismatch {
        uetr: String,
        chain: u128,
        statement: u128,
    },
    /// R8: a credit with no inbound credit on chain and no open case.
    UnexpectedCredit { entry_ref: String },
    /// R8: a debit no settled escrow explains.
    UnexpectedDebit { entry_ref: String },
    /// The same UETR (or entry reference) booked twice.
    DuplicateStatementEntry { key: String },
    /// R9: the closing balance is not what the gateway ledger expects.
    BalanceMismatch { expected: i128, reported: i128 },
}

impl Break {
    pub const fn kind(&self) -> &'static str {
        match self {
            Break::StatementDoesNotAddUp { .. } => "STATEMENT_DOES_NOT_ADD_UP",
            Break::MissingOnStatement { .. } => "MISSING_ON_STATEMENT",
            Break::AmountMismatch { .. } => "AMOUNT_MISMATCH",
            Break::UnexpectedCredit { .. } => "UNEXPECTED_CREDIT",
            Break::UnexpectedDebit { .. } => "UNEXPECTED_DEBIT",
            Break::DuplicateStatementEntry { .. } => "DUPLICATE_STATEMENT_ENTRY",
            Break::BalanceMismatch { .. } => "BALANCE_MISMATCH",
        }
    }

    /// What the break puts at stake, in minor units, for the headroom-freeze threshold.
    pub fn exposure(&self) -> u128 {
        match self {
            Break::AmountMismatch {
                chain, statement, ..
            } => chain.abs_diff(*statement),
            Break::StatementDoesNotAddUp {
                expected_closing,
                reported_closing,
            } => expected_closing.abs_diff(*reported_closing),
            Break::BalanceMismatch { expected, reported } => expected.abs_diff(*reported),
            // Unknown size until investigated: treated as above any threshold.
            _ => u128::MAX,
        }
    }
}

/// What the gateway knows for one statement period.
#[derive(Debug, Clone, Default)]
pub struct Expected {
    /// Settled outbound legs the period should debit.
    pub settled: Vec<Movement>,
    /// Inbound credits minted on chain for the period.
    pub minted: Vec<Movement>,
    /// UETRs of inbound credits with an open case (held, not minted).
    pub open_inbound_cases: BTreeSet<String>,
    /// The gateway ledger's expected closing balance after in-flight items.
    pub expected_closing: Option<i128>,
}

/// Matches one statement against what the chain and gateway expect. Breaks come sorted.
pub fn reconcile(statement: &Statement, expected: &Expected) -> Vec<Break> {
    let mut breaks = Vec::new();

    // R1.
    if let (Some(opening), Some(closing)) = (statement.opening, statement.closing) {
        let sum = statement.entries.iter().fold(opening, |acc, e| {
            let value = i128::try_from(e.amount.minor_units).unwrap_or(i128::MAX);
            match e.direction {
                Direction::Credit => acc.saturating_add(value),
                Direction::Debit => acc.saturating_sub(value),
            }
        });
        if sum != closing {
            breaks.push(Break::StatementDoesNotAddUp {
                expected_closing: sum,
                reported_closing: closing,
            });
        }
    }

    // Index entries by UETR; duplicates are breaks of their own.
    let mut debits: BTreeMap<String, u128> = BTreeMap::new();
    let mut credits: BTreeMap<String, (u128, String)> = BTreeMap::new();
    let mut refs = BTreeSet::new();
    for entry in &statement.entries {
        if !refs.insert(entry.entry_ref.clone()) {
            breaks.push(Break::DuplicateStatementEntry {
                key: entry.entry_ref.clone(),
            });
            continue;
        }
        let Some(uetr) = entry.uetr.map(|u| u.as_str().to_owned()) else {
            breaks.push(match entry.direction {
                Direction::Credit => Break::UnexpectedCredit {
                    entry_ref: entry.entry_ref.clone(),
                },
                Direction::Debit => Break::UnexpectedDebit {
                    entry_ref: entry.entry_ref.clone(),
                },
            });
            continue;
        };
        let duplicate = match entry.direction {
            Direction::Debit => debits
                .insert(uetr.clone(), entry.amount.minor_units)
                .is_some(),
            Direction::Credit => credits
                .insert(
                    uetr.clone(),
                    (entry.amount.minor_units, entry.entry_ref.clone()),
                )
                .is_some(),
        };
        if duplicate {
            breaks.push(Break::DuplicateStatementEntry { key: uetr });
        }
    }

    // R8, outbound.
    let mut explained_debits = BTreeSet::new();
    for leg in &expected.settled {
        match debits.get(&leg.uetr) {
            None => breaks.push(Break::MissingOnStatement {
                uetr: leg.uetr.clone(),
            }),
            Some(amount) if *amount != leg.amount => breaks.push(Break::AmountMismatch {
                uetr: leg.uetr.clone(),
                chain: leg.amount,
                statement: *amount,
            }),
            Some(_) => {}
        }
        explained_debits.insert(leg.uetr.clone());
    }
    for uetr in debits.keys().filter(|u| !explained_debits.contains(*u)) {
        breaks.push(Break::UnexpectedDebit {
            entry_ref: uetr.clone(),
        });
    }

    // R8, inbound.
    let minted: BTreeMap<&str, u128> = expected
        .minted
        .iter()
        .map(|m| (m.uetr.as_str(), m.amount))
        .collect();
    for (uetr, (amount, entry_ref)) in &credits {
        match minted.get(uetr.as_str()) {
            Some(chain) if chain != amount => breaks.push(Break::AmountMismatch {
                uetr: uetr.clone(),
                chain: *chain,
                statement: *amount,
            }),
            Some(_) => {}
            None if expected.open_inbound_cases.contains(uetr) => {}
            None => breaks.push(Break::UnexpectedCredit {
                entry_ref: entry_ref.clone(),
            }),
        }
    }
    for m in &expected.minted {
        if !credits.contains_key(&m.uetr) {
            breaks.push(Break::MissingOnStatement {
                uetr: m.uetr.clone(),
            });
        }
    }

    // R9.
    if let (Some(expected_closing), Some(reported)) = (expected.expected_closing, statement.closing)
        && expected_closing != reported
    {
        breaks.push(Break::BalanceMismatch {
            expected: expected_closing,
            reported,
        });
    }

    breaks.sort();
    breaks
}

/// Whether the partner's R2 headroom is frozen: any open break above the governed threshold.
pub fn freezes_headroom(breaks: &[Break], threshold: u128) -> bool {
    breaks.iter().any(|b| b.exposure() > threshold)
}
