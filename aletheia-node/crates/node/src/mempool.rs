//! The mempool (spec Section 21). Not consensus state: validators never assume others share
//! its contents.
//!
//! - Admission happens before insertion (stateless validation and a nonce floor, checked by
//!   the chain thread against the tip).
//! - Per sender, transactions are kept by nonce; the block builder takes the contiguous run
//!   from the sender's next nonce.
//! - Duplicates are detected by `tx_id`. Replacing the same `(sender, nonce)` needs a max-fee
//!   bump of at least 10 %.
//! - Bounded in bytes and per sender; expired transactions are removed first. When full, a
//!   transaction may take the place of the lowest-fee one that is the last pending of another
//!   sender (so no sender is left with a nonce gap); otherwise it is refused.
//! - Block candidates are taken round-robin across senders, those whose next transaction
//!   pays the highest max fee first, so no sender's address decides its place.

use std::collections::{BTreeMap, BTreeSet};

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

#[derive(Debug)]
pub struct Mempool {
    by_id: BTreeMap<Hash32, VerifiedTransaction>,
    by_sender: BTreeMap<Address, BTreeMap<u64, Hash32>>,
    /// Every transaction by `(max_fee, tx_id)`, lowest first: the eviction order.
    by_fee: BTreeSet<(u128, Hash32)>,
    bytes: usize,
    max_bytes: usize,
}

impl Default for Mempool {
    fn default() -> Mempool {
        Mempool::with_max_bytes(default_max_bytes())
    }
}

/// The pool's byte budget: [`MEMPOOL_MAX_BYTES`], or a sixteenth of the memory the node may
/// use if that is less (at least 32 MiB), so a small VPS under a transaction flood keeps room
/// for everything else with or without swap. See [`crate::host::memory_limit_bytes`].
pub fn default_max_bytes() -> usize {
    const FLOOR: usize = 32 * 1024 * 1024;
    crate::host::memory_limit_bytes()
        .and_then(|bytes| usize::try_from(bytes).ok())
        .map_or(MEMPOOL_MAX_BYTES, |bytes| {
            (bytes / 16).clamp(FLOOR, MEMPOOL_MAX_BYTES)
        })
}

/// How many of the lowest-fee transactions are looked at for one that can be evicted.
const EVICTION_SCAN: usize = 1_024;

fn rejected(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::TxFieldOutOfRange, format!("mempool: {detail}"))
}

impl Mempool {
    pub fn new() -> Mempool {
        Mempool::default()
    }

    /// A pool holding at most `max_bytes` of encoded transactions (tests use a small one).
    pub fn with_max_bytes(max_bytes: usize) -> Mempool {
        Mempool {
            by_id: BTreeMap::new(),
            by_sender: BTreeMap::new(),
            by_fee: BTreeSet::new(),
            bytes: 0,
            max_bytes,
        }
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
        while self.bytes.saturating_add(tx.encoded_len()) > self.max_bytes {
            match self.eviction_candidate(&sender, max_fee) {
                Some(victim) => self.remove(&victim),
                None => return Err(rejected(format!("full at {} bytes", self.bytes))),
            }
        }
        self.bytes = self.bytes.saturating_add(tx.encoded_len());
        self.by_sender.entry(sender).or_default().insert(nonce, id);
        self.by_fee.insert((max_fee, id));
        self.by_id.insert(id, tx);
        Ok(if existing.is_some() {
            Admitted::Replaced
        } else {
            Admitted::New
        })
    }

    /// The lowest-fee transaction paying less than `max_fee` that is the last pending one of a
    /// sender other than `sender`: removing it leaves no nonce gap behind.
    fn eviction_candidate(&self, sender: &Address, max_fee: u128) -> Option<Hash32> {
        self.by_fee
            .iter()
            .take(EVICTION_SCAN)
            .take_while(|(fee, _)| *fee < max_fee)
            .map(|(_, id)| *id)
            .find(|id| {
                self.by_id.get(id).is_some_and(|tx| {
                    let body = &tx.transaction().body;
                    body.sender != *sender
                        && self
                            .by_sender
                            .get(&body.sender)
                            .and_then(|queue| queue.keys().next_back())
                            == Some(&body.nonce)
                })
            })
    }

    fn remove(&mut self, id: &Hash32) {
        let Some(tx) = self.by_id.remove(id) else {
            return;
        };
        self.bytes = self.bytes.saturating_sub(tx.encoded_len());
        self.by_fee
            .remove(&(tx.transaction().body.fee.max_fee, *id));
        let body = &tx.transaction().body;
        if let Some(queue) = self.by_sender.get_mut(&body.sender) {
            queue.remove(&body.nonce);
            if queue.is_empty() {
                self.by_sender.remove(&body.sender);
            }
        }
    }

    /// Candidates for the next block, at most `limit`: one transaction per sender per pass, in
    /// each sender's nonce order, senders whose next transaction pays the highest max fee
    /// first (ties by address, for a deterministic order).
    pub fn candidates(&self, limit: usize) -> Vec<VerifiedTransaction> {
        let head_fee = |queue: &BTreeMap<u64, Hash32>| {
            queue
                .values()
                .next()
                .and_then(|id| self.by_id.get(id))
                .map_or(0, |tx| tx.transaction().body.fee.max_fee)
        };
        let mut senders: Vec<&BTreeMap<u64, Hash32>> = self.by_sender.values().collect();
        senders.sort_by_key(|queue| core::cmp::Reverse(head_fee(queue)));
        let mut queues: Vec<_> = senders.into_iter().map(|q| q.values()).collect();
        let mut out = Vec::new();
        while out.len() < limit {
            let mut took = false;
            for queue in &mut queues {
                if out.len() >= limit {
                    break;
                }
                if let Some(tx) = queue.next().and_then(|id| self.by_id.get(id)) {
                    out.push(tx.clone());
                    took = true;
                }
            }
            if !took {
                break;
            }
        }
        out
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
