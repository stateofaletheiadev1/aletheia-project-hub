//! The key-value contract consensus code relies on (spec Section 42.1).
//!
//! RocksDB is the production backend; [`crate::memory::MemoryKvStore`] exists for tests.
//! Both pass the same conformance suite (`tests/kvstore_conformance.rs`). Consensus
//! correctness must not depend on anything this trait does not promise.

use aletheia_core::AletheiaError;

/// Column families. The set is part of the storage schema (Section 44.5): adding or
/// removing one is a schema change with a migration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ColumnFamily {
    JmtNodes,
    StateValues,
    StaleJmtNodes,
    BlockIndex,
    TxIndex,
    Receipts,
    Events,
    FinalityProofs,
    Meta,
}

impl ColumnFamily {
    pub const ALL: [ColumnFamily; 9] = [
        ColumnFamily::JmtNodes,
        ColumnFamily::StateValues,
        ColumnFamily::StaleJmtNodes,
        ColumnFamily::BlockIndex,
        ColumnFamily::TxIndex,
        ColumnFamily::Receipts,
        ColumnFamily::Events,
        ColumnFamily::FinalityProofs,
        ColumnFamily::Meta,
    ];

    /// Stable on-disk name (RocksDB column family name, checkpoint file name).
    pub const fn name(self) -> &'static str {
        match self {
            ColumnFamily::JmtNodes => "jmt_nodes",
            ColumnFamily::StateValues => "state_values",
            ColumnFamily::StaleJmtNodes => "stale_jmt_nodes",
            ColumnFamily::BlockIndex => "block_index",
            ColumnFamily::TxIndex => "tx_index",
            ColumnFamily::Receipts => "receipts",
            ColumnFamily::Events => "events",
            ColumnFamily::FinalityProofs => "finality_proofs",
            ColumnFamily::Meta => "meta",
        }
    }

    pub(crate) const fn code(self) -> u8 {
        match self {
            ColumnFamily::JmtNodes => 1,
            ColumnFamily::StateValues => 2,
            ColumnFamily::StaleJmtNodes => 3,
            ColumnFamily::BlockIndex => 4,
            ColumnFamily::TxIndex => 5,
            ColumnFamily::Receipts => 6,
            ColumnFamily::Events => 7,
            ColumnFamily::FinalityProofs => 8,
            ColumnFamily::Meta => 9,
        }
    }

    pub(crate) fn from_code(code: u8) -> Option<ColumnFamily> {
        ColumnFamily::ALL.into_iter().find(|cf| cf.code() == code)
    }
}

/// One write in a batch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WriteOp {
    Put {
        cf: ColumnFamily,
        key: Vec<u8>,
        value: Vec<u8>,
    },
    Delete {
        cf: ColumnFamily,
        key: Vec<u8>,
    },
}

/// Writes applied atomically, in order: a later write to the same key wins.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WriteBatch {
    ops: Vec<WriteOp>,
}

impl WriteBatch {
    pub fn new() -> WriteBatch {
        WriteBatch { ops: Vec::new() }
    }

    pub fn put(&mut self, cf: ColumnFamily, key: &[u8], value: &[u8]) {
        self.ops.push(WriteOp::Put {
            cf,
            key: key.to_vec(),
            value: value.to_vec(),
        });
    }

    pub fn delete(&mut self, cf: ColumnFamily, key: &[u8]) {
        self.ops.push(WriteOp::Delete {
            cf,
            key: key.to_vec(),
        });
    }

    pub fn ops(&self) -> &[WriteOp] {
        &self.ops
    }

    pub fn into_ops(self) -> Vec<WriteOp> {
        self.ops
    }

    pub fn len(&self) -> usize {
        self.ops.len()
    }

    pub fn is_empty(&self) -> bool {
        self.ops.is_empty()
    }
}

/// `(key, value)` pairs in ascending key order.
pub type KvPairs = Vec<(Vec<u8>, Vec<u8>)>;

/// A consistent point-in-time view. Writes made after it was taken are invisible to it.
pub trait KvSnapshot {
    fn get(&self, cf: ColumnFamily, key: &[u8]) -> Result<Option<Vec<u8>>, AletheiaError>;

    /// Keys in `[from, to)`, ascending, at most `limit` pairs.
    fn range(
        &self,
        cf: ColumnFamily,
        from: &[u8],
        to: &[u8],
        limit: usize,
    ) -> Result<KvPairs, AletheiaError>;
}

/// The only way consensus code touches persistent key-value storage.
pub trait KvStore: Send + Sync {
    fn get(&self, cf: ColumnFamily, key: &[u8]) -> Result<Option<Vec<u8>>, AletheiaError>;

    /// Keys in `[from, to)`, ascending, at most `limit` pairs. Iteration order is part of the
    /// contract.
    fn range(
        &self,
        cf: ColumnFamily,
        from: &[u8],
        to: &[u8],
        limit: usize,
    ) -> Result<KvPairs, AletheiaError>;

    fn batch(&self) -> WriteBatch {
        WriteBatch::new()
    }

    /// Atomic and durable when it returns Ok: all writes or none, surviving power loss.
    fn write_sync(&self, batch: WriteBatch) -> Result<(), AletheiaError>;

    /// Atomic, not yet durable. Never used on the finalize path.
    fn write(&self, batch: WriteBatch) -> Result<(), AletheiaError>;

    /// Consistent point-in-time read view (RPC, snapshots, migrations).
    fn snapshot(&self) -> Result<Box<dyn KvSnapshot + '_>, AletheiaError>;

    /// Point-in-time copy into `dir`, which must not exist yet (Section 44.5 migration
    /// step 2). RocksDB uses hard links; other backends may copy.
    fn checkpoint(&self, dir: &std::path::Path) -> Result<(), AletheiaError>;
}

/// Shared ownership of a store: the node's components hold one handle each, and crash tests
/// keep the store alive across a simulated restart.
impl<T: KvStore + ?Sized> KvStore for std::sync::Arc<T> {
    fn get(&self, cf: ColumnFamily, key: &[u8]) -> Result<Option<Vec<u8>>, AletheiaError> {
        (**self).get(cf, key)
    }

    fn range(
        &self,
        cf: ColumnFamily,
        from: &[u8],
        to: &[u8],
        limit: usize,
    ) -> Result<KvPairs, AletheiaError> {
        (**self).range(cf, from, to, limit)
    }

    fn write_sync(&self, batch: WriteBatch) -> Result<(), AletheiaError> {
        (**self).write_sync(batch)
    }

    fn write(&self, batch: WriteBatch) -> Result<(), AletheiaError> {
        (**self).write(batch)
    }

    fn snapshot(&self) -> Result<Box<dyn KvSnapshot + '_>, AletheiaError> {
        (**self).snapshot()
    }

    fn checkpoint(&self, dir: &std::path::Path) -> Result<(), AletheiaError> {
        (**self).checkpoint(dir)
    }
}
