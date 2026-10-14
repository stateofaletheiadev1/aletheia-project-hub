//! Aletheia Payment Network, on-chain part, protocol version 1 (spec Sections 40B, 40D.5;
//! ADR-050).
//!
//! Every payment settles in AEY and is final when its block is final (40B.6). Who may do what:
//!
//! ```text
//! Payment, BatchPayment     the debtor (sender); both agents ACTIVE, each serving its account
//! PaymentRequest            the payee; PaymentRequestResponse: the payer, paying through its agent
//! MandateCreate, MandateAmend   the debtor;  MandateCancel: the debtor or the creditor
//! DirectDebit               the mandate's creditor, within its maximum, window and frequency
//! ScheduledPayment          the debtor; the protocol executes it at the end of a block on its day
//! ExternalLegLock           an ACTIVE participant's settlement account, through an ACTIVE gateway
//! ExternalLegSettle/Release the leg's gateway operator; ExternalInboundCredit: a gateway operator
//!                           with the Monetary Authority's standing authorization
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

use aletheia_core::apn::{
    Aic, ApnOp, PaymentLeg, PaymentRef, frequency, mandate_id, request_id, schedule_id, status,
};
use aletheia_core::{AceEncode, Address, AletheiaError, AssetId, ErrorCode, Hash32};
use aletheia_state::StateOverlay;

use crate::apn_model::{
    AnchorEntry, Apn, DEDUP_RETENTION_DAYS, DayTotals, DedupEntry, EscrowRecord,
    MAX_SCHEDULED_PER_DAY, MandateRecord, Mapping, Participant, RequestRecord, ScheduleCursor,
    ScheduleRecord, day_of, escrow_status, mandate_status, period, request_status, schedule_status,
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
/// Holds the AEY of LOCKED external-leg escrows, as locked balance (Section 40C.7).
pub const EXTERNAL_ESCROW: Address = module_address(7);

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

    /// An ACTIVE gateway operator.
    fn gateway(&self, aic: &Aic) -> Result<Participant, AletheiaError> {
        let operator = self.active(aic)?;
        if operator.spec.role != aletheia_core::apn::role::GATEWAY_OPERATOR {
            return Err(fail(
                ErrorCode::ApnNotParticipant,
                format!("{} is not a gateway operator", aic.text()),
            ));
        }
        Ok(operator)
    }

    fn within_gateway_limit(
        &self,
        operator: &Participant,
        amount: u128,
    ) -> Result<(), AletheiaError> {
        if amount > operator.spec.limits.per_payment_max {
            return Err(fail(
                ErrorCode::ApnLimitExceeded,
                format!(
                    "{amount} is above gateway {}'s per-payment maximum {}",
                    operator.spec.aic.text(),
                    operator.spec.limits.per_payment_max
                ),
            ));
        }
        Ok(())
    }

    /// A LOCKED leg whose gateway operator sent this transaction (I13: only LOCKED moves on).
    fn locked_leg(&self, leg_id: &Hash32) -> Result<EscrowRecord, AletheiaError> {
        let record = self.apn.escrow(self.overlay, leg_id)?.ok_or_else(|| {
            fail(
                ErrorCode::ApnRecordUnknown,
                format!("no external leg {leg_id}"),
            )
        })?;
        let operator = self.sending_participant()?;
        if operator.spec.aic != record.gateway {
            return Err(fail(
                ErrorCode::ApnNotParticipant,
                "only the leg's gateway operator settles or releases it",
            ));
        }
        if record.status != escrow_status::LOCKED {
            return Err(fail(
                ErrorCode::ApnIllegalTransition,
                "the leg was already settled or released",
            ));
        }
        Ok(record)
    }

    fn escrow_total_add(&mut self, amount: u128, add: bool) -> Result<(), AletheiaError> {
        let total = self.apn.escrow_total(self.overlay)?;
        let next = if add {
            total.checked_add(amount)
        } else {
            total.checked_sub(amount)
        }
        .ok_or_else(|| {
            fail(
                ErrorCode::MonetaryInvariantViolated,
                "I14: escrow total out of range",
            )
        })?;
        self.overlay
            .put(self.apn.escrow_total_key(), next.to_ace_bytes());
        Ok(())
    }

    /// `from`'s available AEY into the escrow account's locked balance; circulating → locked.
    fn escrow_in(&mut self, from: &Address, amount: u128) -> Result<(), AletheiaError> {
        debit(self.records, self.overlay, from, AssetId::AEY, amount)?;
        credit(
            self.records,
            self.overlay,
            &EXTERNAL_ESCROW,
            AssetId::AEY,
            amount,
        )?;
        crate::rules::v1::balances::lock(
            self.records,
            self.overlay,
            &EXTERNAL_ESCROW,
            AssetId::AEY,
            amount,
        )?;
        let mut supply = self.supply()?;
        supply.circulating = supply
            .circulating
            .checked_sub(amount)
            .ok_or_else(|| self.bucket("circulating"))?;
        supply.locked = supply
            .locked
            .checked_add(amount)
            .ok_or_else(|| self.bucket("locked"))?;
        self.records
            .put_supply_ledger(self.overlay, AssetId::AEY, &supply);
        self.escrow_total_add(amount, true)?;
        self.touched.push((*from, AssetId::AEY));
        self.touched.push((EXTERNAL_ESCROW, AssetId::AEY));
        Ok(())
    }

    /// Out of escrow: back to `to` (release), or burned as a redemption (settle).
    fn escrow_out(&mut self, amount: u128, to: Option<&Address>) -> Result<(), AletheiaError> {
        crate::rules::v1::balances::unlock(
            self.records,
            self.overlay,
            &EXTERNAL_ESCROW,
            AssetId::AEY,
            amount,
        )?;
        debit(
            self.records,
            self.overlay,
            &EXTERNAL_ESCROW,
            AssetId::AEY,
            amount,
        )?;
        let mut supply = self.supply()?;
        supply.locked = supply
            .locked
            .checked_sub(amount)
            .ok_or_else(|| self.bucket("locked"))?;
        match to {
            Some(to) => {
                credit(self.records, self.overlay, to, AssetId::AEY, amount)?;
                supply.circulating = supply
                    .circulating
                    .checked_add(amount)
                    .ok_or_else(|| self.bucket("circulating"))?;
                self.touched.push((*to, AssetId::AEY));
            }
            None => {
                supply.burned_total = supply
                    .burned_total
                    .checked_add(amount)
                    .ok_or_else(|| self.bucket("burned"))?;
                supply.redeemed_total = supply
                    .redeemed_total
                    .checked_add(amount)
                    .ok_or_else(|| self.bucket("redeemed"))?;
                if supply.reserve_backed {
                    supply.outstanding_liabilities = supply
                        .outstanding_liabilities
                        .checked_sub(amount)
                        .ok_or_else(|| self.bucket("liabilities"))?;
                }
            }
        }
        self.records
            .put_supply_ledger(self.overlay, AssetId::AEY, &supply);
        self.escrow_total_add(amount, false)?;
        self.touched.push((EXTERNAL_ESCROW, AssetId::AEY));
        Ok(())
    }

    fn supply(&self) -> Result<aletheia_monetary::SupplyLedger, AletheiaError> {
        self.records
            .supply_ledger(self.overlay, AssetId::AEY)?
            .ok_or_else(|| fail(ErrorCode::TxAssetUnknown, "AEY has no supply ledger"))
    }

    fn bucket(&self, what: &str) -> AletheiaError {
        fail(
            ErrorCode::MonetaryInvariantViolated,
            format!("the {what} figure is out of range"),
        )
    }

    fn mandate(&self, id: &Hash32) -> Result<MandateRecord, AletheiaError> {
        self.apn
            .mandate(self.overlay, id)?
            .ok_or_else(|| fail(ErrorCode::ApnRecordUnknown, format!("no mandate {id}")))
    }

    /// One credit from `debtor`: checks, limits, de-duplication, settlement, event.
    fn pay(
        &mut self,
        debtor: Address,
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
        if !self.apn.serves(self.overlay, debtor_agent, &debtor)? {
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
        let sender = debtor;
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
            vec![key, sender.to_word(), leg.creditor.to_word()],
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
            let sender = cx.sender;
            cx.pay(sender, &agent, Some(*scheme), leg, purpose)?;
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
                let sender = cx.sender;
                if *atomic {
                    cx.pay(sender, &agent, None, leg, purpose)?;
                    continue;
                }
                cx.overlay.checkpoint();
                let mark = (cx.events.len(), cx.touched.len());
                match cx.pay(sender, &agent, None, leg, purpose) {
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
                    vec![sender.to_word()],
                    data.as_bytes().to_vec(),
                );
            }
        }
        ApnOp::PaymentRequest {
            payer,
            amount,
            creditor_agent,
            uetr_hash,
            remittance_hash,
            expires_day,
        } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let agent = cx.active(creditor_agent)?;
            let payee = cx.sender;
            if !cx.apn.serves(cx.overlay, &agent, &payee)? {
                return Err(fail(
                    ErrorCode::ApnRoutingMismatch,
                    format!(
                        "{} does not serve the payee's account",
                        agent.spec.aic.text()
                    ),
                ));
            }
            if *expires_day < cx.day() {
                return Err(fail(
                    ErrorCode::TxFieldOutOfRange,
                    "the request expires in the past",
                ));
            }
            let id = request_id(records.network(), &payee, body.nonce);
            let record = RequestRecord {
                payee,
                payer: *payer,
                amount: *amount,
                creditor_agent: *creditor_agent,
                uetr_hash: *uetr_hash,
                remittance_hash: *remittance_hash,
                expires_day: *expires_day,
                status: request_status::PENDING,
            };
            cx.overlay
                .put(cx.apn.request_key(&id), record.to_ace_bytes());
            cx.emit(
                "aletheia.apn.request.created.v1",
                vec![id, payee.to_word(), payer.to_word()],
                amount.to_le_bytes().to_vec(),
            );
        }
        ApnOp::PaymentRequestResponse {
            request_id: id,
            accept,
            debtor_agent,
        } => {
            if meter.charge(PAYMENT_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let mut record = cx.apn.request(cx.overlay, id)?.ok_or_else(|| {
                fail(
                    ErrorCode::ApnRecordUnknown,
                    format!("no payment request {id}"),
                )
            })?;
            if record.payer != cx.sender {
                return Err(fail(
                    ErrorCode::ApnNotParticipant,
                    "only the payer answers a payment request",
                ));
            }
            if record.status != request_status::PENDING || cx.day() > record.expires_day {
                return Err(fail(
                    ErrorCode::ApnRequestClosed,
                    "the request was answered or expired",
                ));
            }
            if *accept {
                let agent = cx.active(debtor_agent)?;
                let leg = PaymentLeg {
                    creditor: record.payee,
                    amount: record.amount,
                    creditor_agent: record.creditor_agent,
                    uetr_hash: record.uetr_hash,
                    remittance_hash: record.remittance_hash,
                };
                let payer = cx.sender;
                cx.pay(payer, &agent, None, &leg, b"RTPY")?;
                record.status = request_status::PAID;
            } else {
                record.status = request_status::DECLINED;
            }
            cx.overlay
                .put(cx.apn.request_key(id), record.to_ace_bytes());
            cx.emit(
                "aletheia.apn.request.answered.v1",
                vec![*id],
                vec![u8::from(*accept)],
            );
        }
        ApnOp::MandateCreate {
            creditor,
            creditor_agent,
            debtor_agent,
            max_amount,
            frequency: how_often,
            first_day,
            final_day,
        } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            if *how_often > frequency::ON_DEMAND || *max_amount == 0 || first_day > final_day {
                return Err(fail(
                    ErrorCode::TxFieldOutOfRange,
                    "a mandate needs a known frequency, a positive maximum and first day <= final day",
                ));
            }
            let debtor = cx.sender;
            let debtors_agent = cx.active(debtor_agent)?;
            let creditors_agent = cx.active(creditor_agent)?;
            if !cx.apn.serves(cx.overlay, &debtors_agent, &debtor)?
                || !cx.apn.serves(cx.overlay, &creditors_agent, creditor)?
            {
                return Err(fail(
                    ErrorCode::ApnRoutingMismatch,
                    "each agent must serve its account",
                ));
            }
            let id = mandate_id(records.network(), &debtor, body.nonce);
            let record = MandateRecord {
                debtor,
                creditor: *creditor,
                debtor_agent: *debtor_agent,
                creditor_agent: *creditor_agent,
                max_amount: *max_amount,
                frequency: *how_often,
                first_day: *first_day,
                final_day: *final_day,
                status: mandate_status::ACTIVE,
                created_tx: cx.tx_id,
                last_debit_day: None,
                debits: 0,
            };
            cx.overlay
                .put(cx.apn.mandate_key(&id), record.to_ace_bytes());
            cx.emit(
                "aletheia.apn.mandate.created.v1",
                vec![id, debtor.to_word(), creditor.to_word()],
                record.to_ace_bytes(),
            );
        }
        ApnOp::MandateAmend {
            mandate_id: id,
            max_amount,
            final_day,
            suspended,
        } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let mut record = cx.mandate(id)?;
            if record.debtor != cx.sender {
                return Err(fail(
                    ErrorCode::ApnNotParticipant,
                    "only the debtor amends a mandate",
                ));
            }
            if record.status == mandate_status::CANCELLED {
                return Err(fail(
                    ErrorCode::ApnMandateNotUsable,
                    "the mandate is cancelled",
                ));
            }
            if *max_amount == 0 || *final_day < record.first_day {
                return Err(fail(
                    ErrorCode::TxFieldOutOfRange,
                    "a mandate keeps a positive maximum and a final day after its first",
                ));
            }
            record.max_amount = *max_amount;
            record.final_day = *final_day;
            record.status = if *suspended {
                mandate_status::SUSPENDED
            } else {
                mandate_status::ACTIVE
            };
            cx.overlay
                .put(cx.apn.mandate_key(id), record.to_ace_bytes());
            cx.emit(
                "aletheia.apn.mandate.amended.v1",
                vec![*id],
                record.to_ace_bytes(),
            );
        }
        ApnOp::MandateCancel { mandate_id: id } => {
            if meter.charge(APN_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let mut record = cx.mandate(id)?;
            if record.debtor != cx.sender && record.creditor != cx.sender {
                return Err(fail(
                    ErrorCode::ApnNotParticipant,
                    "only the debtor or the creditor cancels a mandate",
                ));
            }
            if record.status == mandate_status::CANCELLED {
                return Err(fail(
                    ErrorCode::ApnMandateNotUsable,
                    "the mandate is already cancelled",
                ));
            }
            record.status = mandate_status::CANCELLED;
            cx.overlay
                .put(cx.apn.mandate_key(id), record.to_ace_bytes());
            cx.emit("aletheia.apn.mandate.cancelled.v1", vec![*id], Vec::new());
        }
        ApnOp::DirectDebit {
            mandate_id: id,
            amount,
            uetr_hash,
            remittance_hash,
        } => {
            if meter.charge(PAYMENT_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let mut record = cx.mandate(id)?;
            if record.creditor != cx.sender {
                return Err(fail(
                    ErrorCode::ApnNotParticipant,
                    "only the mandate's creditor debits it",
                ));
            }
            let day = cx.day();
            if record.status != mandate_status::ACTIVE
                || day < record.first_day
                || day > record.final_day
            {
                return Err(fail(
                    ErrorCode::ApnMandateNotUsable,
                    "the mandate is suspended, cancelled, or outside its validity window",
                ));
            }
            if *amount > record.max_amount {
                return Err(fail(
                    ErrorCode::ApnMandateLimit,
                    format!(
                        "{amount} is above the mandate's maximum {}",
                        record.max_amount
                    ),
                ));
            }
            let too_soon = match record.frequency {
                frequency::ONCE => record.debits > 0,
                frequency::ON_DEMAND => false,
                how_often => record
                    .last_debit_day
                    .is_some_and(|last| period(how_often, last) == period(how_often, day)),
            };
            if too_soon {
                return Err(fail(
                    ErrorCode::ApnMandateLimit,
                    "the mandate was already debited in this period",
                ));
            }
            let agent = cx.active(&record.debtor_agent)?;
            let leg = PaymentLeg {
                creditor: record.creditor,
                amount: *amount,
                creditor_agent: record.creditor_agent,
                uetr_hash: *uetr_hash,
                remittance_hash: *remittance_hash,
            };
            cx.pay(record.debtor, &agent, None, &leg, b"DDBT")?;
            record.last_debit_day = Some(day);
            record.debits = record.debits.saturating_add(1);
            cx.overlay
                .put(cx.apn.mandate_key(id), record.to_ace_bytes());
        }
        ApnOp::ScheduledPayment {
            debtor_agent,
            leg,
            purpose,
            execute_day,
        } => {
            // The execution is paid for now: the protocol runs it later without a fee.
            if meter.charge(APN_EU.saturating_add(PAYMENT_EU)).is_err() {
                return Ok(Err(OutOfEu));
            }
            let today = cx.day();
            if *execute_day <= today {
                return Err(fail(
                    ErrorCode::TxFieldOutOfRange,
                    "a scheduled payment is for a future day; pay today with a Payment",
                ));
            }
            let agent = cx.active(debtor_agent)?;
            let debtor = cx.sender;
            if !cx.apn.serves(cx.overlay, &agent, &debtor)? {
                return Err(fail(
                    ErrorCode::ApnRoutingMismatch,
                    format!(
                        "{} does not serve the debtor's account",
                        agent.spec.aic.text()
                    ),
                ));
            }
            let mut queue = cx.apn.day_queue(cx.overlay, *execute_day)?;
            if u32::try_from(queue.ids.len()).unwrap_or(u32::MAX) >= MAX_SCHEDULED_PER_DAY {
                return Err(fail(
                    ErrorCode::ApnLimitExceeded,
                    format!(
                        "day {execute_day} already has {MAX_SCHEDULED_PER_DAY} scheduled payments"
                    ),
                ));
            }
            let id = schedule_id(records.network(), &debtor, body.nonce);
            let record = ScheduleRecord {
                debtor,
                debtor_agent: *debtor_agent,
                leg: *leg,
                purpose: *purpose,
                execute_day: *execute_day,
                status: schedule_status::PENDING,
                result_code: 0,
                executed_height: 0,
            };
            cx.overlay
                .put(cx.apn.schedule_key(&id), record.to_ace_bytes());
            queue.ids.push(id);
            cx.overlay
                .put(cx.apn.day_queue_key(*execute_day), queue.to_ace_bytes());
            if cx.apn.cursor(cx.overlay)?.is_none() {
                let start = ScheduleCursor {
                    day: today,
                    index: 0,
                };
                cx.overlay.put(cx.apn.cursor_key(), start.to_ace_bytes());
            }
            cx.emit(
                "aletheia.apn.payment.scheduled.v1",
                vec![id, debtor.to_word(), leg.creditor.to_word()],
                execute_day.to_le_bytes().to_vec(),
            );
        }
        ApnOp::ExternalLegLock {
            leg_id,
            amount,
            uetr_hash,
            rail,
            profile_hash,
            gateway,
            expiry_day,
        } => {
            if meter.charge(PAYMENT_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let sender_agent = cx.sending_participant()?;
            let operator = cx.gateway(gateway)?;
            cx.within_gateway_limit(&operator, *amount)?;
            if cx.apn.escrow(cx.overlay, leg_id)?.is_some() {
                return Err(fail(
                    ErrorCode::ApnAlreadyExists,
                    format!("leg {leg_id} exists"),
                ));
            }
            if *expiry_day < cx.day() {
                return Err(fail(
                    ErrorCode::TxFieldOutOfRange,
                    "the leg expires in the past",
                ));
            }
            // The leg is a payment: its UETR is de-duplicated like any other (40D.5).
            let reference = PaymentRef {
                debtor_agent: sender_agent.spec.aic,
                uetr_hash: *uetr_hash,
                leg: 0,
            };
            let key = reference.dedup_key(records.network());
            let day = cx.day();
            if cx
                .apn
                .dedup(cx.overlay, &key)?
                .is_some_and(|e| day <= e.expires_day)
            {
                return Err(fail(
                    ErrorCode::PayDuplicate,
                    "a payment with this agent and UETR already settled",
                ));
            }
            let sender = cx.sender;
            cx.escrow_in(&sender, *amount)?;
            let entry = DedupEntry {
                tx_id: cx.tx_id,
                height: cx.ctx.height.get(),
                expires_day: day.saturating_add(DEDUP_RETENTION_DAYS),
                debtor: sender,
                creditor: EXTERNAL_ESCROW,
                amount: *amount,
                returned: 0,
                recall: recall::NONE,
            };
            cx.apn.put_dedup(cx.overlay, &key, &entry);
            let record = EscrowRecord {
                sender,
                sender_agent: sender_agent.spec.aic,
                gateway: *gateway,
                amount: *amount,
                uetr_hash: *uetr_hash,
                rail: *rail,
                profile_hash: *profile_hash,
                expiry_day: *expiry_day,
                status: escrow_status::LOCKED,
                locked_height: cx.ctx.height.get(),
                closed_height: 0,
            };
            cx.overlay
                .put(cx.apn.escrow_key(leg_id), record.to_ace_bytes());
            cx.emit(
                "aletheia.apn.external.locked.v1",
                vec![*leg_id, *uetr_hash, sender.to_word()],
                amount.to_le_bytes().to_vec(),
            );
        }
        ApnOp::ExternalLegSettle {
            leg_id,
            msg_id_hash,
        } => {
            if meter.charge(PAYMENT_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let mut record = cx.locked_leg(leg_id)?;
            let sender = cx.sender;
            let amount = record.amount;
            cx.escrow_out(amount, None)?;
            record.status = escrow_status::SETTLED;
            record.closed_height = cx.ctx.height.get();
            cx.overlay
                .put(cx.apn.escrow_key(leg_id), record.to_ace_bytes());
            // reserve_ref = H(UETR ‖ MsgId): both hashes are in the event.
            let mut data = amount.to_le_bytes().to_vec();
            data.extend_from_slice(record.uetr_hash.as_bytes());
            data.extend_from_slice(msg_id_hash.as_bytes());
            cx.emit(
                "aletheia.apn.external.settled.v1",
                vec![*leg_id, *msg_id_hash, sender.to_word()],
                data,
            );
        }
        ApnOp::ExternalLegRelease { leg_id, reason } => {
            if meter.charge(PAYMENT_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let mut record = cx.locked_leg(leg_id)?;
            cx.escrow_out(record.amount, Some(&record.sender))?;
            record.status = escrow_status::RELEASED;
            record.closed_height = cx.ctx.height.get();
            cx.overlay
                .put(cx.apn.escrow_key(leg_id), record.to_ace_bytes());
            let mut data = record.amount.to_le_bytes().to_vec();
            data.extend_from_slice(reason);
            cx.emit(
                "aletheia.apn.external.released.v1",
                vec![*leg_id, record.sender.to_word()],
                data,
            );
        }
        ApnOp::ExternalInboundCredit {
            rail,
            uetr_hash,
            msg_id_hash,
            amount,
            creditor,
            creditor_agent,
            standing,
        } => {
            if meter.charge(PAYMENT_EU).is_err() {
                return Ok(Err(OutOfEu));
            }
            let operator = cx.sending_participant()?;
            if operator.spec.role != aletheia_core::apn::role::GATEWAY_OPERATOR {
                return Err(fail(
                    ErrorCode::ApnNotParticipant,
                    "only a gateway operator credits inbound payments",
                ));
            }
            cx.within_gateway_limit(&operator, *amount)?;
            let policy = crate::rules::v1::monetary::policy(records, cx.overlay)?;
            if standing.gateway != operator.spec.aic || ctx.epoch.get() > standing.valid_until_epoch
            {
                return Err(fail(
                    ErrorCode::ApnStandingExhausted,
                    "the standing authorization names another gateway, or it expired",
                ));
            }
            if let Err(out) = crate::rules::v1::monetary::check_signatures(
                &policy.authority_keys,
                policy.authority_threshold,
                &standing.signatures,
                &standing.digest(records.network()),
                meter,
                "standing authorization",
            )? {
                return Ok(Err(out));
            }
            // A replayed message is a duplicate, whatever else it gets wrong.
            let unique = cx.apn.inbound_key(*rail, uetr_hash, msg_id_hash, *amount);
            if cx.overlay.get(&unique)?.is_some() {
                return Err(fail(
                    ErrorCode::PayDuplicate,
                    "this inbound credit was already minted",
                ));
            }
            let used = cx
                .apn
                .standing_used(cx.overlay, &standing.authorization_id)?;
            let after = used
                .checked_add(*amount)
                .filter(|total| *total <= standing.max_total)
                .ok_or_else(|| {
                    fail(
                        ErrorCode::ApnStandingExhausted,
                        format!("{used} of {} is already used", standing.max_total),
                    )
                })?;
            let agent = cx.active(creditor_agent)?;
            if !cx.apn.serves(cx.overlay, &agent, creditor)? {
                return Err(fail(
                    ErrorCode::ApnRoutingMismatch,
                    format!(
                        "{} does not serve the creditor's account",
                        agent.spec.aic.text()
                    ),
                ));
            }
            crate::rules::v1::monetary::issue(
                records, cx.overlay, &policy, ctx, creditor, *amount,
            )?;
            cx.touched.push((*creditor, AssetId::AEY));
            cx.overlay.put(unique, ctx.height.get().to_ace_bytes());
            cx.overlay.put(
                cx.apn.standing_used_key(&standing.authorization_id),
                after.to_ace_bytes(),
            );
            let mut data = amount.to_le_bytes().to_vec();
            data.extend_from_slice(&rail.to_le_bytes());
            cx.emit(
                "aletheia.apn.external.inbound.v1",
                vec![*uetr_hash, *msg_id_hash, creditor.to_word()],
                data,
            );
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
                vec![address.to_word()],
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
                vec![*proxy, address.to_word()],
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

/// Scheduled payments executed in one block at most (devnet default).
pub const MAX_SCHEDULED_PER_BLOCK: u32 = 256;
/// Days the end-of-block step walks in one block at most, so an idle chain catches up in
/// bounded steps.
pub const MAX_DAYS_PER_BLOCK: u32 = 32;

/// The end-of-block step (ADR-050): executes scheduled payments that are due, in the order
/// they were scheduled, at most `MAX_SCHEDULED_PER_BLOCK` per block. Each runs on its own
/// checkpoint with every payment check; one that fails is recorded as FAILED with its error
/// code and moves nothing. Returns the balances it moved, for the supply check.
pub(crate) fn end_block(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    ctx: &BlockContext,
) -> Result<Touched, AletheiaError> {
    let touched = run_scheduled(records, overlay, ctx)?;
    check_escrow(records, overlay)?;
    Ok(touched)
}

fn run_scheduled(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    ctx: &BlockContext,
) -> Result<Touched, AletheiaError> {
    let apn = Apn { records };
    let mut touched = Touched::new();
    let Some(start) = apn.cursor(overlay)? else {
        return Ok(touched);
    };
    let today = day_of(ctx.protocol_time_ms);
    let mut cursor = start;
    let (mut work, mut days) = (0u32, 0u32);
    while cursor.day <= today && work < MAX_SCHEDULED_PER_BLOCK && days < MAX_DAYS_PER_BLOCK {
        let queue = apn.day_queue(overlay, cursor.day)?;
        while work < MAX_SCHEDULED_PER_BLOCK {
            let Some(id) = usize::try_from(cursor.index)
                .ok()
                .and_then(|i| queue.ids.get(i))
            else {
                break;
            };
            execute_scheduled(records, overlay, ctx, id, &mut touched)?;
            cursor.index = cursor.index.saturating_add(1);
            work = work.saturating_add(1);
        }
        if usize::try_from(cursor.index).unwrap_or(usize::MAX) < queue.ids.len() {
            break;
        }
        cursor = ScheduleCursor {
            day: cursor.day.saturating_add(1),
            index: 0,
        };
        days = days.saturating_add(1);
    }
    if cursor != start {
        overlay.put(apn.cursor_key(), cursor.to_ace_bytes());
    }
    Ok(touched)
}

/// I14 after every block: the AEY in LOCKED escrows is exactly the escrow account's locked
/// balance, and the account holds nothing else. A violation makes the block invalid.
pub(crate) fn check_escrow(
    records: &Records,
    overlay: &StateOverlay<'_>,
) -> Result<(), AletheiaError> {
    let total = Apn { records }.escrow_total(overlay)?;
    let held = records.balance(overlay, &EXTERNAL_ESCROW, AssetId::AEY)?;
    if held.locked != total || held.available != 0 {
        return Err(fail(
            ErrorCode::MonetaryInvariantViolated,
            format!(
                "I14: LOCKED escrows hold {total}, but the escrow account has {} locked and {} available",
                held.locked, held.available
            ),
        ));
    }
    Ok(())
}

fn execute_scheduled(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    ctx: &BlockContext,
    id: &Hash32,
    touched: &mut Touched,
) -> Result<(), AletheiaError> {
    let apn = Apn { records };
    let Some(mut record) = apn.schedule(overlay, id)? else {
        return Ok(());
    };
    if record.status != schedule_status::PENDING {
        return Ok(());
    }
    let mark = touched.len();
    overlay.checkpoint();
    let mut events = Vec::new();
    let outcome = {
        let mut cx = Cx {
            apn,
            records,
            overlay: &mut *overlay,
            sender: record.debtor,
            tx_id: *id,
            ctx,
            events: &mut events,
            touched: &mut *touched,
        };
        cx.active(&record.debtor_agent)
            .and_then(|agent| cx.pay(record.debtor, &agent, None, &record.leg, &record.purpose))
    };
    match outcome {
        Ok(()) => {
            overlay.commit_checkpoint();
            record.status = schedule_status::EXECUTED;
        }
        Err(error) if error.is_fail_stop() => return Err(error),
        Err(error) => {
            overlay.revert_to_checkpoint()?;
            touched.truncate(mark);
            record.status = schedule_status::FAILED;
            record.result_code = error.code().get();
        }
    }
    record.executed_height = ctx.height.get();
    overlay.put(apn.schedule_key(id), record.to_ace_bytes());
    Ok(())
}
