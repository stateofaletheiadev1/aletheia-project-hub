//! Data directory: creation, locking, manifest integrity and the startup decision table
//! (spec Section 44.5, Phase 2 amendment: refuse-newer test).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic
)]

use aletheia_core::{ChainId, ErrorCode, Hash32, Height, NetworkIdentity, NetworkKind};
use aletheia_storage::datadir::{
    BINARY_STORAGE_SCHEMA, DataDir, DataDirManifest, LastFinalized, MigrationInProgress,
    StartupAction, decide,
};

fn network() -> NetworkIdentity {
    NetworkIdentity::new(
        ChainId::new(7771),
        NetworkKind::Devnet,
        Hash32::from_bytes([1; 32]),
    )
}

fn scratch(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-datadir-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

#[test]
fn create_then_reopen_round_trips_the_manifest() {
    let root = scratch("roundtrip");
    let mut manifest = DataDirManifest::new(&network(), "aletheiad 0.1.0");
    manifest.last_finalized = Some(LastFinalized {
        height: Height::new(42),
        hash: Hash32::from_bytes([2; 32]),
        state_root: Hash32::from_bytes([3; 32]),
    });
    {
        let dir = DataDir::create(&root, manifest.clone()).unwrap();
        for sub in aletheia_storage::datadir::SUBDIRECTORIES {
            assert!(dir.path(sub).is_dir(), "{sub} created");
        }
    }
    let reopened = DataDir::open(&root).unwrap();
    assert_eq!(reopened.manifest(), &manifest);
    assert!(
        std::fs::read_to_string(root.join("DATADIR.txt"))
            .unwrap()
            .contains("height 42")
    );
    drop(reopened);
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_second_process_cannot_open_a_locked_directory() {
    let root = scratch("lock");
    let _first =
        DataDir::create(&root, DataDirManifest::new(&network(), "aletheiad 0.1.0")).unwrap();
    // A separate open file description: the lock is per open file, so this models a second process.
    let error = DataDir::open(&root).unwrap_err();
    assert_eq!(error.code(), ErrorCode::StoDataDirLocked);
}

#[test]
fn an_existing_directory_is_never_re_initialized() {
    let root = scratch("reinit");
    drop(DataDir::create(&root, DataDirManifest::new(&network(), "aletheiad 0.1.0")).unwrap());
    assert!(DataDir::create(&root, DataDirManifest::new(&network(), "aletheiad 0.1.0")).is_err());
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_corrupted_manifest_is_refused() {
    let root = scratch("corrupt");
    drop(DataDir::create(&root, DataDirManifest::new(&network(), "aletheiad 0.1.0")).unwrap());
    let path = root.join("DATADIR");
    let mut bytes = std::fs::read(&path).unwrap();
    bytes[14] ^= 0xff;
    std::fs::write(&path, bytes).unwrap();
    assert_eq!(
        DataDir::open(&root).unwrap_err().code(),
        ErrorCode::StoCorrupt
    );
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_missing_directory_is_reported_as_missing() {
    assert_eq!(
        DataDir::open(&scratch("missing")).unwrap_err().code(),
        ErrorCode::StoDataDirMissing
    );
}

#[test]
fn decision_table_follows_section_44_5() {
    let base = DataDirManifest::new(&network(), "aletheiad 0.1.0");
    assert_eq!(
        decide(&base, &network(), BINARY_STORAGE_SCHEMA),
        Ok(StartupAction::Recover)
    );

    let older = DataDirManifest {
        storage_schema: 1,
        ..base.clone()
    };
    assert_eq!(
        decide(&older, &network(), 3),
        Ok(StartupAction::Migrate { from: 1, to: 3 })
    );

    let newer_but_readable = DataDirManifest {
        storage_schema: 4,
        min_reader_schema: 2,
        ..base.clone()
    };
    assert_eq!(
        decide(&newer_but_readable, &network(), 3),
        Ok(StartupAction::OpenNewer { schema: 4 })
    );

    let too_new = DataDirManifest {
        storage_schema: 9,
        min_reader_schema: 8,
        last_writer_release: "aletheiad 2.6.0".to_owned(),
        ..base.clone()
    };
    let error = decide(&too_new, &network(), 7).unwrap_err();
    assert_eq!(error.code(), ErrorCode::StoDataDirTooNew);
    assert_eq!(
        error.detail(),
        "data directory written by aletheiad 2.6.0 (schema 9); this binary reads schema <= 7"
    );

    let migrating = MigrationInProgress {
        from: 1,
        to: 2,
        step: 1,
        checkpoint_dir: "migrations/pre-1".to_owned(),
    };
    let interrupted = DataDirManifest {
        migration_in_progress: Some(migrating.clone()),
        ..base
    };
    assert_eq!(
        decide(&interrupted, &network(), 2),
        Ok(StartupAction::ResumeMigration(migrating))
    );
}

#[test]
fn a_directory_from_another_chain_is_refused_never_fixed_up() {
    let manifest = DataDirManifest::new(&network(), "aletheiad 0.1.0");
    for other in [
        NetworkIdentity::new(
            ChainId::new(1),
            NetworkKind::Devnet,
            Hash32::from_bytes([1; 32]),
        ),
        NetworkIdentity::new(
            ChainId::new(7771),
            NetworkKind::Mainnet,
            Hash32::from_bytes([1; 32]),
        ),
        NetworkIdentity::new(
            ChainId::new(7771),
            NetworkKind::Devnet,
            Hash32::from_bytes([9; 32]),
        ),
    ] {
        assert_eq!(
            decide(&manifest, &other, BINARY_STORAGE_SCHEMA)
                .unwrap_err()
                .code(),
            ErrorCode::StoDataDirWrongChain
        );
    }
}
