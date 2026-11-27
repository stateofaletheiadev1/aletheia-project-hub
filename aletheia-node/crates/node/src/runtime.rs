//! Assembling a running node (spec Sections 46A.1-46A.3).
//!
//! Start-up order: open or initialize the ledger (lock, WAL recovery, tip verification) →
//! decide the block source (DSP when state records validators, otherwise the devnet producer
//! where allowed) → restore consensus safety data (WAL max-merged with the signer's marks) →
//! start the chain thread → start P2P with the verified tip → start the sync service. Shutdown reverses it: stop the async side, let
//! the chain thread drain its queue, then the ledger writes its checkpoint and releases the
//! data-directory lock.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

use aletheia_core::{AletheiaError, ErrorCode, Hash32, Height, SignedTransaction};
use aletheia_crypto::{BlsSecretKey, Ed25519SigningKey};
use aletheia_execution::GenesisState;
use aletheia_execution::rules::MAX_SUPPORTED_VERSION;
use aletheia_p2p::network::start as start_network;
use aletheia_p2p::{DialTarget, LocalNode, NetworkConfig, TransportCertificate};
use aletheia_storage::KvStore;
use aletheia_storage::datadir::LastFinalized;
use tokio::sync::{mpsc, oneshot, watch};
use tokio::task::JoinHandle;

use crate::chain;
use crate::channels::SUBMIT_QUEUE;
use crate::consensus::{ConsensusDriver, NodeSigner, validator_set};
use crate::ledger::Ledger;
use crate::mempool::Mempool;
use crate::snapshots::RestoreFrom;
use crate::sync::{Submission, SyncService};

pub struct NodeConfig {
    pub data_dir: PathBuf,
    pub genesis: GenesisState,
    pub listen: SocketAddr,
    pub peers: Vec<DialTarget>,
    pub node_key: Ed25519SigningKey,
    /// Devnet and regtest only, with the `devnet-producer` feature, on a genesis without
    /// validators: produce a block this often.
    pub produce_every: Option<Duration>,
    /// The BLS consensus key of a validator, held in process (devnet and regtest); its node
    /// key must be in the validator set. A node without a key here or in `remote_signer`
    /// follows consensus as an observer.
    pub consensus_key: Option<BlsSecretKey>,
    /// A validator whose consensus key lives in the `aletheia-signer` daemon (ADR-063).
    pub remote_signer: Option<aletheia_signer::RemoteSigner>,
    /// How often this node writes snapshots for others to start from (ADR-072).
    pub snapshots: crate::snapshots::SnapshotPolicy,
    /// A new data directory starts from a verified snapshot instead of genesis: one in a
    /// directory (ADR-072) or fetched from peers (ADR-073). Ignored once the data directory
    /// exists.
    pub restore_snapshot: Option<RestoreFrom>,
}

impl core::fmt::Debug for NodeConfig {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("NodeConfig")
            .field("data_dir", &self.data_dir)
            .field("listen", &self.listen)
            .field("peers", &self.peers.len())
            .field("node_key", &self.node_key.public_key())
            .field("produce_every", &self.produce_every)
            .field(
                "validator",
                &(self.consensus_key.is_some() || self.remote_signer.is_some()),
            )
            .field("remote_signer", &self.remote_signer.is_some())
            .field("snapshots", &self.snapshots)
            .field("restore_snapshot", &self.restore_snapshot)
            .finish_non_exhaustive()
    }
}

pub struct Node {
    local_addr: SocketAddr,
    /// SHA-256 of this node's transport certificate (ADR-071).
    transport_cert_hash: aletheia_core::Hash32,
    network: aletheia_core::NetworkIdentity,
    chain_handle: chain::ChainHandle,
    submissions: mpsc::Sender<Submission>,
    tip: watch::Receiver<LastFinalized>,
    peers: watch::Receiver<crate::sync::PeerView>,
    sync: Option<JoinHandle<Result<(), AletheiaError>>>,
    chain: std::thread::JoinHandle<Result<(), AletheiaError>>,
}

impl core::fmt::Debug for Node {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Node")
            .field("local_addr", &self.local_addr)
            .field("tip", &*self.tip.borrow())
            .finish_non_exhaustive()
    }
}

fn config_error(detail: String) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::DecodeNonCanonical,
        format!("node configuration: {detail}"),
    )
}

fn check_producer(config: &NodeConfig) -> Result<(), AletheiaError> {
    let Some(_) = config.produce_every else {
        return Ok(());
    };
    if !cfg!(feature = "devnet-producer") {
        return Err(config_error(
            "block production needs a build with the devnet-producer feature".to_owned(),
        ));
    }
    if !config.genesis.network_kind.allows_development_keys() {
        return Err(config_error(format!(
            "the devnet producer is refused on {}; only devnet and regtest may run without consensus",
            config.genesis.network_kind
        )));
    }
    Ok(())
}

/// DSP when the finalized state records an epoch-0 validator set: the engine resumes at the
/// tip with safety data no lower than the WAL's or the signer's.
/// What the consensus driver needs from the configuration (the node key itself goes to the
/// network, which may start before the ledger, ADR-073).
struct DriverInputs<'a> {
    produce_every: Option<Duration>,
    node_key: [u8; 32],
    data_dir: &'a std::path::Path,
    slot: Duration,
}

fn consensus_driver<S: KvStore>(
    config: &DriverInputs<'_>,
    consensus_key: Option<BlsSecretKey>,
    remote_signer: Option<aletheia_signer::RemoteSigner>,
    ledger: &Ledger<S>,
) -> Result<Option<ConsensusDriver>, AletheiaError> {
    enum Key {
        Local(BlsSecretKey),
        Remote(aletheia_signer::RemoteSigner),
    }
    let consensus_key = match (consensus_key, remote_signer) {
        (Some(_), Some(_)) => {
            return Err(config_error(
                "a consensus key and a remote signer were both given; use one".to_owned(),
            ));
        }
        (Some(key), None) => Some(Key::Local(key)),
        (None, Some(remote)) => Some(Key::Remote(remote)),
        (None, None) => None,
    };
    let at = ledger.engine_epoch()?;
    let epoch = at.epoch;
    let Some(records) = at.records.clone() else {
        if consensus_key.is_some() {
            return Err(config_error(
                "a consensus key was given, but genesis has no validators".to_owned(),
            ));
        }
        return Ok(None);
    };
    if config.produce_every.is_some() {
        return Err(config_error(
            "this chain has validators and runs DSP; the devnet producer is refused".to_owned(),
        ));
    }
    let network = *ledger.network();
    let set = validator_set(&network, epoch, &records)?;
    let index = set.index_of(&config.node_key);
    let open_signer = |key: Key| -> Result<NodeSigner, AletheiaError> {
        let signer = match key {
            Key::Local(key) => aletheia_signer::Backend::Local(aletheia_signer::LocalSigner::open(
                key,
                &config.data_dir.join("signer"),
            )?),
            Key::Remote(remote) => aletheia_signer::Backend::Remote(remote),
        };
        Ok(NodeSigner::Validator(std::sync::Arc::new(
            std::sync::Mutex::new(signer),
        )))
    };
    let signer = match (index, consensus_key) {
        (Some(index), Some(key)) => {
            let registered = set.member(index).map(|m| m.consensus_key.to_bytes());
            let public_key = match &key {
                Key::Local(key) => key.public_key().to_bytes(),
                Key::Remote(remote) => remote.public_key(),
            };
            if registered != Some(public_key) {
                return Err(config_error(format!(
                    "the consensus key is not the one registered for validator {index}"
                )));
            }
            open_signer(key)?
        }
        (Some(index), None) => {
            return Err(config_error(format!(
                "this node key is validator {index}, but no consensus key was given"
            )));
        }
        // A registered operator's node waits for the Council: it follows as an observer and
        // becomes a validator at the first epoch whose set includes it (ADR-069).
        (None, Some(key)) => {
            crate::consensus::operator_note(&format!(
                "info this node key is not in the validator set of epoch {epoch}; following as an observer until it joins"
            ));
            open_signer(key)?
        }
        (None, None) => NodeSigner::Observer,
    };
    let safety = ledger
        .safety()
        .unwrap_or_else(|| aletheia_consensus::SafetyData::genesis(epoch))
        .max_merge(&signer.floor(epoch)?);
    Ok(Some(ConsensusDriver::new(
        network,
        set,
        signer,
        config.node_key,
        at.seed_hash,
        safety,
        at.root,
        config.slot,
    )))
}

/// Reports a ledger just started from a snapshot.
fn restored<S: KvStore>(ledger: Ledger<S>) -> Ledger<S> {
    crate::consensus::operator_note(&format!(
        "info restored from snapshot height={} state_root={}; history before it is not on this node",
        ledger.tip().height,
        ledger.tip().state_root
    ));
    ledger
}

impl Node {
    /// Opens (or initializes from genesis or a snapshot) the data directory and starts every
    /// component.
    pub async fn start<S: KvStore + 'static>(
        mut config: NodeConfig,
        store: S,
    ) -> Result<Node, AletheiaError> {
        check_producer(&config)?;
        let genesis_network = config.genesis.network();
        // Kept across restarts, so the hash an operator registers stays valid (ADR-071).
        let certificate = TransportCertificate::load_or_create(&config.data_dir.join("p2p"))?;
        crate::consensus::operator_note(&format!(
            "info transport certificate sha256={} (give it to validator register --cert-hash)",
            aletheia_core::base16::encode(certificate.hash().as_bytes())
        ));
        let transport_cert_hash = certificate.hash();
        let inputs = DriverInputs {
            produce_every: config.produce_every,
            node_key: config.node_key.public_key().to_bytes(),
            data_dir: &config.data_dir,
            slot: Duration::from_millis(config.genesis.timing.slot_duration_ms),
        };
        let local = LocalNode {
            network: genesis_network,
            versions: (1, MAX_SUPPORTED_VERSION),
            node_key: config.node_key,
            certificate,
        };
        let network_config = NetworkConfig {
            listen: config.listen,
            dial: config.peers,
        };
        let initialized = config.data_dir.join("DATADIR").exists();
        if initialized && let Some(source) = &config.restore_snapshot {
            crate::consensus::operator_note(&format!(
                "info restore_snapshot {source} ignored: {} is already initialized",
                config.data_dir.display()
            ));
        }
        let (ledger, network_handle) = match (&config.restore_snapshot, initialized) {
            // A new node fetching its snapshot from peers: the network starts first, with an
            // empty tip, and is handed to block sync afterwards (ADR-073).
            (Some(RestoreFrom::Peers), false) => {
                let mut network_handle =
                    start_network(network_config, local, (Height::GENESIS, Hash32::ZERO)).await?;
                let download = config.data_dir.join(crate::snapshot_fetch::DOWNLOAD_DIR);
                let snapshot =
                    crate::snapshot_fetch::fetch(&mut network_handle, &config.genesis, &download)
                        .await?;
                let ledger = restored(Ledger::init_from_snapshot(
                    &config.data_dir,
                    &config.genesis,
                    store,
                    &snapshot,
                )?);
                let _ = std::fs::remove_dir_all(&download);
                let tip = ledger.tip();
                let _ = network_handle
                    .commands
                    .send(aletheia_p2p::NetworkCommand::SetTip {
                        height: tip.height,
                        hash: tip.hash,
                    })
                    .await;
                (ledger, network_handle)
            }
            (source, initialized) => {
                let ledger = match (source, initialized) {
                    (_, true) => Ledger::open(&config.data_dir, &config.genesis, store)?.0,
                    (Some(RestoreFrom::Directory(snapshot)), false) => {
                        restored(Ledger::init_from_snapshot(
                            &config.data_dir,
                            &config.genesis,
                            store,
                            snapshot,
                        )?)
                    }
                    _ => Ledger::init(&config.data_dir, &config.genesis, store)?,
                };
                let tip = ledger.tip();
                let network_handle =
                    start_network(network_config, local, (tip.height, tip.hash)).await?;
                (ledger, network_handle)
            }
        };
        ledger.check_next_height_supported()?;
        let tip = ledger.tip();
        let network = *ledger.network();
        let consensus_key = config.consensus_key.take();
        let remote_signer = config.remote_signer.take();
        let consensus = consensus_driver(&inputs, consensus_key, remote_signer, &ledger)?;
        let exporter = crate::snapshots::Exporter::open(&config.data_dir, config.snapshots);
        let (chain, chain_thread) = chain::spawn(ledger, exporter)?;
        let chain_handle = chain.clone();
        let local_addr = network_handle.local_addr;
        let snapshot_root = config.data_dir.join("snapshots");

        let (tip_tx, tip_rx) = watch::channel(tip);
        let (submit_tx, submit_rx) = mpsc::channel(SUBMIT_QUEUE);
        let (peers_tx, peers_rx) = watch::channel(crate::sync::PeerView::default());
        let service = SyncService {
            chain,
            network: network_handle,
            submissions: submit_rx,
            tip: tip_tx,
            produce_every: config.produce_every,
            mempool: Mempool::new(),
            peer_tips: std::collections::BTreeMap::new(),
            peers: peers_tx,
            in_flight: None,
            no_history: std::collections::BTreeSet::new(),
            consensus,
            snapshot_root,
            snapshot_reads: tokio::task::JoinSet::new(),
        };
        let sync = tokio::spawn(service.run());
        Ok(Node {
            local_addr,
            transport_cert_hash,
            network,
            chain_handle,
            submissions: submit_tx,
            tip: tip_rx,
            peers: peers_rx,
            sync: Some(sync),
            chain: chain_thread,
        })
    }

    /// The backend the public RPC serves from: finalized reads on the chain thread, and
    /// submissions through the node's admission path.
    pub fn rpc_backend(&self) -> crate::rpc::NodeBackend {
        crate::rpc::NodeBackend {
            chain: self.chain_handle.clone(),
            submissions: self.submissions.clone(),
            network: self.network,
            peers: self.peers.clone(),
        }
    }

    pub fn local_addr(&self) -> SocketAddr {
        self.local_addr
    }

    /// SHA-256 of this node's transport certificate: what its operator registers with
    /// `validator register --cert-hash` (ADR-071).
    pub fn transport_cert_hash(&self) -> aletheia_core::Hash32 {
        self.transport_cert_hash
    }

    pub fn tip(&self) -> LastFinalized {
        *self.tip.borrow()
    }

    /// Resolves when the node stops on its own: a fail-stop error (including the clean halt
    /// before an unsupported protocol version) or the network closing. Call [`Node::shutdown`]
    /// afterwards to drain the chain thread.
    pub async fn stopped(&mut self) -> Result<(), AletheiaError> {
        let Some(sync) = self.sync.as_mut() else {
            return Ok(());
        };
        let result = sync.await.unwrap_or_else(|e| {
            Err(AletheiaError::new(
                ErrorCode::StoIo,
                format!("sync task ended abnormally: {e}"),
            ))
        });
        self.sync = None;
        result
    }

    /// The finalized block at `height`, read from this node's own archive.
    pub async fn block_at(
        &self,
        height: Height,
    ) -> Result<Option<aletheia_core::block::Proposal>, AletheiaError> {
        Ok(self
            .chain_handle
            .read_blocks(height, 1)
            .await?
            .0
            .into_iter()
            .next())
    }

    /// Submits a transaction to the local mempool; it is gossiped once admitted.
    pub async fn submit(&self, transaction: SignedTransaction) -> Result<Hash32, AletheiaError> {
        let (reply, response) = oneshot::channel();
        self.submissions
            .try_send(Submission { transaction, reply })
            .map_err(|_| {
                AletheiaError::new(
                    ErrorCode::TxFieldOutOfRange,
                    "submission queue is full; retry".to_owned(),
                )
            })?;
        response
            .await
            .map_err(|_| AletheiaError::new(ErrorCode::StoIo, "the node stopped".to_owned()))?
    }

    /// Waits until the finalized height reaches `height` or `timeout` passes.
    pub async fn wait_for_height(
        &mut self,
        height: Height,
        timeout: Duration,
    ) -> Result<LastFinalized, AletheiaError> {
        let reached = tokio::time::timeout(timeout, self.tip.wait_for(|tip| tip.height >= height))
            .await
            .map(|result| result.map(|tip| *tip));
        match reached {
            Ok(Ok(tip)) => Ok(tip),
            _ => Err(AletheiaError::new(
                ErrorCode::StoIo,
                format!(
                    "height {height} not reached within {} s (at {})",
                    timeout.as_secs(),
                    self.tip.borrow().height
                ),
            )),
        }
    }

    /// Stops the node (Section 46A.3): the sync service and network first, then the chain
    /// thread drains, checkpoints and releases the lock. Returns the chain thread's result, so
    /// a fail-stop that happened while running is reported here.
    pub async fn shutdown(self) -> Result<(), AletheiaError> {
        let Node {
            sync,
            submissions,
            chain_handle,
            chain,
            ..
        } = self;
        if let Some(sync) = sync {
            sync.abort();
            let _ = sync.await;
        }
        // An explicit stop: clients of the RPC may hold handles to the chain thread for as long
        // as their connections live, so waiting for every handle to go could wait forever.
        chain_handle.stop().await;
        drop(submissions);
        drop(chain_handle);
        tokio::task::spawn_blocking(move || chain.join())
            .await
            .map_err(|e| AletheiaError::new(ErrorCode::StoIo, format!("join chain thread: {e}")))?
            .map_err(|_| {
                AletheiaError::new(ErrorCode::StoIo, "the chain thread panicked".to_owned())
            })?
    }
}
