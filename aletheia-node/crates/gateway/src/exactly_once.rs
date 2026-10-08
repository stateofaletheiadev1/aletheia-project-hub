//! Exactly once, in both directions (Section 40C.8).
//!
//! Inbox: every received message is stored by `(rail, sender, msg_id)` before any processing.
//! A redelivery is acknowledged and ignored, and the original outcome is given again.
//!
//! Outbox: every message to emit is written with the state change that caused it; a
//! dispatcher sends it and records the partner's acknowledgement. Sending is idempotent per
//! `outbox_id`, so a retry after an unknown outcome cannot create a second payment.

use std::collections::BTreeMap;

/// What was decided for a received message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InboxOutcome {
    /// Accepted and mapped; `reference` names what it became (an operation or case id).
    Accepted { reference: String },
    /// Refused with an ISO reason code.
    Rejected { reason: String, detail: String },
    /// Held for a person to look at (a screening hit or screening outage).
    Held { case: String },
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct InboxKey {
    pub rail: String,
    pub sender: String,
    pub msg_id: String,
}

/// The first time a key is seen, or the outcome already given for it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Receipt {
    New,
    Duplicate(InboxOutcome),
    /// Seen before but still being processed (a crash mid-way): process again from the start;
    /// every later step is itself idempotent.
    InProgress,
}

#[derive(Debug, Clone, Default)]
pub struct Inbox {
    entries: BTreeMap<InboxKey, Option<InboxOutcome>>,
}

impl Inbox {
    /// Records the message before processing.
    pub fn receive(&mut self, key: InboxKey) -> Receipt {
        match self.entries.get(&key) {
            Some(Some(outcome)) => Receipt::Duplicate(outcome.clone()),
            Some(None) => Receipt::InProgress,
            None => {
                self.entries.insert(key, None);
                Receipt::New
            }
        }
    }

    pub fn decide(&mut self, key: &InboxKey, outcome: InboxOutcome) {
        if let Some(slot) = self.entries.get_mut(key) {
            *slot = Some(outcome);
        }
    }

    pub fn outcome(&self, key: &InboxKey) -> Option<&InboxOutcome> {
        self.entries.get(key).and_then(Option::as_ref)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutboxState {
    Pending,
    /// Handed to the partner; no acknowledgement yet.
    Sent,
    Acknowledged,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutboxItem {
    pub outbox_id: String,
    pub rail: String,
    pub message: String,
    pub state: OutboxState,
    pub attempts: u32,
}

#[derive(Debug, Clone, Default)]
pub struct Outbox {
    items: BTreeMap<String, OutboxItem>,
}

impl Outbox {
    /// Queues a message; queuing the same id again keeps the first one.
    pub fn enqueue(&mut self, outbox_id: &str, rail: &str, message: String) -> &OutboxItem {
        self.items
            .entry(outbox_id.to_owned())
            .or_insert_with(|| OutboxItem {
                outbox_id: outbox_id.to_owned(),
                rail: rail.to_owned(),
                message,
                state: OutboxState::Pending,
                attempts: 0,
            })
    }

    /// Messages to (re)send: pending, and sent without acknowledgement.
    pub fn due(&self) -> Vec<&OutboxItem> {
        self.items
            .values()
            .filter(|i| i.state != OutboxState::Acknowledged)
            .collect()
    }

    pub fn mark_sent(&mut self, outbox_id: &str) {
        if let Some(item) = self.items.get_mut(outbox_id)
            && item.state != OutboxState::Acknowledged
        {
            item.state = OutboxState::Sent;
            item.attempts = item.attempts.saturating_add(1);
        }
    }

    pub fn acknowledge(&mut self, outbox_id: &str) {
        if let Some(item) = self.items.get_mut(outbox_id) {
            item.state = OutboxState::Acknowledged;
        }
    }

    pub fn get(&self, outbox_id: &str) -> Option<&OutboxItem> {
        self.items.get(outbox_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(msg: &str) -> InboxKey {
        InboxKey {
            rail: "sepa-sct-inst".to_owned(),
            sender: "COBADEFF".to_owned(),
            msg_id: msg.to_owned(),
        }
    }

    #[test]
    fn a_redelivery_gets_the_original_outcome() {
        let mut inbox = Inbox::default();
        assert_eq!(inbox.receive(key("M1")), Receipt::New);
        assert_eq!(inbox.receive(key("M1")), Receipt::InProgress);
        let outcome = InboxOutcome::Accepted {
            reference: "op-1".to_owned(),
        };
        inbox.decide(&key("M1"), outcome.clone());
        assert_eq!(inbox.receive(key("M1")), Receipt::Duplicate(outcome));
        assert_eq!(inbox.receive(key("M2")), Receipt::New);
    }

    #[test]
    fn the_outbox_sends_until_acknowledged_and_never_twice_per_id() {
        let mut outbox = Outbox::default();
        outbox.enqueue("o1", "sepa-sct-inst", "<a/>".to_owned());
        outbox.enqueue("o1", "sepa-sct-inst", "<different/>".to_owned());
        assert_eq!(outbox.get("o1").unwrap().message, "<a/>");
        outbox.mark_sent("o1");
        assert_eq!(outbox.due().len(), 1, "sent but unacknowledged is retried");
        outbox.acknowledge("o1");
        outbox.mark_sent("o1");
        assert!(outbox.due().is_empty());
        assert_eq!(outbox.get("o1").unwrap().state, OutboxState::Acknowledged);
    }
}
