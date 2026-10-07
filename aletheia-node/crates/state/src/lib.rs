//! Authenticated state for Aletheia StableChain (spec Sections 15, 16): state keys, the
//! copy-on-write overlay a block executes against, and the versioned Jellyfish Merkle Tree
//! whose root every header commits to.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing
    )
)]

pub mod jmt;
pub mod key;
pub mod overlay;

pub use jmt::proof::{ProofTerminal, StateProof};
pub use jmt::tree::JellyfishMerkleTree;
pub use key::{Namespace, StateKey, StateValue};
pub use overlay::{StateOverlay, StateView};
