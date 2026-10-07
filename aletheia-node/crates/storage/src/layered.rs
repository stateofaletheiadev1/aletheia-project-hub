//! A read-only view of a store with uncommitted write batches laid over it.
//!
//! Consensus executes a block on its parent's state before the parent is final (spec Section
//! 19.3, speculative execution). The parent's JMT nodes and values exist only in the write
//! batch its execution produced, so the child reads through `base` + the batches of every
//! uncommitted ancestor, oldest first: a key written by a later layer shadows the same key in
//! an earlier layer or the base, exactly as committing the batches in order would.
//!
//! Writes are refused. A speculative result reaches disk only by being re-applied to the real
//! store when its block is finalized.

use aletheia_core::{AletheiaError, ErrorCode};

use crate::kv::{ColumnFamily, KvPairs, KvSnapshot, KvStore, WriteBatch, WriteOp};

pub struct LayeredStore<'a> {
    base: &'a dyn KvStore,
    /// Oldest first.
    layers: Vec<&'a WriteBatch>,
}

impl core::fmt::Debug for LayeredStore<'_> {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("LayeredStore")
            .field("layers", &self.layers.len())
            .finish_non_exhaustive()
    }
}

fn read_only() -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoIo,
        "a layered (speculative) store is read-only".to_owned(),
    )
}

impl<'a> LayeredStore<'a> {
    pub fn new(base: &'a dyn KvStore, layers: Vec<&'a WriteBatch>) -> LayeredStore<'a> {
        LayeredStore { base, layers }
    }

    /// The newest layered write to `key`: `Some(Some(value))` put, `Some(None)` deleted,
    /// `None` untouched by every layer.
    fn layered(&self, cf: ColumnFamily, key: &[u8]) -> Option<Option<&'a [u8]>> {
        self.layers.iter().rev().find_map(|batch| {
            batch.ops().iter().rev().find_map(|op| match op {
                WriteOp::Put {
                    cf: c,
                    key: k,
                    value,
                } if *c == cf && k == key => Some(Some(value.as_slice())),
                WriteOp::Delete { cf: c, key: k } if *c == cf && k == key => Some(None),
                _ => None,
            })
        })
    }
}

impl KvStore for LayeredStore<'_> {
    fn get(&self, cf: ColumnFamily, key: &[u8]) -> Result<Option<Vec<u8>>, AletheiaError> {
        match self.layered(cf, key) {
            Some(value) => Ok(value.map(<[u8]>::to_vec)),
            None => self.base.get(cf, key),
        }
    }

    fn range(
        &self,
        cf: ColumnFamily,
        from: &[u8],
        to: &[u8],
        limit: usize,
    ) -> Result<KvPairs, AletheiaError> {
        // Replay the layers' writes in the range over the base's answer. Every delete can hide
        // one base row, so ask the base for that many more to still fill `limit`.
        let mut writes: std::collections::BTreeMap<&[u8], Option<&[u8]>> =
            std::collections::BTreeMap::new();
        for batch in &self.layers {
            for op in batch.ops() {
                match op {
                    WriteOp::Put { cf: c, key, value }
                        if *c == cf && key.as_slice() >= from && key.as_slice() < to =>
                    {
                        writes.insert(key, Some(value));
                    }
                    WriteOp::Delete { cf: c, key }
                        if *c == cf && key.as_slice() >= from && key.as_slice() < to =>
                    {
                        writes.insert(key, None);
                    }
                    _ => {}
                }
            }
        }
        let hidden = writes.values().filter(|value| value.is_none()).count();
        let base = self
            .base
            .range(cf, from, to, limit.saturating_add(hidden))?;
        let base_complete = base.len() < limit.saturating_add(hidden);
        let mut merged: std::collections::BTreeMap<Vec<u8>, Vec<u8>> = base.into_iter().collect();
        // When the base answer was cut off, rows past its last key are unknown: only layered
        // keys up to that point may join, or a later base row could be skipped.
        let horizon = (!base_complete)
            .then(|| merged.keys().next_back().cloned())
            .flatten();
        for (key, value) in writes {
            if horizon.as_deref().is_some_and(|last| key > last) {
                continue;
            }
            match value {
                Some(value) => {
                    merged.insert(key.to_vec(), value.to_vec());
                }
                None => {
                    merged.remove(key);
                }
            }
        }
        Ok(merged.into_iter().take(limit).collect())
    }

    fn write_sync(&self, _batch: WriteBatch) -> Result<(), AletheiaError> {
        Err(read_only())
    }

    fn write(&self, _batch: WriteBatch) -> Result<(), AletheiaError> {
        Err(read_only())
    }

    fn snapshot(&self) -> Result<Box<dyn KvSnapshot + '_>, AletheiaError> {
        Err(read_only())
    }

    fn checkpoint(&self, _dir: &std::path::Path) -> Result<(), AletheiaError> {
        Err(read_only())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory::MemoryKvStore;

    const CF: ColumnFamily = ColumnFamily::StateValues;

    fn base() -> MemoryKvStore {
        let store = MemoryKvStore::new();
        let mut batch = WriteBatch::new();
        for key in [b"a", b"c", b"e", b"g"] {
            batch.put(CF, key, b"base");
        }
        store.write_sync(batch).unwrap();
        store
    }

    /// The layered view must equal the base with the batches committed in order.
    fn committed(layers: &[&WriteBatch]) -> MemoryKvStore {
        let store = base();
        for layer in layers {
            store.write_sync((*layer).clone()).unwrap();
        }
        store
    }

    fn layers() -> (WriteBatch, WriteBatch) {
        let mut first = WriteBatch::new();
        first.put(CF, b"b", b"one");
        first.put(CF, b"c", b"one");
        first.delete(CF, b"e");
        let mut second = WriteBatch::new();
        second.put(CF, b"c", b"two");
        second.put(CF, b"e", b"two");
        second.delete(CF, b"a");
        second.put(CF, b"h", b"two");
        (first, second)
    }

    #[test]
    fn reads_match_committing_the_layers_in_order() {
        let store = base();
        let (first, second) = layers();
        for stack in [vec![], vec![&first], vec![&first, &second]] {
            let layered = LayeredStore::new(&store, stack.clone());
            let expected = committed(&stack);
            for key in [b"a", b"b", b"c", b"d", b"e", b"g", b"h"] {
                assert_eq!(
                    layered.get(CF, key).unwrap(),
                    expected.get(CF, key).unwrap(),
                    "{key:?}"
                );
            }
            for limit in 0..10 {
                for (from, to) in [(&b"a"[..], &b"z"[..]), (b"b", b"f"), (b"d", b"e")] {
                    assert_eq!(
                        layered.range(CF, from, to, limit).unwrap(),
                        expected.range(CF, from, to, limit).unwrap(),
                        "limit {limit} range {from:?}..{to:?}"
                    );
                }
            }
        }
    }

    #[test]
    fn other_column_families_are_untouched() {
        let store = base();
        let (first, _) = layers();
        let layered = LayeredStore::new(&store, vec![&first]);
        assert_eq!(layered.get(ColumnFamily::JmtNodes, b"b").unwrap(), None);
    }

    #[test]
    fn writes_are_refused() {
        let store = base();
        let layered = LayeredStore::new(&store, Vec::new());
        assert!(layered.write_sync(WriteBatch::new()).is_err());
        assert!(layered.write(WriteBatch::new()).is_err());
    }
}
