//! Snapshots and stale-node pruning (spec Section 42.4).

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
use std::path::PathBuf;

use aletheia_core::{ChainId, ErrorCode, Hash32, NetworkIdentity, NetworkKind};
use aletheia_state::snapshot::{self, SnapshotManifest};
use aletheia_state::{JellyfishMerkleTree, StateKey, StateValue};
use aletheia_storage::{ColumnFamily, KvStore, MemoryKvStore};

fn network() -> NetworkIdentity {
    NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
}

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-snapshot-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn key(n: u32) -> StateKey {
    StateKey::from_hash(Hash32::from_bytes(
        *blake3::hash(&n.to_le_bytes()).as_bytes(),
    ))
}

/// Three versions: insert 0..300, overwrite some and delete some, then a quiet version.
fn history(store: &MemoryKvStore) -> BTreeMap<StateKey, StateValue> {
    let tree = JellyfishMerkleTree::new(store, network());
    let mut model = BTreeMap::new();
    let mut versions: Vec<BTreeMap<StateKey, Option<StateValue>>> = Vec::new();
    versions.push(
        (0..300u32)
            .map(|n| (key(n), Some(n.to_le_bytes().repeat(5))))
            .collect(),
    );
    versions.push(
        (0..300u32)
            .filter(|n| n % 7 == 0)
            .map(|n| {
                (
                    key(n),
                    if n % 2 == 0 {
                        None
                    } else {
                        Some(vec![n as u8])
                    },
                )
            })
            .collect(),
    );
    versions.push(BTreeMap::new());
    for (version, changes) in versions.iter().enumerate() {
        for (k, v) in changes {
            match v {
                Some(value) => {
                    model.insert(*k, value.clone());
                }
                None => {
                    model.remove(k);
                }
            }
        }
        let list: Vec<_> = changes.iter().map(|(k, v)| (*k, v.clone())).collect();
        let mut batch = store.batch();
        tree.apply(
            (version as u64).checked_sub(1),
            version as u64,
            &list,
            &mut batch,
        )
        .unwrap();
        store.write_sync(batch).unwrap();
    }
    model
}

#[test]
fn live_entries_page_through_exactly_the_current_state() {
    let store = MemoryKvStore::new();
    let model = history(&store);
    let tree = JellyfishMerkleTree::new(&store, network());
    let mut seen = Vec::new();
    let mut after = None;
    loop {
        let page = tree.live_entries(2, after.as_ref(), 37).unwrap();
        if page.is_empty() {
            break;
        }
        after = Some(page.last().unwrap().0);
        seen.extend(page);
    }
    let expected: Vec<(StateKey, StateValue)> = model.into_iter().collect();
    assert_eq!(seen, expected);
    assert_eq!(
        tree.live_entries(0, None, 1_000).unwrap().len(),
        300,
        "older versions stay readable"
    );
}

#[test]
fn a_snapshot_restores_to_the_same_root_and_values() {
    let store = MemoryKvStore::new();
    let model = history(&store);
    let tree = JellyfishMerkleTree::new(&store, network());
    let dir = scratch("roundtrip");
    let manifest = snapshot::create(&tree, 2, b"finality proof".to_vec(), &dir, 2_000).unwrap();
    assert!(
        manifest.chunk_hashes.len() > 1,
        "small chunk size forces several chunks"
    );
    assert_eq!(snapshot::read_manifest(&dir).unwrap(), manifest);

    let restored = MemoryKvStore::new();
    snapshot::restore(&restored, &network(), &dir, &manifest).unwrap();
    let restored_tree = JellyfishMerkleTree::new(&restored, network());
    assert_eq!(
        restored_tree.root_hash(2).unwrap(),
        tree.root_hash(2).unwrap()
    );
    for (k, v) in &model {
        assert_eq!(restored_tree.get(k, 2).unwrap().as_ref(), Some(v));
    }
}

#[test]
fn a_tampered_chunk_is_refused() {
    let store = MemoryKvStore::new();
    history(&store);
    let tree = JellyfishMerkleTree::new(&store, network());
    let dir = scratch("tamper");
    let manifest = snapshot::create(&tree, 2, Vec::new(), &dir, 2_000).unwrap();
    let chunk = dir.join("chunk-000001.zst");
    let replacement = std::fs::read(dir.join("chunk-000000.zst")).unwrap();
    std::fs::write(&chunk, replacement).unwrap();
    let error = snapshot::restore(&MemoryKvStore::new(), &network(), &dir, &manifest).unwrap_err();
    assert_eq!(error.code(), ErrorCode::ProofInvalid);
}

#[test]
fn a_manifest_with_the_wrong_root_is_refused() {
    let store = MemoryKvStore::new();
    history(&store);
    let tree = JellyfishMerkleTree::new(&store, network());
    let dir = scratch("root");
    let manifest = snapshot::create(&tree, 2, Vec::new(), &dir, 2_000).unwrap();
    let forged = SnapshotManifest {
        state_root: Hash32::from_bytes([1; 32]),
        ..manifest
    };
    let error = snapshot::restore(&MemoryKvStore::new(), &network(), &dir, &forged).unwrap_err();
    assert_eq!(error.code(), ErrorCode::ProofInvalid);
}

#[test]
fn pruning_removes_replaced_nodes_but_keeps_newer_versions_intact() {
    let store = MemoryKvStore::new();
    let model = history(&store);
    let tree = JellyfishMerkleTree::new(&store, network());
    let root_2 = tree.root_hash(2).unwrap();
    let nodes_before = store
        .range(ColumnFamily::JmtNodes, &[], &[0xff; 64], usize::MAX)
        .unwrap()
        .len();

    let mut removed = 0;
    loop {
        let mut batch = store.batch();
        let count = tree.prune_stale(2, 50, &mut batch).unwrap();
        store.write_sync(batch).unwrap();
        removed += count;
        if count == 0 {
            break;
        }
    }
    let nodes_after = store
        .range(ColumnFamily::JmtNodes, &[], &[0xff; 64], usize::MAX)
        .unwrap()
        .len();
    assert!(removed > 0);
    assert_eq!(nodes_before - nodes_after, removed);
    assert!(
        tree.root_hash(0).is_err(),
        "version 0's root was replaced and pruned"
    );
    assert_eq!(tree.root_hash(2).unwrap(), root_2);
    for (k, v) in model.iter().take(50) {
        let proof = tree.prove(k, 2).unwrap();
        proof.verify(&network(), &root_2, k, Some(v)).unwrap();
    }
}
