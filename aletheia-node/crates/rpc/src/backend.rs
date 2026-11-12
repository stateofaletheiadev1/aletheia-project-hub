//! What the service layer needs from a node. The node implements it over its chain thread
//! (finalized data only); tests implement it over a devnet.

use core::future::Future;

use aletheia_core::block::Proposal;
use aletheia_core::tx::SignedTransaction;
use aletheia_core::{Address, AletheiaError, AssetId, Hash32, NetworkIdentity};
use aletheia_execution::model::{Account, AssetConfig, Balance, ValidatorRecord};
use aletheia_execution::{Event, Receipt};
use aletheia_monetary::SupplyLedger;
use aletheia_state::{StateKey, StateProof};

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

/// A state value read at the finalized tip, with its proof against that block's state root.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StateRead {
    pub height: u64,
    pub block_hash: Hash32,
    pub state_root: Hash32,
    /// The stored record (canonical ACE), or `None` when the key is absent.
    pub value: Option<Vec<u8>>,
    /// Inclusion proof for a value, non-inclusion proof for an absent key.
    pub proof: StateProof,
}

/// Which events `getEvents` returns (ADR-067). At least one field is set; every field set must
/// match.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct EventFilter {
    pub emitter: Option<Address>,
    pub event_type: Option<Hash32>,
    pub topic: Option<Hash32>,
}

impl EventFilter {
    pub fn matches(&self, event: &Event) -> bool {
        self.emitter.is_none_or(|e| event.emitter == e)
            && self.event_type.is_none_or(|t| event.event_type == t)
            && self.topic.is_none_or(|t| event.topics.contains(&t))
    }
}

/// A finalized event and where it is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FoundEvent {
    pub height: u64,
    pub index: u32,
    pub event_index: u16,
    pub tx_id: Hash32,
    pub event: Event,
}

/// A page of events, newest first; `next` resumes after the last position examined.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct EventPage {
    pub events: Vec<FoundEvent>,
    pub next: Option<(u64, u32, u16)>,
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

    /// The validator set of `epoch` at the finalized tip, in validator-index order. `None`
    /// when no set is recorded (a devnet or regtest chain run by the single-node producer).
    fn validators(
        &self,
        epoch: u64,
    ) -> impl Future<Output = Result<Option<Vec<ValidatorRecord>>, AletheiaError>> + Send;

    /// Finalized transactions touching `address` (sender or transfer recipient), newest first,
    /// as tx ids; `before` is an exclusive `(height, index)` cursor (ADR-064).
    fn account_history(
        &self,
        address: Address,
        before: Option<(u64, u32)>,
        limit: usize,
    ) -> impl Future<Output = Result<Vec<(u64, u32, Hash32)>, AletheiaError>> + Send;

    /// `key` at the finalized tip, with its state proof.
    fn state_proof(
        &self,
        key: StateKey,
    ) -> impl Future<Output = Result<StateRead, AletheiaError>> + Send;

    /// Finalized events matching `filter`, newest first, strictly before `before`
    /// (ADR-067).
    fn events(
        &self,
        filter: EventFilter,
        before: Option<(u64, u32, u16)>,
        limit: usize,
    ) -> impl Future<Output = Result<EventPage, AletheiaError>> + Send;

    /// Admits a signed transaction to the mempool; returns its id.
    fn submit(&self, bytes: Vec<u8>) -> impl Future<Output = Result<Hash32, AletheiaError>> + Send;

    /// Executes a signed transaction against the finalized state without committing it.
    fn simulate(
        &self,
        bytes: Vec<u8>,
    ) -> impl Future<Output = Result<Receipt, AletheiaError>> + Send;
}
