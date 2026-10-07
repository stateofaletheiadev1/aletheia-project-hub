//! JMT conformance (spec Section 62, Phase 2 exit: "JMT root == naive root (property)").

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects,
    clippy::as_conversions,
    clippy::cast_possible_truncation
)]

use std::collections::BTreeMap;

use aletheia_core::{
    AceDecode, AceEncode, ChainId, ErrorCode, Hash32, NetworkIdentity, NetworkKind,
};
use aletheia_state::jmt::{PLACEHOLDER, naive_root, value_hash};
use aletheia_state::{JellyfishMerkleTree, ProofTerminal, StateKey, StateProof, StateValue};
use aletheia_storage::{KvStore, MemoryKvStore};
use proptest::prelude::*;

fn network() -> NetworkIdentity {
    NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
}

/// Keys drawn so that many share long prefixes: the first two bytes come from a tiny set.
fn key(prefix: u8, second: u8, rest: u8) -> StateKey {
    let mut bytes = [rest; 32];
    bytes[0] = prefix;
    bytes[1] = second;
    StateKey::from_hash(Hash32::from_bytes(bytes))
}

fn key_strategy() -> impl Strategy<Value = StateKey> {
    (
        prop::sample::select(vec![0x00u8, 0x0f, 0xf0, 0xff]),
        prop::sample::select(vec![0x00u8, 0x01, 0x10]),
        any::<u8>(),
    )
        .prop_map(|(a, b, c)| key(a, b, c))
}

type Batch = BTreeMap<StateKey, Option<StateValue>>;

fn batch_strategy() -> impl Strategy<Value = Batch> {
    prop::collection::btree_map(
        key_strategy(),
        prop::option::weighted(0.75, prop::collection::vec(any::<u8>(), 0..8)),
        0..12,
    )
}

/// Applies `changes` as `version` and commits the batch.
fn commit(store: &MemoryKvStore, previous: Option<u64>, version: u64, changes: &Batch) -> Hash32 {
    let tree = JellyfishMerkleTree::new(store, network());
    let list: Vec<(StateKey, Option<StateValue>)> =
        changes.iter().map(|(k, v)| (*k, v.clone())).collect();
    let mut batch = store.batch();
    let root = tree.apply(previous, version, &list, &mut batch).unwrap();
    store.write_sync(batch).unwrap();
    root
}

fn model_root(model: &BTreeMap<StateKey, StateValue>) -> Hash32 {
    let hashes: BTreeMap<StateKey, Hash32> =
        model.iter().map(|(k, v)| (*k, value_hash(v))).collect();
    naive_root(&network(), &hashes)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    #[test]
    fn persistent_root_equals_naive_root_at_every_version(batches in prop::collection::vec(batch_strategy(), 1..12)) {
        let store = MemoryKvStore::new();
        let mut model: BTreeMap<StateKey, StateValue> = BTreeMap::new();
        let mut history = Vec::new();
        for (version, changes) in batches.iter().enumerate() {
            let version = version as u64;
            for (k, v) in changes {
                match v {
                    Some(value) => { model.insert(*k, value.clone()); }
                    None => { model.remove(k); }
                }
            }
            let root = commit(&store, version.checked_sub(1), version, changes);
            prop_assert_eq!(root, model_root(&model), "version {}", version);
            history.push((version, root, model.clone()));
        }

        let tree = JellyfishMerkleTree::new(&store, network());
        for (version, root, snapshot) in &history {
            prop_assert_eq!(tree.root_hash(*version).unwrap(), *root, "historical root at {}", version);
            for (k, v) in snapshot {
                let stored = tree.get(k, *version).unwrap();
                prop_assert_eq!(stored.as_ref(), Some(v));
                let proof = tree.prove(k, *version).unwrap();
                prop_assert!(proof.verify(&network(), root, k, Some(v)).is_ok());
                prop_assert!(proof.verify(&network(), root, k, Some(b"something else")).is_err());
                prop_assert!(proof.verify(&network(), root, k, None).is_err());
                prop_assert_eq!(StateProof::from_ace_bytes(&proof.to_ace_bytes()).unwrap(), proof);
            }
        }
    }

    #[test]
    fn absent_keys_have_valid_non_inclusion_proofs(batch in batch_strategy(), probe in key_strategy()) {
        let store = MemoryKvStore::new();
        let root = commit(&store, None, 0, &batch);
        let tree = JellyfishMerkleTree::new(&store, network());
        let present = tree.get(&probe, 0).unwrap();
        let proof = tree.prove(&probe, 0).unwrap();
        match present {
            Some(value) => prop_assert!(proof.verify(&network(), &root, &probe, Some(&value)).is_ok()),
            None => {
                prop_assert!(proof.verify(&network(), &root, &probe, None).is_ok());
                prop_assert!(proof.verify(&network(), &root, &probe, Some(b"x")).is_err());
            }
        }
    }

    #[test]
    fn the_root_does_not_depend_on_how_writes_were_batched(batch in batch_strategy()) {
        let inserts: Batch = batch.into_iter().filter(|(_, v)| v.is_some()).collect();
        let all_at_once = MemoryKvStore::new();
        let root_once = commit(&all_at_once, None, 0, &inserts);

        let one_by_one = MemoryKvStore::new();
        let mut previous = None;
        let mut root = PLACEHOLDER;
        for (version, (k, v)) in inserts.iter().enumerate() {
            let single: Batch = [(*k, v.clone())].into_iter().collect();
            root = commit(&one_by_one, previous, version as u64, &single);
            previous = Some(version as u64);
        }
        prop_assert_eq!(root_once, root);
    }
}

#[test]
fn an_empty_tree_has_the_placeholder_root() {
    let store = MemoryKvStore::new();
    assert_eq!(commit(&store, None, 0, &Batch::new()), PLACEHOLDER);
    let tree = JellyfishMerkleTree::new(&store, network());
    let probe = key(1, 2, 3);
    let proof = tree.prove(&probe, 0).unwrap();
    assert_eq!(proof.terminal, ProofTerminal::Empty);
    proof
        .verify(&network(), &PLACEHOLDER, &probe, None)
        .unwrap();
}

#[test]
fn deleting_everything_returns_to_the_placeholder() {
    let store = MemoryKvStore::new();
    let keys = [key(0, 0, 1), key(0, 0, 2), key(0xff, 0x10, 3)];
    let inserts: Batch = keys.iter().map(|k| (*k, Some(vec![1]))).collect();
    commit(&store, None, 0, &inserts);
    let deletes: Batch = keys.iter().map(|k| (*k, None)).collect();
    assert_eq!(commit(&store, Some(0), 1, &deletes), PLACEHOLDER);
    let tree = JellyfishMerkleTree::new(&store, network());
    assert_eq!(tree.get(&keys[0], 1).unwrap(), None);
    assert_eq!(
        tree.get(&keys[0], 0).unwrap(),
        Some(vec![1]),
        "history is kept"
    );
}

#[test]
fn a_version_with_no_changes_keeps_the_root() {
    let store = MemoryKvStore::new();
    let inserts: Batch = [(key(1, 1, 1), Some(vec![9]))].into_iter().collect();
    let root = commit(&store, None, 0, &inserts);
    assert_eq!(commit(&store, Some(0), 1, &Batch::new()), root);
    assert_eq!(
        JellyfishMerkleTree::new(&store, network())
            .root_hash(1)
            .unwrap(),
        root
    );
}

#[test]
fn unsorted_changes_and_non_increasing_versions_are_refused() {
    let store = MemoryKvStore::new();
    let tree = JellyfishMerkleTree::new(&store, network());
    let mut batch = store.batch();
    let unsorted = vec![(key(2, 0, 0), None), (key(1, 0, 0), None)];
    assert_eq!(
        tree.apply(None, 0, &unsorted, &mut batch)
            .unwrap_err()
            .code(),
        ErrorCode::DecodeNonCanonical
    );
    assert_eq!(
        tree.apply(Some(5), 5, &[], &mut batch).unwrap_err().code(),
        ErrorCode::FinalizeOutOfOrder
    );
}

#[test]
fn a_proof_for_another_network_does_not_verify() {
    let store = MemoryKvStore::new();
    let k = key(3, 3, 3);
    let inserts: Batch = [(k, Some(vec![4]))].into_iter().collect();
    let root = commit(&store, None, 0, &inserts);
    let proof = JellyfishMerkleTree::new(&store, network())
        .prove(&k, 0)
        .unwrap();
    let mainnet = NetworkIdentity::new(ChainId::new(7771), NetworkKind::Mainnet, Hash32::ZERO);
    assert_eq!(
        proof
            .verify(&mainnet, &root, &k, Some(&[4]))
            .unwrap_err()
            .code(),
        ErrorCode::ProofInvalid
    );
}
