//! DSP in running nodes (spec Section 19; Phase 5 exit): validators connected over TLS agree
//! on one chain with no producer, include gossiped transactions, survive a validator restart
//! and serve an observer.

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

use aletheia_core::{AssetId, Height, NetworkIdentity};
use aletheia_crypto::{BlsSecretKey, Ed25519SigningKey, Secret};
use aletheia_execution::{GenesisConfig, GenesisState};
use aletheia_node::{Node, NodeConfig};
use aletheia_p2p::{DialTarget, PeerExpectation};
use aletheia_storage::MemoryKvStore;
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT, keys};

const WAIT: Duration = Duration::from_secs(90);
const SLOT_MS: u64 = 100;

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-dsp-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn consensus_key(index: u8) -> BlsSecretKey {
    BlsSecretKey::from_key_material(&Secret::new([200 + index; 32])).unwrap()
}

fn node_key(index: u8) -> Ed25519SigningKey {
    Ed25519SigningKey::from_seed(&Secret::new([100 + index; 32]))
}

/// A devnet genesis with `validators` validators and two funded accounts (harness keys 0, 1).
fn genesis(validators: u8) -> GenesisState {
    let pre_genesis = NetworkIdentity::new(
        aletheia_core::ChainId::new(7771),
        aletheia_core::NetworkKind::Devnet,
        aletheia_core::Hash32::ZERO,
    );
    let mut toml = format!(
        "[chain]\nchain_id = 7771\nnetwork = \"devnet\"\nprotocol_version = 1\ngenesis_time_ms = 1767225600000\nslot_duration_ms = {SLOT_MS}\n\n[fees]\neu_price_aey = \"1000000000\"\neu_price_alnt = \"1\"\n"
    );
    for key in keys(2) {
        let address = aletheia_crypto::address::ed25519_account(&pre_genesis, &key.public_key())
            .to_text(aletheia_core::NetworkKind::Devnet);
        toml.push_str(&format!(
            "\n[[allocations]]\naddress = \"{address}\"\nasset = \"AEY\"\nunits = \"{}\"\n\n[[allocations]]\naddress = \"{address}\"\nasset = \"ALnT\"\nunits = \"{}\"\n",
            1_000 * ONE_AEY,
            1_000 * ONE_ALNT
        ));
    }
    for index in 0..validators {
        let key = consensus_key(index);
        toml.push_str(&format!(
            "\n[[validators]]\nconsensus_key = \"{}\"\nproof_of_possession = \"{}\"\nnode_key = \"{}\"\n",
            aletheia_core::base16::encode(&key.public_key().to_bytes()),
            aletheia_core::base16::encode(&key.prove_possession(&pre_genesis).to_bytes()),
            aletheia_core::base16::encode(&node_key(index).public_key().to_bytes()),
        ));
    }
    GenesisConfig::from_toml(&toml).unwrap().to_state().unwrap()
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

struct Member {
    data_dir: PathBuf,
    store: Arc<MemoryKvStore>,
}

fn config(
    member: &Member,
    genesis: &GenesisState,
    index: u8,
    peers: Vec<DialTarget>,
    validator: bool,
) -> NodeConfig {
    NodeConfig {
        data_dir: member.data_dir.clone(),
        genesis: genesis.clone(),
        listen: "127.0.0.1:0".parse().unwrap(),
        peers,
        node_key: node_key(index),
        produce_every: None,
        consensus_key: validator.then(|| consensus_key(index)),
        remote_signer: None,
    }
}

/// Starts `count` validators, each dialing every earlier one (a full mesh).
async fn start_validators(
    genesis: &GenesisState,
    count: u8,
    test: &str,
) -> (Vec<Member>, Vec<Node>) {
    let mut members = Vec::new();
    let mut nodes: Vec<Node> = Vec::new();
    for index in 0..count {
        let member = Member {
            data_dir: scratch(&format!("{test}-{index}")),
            store: Arc::new(MemoryKvStore::new()),
        };
        let peers = dial(&nodes.iter().map(Node::local_addr).collect::<Vec<_>>());
        let node = Node::start(
            config(&member, genesis, index, peers, true),
            member.store.clone(),
        )
        .await
        .unwrap();
        members.push(member);
        nodes.push(node);
    }
    (members, nodes)
}

async fn hash_at(node: &Node, network: &NetworkIdentity, height: Height) -> aletheia_core::Hash32 {
    node.block_at(height)
        .await
        .unwrap()
        .unwrap_or_else(|| panic!("no block at {height}"))
        .block
        .header
        .block_hash(network)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_validators_finalize_one_chain_with_gossiped_transactions() {
    let genesis = genesis(4);
    let network = genesis.network();
    let devnet = Devnet::from_genesis(genesis.clone(), keys(2));
    let (_members, mut nodes) = start_validators(&genesis, 4, "four").await;

    // Submitted to one validator only; gossip carries them to whichever leader builds next.
    let recipient = devnet.address(1);
    for nonce in 0..5 {
        nodes[2]
            .submit(devnet.transfer(0, nonce, recipient, AssetId::AEY, ONE_AEY))
            .await
            .unwrap();
    }

    let target = Height::new(15);
    for (index, node) in nodes.iter_mut().enumerate() {
        node.wait_for_height(target, WAIT)
            .await
            .unwrap_or_else(|e| panic!("validator {index}: {e}"));
    }
    let reference = hash_at(&nodes[0], &network, target).await;
    for (index, node) in nodes.iter().enumerate().skip(1) {
        assert_eq!(
            hash_at(node, &network, target).await,
            reference,
            "validator {index}"
        );
    }

    let mut included = 0;
    let mut proposers = std::collections::BTreeSet::new();
    for height in 1..=target.get() {
        let block = nodes[0]
            .block_at(Height::new(height))
            .await
            .unwrap()
            .unwrap();
        included += block.block.body.transactions.len();
        proposers.insert(block.block.header.proposer);
        assert_ne!(block.proposer_signature, [0; 96], "every block is signed");
        if height > 1 {
            assert!(
                !block.block.header.parent_qc.signers.is_empty(),
                "height {height} carries a real quorum certificate for its parent"
            );
        }
    }
    assert_eq!(
        included, 5,
        "every gossiped transfer was finalized exactly once"
    );
    assert!(proposers.len() >= 3, "leadership rotates: {proposers:?}");

    for node in nodes {
        node.shutdown().await.unwrap();
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_restarted_validator_catches_up_and_the_rest_never_stop() {
    let genesis = genesis(4);
    let network = genesis.network();
    let (members, mut nodes) = start_validators(&genesis, 4, "restart").await;
    nodes[3]
        .wait_for_height(Height::new(5), WAIT)
        .await
        .unwrap();

    // F = 1: three validators keep finalizing while the fourth is down.
    let stopped = nodes.pop().unwrap();
    let stopped_at = stopped.tip().height;
    stopped.shutdown().await.unwrap();
    let ahead = Height::new(stopped_at.get() + 15);
    for node in &mut nodes {
        node.wait_for_height(ahead, WAIT).await.unwrap();
    }

    // Back with the same data directory, safety data and signer state.
    let peers = dial(&nodes.iter().map(Node::local_addr).collect::<Vec<_>>());
    let mut restarted = Node::start(
        config(&members[3], &genesis, 3, peers, true),
        members[3].store.clone(),
    )
    .await
    .unwrap();
    assert!(
        restarted.tip().height >= stopped_at,
        "recovered its own chain"
    );
    let later = Height::new(ahead.get() + 5);
    restarted.wait_for_height(later, WAIT).await.unwrap();
    for node in &mut nodes {
        node.wait_for_height(later, WAIT).await.unwrap();
    }
    assert_eq!(
        hash_at(&restarted, &network, later).await,
        hash_at(&nodes[0], &network, later).await
    );

    restarted.shutdown().await.unwrap();
    for node in nodes {
        node.shutdown().await.unwrap();
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn an_observer_follows_without_signing() {
    let genesis = genesis(4);
    let network = genesis.network();
    let (_members, mut nodes) = start_validators(&genesis, 4, "observer").await;
    let member = Member {
        data_dir: scratch("observer-x"),
        store: Arc::new(MemoryKvStore::new()),
    };
    let peers = dial(&nodes.iter().map(Node::local_addr).collect::<Vec<_>>());
    let mut observer = Node::start(
        config(&member, &genesis, 9, peers, false),
        member.store.clone(),
    )
    .await
    .unwrap();
    let target = Height::new(10);
    observer.wait_for_height(target, WAIT).await.unwrap();
    nodes[0].wait_for_height(target, WAIT).await.unwrap();
    assert_eq!(
        hash_at(&observer, &network, target).await,
        hash_at(&nodes[0], &network, target).await
    );
    observer.shutdown().await.unwrap();
    for node in nodes {
        node.shutdown().await.unwrap();
    }
}

#[tokio::test]
async fn misconfigured_validators_are_refused_at_start() {
    let genesis = genesis(4);
    let member = |name: &str| Member {
        data_dir: scratch(name),
        store: Arc::new(MemoryKvStore::new()),
    };
    let start = |config: NodeConfig, store: Arc<MemoryKvStore>| Node::start(config, store);

    // Validator 1's node key with validator 2's consensus key.
    let m = member("wrong-key");
    let mut wrong = config(&m, &genesis, 1, Vec::new(), true);
    wrong.consensus_key = Some(consensus_key(2));
    let error = start(wrong, m.store.clone()).await.unwrap_err();
    assert!(error.detail().contains("not the one registered"), "{error}");

    // A validator's node key without its consensus key.
    let m = member("no-key");
    let error = start(config(&m, &genesis, 1, Vec::new(), false), m.store.clone())
        .await
        .unwrap_err();
    assert!(error.detail().contains("no consensus key"), "{error}");

    // A consensus key on a node outside the set.
    let m = member("outsider");
    let mut outsider = config(&m, &genesis, 9, Vec::new(), false);
    outsider.consensus_key = Some(consensus_key(0));
    let error = start(outsider, m.store.clone()).await.unwrap_err();
    assert!(
        error.detail().contains("not in the validator set"),
        "{error}"
    );
}

/// An `aletheia-signer` daemon on loopback holding `key` (ADR-063); production uses a Unix
/// socket, the exchange is the same.
fn signer_daemon(key: BlsSecretKey, name: &str) -> aletheia_signer::protocol::Connector {
    let signer = aletheia_signer::LocalSigner::open(key, &scratch(name)).unwrap();
    let signer = Arc::new(std::sync::Mutex::new(signer));
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let mut stream = stream.unwrap();
            let signer = Arc::clone(&signer);
            std::thread::spawn(move || {
                let _ = aletheia_signer::protocol::serve_connection(&signer, &mut stream);
            });
        }
    });
    Box::new(move || {
        let stream: Box<dyn aletheia_signer::protocol::Transport> =
            Box::new(std::net::TcpStream::connect(address)?);
        Ok(stream)
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_validator_whose_key_lives_in_the_signer_daemon_finalizes_alone() {
    let genesis = genesis(1);
    let member = Member {
        data_dir: scratch("remote-one"),
        store: Arc::new(MemoryKvStore::new()),
    };
    let mut remote = config(&member, &genesis, 0, Vec::new(), false);
    remote.remote_signer = Some(
        aletheia_signer::RemoteSigner::connect(signer_daemon(
            consensus_key(0),
            "remote-one-signer",
        ))
        .unwrap(),
    );
    let mut node = Node::start(remote, member.store.clone()).await.unwrap();
    node.wait_for_height(Height::new(5), WAIT).await.unwrap();
    let block = node.block_at(Height::new(3)).await.unwrap().unwrap();
    assert_ne!(block.proposer_signature, [0; 96]);
    node.shutdown().await.unwrap();
}

#[tokio::test]
async fn a_signer_daemon_with_the_wrong_key_or_beside_a_local_key_is_refused() {
    let genesis = genesis(1);
    let member = |name: &str| Member {
        data_dir: scratch(name),
        store: Arc::new(MemoryKvStore::new()),
    };

    let m = member("remote-wrong");
    let mut wrong = config(&m, &genesis, 0, Vec::new(), false);
    wrong.remote_signer = Some(
        aletheia_signer::RemoteSigner::connect(signer_daemon(
            consensus_key(1),
            "remote-wrong-signer",
        ))
        .unwrap(),
    );
    let error = Node::start(wrong, m.store.clone()).await.unwrap_err();
    assert!(error.detail().contains("not the one registered"), "{error}");

    let m = member("remote-both");
    let mut both = config(&m, &genesis, 0, Vec::new(), true);
    both.remote_signer = Some(
        aletheia_signer::RemoteSigner::connect(signer_daemon(
            consensus_key(0),
            "remote-both-signer",
        ))
        .unwrap(),
    );
    let error = Node::start(both, m.store.clone()).await.unwrap_err();
    assert!(error.detail().contains("both given"), "{error}");
}
