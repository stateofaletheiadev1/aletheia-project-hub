//! The consumer side (APS-0058 rules 3-5): drop what was already applied, stop on a gap, and
//! skip what it does not understand. The consumer commits its cursor together with the
//! effects it derives (a transactional inbox); this type holds that cursor.

use crate::kinds::EVENT_SCHEMA;
use crate::stream::{Cursor, Envelope};

/// What to do with an envelope.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    /// New and understood: apply it, then [`Consumer::commit`].
    Apply,
    /// At or before the committed cursor: a resend; ignore.
    Duplicate,
    /// Its `previous` is not what this consumer last saw: something was lost; reconnect
    /// from the committed cursor.
    Gap,
    /// An unknown kind or a newer schema: record it and move on.
    Skip,
}

#[derive(Debug, Clone, Default)]
pub struct Consumer {
    committed: Option<Cursor>,
    last_seen: Option<Cursor>,
    /// Kinds this consumer understands.
    known: Vec<u16>,
}

impl Consumer {
    /// Resumes after `committed` (from the consumer's database), understanding `known` kinds.
    pub fn new(committed: Option<Cursor>, known: &[u16]) -> Consumer {
        Consumer {
            committed,
            last_seen: None,
            known: known.to_vec(),
        }
    }

    pub fn committed(&self) -> Option<Cursor> {
        self.committed
    }

    pub fn judge(&mut self, envelope: &Envelope) -> Verdict {
        if self.committed.is_some_and(|c| envelope.cursor <= c) {
            return Verdict::Duplicate;
        }
        // The first envelope of a subscription carries no `previous`.
        if let Some(previous) = envelope.previous
            && self.last_seen != Some(previous)
            && self.committed != Some(previous)
        {
            return Verdict::Gap;
        }
        self.last_seen = Some(envelope.cursor);
        if envelope.event_schema > EVENT_SCHEMA || !self.known.contains(&envelope.kind) {
            return Verdict::Skip;
        }
        Verdict::Apply
    }

    /// Records that the effects of everything up to `cursor` are durably applied.
    pub fn commit(&mut self, cursor: Cursor) {
        if self.committed.is_none_or(|c| cursor > c) {
            self.committed = Some(cursor);
        }
    }

    /// After a gap or disconnect: forget what was seen since the last commit.
    pub fn reset(&mut self) {
        self.last_seen = None;
    }
}
