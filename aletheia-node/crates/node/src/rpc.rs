//! The node's side of the public RPC (spec Section 37): reads answered on the chain thread from
//! finalized data, and submissions through the same admission path as gossip.

use aletheia_core::block::Proposal;
use aletheia_core::tx::SignedTransaction;
use aletheia_core::{
    AceDecode, AceEncode, Address, AletheiaError, AssetId, Hash32, Height, NetworkIdentity,
};
use aletheia_execution::Receipt;
use aletheia_execution::model::{Account, AssetConfig, Balance};
use aletheia_monetary::SupplyLedger;
use aletheia_rpc::{Backend, BlockRef, Located, NodeStatus};
use aletheia_storage::KvStore;
use tokio::sync::{mpsc, oneshot};

use crate::chain::ChainHandle;
use crate::ledger::Ledger;
use crate::sync::Submission;

/// One read, answered on the chain thread.
#[derive(Debug)]
pub(crate) enum RpcQuery {
    Status,
    Block(BlockRef),
    FinalityProof(u64),
    Transaction(Hash32),
    Receipt(Hash32),
    Account(Address),
    Balance(Address, AssetId),
    Assets,
    Supply(AssetId),
    Simulate(Vec<u8>),
}

#[derive(Debug)]
pub(crate) enum RpcAnswer {
    Status(NodeStatus),
    Block(Option<Box<Proposal>>),
    Proof(Option<Vec<u8>>),
    Transaction(Option<Box<Located<SignedTransaction>>>),
    Receipt(Option<Box<Located<Receipt>>>),
    Account(Option<Account>),
    Balance(Balance),
    Assets(Vec<(AssetId, AssetConfig)>),
    Supply(Option<Box<SupplyLedger>>),
    Simulated(Box<Receipt>),
}

/// The assets a node knows: the natives, then any others in the asset registry.
const KNOWN_ASSETS: [AssetId; 2] = [AssetId::AEY, AssetId::ALNT];

fn located<S: KvStore, T>(
    ledger: &Ledger<S>,
    tx_id: &Hash32,
    pick: impl FnOnce(&Proposal, u32) -> Result<Option<T>, AletheiaError>,
) -> Result<Option<Located<T>>, AletheiaError> {
    let Some((height, index)) = ledger.tx_position(tx_id)? else {
        return Ok(None);
    };
    let Some(block) = ledger.read_block(height)? else {
        return Ok(None);
    };
    let header = &block.block.header;
    let hash = header.block_hash(ledger.network());
    let slot = header.slot.get();
    Ok(pick(&block, index)?.map(|value| Located {
        value,
        height: height.get(),
        index,
        block_hash: hash,
        slot,
    }))
}

/// Answers one query against the ledger (on the chain thread).
pub(crate) fn answer<S: KvStore>(
    ledger: &Ledger<S>,
    query: RpcQuery,
) -> Result<RpcAnswer, AletheiaError> {
    Ok(match query {
        RpcQuery::Status => {
            let tip = ledger.tip();
            RpcAnswer::Status(NodeStatus {
                finalized_height: tip.height.get(),
                finalized_hash: tip.hash,
                protocol_version: ledger.tip_version()?,
                peers: None,
                syncing: false,
            })
        }
        RpcQuery::Block(BlockRef::Height(h)) => {
            RpcAnswer::Block(ledger.read_block(Height::new(h))?.map(Box::new))
        }
        RpcQuery::Block(BlockRef::Hash(hash)) => {
            RpcAnswer::Block(ledger.read_block_by_hash(&hash)?.map(Box::new))
        }
        RpcQuery::FinalityProof(h) => RpcAnswer::Proof(
            ledger
                .finality_proof(Height::new(h))?
                .map(|p| p.to_ace_bytes()),
        ),
        RpcQuery::Transaction(tx_id) => RpcAnswer::Transaction(
            located(ledger, &tx_id, |block, index| {
                Ok(block
                    .block
                    .body
                    .transactions
                    .get(usize::try_from(index).unwrap_or(usize::MAX))
                    .cloned())
            })?
            .map(Box::new),
        ),
        RpcQuery::Receipt(tx_id) => RpcAnswer::Receipt(
            located(ledger, &tx_id, |block, index| {
                ledger.receipt_at(block.block.header.height, index)
            })?
            .map(Box::new),
        ),
        RpcQuery::Account(address) => RpcAnswer::Account(ledger.account_at_tip(&address)?),
        RpcQuery::Balance(address, asset) => {
            RpcAnswer::Balance(ledger.balance_at_tip(&address, asset)?)
        }
        RpcQuery::Assets => {
            let mut out = Vec::new();
            for asset in KNOWN_ASSETS {
                if let Some(config) = ledger.asset_at_tip(asset)? {
                    out.push((asset, config));
                }
            }
            RpcAnswer::Assets(out)
        }
        RpcQuery::Supply(asset) => RpcAnswer::Supply(ledger.supply_at_tip(asset)?.map(Box::new)),
        RpcQuery::Simulate(bytes) => RpcAnswer::Simulated(Box::new(ledger.simulate(&bytes)?)),
    })
}

/// The RPC backend of a running node.
#[derive(Debug, Clone)]
pub struct NodeBackend {
    pub(crate) chain: ChainHandle,
    pub(crate) submissions: mpsc::Sender<Submission>,
    pub(crate) network: NetworkIdentity,
}

fn unexpected() -> AletheiaError {
    AletheiaError::new(
        aletheia_core::ErrorCode::StoIo,
        "the chain thread answered another query".to_owned(),
    )
}

impl NodeBackend {
    async fn ask(&self, query: RpcQuery) -> Result<RpcAnswer, AletheiaError> {
        self.chain.rpc(query).await
    }
}

impl Backend for NodeBackend {
    fn network(&self) -> NetworkIdentity {
        self.network
    }

    async fn status(&self) -> Result<NodeStatus, AletheiaError> {
        match self.ask(RpcQuery::Status).await? {
            RpcAnswer::Status(s) => Ok(s),
            _ => Err(unexpected()),
        }
    }

    async fn block(&self, at: BlockRef) -> Result<Option<Proposal>, AletheiaError> {
        match self.ask(RpcQuery::Block(at)).await? {
            RpcAnswer::Block(b) => Ok(b.map(|b| *b)),
            _ => Err(unexpected()),
        }
    }

    async fn finality_proof(&self, height: u64) -> Result<Option<Vec<u8>>, AletheiaError> {
        match self.ask(RpcQuery::FinalityProof(height)).await? {
            RpcAnswer::Proof(p) => Ok(p),
            _ => Err(unexpected()),
        }
    }

    async fn transaction(
        &self,
        tx_id: Hash32,
    ) -> Result<Option<Located<SignedTransaction>>, AletheiaError> {
        match self.ask(RpcQuery::Transaction(tx_id)).await? {
            RpcAnswer::Transaction(t) => Ok(t.map(|t| *t)),
            _ => Err(unexpected()),
        }
    }

    async fn receipt(&self, tx_id: Hash32) -> Result<Option<Located<Receipt>>, AletheiaError> {
        match self.ask(RpcQuery::Receipt(tx_id)).await? {
            RpcAnswer::Receipt(r) => Ok(r.map(|r| *r)),
            _ => Err(unexpected()),
        }
    }

    async fn account(&self, address: Address) -> Result<Option<Account>, AletheiaError> {
        match self.ask(RpcQuery::Account(address)).await? {
            RpcAnswer::Account(a) => Ok(a),
            _ => Err(unexpected()),
        }
    }

    async fn balance(&self, address: Address, asset: AssetId) -> Result<Balance, AletheiaError> {
        match self.ask(RpcQuery::Balance(address, asset)).await? {
            RpcAnswer::Balance(b) => Ok(b),
            _ => Err(unexpected()),
        }
    }

    async fn assets(&self) -> Result<Vec<(AssetId, AssetConfig)>, AletheiaError> {
        match self.ask(RpcQuery::Assets).await? {
            RpcAnswer::Assets(a) => Ok(a),
            _ => Err(unexpected()),
        }
    }

    async fn supply(&self, asset: AssetId) -> Result<Option<SupplyLedger>, AletheiaError> {
        match self.ask(RpcQuery::Supply(asset)).await? {
            RpcAnswer::Supply(s) => Ok(s.map(|s| *s)),
            _ => Err(unexpected()),
        }
    }

    async fn submit(&self, bytes: Vec<u8>) -> Result<Hash32, AletheiaError> {
        let transaction = SignedTransaction::from_ace_bytes(&bytes)?;
        let (reply, response) = oneshot::channel();
        self.submissions
            .try_send(Submission { transaction, reply })
            .map_err(|_| {
                AletheiaError::new(
                    aletheia_core::ErrorCode::TxFieldOutOfRange,
                    "submission queue is full; retry".to_owned(),
                )
            })?;
        response.await.map_err(|_| {
            AletheiaError::new(
                aletheia_core::ErrorCode::StoIo,
                "the node stopped".to_owned(),
            )
        })?
    }

    async fn simulate(&self, bytes: Vec<u8>) -> Result<Receipt, AletheiaError> {
        match self.ask(RpcQuery::Simulate(bytes)).await? {
            RpcAnswer::Simulated(r) => Ok(*r),
            _ => Err(unexpected()),
        }
    }
}
