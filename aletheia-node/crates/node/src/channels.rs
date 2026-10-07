//! Every queue in the node, with its capacity and what happens when it is full (spec Section
//! 46.1). Adding a queue anywhere else fails review. P2P's own queues are in
//! `aletheia_p2p::limits` and are listed here for the full picture.

/// Async tasks → chain thread: admission checks, block applies, block reads, proposals. Full
/// means the chain thread is behind; callers wait (each caller is one task, so waiting
/// back-pressures exactly the work that caused it).
pub const CHAIN_REQUEST_QUEUE: usize = 256;

/// Local submissions (RPC, tests) → sync service. Full means admission is behind: the
/// submission is refused and the client retries (Section 46.2, step 2).
pub const SUBMIT_QUEUE: usize = 1_024;

/// Mempool bounds (Section 21 defaults).
pub const MEMPOOL_MAX_BYTES: usize = 200 * 1024 * 1024;
pub const MEMPOOL_MAX_PER_SENDER: usize = 64;
/// A replacement for the same (sender, nonce) must raise max_fee by at least this percentage.
pub const MEMPOOL_REPLACEMENT_BUMP_PERCENT: u128 = 10;
/// Candidates handed to the block builder at most; it picks what fits.
pub const PROPOSAL_CANDIDATES: usize = 4_096;

/// Blocks answered per GetBlocks request, bounded also by [`BLOCK_RESPONSE_BYTES`].
pub const BLOCK_RESPONSE_BYTES: usize = 7 * 1024 * 1024;
/// Transactions answered per GetTxs request, under the 256 KiB tx-gossip frame.
pub const TX_RESPONSE_BYTES: usize = 200 * 1024;

pub use aletheia_p2p::limits::{NETWORK_COMMAND_QUEUE, NETWORK_EVENT_QUEUE, PEER_OUTBOX_FRAMES};
