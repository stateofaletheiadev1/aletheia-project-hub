//! The gateway pipeline (Sections 40, 40C.4, 40C.7):
//!
//! ```text
//! inbound  raw → layer 1 → inbox (exactly once) → layers 2-3 → layer 4 (chain state)
//!              → screening (fail-closed) → ExternalInboundCredit operations
//! outbound payment → layers 2-3 → exact cents → layer 4 → ExternalLegLock + pacs.008 in the outbox
//! status   pacs.002 → ACSC: ExternalLegSettle; RJCT: ExternalLegRelease; anything else:
//!              INVESTIGATING, the escrow stays locked (I15)
//! ```
//!
//! The gateway decides and records; it does not sign. Operations go to the gateway operator's
//! signer (an HSM in production) and are submitted from there. Every step is written to the
//! audit ledger with the profile hash in force.

use std::collections::BTreeMap;

use aletheia_core::apn::{Aic, ApnOp, StandingAuthorization};
use aletheia_core::{Address, Hash32};
use aletheia_rails::iso::{Outcome, parse_pacs002, parse_pacs008, render_pacs008};
use aletheia_rails::{ProfileSet, RailProfile, RailRejection, scheme_rules, usage_rules};
use aletheia_rails_model::{AccountRef, CanonicalPayment, Date, aey_from_cents, cents_from_aey};

use crate::audit::{AuditEntry, AuditLedger, AuditStore, Stage};
use crate::exactly_once::{Inbox, InboxKey, InboxOutcome, Outbox, Receipt};

/// The on-chain rail number for each profile (`ExternalLegLock.rail`, inbound uniqueness).
pub fn rail_code(rail: &str) -> Option<u16> {
    Some(match rail {
        "sepa-sct" => 1,
        "sepa-sct-inst" => 2,
        "sepa-sdd-core" => 3,
        "sepa-sdd-b2b" => 4,
        "swift-cbpr-plus" => 5,
        "fedwire" => 6,
        "fednow" => 7,
        _ => return None,
    })
}

fn hash(context: &str, text: &str) -> Hash32 {
    let mut hasher = blake3::Hasher::new_derive_key(context);
    hasher.update(text.as_bytes());
    Hash32::from_bytes(*hasher.finalize().as_bytes())
}

/// `H(UETR)` as carried on chain.
pub fn uetr_hash(uetr: &str) -> Hash32 {
    hash("ALETHEIA/UETR/v1", uetr)
}

/// `H(MsgId)` as carried on chain.
pub fn msg_id_hash(msg_id: &str) -> Hash32 {
    hash("ALETHEIA/MSGID/v1", msg_id)
}

/// The escrow leg id for an outbound payment: one leg per UETR.
pub fn leg_id(uetr: &str) -> Hash32 {
    hash("ALETHEIA/EXT-LEG-ID/v1", uetr)
}

/// An account as APN knows it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Resolved {
    pub address: Address,
    /// The participant serving the account.
    pub agent: Aic,
}

/// Layer 4's view of chain state, read through the gateway's node client.
pub trait ChainView {
    fn participant_active(&self, aic: &Aic) -> bool;
    /// The APN account an AAN, proxy or registered IBAN resolves to.
    fn resolve(&self, account: &AccountRef) -> Option<Resolved>;
    /// AEY the Monetary Authority's standing authorization still allows this gateway to mint
    /// (R2 headroom).
    fn standing_headroom(&self) -> u128;
}

/// A sanctions and AML screening result. Anything but `Clear` holds the payment.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Screening {
    Clear,
    Hit(String),
    /// The screening service did not answer: fail closed.
    Unavailable,
}

pub trait Screener {
    /// Screens the texts of a payment (original values, Section 40C.4).
    fn screen(&self, texts: &[(&'static str, &str)]) -> Screening;
}

#[derive(Debug, Clone)]
pub struct GatewayConfig {
    /// This gateway operator's participant code.
    pub gateway: Aic,
    /// The Monetary Authority's standing authorization carried by inbound credits.
    pub standing: StandingAuthorization,
    /// `CLRG`, `INDA`, ... for rendered messages.
    pub settlement_method: String,
}

/// What an inbound message became.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Inbound {
    pub outcome: InboxOutcome,
    /// Operations for the signer; empty for a rejection, a hold or a redelivery.
    pub operations: Vec<ApnOp>,
}

/// An outbound leg's state as the gateway tracks it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LegState {
    Locked,
    Investigating,
    Settled,
    Released,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutboundLeg {
    pub leg_id: Hash32,
    pub message_id: String,
    pub state: LegState,
}

#[derive(Debug)]
pub struct Gateway<S: AuditStore> {
    profiles: ProfileSet,
    config: GatewayConfig,
    pub audit: AuditLedger<S>,
    pub inbox: Inbox,
    pub outbox: Outbox,
    legs: BTreeMap<String, OutboundLeg>,
}

impl<S: AuditStore> Gateway<S> {
    pub fn new(profiles: ProfileSet, config: GatewayConfig, audit: AuditLedger<S>) -> Gateway<S> {
        Gateway {
            profiles,
            config,
            audit,
            inbox: Inbox::default(),
            outbox: Outbox::default(),
            legs: BTreeMap::new(),
        }
    }

    pub fn leg(&self, uetr: &str) -> Option<&OutboundLeg> {
        self.legs.get(uetr)
    }

    /// Records a stage; a stage already recorded (a reprocessed message) is not an error.
    #[allow(clippy::too_many_arguments)]
    fn record(
        &mut self,
        occurred_at: &str,
        counterparty: &str,
        msg_type: &str,
        msg_id: &str,
        end_to_end_id: Option<&str>,
        stage: Stage,
        profile: Option<&RailProfile>,
        note: String,
        payload: &[u8],
    ) {
        let entry = AuditEntry {
            occurred_at: occurred_at.to_owned(),
            counterparty: counterparty.to_owned(),
            msg_type: msg_type.to_owned(),
            msg_id: msg_id.to_owned(),
            end_to_end_id: end_to_end_id.map(str::to_owned),
            stage,
            tx_id: None,
            profile_hash: profile.map_or([0; 32], |p| p.hash),
            note,
            payload: payload.to_vec(),
        };
        let _ = self.audit.append(entry);
    }

    fn profile(&self, rail: &str, at: Date) -> Result<RailProfile, RailRejection> {
        self.profiles
            .at(rail, at)
            .cloned()
            .ok_or_else(|| RailRejection {
                layer: 1,
                reason: "FF01",
                field: "Document",
                detail: format!("no {rail} profile is in force on {at}"),
            })
    }

    /// An inbound `pacs.008` from `sender` on `rail`. All payments of one message are taken
    /// together: one failing refuses the message.
    #[allow(clippy::too_many_arguments)]
    pub fn inbound_credit(
        &mut self,
        rail: &str,
        sender: &str,
        raw: &[u8],
        at: Date,
        occurred_at: &str,
        chain: &dyn ChainView,
        screener: &dyn Screener,
        seen: &dyn Fn(&str) -> bool,
    ) -> Inbound {
        let rejected = |reason: &str, detail: String| Inbound {
            outcome: InboxOutcome::Rejected {
                reason: reason.to_owned(),
                detail,
            },
            operations: Vec::new(),
        };
        let profile = match self.profile(rail, at) {
            Ok(p) => p,
            Err(r) => return rejected(r.reason, r.detail),
        };
        let msg_type = profile
            .messages
            .get("credit_transfer")
            .cloned()
            .unwrap_or_default();
        let payments = match parse_pacs008(raw, &profile) {
            Ok(p) => p,
            Err(r) => {
                // Unreadable: recorded under the payload digest, as there is no MsgId to use.
                let digest: String = sha2_hex(raw);
                self.record(
                    occurred_at,
                    sender,
                    &msg_type,
                    &digest,
                    None,
                    Stage::Received,
                    Some(&profile),
                    String::new(),
                    raw,
                );
                self.record(
                    occurred_at,
                    sender,
                    &msg_type,
                    &digest,
                    None,
                    Stage::Rejected,
                    Some(&profile),
                    r.to_string(),
                    raw,
                );
                return rejected(r.reason, r.to_string());
            }
        };
        let msg_id = payments
            .first()
            .map(|p| p.message_id.as_str().to_owned())
            .unwrap_or_default();
        let key = InboxKey {
            rail: rail.to_owned(),
            sender: sender.to_owned(),
            msg_id: msg_id.clone(),
        };
        if let Receipt::Duplicate(outcome) = self.inbox.receive(key.clone()) {
            return Inbound {
                outcome,
                operations: Vec::new(),
            };
        }
        let e2e = payments
            .first()
            .map(|p| p.end_to_end_id.as_str().to_owned());
        self.record(
            occurred_at,
            sender,
            &msg_type,
            &msg_id,
            e2e.as_deref(),
            Stage::Received,
            Some(&profile),
            String::new(),
            raw,
        );

        let decided = self.decide_inbound(&payments, &profile, chain, screener, seen);
        let (stage, note) = match &decided {
            Ok(_) => (Stage::Mapped, String::new()),
            Err(InboxOutcome::Held { case }) => (Stage::Held, case.clone()),
            Err(InboxOutcome::Rejected { reason, detail }) => {
                (Stage::Rejected, format!("{reason}: {detail}"))
            }
            Err(InboxOutcome::Accepted { .. }) => (Stage::Mapped, String::new()),
        };
        if decided.is_ok() {
            self.record(
                occurred_at,
                sender,
                &msg_type,
                &msg_id,
                e2e.as_deref(),
                Stage::Validated,
                Some(&profile),
                String::new(),
                raw,
            );
            self.record(
                occurred_at,
                sender,
                &msg_type,
                &msg_id,
                e2e.as_deref(),
                Stage::Screened,
                Some(&profile),
                String::new(),
                raw,
            );
        }
        self.record(
            occurred_at,
            sender,
            &msg_type,
            &msg_id,
            e2e.as_deref(),
            stage,
            Some(&profile),
            note,
            raw,
        );
        match decided {
            Ok(operations) => {
                let outcome = InboxOutcome::Accepted {
                    reference: payments
                        .iter()
                        .map(|p| p.uetr.as_str())
                        .collect::<Vec<_>>()
                        .join(","),
                };
                self.inbox.decide(&key, outcome.clone());
                Inbound {
                    outcome,
                    operations,
                }
            }
            Err(outcome) => {
                self.inbox.decide(&key, outcome.clone());
                Inbound {
                    outcome,
                    operations: Vec::new(),
                }
            }
        }
    }

    fn decide_inbound(
        &self,
        payments: &[CanonicalPayment],
        profile: &RailProfile,
        chain: &dyn ChainView,
        screener: &dyn Screener,
        seen: &dyn Fn(&str) -> bool,
    ) -> Result<Vec<ApnOp>, InboxOutcome> {
        let reject = |reason: &str, detail: String| InboxOutcome::Rejected {
            reason: reason.to_owned(),
            detail,
        };
        let rail = rail_code(&profile.rail)
            .ok_or_else(|| reject("FF01", format!("{} has no rail number", profile.rail)))?;
        let mut operations = Vec::new();
        let mut total = 0u128;
        for p in payments {
            usage_rules(p, profile)
                .and_then(|()| scheme_rules(p, profile, seen))
                .map_err(|r| reject(r.reason, r.to_string()))?;
            // Layer 4.
            if p.settlement.amount.currency.as_str() != "EUR" {
                return Err(reject(
                    "AM03",
                    "non-EUR inbound credits need an FX quote, not offered yet".to_owned(),
                ));
            }
            let creditor = chain.resolve(&p.creditor_account).ok_or_else(|| {
                reject(
                    "AC01",
                    "the creditor account is not an APN account".to_owned(),
                )
            })?;
            if !chain.participant_active(&creditor.agent) {
                return Err(reject(
                    "AG01",
                    format!(
                        "the creditor's participant {} is not active",
                        creditor.agent.text()
                    ),
                ));
            }
            let amount = aey_from_cents(p.settlement.amount.minor_units)
                .map_err(|e| reject("AM02", e.to_string()))?;
            total = total.saturating_add(amount);
            match screener.screen(&p.texts()) {
                Screening::Clear => {}
                Screening::Hit(why) => {
                    return Err(InboxOutcome::Held {
                        case: format!("screening hit on {}: {why}", p.uetr.as_str()),
                    });
                }
                Screening::Unavailable => {
                    return Err(InboxOutcome::Held {
                        case: format!(
                            "screening unavailable for {}; held until it answers",
                            p.uetr.as_str()
                        ),
                    });
                }
            }
            operations.push(ApnOp::ExternalInboundCredit {
                rail,
                uetr_hash: uetr_hash(p.uetr.as_str()),
                msg_id_hash: msg_id_hash(p.message_id.as_str()),
                amount,
                creditor: creditor.address,
                creditor_agent: creditor.agent,
                standing: self.config.standing.clone(),
            });
        }
        if total > chain.standing_headroom() {
            // R2: never mint past what the Monetary Authority authorized; a person decides.
            return Err(InboxOutcome::Held {
                case: "the standing authorization has too little headroom for this credit (R2)"
                    .to_owned(),
            });
        }
        Ok(operations)
    }

    /// An outbound payment of `amount_aey` from a participant's settlement account. Returns
    /// the escrow lock for the signer; the rendered message waits in the outbox until the lock
    /// is final.
    #[allow(clippy::too_many_arguments)]
    pub fn outbound(
        &mut self,
        payment: &CanonicalPayment,
        sender_agent: &Aic,
        amount_aey: u128,
        at: Date,
        occurred_at: &str,
        created_at: &str,
        expiry_day: u64,
        chain: &dyn ChainView,
        seen: &dyn Fn(&str) -> bool,
    ) -> Result<ApnOp, RailRejection> {
        let profile = self.profile(&payment.rail, at)?;
        let msg_type = profile
            .messages
            .get("credit_transfer")
            .cloned()
            .unwrap_or_default();
        let refuse =
            |layer: u8, reason: &'static str, field: &'static str, detail: String| RailRejection {
                layer,
                reason,
                field,
                detail,
            };
        let checked = usage_rules(payment, &profile)
            .and_then(|()| scheme_rules(payment, &profile, seen))
            .and_then(|()| {
                let cents = cents_from_aey(amount_aey)
                    .map_err(|e| refuse(3, "AM02", "IntrBkSttlmAmt", e.to_string()))?;
                if payment.settlement.amount.currency.as_str() != "EUR"
                    || cents != payment.settlement.amount.minor_units
                {
                    return Err(refuse(
                        3,
                        "AM02",
                        "IntrBkSttlmAmt",
                        "the AEY amount does not equal the message amount in euro cents".to_owned(),
                    ));
                }
                if !chain.participant_active(sender_agent)
                    || !chain.participant_active(&self.config.gateway)
                {
                    return Err(refuse(
                        4,
                        "AG01",
                        "DbtrAgt",
                        "the sending participant or the gateway is not active".to_owned(),
                    ));
                }
                Ok(())
            });
        let msg_id = payment.message_id.as_str().to_owned();
        let e2e = payment.end_to_end_id.as_str().to_owned();
        if let Err(rejection) = checked {
            self.record(
                occurred_at,
                "outbound",
                &msg_type,
                &msg_id,
                Some(&e2e),
                Stage::Rejected,
                Some(&profile),
                rejection.to_string(),
                &[],
            );
            return Err(rejection);
        }
        let rendered = render_pacs008(
            core::slice::from_ref(payment),
            &profile,
            created_at,
            &self.config.settlement_method,
        )?;
        let uetr = payment.uetr.as_str().to_owned();
        let rail = rail_code(&profile.rail).ok_or_else(|| {
            refuse(
                1,
                "FF01",
                "Document",
                format!("{} has no rail number", profile.rail),
            )
        })?;
        let id = leg_id(&uetr);
        self.outbox.enqueue(&uetr, &profile.rail, rendered.clone());
        self.legs.insert(
            uetr.clone(),
            OutboundLeg {
                leg_id: id,
                message_id: msg_id.clone(),
                state: LegState::Locked,
            },
        );
        self.record(
            occurred_at,
            "outbound",
            &msg_type,
            &msg_id,
            Some(&e2e),
            Stage::Mapped,
            Some(&profile),
            String::new(),
            rendered.as_bytes(),
        );
        Ok(ApnOp::ExternalLegLock {
            leg_id: id,
            amount: amount_aey,
            uetr_hash: uetr_hash(&uetr),
            rail,
            profile_hash: Hash32::from_bytes(profile.hash),
            gateway: self.config.gateway,
            expiry_day,
        })
    }

    /// A `pacs.002` about outbound legs. Only a definitive answer settles or releases an
    /// escrow; a time-out or pending status leaves it locked (I15). An answer for a leg that is
    /// already settled or released changes nothing.
    pub fn status_report(
        &mut self,
        rail: &str,
        sender: &str,
        raw: &[u8],
        at: Date,
        occurred_at: &str,
    ) -> Result<Vec<ApnOp>, RailRejection> {
        let profile = self.profile(rail, at)?;
        let statuses = parse_pacs002(raw, &profile)?;
        let msg_type = profile
            .messages
            .get("status_report")
            .cloned()
            .unwrap_or_default();
        let mut operations = Vec::new();
        for status in statuses {
            let Some(uetr) = status.original_uetr.map(|u| u.as_str().to_owned()) else {
                continue;
            };
            let Some(leg) = self.legs.get(&uetr).cloned() else {
                continue;
            };
            if matches!(leg.state, LegState::Settled | LegState::Released) {
                continue;
            }
            let (state, stage, operation) = match status.outcome {
                Outcome::Settled => (
                    LegState::Settled,
                    Stage::Settled,
                    Some(ApnOp::ExternalLegSettle {
                        leg_id: leg.leg_id,
                        msg_id_hash: msg_id_hash(&leg.message_id),
                    }),
                ),
                Outcome::Rejected => {
                    let mut reason = [b' '; 4];
                    for (slot, b) in reason
                        .iter_mut()
                        .zip(status.reason.as_deref().unwrap_or("NARR").bytes())
                    {
                        *slot = b;
                    }
                    (
                        LegState::Released,
                        Stage::Released,
                        Some(ApnOp::ExternalLegRelease {
                            leg_id: leg.leg_id,
                            reason,
                        }),
                    )
                }
                Outcome::Pending | Outcome::InProgress => {
                    (LegState::Investigating, Stage::Investigating, None)
                }
            };
            if let Some(entry) = self.legs.get_mut(&uetr) {
                entry.state = state;
            }
            let note = format!(
                "{} {}",
                status.status,
                status.reason.clone().unwrap_or_default()
            );
            self.record(
                occurred_at,
                sender,
                &msg_type,
                &leg.message_id,
                status.original_end_to_end_id.as_deref(),
                stage,
                Some(&profile),
                note,
                raw,
            );
            operations.extend(operation);
        }
        Ok(operations)
    }
}

fn sha2_hex(bytes: &[u8]) -> String {
    use sha2::Digest;
    let digest = sha2::Sha256::digest(bytes);
    let mut out = String::from("sha256:");
    for b in digest {
        out.push_str(&format!("{b:02x}"));
    }
    out
}
