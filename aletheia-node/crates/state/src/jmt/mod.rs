//! Jellyfish Merkle Tree: the authenticated state map (spec Section 16.1, ADR-006).
//!
//! - Sparse, versioned, 16-ary over the 256-bit [`StateKey`], one nibble per level.
//! - `leaf = H_domain("ALETHEIA/JMT-LEAF/v1", state_key || value_hash)`, with
//!   `value_hash = BLAKE3(value)` (ERRATA E-15).
//! - `internal = H_domain("ALETHEIA/JMT-NODE/v1", child_hash[0] || … || child_hash[15])`,
//!   an empty child being [`PLACEHOLDER`] (32 zero bytes). An empty tree's root is the
//!   placeholder.
//! - A subtree holding exactly one key is that key's leaf, placed as high as it can go. With
//!   that rule the root is a function of the key-value set alone, not of insertion history -
//!   [`naive_root`] computes it straight from the definition, and the property tests hold
//!   the persistent tree to it.
//!
//! The persistent tree ([`tree::JellyfishMerkleTree`]) stores nodes in the `JmtNodes` column
//! family under `u64_be(version) || nibble_path`, so every finalized height keeps a readable
//! root for historical proofs until it is pruned.

pub mod node;
pub mod proof;
pub mod tree;

use std::collections::BTreeMap;

use aletheia_core::{DomainTag, Hash32, NetworkIdentity};

use crate::key::StateKey;

/// Hash of an empty subtree.
pub const PLACEHOLDER: Hash32 = Hash32::ZERO;

/// Number of nibbles in a key: the maximum depth of the tree.
pub const KEY_NIBBLES: usize = 64;

pub fn value_hash(value: &[u8]) -> Hash32 {
    Hash32::from_bytes(*blake3::hash(value).as_bytes())
}

pub fn leaf_hash(network: &NetworkIdentity, key: &StateKey, value_hash: &Hash32) -> Hash32 {
    let mut hasher = network.domain_hasher(DomainTag::JmtLeaf);
    hasher.update(key.as_bytes()).update(value_hash.as_bytes());
    hasher.finalize()
}

pub fn internal_hash(network: &NetworkIdentity, children: &[Hash32; 16]) -> Hash32 {
    let mut hasher = network.domain_hasher(DomainTag::JmtNode);
    for child in children {
        hasher.update(child.as_bytes());
    }
    hasher.finalize()
}

/// The root of a key-value set, computed directly from the definition. Reference only: it
/// rehashes everything and is used to check the persistent tree, never in consensus.
pub fn naive_root(network: &NetworkIdentity, entries: &BTreeMap<StateKey, Hash32>) -> Hash32 {
    let items: Vec<(StateKey, Hash32)> = entries.iter().map(|(k, v)| (*k, *v)).collect();
    naive_subtree(network, &items, 0)
}

fn naive_subtree(network: &NetworkIdentity, items: &[(StateKey, Hash32)], depth: usize) -> Hash32 {
    match items {
        [] => PLACEHOLDER,
        [(key, value)] => leaf_hash(network, key, value),
        _ => {
            let mut children = [PLACEHOLDER; 16];
            for (nibble, child) in children.iter_mut().enumerate() {
                let subset: Vec<(StateKey, Hash32)> = items
                    .iter()
                    .filter(|(key, _)| usize::from(key.nibble(depth)) == nibble)
                    .copied()
                    .collect();
                *child = naive_subtree(network, &subset, depth.saturating_add(1));
            }
            internal_hash(network, &children)
        }
    }
}
