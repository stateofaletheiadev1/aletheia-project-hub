//! Phase 4 exit (spec Section 62): a 7-node private network syncs. One devnet producer stands
//! in for consensus; every other node re-executes and finalizes each block it receives.
//! Needs `--features devnet-producer`.

#![cfg(feature = "devnet-producer")]
#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use aletheia_core::{AssetId, Height, NetworkKind};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use aletheia_node::{Node, NodeConfig};
use aletheia_p2p::{DialTarget, PeerExpectation};
use aletheia_storage::MemoryKvStore;
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};

const BLOCK_EVERY: Duration = Duration::from_millis(150);
const WAIT: Duration = Duration::from_secs(60);

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-net-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn dial(addresses: &[SocketAddr]) -> Vec<DialTarget> {
    addresses
        .iter()
        .map(|&address| DialTarget {
            address,
            expect: PeerExpectation::default(),
        })
        .collect()
}

async fn start(
    index: u8,
    devnet: &Devnet,
    peers: Vec<DialTarget>,
    produce: bool,
    test: &str,
) -> Node {
    let config = NodeConfig {
        data_dir: scratch(&format!("{test}-{index}")),
        genesis: devnet.genesis.clone(),
        listen: "127.0.0.1:0".parse().unwrap(),
        peers,
        node_key: Ed25519SigningKey::from_seed(&Secret::new([100 + index; 32])),
        produce_every: produce.then_some(BLOCK_EVERY),
        consensus_key: None,
        remote_signer: None,
    };
    Node::start(config, Arc::new(MemoryKvStore::new()))
        .await
        .unwrap()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn seven_nodes_converge_on_the_same_chain_with_gossiped_transactions() {
    let devnet = Devnet::new(4, 1_000 * ONE_AEY, 1_000 * ONE_ALNT);
    let genesis_root = devnet.head.state_root;

    let mut nodes = vec![start(0, &devnet, vec![], true, "seven").await];
    for index in 1..7u8 {
        let mut targets = vec![nodes[0].local_addr()];
        targets.push(nodes[usize::from(index) - 1].local_addr());
        targets.dedup();
        nodes.push(start(index, &devnet, dial(&targets), false, "seven").await);
    }

    // Submitted to node 3 only: it must reach the producer by gossip.
    let recipient = devnet.address(3);
    for nonce in 0..5 {
        nodes[3]
            .submit(devnet.transfer(0, nonce, recipient, AssetId::AEY, ONE_AEY))
            .await
            .unwrap();
        nodes[3]
            .submit(devnet.transfer(1, nonce, recipient, AssetId::ALNT, 7))
            .await
            .unwrap();
    }

    let target = Height::new(20);
    let produced = nodes[0].wait_for_height(target, WAIT).await.unwrap();
    for (index, node) in nodes.iter_mut().enumerate() {
        let tip = node
            .wait_for_height(target, WAIT)
            .await
            .unwrap_or_else(|e| panic!("node {index}: {e}"));
        assert!(tip.height >= target);
    }
    // Every node holds exactly the producer's block at the target height.
    let reference = nodes[0]
        .block_at(target)
        .await
        .unwrap()
        .expect("producer has the block");
    let network = devnet.genesis.network();
    let reference_hash = reference.block.header.block_hash(&network);
    for (index, node) in nodes.iter().enumerate().skip(1) {
        let block = node
            .block_at(target)
            .await
            .unwrap()
            .unwrap_or_else(|| panic!("node {index} lacks height {target}"));
        assert_eq!(
            block.block.header.block_hash(&network),
            reference_hash,
            "node {index}"
        );
        assert_eq!(
            block.block.header.state_root, reference.block.header.state_root,
            "node {index}"
        );
    }
    let mut included = 0;
    for height in 1..=target.get() {
        included += nodes[0]
            .block_at(Height::new(height))
            .await
            .unwrap()
            .map_or(0, |b| b.block.body.transactions.len());
    }
    assert!(produced.height >= target);
    assert_eq!(included, 10, "all ten gossiped transfers were included");
    assert_ne!(reference.block.header.state_root, genesis_root);

    for node in nodes {
        node.shutdown().await.unwrap();
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_late_node_catches_up_from_genesis_in_batches() {
    let devnet = Devnet::new(2, 1_000 * ONE_AEY, 1_000 * ONE_ALNT);
    let mut producer = start(0, &devnet, vec![], true, "late").await;
    producer
        .wait_for_height(Height::new(80), WAIT)
        .await
        .unwrap();

    // 80+ blocks behind: more than one GetBlocks batch of 64.
    let mut late = start(1, &devnet, dial(&[producer.local_addr()]), false, "late").await;
    let goal = producer.tip().height;
    let tip = late.wait_for_height(goal, WAIT).await.unwrap();
    assert!(tip.height >= goal);
    let at_goal = producer.tip();
    let caught = late.wait_for_height(at_goal.height, WAIT).await.unwrap();
    if caught.height == at_goal.height {
        assert_eq!(caught.hash, at_goal.hash);
        assert_eq!(caught.state_root, at_goal.state_root);
    }
    late.shutdown().await.unwrap();
    producer.shutdown().await.unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_node_restarts_from_its_data_directory_and_keeps_following() {
    let devnet = Devnet::new(1, 0, ONE_ALNT);
    let producer = start(0, &devnet, vec![], true, "restart").await;
    let store = Arc::new(MemoryKvStore::new());
    let data_dir = scratch("restart-follower");
    let follower_config = |peers| NodeConfig {
        data_dir: data_dir.clone(),
        genesis: devnet.genesis.clone(),
        listen: "127.0.0.1:0".parse().unwrap(),
        peers,
        node_key: Ed25519SigningKey::from_seed(&Secret::new([42; 32])),
        produce_every: None,
        consensus_key: None,
        remote_signer: None,
    };
    let mut follower = Node::start(
        follower_config(dial(&[producer.local_addr()])),
        store.clone(),
    )
    .await
    .unwrap();
    follower
        .wait_for_height(Height::new(10), WAIT)
        .await
        .unwrap();
    let before = follower.tip();
    follower.shutdown().await.unwrap();

    let mut restarted = Node::start(follower_config(dial(&[producer.local_addr()])), store)
        .await
        .unwrap();
    assert!(
        restarted.tip().height >= before.height,
        "resumed from its own data directory"
    );
    restarted
        .wait_for_height(Height::new(before.height.get() + 10), WAIT)
        .await
        .unwrap();
    restarted.shutdown().await.unwrap();
    producer.shutdown().await.unwrap();
}

#[tokio::test]
async fn the_devnet_producer_is_refused_on_mainnet() {
    let devnet = Devnet::new(1, 0, ONE_ALNT);
    let mut genesis = devnet.genesis.clone();
    genesis.network_kind = NetworkKind::Mainnet;
    let config = NodeConfig {
        data_dir: scratch("mainnet-producer"),
        genesis,
        listen: "127.0.0.1:0".parse().unwrap(),
        peers: vec![],
        node_key: Ed25519SigningKey::from_seed(&Secret::new([1; 32])),
        produce_every: Some(BLOCK_EVERY),
        consensus_key: None,
        remote_signer: None,
    };
    let error = Node::start(config, Arc::new(MemoryKvStore::new()))
        .await
        .unwrap_err();
    assert!(error.detail().contains("refused on mainnet"), "{error}");
}
