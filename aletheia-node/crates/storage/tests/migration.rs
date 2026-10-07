//! Migration framework (spec 62.1, Phase 2: "migration framework with a dummy 1->2 step,
//! checkpoint/rollback; migration-crash test green on the dummy step").

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::cell::Cell;
use std::path::PathBuf;

use aletheia_core::{AletheiaError, ChainId, ErrorCode, Hash32, NetworkIdentity, NetworkKind};
use aletheia_storage::datadir::{DataDir, DataDirManifest, StartupAction, decide};
use aletheia_storage::migrate::{MigrationStep, mark_rolled_back, migrate};
use aletheia_storage::{ColumnFamily, KvStore, MemoryKvStore};

const KEYS: u32 = 25_000;
const BATCH: usize = 1_000;

fn network() -> NetworkIdentity {
    NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
}

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-migrate-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn v1_key(n: u32) -> Vec<u8> {
    format!("v1/{n:08}").into_bytes()
}

fn v2_key(n: u32) -> Vec<u8> {
    format!("v2/{n:08}").into_bytes()
}

fn populated_store() -> MemoryKvStore {
    let store = MemoryKvStore::new();
    let mut batch = store.batch();
    for n in 0..KEYS {
        batch.put(ColumnFamily::Meta, &v1_key(n), &n.to_le_bytes());
    }
    store.write_sync(batch).unwrap();
    store
}

/// Dummy 1->2 step: renames every `v1/` key in Meta to `v2/`, in sorted order, in batches.
/// `crash_after` simulates power loss after that many keys on its first run.
struct RenameV1ToV2 {
    crash_after: Cell<Option<u32>>,
    processed: Cell<u32>,
    resumed_from: Cell<Option<Vec<u8>>>,
}

impl RenameV1ToV2 {
    fn new(crash_after: Option<u32>) -> RenameV1ToV2 {
        RenameV1ToV2 {
            crash_after: Cell::new(crash_after),
            processed: Cell::new(0),
            resumed_from: Cell::new(None),
        }
    }
}

impl MigrationStep for RenameV1ToV2 {
    fn source_schema(&self) -> u32 {
        1
    }

    fn description(&self) -> &'static str {
        "test-only: rename v1/ meta keys to v2/"
    }

    fn run(
        &self,
        store: &dyn KvStore,
        resume_after: Option<&[u8]>,
        progress: &mut dyn FnMut(&[u8]) -> Result<(), AletheiaError>,
    ) -> Result<(), AletheiaError> {
        self.resumed_from.set(resume_after.map(<[u8]>::to_vec));
        let mut from = resume_after.map_or_else(|| b"v1/".to_vec(), |key| [key, &[0]].concat());
        loop {
            let chunk = store.range(ColumnFamily::Meta, &from, b"v1/\xff", BATCH)?;
            let Some((last, _)) = chunk.last().cloned() else {
                return Ok(());
            };
            let mut batch = store.batch();
            for (key, value) in &chunk {
                let renamed = [b"v2/", &key[3..]].concat();
                batch.put(ColumnFamily::Meta, &renamed, value);
                batch.delete(ColumnFamily::Meta, key);
            }
            store.write(batch)?;
            for (key, _) in &chunk {
                self.processed.set(self.processed.get() + 1);
                progress(key)?;
                if self.crash_after.get() == Some(self.processed.get()) {
                    self.crash_after.set(None);
                    return Err(AletheiaError::new(
                        ErrorCode::StoIo,
                        "simulated power loss".to_owned(),
                    ));
                }
            }
            from = [&last[..], &[0]].concat();
        }
    }

    fn verify(&self, store: &dyn KvStore) -> Result<(), AletheiaError> {
        let left = store.range(ColumnFamily::Meta, b"v1/", b"v1/\xff", 1)?;
        let done = store.range(ColumnFamily::Meta, b"v2/", b"v2/\xff", usize::MAX)?;
        if !left.is_empty() || done.len() != usize::try_from(KEYS).unwrap() {
            return Err(AletheiaError::new(
                ErrorCode::StoMigrationFailed,
                format!("{} v2 keys, v1 left: {}", done.len(), !left.is_empty()),
            ));
        }
        Ok(())
    }
}

fn schema_1_dir(name: &str) -> DataDir {
    let manifest = DataDirManifest {
        storage_schema: 1,
        min_reader_schema: 1,
        ..DataDirManifest::new(&network(), "aletheiad 0.1.0")
    };
    DataDir::create(&scratch(name), manifest).unwrap()
}

fn tip_ok(_: &dyn KvStore) -> Result<(), AletheiaError> {
    Ok(())
}

#[test]
fn an_uninterrupted_migration_upgrades_the_schema() {
    let mut datadir = schema_1_dir("clean");
    assert_eq!(
        decide(datadir.manifest(), &network(), 2),
        Ok(StartupAction::Migrate { from: 1, to: 2 })
    );
    let store = populated_store();
    let step = RenameV1ToV2::new(None);
    migrate(&mut datadir, &store, &[&step], 2, &tip_ok).unwrap();
    assert_eq!(datadir.manifest().storage_schema, 2);
    assert_eq!(datadir.manifest().migration_in_progress, None);
    assert!(
        datadir.path("migrations/pre-1").exists(),
        "pre-migration checkpoint is kept"
    );
    assert_eq!(
        store.get(ColumnFamily::Meta, &v2_key(KEYS - 1)).unwrap(),
        Some((KEYS - 1).to_le_bytes().to_vec())
    );
}

#[test]
fn a_crash_mid_step_resumes_from_the_journal_and_converges() {
    let root = scratch("crash");
    let manifest = DataDirManifest {
        storage_schema: 1,
        ..DataDirManifest::new(&network(), "aletheiad 0.1.0")
    };
    let store = populated_store();
    {
        let mut datadir = DataDir::create(&root, manifest).unwrap();
        let crashing = RenameV1ToV2::new(Some(15_000));
        let error = migrate(&mut datadir, &store, &[&crashing], 2, &tip_ok).unwrap_err();
        assert_eq!(error.code(), ErrorCode::StoMigrationFailed);
        assert!(
            datadir.manifest().migration_in_progress.is_some(),
            "the marker survives the crash"
        );
    }

    // Restart: the manifest says a migration is in progress; startup resumes it.
    let mut datadir = DataDir::open(&root).unwrap();
    assert!(matches!(
        decide(datadir.manifest(), &network(), 2),
        Ok(StartupAction::ResumeMigration(_))
    ));
    let resumed = RenameV1ToV2::new(None);
    migrate(&mut datadir, &store, &[&resumed], 2, &tip_ok).unwrap();
    assert_eq!(
        resumed.resumed_from.take(),
        Some(v1_key(9_999)),
        "journal at the 10,000th key"
    );
    assert_eq!(
        resumed.processed.get(),
        KEYS - 15_000,
        "work already done before the crash is not repeated"
    );
    assert_eq!(datadir.manifest().storage_schema, 2);
    resumed.verify(&store).unwrap();
}

#[test]
fn rollback_restores_the_checkpoint_and_keeps_the_old_schema() {
    let root = scratch("rollback");
    let manifest = DataDirManifest {
        storage_schema: 1,
        ..DataDirManifest::new(&network(), "aletheiad 0.1.0")
    };
    let store = populated_store();
    let mut datadir = DataDir::create(&root, manifest).unwrap();
    let crashing = RenameV1ToV2::new(Some(2_000));
    assert!(migrate(&mut datadir, &store, &[&crashing], 2, &tip_ok).is_err());

    let checkpoint = root.join(
        &datadir
            .manifest()
            .migration_in_progress
            .as_ref()
            .unwrap()
            .checkpoint_dir,
    );
    let restored = MemoryKvStore::open_checkpoint(&checkpoint).unwrap();
    mark_rolled_back(&mut datadir).unwrap();
    assert_eq!(datadir.manifest().storage_schema, 1);
    assert_eq!(datadir.manifest().migration_in_progress, None);
    assert_eq!(
        restored.get(ColumnFamily::Meta, &v1_key(0)).unwrap(),
        Some(0u32.to_le_bytes().to_vec())
    );
    assert_eq!(restored.get(ColumnFamily::Meta, &v2_key(0)).unwrap(), None);
}

#[test]
fn a_failed_tip_check_leaves_the_migration_marked_in_progress() {
    let mut datadir = schema_1_dir("tip");
    let store = populated_store();
    let step = RenameV1ToV2::new(None);
    let broken = |_: &dyn KvStore| {
        Err(AletheiaError::new(
            ErrorCode::StoArchiveMismatch,
            "tip hash differs".to_owned(),
        ))
    };
    let error = migrate(&mut datadir, &store, &[&step], 2, &broken).unwrap_err();
    assert_eq!(error.code(), ErrorCode::StoMigrationFailed);
    assert_eq!(datadir.manifest().storage_schema, 1);
    assert!(datadir.manifest().migration_in_progress.is_some());
}

#[test]
fn a_missing_step_is_refused() {
    let mut datadir = schema_1_dir("missing-step");
    let store = MemoryKvStore::new();
    let error = migrate(&mut datadir, &store, &[], 2, &tip_ok).unwrap_err();
    assert_eq!(error.code(), ErrorCode::StoMigrationFailed);
}
