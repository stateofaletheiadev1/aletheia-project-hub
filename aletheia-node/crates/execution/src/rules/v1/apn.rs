//! Aletheia Payment Network, on-chain part, protocol version 1 (spec Sections 40B, 40D.5;
//! ADR-050).
//!
//! Every payment settles in AEY and is final when its block is final (40B.6). Who may do what:
//!
//! ```text
//! Payment, BatchPayment     the debtor (sender); both agents ACTIVE, each serving its account
//! PaymentReturn             the original creditor, up to what is left of the original
//! RecallRequest             the original debtor (a request: finality stands)
//! RecallResponse            the original creditor; accepting returns what is left
//! MessageAnchor, AanAssign,
//! ProxyRegister/Remove      an ACTIVE participant, from its settlement account
//! ```
//!
//! A participant serves an account when it is the participant's settlement account or the
//! participant assigned it an account number. Limits are the debtor agent's per-payment and
//! daily outgoing maximum and the creditor agent's daily incoming maximum, counted per UTC day
//! of protocol time. Each settled leg keeps a de-duplication entry for 400 days, keyed by
//! `(debtor agent, UETR hash, leg)`: a second payment with the same key is refused.

use aletheia_core::apn::{Aic, ApnOp, PaymentLeg, PaymentRef, status};
use aletheia_core::{AceEncode, Address, AletheiaError, AssetId, ErrorCode, Hash32};
use aletheia_state::StateOverlay;

use crate::apn_model::{
    AnchorEntry, Apn, DEDUP_RETENTION_DAYS, DayTotals, DedupEntry, Mapping, Participant, day_of,
};
use crate::context::{BlockContext, Meter, OutOfEu};
use crate::model::{Records, module_address};
use crate::receipt::{Event, event_type};
use crate::rules::v1::Touched;
use crate::rules::v1::balances::{credit, debit};
use crate::rules::v1::limits::{APN_EU, PAYMENT_EU};
use crate::stateless::VerifiedTransaction;

type Step = Result<Result<(), OutOfEu>, AletheiaError>;

/// Emits APN events.
pub(crate) const APN_MODULE: Address = module_address(6);

/// Recall states kept in a de-duplication entry.
pub mod recall {
    pub const NONE: u8 = 0;
    pub const REQUESTED: u8 = 1;
    pub const ACCEPTED: u8 = 2;
    pub const DECLINED: u8 = 3;
}

fn fail(code: ErrorCode, detail: impl Into<String>) -> AletheiaError {
    AletheiaError::new(code, detail.into())
}

struct Cx<'a, 'o> {
    apn: Apn<'a>,
    records: &'a Records,
    overlay: &'a mut StateOverlay<'o>,
    sender: Address,
    tx_id: Hash32,
    ctx: &'a BlockContext,
    events: &'a mut Vec<Event>,
    touched: &'a mut Touched,
}

impl Cx<'_, '_> {
    fn day(&self) -> u64 {
        day_of(self.ctx.protocol_time_ms)
    }

    fn emit(&mut self, schema: &str, topics: Vec<Hash32>, data: Vec<u8>) {
        self.events.push(Event {
            emitter: APN_MODULE,
            event_type: event_type(schema),
            topics,
            data,
        });
    }

    /// An ACTIVE participant; an indirect participant's sponsor must be ACTIVE too.
    fn active(&self, aic: &Aic) -> Result<Participant, AletheiaError> {
        let participant = self.apn.participant(self.overlay, aic)?.ok_or_else(|| {
            fail(
                ErrorCode::ApnParticipantUnknown,
                format!("no participant {}", aic.text()),
            )
        })?;
        if participant.status != status::ACTIVE {
            return Err(fail(
                ErrorCode::ApnParticipantInactive,
                format!("participant {} is not active", aic.text()),
            ));
        }
        if let Some(sponsor) = participant.spec.sponsor {
            let sponsor_active = self
                .apn
                .participant(self.overlay, &sponsor)?
                .is_some_and(|s| s.status == status::ACTIVE);
            if !sponsor_active {
                return Err(fail(
                    ErrorCode::ApnParticipantInactive,
                    format!(
                        "the sponsor {} of {} is not active",
                        sponsor.text(),
                        aic.text()
                    ),
                ));
            }
        }
        Ok(participant)
    }

    /// The ACTIVE participant whose settlement account sent this transaction.
    fn sending_participant(&self) -> Result<Participant, AletheiaError> {
        let participant = self
            .apn
            .participant_at(self.overlay, &self.sender)?
            .ok_or_else(|| {
                fail(
                    ErrorCode::ApnNotParticipant,
                    "only a participant's settlement account may do this",
                )
            })?;
        self.active(&participant.spec.aic)
    }

    fn move_aey(
        &mut self,
        from: &Address,
        to: &Address,
        amount: u128,
    ) -> Result<(), AletheiaError> {
        debit(self.records, self.overlay, from, AssetId::AEY, amount)?;
        credit(self.records, self.overlay, to, AssetId::AEY, amount)?;
        self.touched.push((*from, AssetId::AEY));
        self.touched.push((*to, AssetId::AEY));
        Ok(())
    }

    fn settled(&self, original: &PaymentRef) -> Result<(Hash32, DedupEntry), AletheiaError> {
        let key = original.dedup_key(self.records.network());
        let entry = self
            .apn
            .dedup(self.overlay, &key)?
            .filter(|e| self.day() <= e.expires_day)
            .ok_or_else(|| {
                fail(
                    ErrorCode::ApnPaymentUnknown,
                    "no settled payment with that agent, UETR and leg",
                )
            })?;
        Ok((key, entry))
    }

    /// One credit from the sender: checks, limits, de-duplication, settlement, event.
    fn pay(
        &mut self,
        debtor_agent: &Participant,
        scheme: Option<u8>,
        leg: &PaymentLeg,
        purpose: &[u8; 4],
    ) -> Result<(), AletheiaError> {
        if leg.amount == 0 {
            return Err(fail(
                ErrorCode::TxFieldOutOfRange,
                "a payment moves a positive amount",
            ));
        }
        if let Some(scheme) = scheme {
            let certified = 1u32
                .checked_shl(u32::from(scheme))
                .is_some_and(|bit| debtor_agent.spec.schemes & bit != 0);
            if !certified {
                return Err(fail(
                    ErrorCode::ApnSchemeNotCertified,
                    format!(
                        "{} is not certified for scheme {scheme}",
                        debtor_agent.spec.aic.text()
                    ),
                ));
            }
        }
        let creditor_agent = self.active(&leg.creditor_agent)?;
        if !self.apn.serves(self.overlay, debtor_agent, &self.sender)? {
            return Err(fail(
                ErrorCode::ApnRoutingMismatch,
                format!(
                    "{} does not serve the debtor's account",
                    debtor_agent.spec.aic.text()
                ),
            ));
        }
        if !self
            .apn
            .serves(self.overlay, &creditor_agent, &leg.creditor)?
        {
            return Err(fail(
                ErrorCode::ApnRoutingMismatch,
                format!(
                    "{} does not serve the creditor's account",
                    creditor_agent.spec.aic.text()
                ),
            ));
        }
        if leg.amount > debtor_agent.spec.limits.per_payment_max {
            return Err(fail(
                ErrorCode::ApnLimitExceeded,
                format!(
                    "{} is above {}'s per-payment maximum {}",
                    leg.amount,
                    debtor_agent.spec.aic.text(),
                    debtor_agent.spec.limits.per_payment_max
                ),
            ));
        }

        let day = self.day();
        let debtor_aic = debtor_agent.spec.aic;
        let creditor_aic = creditor_agent.spec.aic;
        let mut out = self.apn.day_totals(self.overlay, &debtor_aic, day)?;
        out.out = out
            .out
            .checked_add(leg.amount)
            .filter(|total| *total <= debtor_agent.spec.limits.daily_out_max)
            .ok_or_else(|| {
                fail(
                    ErrorCode::ApnLimitExceeded,
                    format!("{}'s daily outgoing maximum is reached", debtor_aic.text()),
                )
            })?;
        self.apn
            .put_day_totals(self.overlay, &debtor_aic, day, &out);
        let mut inbound: DayTotals = self.apn.day_totals(self.overlay, &creditor_aic, day)?;
        inbound.r#in = inbound
            .r#in
            .checked_add(leg.amount)
            .filter(|total| *total <= creditor_agent.spec.limits.daily_in_max)
            .ok_or_else(|| {
                fail(
                    ErrorCode::ApnLimitExceeded,
                    format!(
                        "{}'s daily incoming maximum is reached",
                        creditor_aic.text()
                    ),
                )
            })?;
        self.apn
            .put_day_totals(self.overlay, &creditor_aic, day, &inbound);

        let reference = PaymentRef {
            debtor_agent: debtor_aic,
            uetr_hash: leg.uetr_hash,
            leg: 0,
        };
        let key = reference.dedup_key(self.records.network());
        if self
            .apn
            .dedup(self.overlay, &key)?
            .is_some_and(|e| day <= e.expires_day)
        {
            return Err(fail(
                ErrorCode::PayDuplicate,
                "a payment with this agent and UETR already settled",
            ));
        }
        let sender = self.sender;
        self.move_aey(&sender, &leg.creditor, leg.amount)?;
        let entry = DedupEntry {
            tx_id: self.tx_id,
            height: self.ctx.height.get(),
            expires_day: day.saturating_add(DEDUP_RETENTION_DAYS),
            debtor: sender,
            creditor: leg.creditor,
            amount: leg.amount,
            returned: 0,
            recall: recall::NONE,
        };
        self.apn.put_dedup(self.overlay, &key, &entry);

        let mut data = sender.to_ace_bytes();
        data.extend_from_slice(&leg.to_ace_bytes());
        data.extend_from_slice(purpose);
        self.emit(
            "aletheia.apn.payment.settled.v1",
            vec![key, sender.account_hash(), leg.creditor.account_hash()],
            data,
        );
        Ok(())
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn apply(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    op: &ApnOp,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
    touched: &mut Touched,
) -> Step {
    let body = &verified.transaction().body;
    let mut cx = Cx {
        apn: Apn { records },
        records,
        overlay,
        sender: body.sender,
        tx_id: verified.tx_id().hash(),
        ctx,
        events,
        touched,
    };
    match op {
        ApnOp::Payment {
            debtor_agent,
            leg,
            purpose,
            scheme,
        } => {
            if meter.charge(PAYMENT_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let agent = cx.active(debtor_agent)?;
            cx.pay(&agent, Some(*scheme), leg, purpose)?;
        }
        ApnOp::BatchPayment {
            debtor_agent,
            legs,
            purpose,
            atomic,
        } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let agent = cx.active(debtor_agent)?;
            let mut skipped = Vec::new();
            for (index, leg) in legs.iter().enumerate() {
                if meter.charge(PAYMENT_EU).is_err() {
                    return Ok(Err(OutOfEu));
                }
                if *atomic {
                    cx.pay(&agent, None, leg, purpose)?;
                    continue;
                }
                cx.overlay.checkpoint();
                let mark = (cx.events.len(), cx.touched.len());
                match cx.pay(&agent, None, leg, purpose) {
                    Ok(()) => cx.overlay.commit_checkpoint(),
                    Err(error) if !error.is_fail_stop() => {
                        cx.overlay.revert_to_checkpoint()?;
                        cx.events.truncate(mark.0);
                        cx.touched.truncate(mark.1);
                        skipped
                            .push((u32::try_from(index).unwrap_or(u32::MAX), error.code().get()));
                    }
                    Err(error) => return Err(error),
                }
            }
            if !skipped.is_empty() {
                let mut data = aletheia_core::AceWriter::new();
                data.u32(u32::try_from(skipped.len()).unwrap_or(u32::MAX));
                for (index, code) in &skipped {
                    data.u32(*index);
                    data.u32(*code);
                }
                let sender = cx.sender;
                cx.emit(
                    "aletheia.apn.batch.skipped.v1",
                    vec![sender.account_hash()],
                    data.as_bytes().to_vec(),
                );
            }
        }
        ApnOp::PaymentReturn {
            original,
            amount,
            reason,
        } => {
            if meter.charge(PAYMENT_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let (key, mut entry) = cx.settled(original)?;
            if entry.creditor != cx.sender {
                return Err(fail(
                    ErrorCode::ApnNotParticipant,
                    "only the original creditor returns a payment",
                ));
            }
            let left = entry.amount.saturating_sub(entry.returned);
            if *amount == 0 || *amount > left {
                return Err(fail(
                    ErrorCode::ApnReturnExceeds,
                    format!("{amount} is not between 1 and the {left} left to return"),
                ));
            }
            let sender = cx.sender;
            cx.move_aey(&sender, &entry.debtor, *amount)?;
            entry.returned = entry.returned.saturating_add(*amount);
            cx.apn.put_dedup(cx.overlay, &key, &entry);
            let mut data = amount.to_le_bytes().to_vec();
            data.extend_from_slice(reason);
            cx.emit("aletheia.apn.payment.returned.v1", vec![key], data);
        }
        ApnOp::RecallRequest { original, reason } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let (key, mut entry) = cx.settled(original)?;
            if entry.debtor != cx.sender {
                return Err(fail(
                    ErrorCode::ApnNotParticipant,
                    "only the original debtor asks for a recall",
                ));
            }
            if entry.recall != recall::NONE || entry.returned >= entry.amount {
                return Err(fail(
                    ErrorCode::ApnIllegalTransition,
                    "a recall was already asked for, or nothing is left to return",
                ));
            }
            entry.recall = recall::REQUESTED;
            cx.apn.put_dedup(cx.overlay, &key, &entry);
            cx.emit(
                "aletheia.apn.recall.requested.v1",
                vec![key],
                reason.to_vec(),
            );
        }
        ApnOp::RecallResponse {
            original,
            accept,
            reason,
        } => {
            if meter.charge(PAYMENT_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let (key, mut entry) = cx.settled(original)?;
            if entry.creditor != cx.sender {
                return Err(fail(
                    ErrorCode::ApnNotParticipant,
                    "only the original creditor answers a recall",
                ));
            }
            if entry.recall != recall::REQUESTED {
                return Err(fail(
                    ErrorCode::ApnIllegalTransition,
                    "no recall is waiting for an answer",
                ));
            }
            if *accept {
                let left = entry.amount.saturating_sub(entry.returned);
                let sender = cx.sender;
                cx.move_aey(&sender, &entry.debtor, left)?;
                entry.returned = entry.amount;
                entry.recall = recall::ACCEPTED;
            } else {
                entry.recall = recall::DECLINED;
            }
            cx.apn.put_dedup(cx.overlay, &key, &entry);
            let mut data = vec![u8::from(*accept)];
            data.extend_from_slice(reason);
            cx.emit("aletheia.apn.recall.answered.v1", vec![key], data);
        }
        ApnOp::MessageAnchor {
            batch_id,
            merkle_root,
            count,
        } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let participant = cx.sending_participant()?;
            if *count == 0 {
                return Err(fail(
                    ErrorCode::TxFieldOutOfRange,
                    "an anchor covers at least one message",
                ));
            }
            if cx.apn.anchor(cx.overlay, batch_id)?.is_some() {
                return Err(fail(
                    ErrorCode::ApnAlreadyExists,
                    format!("batch {batch_id} is anchored"),
                ));
            }
            let entry = AnchorEntry {
                merkle_root: *merkle_root,
                count: *count,
                participant: participant.spec.aic,
                height: cx.ctx.height.get(),
            };
            cx.overlay
                .put(cx.apn.anchor_key(batch_id), entry.to_ace_bytes());
            cx.emit(
                "aletheia.apn.messages.anchored.v1",
                vec![*batch_id, *merkle_root],
                count.to_le_bytes().to_vec(),
            );
        }
        ApnOp::AanAssign { aan, address } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let participant = cx.sending_participant()?;
            if aan.routing_code() != participant.spec.routing_code {
                return Err(fail(
                    ErrorCode::ApnRoutingMismatch,
                    format!(
                        "{} is outside {}'s routing code {:04}",
                        aan.display(),
                        participant.spec.aic.text(),
                        participant.spec.routing_code
                    ),
                ));
            }
            if cx.apn.aan(cx.overlay, aan)?.is_some() {
                return Err(fail(
                    ErrorCode::ApnAlreadyExists,
                    format!("{} is assigned", aan.display()),
                ));
            }
            let mapping = Mapping {
                address: *address,
                registrar: participant.spec.aic,
            };
            cx.overlay.put(cx.apn.aan_key(aan), mapping.to_ace_bytes());
            cx.overlay.put(
                cx.apn.customer_key(&participant.spec.aic, address),
                Vec::new(),
            );
            cx.emit(
                "aletheia.apn.aan.assigned.v1",
                vec![address.account_hash()],
                aan.as_str().as_bytes().to_vec(),
            );
        }
        ApnOp::ProxyRegister { proxy, address } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let participant = cx.sending_participant()?;
            if cx.apn.proxy(cx.overlay, proxy)?.is_some() {
                return Err(fail(
                    ErrorCode::ApnAlreadyExists,
                    "this proxy alias is registered",
                ));
            }
            let mapping = Mapping {
                address: *address,
                registrar: participant.spec.aic,
            };
            cx.overlay
                .put(cx.apn.proxy_key(proxy), mapping.to_ace_bytes());
            cx.emit(
                "aletheia.apn.proxy.registered.v1",
                vec![*proxy, address.account_hash()],
                Vec::new(),
            );
        }
        ApnOp::ProxyRemove { proxy } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let participant = cx.sending_participant()?;
            let mapping = cx
                .apn
                .proxy(cx.overlay, proxy)?
                .ok_or_else(|| fail(ErrorCode::RegNotFound, "no such proxy alias"))?;
            if mapping.registrar != participant.spec.aic {
                return Err(fail(
                    ErrorCode::ApnNotParticipant,
                    "only the participant that registered a proxy alias removes it",
                ));
            }
            cx.overlay.delete(cx.apn.proxy_key(proxy));
            cx.emit("aletheia.apn.proxy.removed.v1", vec![*proxy], Vec::new());
        }
    }
    Ok(Ok(()))
}
