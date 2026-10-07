//! Binary list Merkle trees for `tx_root`, `receipt_root` and `event_root` (APS-0006, §16.2).
//!
//! ```text
//! leaf  = H_domain("ALETHEIA/MERKLE-LEAF/v1", item)
//! node  = H_domain("ALETHEIA/MERKLE-NODE/v1", left || right)
//! odd   : the last node of a level is promoted unpaired
//! empty : root = H_domain("ALETHEIA/MERKLE-LEAF/v1", "")
//! ```
//!
//! Promoting instead of duplicating the odd node means two different lists can never share a
//! root (the CVE-2012-2459 mutation), and distinct leaf/node tags keep a leaf from being
//! passed off as an internal node.

use aletheia_core::{AletheiaError, DomainTag, ErrorCode, Hash32, NetworkIdentity};

/// Hash of one list item as a leaf.
pub fn leaf_hash(network: &NetworkIdentity, item: &[u8]) -> Hash32 {
    network.domain_hash(DomainTag::MerkleLeaf, item)
}

fn node_hash(network: &NetworkIdentity, left: &Hash32, right: &Hash32) -> Hash32 {
    let mut hasher = network.domain_hasher(DomainTag::MerkleNode);
    hasher.update(left.as_bytes()).update(right.as_bytes());
    hasher.finalize()
}

/// One level up: pairs hashed left to right, an odd last node carried over unchanged.
fn parent_level(network: &NetworkIdentity, level: &[Hash32]) -> Vec<Hash32> {
    level
        .chunks(2)
        .map(|pair| match pair {
            [left, right] => node_hash(network, left, right),
            [odd] => *odd,
            _ => Hash32::ZERO, // chunks(2) yields only 1- or 2-element slices
        })
        .collect()
}

/// Root over already-computed leaf hashes, in list order.
pub fn root_of_leaves(network: &NetworkIdentity, leaves: &[Hash32]) -> Hash32 {
    let mut level = leaves.to_vec();
    while level.len() > 1 {
        level = parent_level(network, &level);
    }
    level
        .first()
        .copied()
        .unwrap_or_else(|| leaf_hash(network, &[]))
}

/// Root over raw items, in list order.
pub fn root<I: AsRef<[u8]>>(network: &NetworkIdentity, items: &[I]) -> Hash32 {
    let leaves: Vec<Hash32> = items
        .iter()
        .map(|item| leaf_hash(network, item.as_ref()))
        .collect();
    root_of_leaves(network, &leaves)
}

/// Inclusion proof for one leaf. `siblings` runs from the leaf level upward and omits the
/// levels where the path node was promoted without a partner.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InclusionProof {
    pub leaf_index: u64,
    pub leaf_count: u64,
    pub siblings: Vec<Hash32>,
}

pub fn prove(
    network: &NetworkIdentity,
    leaves: &[Hash32],
    leaf_index: usize,
) -> Result<InclusionProof, AletheiaError> {
    if leaf_index >= leaves.len() {
        return Err(AletheiaError::new(
            ErrorCode::ProofInvalid,
            format!(
                "leaf {leaf_index} requested from a tree of {} leaves",
                leaves.len()
            ),
        ));
    }
    let mut siblings = Vec::new();
    let mut level = leaves.to_vec();
    let mut index = leaf_index;
    while level.len() > 1 {
        if let Some(sibling) = level.get(index ^ 1) {
            siblings.push(*sibling);
        }
        level = parent_level(network, &level);
        index /= 2;
    }
    Ok(InclusionProof {
        leaf_index: u64::try_from(leaf_index).unwrap_or(u64::MAX),
        leaf_count: u64::try_from(leaves.len()).unwrap_or(u64::MAX),
        siblings,
    })
}

/// Checks that `leaf` sits at `proof.leaf_index` in a tree of `proof.leaf_count` leaves with
/// the given `root`. Every sibling must be consumed: a proof with spare hashes is refused.
pub fn verify_inclusion(
    network: &NetworkIdentity,
    leaf: &Hash32,
    proof: &InclusionProof,
    root: &Hash32,
) -> Result<(), AletheiaError> {
    let fail = |reason: String| {
        AletheiaError::new(
            ErrorCode::ProofInvalid,
            format!("Merkle inclusion proof: {reason}"),
        )
    };
    if proof.leaf_index >= proof.leaf_count {
        return Err(fail(format!(
            "index {} outside {} leaves",
            proof.leaf_index, proof.leaf_count
        )));
    }
    let mut siblings = proof.siblings.iter();
    let mut hash = *leaf;
    let mut index = proof.leaf_index;
    let mut width = proof.leaf_count;
    while width > 1 {
        let is_right = index % 2 == 1;
        let has_partner = is_right || index.checked_add(1).is_some_and(|next| next < width);
        if has_partner {
            let sibling = siblings
                .next()
                .ok_or_else(|| fail("too few sibling hashes".to_owned()))?;
            hash = if is_right {
                node_hash(network, sibling, &hash)
            } else {
                node_hash(network, &hash, sibling)
            };
        }
        index /= 2;
        width = width.div_ceil(2);
    }
    if siblings.next().is_some() {
        return Err(fail("unused sibling hashes".to_owned()));
    }
    if hash != *root {
        return Err(fail(format!("computed root {hash} differs from {root}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use aletheia_core::{ChainId, NetworkKind};
    use proptest::prelude::*;

    fn network() -> NetworkIdentity {
        NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
    }

    #[test]
    fn empty_root_is_the_leaf_hash_of_nothing() {
        let empty: [&[u8]; 0] = [];
        assert_eq!(root(&network(), &empty), leaf_hash(&network(), b""));
    }

    #[test]
    fn single_item_root_is_its_leaf() {
        assert_eq!(root(&network(), &[b"a"]), leaf_hash(&network(), b"a"));
    }

    #[test]
    fn three_items_promote_the_last_leaf() {
        let n = network();
        let [a, b, c] = [b"a", b"b", b"c"].map(|item| leaf_hash(&n, item));
        assert_eq!(
            root(&n, &[b"a", b"b", b"c"]),
            node_hash(&n, &node_hash(&n, &a, &b), &c)
        );
    }

    #[test]
    fn duplicating_the_last_item_changes_the_root() {
        // With Bitcoin-style duplication, [a, b, c] and [a, b, c, c] would collide.
        let n = network();
        assert_ne!(
            root(&n, &[b"a", b"b", b"c"]),
            root(&n, &[b"a", b"b", b"c", b"c"])
        );
    }

    #[test]
    fn proof_with_extra_or_missing_siblings_is_refused() {
        let n = network();
        let leaves: Vec<Hash32> = (0u8..5).map(|i| leaf_hash(&n, &[i])).collect();
        let root = root_of_leaves(&n, &leaves);
        let mut proof = prove(&n, &leaves, 1).unwrap();
        proof.siblings.push(Hash32::ZERO);
        assert!(verify_inclusion(&n, &leaves[1], &proof, &root).is_err());
        proof.siblings.truncate(1);
        assert!(verify_inclusion(&n, &leaves[1], &proof, &root).is_err());
    }

    proptest! {
        #[test]
        fn every_leaf_proves_and_no_other_leaf_does(count in 1usize..40, pick in any::<prop::sample::Index>()) {
            let n = network();
            let leaves: Vec<Hash32> = (0..count).map(|i| leaf_hash(&n, &i.to_le_bytes())).collect();
            let root = root_of_leaves(&n, &leaves);
            let index = pick.index(count);
            let proof = prove(&n, &leaves, index).unwrap();
            prop_assert!(verify_inclusion(&n, &leaves[index], &proof, &root).is_ok());
            let stranger = leaf_hash(&n, b"not in the tree");
            prop_assert!(verify_inclusion(&n, &stranger, &proof, &root).is_err());
        }
    }
}
