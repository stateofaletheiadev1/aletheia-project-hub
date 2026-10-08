//! What the service layer needs from a node. The node implements it over its chain thread
//! (finalized data only); tests implement it over a devnet.

use core::future::Future;

use aletheia_core::block::Proposal;
use aletheia_core::tx::SignedTransaction;
use aletheia_core::{Address, AletheiaError, AssetId, Hash32, NetworkIdentity};
use aletheia_execution::Receipt;
use aletheia_execution::model::{Account, AssetConfig, Balance};
use aletheia_monetary::SupplyLedger;

/// The node's state as the status endpoints report it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeStatus {
    pub finalized_height: u64,
    pub finalized_hash: Hash32,
    pub protocol_version: u16,
    /// Connected peers, when the node reports them.
    pub peers: Option<u32>,
    pub syncing: bool,
}

/// A block by height or hash.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlockRef {
    Height(u64),
    Hash(Hash32),
}

/// A finalized transaction and where it is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Located<T> {
    pub value: T,
    pub height: u64,
    pub index: u32,
    pub block_hash: Hash32,
    pub slot: u64,
}

/// Finalized-only reads and the two writes (submit, simulate). Every read is of finalized
/// state; nothing speculative is served.
pub trait Backend: Send + Sync {
    fn network(&self) -> NetworkIdentity;

    fn status(&self) -> impl Future<Output = Result<NodeStatus, AletheiaError>> + Send;

    fn block(
        &self,
        at: BlockRef,
    ) -> impl Future<Output = Result<Option<Proposal>, AletheiaError>> + Send;

    /// The finality proof stored for a block, in its canonical encoding.
    fn finality_proof(
        &self,
        height: u64,
    ) -> impl Future<Output = Result<Option<Vec<u8>>, AletheiaError>> + Send;

    fn transaction(
        &self,
        tx_id: Hash32,
    ) -> impl Future<Output = Result<Option<Located<SignedTransaction>>, AletheiaError>> + Send;

    fn receipt(
        &self,
        tx_id: Hash32,
    ) -> impl Future<Output = Result<Option<Located<Receipt>>, AletheiaError>> + Send;

    fn account(
        &self,
        address: Address,
    ) -> impl Future<Output = Result<Option<Account>, AletheiaError>> + Send;

    fn balance(
        &self,
        address: Address,
        asset: AssetId,
    ) -> impl Future<Output = Result<Balance, AletheiaError>> + Send;

    fn assets(
        &self,
    ) -> impl Future<Output = Result<Vec<(AssetId, AssetConfig)>, AletheiaError>> + Send;

    fn supply(
        &self,
        asset: AssetId,
    ) -> impl Future<Output = Result<Option<SupplyLedger>, AletheiaError>> + Send;

    /// Admits a signed transaction to the mempool; returns its id.
    fn submit(&self, bytes: Vec<u8>) -> impl Future<Output = Result<Hash32, AletheiaError>> + Send;

    /// Executes a signed transaction against the finalized state without committing it.
    fn simulate(
        &self,
        bytes: Vec<u8>,
    ) -> impl Future<Output = Result<Receipt, AletheiaError>> + Send;
}
