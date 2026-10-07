//! Receipts and events (spec Sections 38, 39, APS-0031, APS-0032).
//!
//! ```text
//! Receipt = tx_id Hash32 | height u64 | index_in_block u32 | status u8 | error_code u32
//!         | eu_used u64 | fee_asset u32 | fee_amount u128 | write_set_hash Hash32
//!         | events list<Event> (<= 256) | return_data bytes (<= 4 KiB)
//! Event   = emitter Address | event_type Hash32 | topics list<Hash32> (<= 4) | data bytes (<= 8 KiB)
//! receipt_hash = H_domain("ALETHEIA/RECEIPT/v1", ace(Receipt))
//! event_hash   = H_domain("ALETHEIA/EVENT/v1", ace(Event))
//! ```
//!
//! Receipts carry no timestamps and no node-local data: every field is recomputed identically
//! by every validator. Only the error *code* enters a receipt, never its human detail.

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, Address, AletheiaError, AssetId, DomainTag,
    ErrorCode, Hash32, NetworkIdentity,
};

pub const MAX_EVENTS_PER_TX: u32 = 256;
pub const MAX_TOPICS: u32 = 4;
pub const MAX_EVENT_DATA: u32 = 8 * 1024;
pub const MAX_RETURN_DATA: u32 = 4 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReceiptStatus {
    Success,
    FailedExecution,
    FailedVmTrap,
    OutOfEu,
}

impl ReceiptStatus {
    pub const fn code(self) -> u8 {
        match self {
            ReceiptStatus::Success => 1,
            ReceiptStatus::FailedExecution => 2,
            ReceiptStatus::FailedVmTrap => 3,
            ReceiptStatus::OutOfEu => 4,
        }
    }

    fn from_code(code: u8) -> Option<ReceiptStatus> {
        match code {
            1 => Some(ReceiptStatus::Success),
            2 => Some(ReceiptStatus::FailedExecution),
            3 => Some(ReceiptStatus::FailedVmTrap),
            4 => Some(ReceiptStatus::OutOfEu),
            _ => None,
        }
    }
}

/// `event_type = BLAKE3(schema name)`: constant across networks so indexers can match it.
pub fn event_type(schema: &str) -> Hash32 {
    Hash32::from_bytes(*blake3::hash(schema.as_bytes()).as_bytes())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Event {
    pub emitter: Address,
    pub event_type: Hash32,
    pub topics: Vec<Hash32>,
    pub data: Vec<u8>,
}

impl Event {
    pub fn hash(&self, network: &NetworkIdentity) -> Hash32 {
        network.domain_hash(DomainTag::Event, &self.to_ace_bytes())
    }
}

impl AceEncode for Event {
    fn encode(&self, out: &mut AceWriter) {
        self.emitter.encode(out);
        self.event_type.encode(out);
        out.list(&self.topics);
        out.bytes(&self.data);
    }
}

impl AceDecode for Event {
    fn decode(input: &mut AceReader<'_>) -> Result<Event, AletheiaError> {
        Ok(Event {
            emitter: Address::decode(input)?,
            event_type: Hash32::decode(input)?,
            topics: input.list(MAX_TOPICS)?,
            data: input.bytes(MAX_EVENT_DATA)?.to_vec(),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Receipt {
    pub tx_id: Hash32,
    pub height: u64,
    pub index_in_block: u32,
    pub status: ReceiptStatus,
    /// 0 on success.
    pub error_code: u32,
    pub eu_used: u64,
    pub fee_asset: AssetId,
    pub fee_amount: u128,
    pub write_set_hash: Hash32,
    pub events: Vec<Event>,
    pub return_data: Vec<u8>,
}

impl Receipt {
    pub fn hash(&self, network: &NetworkIdentity) -> Hash32 {
        network.domain_hash(DomainTag::Receipt, &self.to_ace_bytes())
    }

    pub fn error(&self) -> Option<ErrorCode> {
        ErrorCode::from_code(self.error_code)
    }
}

impl AceEncode for Receipt {
    fn encode(&self, out: &mut AceWriter) {
        self.tx_id.encode(out);
        out.u64(self.height);
        out.u32(self.index_in_block);
        out.u8(self.status.code());
        out.u32(self.error_code);
        out.u64(self.eu_used);
        self.fee_asset.encode(out);
        out.u128(self.fee_amount);
        self.write_set_hash.encode(out);
        out.list(&self.events);
        out.bytes(&self.return_data);
    }
}

impl AceDecode for Receipt {
    fn decode(input: &mut AceReader<'_>) -> Result<Receipt, AletheiaError> {
        let tx_id = Hash32::decode(input)?;
        let height = input.u64()?;
        let index_in_block = input.u32()?;
        let offset = input.position();
        let status_code = input.u8()?;
        let status = ReceiptStatus::from_code(status_code).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!("receipt status {status_code} at offset {offset}"),
            )
        })?;
        Ok(Receipt {
            tx_id,
            height,
            index_in_block,
            status,
            error_code: input.u32()?,
            eu_used: input.u64()?,
            fee_asset: AssetId::decode(input)?,
            fee_amount: input.u128()?,
            write_set_hash: Hash32::decode(input)?,
            events: input.list(MAX_EVENTS_PER_TX)?,
            return_data: input.bytes(MAX_RETURN_DATA)?.to_vec(),
        })
    }
}
