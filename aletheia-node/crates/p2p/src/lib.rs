//! Peer-to-peer transport for AletheiaChain (spec Section 36, APS-0029, ADR-016).

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing
    )
)]

pub mod connection;
pub mod frame;
pub mod handshake;
pub mod limits;
pub mod message;
pub mod network;
pub mod peer_score;
pub mod tls;

pub use connection::{LocalNode, PeerConnection, PeerExpectation, PeerIdentity};
pub use frame::{Channel, Frame, FrameDecoder};
pub use message::Message;
pub use network::{DialTarget, NetworkCommand, NetworkConfig, NetworkEvent, NetworkHandle, PeerId};
pub use tls::TransportCertificate;
