//! The KvStore conformance suite (spec Section 42.1). Every backend runs every check here;
//! a second backend is acceptable only when it passes all of them.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic
)]

use aletheia_storage::{ColumnFamily, KvStore, MemoryKvStore};

/// A backend under test and how to reopen one of its checkpoints.
trait Backend {
    type Store: KvStore;
    fn fresh(&self) -> Self::Store;
    fn reopen_checkpoint(&self, dir: &std::path::Path) -> Self::Store;
}

struct Memory;

impl Backend for Memory {
    type Store = MemoryKvStore;
    fn fresh(&self) -> MemoryKvStore {
        MemoryKvStore::new()
    }
    fn reopen_checkpoint(&self, dir: &std::path::Path) -> MemoryKvStore {
        MemoryKvStore::open_checkpoint(dir).unwrap()
    }
}

fn scratch_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-kv-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn put(store: &impl KvStore, cf: ColumnFamily, key: &[u8], value: &[u8]) {
    let mut batch = store.batch();
    batch.put(cf, key, value);
    store.write_sync(batch).unwrap();
}

fn missing_keys_read_as_none(backend: &impl Backend) {
    let store = backend.fresh();
    assert_eq!(store.get(ColumnFamily::Meta, b"absent").unwrap(), None);
}

fn column_families_are_separate_namespaces(backend: &impl Backend) {
    let store = backend.fresh();
    put(&store, ColumnFamily::JmtNodes, b"k", b"jmt");
    put(&store, ColumnFamily::Receipts, b"k", b"receipt");
    assert_eq!(
        store.get(ColumnFamily::JmtNodes, b"k").unwrap().as_deref(),
        Some(&b"jmt"[..])
    );
    assert_eq!(
        store.get(ColumnFamily::Receipts, b"k").unwrap().as_deref(),
        Some(&b"receipt"[..])
    );
    assert_eq!(store.get(ColumnFamily::Events, b"k").unwrap(), None);
}

fn batches_apply_in_order_and_atomically(backend: &impl Backend) {
    let store = backend.fresh();
    let mut batch = store.batch();
    batch.put(ColumnFamily::Meta, b"a", b"1");
    batch.put(ColumnFamily::Meta, b"a", b"2");
    batch.put(ColumnFamily::Meta, b"b", b"x");
    batch.delete(ColumnFamily::Meta, b"b");
    store.write(batch).unwrap();
    assert_eq!(
        store.get(ColumnFamily::Meta, b"a").unwrap().as_deref(),
        Some(&b"2"[..]),
        "later write wins"
    );
    assert_eq!(
        store.get(ColumnFamily::Meta, b"b").unwrap(),
        None,
        "delete after put removes"
    );
}

fn range_is_half_open_ascending_and_limited(backend: &impl Backend) {
    let store = backend.fresh();
    let mut batch = store.batch();
    for key in [&b"c"[..], b"a", b"e", b"b", b"d", b"b\x00"] {
        batch.put(ColumnFamily::StateValues, key, key);
    }
    batch.put(ColumnFamily::Events, b"bb", b"other cf");
    store.write_sync(batch).unwrap();

    let keys = |from: &[u8], to: &[u8], limit| -> Vec<Vec<u8>> {
        store
            .range(ColumnFamily::StateValues, from, to, limit)
            .unwrap()
            .into_iter()
            .map(|(k, _)| k)
            .collect()
    };
    assert_eq!(
        keys(b"b", b"d", 10),
        [b"b".to_vec(), b"b\x00".to_vec(), b"c".to_vec()],
        "[from, to), bytewise order"
    );
    assert_eq!(
        keys(b"a", b"z", 2),
        [b"a".to_vec(), b"b".to_vec()],
        "limit applies after ordering"
    );
    assert!(keys(b"d", b"b", 10).is_empty(), "inverted range is empty");
    assert!(keys(b"c", b"c", 10).is_empty(), "empty range is empty");
}

fn snapshots_do_not_see_later_writes(backend: &impl Backend) {
    let store = backend.fresh();
    put(&store, ColumnFamily::Meta, b"height", b"1");
    let snapshot = store.snapshot().unwrap();
    put(&store, ColumnFamily::Meta, b"height", b"2");
    put(&store, ColumnFamily::Meta, b"new", b"x");
    assert_eq!(
        snapshot
            .get(ColumnFamily::Meta, b"height")
            .unwrap()
            .as_deref(),
        Some(&b"1"[..])
    );
    assert_eq!(snapshot.get(ColumnFamily::Meta, b"new").unwrap(), None);
    assert_eq!(
        snapshot
            .range(ColumnFamily::Meta, b"", b"\xff", 10)
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        store.get(ColumnFamily::Meta, b"height").unwrap().as_deref(),
        Some(&b"2"[..])
    );
}

fn checkpoints_are_point_in_time_copies(backend: &impl Backend) {
    let store = backend.fresh();
    put(
        &store,
        ColumnFamily::BlockIndex,
        b"\x00\x00\x00\x07",
        b"block 7",
    );
    let dir = scratch_dir("checkpoint");
    store.checkpoint(&dir).unwrap();
    put(
        &store,
        ColumnFamily::BlockIndex,
        b"\x00\x00\x00\x08",
        b"block 8",
    );

    let restored = backend.reopen_checkpoint(&dir);
    assert_eq!(
        restored
            .get(ColumnFamily::BlockIndex, b"\x00\x00\x00\x07")
            .unwrap()
            .as_deref(),
        Some(&b"block 7"[..])
    );
    assert_eq!(
        restored
            .get(ColumnFamily::BlockIndex, b"\x00\x00\x00\x08")
            .unwrap(),
        None
    );
    assert!(
        store.checkpoint(&dir).is_err(),
        "checkpoint never overwrites an existing directory"
    );
    drop(restored); // Windows refuses to delete files an open database still holds
    std::fs::remove_dir_all(&dir).unwrap();
}

fn binary_keys_and_empty_values_round_trip(backend: &impl Backend) {
    let store = backend.fresh();
    let key: Vec<u8> = (0..=255).collect();
    put(&store, ColumnFamily::JmtNodes, &key, b"");
    assert_eq!(
        store.get(ColumnFamily::JmtNodes, &key).unwrap(),
        Some(Vec::new()),
        "empty value is not absence"
    );
}

fn run_suite(backend: &impl Backend) {
    missing_keys_read_as_none(backend);
    column_families_are_separate_namespaces(backend);
    batches_apply_in_order_and_atomically(backend);
    range_is_half_open_ascending_and_limited(backend);
    snapshots_do_not_see_later_writes(backend);
    checkpoints_are_point_in_time_copies(backend);
    binary_keys_and_empty_values_round_trip(backend);
}

#[test]
fn memory_backend_conforms() {
    run_suite(&Memory);
}

#[cfg(feature = "rocksdb")]
mod rocks_backend {
    use super::*;
    use aletheia_storage::rocks::{OpenMode, RocksKvStore, StorageBudget};
    use std::sync::atomic::{AtomicUsize, Ordering};

    static NEXT: AtomicUsize = AtomicUsize::new(0);

    struct Rocks;

    impl Backend for Rocks {
        type Store = RocksKvStore;
        fn fresh(&self) -> RocksKvStore {
            let dir = scratch_dir(&format!("rocks-{}", NEXT.fetch_add(1, Ordering::Relaxed)));
            RocksKvStore::open(
                &dir,
                &StorageBudget {
                    block_cache_bytes: 8 << 20,
                    ..StorageBudget::default()
                },
                OpenMode::CreateNew,
            )
            .unwrap()
        }
        fn reopen_checkpoint(&self, dir: &std::path::Path) -> RocksKvStore {
            RocksKvStore::open(
                dir,
                &StorageBudget {
                    block_cache_bytes: 8 << 20,
                    ..StorageBudget::default()
                },
                OpenMode::Existing,
            )
            .unwrap()
        }
    }

    #[test]
    fn rocksdb_backend_conforms() {
        run_suite(&Rocks);
    }

    #[test]
    fn opening_a_missing_database_is_an_error_not_a_fresh_start() {
        let dir = scratch_dir("rocks-missing");
        assert!(RocksKvStore::open(&dir, &StorageBudget::default(), OpenMode::Existing).is_err());
    }
}
