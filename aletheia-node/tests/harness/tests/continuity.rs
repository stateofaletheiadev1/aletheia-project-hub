//! Continuity on a single node (spec 62.1, Phase 3): mixed-version history, historical replay
//! under each block's own rules, and the clean halt at the edge of the binary's knowledge.
//! Needs the test-only protocol version 2: `cargo test --features test-protocol-v2`.

#![cfg(feature = "test-protocol-v2")]
#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_core::{AssetId, ErrorCode, Height, Payload};
use aletheia_execution::continuity::rules_for_height;
use aletheia_execution::{ReceiptStatus, Rules};
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};

fn remark(net: &Devnet, from: usize, nonce: u64) -> aletheia_core::SignedTransaction {
    net.sign(
        from,
        net.body(from, nonce, Payload::TestRemark(b"hello v2".to_vec())),
    )
}

/// Blocks 1-2 under version 1, version 2 from height 3.
fn upgraded_history() -> Devnet {
    let mut net = Devnet::new(3, 100 * ONE_AEY, 100 * ONE_ALNT);
    net.schedule_upgrade(2, 3);
    let b = net.address(1);
    net.produce(vec![net.transfer(0, 0, b, AssetId::AEY, ONE_AEY)])
        .unwrap();
    net.produce(vec![net.transfer(0, 1, b, AssetId::AEY, ONE_AEY)])
        .unwrap();
    net.produce(vec![
        remark(&net, 0, 2),
        net.transfer(1, 0, net.address(2), AssetId::ALNT, 5),
    ])
    .unwrap();
    net.produce(vec![remark(&net, 2, 0)]).unwrap();
    net
}

#[test]
fn the_new_type_is_inactive_before_activation_and_active_after() {
    let mut net = Devnet::new(2, 0, 100 * ONE_ALNT);
    net.schedule_upgrade(2, 3);
    net.produce(vec![]).unwrap(); // height 1 records the schedule
    let early = net.verify(&[remark(&net, 0, 0)]).unwrap_err();
    assert_eq!(
        early.code(),
        ErrorCode::TxTypeNotActive,
        "height 2 still runs version 1"
    );
    net.produce(vec![]).unwrap(); // height 2
    let (proposal, executed) = net.produce(vec![remark(&net, 0, 0)]).unwrap(); // height 3
    assert_eq!(proposal.block.header.version.get(), 2);
    assert_eq!(executed.receipts[0].status, ReceiptStatus::Success);
    assert_eq!(executed.receipts[0].eu_used, 500);
}

#[test]
fn headers_carry_the_version_the_schedule_assigns() {
    let net = upgraded_history();
    let versions: Vec<u16> = net
        .blocks
        .iter()
        .map(|(p, _)| p.block.header.version.get())
        .collect();
    assert_eq!(versions, [1, 1, 2, 2]);
    let view = net.view();
    let records = net.records();
    assert_eq!(
        rules_for_height(&records, &view, Height::new(2)).unwrap().0,
        Rules::V1
    );
    assert_eq!(
        rules_for_height(&records, &view, Height::new(3)).unwrap().0,
        Rules::TestV2
    );
}

/// Replaying a mixed-version history from genesis reproduces every root: each block runs under
/// the rules of its own version (continuity guarantee, Section 44.1).
#[test]
fn replay_from_genesis_reproduces_every_root_across_the_upgrade() {
    let original = upgraded_history();
    let mut replay = Devnet::from_genesis(
        original.genesis.clone(),
        aletheia_test_harness::keys(original.keys.len()),
    );
    replay.schedule_upgrade(2, 3);
    for (proposal, _) in &original.blocks {
        let txs = proposal.block.body.transactions.clone();
        let verified = replay.verify(&txs).unwrap();
        let (replayed, _) = replay.execute_ordered(verified).unwrap();
        assert_eq!(
            replayed.block.header, proposal.block.header,
            "height {}",
            proposal.block.header.height
        );
    }
}

#[test]
fn a_version_this_binary_does_not_know_halts_cleanly() {
    let mut net = Devnet::new(1, 0, ONE_ALNT);
    net.schedule_upgrade(2, 2);
    net.schedule_upgrade(3, 3);
    net.produce(vec![]).unwrap();
    net.produce(vec![]).unwrap();
    let error = net.produce(vec![]).unwrap_err();
    assert_eq!(error.code(), ErrorCode::ProtocolUpgradeRequired);
    assert!(error.is_fail_stop());
    assert!(
        error
            .detail()
            .contains("Protocol version 3 activates at height 3"),
        "{}",
        error.detail()
    );
    assert!(
        error.detail().contains("supports protocol versions 1-2"),
        "{}",
        error.detail()
    );
    assert_eq!(
        net.head.height.get(),
        2,
        "nothing past the edge was executed"
    );
}
