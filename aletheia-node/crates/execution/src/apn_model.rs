//! APN state (spec Sections 15, 40B, 40D.5).
//!
//! ```text
//! 100 ApnParticipants  (0, aic) Participant   (1, settlement address) aic   (2, aic, day) DayTotals
//!                      (3, aic, address) [] : the participant serves this account
//! 101 AanMapping       aan → Mapping
//! 102 ProxyAliases     H(salt ‖ alias) → Mapping
//! 105 MessageAnchors   batch_id → AnchorEntry
//! 107 PaymentDedup     PaymentDedupKey → DedupEntry
//! 108 ExternalLegEscrow (0, leg id) EscrowRecord   (1) Σ locked   (2, inbound key) height
//!                      (3, standing authorization id) AEY minted under it
//! ```

use aletheia_core::apn::{Aan, Aic, ParticipantSpec};
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, Address, AletheiaError, ErrorCode, Hash32,
};
use aletheia_state::{Namespace, StateKey, StateOverlay, StateView};

use crate::model::Records;

/// A participant: what governance approved, its status and when it changed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Participant {
    pub spec: ParticipantSpec,
    pub status: u8,
    pub certified_epoch: u64,
    pub updated_epoch: u64,
}

impl AceEncode for Participant {
    fn encode(&self, out: &mut AceWriter) {
        self.spec.encode(out);
        out.u8(self.status);
        out.u64(self.certified_epoch);
        out.u64(self.updated_epoch);
    }
}

impl AceDecode for Participant {
    fn decode(input: &mut AceReader<'_>) -> Result<Participant, AletheiaError> {
        Ok(Participant {
            spec: ParticipantSpec::decode(input)?,
            status: input.u8()?,
            certified_epoch: input.u64()?,
            updated_epoch: input.u64()?,
        })
    }
}

/// A participant's payments in and out on one day (UTC day of protocol time).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct DayTotals {
    pub out: u128,
    pub r#in: u128,
}

impl AceEncode for DayTotals {
    fn encode(&self, out: &mut AceWriter) {
        out.u128(self.out);
        out.u128(self.r#in);
    }
}

impl AceDecode for DayTotals {
    fn decode(input: &mut AceReader<'_>) -> Result<DayTotals, AletheiaError> {
        Ok(DayTotals {
            out: input.u128()?,
            r#in: input.u128()?,
        })
    }
}

/// A settled payment leg, kept for returns, recalls and de-duplication (namespace 107).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DedupEntry {
    pub tx_id: Hash32,
    pub height: u64,
    pub expires_day: u64,
    pub debtor: Address,
    pub creditor: Address,
    pub amount: u128,
    pub returned: u128,
    /// 0 none, 1 requested, 2 accepted, 3 declined.
    pub recall: u8,
}

impl AceEncode for DedupEntry {
    fn encode(&self, out: &mut AceWriter) {
        self.tx_id.encode(out);
        out.u64(self.height);
        out.u64(self.expires_day);
        self.debtor.encode(out);
        self.creditor.encode(out);
        out.u128(self.amount);
        out.u128(self.returned);
        out.u8(self.recall);
    }
}

impl AceDecode for DedupEntry {
    fn decode(input: &mut AceReader<'_>) -> Result<DedupEntry, AletheiaError> {
        Ok(DedupEntry {
            tx_id: Hash32::decode(input)?,
            height: input.u64()?,
            expires_day: input.u64()?,
            debtor: Address::decode(input)?,
            creditor: Address::decode(input)?,
            amount: input.u128()?,
            returned: input.u128()?,
            recall: input.u8()?,
        })
    }
}

/// Who an account number or proxy alias resolves to, and which participant registered it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Mapping {
    pub address: Address,
    pub registrar: Aic,
}

impl AceEncode for Mapping {
    fn encode(&self, out: &mut AceWriter) {
        self.address.encode(out);
        self.registrar.encode(out);
    }
}

impl AceDecode for Mapping {
    fn decode(input: &mut AceReader<'_>) -> Result<Mapping, AletheiaError> {
        Ok(Mapping {
            address: Address::decode(input)?,
            registrar: Aic::decode(input)?,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AnchorEntry {
    pub merkle_root: Hash32,
    pub count: u32,
    pub participant: Aic,
    pub height: u64,
}

impl AceEncode for AnchorEntry {
    fn encode(&self, out: &mut AceWriter) {
        self.merkle_root.encode(out);
        out.u32(self.count);
        self.participant.encode(out);
        out.u64(self.height);
    }
}

impl AceDecode for AnchorEntry {
    fn decode(input: &mut AceReader<'_>) -> Result<AnchorEntry, AletheiaError> {
        Ok(AnchorEntry {
            merkle_root: Hash32::decode(input)?,
            count: input.u32()?,
            participant: Aic::decode(input)?,
            height: input.u64()?,
        })
    }
}

/// Days a de-duplication entry lives: longer than any scheme's return window (40D.5).
pub const DEDUP_RETENTION_DAYS: u64 = 400;
const MS_PER_DAY: u64 = 86_400_000;

/// The UTC day of a protocol time, which daily limits and retention count.
pub const fn day_of(protocol_time_ms: u64) -> u64 {
    protocol_time_ms / MS_PER_DAY
}

#[derive(Debug, Clone, Copy)]
pub struct Apn<'a> {
    pub records: &'a Records,
}

impl Apn<'_> {
    fn key(&self, namespace: Namespace, parts: &[&[u8]]) -> StateKey {
        StateKey::derive_raw(self.records.network(), namespace, &parts.concat())
    }

    fn get<T: AceDecode>(
        &self,
        view: &dyn StateView,
        key: &StateKey,
        what: &str,
    ) -> Result<Option<T>, AletheiaError> {
        view.get(key)?
            .map(|bytes| {
                T::from_ace_bytes(&bytes).map_err(|e| {
                    AletheiaError::new(
                        ErrorCode::StoCorrupt,
                        format!("stored {what} does not decode: {}", e.detail()),
                    )
                })
            })
            .transpose()
    }

    pub fn participant_key(&self, aic: &Aic) -> StateKey {
        self.key(Namespace::ApnParticipants, &[&[0], aic.as_bytes()])
    }

    pub fn participant(
        &self,
        view: &dyn StateView,
        aic: &Aic,
    ) -> Result<Option<Participant>, AletheiaError> {
        self.get(view, &self.participant_key(aic), "participant")
    }

    pub fn put_participant(&self, overlay: &mut StateOverlay<'_>, participant: &Participant) {
        let aic = participant.spec.aic;
        overlay.put(self.participant_key(&aic), participant.to_ace_bytes());
        overlay.put(
            self.by_address_key(&participant.spec.settlement_address),
            aic.to_ace_bytes(),
        );
    }

    pub fn by_address_key(&self, address: &Address) -> StateKey {
        self.key(Namespace::ApnParticipants, &[&[1], &address.to_ace_bytes()])
    }

    /// The participant whose settlement account is `address`.
    pub fn participant_at(
        &self,
        view: &dyn StateView,
        address: &Address,
    ) -> Result<Option<Participant>, AletheiaError> {
        match self.get::<Aic>(view, &self.by_address_key(address), "participant index")? {
            Some(aic) => self.participant(view, &aic),
            None => Ok(None),
        }
    }

    pub fn day_key(&self, aic: &Aic, day: u64) -> StateKey {
        self.key(
            Namespace::ApnParticipants,
            &[&[2], aic.as_bytes(), &day.to_le_bytes()],
        )
    }

    pub fn day_totals(
        &self,
        view: &dyn StateView,
        aic: &Aic,
        day: u64,
    ) -> Result<DayTotals, AletheiaError> {
        Ok(self
            .get(view, &self.day_key(aic, day), "day totals")?
            .unwrap_or_default())
    }

    pub fn put_day_totals(
        &self,
        overlay: &mut StateOverlay<'_>,
        aic: &Aic,
        day: u64,
        totals: &DayTotals,
    ) {
        overlay.put(self.day_key(aic, day), totals.to_ace_bytes());
    }

    pub fn customer_key(&self, aic: &Aic, address: &Address) -> StateKey {
        self.key(
            Namespace::ApnParticipants,
            &[&[3], aic.as_bytes(), &address.to_ace_bytes()],
        )
    }

    /// Whether `aic` serves `address`: its own settlement account, or an account it gave an
    /// account number to.
    pub fn serves(
        &self,
        view: &dyn StateView,
        participant: &Participant,
        address: &Address,
    ) -> Result<bool, AletheiaError> {
        Ok(participant.spec.settlement_address == *address
            || view
                .get(&self.customer_key(&participant.spec.aic, address))?
                .is_some())
    }

    pub fn dedup_state_key(&self, dedup: &Hash32) -> StateKey {
        self.key(Namespace::PaymentDedup, &[dedup.as_bytes()])
    }

    pub fn dedup(
        &self,
        view: &dyn StateView,
        dedup: &Hash32,
    ) -> Result<Option<DedupEntry>, AletheiaError> {
        self.get(
            view,
            &self.dedup_state_key(dedup),
            "payment de-duplication entry",
        )
    }

    pub fn put_dedup(&self, overlay: &mut StateOverlay<'_>, dedup: &Hash32, entry: &DedupEntry) {
        overlay.put(self.dedup_state_key(dedup), entry.to_ace_bytes());
    }

    pub fn aan_key(&self, aan: &Aan) -> StateKey {
        self.key(Namespace::AanMapping, &[aan.as_str().as_bytes()])
    }

    pub fn aan(&self, view: &dyn StateView, aan: &Aan) -> Result<Option<Mapping>, AletheiaError> {
        self.get(view, &self.aan_key(aan), "account number")
    }

    pub fn proxy_key(&self, proxy: &Hash32) -> StateKey {
        self.key(Namespace::ProxyAliases, &[proxy.as_bytes()])
    }

    pub fn proxy(
        &self,
        view: &dyn StateView,
        proxy: &Hash32,
    ) -> Result<Option<Mapping>, AletheiaError> {
        self.get(view, &self.proxy_key(proxy), "proxy alias")
    }

    pub fn anchor_key(&self, batch: &Hash32) -> StateKey {
        self.key(Namespace::MessageAnchors, &[batch.as_bytes()])
    }

    pub fn anchor(
        &self,
        view: &dyn StateView,
        batch: &Hash32,
    ) -> Result<Option<AnchorEntry>, AletheiaError> {
        self.get(view, &self.anchor_key(batch), "message anchor")
    }
}

/// A payment request (namespace 104, key the request id).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RequestRecord {
    pub payee: Address,
    pub payer: Address,
    pub amount: u128,
    pub creditor_agent: Aic,
    pub uetr_hash: Hash32,
    pub remittance_hash: Hash32,
    pub expires_day: u64,
    pub status: u8,
}

/// Payment request states.
pub mod request_status {
    pub const PENDING: u8 = 1;
    pub const PAID: u8 = 2;
    pub const DECLINED: u8 = 3;
}

impl AceEncode for RequestRecord {
    fn encode(&self, out: &mut AceWriter) {
        self.payee.encode(out);
        self.payer.encode(out);
        out.u128(self.amount);
        self.creditor_agent.encode(out);
        self.uetr_hash.encode(out);
        self.remittance_hash.encode(out);
        out.u64(self.expires_day);
        out.u8(self.status);
    }
}

impl AceDecode for RequestRecord {
    fn decode(input: &mut AceReader<'_>) -> Result<RequestRecord, AletheiaError> {
        Ok(RequestRecord {
            payee: Address::decode(input)?,
            payer: Address::decode(input)?,
            amount: input.u128()?,
            creditor_agent: Aic::decode(input)?,
            uetr_hash: Hash32::decode(input)?,
            remittance_hash: Hash32::decode(input)?,
            expires_day: input.u64()?,
            status: input.u8()?,
        })
    }
}

/// A direct-debit mandate (namespace 103, key the mandate id). Expiry is computed from
/// `final_day`, never stored.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MandateRecord {
    pub debtor: Address,
    pub creditor: Address,
    pub debtor_agent: Aic,
    pub creditor_agent: Aic,
    pub max_amount: u128,
    pub frequency: u8,
    pub first_day: u64,
    pub final_day: u64,
    pub status: u8,
    pub created_tx: Hash32,
    pub last_debit_day: Option<u64>,
    pub debits: u64,
}

/// Mandate states.
pub mod mandate_status {
    pub const ACTIVE: u8 = 1;
    pub const SUSPENDED: u8 = 2;
    pub const CANCELLED: u8 = 3;
}

impl AceEncode for MandateRecord {
    fn encode(&self, out: &mut AceWriter) {
        self.debtor.encode(out);
        self.creditor.encode(out);
        self.debtor_agent.encode(out);
        self.creditor_agent.encode(out);
        out.u128(self.max_amount);
        out.u8(self.frequency);
        out.u64(self.first_day);
        out.u64(self.final_day);
        out.u8(self.status);
        self.created_tx.encode(out);
        out.option(self.last_debit_day.as_ref());
        out.u64(self.debits);
    }
}

impl AceDecode for MandateRecord {
    fn decode(input: &mut AceReader<'_>) -> Result<MandateRecord, AletheiaError> {
        Ok(MandateRecord {
            debtor: Address::decode(input)?,
            creditor: Address::decode(input)?,
            debtor_agent: Aic::decode(input)?,
            creditor_agent: Aic::decode(input)?,
            max_amount: input.u128()?,
            frequency: input.u8()?,
            first_day: input.u64()?,
            final_day: input.u64()?,
            status: input.u8()?,
            created_tx: Hash32::decode(input)?,
            last_debit_day: input.option()?,
            debits: input.u64()?,
        })
    }
}

/// The calendar period a day falls in for a mandate frequency: debits in one period are
/// limited to one. `None` for frequencies with no period (once, on demand).
pub fn period(frequency: u8, day: u64) -> Option<u64> {
    use aletheia_core::apn::frequency;
    // Days since 1970-01-01 (a Thursday) to the civil date (H. Hinnant's algorithm).
    let civil = |day: u64| -> (u64, u64) {
        let z = day.saturating_add(719_468);
        let era = z / 146_097;
        let doe = z.saturating_sub(era.saturating_mul(146_097));
        let yoe = doe
            .saturating_sub(doe / 1_460)
            .saturating_add(doe / 36_524)
            .saturating_sub(doe / 146_096)
            / 365;
        let doy = doe.saturating_sub(
            yoe.saturating_mul(365)
                .saturating_add(yoe / 4)
                .saturating_sub(yoe / 100),
        );
        let mp = doy.saturating_mul(5).saturating_add(2) / 153;
        let month = if mp < 10 {
            mp.saturating_add(3)
        } else {
            mp.saturating_sub(9)
        };
        let year = yoe
            .saturating_add(era.saturating_mul(400))
            .saturating_add(u64::from(month <= 2));
        (year, month)
    };
    let (year, month) = civil(day);
    match frequency {
        // ISO weeks start on Monday; 1970-01-01 was a Thursday.
        frequency::WEEKLY => Some(day.saturating_add(3) / 7),
        frequency::MONTHLY => Some(year.saturating_mul(12).saturating_add(month)),
        frequency::QUARTERLY => Some(
            year.saturating_mul(4)
                .saturating_add(month.saturating_sub(1) / 3),
        ),
        frequency::YEARLY => Some(year),
        _ => None,
    }
}

impl Apn<'_> {
    pub fn request_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::PaymentRequests, &[&[0], id.as_bytes()])
    }

    pub fn request(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<RequestRecord>, AletheiaError> {
        self.get(view, &self.request_key(id), "payment request")
    }

    pub fn mandate_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::Mandates, &[id.as_bytes()])
    }

    pub fn mandate(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<MandateRecord>, AletheiaError> {
        self.get(view, &self.mandate_key(id), "mandate")
    }
}

/// A scheduled payment (namespace 104, key `(1, schedule id)`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScheduleRecord {
    pub debtor: Address,
    pub debtor_agent: Aic,
    pub leg: aletheia_core::apn::PaymentLeg,
    pub purpose: [u8; 4],
    pub execute_day: u64,
    pub status: u8,
    /// The error code it failed with, or 0.
    pub result_code: u32,
    /// The block that executed or failed it, or 0 while pending.
    pub executed_height: u64,
}

/// Scheduled payment states.
pub mod schedule_status {
    pub const PENDING: u8 = 1;
    pub const EXECUTED: u8 = 2;
    pub const FAILED: u8 = 3;
}

impl AceEncode for ScheduleRecord {
    fn encode(&self, out: &mut AceWriter) {
        self.debtor.encode(out);
        self.debtor_agent.encode(out);
        self.leg.encode(out);
        out.fixed(&self.purpose);
        out.u64(self.execute_day);
        out.u8(self.status);
        out.u32(self.result_code);
        out.u64(self.executed_height);
    }
}

impl AceDecode for ScheduleRecord {
    fn decode(input: &mut AceReader<'_>) -> Result<ScheduleRecord, AletheiaError> {
        Ok(ScheduleRecord {
            debtor: Address::decode(input)?,
            debtor_agent: Aic::decode(input)?,
            leg: aletheia_core::apn::PaymentLeg::decode(input)?,
            purpose: input.array()?,
            execute_day: input.u64()?,
            status: input.u8()?,
            result_code: input.u32()?,
            executed_height: input.u64()?,
        })
    }
}

/// Scheduled payments due on one day, in the order they were scheduled.
pub const MAX_SCHEDULED_PER_DAY: u32 = 1_000;

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DayQueue {
    pub ids: Vec<Hash32>,
}

impl AceEncode for DayQueue {
    fn encode(&self, out: &mut AceWriter) {
        out.list(&self.ids);
    }
}

impl AceDecode for DayQueue {
    fn decode(input: &mut AceReader<'_>) -> Result<DayQueue, AletheiaError> {
        Ok(DayQueue {
            ids: input.list(MAX_SCHEDULED_PER_DAY)?,
        })
    }
}

/// Where the end-of-block step resumes: the next day to process and the position in its
/// queue. Absent until the first payment is scheduled.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScheduleCursor {
    pub day: u64,
    pub index: u32,
}

impl AceEncode for ScheduleCursor {
    fn encode(&self, out: &mut AceWriter) {
        out.u64(self.day);
        out.u32(self.index);
    }
}

impl AceDecode for ScheduleCursor {
    fn decode(input: &mut AceReader<'_>) -> Result<ScheduleCursor, AletheiaError> {
        Ok(ScheduleCursor {
            day: input.u64()?,
            index: input.u32()?,
        })
    }
}

impl Apn<'_> {
    pub fn schedule_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::PaymentRequests, &[&[1], id.as_bytes()])
    }

    pub fn schedule(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<ScheduleRecord>, AletheiaError> {
        self.get(view, &self.schedule_key(id), "scheduled payment")
    }

    pub fn day_queue_key(&self, day: u64) -> StateKey {
        self.key(Namespace::PaymentRequests, &[&[2], &day.to_le_bytes()])
    }

    pub fn day_queue(&self, view: &dyn StateView, day: u64) -> Result<DayQueue, AletheiaError> {
        Ok(self
            .get(view, &self.day_queue_key(day), "scheduled-payment queue")?
            .unwrap_or_default())
    }

    pub fn cursor_key(&self) -> StateKey {
        self.key(Namespace::PaymentRequests, &[&[3]])
    }

    pub fn cursor(&self, view: &dyn StateView) -> Result<Option<ScheduleCursor>, AletheiaError> {
        self.get(view, &self.cursor_key(), "scheduled-payment cursor")
    }
}

/// An external-leg escrow (namespace 108, key `(0, leg id)`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EscrowRecord {
    /// The participant settlement account the AEY came from.
    pub sender: Address,
    pub sender_agent: Aic,
    pub gateway: Aic,
    pub amount: u128,
    pub uetr_hash: Hash32,
    pub rail: u16,
    pub profile_hash: Hash32,
    /// After this day the leg joins the gateway's investigation queue; it is never released
    /// by time alone (I15).
    pub expiry_day: u64,
    pub status: u8,
    pub locked_height: u64,
    /// The block that settled or released it, or 0 while locked.
    pub closed_height: u64,
}

/// Escrow states (I13: exactly one; only LOCKED → SETTLED or LOCKED → RELEASED).
pub mod escrow_status {
    pub const LOCKED: u8 = 1;
    pub const SETTLED: u8 = 2;
    pub const RELEASED: u8 = 3;
}

impl AceEncode for EscrowRecord {
    fn encode(&self, out: &mut AceWriter) {
        self.sender.encode(out);
        self.sender_agent.encode(out);
        self.gateway.encode(out);
        out.u128(self.amount);
        self.uetr_hash.encode(out);
        out.u16(self.rail);
        self.profile_hash.encode(out);
        out.u64(self.expiry_day);
        out.u8(self.status);
        out.u64(self.locked_height);
        out.u64(self.closed_height);
    }
}

impl AceDecode for EscrowRecord {
    fn decode(input: &mut AceReader<'_>) -> Result<EscrowRecord, AletheiaError> {
        Ok(EscrowRecord {
            sender: Address::decode(input)?,
            sender_agent: Aic::decode(input)?,
            gateway: Aic::decode(input)?,
            amount: input.u128()?,
            uetr_hash: Hash32::decode(input)?,
            rail: input.u16()?,
            profile_hash: Hash32::decode(input)?,
            expiry_day: input.u64()?,
            status: input.u8()?,
            locked_height: input.u64()?,
            closed_height: input.u64()?,
        })
    }
}

impl Apn<'_> {
    pub fn escrow_key(&self, leg_id: &Hash32) -> StateKey {
        self.key(Namespace::ExternalLegEscrow, &[&[0], leg_id.as_bytes()])
    }

    pub fn escrow(
        &self,
        view: &dyn StateView,
        leg_id: &Hash32,
    ) -> Result<Option<EscrowRecord>, AletheiaError> {
        self.get(view, &self.escrow_key(leg_id), "external-leg escrow")
    }

    /// Σ AEY in LOCKED escrows, kept so I14 is one comparison per block.
    pub fn escrow_total_key(&self) -> StateKey {
        self.key(Namespace::ExternalLegEscrow, &[&[1]])
    }

    pub fn escrow_total(&self, view: &dyn StateView) -> Result<u128, AletheiaError> {
        Ok(self
            .get(view, &self.escrow_total_key(), "escrow total")?
            .unwrap_or(0))
    }

    /// One inbound credit, unique per `(rail, uetr hash, message id hash, amount)`.
    pub fn inbound_key(
        &self,
        rail: u16,
        uetr_hash: &Hash32,
        msg_id_hash: &Hash32,
        amount: u128,
    ) -> StateKey {
        self.key(
            Namespace::ExternalLegEscrow,
            &[
                &[2],
                &rail.to_le_bytes(),
                uetr_hash.as_bytes(),
                msg_id_hash.as_bytes(),
                &amount.to_le_bytes(),
            ],
        )
    }

    /// AEY minted so far under a standing authorization.
    pub fn standing_used_key(&self, authorization_id: &Hash32) -> StateKey {
        self.key(
            Namespace::ExternalLegEscrow,
            &[&[3], authorization_id.as_bytes()],
        )
    }

    pub fn standing_used(
        &self,
        view: &dyn StateView,
        authorization_id: &Hash32,
    ) -> Result<u128, AletheiaError> {
        Ok(self
            .get(
                view,
                &self.standing_used_key(authorization_id),
                "standing authorization usage",
            )?
            .unwrap_or(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aletheia_core::apn::frequency;

    #[test]
    fn periods_follow_the_calendar() {
        // 2026-01-31 is day 20484, 2026-02-01 day 20485, 2026-03-31 day 20543,
        // 2026-04-01 day 20544, 2026-12-31 day 20818, 2027-01-01 day 20819.
        let month = |d| period(frequency::MONTHLY, d);
        assert_ne!(month(20_484), month(20_485));
        assert_eq!(month(20_485), month(20_485 + 27));
        let quarter = |d| period(frequency::QUARTERLY, d);
        assert_eq!(quarter(20_485), quarter(20_543));
        assert_ne!(quarter(20_543), quarter(20_544));
        let year = |d| period(frequency::YEARLY, d);
        assert_eq!(year(20_819), Some(2027));
        assert_eq!(year(20_818), Some(2026));
        // 2026-10-05 (day 20731) is a Monday; the Sunday before is another week.
        let week = |d| period(frequency::WEEKLY, d);
        assert_eq!(week(20_731), week(20_737));
        assert_ne!(week(20_730), week(20_731));
        assert_eq!(period(frequency::ON_DEMAND, 20_731), None);
    }
}
