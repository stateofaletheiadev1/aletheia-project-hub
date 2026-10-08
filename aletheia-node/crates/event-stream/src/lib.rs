//! The Finalized Event Stream (spec Section 40D.3, APS-0058): the single way off-chain systems
//! learn what happened on chain. The indexer, explorer, gateway, rail adapters and PayNet all
//! read it.
//!
//! 1. Finalized only: the source hands out finalized blocks; nothing speculative enters.
//! 2. Ordered and resumable: envelopes come in cursor order `(height, tx_index, event_index)`;
//!    a consumer resumes after its last committed cursor and receives exactly what follows.
//! 3. At-least-once delivery, exactly-once effect: the consumer drops anything at or before
//!    its committed cursor.
//! 4. Gap detection: each envelope names the cursor of the previous envelope on the same
//!    subscription; a mismatch tells the consumer to resume from its committed cursor.
//! 5. Forward compatible: an unknown kind or newer schema is recorded and skipped.
//! 6. Back-pressure: a subscriber's buffer is bounded; one that falls behind is disconnected
//!    with `STREAM_CONSUMER_TOO_SLOW` and resumes from its cursor. It never slows the node.
//!
//! This crate is the transport-independent core; the gRPC and WebSocket endpoints (Section 37)
//! carry these messages.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing,
        clippy::arithmetic_side_effects
    )
)]

pub mod consumer;
pub mod kinds;
pub mod stream;

pub use consumer::{Consumer, Verdict};
pub use kinds::{EVENT_SCHEMA, KINDS, kind_of};
pub use stream::{
    Cursor, Envelope, EventProof, FinalizedBlock, FinalizedSource, Message, StreamRequest,
    Subscription, verify_envelope,
};
