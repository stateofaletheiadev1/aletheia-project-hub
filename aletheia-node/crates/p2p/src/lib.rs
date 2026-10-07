//! Peer-to-peer transport for Aletheia StableChain (spec Section 36, APS-0029, ADR-016).

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing
    )
)]

pub mod frame;
pub mod message;

pub use frame::{Channel, Frame, FrameDecoder};
pub use message::Message;
