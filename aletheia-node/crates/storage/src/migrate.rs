//! Forward-only storage-schema migrations (spec Section 44.5, APS-0055, ADR-030).
//!
//! Each step `s → s+1`:
//!
//! 1. starts only from a recovered, consistent finalized tip (the caller's responsibility);
//! 2. checkpoints the store into `migrations/pre-<s>/` and records `migration_in_progress`
//!    in `DATADIR` before touching any data;
//! 3. runs the step, which processes keys in sorted order and reports progress; the runner
//!    journals the last completed key to `migrations/journal-<s>.ace` at least every
//!    [`JOURNAL_INTERVAL`] keys, so a crash resumes instead of restarting;
//! 4. verifies the step's own invariants and the chain tip (JMT root and archive entry at
//!    `last_finalized`, supplied by the caller);
//! 5. writes the new `storage_schema` and clears `migration_in_progress` in one atomic
//!    manifest replacement.
//!
//! The pre-migration checkpoint is kept for the operator (`aletheia-admin migrations prune`);
//! it is never deleted automatically.

use std::path::{Path, PathBuf};

use aletheia_core::{AceReader, AceWriter, AletheiaError, ErrorCode};

use crate::datadir::{DataDir, MigrationInProgress};
use crate::fsutil;
use crate::kv::KvStore;

/// Journal at least this often (Section 44.5 step 3).
pub const JOURNAL_INTERVAL: u64 = 10_000;

const JOURNAL_MAGIC: &[u8; 8] = b"ALMIGJ01";

/// One schema step. Implementations must be idempotent: re-running from any journaled key
/// produces the same result as an uninterrupted run.
pub trait MigrationStep {
    /// The schema this step upgrades from; it produces `source_schema() + 1`.
    fn source_schema(&self) -> u32;

    fn description(&self) -> &'static str;

    /// Processes keys strictly after `resume_after`, in ascending order, calling `progress`
    /// with each completed key. Writes go through `store` in batches the step chooses.
    fn run(
        &self,
        store: &dyn KvStore,
        resume_after: Option<&[u8]>,
        progress: &mut dyn FnMut(&[u8]) -> Result<(), AletheiaError>,
    ) -> Result<(), AletheiaError>;

    /// The step's own invariant check after it ran (e.g. key counts per column family).
    fn verify(&self, store: &dyn KvStore) -> Result<(), AletheiaError>;
}

fn migration_failed(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::StoMigrationFailed, detail)
}

fn journal_path(datadir: &DataDir, from: u32) -> PathBuf {
    datadir
        .path("migrations")
        .join(format!("journal-{from}.ace"))
}

fn checkpoint_rel(from: u32) -> String {
    format!("migrations/pre-{from}")
}

fn read_journal(path: &Path) -> Result<Option<Vec<u8>>, AletheiaError> {
    if !path.exists() {
        return Ok(None);
    }
    let payload = fsutil::read_checksummed(path, JOURNAL_MAGIC)?;
    let mut reader = AceReader::new(&payload);
    let key = reader.bytes(u32::MAX)?.to_vec();
    reader.finish()?;
    Ok(Some(key))
}

fn write_journal(path: &Path, last_key: &[u8]) -> Result<(), AletheiaError> {
    let mut out = AceWriter::new();
    out.bytes(last_key);
    fsutil::write_checksummed_atomically(path, JOURNAL_MAGIC, out.as_bytes())
}

/// Runs every step from the directory's current schema (or its interrupted migration) up to
/// `target`. `verify_tip` re-checks the finalized tip against the migrated layout.
pub fn migrate(
    datadir: &mut DataDir,
    store: &dyn KvStore,
    steps: &[&dyn MigrationStep],
    target: u32,
    verify_tip: &dyn Fn(&dyn KvStore) -> Result<(), AletheiaError>,
) -> Result<(), AletheiaError> {
    loop {
        let manifest = datadir.manifest().clone();
        let from = manifest
            .migration_in_progress
            .as_ref()
            .map_or(manifest.storage_schema, |m| m.from);
        if from >= target && manifest.migration_in_progress.is_none() {
            return Ok(());
        }
        let step = steps
            .iter()
            .find(|step| step.source_schema() == from)
            .ok_or_else(|| {
                migration_failed(format!(
                    "no migration step from storage schema {from} (target {target})"
                ))
            })?;
        let to = from
            .checked_add(1)
            .ok_or_else(|| migration_failed("storage schema exhausted".to_owned()))?;

        if manifest.migration_in_progress.is_none() {
            let checkpoint = datadir.path(&checkpoint_rel(from));
            if !checkpoint.exists() {
                store.checkpoint(&checkpoint)?;
            }
            let mut next = manifest.clone();
            next.migration_in_progress = Some(MigrationInProgress {
                from,
                to,
                step: from,
                checkpoint_dir: checkpoint_rel(from),
            });
            datadir.write_manifest(next)?;
        }

        let journal = journal_path(datadir, from);
        let resume_after = read_journal(&journal)?;
        let mut since_journal = 0u64;
        let mut progress = |key: &[u8]| -> Result<(), AletheiaError> {
            since_journal = since_journal.saturating_add(1);
            if since_journal >= JOURNAL_INTERVAL {
                write_journal(&journal, key)?;
                since_journal = 0;
            }
            Ok(())
        };
        step.run(store, resume_after.as_deref(), &mut progress)
            .map_err(|error| {
                migration_failed(format!(
                    "step {from}->{to} ({}) stopped: {error}",
                    step.description()
                ))
            })?;
        step.verify(store).map_err(|error| {
            migration_failed(format!("step {from}->{to} failed its own check: {error}"))
        })?;
        verify_tip(store).map_err(|error| {
            migration_failed(format!(
                "step {from}->{to} broke the finalized tip: {error}"
            ))
        })?;

        let mut done = datadir.manifest().clone();
        done.storage_schema = to;
        done.migration_in_progress = None;
        datadir.write_manifest(done)?;
        if journal.exists() {
            std::fs::remove_file(&journal)
                .map_err(|e| fsutil::io_error("remove migration journal", &journal, &e))?;
        }
    }
}

/// Abandons an interrupted migration after the caller has restored the store from
/// `migration_in_progress.checkpoint_dir` (backend-specific). The schema stays at `from`.
pub fn mark_rolled_back(datadir: &mut DataDir) -> Result<(), AletheiaError> {
    let mut manifest = datadir.manifest().clone();
    let Some(migration) = manifest.migration_in_progress.take() else {
        return Ok(());
    };
    manifest.storage_schema = migration.from;
    datadir.write_manifest(manifest)?;
    let journal = journal_path(datadir, migration.from);
    if journal.exists() {
        std::fs::remove_file(&journal)
            .map_err(|e| fsutil::io_error("remove migration journal", &journal, &e))?;
    }
    Ok(())
}
