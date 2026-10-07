//! In-memory [`KvStore`] for tests and tooling. NON-PRODUCTION: it holds everything in RAM
//! and its "durability" is the process lifetime. It passes the same conformance suite as
//! RocksDB so tests written against it mean the same thing.
//!
//! Its checkpoint is one checksummed file per directory, readable back with
//! [`MemoryKvStore::open_checkpoint`], so migration tests can exercise the checkpoint and
//! rollback path without RocksDB.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, RwLock};

use aletheia_core::{AceReader, AceWriter, AletheiaError, ErrorCode};

use crate::fsutil;
use crate::kv::{ColumnFamily, KvPairs, KvSnapshot, KvStore, WriteBatch, WriteOp};

type Table = BTreeMap<(ColumnFamily, Vec<u8>), Vec<u8>>;

const CHECKPOINT_FILE: &str = "memory-kv.checkpoint";
const CHECKPOINT_MAGIC: &[u8; 8] = b"ALMEMKV1";

#[derive(Debug, Default)]
pub struct MemoryKvStore {
    // Snapshots share the table by cloning the Arc; a write replaces it (copy on write), so a
    // snapshot never observes later writes. Fine for tests; RocksDB does this natively.
    table: RwLock<Arc<Table>>,
}

fn poisoned() -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoIo,
        "memory store lock poisoned by a panicking writer".to_owned(),
    )
}

fn range_of(table: &Table, cf: ColumnFamily, from: &[u8], to: &[u8], limit: usize) -> KvPairs {
    if from >= to {
        return Vec::new();
    }
    table
        .range((cf, from.to_vec())..(cf, to.to_vec()))
        .take(limit)
        .map(|((_, key), value)| (key.clone(), value.clone()))
        .collect()
}

impl MemoryKvStore {
    pub fn new() -> MemoryKvStore {
        MemoryKvStore::default()
    }

    /// Loads a checkpoint written by [`KvStore::checkpoint`].
    pub fn open_checkpoint(dir: &Path) -> Result<MemoryKvStore, AletheiaError> {
        let bytes = fsutil::read_checksummed(&dir.join(CHECKPOINT_FILE), CHECKPOINT_MAGIC)?;
        let mut reader = AceReader::new(&bytes);
        let count = reader.u64()?;
        let mut table = Table::new();
        for _ in 0..count {
            let code = reader.u8()?;
            let cf = ColumnFamily::from_code(code).ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    format!("checkpoint names unknown column family {code}"),
                )
            })?;
            let key = reader.bytes(u32::MAX)?.to_vec();
            let value = reader.bytes(u32::MAX)?.to_vec();
            table.insert((cf, key), value);
        }
        reader.finish()?;
        Ok(MemoryKvStore {
            table: RwLock::new(Arc::new(table)),
        })
    }

    fn current(&self) -> Result<Arc<Table>, AletheiaError> {
        self.table
            .read()
            .map(|guard| Arc::clone(&guard))
            .map_err(|_| poisoned())
    }

    fn apply(&self, batch: WriteBatch) -> Result<(), AletheiaError> {
        let mut guard = self.table.write().map_err(|_| poisoned())?;
        let mut next: Table = (**guard).clone();
        for op in batch.into_ops() {
            match op {
                WriteOp::Put { cf, key, value } => {
                    next.insert((cf, key), value);
                }
                WriteOp::Delete { cf, key } => {
                    next.remove(&(cf, key));
                }
            }
        }
        *guard = Arc::new(next);
        Ok(())
    }
}

struct MemorySnapshot {
    table: Arc<Table>,
}

impl KvSnapshot for MemorySnapshot {
    fn get(&self, cf: ColumnFamily, key: &[u8]) -> Result<Option<Vec<u8>>, AletheiaError> {
        Ok(self.table.get(&(cf, key.to_vec())).cloned())
    }

    fn range(
        &self,
        cf: ColumnFamily,
        from: &[u8],
        to: &[u8],
        limit: usize,
    ) -> Result<KvPairs, AletheiaError> {
        Ok(range_of(&self.table, cf, from, to, limit))
    }
}

impl KvStore for MemoryKvStore {
    fn get(&self, cf: ColumnFamily, key: &[u8]) -> Result<Option<Vec<u8>>, AletheiaError> {
        Ok(self.current()?.get(&(cf, key.to_vec())).cloned())
    }

    fn range(
        &self,
        cf: ColumnFamily,
        from: &[u8],
        to: &[u8],
        limit: usize,
    ) -> Result<KvPairs, AletheiaError> {
        let table = self.current()?;
        Ok(range_of(&table, cf, from, to, limit))
    }

    fn write_sync(&self, batch: WriteBatch) -> Result<(), AletheiaError> {
        self.apply(batch)
    }

    fn write(&self, batch: WriteBatch) -> Result<(), AletheiaError> {
        self.apply(batch)
    }

    fn snapshot(&self) -> Result<Box<dyn KvSnapshot + '_>, AletheiaError> {
        Ok(Box::new(MemorySnapshot {
            table: self.current()?,
        }))
    }

    fn checkpoint(&self, dir: &Path) -> Result<(), AletheiaError> {
        if dir.exists() {
            return Err(AletheiaError::new(
                ErrorCode::StoIo,
                format!("checkpoint directory {} already exists", dir.display()),
            ));
        }
        fsutil::create_dir_all(dir)?;
        let table = self.current()?;
        let mut out = AceWriter::new();
        out.u64(u64::try_from(table.len()).unwrap_or(u64::MAX));
        for ((cf, key), value) in table.iter() {
            out.u8(cf.code());
            out.bytes(key);
            out.bytes(value);
        }
        fsutil::write_checksummed_atomically(
            &dir.join(CHECKPOINT_FILE),
            CHECKPOINT_MAGIC,
            out.as_bytes(),
        )
    }
}
