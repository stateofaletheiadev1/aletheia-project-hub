//! Speculative execution (spec Section 19.3): blocks execute on parents that are not final,
//! forks coexist until one is finalized, and only finalized blocks reach disk.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::path::PathBuf;
use std::sync::Arc;

use aletheia_core::block::{Proposal, QuorumCertificate};
use aletheia_core::{AceEncode, AssetId, Epoch, ErrorCode, Hash32, Height, Slot, ValidatorIndex};
use aletheia_node::Ledger;
use aletheia_node::ledger::BuildParams;
use aletheia_storage::MemoryKvStore;
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-spec-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn setup(name: &str) -> (Devnet, Ledger<Arc<MemoryKvStore>>) {
    let net = Devnet::new(3, 100 * ONE_AEY, 100 * ONE_ALNT);
    let ledger =
        Ledger::init(&scratch(name), &net.genesis, Arc::new(MemoryKvStore::new())).unwrap();
    (net, ledger)
}

fn params(parent: Hash32, slot: u64) -> BuildParams {
    let mut parent_qc = QuorumCertificate::genesis();
    parent_qc.block_hash = parent;
    BuildParams {
        slot: Slot::new(slot),
        epoch: Epoch::new(0),
        proposer: ValidatorIndex::new(0),
        parent_qc,
        timeout_cert: None,
    }
}

/// A block on `parent` carrying a transfer from account 0 with `nonce`, or empty.
fn build(
    net: &Devnet,
    ledger: &Ledger<Arc<MemoryKvStore>>,
    parent: Hash32,
    slot: u64,
    nonce: Option<u64>,
) -> Proposal {
    let candidates = nonce
        .map(|nonce| {
            let tx = net.transfer(0, nonce, net.address(1), AssetId::AEY, ONE_AEY);
            vec![ledger.admit(&tx.to_ace_bytes()).unwrap().0]
        })
        .unwrap_or_default();
    ledger.build(candidates, params(parent, slot)).unwrap()
}

fn hash(net: &Devnet, proposal: &Proposal) -> Hash32 {
    proposal.block.header.block_hash(&net.network)
}

#[test]
fn a_child_executes_on_its_parents_speculative_state() {
    let (net, mut ledger) = setup("chain");
    let genesis = ledger.tip().hash;
    let a = build(&net, &ledger, genesis, 1, Some(0));
    assert_eq!(a.block.body.transactions.len(), 1);
    ledger.execute_speculative(&a).unwrap();
    // Nonce 1 is valid only on top of A's state, which exists only in memory.
    let b = build(&net, &ledger, hash(&net, &a), 2, Some(1));
    assert_eq!(
        b.block.body.transactions.len(),
        1,
        "the builder saw A's nonce"
    );
    ledger.execute_speculative(&b).unwrap();
    assert_eq!(ledger.tip().height, Height::GENESIS, "nothing is final yet");

    ledger.finalize_speculative(&hash(&net, &a), None).unwrap();
    ledger.finalize_speculative(&hash(&net, &b), None).unwrap();
    assert_eq!(ledger.tip().height, Height::new(2));
    assert_eq!(ledger.tip().state_root, b.block.header.state_root);
    assert_eq!(ledger.next_nonce(&net.address(0)).unwrap(), 2);
    assert_eq!(ledger.speculative_len(), 0);
}

#[test]
fn finalizing_one_fork_drops_the_other_and_its_descendants() {
    let (net, mut ledger) = setup("fork");
    let genesis = ledger.tip().hash;
    let left = build(&net, &ledger, genesis, 1, Some(0));
    let right = build(&net, &ledger, genesis, 2, None);
    ledger.execute_speculative(&left).unwrap();
    ledger.execute_speculative(&right).unwrap();
    let left_child = build(&net, &ledger, hash(&net, &left), 3, Some(1));
    ledger.execute_speculative(&left_child).unwrap();
    assert_eq!(ledger.speculative_len(), 3);

    ledger
        .finalize_speculative(&hash(&net, &right), None)
        .unwrap();
    assert_eq!(
        ledger.speculative_len(),
        0,
        "the left branch no longer descends from the tip"
    );
    assert_eq!(
        ledger.next_nonce(&net.address(0)).unwrap(),
        0,
        "the left transfer never happened"
    );
    let error = ledger
        .finalize_speculative(&hash(&net, &left_child), None)
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::FinalizeParentMismatch);
    assert!(error.is_fail_stop());
}

#[test]
fn a_block_on_an_unknown_parent_is_refused() {
    let (net, mut ledger) = setup("unknown");
    let genesis = ledger.tip().hash;
    let a = build(&net, &ledger, genesis, 1, None);
    let error = ledger
        .build(Vec::new(), params(hash(&net, &a), 2))
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::BlkParentMismatch);

    let mut orphan = a.clone();
    orphan.block.header.parent_hash = Hash32::from_bytes([9; 32]);
    let error = ledger.execute_speculative(&orphan).unwrap_err();
    assert_eq!(error.code(), ErrorCode::BlkParentMismatch);
    assert!(
        !error.is_fail_stop(),
        "a peer's bad block never stops the node"
    );
}

#[test]
fn a_speculative_block_with_a_wrong_root_is_rejected_and_not_kept() {
    let (net, mut ledger) = setup("root");
    let genesis = ledger.tip().hash;
    let mut a = build(&net, &ledger, genesis, 1, Some(0));
    a.block.header.state_root = Hash32::from_bytes([7; 32]);
    assert!(ledger.execute_speculative(&a).is_err());
    assert_eq!(ledger.speculative_len(), 0);
}

#[test]
fn a_block_committing_to_the_wrong_validator_set_is_rejected() {
    let (net, mut ledger) = setup("valset");
    let genesis = ledger.tip().hash;
    let mut a = build(&net, &ledger, genesis, 1, None);
    a.block.header.validator_set_hash = Hash32::from_bytes([5; 32]);
    let error = ledger.execute_speculative(&a).unwrap_err();
    assert_eq!(error.code(), ErrorCode::BlkValidatorSetMismatch);
}
