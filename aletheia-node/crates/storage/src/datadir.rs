//! The data directory and its manifest (spec Section 44.5, APS-0055, ADR-030).
//!
//! ```text
//! <root>/DATADIR       ACE manifest, magic "ALDATA\0\1", crc32c (authoritative)
//! <root>/DATADIR.txt   human-readable copy, written after DATADIR, never read by the node
//! <root>/LOCK          exclusive lock held for the process lifetime
//! <root>/wal/ state/ chain/ blocks/ snapshots/ migrations/
//! ```
//!
//! [`decide`] is the startup decision table. It never "fixes up" a directory that belongs to
//! another chain, and never opens one written by a release it cannot read.

use std::fs::File;
use std::path::{Path, PathBuf};

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ChainId, ErrorCode, Hash32, Height,
    NetworkIdentity, NetworkKind,
};

use crate::fsutil;

/// Storage schema this binary writes. Bump only with a migration step (Section 44.5).
pub const BINARY_STORAGE_SCHEMA: u32 = 1;
/// Oldest schema whose readers can open what this binary writes.
pub const MIN_READER_SCHEMA: u32 = 1;

const MANIFEST_MAGIC: &[u8; 8] = b"ALDATA\0\x01";
const MANIFEST_FILE: &str = "DATADIR";
const MANIFEST_TEXT_FILE: &str = "DATADIR.txt";
const LOCK_FILE: &str = "LOCK";
const MAX_RELEASE_BYTES: u32 = 32;
const MAX_PATH_BYTES: u32 = 255;

pub const SUBDIRECTORIES: [&str; 6] =
    ["wal", "state", "chain", "blocks", "snapshots", "migrations"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LastFinalized {
    pub height: Height,
    pub hash: Hash32,
    pub state_root: Hash32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MigrationInProgress {
    pub from: u32,
    pub to: u32,
    /// Index of the step within the migration; equals `from` for single steps.
    pub step: u32,
    /// Relative to the data directory root.
    pub checkpoint_dir: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DataDirManifest {
    pub chain_id: ChainId,
    pub genesis_id: Hash32,
    pub network_kind: NetworkKind,
    pub storage_schema: u32,
    pub min_reader_schema: u32,
    /// e.g. "aletheiad 0.1.0"; at most 32 bytes.
    pub last_writer_release: String,
    pub last_finalized: Option<LastFinalized>,
    pub migration_in_progress: Option<MigrationInProgress>,
}

impl DataDirManifest {
    /// Manifest for a new directory on `network`, written by this binary.
    pub fn new(network: &NetworkIdentity, release: &str) -> DataDirManifest {
        DataDirManifest {
            chain_id: network.chain_id(),
            genesis_id: network.genesis_id(),
            network_kind: network.network_kind(),
            storage_schema: BINARY_STORAGE_SCHEMA,
            min_reader_schema: MIN_READER_SCHEMA,
            last_writer_release: release.to_owned(),
            last_finalized: None,
            migration_in_progress: None,
        }
    }

    fn to_text(&self) -> String {
        let finalized = self.last_finalized.map_or_else(
            || "none".to_owned(),
            |f| {
                format!(
                    "height {} hash {} state_root {}",
                    f.height, f.hash, f.state_root
                )
            },
        );
        let migration = self.migration_in_progress.as_ref().map_or_else(
            || "none".to_owned(),
            |m| {
                format!(
                    "schema {} -> {} at step {} (checkpoint {})",
                    m.from, m.to, m.step, m.checkpoint_dir
                )
            },
        );
        format!(
            "# Written by the node after DATADIR; never read. DATADIR is authoritative.\n\
             chain_id             {}\ngenesis_id           {}\nnetwork_kind         {}\n\
             storage_schema       {}\nmin_reader_schema    {}\nlast_writer_release  {}\n\
             last_finalized       {finalized}\nmigration_in_progress {migration}\n",
            self.chain_id,
            self.genesis_id,
            self.network_kind,
            self.storage_schema,
            self.min_reader_schema,
            self.last_writer_release,
        )
    }
}

fn bounded_text(input: &mut AceReader<'_>, max: u32, what: &str) -> Result<String, AletheiaError> {
    let bytes = input.bytes(max)?;
    String::from_utf8(bytes.to_vec()).map_err(|_| {
        AletheiaError::new(
            ErrorCode::DecodeNonCanonical,
            format!("{what} is not UTF-8"),
        )
    })
}

impl AceEncode for LastFinalized {
    fn encode(&self, out: &mut AceWriter) {
        self.height.encode(out);
        self.hash.encode(out);
        self.state_root.encode(out);
    }
}

impl AceDecode for LastFinalized {
    fn decode(input: &mut AceReader<'_>) -> Result<LastFinalized, AletheiaError> {
        Ok(LastFinalized {
            height: Height::decode(input)?,
            hash: Hash32::decode(input)?,
            state_root: Hash32::decode(input)?,
        })
    }
}

impl AceEncode for MigrationInProgress {
    fn encode(&self, out: &mut AceWriter) {
        out.u32(self.from);
        out.u32(self.to);
        out.u32(self.step);
        out.bytes(self.checkpoint_dir.as_bytes());
    }
}

impl AceDecode for MigrationInProgress {
    fn decode(input: &mut AceReader<'_>) -> Result<MigrationInProgress, AletheiaError> {
        Ok(MigrationInProgress {
            from: input.u32()?,
            to: input.u32()?,
            step: input.u32()?,
            checkpoint_dir: bounded_text(input, MAX_PATH_BYTES, "checkpoint_dir")?,
        })
    }
}

impl AceEncode for DataDirManifest {
    fn encode(&self, out: &mut AceWriter) {
        self.chain_id.encode(out);
        self.genesis_id.encode(out);
        self.network_kind.encode(out);
        out.u32(self.storage_schema);
        out.u32(self.min_reader_schema);
        out.bytes(self.last_writer_release.as_bytes());
        out.option(self.last_finalized.as_ref());
        out.option(self.migration_in_progress.as_ref());
    }
}

impl AceDecode for DataDirManifest {
    fn decode(input: &mut AceReader<'_>) -> Result<DataDirManifest, AletheiaError> {
        Ok(DataDirManifest {
            chain_id: ChainId::decode(input)?,
            genesis_id: Hash32::decode(input)?,
            network_kind: NetworkKind::decode(input)?,
            storage_schema: input.u32()?,
            min_reader_schema: input.u32()?,
            last_writer_release: bounded_text(input, MAX_RELEASE_BYTES, "last_writer_release")?,
            last_finalized: input.option()?,
            migration_in_progress: input.option()?,
        })
    }
}

/// What startup must do with an existing directory (Section 44.5 decision table).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StartupAction {
    /// Same schema: normal crash recovery (Section 24.3).
    Recover,
    /// Older schema: run migration steps `from → … → to`, each on a checkpoint.
    Migrate { from: u32, to: u32 },
    /// Newer schema that declared this binary a safe reader.
    OpenNewer { schema: u32 },
    /// An interrupted migration: resume from its journal or roll back to its checkpoint.
    ResumeMigration(MigrationInProgress),
}

pub fn decide(
    manifest: &DataDirManifest,
    expected: &NetworkIdentity,
    binary_schema: u32,
) -> Result<StartupAction, AletheiaError> {
    if manifest.chain_id != expected.chain_id()
        || manifest.genesis_id != expected.genesis_id()
        || manifest.network_kind != expected.network_kind()
    {
        return Err(AletheiaError::new(
            ErrorCode::StoDataDirWrongChain,
            format!(
                "data directory is for chain {} ({}, genesis {}); this node is configured for chain {} ({}, genesis {})",
                manifest.chain_id,
                manifest.network_kind,
                manifest.genesis_id,
                expected.chain_id(),
                expected.network_kind(),
                expected.genesis_id(),
            ),
        ));
    }
    if let Some(migration) = &manifest.migration_in_progress {
        return Ok(StartupAction::ResumeMigration(migration.clone()));
    }
    let schema = manifest.storage_schema;
    if schema == binary_schema {
        Ok(StartupAction::Recover)
    } else if schema < binary_schema {
        Ok(StartupAction::Migrate {
            from: schema,
            to: binary_schema,
        })
    } else if manifest.min_reader_schema <= binary_schema {
        Ok(StartupAction::OpenNewer { schema })
    } else {
        Err(AletheiaError::new(
            ErrorCode::StoDataDirTooNew,
            format!(
                "data directory written by {} (schema {schema}); this binary reads schema <= {binary_schema}",
                manifest.last_writer_release
            ),
        ))
    }
}

/// An open, exclusively locked data directory.
#[derive(Debug)]
pub struct DataDir {
    root: PathBuf,
    manifest: DataDirManifest,
    _lock: File,
}

impl DataDir {
    /// Creates a new directory. Refuses if a manifest already exists: an existing chain is
    /// never re-initialized.
    pub fn create(root: &Path, manifest: DataDirManifest) -> Result<DataDir, AletheiaError> {
        fsutil::create_dir_all(root)?;
        let lock = fsutil::lock_exclusive(&root.join(LOCK_FILE))?;
        if root.join(MANIFEST_FILE).exists() {
            return Err(AletheiaError::new(
                ErrorCode::StoIo,
                format!(
                    "{} already holds a data directory; refusing to re-initialize it",
                    root.display()
                ),
            ));
        }
        for sub in SUBDIRECTORIES {
            fsutil::create_dir_all(&root.join(sub))?;
        }
        let mut dir = DataDir {
            root: root.to_path_buf(),
            manifest: manifest.clone(),
            _lock: lock,
        };
        dir.write_manifest(manifest)?;
        Ok(dir)
    }

    /// Locks and reads an existing directory. The caller then applies [`decide`].
    pub fn open(root: &Path) -> Result<DataDir, AletheiaError> {
        if !root.join(MANIFEST_FILE).exists() {
            return Err(AletheiaError::new(
                ErrorCode::StoDataDirMissing,
                format!(
                    "{} has no DATADIR manifest; initialize it from genesis first",
                    root.display()
                ),
            ));
        }
        let lock = fsutil::lock_exclusive(&root.join(LOCK_FILE))?;
        let bytes = fsutil::read_checksummed(&root.join(MANIFEST_FILE), MANIFEST_MAGIC)?;
        let manifest = DataDirManifest::from_ace_bytes(&bytes).map_err(|error| {
            AletheiaError::new(
                ErrorCode::StoCorrupt,
                format!("{}/DATADIR: {}", root.display(), error.detail()),
            )
        })?;
        Ok(DataDir {
            root: root.to_path_buf(),
            manifest,
            _lock: lock,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn path(&self, sub: &str) -> PathBuf {
        self.root.join(sub)
    }

    pub fn manifest(&self) -> &DataDirManifest {
        &self.manifest
    }

    /// Replaces the manifest atomically, then refreshes the text copy.
    pub fn write_manifest(&mut self, manifest: DataDirManifest) -> Result<(), AletheiaError> {
        if manifest.last_writer_release.len() > 32 {
            return Err(AletheiaError::new(
                ErrorCode::StoIo,
                format!(
                    "release name \"{}\" exceeds 32 bytes",
                    manifest.last_writer_release
                ),
            ));
        }
        fsutil::write_checksummed_atomically(
            &self.root.join(MANIFEST_FILE),
            MANIFEST_MAGIC,
            &manifest.to_ace_bytes(),
        )?;
        fsutil::write_atomically(
            &self.root.join(MANIFEST_TEXT_FILE),
            manifest.to_text().as_bytes(),
        )?;
        self.manifest = manifest;
        Ok(())
    }
}
