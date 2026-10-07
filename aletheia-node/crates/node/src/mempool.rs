//! The mempool (spec Section 21). Not consensus state: validators never assume others share
//! its contents.
//!
//! - Admission happens before insertion (stateless validation and a nonce floor, checked by
//!   the chain thread against the tip).
//! - Per sender, transactions are kept by nonce; the block builder takes the contiguous run
//!   from the sender's next nonce.
//! - Duplicates are detected by `tx_id`. Replacing the same `(sender, nonce)` needs a max-fee
//!   bump of at least 10 %.
//! - Bounded in bytes and per sender; expired transactions are removed first.

use std::collections::BTreeMap;

use aletheia_core::{
    AceEncode, Address, AletheiaError, ErrorCode, Hash32, SignedTransaction, Slot,
};
use aletheia_execution::VerifiedTransaction;

use crate::channels::{
    MEMPOOL_MAX_BYTES, MEMPOOL_MAX_PER_SENDER, MEMPOOL_REPLACEMENT_BUMP_PERCENT,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Admitted {
    New,
    Replaced,
    AlreadyKnown,
}

#[derive(Debug, Default)]
pub struct Mempool {
    by_id: BTreeMap<Hash32, VerifiedTransaction>,
    by_sender: BTreeMap<Address, BTreeMap<u64, Hash32>>,
    bytes: usize,
}

fn rejected(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::TxFieldOutOfRange, format!("mempool: {detail}"))
}

impl Mempool {
    pub fn new() -> Mempool {
        Mempool::default()
    }

    pub fn len(&self) -> usize {
        self.by_id.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_id.is_empty()
    }

    pub fn bytes(&self) -> usize {
        self.bytes
    }

    pub fn contains(&self, tx_id: &Hash32) -> bool {
        self.by_id.contains_key(tx_id)
    }

    pub fn get(&self, tx_id: &Hash32) -> Option<&SignedTransaction> {
        self.by_id.get(tx_id).map(VerifiedTransaction::transaction)
    }

    pub fn insert(&mut self, tx: VerifiedTransaction) -> Result<Admitted, AletheiaError> {
        let id = tx.tx_id().hash();
        if self.by_id.contains_key(&id) {
            return Ok(Admitted::AlreadyKnown);
        }
        let body = &tx.transaction().body;
        let (sender, nonce, max_fee) = (body.sender, body.nonce, body.fee.max_fee);
        let queue_len = self.by_sender.get(&sender).map_or(0, BTreeMap::len);
        let existing = self
            .by_sender
            .get(&sender)
            .and_then(|queue| queue.get(&nonce))
            .copied();
        match existing {
            Some(old_id) => {
                let old_fee = self
                    .by_id
                    .get(&old_id)
                    .map_or(0, |old| old.transaction().body.fee.max_fee);
                let required = old_fee
                    .saturating_add(old_fee.saturating_mul(MEMPOOL_REPLACEMENT_BUMP_PERCENT) / 100);
                if max_fee < required {
                    return Err(rejected(format!(
                        "replacing nonce {nonce} needs max_fee >= {required}, got {max_fee}"
                    )));
                }
                self.remove(&old_id);
            }
            None if queue_len >= MEMPOOL_MAX_PER_SENDER => {
                return Err(rejected(format!(
                    "sender already has {MEMPOOL_MAX_PER_SENDER} pending transactions"
                )));
            }
            None => {}
        }
        if self.bytes.saturating_add(tx.encoded_len()) > MEMPOOL_MAX_BYTES {
            return Err(rejected(format!("full at {} bytes", self.bytes)));
        }
        self.bytes = self.bytes.saturating_add(tx.encoded_len());
        self.by_sender.entry(sender).or_default().insert(nonce, id);
        self.by_id.insert(id, tx);
        Ok(if existing.is_some() {
            Admitted::Replaced
        } else {
            Admitted::New
        })
    }

    fn remove(&mut self, id: &Hash32) {
        let Some(tx) = self.by_id.remove(id) else {
            return;
        };
        self.bytes = self.bytes.saturating_sub(tx.encoded_len());
        let body = &tx.transaction().body;
        if let Some(queue) = self.by_sender.get_mut(&body.sender) {
            queue.remove(&body.nonce);
            if queue.is_empty() {
                self.by_sender.remove(&body.sender);
            }
        }
    }

    /// Candidates for the next block, sender by sender in nonce order, at most `limit`.
    pub fn candidates(&self, limit: usize) -> Vec<VerifiedTransaction> {
        self.by_sender
            .values()
            .flat_map(|queue| queue.values())
            .filter_map(|id| self.by_id.get(id).cloned())
            .take(limit)
            .collect()
    }

    /// Drops what a finalized block included and anything below each sender's new next nonce.
    pub fn remove_finalized(
        &mut self,
        included: &[SignedTransaction],
        next_nonces: &BTreeMap<Address, u64>,
    ) {
        for tx in included {
            if let Some(id) = self
                .by_sender
                .get(&tx.body.sender)
                .and_then(|queue| queue.get(&tx.body.nonce))
                .copied()
            {
                self.remove(&id);
            }
        }
        for (sender, next) in next_nonces {
            let stale: Vec<Hash32> = self
                .by_sender
                .get(sender)
                .map(|queue| queue.range(..next).map(|(_, id)| *id).collect())
                .unwrap_or_default();
            stale.iter().for_each(|id| self.remove(id));
        }
    }

    /// Drops transactions whose expiry slot is before `slot` (eviction order, Section 21).
    pub fn expire(&mut self, slot: Slot) -> usize {
        let expired: Vec<Hash32> = self
            .by_id
            .iter()
            .filter(|(_, tx)| tx.transaction().body.expiry_slot < slot)
            .map(|(id, _)| *id)
            .collect();
        expired.iter().for_each(|id| self.remove(id));
        expired.len()
    }

    /// Bodies for the requested ids we hold, up to `max_bytes` encoded.
    pub fn bodies(&self, ids: &[Hash32], max_bytes: usize) -> Vec<SignedTransaction> {
        let mut out = Vec::new();
        let mut used = 0usize;
        for tx in ids.iter().filter_map(|id| self.get(id)) {
            let size = tx.to_ace_bytes().len();
            if used.saturating_add(size) > max_bytes {
                break;
            }
            used = used.saturating_add(size);
            out.push(tx.clone());
        }
        out
    }
}
