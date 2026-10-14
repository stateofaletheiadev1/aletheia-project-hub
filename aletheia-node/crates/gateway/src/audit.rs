//! The gateway audit ledger (Section 40): one append-only record per message per stage,
//! hash-chained so that changing, removing or reordering any record breaks every hash after
//! it. `record_hash = SHA-256(prev_hash ‖ canonical row fields)`; a record is unique by
//! `(counterparty, msg_id, stage)`.
//!
//! Storage is a trait: production keeps the rows in PostgreSQL with `UPDATE` and `DELETE`
//! revoked; tests and the rail simulator use the in-memory store here.

use sha2::{Digest, Sha256};

/// Where a message is in the pipeline.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Stage {
    Received,
    Validated,
    Screened,
    Held,
    Mapped,
    Submitted,
    Emitted,
    Investigating,
    Settled,
    Released,
    Finalized,
    Rejected,
}

impl Stage {
    pub const fn name(self) -> &'static str {
        match self {
            Stage::Received => "RECEIVED",
            Stage::Validated => "VALIDATED",
            Stage::Screened => "SCREENED",
            Stage::Held => "HELD",
            Stage::Mapped => "MAPPED",
            Stage::Submitted => "SUBMITTED",
            Stage::Emitted => "EMITTED",
            Stage::Investigating => "INVESTIGATING",
            Stage::Settled => "SETTLED",
            Stage::Released => "RELEASED",
            Stage::Finalized => "FINALIZED",
            Stage::Rejected => "REJECTED",
        }
    }
}

/// What a caller appends.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditEntry {
    pub occurred_at: String,
    pub counterparty: String,
    /// e.g. `pacs.008.001.08`.
    pub msg_type: String,
    pub msg_id: String,
    pub end_to_end_id: Option<String>,
    pub stage: Stage,
    /// `alt:T…` once submitted.
    pub tx_id: Option<String>,
    /// The rail profile in force, by content hash.
    pub profile_hash: [u8; 32],
    /// What happened, e.g. the reason code and field of a rejection.
    pub note: String,
    /// The original message bytes.
    pub payload: Vec<u8>,
}

/// One stored row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditRecord {
    pub seq: u64,
    pub entry: AuditEntry,
    pub payload_sha256: [u8; 32],
    pub prev_hash: [u8; 32],
    pub record_hash: [u8; 32],
}

fn put(hasher: &mut Sha256, field: &[u8]) {
    hasher.update(u64::try_from(field.len()).unwrap_or(u64::MAX).to_be_bytes());
    hasher.update(field);
}

/// The record hash over the previous hash and the canonical row fields (each length-prefixed,
/// so no two rows encode alike).
pub fn record_hash(
    seq: u64,
    entry: &AuditEntry,
    payload_sha256: &[u8; 32],
    prev_hash: &[u8; 32],
) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(prev_hash);
    hasher.update(seq.to_be_bytes());
    put(&mut hasher, entry.occurred_at.as_bytes());
    put(&mut hasher, entry.counterparty.as_bytes());
    put(&mut hasher, entry.msg_type.as_bytes());
    put(&mut hasher, entry.msg_id.as_bytes());
    put(
        &mut hasher,
        entry.end_to_end_id.as_deref().unwrap_or("").as_bytes(),
    );
    put(&mut hasher, entry.stage.name().as_bytes());
    put(&mut hasher, entry.tx_id.as_deref().unwrap_or("").as_bytes());
    put(&mut hasher, &entry.profile_hash);
    put(&mut hasher, entry.note.as_bytes());
    put(&mut hasher, payload_sha256);
    hasher.finalize().into()
}

/// Why an append or a chain check failed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuditError {
    /// `(counterparty, msg_id, stage)` is already recorded.
    Duplicate { seq: u64 },
    /// The chain does not verify from this record on.
    Broken { seq: u64, detail: String },
}

impl core::fmt::Display for AuditError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            AuditError::Duplicate { seq } => write!(f, "already recorded as record {seq}"),
            AuditError::Broken { seq, detail } => {
                write!(f, "the audit chain breaks at record {seq}: {detail}")
            }
        }
    }
}

impl std::error::Error for AuditError {}

/// Append-only row storage.
pub trait AuditStore {
    fn last(&self) -> Option<&AuditRecord>;
    fn find(&self, counterparty: &str, msg_id: &str, stage: Stage) -> Option<&AuditRecord>;
    fn append(&mut self, record: AuditRecord);
    fn records(&self) -> &[AuditRecord];
}

#[derive(Debug, Clone, Default)]
pub struct MemoryAuditStore {
    rows: Vec<AuditRecord>,
}

impl MemoryAuditStore {
    /// Test access for tamper tests only: production storage has no such method.
    pub fn rows_mut_for_tests(&mut self) -> &mut Vec<AuditRecord> {
        &mut self.rows
    }
}

impl AuditStore for MemoryAuditStore {
    fn last(&self) -> Option<&AuditRecord> {
        self.rows.last()
    }

    fn find(&self, counterparty: &str, msg_id: &str, stage: Stage) -> Option<&AuditRecord> {
        self.rows.iter().find(|r| {
            r.entry.counterparty == counterparty
                && r.entry.msg_id == msg_id
                && r.entry.stage == stage
        })
    }

    fn append(&mut self, record: AuditRecord) {
        self.rows.push(record);
    }

    fn records(&self) -> &[AuditRecord] {
        &self.rows
    }
}

/// The ledger over a store.
#[derive(Debug, Clone, Default)]
pub struct AuditLedger<S: AuditStore> {
    store: S,
}

impl<S: AuditStore> AuditLedger<S> {
    pub fn new(store: S) -> AuditLedger<S> {
        AuditLedger { store }
    }

    /// Appends a record chained to the last one. A second record for the same
    /// `(counterparty, msg_id, stage)` is refused.
    pub fn append(&mut self, entry: AuditEntry) -> Result<&AuditRecord, AuditError> {
        if let Some(existing) = self
            .store
            .find(&entry.counterparty, &entry.msg_id, entry.stage)
        {
            return Err(AuditError::Duplicate { seq: existing.seq });
        }
        let (seq, prev_hash) = self
            .store
            .last()
            .map_or((1, [0u8; 32]), |r| (r.seq.saturating_add(1), r.record_hash));
        let payload_sha256: [u8; 32] = Sha256::digest(&entry.payload).into();
        let hash = record_hash(seq, &entry, &payload_sha256, &prev_hash);
        self.store.append(AuditRecord {
            seq,
            entry,
            payload_sha256,
            prev_hash,
            record_hash: hash,
        });
        self.store.last().ok_or(AuditError::Broken {
            seq,
            detail: "the store did not keep the record".to_owned(),
        })
    }

    /// Recomputes every hash from the first record: sequence, links, payload digests and
    /// record hashes must all agree.
    pub fn verify(&self) -> Result<(), AuditError> {
        let mut prev = [0u8; 32];
        for (expected_seq, record) in (1u64..).zip(self.store.records()) {
            let broken = |detail: &str| AuditError::Broken {
                seq: record.seq,
                detail: detail.to_owned(),
            };
            if record.seq != expected_seq {
                return Err(broken("records are missing or out of order"));
            }
            if record.prev_hash != prev {
                return Err(broken("it does not link to the record before"));
            }
            let payload: [u8; 32] = Sha256::digest(&record.entry.payload).into();
            if payload != record.payload_sha256 {
                return Err(broken("the stored message does not match its digest"));
            }
            if record_hash(
                record.seq,
                &record.entry,
                &record.payload_sha256,
                &record.prev_hash,
            ) != record.record_hash
            {
                return Err(broken("its fields do not match its hash"));
            }
            prev = record.record_hash;
        }
        Ok(())
    }

    pub fn records(&self) -> &[AuditRecord] {
        self.store.records()
    }

    pub fn store_mut(&mut self) -> &mut S {
        &mut self.store
    }

    /// Every stage a message reached, in order.
    pub fn stages(&self, counterparty: &str, msg_id: &str) -> Vec<Stage> {
        self.store
            .records()
            .iter()
            .filter(|r| r.entry.counterparty == counterparty && r.entry.msg_id == msg_id)
            .map(|r| r.entry.stage)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(msg_id: &str, stage: Stage) -> AuditEntry {
        AuditEntry {
            occurred_at: "2026-10-05T09:30:00Z".to_owned(),
            counterparty: "COBADEFF".to_owned(),
            msg_type: "pacs.008.001.08".to_owned(),
            msg_id: msg_id.to_owned(),
            end_to_end_id: Some("E2E".to_owned()),
            stage,
            tx_id: None,
            profile_hash: [7; 32],
            note: String::new(),
            payload: b"<Document/>".to_vec(),
        }
    }

    fn ledger() -> AuditLedger<MemoryAuditStore> {
        let mut ledger = AuditLedger::new(MemoryAuditStore::default());
        for (id, stage) in [
            ("M1", Stage::Received),
            ("M1", Stage::Validated),
            ("M2", Stage::Received),
        ] {
            ledger.append(entry(id, stage)).unwrap();
        }
        ledger
    }

    #[test]
    fn records_chain_and_verify() {
        let ledger = ledger();
        ledger.verify().unwrap();
        let rows = ledger.records();
        assert_eq!(rows[1].prev_hash, rows[0].record_hash);
        assert_eq!(
            ledger.stages("COBADEFF", "M1"),
            [Stage::Received, Stage::Validated]
        );
    }

    #[test]
    fn one_record_per_message_and_stage() {
        let mut ledger = ledger();
        assert_eq!(
            ledger.append(entry("M1", Stage::Received)).unwrap_err(),
            AuditError::Duplicate { seq: 1 }
        );
    }

    #[test]
    fn any_edit_removal_or_reordering_is_detected() {
        let tamper = |edit: &dyn Fn(&mut Vec<AuditRecord>)| {
            let mut ledger = ledger();
            edit(ledger.store_mut().rows_mut_for_tests());
            assert!(matches!(ledger.verify(), Err(AuditError::Broken { .. })));
        };
        tamper(&|rows| rows[0].entry.note = "edited".to_owned());
        tamper(&|rows| rows[1].entry.payload = b"<Other/>".to_vec());
        tamper(&|rows| {
            rows.remove(1);
        });
        tamper(&|rows| rows.swap(1, 2));
        tamper(&|rows| rows[2].entry.stage = Stage::Rejected);
    }
}
