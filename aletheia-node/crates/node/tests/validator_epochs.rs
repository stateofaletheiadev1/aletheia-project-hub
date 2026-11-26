//! Validators joining and leaving a running chain (ADR-069), end to end over TLS: a chain
//! launched with one validator under protocol version 1 upgrades to version 2 by governance,
//! keeps finalizing alone, admits a registered operator's node at an epoch boundary, finalizes
//! with both, then loses one to a suspension and carries on alone, never stopping.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::collections::BTreeSet;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use aletheia_core::registry::{GovAction, RegistryOp, proposal_id};
use aletheia_core::validator::{ValidatorApplication, ValidatorOp};
use aletheia_core::{Epoch, Hash32, Height, NetworkIdentity, Payload};
use aletheia_crypto::{BlsSecretKey, Ed25519SigningKey, Secret};
use aletheia_execution::{GenesisConfig, GenesisState, ReceiptStatus};
use aletheia_node::{Node, NodeConfig};
use aletheia_p2p::{DialTarget, PeerExpectation};
use aletheia_rpc::Backend;
use aletheia_storage::MemoryKvStore;
use aletheia_test_harness::{Devnet, ONE_ALNT, keys};

const WAIT: Duration = Duration::from_secs(120);
const SLOT_MS: u64 = 100;
/// Governance epochs of two slots keep timelocks short.
const GOV_EPOCH_SLOTS: u64 = 2;

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-epochs-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn consensus_key(index: u8) -> BlsSecretKey {
    BlsSecretKey::from_key_material(&Secret::new([200 + index; 32])).unwrap()
}

fn node_key(index: u8) -> Ed25519SigningKey {
    Ed25519SigningKey::from_seed(&Secret::new([100 + index; 32]))
}

fn pre_genesis() -> NetworkIdentity {
    NetworkIdentity::new(
        aletheia_core::ChainId::new(7771),
        aletheia_core::NetworkKind::Devnet,
        Hash32::ZERO,
    )
}

/// One genesis validator; harness account 0 is the council, account 1 the operator.
fn genesis() -> GenesisState {
    let mut toml = format!(
        "[chain]\nchain_id = 7771\nnetwork = \"devnet\"\nprotocol_version = 1\ngenesis_time_ms = 1767225600000\nslot_duration_ms = {SLOT_MS}\n\n[fees]\neu_price_aey = \"1000000000\"\neu_price_alnt = \"1\"\n"
    );
    let mut council = String::new();
    for (index, key) in keys(2).iter().enumerate() {
        let address = aletheia_crypto::address::ed25519_account(&pre_genesis(), &key.public_key())
            .to_text(aletheia_core::NetworkKind::Devnet);
        if index == 0 {
            council = address.clone();
        }
        toml.push_str(&format!(
            "\n[[allocations]]\naddress = \"{address}\"\nasset = \"ALnT\"\nunits = \"{}\"\n",
            1_000_000 * ONE_ALNT
        ));
    }
    let key = consensus_key(0);
    toml.push_str(&format!(
        "\n[[validators]]\nconsensus_key = \"{}\"\nproof_of_possession = \"{}\"\nnode_key = \"{}\"\n",
        aletheia_core::base16::encode(&key.public_key().to_bytes()),
        aletheia_core::base16::encode(&key.prove_possession(&pre_genesis()).to_bytes()),
        aletheia_core::base16::encode(&node_key(0).public_key().to_bytes()),
    ));
    toml.push_str(&format!(
        "\n[governance]\ncouncil = [\"{council}\"]\nthreshold = 1\nepoch_slots = {GOV_EPOCH_SLOTS}\nvoting_epochs = 50\nexecution_window_epochs = 100000\nmax_aey_capacity_increase = \"0\"\n"
    ));
    GenesisConfig::from_toml(&toml).unwrap().to_state().unwrap()
}

struct Member {
    data_dir: PathBuf,
    store: Arc<MemoryKvStore>,
}

fn member(name: &str) -> Member {
    Member {
        data_dir: scratch(name),
        store: Arc::new(MemoryKvStore::new()),
    }
}

async fn start(member: &Member, genesis: &GenesisState, index: u8, peers: &[SocketAddr]) -> Node {
    Node::start(
        NodeConfig {
            data_dir: member.data_dir.clone(),
            genesis: genesis.clone(),
            listen: "127.0.0.1:0".parse().unwrap(),
            peers: peers
                .iter()
                .map(|&address| DialTarget {
                    address,
                    expect: PeerExpectation::default(),
                })
                .collect(),
            node_key: node_key(index),
            produce_every: None,
            consensus_key: Some(consensus_key(index)),
            remote_signer: None,
        },
        member.store.clone(),
    )
    .await
    .unwrap()
}

/// Signs and submits transactions for the harness accounts, tracking their nonces.
struct Client {
    devnet: Devnet,
    nonces: [u64; 2],
}

impl Client {
    /// Submits to `node` and waits for the receipt; returns its status and error code.
    async fn submit(&mut self, node: &Node, from: usize, payload: Payload) -> (ReceiptStatus, u32) {
        let mut body = self.devnet.body(from, self.nonces[from], payload);
        // Valid from the current slot for the longest window the rules allow.
        let slot = node.tip().height.get().max(1);
        let now = node
            .block_at(Height::new(slot))
            .await
            .unwrap()
            .map_or(0, |b| b.block.header.slot.get());
        body.valid_from_slot = aletheia_core::Slot::new(now);
        body.expiry_slot = aletheia_core::Slot::new(now + 7_000);
        self.nonces[from] += 1;
        let id = node.submit(self.devnet.sign(from, body)).await.unwrap();
        let backend = node.rpc_backend();
        let started = Instant::now();
        loop {
            if let Some(receipt) = backend.receipt(id).await.unwrap() {
                return (receipt.value.status, receipt.value.error_code);
            }
            assert!(
                started.elapsed() < WAIT,
                "transaction {id} was never finalized"
            );
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    async fn ok(&mut self, node: &Node, from: usize, payload: Payload) {
        let (status, code) = self.submit(node, from, payload).await;
        assert_eq!(status, ReceiptStatus::Success, "error code {code}");
    }

    /// The council (account 0) proposes `action` and executes it once its timelock has passed.
    async fn govern(&mut self, node: &Node, action: GovAction) {
        let id = proposal_id(
            &self.devnet.network,
            &self.devnet.address(0),
            self.nonces[0],
            &action,
        );
        self.ok(
            node,
            0,
            Payload::Registry(Box::new(RegistryOp::GovPropose { action })),
        )
        .await;
        let started = Instant::now();
        loop {
            let (status, code) = self
                .submit(
                    node,
                    0,
                    Payload::Registry(Box::new(RegistryOp::GovExecute { proposal_id: id })),
                )
                .await;
            if status == ReceiptStatus::Success {
                return;
            }
            // Still timelocked: GOV_PROPOSAL_STATE.
            assert_eq!(code, 14010, "governance execution failed with {code}");
            assert!(started.elapsed() < WAIT, "the timelock never passed");
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }
}

/// Waits until `node` finalized a block of `epoch` and returns that block's height.
async fn wait_for_epoch(node: &mut Node, epoch: u64) -> Height {
    let started = Instant::now();
    loop {
        let tip = node.tip().height;
        let block = node.block_at(tip).await.unwrap().unwrap();
        if block.block.header.epoch.get() >= epoch {
            return tip;
        }
        assert!(
            started.elapsed() < WAIT,
            "epoch {epoch} never began (tip {tip} in epoch {})",
            block.block.header.epoch
        );
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

async fn hash_at(node: &Node, network: &NetworkIdentity, height: Height) -> Hash32 {
    node.block_at(height)
        .await
        .unwrap()
        .unwrap()
        .block
        .header
        .block_hash(network)
}

/// The proposers and epochs of the finalized blocks in `from..=to`, and whether every one
/// extends its parent with a real certificate.
async fn proposers(node: &Node, from: Height, to: Height, epoch: u64) -> BTreeSet<u16> {
    let mut seen = BTreeSet::new();
    for height in from.get()..=to.get() {
        let block = node.block_at(Height::new(height)).await.unwrap().unwrap();
        if block.block.header.epoch == Epoch::new(epoch) {
            seen.insert(block.block.header.proposer.get());
        }
    }
    seen
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_single_validator_chain_admits_and_loses_a_validator_without_stopping() {
    let genesis = genesis();
    let network = genesis.network();
    let mut client = Client {
        devnet: Devnet::from_genesis(genesis.clone(), keys(2)),
        nonces: [0, 0],
    };

    // Launch: one validator, protocol version 1.
    let first = member("v0");
    let mut v0 = start(&first, &genesis, 0, &[]).await;
    v0.wait_for_height(Height::new(3), WAIT).await.unwrap();

    // The council schedules version 2; the single validator crosses it without a pause.
    let activation = v0.tip().height.get() + 60;
    client
        .govern(
            &v0,
            GovAction::ScheduleUpgrade {
                protocol_version: 2,
                activation_height: activation,
            },
        )
        .await;
    v0.wait_for_height(Height::new(activation + 3), WAIT)
        .await
        .unwrap();
    let block = v0.block_at(Height::new(activation)).await.unwrap().unwrap();
    assert_eq!(block.block.header.version.get(), 2);
    assert_eq!(
        block.block.header.epoch,
        Epoch::new(0),
        "no set change, no new epoch"
    );

    // A licensed operator's node starts with its consensus key and follows as an observer.
    let second = member("v1");
    let mut v1 = start(&second, &genesis, 1, &[v0.local_addr()]).await;
    let caught_up = v0.tip().height;
    v1.wait_for_height(caught_up, WAIT).await.unwrap();

    // The operator (account 1) registers with a bond; the council activates it.
    let key = consensus_key(1);
    client
        .ok(
            &v0,
            1,
            Payload::Validator(Box::new(ValidatorOp::Register(Box::new(
                ValidatorApplication {
                    consensus_key: key.public_key().to_bytes(),
                    proof_of_possession: key.prove_possession(&network).to_bytes(),
                    node_key: node_key(1).public_key().to_bytes(),
                    transport_cert_hash: Hash32::from_bytes([1; 32]),
                    metadata_hash: Hash32::from_bytes([2; 32]),
                    bond: 10_000 * ONE_ALNT,
                },
            )))),
        )
        .await;
    client
        .govern(
            &v0,
            GovAction::ActivateValidator {
                node_key: node_key(1).public_key().to_bytes(),
            },
        )
        .await;

    // Epoch 1 has two validators, and both lead blocks in it.
    let opened = wait_for_epoch(&mut v0, 1).await;
    let later = Height::new(opened.get() + 20);
    v0.wait_for_height(later, WAIT).await.unwrap();
    v1.wait_for_height(later, WAIT).await.unwrap();
    assert_eq!(
        hash_at(&v0, &network, later).await,
        hash_at(&v1, &network, later).await
    );
    let leaders = proposers(&v0, opened, later, 1).await;
    assert_eq!(
        leaders,
        BTreeSet::from([0, 1]),
        "both validators lead in epoch 1"
    );
    let set = v0.rpc_backend().validators(1).await.unwrap().unwrap();
    assert_eq!(set.len(), 2);

    // Rewards: the treasury (account 0) funds the reward pool, and the council sets a short
    // period, a pool payout and itself as the state beneficiary. The operator, who sends
    // nothing more, is paid for its work.
    client
        .ok(
            &v0,
            0,
            Payload::Transfer(aletheia_core::TransferLeg {
                recipient: aletheia_execution::rules::v2::rewards::REWARD_POOL,
                asset: aletheia_core::AssetId::ALNT,
                amount: 100_000 * ONE_ALNT,
            }),
        )
        .await;
    client
        .govern(
            &v0,
            GovAction::SetRewardPolicy {
                period_slots: 30,
                pool_payout: 1_000 * ONE_ALNT,
                state_beneficiary: Some(client.devnet.address(0)),
            },
        )
        .await;
    let operator = client.devnet.address(1);
    let alnt = aletheia_core::AssetId::ALNT;
    let before = v0
        .rpc_backend()
        .balance(operator, alnt)
        .await
        .unwrap()
        .available;
    let paid_by = Height::new(v0.tip().height.get() + 80);
    v0.wait_for_height(paid_by, WAIT).await.unwrap();
    let after_reward = v0
        .rpc_backend()
        .balance(operator, alnt)
        .await
        .unwrap()
        .available;
    assert!(
        after_reward > before,
        "the operator earned rewards: {before} -> {after_reward}"
    );
    // Both validators share the pool payout by work; the operator's share is near half.
    assert!(after_reward - before <= 2 * 1_000 * ONE_ALNT);

    // The council suspends the operator at once; epoch 2 runs on the founder's validator alone
    // while the suspended node follows.
    client
        .govern(
            &v0,
            GovAction::SuspendValidator {
                node_key: node_key(1).public_key().to_bytes(),
            },
        )
        .await;
    let reopened = wait_for_epoch(&mut v0, 2).await;
    let after = Height::new(reopened.get() + 15);
    v0.wait_for_height(after, WAIT).await.unwrap();
    v1.wait_for_height(after, WAIT).await.unwrap();
    assert_eq!(
        hash_at(&v0, &network, after).await,
        hash_at(&v1, &network, after).await
    );
    assert_eq!(
        proposers(&v0, reopened, after, 2).await,
        BTreeSet::from([0])
    );

    // A restart in the middle of epoch 2 resumes in epoch 2.
    v1.shutdown().await.unwrap();
    v0.shutdown().await.unwrap();
    let mut v0 = start(&first, &genesis, 0, &[]).await;
    let resumed = Height::new(after.get() + 10);
    v0.wait_for_height(resumed, WAIT).await.unwrap();
    let block = v0.block_at(resumed).await.unwrap().unwrap();
    assert_eq!(block.block.header.epoch, Epoch::new(2));
    v0.shutdown().await.unwrap();
}
