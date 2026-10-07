//! Assembling a running node (spec Sections 46A.1-46A.3).
//!
//! Start-up order: open or initialize the ledger (lock, WAL recovery, tip verification) →
//! check the producer is allowed on this network → start the chain thread → start P2P with
//! the verified tip → start the sync service. Shutdown reverses it: stop the async side, let
//! the chain thread drain its queue, then the ledger writes its checkpoint and releases the
//! data-directory lock.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

use aletheia_core::{AletheiaError, ErrorCode, Hash32, Height, SignedTransaction};
use aletheia_crypto::Ed25519SigningKey;
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
use crate::ledger::Ledger;
use crate::mempool::Mempool;
use crate::sync::{Submission, SyncService};

pub struct NodeConfig {
    pub data_dir: PathBuf,
    pub genesis: GenesisState,
    pub listen: SocketAddr,
    pub peers: Vec<DialTarget>,
    pub node_key: Ed25519SigningKey,
    /// Devnet and regtest only, with the `devnet-producer` feature: produce a block this often.
    pub produce_every: Option<Duration>,
}

impl core::fmt::Debug for NodeConfig {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("NodeConfig")
            .field("data_dir", &self.data_dir)
            .field("listen", &self.listen)
            .field("peers", &self.peers.len())
            .field("node_key", &self.node_key.public_key())
            .field("produce_every", &self.produce_every)
            .finish_non_exhaustive()
    }
}

pub struct Node {
    local_addr: SocketAddr,
    chain_handle: chain::ChainHandle,
    submissions: mpsc::Sender<Submission>,
    tip: watch::Receiver<LastFinalized>,
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

impl Node {
    /// Opens (or initializes from genesis) the data directory and starts every component.
    pub async fn start<S: KvStore + 'static>(
        config: NodeConfig,
        store: S,
    ) -> Result<Node, AletheiaError> {
        check_producer(&config)?;
        let ledger = if config.data_dir.join("DATADIR").exists() {
            Ledger::open(&config.data_dir, &config.genesis, store)?.0
        } else {
            Ledger::init(&config.data_dir, &config.genesis, store)?
        };
        ledger.check_next_height_supported()?;
        let tip = ledger.tip();
        let network = *ledger.network();
        let (chain, chain_thread) = chain::spawn(ledger)?;
        let chain_handle = chain.clone();

        let local = LocalNode {
            network,
            versions: (1, MAX_SUPPORTED_VERSION),
            node_key: config.node_key,
            certificate: TransportCertificate::generate()?,
        };
        let network_handle = start_network(
            NetworkConfig {
                listen: config.listen,
                dial: config.peers,
            },
            local,
            (tip.height, tip.hash),
        )
        .await?;
        let local_addr = network_handle.local_addr;

        let (tip_tx, tip_rx) = watch::channel(tip);
        let (submit_tx, submit_rx) = mpsc::channel(SUBMIT_QUEUE);
        let service = SyncService {
            chain,
            network: network_handle,
            submissions: submit_rx,
            tip: tip_tx,
            produce_every: config.produce_every,
            mempool: Mempool::new(),
            peer_tips: std::collections::BTreeMap::new(),
            in_flight: None,
        };
        let sync = tokio::spawn(service.run());
        Ok(Node {
            local_addr,
            chain_handle,
            submissions: submit_tx,
            tip: tip_rx,
            sync: Some(sync),
            chain: chain_thread,
        })
    }

    pub fn local_addr(&self) -> SocketAddr {
        self.local_addr
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
        // The chain thread stops once every handle to it is gone.
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
