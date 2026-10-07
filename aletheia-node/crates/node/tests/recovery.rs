//! Finalize path and crash recovery (spec Sections 24.3, 52; Phase 3 "recovery tests green").
//! Crash points need `--features fault-injection`.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::path::PathBuf;
use std::sync::Arc;

use aletheia_core::{AssetId, ErrorCode, Height};
use aletheia_node::{Ledger, Reconciled};
use aletheia_storage::MemoryKvStore;
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-ledger-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

/// A proposer devnet and three blocks of transfers built on it.
fn proposer_with_blocks(count: usize) -> Devnet {
    let mut net = Devnet::new(3, 100 * ONE_AEY, 100 * ONE_ALNT);
    for i in 0..count {
        let b = net.address(1);
        net.produce(vec![net.transfer(0, u64::try_from(i).unwrap(), b, AssetId::AEY, ONE_AEY)])
            .unwrap();
    }
    net
}

#[test]
fn a_validator_ledger_re_executes_and_finalizes_the_proposers_blocks() {
    let net = proposer_with_blocks(3);
    let store = Arc::new(MemoryKvStore::new());
    let root = scratch("follow");
    let mut ledger = Ledger::init(&root, &net.genesis, store.clone()).unwrap();
    for (proposal, _) in &net.blocks {
        ledger.apply(proposal).unwrap();
    }
    assert_eq!(ledger.tip().height, Height::new(3));
    assert_eq!(ledger.tip().state_root, net.head.state_root);
    ledger.shutdown().unwrap();

    let (reopened, reconciled) = Ledger::open(&root, &net.genesis, store).unwrap();
    assert_eq!(reconciled, Reconciled::Clean);
    assert_eq!(reopened.tip().hash, net.head.block_hash(&net.network));
}

#[test]
fn a_block_with_a_wrong_root_is_rejected_before_anything_is_written() {
    let net = proposer_with_blocks(1);
    let store = Arc::new(MemoryKvStore::new());
    let mut ledger = Ledger::init(&scratch("wrong-root"), &net.genesis, store).unwrap();
    let mut forged = net.blocks[0].0.clone();
    forged.block.header.state_root = aletheia_core::Hash32::from_bytes([1; 32]);
    assert_eq!(
        ledger.apply(&forged).unwrap_err().code(),
        ErrorCode::BlkRootMismatch
    );
    assert_eq!(ledger.tip().height, Height::GENESIS);
}

#[test]
fn a_block_that_does_not_extend_the_tip_is_rejected() {
    let net = proposer_with_blocks(2);
    let store = Arc::new(MemoryKvStore::new());
    let mut ledger = Ledger::init(&scratch("skip"), &net.genesis, store).unwrap();
    assert_eq!(
        ledger.apply(&net.blocks[1].0).unwrap_err().code(),
        ErrorCode::BlkParentMismatch
    );
}

#[test]
fn a_second_process_cannot_open_a_running_ledger() {
    let net = proposer_with_blocks(0);
    let store = Arc::new(MemoryKvStore::new());
    let root = scratch("lock");
    let _running = Ledger::init(&root, &net.genesis, store.clone()).unwrap();
    assert_eq!(
        Ledger::open(&root, &net.genesis, store).unwrap_err().code(),
        ErrorCode::StoDataDirLocked
    );
}

#[test]
fn a_directory_from_another_genesis_is_refused() {
    let net = proposer_with_blocks(0);
    let other = Devnet::new(5, ONE_AEY, ONE_ALNT);
    let store = Arc::new(MemoryKvStore::new());
    let root = scratch("other-genesis");
    Ledger::init(&root, &net.genesis, store.clone())
        .unwrap()
        .shutdown()
        .unwrap();
    assert_eq!(
        Ledger::open(&root, &other.genesis, store)
            .unwrap_err()
            .code(),
        ErrorCode::StoDataDirWrongChain
    );
}

#[test]
fn a_damaged_tip_block_in_the_archive_refuses_to_start() {
    let net = proposer_with_blocks(1);
    let store = Arc::new(MemoryKvStore::new());
    let root = scratch("damaged-archive");
    let mut ledger = Ledger::init(&root, &net.genesis, store.clone()).unwrap();
    ledger.apply(&net.blocks[0].0).unwrap();
    ledger.shutdown().unwrap();
    let segment = root.join("blocks").join("seg-000000000000.blk");
    let mut bytes = std::fs::read(&segment).unwrap();
    let last = bytes.len() - 10;
    bytes[last] ^= 0xff;
    std::fs::write(&segment, bytes).unwrap();
    let error = Ledger::open(&root, &net.genesis, store).unwrap_err();
    assert!(
        matches!(
            error.code(),
            ErrorCode::StoCorrupt | ErrorCode::StoArchiveMismatch
        ),
        "{error}"
    );
}

#[cfg(feature = "fault-injection")]
mod crash_points {
    use super::*;
    use aletheia_node::ledger::CrashPoint;

    fn crash_finalizing_block_two(
        point: CrashPoint,
        name: &str,
    ) -> (PathBuf, Arc<MemoryKvStore>, Devnet) {
        let net = proposer_with_blocks(3);
        let store = Arc::new(MemoryKvStore::new());
        let root = scratch(name);
        let mut ledger = Ledger::init(&root, &net.genesis, store.clone()).unwrap();
        ledger.apply(&net.blocks[0].0).unwrap();
        ledger.crash_at(point);
        assert!(ledger.apply(&net.blocks[1].0).is_err(), "simulated crash");
        drop(ledger); // no clean shutdown
        (root, store, net)
    }

    #[test]
    fn crash_after_finalize_begin_abandons_the_block_and_accepts_it_again() {
        let (root, store, net) =
            crash_finalizing_block_two(CrashPoint::AfterFinalizeBegin, "crash-begin");
        let (mut ledger, reconciled) = Ledger::open(&root, &net.genesis, store).unwrap();
        assert_eq!(reconciled, Reconciled::Abandoned(Height::new(2)));
        assert_eq!(ledger.tip().height, Height::new(1));
        ledger.apply(&net.blocks[1].0).unwrap();
        ledger.apply(&net.blocks[2].0).unwrap();
        assert_eq!(ledger.tip().state_root, net.head.state_root);
    }

    #[test]
    fn crash_after_archive_append_re_executes_the_archived_block() {
        let (root, store, net) =
            crash_finalizing_block_two(CrashPoint::AfterArchiveAppend, "crash-archive");
        let (mut ledger, reconciled) = Ledger::open(&root, &net.genesis, store).unwrap();
        assert_eq!(reconciled, Reconciled::ReExecuted(Height::new(2)));
        assert_eq!(
            ledger.tip().hash,
            net.blocks[1].0.block.header.block_hash(&net.network)
        );
        ledger.apply(&net.blocks[2].0).unwrap();
        assert_eq!(ledger.tip().state_root, net.head.state_root);
    }

    #[test]
    fn crash_after_kv_commit_records_the_commit() {
        let (root, store, net) = crash_finalizing_block_two(CrashPoint::AfterKvCommit, "crash-kv");
        let (mut ledger, reconciled) = Ledger::open(&root, &net.genesis, store.clone()).unwrap();
        assert_eq!(reconciled, Reconciled::CommitRecorded(Height::new(2)));
        ledger.apply(&net.blocks[2].0).unwrap();
        assert_eq!(ledger.tip().state_root, net.head.state_root);
        drop(ledger);
        // A second restart finds nothing left to reconcile.
        let (_, again) = Ledger::open(&root, &net.genesis, store).unwrap();
        assert_eq!(again, Reconciled::Clean);
    }
}
