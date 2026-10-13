//! Every P2P queue, budget and threshold, with its unit and the reason for its size (spec
//! Sections 36, 46.1). The node's `channels.rs` lists these next to its own queues.

use std::time::Duration;

use crate::frame::Channel;

/// Network → node events. Full means the node is behind: tx gossip is shed, everything else
/// waits (back-pressure on that peer's reader).
pub const NETWORK_EVENT_QUEUE: usize = 4_096;
/// Node → network commands.
pub const NETWORK_COMMAND_QUEUE: usize = 1_024;
/// Per peer, per channel outbound frames. Full on tx gossip drops the frame; on other
/// channels the peer is too slow and is disconnected.
pub const PEER_OUTBOX_FRAMES: usize = 256;

pub const MAX_INBOUND_PEERS: usize = 64;
pub const MAX_OUTBOUND_PEERS: usize = 16;
pub const MAX_PEERS_PER_IP: usize = 8;
/// Hard cap on handshakes in progress (slowloris defence, Section 36).
pub const MAX_PENDING_HANDSHAKES: usize = 32;

/// Peer scoring (Section 36): invalid message −100, timeout −5, useful +1.
pub const SCORE_INVALID: i32 = -100;
pub const SCORE_RATE_EXCEEDED: i32 = -5;
pub const SCORE_USEFUL: i32 = 1;
/// At or below this the peer is disconnected and banned.
pub const BAN_THRESHOLD: i32 = -100;
/// Score never climbs above this, so a long-lived peer cannot bank goodwill to spend on abuse.
pub const MAX_SCORE: i32 = 100;
pub const BAN_DURATION: Duration = Duration::from_secs(600);
/// An inbound peer's source address (its /64 for IPv6) is banned with it, briefly: node keys
/// cost nothing to make, so a key ban alone is evaded by reconnecting with a new key, while a
/// long address ban would shut out honest peers behind the same NAT.
pub const ADDRESS_BAN_DURATION: Duration = Duration::from_secs(60);

pub const DIAL_BACKOFF_INITIAL: Duration = Duration::from_millis(500);
pub const DIAL_BACKOFF_MAX: Duration = Duration::from_secs(30);

/// Inbound budget per peer and channel: sustained frames per second and burst size.
pub const fn rate_budget(channel: Channel) -> (u32, u32) {
    match channel {
        Channel::Consensus => (1_000, 2_000),
        Channel::BlockProp => (100, 200),
        Channel::TxGossip => (500, 1_000),
        Channel::StateSync | Channel::SnapshotSync => (20, 40),
        Channel::Mgmt => (10, 20),
    }
}

/// Inbound byte budget per peer and channel: sustained bytes per second and burst, counted
/// over frame payloads. Frame counts alone let a peer send 1,000 eight-megabyte consensus
/// frames a second; this bounds what one peer can make the node read and hold. Each burst is
/// at least the channel's largest frame, so every legal frame can be admitted.
pub const fn byte_budget(channel: Channel) -> (u32, u32) {
    const MIB: u32 = 1024 * 1024;
    match channel {
        Channel::Consensus | Channel::BlockProp => (16 * MIB, 32 * MIB),
        Channel::TxGossip => (2 * MIB, 4 * MIB),
        Channel::StateSync | Channel::SnapshotSync => (32 * MIB, 64 * MIB),
        Channel::Mgmt => (64 * 1024, 128 * 1024),
    }
}
