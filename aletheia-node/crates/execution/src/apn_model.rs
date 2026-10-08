//! APN state (spec Sections 15, 40B, 40D.5).
//!
//! ```text
//! 100 ApnParticipants  (0, aic) Participant   (1, settlement address) aic   (2, aic, day) DayTotals
//!                      (3, aic, address) [] : the participant serves this account
//! 101 AanMapping       aan → Mapping
//! 102 ProxyAliases     H(salt ‖ alias) → Mapping
//! 105 MessageAnchors   batch_id → AnchorEntry
//! 107 PaymentDedup     PaymentDedupKey → DedupEntry
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
