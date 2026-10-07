//! Persistent storage for Aletheia StableChain (spec Sections 24, 42, 44.5): the `KvStore`
//! contract and its backends, the consensus WAL, the block archive and the data-directory
//! manifest. Every failure here is reported with the path or record involved; corruption
//! and wrong-chain conditions are fail-stop.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing
    )
)]

pub mod archive;
pub mod datadir;
mod fsutil;
pub mod kv;
pub mod memory;
pub mod migrate;
#[cfg(feature = "rocksdb")]
pub mod rocks;
pub mod wal;

pub use kv::{ColumnFamily, KvPairs, KvSnapshot, KvStore, WriteBatch, WriteOp};
pub use memory::MemoryKvStore;
