//! Subscriptions over finalized blocks: envelopes in cursor order, with optional inclusion
//! proofs against the block's `event_root`.

use std::collections::{BTreeSet, VecDeque};

use aletheia_core::{AletheiaError, ErrorCode, Hash32, NetworkIdentity};
use aletheia_crypto::merkle::{InclusionProof, leaf_hash, prove, verify_inclusion};
use aletheia_execution::receipt::{Event, Receipt};

use crate::kinds::{EVENT_SCHEMA, kind_of};

/// A position in the stream. Strictly increasing over envelopes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Cursor {
    pub height: u64,
    pub tx_index: u32,
    pub event_index: u32,
}

/// One finalized block as the stream needs it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinalizedBlock {
    pub height: u64,
    pub block_hash: Hash32,
    pub block_time_ms: u64,
    pub protocol_version: u16,
    pub event_root: Hash32,
    pub receipts: Vec<Receipt>,
}

/// Where finalized blocks come from: the node's committed chain. Only finalized blocks are
/// ever returned.
pub trait FinalizedSource {
    fn finalized_height(&self) -> u64;
    fn block(&self, height: u64) -> Option<FinalizedBlock>;
}

/// An event's inclusion proof against its block's `event_root`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventProof {
    pub event_root: Hash32,
    pub proof: InclusionProof,
}

/// One event, as delivered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Envelope {
    pub cursor: Cursor,
    /// The cursor of the envelope before this one on the same subscription (gap detection).
    pub previous: Option<Cursor>,
    pub block_hash: Hash32,
    pub block_time_ms: u64,
    pub protocol_version: u16,
    pub event_schema: u16,
    /// The transaction that emitted it.
    pub tx_id: Option<Hash32>,
    /// Kind code (0 when the schema is not in the table).
    pub kind: u16,
    pub event: Event,
    pub proof: Option<EventProof>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Message {
    Event(Box<Envelope>),
    /// Sent when idle, so a consumer knows the stream is alive and how far finality is.
    Heartbeat {
        finalized_height: u64,
        last_cursor: Option<Cursor>,
    },
    /// The subscriber fell behind its buffer bound and must resume from its cursor.
    Disconnect {
        code: &'static str,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StreamRequest {
    /// Deliver what comes after this cursor; `None` starts at genesis.
    pub after: Option<Cursor>,
    /// Kind codes wanted; empty means all.
    pub kinds: BTreeSet<u16>,
    pub with_proofs: bool,
}

/// One subscriber's stream state.
#[derive(Debug)]
pub struct Subscription {
    request: StreamRequest,
    network: NetworkIdentity,
    capacity: usize,
    buffer: VecDeque<Message>,
    /// The last cursor queued for this subscriber (envelopes before it are not resent).
    position: Option<Cursor>,
    last_sent: Option<Cursor>,
    next_height: u64,
    disconnected: bool,
}

impl Subscription {
    /// `capacity` bounds the messages buffered for this subscriber.
    pub fn new(request: StreamRequest, network: NetworkIdentity, capacity: usize) -> Subscription {
        let next_height = request.after.map_or(1, |c| c.height);
        Subscription {
            position: request.after,
            request,
            network,
            capacity: capacity.max(1),
            buffer: VecDeque::new(),
            last_sent: None,
            next_height,
            disconnected: false,
        }
    }

    pub fn is_disconnected(&self) -> bool {
        self.disconnected
    }

    /// Reads newly finalized blocks into the buffer. When the buffer is full the subscriber
    /// gets what is queued and then a disconnect; the node never waits for it.
    pub fn pump(&mut self, source: &dyn FinalizedSource) {
        if self.disconnected {
            return;
        }
        while self.next_height <= source.finalized_height() {
            let Some(block) = source.block(self.next_height) else {
                break;
            };
            let leaves: Vec<Hash32> = block
                .receipts
                .iter()
                .flat_map(|r| r.events.iter())
                .map(|e| leaf_hash(&self.network, e.hash(&self.network).as_bytes()))
                .collect();
            let mut leaf = 0usize;
            for (tx_index, receipt) in (0u32..).zip(&block.receipts) {
                for (event_index, event) in (0u32..).zip(&receipt.events) {
                    let index = leaf;
                    leaf = leaf.saturating_add(1);
                    let cursor = Cursor {
                        height: block.height,
                        tx_index,
                        event_index,
                    };
                    if self.position.is_some_and(|p| cursor <= p) {
                        continue;
                    }
                    let kind = kind_of(&event.event_type);
                    self.position = Some(cursor);
                    if !self.request.kinds.is_empty() && !self.request.kinds.contains(&kind) {
                        continue;
                    }
                    let proof = if self.request.with_proofs {
                        prove(&self.network, &leaves, index)
                            .ok()
                            .map(|proof| EventProof {
                                event_root: block.event_root,
                                proof,
                            })
                    } else {
                        None
                    };
                    let envelope = Envelope {
                        cursor,
                        previous: self.last_sent,
                        block_hash: block.block_hash,
                        block_time_ms: block.block_time_ms,
                        protocol_version: block.protocol_version,
                        event_schema: EVENT_SCHEMA,
                        tx_id: Some(receipt.tx_id),
                        kind,
                        event: event.clone(),
                        proof,
                    };
                    self.last_sent = Some(cursor);
                    if self.buffer.len() >= self.capacity {
                        // What is queued is still delivered; the disconnect follows it, and
                        // the subscriber resumes from its cursor.
                        self.buffer.push_back(Message::Disconnect {
                            code: "STREAM_CONSUMER_TOO_SLOW",
                        });
                        self.disconnected = true;
                        return;
                    }
                    self.buffer.push_back(Message::Event(Box::new(envelope)));
                }
            }
            self.next_height = self.next_height.saturating_add(1);
        }
    }

    /// The next message for the subscriber.
    pub fn next_message(&mut self) -> Option<Message> {
        self.buffer.pop_front()
    }

    /// A heartbeat, for when the buffer is empty.
    pub fn heartbeat(&self, source: &dyn FinalizedSource) -> Message {
        Message::Heartbeat {
            finalized_height: source.finalized_height(),
            last_cursor: self.last_sent,
        }
    }
}

/// Checks an envelope's event against its block's `event_root` with the attached proof.
/// `trusted_root` is the root from a header the consumer verified (with a finality proof).
pub fn verify_envelope(
    network: &NetworkIdentity,
    envelope: &Envelope,
    trusted_root: &Hash32,
) -> Result<(), AletheiaError> {
    let proof = envelope.proof.as_ref().ok_or_else(|| {
        AletheiaError::new(
            ErrorCode::ProofInvalid,
            "the envelope carries no proof".to_owned(),
        )
    })?;
    if proof.event_root != *trusted_root {
        return Err(AletheiaError::new(
            ErrorCode::ProofInvalid,
            "the proof is against another event root".to_owned(),
        ));
    }
    let leaf = leaf_hash(network, envelope.event.hash(network).as_bytes());
    verify_inclusion(network, &leaf, &proof.proof, trusted_root)
}
