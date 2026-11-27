//! Validator key rotation (ADR-074), end to end over TLS on a chain upgraded to protocol version
//! 3 by governance: an
//! operator's validator moves to a new consensus key and the node switches to it by itself at
//! the epoch change; the Council moves the genesis validator to a new key the same way; the
//! operator registers a new transport certificate and restarts onto it while the other
//! validator keeps accepting it. The chain never stops.

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
use aletheia_node::{NextSigner, Node, NodeConfig};
use aletheia_p2p::{DialTarget, PeerExpectation};
use aletheia_rpc::Backend;
use aletheia_storage::MemoryKvStore;
use aletheia_test_harness::{Devnet, ONE_ALNT, keys};

const WAIT: Duration = Duration::from_secs(120);
const SLOT_MS: u64 = 100;
const GOV_EPOCH_SLOTS: u64 = 2;

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-rotation-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn consensus_key(seed: u8) -> BlsSecretKey {
    BlsSecretKey::from_key_material(&Secret::new([seed; 32])).unwrap()
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

/// One genesis validator; harness account 0 is the council, account 1 the operator. Each test
/// passes its own `chain`, so the two tests' nodes, which share keys and run in one process,
/// can never mistake each other for peers of their own chain (the handshake checks genesis).
fn genesis(chain: u64) -> GenesisState {
    let mut toml = format!(
        "[chain]\nchain_id = 7771\nnetwork = \"devnet\"\nprotocol_version = 1\ngenesis_time_ms = {}\nslot_duration_ms = {SLOT_MS}\n\n[fees]\neu_price_aey = \"1000000000\"\neu_price_alnt = \"1\"\n",
        1_767_225_600_000 + chain
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
    let key = consensus_key(200);
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

/// A node with consensus key `current` and, when given, `next` held for a rotation.
async fn start(
    member: &Member,
    genesis: &GenesisState,
    index: u8,
    current: u8,
    next: Option<u8>,
    peers: &[SocketAddr],
) -> Node {
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
            consensus_key: Some(consensus_key(current)),
            remote_signer: None,
            snapshots: aletheia_node::SnapshotPolicy::DISABLED,
            restore_snapshot: None,
            next_signer: next.map(|seed| NextSigner::Local(consensus_key(seed))),
        },
        member.store.clone(),
    )
    .await
    .unwrap()
}

struct Client {
    devnet: Devnet,
    nonces: [u64; 2],
}

impl Client {
    async fn submit(&mut self, node: &Node, from: usize, payload: Payload) -> (ReceiptStatus, u32) {
        let mut body = self.devnet.body(from, self.nonces[from], payload);
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
            assert_eq!(code, 14010, "governance execution failed with {code}");
            assert!(started.elapsed() < WAIT, "the timelock never passed");
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }
}

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

/// Waits 20 blocks into `epoch` on both nodes, checks they agree, and that both lead in it.
async fn both_lead(v0: &mut Node, v1: &mut Node, network: &NetworkIdentity, epoch: u64) {
    let opened = wait_for_epoch(v0, epoch).await;
    let later = Height::new(opened.get() + 20);
    v0.wait_for_height(later, WAIT).await.unwrap();
    v1.wait_for_height(later, WAIT).await.unwrap();
    assert_eq!(
        hash_at(v0, network, later).await,
        hash_at(v1, network, later).await
    );
    assert_eq!(
        proposers(v0, opened, later, epoch).await,
        BTreeSet::from([0, 1]),
        "both validators lead in epoch {epoch}"
    );
}

async fn set_keys(node: &Node, epoch: u64) -> Vec<[u8; 48]> {
    node.rpc_backend()
        .validators(epoch)
        .await
        .unwrap()
        .unwrap()
        .iter()
        .map(|member| member.consensus_key)
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn validators_rotate_consensus_keys_and_certificates_without_stopping() {
    let genesis = genesis(1);
    let network = genesis.network();
    let mut client = Client {
        devnet: Devnet::from_genesis(genesis.clone(), keys(2)),
        nonces: [0, 0],
    };

    // The genesis validator holds its next key from the start; so does the operator's node.
    let first = member("v0");
    let mut v0 = start(&first, &genesis, 0, 200, Some(210), &[]).await;
    v0.wait_for_height(Height::new(3), WAIT).await.unwrap();

    // Versions 2 and 3 by governance, as on Mainnet Beta.
    let v2_at = v0.tip().height.get() + 80;
    for (version, height) in [(2, v2_at), (3, v2_at + 5)] {
        client
            .govern(
                &v0,
                GovAction::ScheduleUpgrade {
                    protocol_version: version,
                    activation_height: height,
                },
            )
            .await;
    }
    v0.wait_for_height(Height::new(v2_at + 8), WAIT)
        .await
        .unwrap();
    let block = v0.block_at(Height::new(v2_at + 5)).await.unwrap().unwrap();
    assert_eq!(block.block.header.version.get(), 3);
    let second = member("v1");
    let mut v1 = start(&second, &genesis, 1, 201, Some(211), &[v0.local_addr()]).await;

    // The operator registers; the council admits it: epoch 1 has both.
    let key = consensus_key(201);
    client
        .ok(
            &v0,
            1,
            Payload::Validator(Box::new(ValidatorOp::Register(Box::new(
                ValidatorApplication {
                    consensus_key: key.public_key().to_bytes(),
                    proof_of_possession: key.prove_possession(&network).to_bytes(),
                    node_key: node_key(1).public_key().to_bytes(),
                    transport_cert_hash: v1.transport_cert_hash(),
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
    both_lead(&mut v0, &mut v1, &network, 1).await;

    // The operator moves to its next key: the block closes epoch 1, and epoch 2's set records
    // the new key. The node signs with it by itself; both still lead.
    let new_key = consensus_key(211);
    client
        .ok(
            &v0,
            1,
            Payload::Validator(Box::new(ValidatorOp::RotateConsensusKey {
                node_key: node_key(1).public_key().to_bytes(),
                consensus_key: new_key.public_key().to_bytes(),
                proof_of_possession: new_key.prove_possession(&network).to_bytes(),
            })),
        )
        .await;
    both_lead(&mut v0, &mut v1, &network, 2).await;
    assert_eq!(set_keys(&v0, 2).await[1], new_key.public_key().to_bytes());

    // A key another validator holds is refused.
    let taken = consensus_key(200);
    let (status, _) = client
        .submit(
            &v0,
            1,
            Payload::Validator(Box::new(ValidatorOp::RotateConsensusKey {
                node_key: node_key(1).public_key().to_bytes(),
                consensus_key: taken.public_key().to_bytes(),
                proof_of_possession: taken.prove_possession(&network).to_bytes(),
            })),
        )
        .await;
    assert_ne!(status, ReceiptStatus::Success, "a taken key was accepted");

    // The council moves the genesis validator, which has no operator, to its next key.
    let state_key = consensus_key(210);
    client
        .govern(
            &v0,
            GovAction::RotateValidatorKey {
                node_key: node_key(0).public_key().to_bytes(),
                consensus_key: state_key.public_key().to_bytes(),
                proof_of_possession: state_key.prove_possession(&network).to_bytes(),
            },
        )
        .await;
    both_lead(&mut v0, &mut v1, &network, 3).await;
    assert_eq!(set_keys(&v0, 3).await[0], state_key.public_key().to_bytes());

    // A new transport certificate: prepared beside the current one, registered, then the node
    // restarts onto it. The other validator accepts it, and would still accept the old one.
    let next_cert =
        aletheia_p2p::TransportCertificate::prepare_next(&second.data_dir.join("p2p")).unwrap();
    let old_cert = v1.transport_cert_hash();
    client
        .ok(
            &v0,
            1,
            Payload::Validator(Box::new(ValidatorOp::RotateTransportCert {
                node_key: node_key(1).public_key().to_bytes(),
                transport_cert_hash: next_cert,
            })),
        )
        .await;
    v1.shutdown().await.unwrap();
    let mut v1 = start(&second, &genesis, 1, 211, None, &[v0.local_addr()]).await;
    assert_eq!(v1.transport_cert_hash(), next_cert);
    assert_ne!(next_cert, old_cert);
    let resumed = Height::new(v0.tip().height.get() + 20);
    v0.wait_for_height(resumed, WAIT).await.unwrap();
    v1.wait_for_height(resumed, WAIT).await.unwrap();
    assert_eq!(
        hash_at(&v0, &network, resumed).await,
        hash_at(&v1, &network, resumed).await
    );
    let after = Height::new(resumed.get() - 19);
    assert_eq!(
        proposers(&v0, after, resumed, 3).await,
        BTreeSet::from([0, 1]),
        "both lead after the certificate change"
    );

    v1.shutdown().await.unwrap();
    v0.shutdown().await.unwrap();
}

/// Equivocation evidence (ADR-075): two votes a validator signed for different blocks in one
/// round, submitted by any account, suspend it at once; the same evidence twice, or evidence
/// with a forged signature, is refused; evidence against the last validator is recorded but
/// never empties the set.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn an_equivocating_validator_is_suspended_on_evidence_but_the_last_one_stays() {
    use aletheia_core::block::{Proposal, QuorumCertificate};
    use aletheia_core::validator::Equivocation;

    let genesis = genesis(2);
    let network = genesis.network();
    let mut client = Client {
        devnet: Devnet::from_genesis(genesis.clone(), keys(2)),
        nonces: [0, 0],
    };
    let first = member("e0");
    let mut v0 = start(&first, &genesis, 0, 200, None, &[]).await;
    v0.wait_for_height(Height::new(3), WAIT).await.unwrap();
    let v2_at = v0.tip().height.get() + 80;
    for (version, height) in [(2, v2_at), (3, v2_at + 5)] {
        client
            .govern(
                &v0,
                GovAction::ScheduleUpgrade {
                    protocol_version: version,
                    activation_height: height,
                },
            )
            .await;
    }
    v0.wait_for_height(Height::new(v2_at + 8), WAIT)
        .await
        .unwrap();
    let second = member("e1");
    let mut v1 = start(&second, &genesis, 1, 201, None, &[v0.local_addr()]).await;
    let key = consensus_key(201);
    client
        .ok(
            &v0,
            1,
            Payload::Validator(Box::new(ValidatorOp::Register(Box::new(
                ValidatorApplication {
                    consensus_key: key.public_key().to_bytes(),
                    proof_of_possession: key.prove_possession(&network).to_bytes(),
                    node_key: node_key(1).public_key().to_bytes(),
                    transport_cert_hash: v1.transport_cert_hash(),
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
    both_lead(&mut v0, &mut v1, &network, 1).await;

    // Validator 1 signs two votes for different blocks in one round of epoch 1.
    let round = aletheia_core::Slot::new(v0.tip().height.get() + 5_000);
    let vote = |hash: u8, signer: &BlsSecretKey| {
        let block = Hash32::from_bytes([hash; 32]);
        let digest = QuorumCertificate::vote_digest(&network, round, &block, Epoch::new(1));
        (block, signer.sign(&digest).to_bytes())
    };
    let evidence = |second_signer: &BlsSecretKey| {
        Payload::Validator(Box::new(ValidatorOp::SubmitEvidence(Box::new(
            Equivocation::Votes {
                epoch: Epoch::new(1),
                round,
                voter: 1,
                first: Box::new(vote(1, &key)),
                second: Box::new(vote(2, second_signer)),
            },
        ))))
    };

    // A second vote signed by another key proves nothing.
    let (status, code) = client.submit(&v0, 0, evidence(&consensus_key(99))).await;
    assert_ne!(status, ReceiptStatus::Success);
    assert_eq!(code, 14020, "VAL_EVIDENCE_INVALID");

    // The real equivocation, from the council's account (any account may): validator 1 leaves
    // the set at once and epoch 2 runs on validator 0 alone.
    client.ok(&v0, 0, evidence(&key)).await;
    let opened = wait_for_epoch(&mut v0, 2).await;
    assert_eq!(set_keys(&v0, 2).await.len(), 1);
    let later = Height::new(opened.get() + 10);
    v0.wait_for_height(later, WAIT).await.unwrap();
    assert_eq!(proposers(&v0, opened, later, 2).await, BTreeSet::from([0]));

    // The same evidence again is refused.
    let (status, code) = client.submit(&v0, 0, evidence(&key)).await;
    assert_ne!(status, ReceiptStatus::Success);
    assert_eq!(code, 14021, "VAL_EVIDENCE_KNOWN");

    // Validator 0 proposed twice in one slot: proven and recorded, but as the last member it
    // stays, and the chain carries on.
    let signed = v0.block_at(later).await.unwrap().unwrap();
    let mut twin = signed.block.header.clone();
    twin.eu_used += 1;
    let twin_signature = consensus_key(200)
        .sign(&Proposal::signing_digest(
            &network,
            &twin.block_hash(&network),
        ))
        .to_bytes();
    client
        .ok(
            &v0,
            0,
            Payload::Validator(Box::new(ValidatorOp::SubmitEvidence(Box::new(
                Equivocation::Proposals {
                    first: Box::new((signed.block.header.clone(), signed.proposer_signature)),
                    second: Box::new((twin, twin_signature)),
                },
            )))),
        )
        .await;
    let still = Height::new(v0.tip().height.get() + 10);
    v0.wait_for_height(still, WAIT).await.unwrap();
    let block = v0.block_at(still).await.unwrap().unwrap();
    assert_eq!(
        block.block.header.epoch,
        Epoch::new(2),
        "the set did not change"
    );

    v1.shutdown().await.unwrap();
    v0.shutdown().await.unwrap();
}
