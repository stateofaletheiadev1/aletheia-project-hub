//! TEST-ONLY rail simulator (spec Section 40C.12): a partner bank on one rail, with virtual
//! time. It receives the gateway's outbound `pacs.008` exactly as a partner would (parsing
//! it with the rail profile, so every emitted message is also checked against layer 1), answers
//! with `pacs.002` reports according to a chosen behaviour, keeps the nostro account the
//! answers imply, and issues a `camt.053` for it.
//!
//! Behaviours cover what breaks payments in production: a time-out that is not a rejection,
//! a late acceptance after it, duplicate reports, reports out of order, and silence.

use aletheia_rails::RailProfile;
use aletheia_rails::iso::camt::{Direction, Entry, Statement};
use aletheia_rails::iso::{Outcome, TransactionStatus, parse_pacs008, render_pacs002};
use aletheia_rails_model::{Amount, CurrencyCode, Uetr};

/// How the beneficiary side answers a payment.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Behaviour {
    /// `ACSC` shortly after submission.
    Accept,
    /// `RJCT` with a reason.
    Reject(&'static str),
    /// `PDNG` (time-out, `AB05`), then `ACSC` much later.
    TimeoutThenAccept,
    /// `PDNG`, then `RJCT` much later.
    TimeoutThenReject(&'static str),
    /// `ACSC`, delivered twice.
    AcceptTwice,
    /// The final `ACSC` arrives before the earlier `PDNG` (out of order).
    OutOfOrder,
    /// No answer at all.
    Silent,
}

impl Behaviour {
    /// The partner's definitive answer, if it ever gives one.
    pub fn settles(self) -> Option<bool> {
        match self {
            Behaviour::Accept
            | Behaviour::TimeoutThenAccept
            | Behaviour::AcceptTwice
            | Behaviour::OutOfOrder => Some(true),
            Behaviour::Reject(_) | Behaviour::TimeoutThenReject(_) => Some(false),
            Behaviour::Silent => None,
        }
    }
}

#[derive(Debug, Clone)]
struct Scheduled {
    due: u64,
    seq: u64,
    report: Vec<u8>,
}

/// A simulated partner bank.
#[derive(Debug)]
pub struct RailSim {
    profile: RailProfile,
    now: u64,
    seq: u64,
    pending: Vec<Scheduled>,
    nostro: Vec<Entry>,
    opening: i128,
    currency: CurrencyCode,
    reports_sent: u64,
}

/// Why the simulated partner refused a message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SimError(pub String);

impl RailSim {
    pub fn new(profile: RailProfile, opening_cents: i128) -> Result<RailSim, SimError> {
        let code = profile
            .currency
            .allowed
            .first()
            .cloned()
            .unwrap_or_default();
        let currency = CurrencyCode::new(&code).map_err(|e| SimError(e.to_string()))?;
        Ok(RailSim {
            profile,
            now: 0,
            seq: 0,
            pending: Vec::new(),
            nostro: Vec::new(),
            opening: opening_cents,
            currency,
            reports_sent: 0,
        })
    }

    pub fn now(&self) -> u64 {
        self.now
    }

    fn report(
        &mut self,
        original_message_id: &str,
        uetr: Uetr,
        code: &str,
        reason: Option<&str>,
    ) -> Result<Vec<u8>, SimError> {
        self.reports_sent = self.reports_sent.saturating_add(1);
        let status = TransactionStatus {
            original_message_id: original_message_id.to_owned(),
            original_end_to_end_id: None,
            original_uetr: Some(uetr),
            status: code.to_owned(),
            outcome: Outcome::from_code(code)
                .ok_or_else(|| SimError(format!("unknown status {code}")))?,
            reason: reason.map(str::to_owned),
        };
        render_pacs002(
            &format!("SIM-{}", self.reports_sent),
            "2026-10-05T00:00:00Z",
            &[status],
            &self.profile,
        )
        .map(String::into_bytes)
        .map_err(|e| SimError(e.to_string()))
    }

    fn schedule(&mut self, after: u64, report: Vec<u8>) {
        self.seq = self.seq.saturating_add(1);
        self.pending.push(Scheduled {
            due: self.now.saturating_add(after),
            seq: self.seq,
            report,
        });
    }

    /// The partner receives an outbound message and answers per `behaviour`. Accepted
    /// payments are debited from the nostro account when accepted.
    pub fn submit(&mut self, message: &str, behaviour: Behaviour) -> Result<(), SimError> {
        let payments = parse_pacs008(message.as_bytes(), &self.profile)
            .map_err(|e| SimError(e.to_string()))?;
        for p in payments {
            let msg_id = p.message_id.as_str().to_owned();
            let uetr = p.uetr;
            let accept = self.report(&msg_id, uetr, "ACSC", None)?;
            let pending = self.report(&msg_id, uetr, "PDNG", Some("AB05"))?;
            match behaviour {
                Behaviour::Accept => self.schedule(2, accept),
                Behaviour::Reject(reason) => {
                    let reject = self.report(&msg_id, uetr, "RJCT", Some(reason))?;
                    self.schedule(2, reject);
                }
                Behaviour::TimeoutThenAccept => {
                    self.schedule(10, pending);
                    self.schedule(60, accept);
                }
                Behaviour::TimeoutThenReject(reason) => {
                    let reject = self.report(&msg_id, uetr, "RJCT", Some(reason))?;
                    self.schedule(10, pending);
                    self.schedule(60, reject);
                }
                Behaviour::AcceptTwice => {
                    self.schedule(2, accept.clone());
                    self.schedule(3, accept);
                }
                Behaviour::OutOfOrder => {
                    self.schedule(5, accept);
                    self.schedule(8, pending);
                }
                Behaviour::Silent => {}
            }
            if behaviour.settles() == Some(true) {
                self.nostro.push(Entry {
                    entry_ref: format!("NTRY-{}", self.nostro.len().saturating_add(1)),
                    amount: Amount {
                        minor_units: p.settlement.amount.minor_units,
                        currency: self.currency,
                    },
                    direction: Direction::Debit,
                    uetr: Some(uetr),
                    end_to_end_id: Some(p.end_to_end_id.as_str().to_owned()),
                });
            }
        }
        Ok(())
    }

    /// Moves virtual time on and returns the reports that fell due, in due order.
    pub fn advance(&mut self, seconds: u64) -> Vec<Vec<u8>> {
        self.now = self.now.saturating_add(seconds);
        let now = self.now;
        let mut due: Vec<Scheduled> = Vec::new();
        self.pending.retain(|s| {
            if s.due <= now {
                due.push(s.clone());
                false
            } else {
                true
            }
        });
        due.sort_by_key(|s| (s.due, s.seq));
        due.into_iter().map(|s| s.report).collect()
    }

    /// Records an inbound credit arriving on the nostro account.
    pub fn credit(&mut self, uetr: Uetr, cents: u128) {
        self.nostro.push(Entry {
            entry_ref: format!("NTRY-{}", self.nostro.len().saturating_add(1)),
            amount: Amount {
                minor_units: cents,
                currency: self.currency,
            },
            direction: Direction::Credit,
            uetr: Some(uetr),
            end_to_end_id: None,
        });
    }

    /// The end-of-day statement for the nostro account.
    pub fn statement(&self, account: &str) -> Statement {
        let closing = self.nostro.iter().fold(self.opening, |acc, e| {
            let value = i128::try_from(e.amount.minor_units).unwrap_or(i128::MAX);
            match e.direction {
                Direction::Credit => acc.saturating_add(value),
                Direction::Debit => acc.saturating_sub(value),
            }
        });
        Statement {
            message_id: "SIM-STMT".to_owned(),
            account: account.to_owned(),
            currency: self.currency,
            opening: Some(self.opening),
            closing: Some(closing),
            entries: self.nostro.clone(),
        }
    }
}
