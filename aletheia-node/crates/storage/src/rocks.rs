//! RocksDB backend for [`KvStore`] (spec Sections 5.3, 42.2). Production storage for the
//! "state" and "chain" instances; it passes the same conformance suite as the memory backend.
//!
//! Compression is a storage artifact only: every commitment is over uncompressed ACE bytes.

use std::path::Path;

use aletheia_core::{AletheiaError, ErrorCode};
use rocksdb::{
    BlockBasedOptions, Cache, ChecksumType, ColumnFamilyDescriptor, DB, DBCompressionType,
    Direction, IteratorMode, Options, ReadOptions, WriteOptions,
};

use crate::kv::{ColumnFamily, KvPairs, KvSnapshot, KvStore, WriteBatch, WriteOp};

/// Resource limits for one RocksDB instance (Section 46.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StorageBudget {
    pub max_open_files: i32,
    pub background_jobs: i32,
    pub block_cache_bytes: usize,
}

impl Default for StorageBudget {
    fn default() -> StorageBudget {
        StorageBudget {
            max_open_files: 4096,
            background_jobs: 4,
            block_cache_bytes: 512 * 1024 * 1024,
        }
    }
}

/// Whether opening may create a new database. Recovery never does: a missing database is an
/// operator error, not a fresh start (42.2). Only genesis initialization creates one.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenMode {
    CreateNew,
    Existing,
}

fn rocks_error(action: &str, error: &rocksdb::Error) -> AletheiaError {
    let text = error.to_string();
    let code = if text.contains("Corruption") {
        ErrorCode::StoCorrupt
    } else {
        ErrorCode::StoIo
    };
    AletheiaError::new(code, format!("RocksDB {action}: {text}"))
}

pub(crate) fn state_db_options(budget: &StorageBudget, mode: OpenMode) -> Options {
    let mut options = Options::default();
    options.create_if_missing(mode == OpenMode::CreateNew);
    options.create_missing_column_families(mode == OpenMode::CreateNew);
    options.set_paranoid_checks(true); // surface corruption at open, not at first read
    options.set_max_open_files(budget.max_open_files);
    options.set_bytes_per_sync(1 << 20); // smooth background writeback; avoids fsync stalls
    options.set_max_background_jobs(budget.background_jobs);

    // LZ4 on hot levels for latency, zstd on cold levels for size.
    options.set_compression_per_level(&[
        DBCompressionType::None,
        DBCompressionType::Lz4,
        DBCompressionType::Lz4,
        DBCompressionType::Zstd,
        DBCompressionType::Zstd,
        DBCompressionType::Zstd,
        DBCompressionType::Zstd,
    ]);
    // RocksDB refuses dictionary training without a dictionary size (ERRATA E-16): 16 KiB
    // dictionaries, default window and level.
    options.set_compression_options(-14, 32767, 0, 16 * 1024);
    options.set_zstd_max_train_bytes(100 << 20);

    let mut table = BlockBasedOptions::default();
    table.set_block_cache(&Cache::new_lru_cache(budget.block_cache_bytes));
    table.set_bloom_filter(10.0, false); // JMT node lookups are point reads
    table.set_format_version(5);
    table.set_checksum_type(ChecksumType::XXH3);
    options.set_block_based_table_factory(&table);
    options
}

fn sync_write_options(sync: bool) -> WriteOptions {
    let mut write = WriteOptions::default();
    write.set_sync(sync); // Section 24.2: the finalize batch is durable before FINALIZE_COMMITTED
    write.disable_wal(false); // RocksDB's own WAL stays on; the consensus WAL is in addition
    write
}

#[derive(Debug)]
pub struct RocksKvStore {
    db: DB,
}

impl RocksKvStore {
    pub fn open(
        path: &Path,
        budget: &StorageBudget,
        mode: OpenMode,
    ) -> Result<RocksKvStore, AletheiaError> {
        let options = state_db_options(budget, mode);
        let families = ColumnFamily::ALL
            .map(|cf| ColumnFamilyDescriptor::new(cf.name(), state_db_options(budget, mode)));
        let db = DB::open_cf_descriptors(&options, path, families)
            .map_err(|e| rocks_error(&format!("open {}", path.display()), &e))?;
        Ok(RocksKvStore { db })
    }

    fn handle(&self, cf: ColumnFamily) -> Result<&rocksdb::ColumnFamily, AletheiaError> {
        self.db.cf_handle(cf.name()).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::StoCorrupt,
                format!("RocksDB column family {} is missing", cf.name()),
            )
        })
    }

    fn apply(&self, batch: WriteBatch, sync: bool) -> Result<(), AletheiaError> {
        let mut rocks_batch = rocksdb::WriteBatch::default();
        for op in batch.into_ops() {
            match op {
                WriteOp::Put { cf, key, value } => rocks_batch.put_cf(self.handle(cf)?, key, value),
                WriteOp::Delete { cf, key } => rocks_batch.delete_cf(self.handle(cf)?, key),
            }
        }
        self.db
            .write_opt(rocks_batch, &sync_write_options(sync))
            .map_err(|e| rocks_error("write batch", &e))
    }
}

fn collect_range(
    iterator: impl Iterator<Item = Result<(Box<[u8]>, Box<[u8]>), rocksdb::Error>>,
    to: &[u8],
    limit: usize,
) -> Result<KvPairs, AletheiaError> {
    let mut pairs = Vec::new();
    for item in iterator {
        if pairs.len() >= limit {
            break;
        }
        let (key, value) = item.map_err(|e| rocks_error("iterate", &e))?;
        if &*key >= to {
            break;
        }
        pairs.push((key.into_vec(), value.into_vec()));
    }
    Ok(pairs)
}

struct RocksSnapshot<'a> {
    store: &'a RocksKvStore,
    snapshot: rocksdb::Snapshot<'a>,
}

impl KvSnapshot for RocksSnapshot<'_> {
    fn get(&self, cf: ColumnFamily, key: &[u8]) -> Result<Option<Vec<u8>>, AletheiaError> {
        self.snapshot
            .get_cf(self.store.handle(cf)?, key)
            .map_err(|e| rocks_error("snapshot get", &e))
    }

    fn range(
        &self,
        cf: ColumnFamily,
        from: &[u8],
        to: &[u8],
        limit: usize,
    ) -> Result<KvPairs, AletheiaError> {
        if from >= to {
            return Ok(Vec::new());
        }
        let iterator = self.snapshot.iterator_cf(
            self.store.handle(cf)?,
            IteratorMode::From(from, Direction::Forward),
        );
        collect_range(iterator, to, limit)
    }
}

impl KvStore for RocksKvStore {
    fn get(&self, cf: ColumnFamily, key: &[u8]) -> Result<Option<Vec<u8>>, AletheiaError> {
        self.db
            .get_cf(self.handle(cf)?, key)
            .map_err(|e| rocks_error("get", &e))
    }

    fn range(
        &self,
        cf: ColumnFamily,
        from: &[u8],
        to: &[u8],
        limit: usize,
    ) -> Result<KvPairs, AletheiaError> {
        if from >= to {
            return Ok(Vec::new());
        }
        let mut read = ReadOptions::default();
        read.set_iterate_upper_bound(to.to_vec());
        let iterator = self.db.iterator_cf_opt(
            self.handle(cf)?,
            read,
            IteratorMode::From(from, Direction::Forward),
        );
        collect_range(iterator, to, limit)
    }

    fn write_sync(&self, batch: WriteBatch) -> Result<(), AletheiaError> {
        self.apply(batch, true)
    }

    fn write(&self, batch: WriteBatch) -> Result<(), AletheiaError> {
        self.apply(batch, false)
    }

    fn snapshot(&self) -> Result<Box<dyn KvSnapshot + '_>, AletheiaError> {
        Ok(Box::new(RocksSnapshot {
            store: self,
            snapshot: self.db.snapshot(),
        }))
    }

    fn checkpoint(&self, dir: &Path) -> Result<(), AletheiaError> {
        if dir.exists() {
            return Err(AletheiaError::new(
                ErrorCode::StoIo,
                format!("checkpoint directory {} already exists", dir.display()),
            ));
        }
        rocksdb::checkpoint::Checkpoint::new(&self.db)
            .and_then(|checkpoint| checkpoint.create_checkpoint(dir))
            .map_err(|e| rocks_error(&format!("checkpoint into {}", dir.display()), &e))
    }
}
