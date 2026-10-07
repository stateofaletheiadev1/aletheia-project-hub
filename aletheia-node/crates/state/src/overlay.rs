//! Copy-on-write state for one block (spec Section 15).
//!
//! Reads fall through: this overlay → parent overlays (speculative/prepared) → committed JMT.
//! Writes stay here until the block is finalized and [`StateOverlay::changes`] flattens them
//! into one batch. `BTreeMap` keeps keys sorted so flattening and hashing never depend on
//! insertion order.

use std::collections::BTreeMap;

use aletheia_core::{AletheiaError, ErrorCode};

use crate::key::{StateKey, StateValue};

pub trait StateView {
    fn get(&self, key: &StateKey) -> Result<Option<StateValue>, AletheiaError>;
}

/// A journal entry: the key and what `writes` held for it before the write (`None` = the key
/// was not in this overlay at all).
type JournalEntry = (StateKey, Option<Option<StateValue>>);

pub struct StateOverlay<'p> {
    base: &'p dyn StateView,
    writes: BTreeMap<StateKey, Option<StateValue>>, // None = deleted
    checkpoints: Vec<usize>,                        // journal lengths for tx-level revert
    journal: Vec<JournalEntry>,
}

impl core::fmt::Debug for StateOverlay<'_> {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("StateOverlay")
            .field("writes", &self.writes.len())
            .field("checkpoints", &self.checkpoints.len())
            .finish_non_exhaustive()
    }
}

impl<'p> StateOverlay<'p> {
    pub fn new(base: &'p dyn StateView) -> StateOverlay<'p> {
        StateOverlay {
            base,
            writes: BTreeMap::new(),
            checkpoints: Vec::new(),
            journal: Vec::new(),
        }
    }

    pub fn get(&self, key: &StateKey) -> Result<Option<StateValue>, AletheiaError> {
        match self.writes.get(key) {
            Some(value) => Ok(value.clone()),
            None => self.base.get(key),
        }
    }

    pub fn put(&mut self, key: StateKey, value: StateValue) {
        let previous = self.writes.insert(key, Some(value));
        self.journal.push((key, previous));
    }

    pub fn delete(&mut self, key: StateKey) {
        let previous = self.writes.insert(key, None);
        self.journal.push((key, previous));
    }

    /// Marks the start of a transaction. A trap reverts to here; fees are charged after.
    pub fn checkpoint(&mut self) {
        self.checkpoints.push(self.journal.len());
    }

    pub fn revert_to_checkpoint(&mut self) -> Result<(), AletheiaError> {
        let mark = self.checkpoints.pop().ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::StateNoCheckpoint,
                "revert without checkpoint".to_owned(),
            )
        })?;
        while self.journal.len() > mark {
            if let Some((key, previous)) = self.journal.pop() {
                match previous {
                    Some(value) => {
                        self.writes.insert(key, value);
                    }
                    None => {
                        self.writes.remove(&key);
                    }
                }
            }
        }
        Ok(())
    }

    pub fn commit_checkpoint(&mut self) {
        self.checkpoints.pop();
    }

    /// A position in the write journal, for [`StateOverlay::changes_since`].
    pub fn mark(&self) -> usize {
        self.journal.len()
    }

    /// Keys written since `mark` with their current values, sorted and deduplicated: one
    /// transaction's write set (Section 38 `write_set_hash`).
    pub fn changes_since(&self, mark: usize) -> Vec<(StateKey, Option<StateValue>)> {
        let keys: std::collections::BTreeSet<StateKey> = self
            .journal
            .get(mark..)
            .unwrap_or_default()
            .iter()
            .map(|(key, _)| *key)
            .collect();
        keys.into_iter()
            .map(|key| (key, self.writes.get(&key).cloned().flatten()))
            .collect()
    }

    /// Sorted, deduplicated writes for the JMT update and the finalize batch.
    pub fn changes(&self) -> impl Iterator<Item = (&StateKey, Option<&StateValue>)> {
        self.writes.iter().map(|(k, v)| (k, v.as_ref()))
    }

    /// Owned form of [`StateOverlay::changes`], ready for `JellyfishMerkleTree::apply`.
    pub fn into_changes(self) -> Vec<(StateKey, Option<StateValue>)> {
        self.writes.into_iter().collect()
    }
}

impl StateView for StateOverlay<'_> {
    fn get(&self, key: &StateKey) -> Result<Option<StateValue>, AletheiaError> {
        StateOverlay::get(self, key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aletheia_core::Hash32;

    struct Committed(BTreeMap<StateKey, StateValue>);

    impl StateView for Committed {
        fn get(&self, key: &StateKey) -> Result<Option<StateValue>, AletheiaError> {
            Ok(self.0.get(key).cloned())
        }
    }

    fn key(n: u8) -> StateKey {
        StateKey::from_hash(Hash32::from_bytes([n; 32]))
    }

    fn base() -> Committed {
        Committed(BTreeMap::from([
            (key(1), b"one".to_vec()),
            (key(2), b"two".to_vec()),
        ]))
    }

    #[test]
    fn reads_fall_through_to_the_base() {
        let base = base();
        let mut overlay = StateOverlay::new(&base);
        overlay.put(key(1), b"uno".to_vec());
        overlay.delete(key(2));
        assert_eq!(overlay.get(&key(1)).unwrap().as_deref(), Some(&b"uno"[..]));
        assert_eq!(overlay.get(&key(2)).unwrap(), None);
        assert_eq!(overlay.get(&key(3)).unwrap(), None);
    }

    #[test]
    fn revert_restores_exactly_the_state_at_the_checkpoint() {
        let base = base();
        let mut overlay = StateOverlay::new(&base);
        overlay.put(key(3), b"kept".to_vec());
        overlay.checkpoint();
        overlay.put(key(3), b"trapped".to_vec());
        overlay.put(key(4), b"new".to_vec());
        overlay.delete(key(1));
        overlay.revert_to_checkpoint().unwrap();
        assert_eq!(overlay.get(&key(3)).unwrap().as_deref(), Some(&b"kept"[..]));
        assert_eq!(overlay.get(&key(4)).unwrap(), None);
        assert_eq!(overlay.get(&key(1)).unwrap().as_deref(), Some(&b"one"[..]));
        assert_eq!(overlay.changes().count(), 1);
    }

    #[test]
    fn nested_checkpoints_unwind_innermost_first() {
        let base = base();
        let mut overlay = StateOverlay::new(&base);
        overlay.checkpoint();
        overlay.put(key(5), b"outer".to_vec());
        overlay.checkpoint();
        overlay.put(key(5), b"inner".to_vec());
        overlay.revert_to_checkpoint().unwrap();
        assert_eq!(
            overlay.get(&key(5)).unwrap().as_deref(),
            Some(&b"outer"[..])
        );
        overlay.commit_checkpoint();
        assert_eq!(
            overlay.get(&key(5)).unwrap().as_deref(),
            Some(&b"outer"[..])
        );
    }

    #[test]
    fn revert_without_checkpoint_is_a_fail_stop_error() {
        let base = base();
        let mut overlay = StateOverlay::new(&base);
        let error = overlay.revert_to_checkpoint().unwrap_err();
        assert_eq!(error.code(), ErrorCode::StateNoCheckpoint);
        assert!(error.is_fail_stop());
    }

    #[test]
    fn changes_are_sorted_regardless_of_write_order() {
        let base = base();
        let mut overlay = StateOverlay::new(&base);
        for n in [9, 3, 7, 1] {
            overlay.put(key(n), vec![n]);
        }
        let order: Vec<u8> = overlay.changes().map(|(k, _)| k.as_bytes()[0]).collect();
        assert_eq!(order, [1, 3, 7, 9]);
    }

    #[test]
    fn overlays_stack_on_overlays() {
        let base = base();
        let mut parent = StateOverlay::new(&base);
        parent.put(key(1), b"parent".to_vec());
        let mut child = StateOverlay::new(&parent);
        child.put(key(2), b"child".to_vec());
        assert_eq!(child.get(&key(1)).unwrap().as_deref(), Some(&b"parent"[..]));
        assert_eq!(child.get(&key(2)).unwrap().as_deref(), Some(&b"child"[..]));
    }
}
