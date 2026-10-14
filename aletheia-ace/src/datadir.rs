//! The node's data directory as ACE may touch it: read the manifest, test or hold the lock.
//!
//! `DATADIR` (binary, checksummed) is authoritative for the node; `DATADIR.txt` is the copy the
//! node writes after it "for people" (`crates/storage/src/datadir.rs`). ACE reads the text copy
//! for identity checks and never writes either. Its `last_finalized` is refreshed when the node
//! checkpoints (a clean stop), not on every block: after a crash it lags the real tip, which
//! is why checkpoints are only taken after a clean stop.
//!
//! Holding `LOCK` (the same advisory lock the node takes) guarantees no node starts on the
//! directory while ACE copies or replaces it.

use std::fs::{File, OpenOptions};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AceError, Result};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Manifest {
    pub chain_id: u32,
    pub genesis_id: String,
    pub network: String,
    pub storage_schema: u32,
    pub min_reader_schema: u32,
    pub last_writer_release: String,
    /// `None` until the node has checkpointed a finalized block.
    pub last_finalized: Option<Finalized>,
    pub migration_in_progress: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Finalized {
    pub height: u64,
    pub hash: String,
    pub state_root: String,
}

pub fn parse_manifest_text(text: &str) -> Result<Manifest> {
    let field = |name: &str| -> Result<String> {
        text.lines()
            .find_map(|l| {
                let (key, value) = l.split_once(char::is_whitespace)?;
                (key == name).then(|| value.trim().to_owned())
            })
            .ok_or_else(|| AceError::Snapshot(format!("DATADIR.txt has no {name}")))
    };
    let number = |name: &str| -> Result<u32> {
        field(name)?
            .parse()
            .map_err(|_| AceError::Snapshot(format!("DATADIR.txt {name} is not a number")))
    };
    let finalized = field("last_finalized")?;
    let last_finalized = if finalized == "none" {
        None
    } else {
        // "height 30 hash <64 hex> state_root <64 hex>"
        let words: Vec<&str> = finalized.split_whitespace().collect();
        match words.as_slice() {
            ["height", h, "hash", hash, "state_root", root] => Some(Finalized {
                height: h.parse().map_err(|_| {
                    AceError::Snapshot("DATADIR.txt height is not a number".to_owned())
                })?,
                hash: (*hash).to_owned(),
                state_root: (*root).to_owned(),
            }),
            _ => {
                return Err(AceError::Snapshot(format!(
                    "DATADIR.txt last_finalized is not understood: {finalized}"
                )));
            }
        }
    };
    Ok(Manifest {
        chain_id: number("chain_id")?,
        genesis_id: field("genesis_id")?,
        network: field("network_kind")?,
        storage_schema: number("storage_schema")?,
        min_reader_schema: number("min_reader_schema")?,
        last_writer_release: field("last_writer_release")?,
        last_finalized,
        migration_in_progress: field("migration_in_progress")? != "none",
    })
}

pub fn read_manifest(data_dir: &Path) -> Result<Manifest> {
    let path = data_dir.join("DATADIR.txt");
    let text = std::fs::read_to_string(&path).map_err(|e| AceError::io("read", &path, e))?;
    if !data_dir.join("DATADIR").is_file() {
        return Err(AceError::Snapshot(format!(
            "{} has DATADIR.txt but no authoritative DATADIR",
            data_dir.display()
        )));
    }
    parse_manifest_text(&text)
}

/// The node's advisory lock on a data directory, held by ACE.
#[derive(Debug)]
pub struct HeldLock {
    _file: File,
    pub path: PathBuf,
}

/// Takes the data directory's lock, failing if a node (or anything else) holds it.
pub fn lock(data_dir: &Path) -> Result<HeldLock> {
    let path = data_dir.join("LOCK");
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(&path)
        .map_err(|e| AceError::io("open", &path, e))?;
    match file.try_lock() {
        Ok(()) => Ok(HeldLock { _file: file, path }),
        Err(std::fs::TryLockError::WouldBlock) => Err(AceError::Busy(format!(
            "{} is held: a node is running on {}",
            path.display(),
            data_dir.display()
        ))),
        Err(std::fs::TryLockError::Error(e)) => Err(AceError::io("lock", &path, e)),
    }
}

/// Whether some process holds the data directory's lock. A directory without a lock file is
/// not in use.
pub fn in_use(data_dir: &Path) -> Result<bool> {
    if !data_dir.join("LOCK").exists() {
        return Ok(false);
    }
    match lock(data_dir) {
        Ok(_) => Ok(false),
        Err(AceError::Busy(_)) => Ok(true),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // As the node wrote it at the audited commit.
    const STOPPED: &str = "# Written by the node after DATADIR; never read. DATADIR is authoritative.\nchain_id             7771\ngenesis_id           9164487f5f211839f5796c6b2193e17d289a285d9eebce6bbc592f26a4c7719e\nnetwork_kind         devnet\nstorage_schema       1\nmin_reader_schema    1\nlast_writer_release  aletheiad 0.1.0\nlast_finalized       height 30 hash 48d7fbbeebfa708f0740d64ca956af1be795c59cae5dc2e80949246f5a9d4496 state_root cd0efd3931c4ef601a83e5736e93649b7f83dc2e3ad8fb9c692ddba1c16f8a4f\nmigration_in_progress none\n";

    #[test]
    fn the_node_s_text_manifest_is_read() {
        let m = parse_manifest_text(STOPPED).unwrap();
        assert_eq!(m.chain_id, 7771);
        assert_eq!(m.network, "devnet");
        assert_eq!(m.last_writer_release, "aletheiad 0.1.0");
        assert_eq!(m.last_finalized.as_ref().map(|f| f.height), Some(30));
        assert!(!m.migration_in_progress);
        let fresh = STOPPED.replace(
            "height 30 hash 48d7fbbeebfa708f0740d64ca956af1be795c59cae5dc2e80949246f5a9d4496 state_root cd0efd3931c4ef601a83e5736e93649b7f83dc2e3ad8fb9c692ddba1c16f8a4f",
            "none",
        );
        assert_eq!(parse_manifest_text(&fresh).unwrap().last_finalized, None);
    }

    #[test]
    fn a_held_lock_is_detected() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!in_use(dir.path()).unwrap());
        let held = lock(dir.path()).unwrap();
        assert!(in_use(dir.path()).unwrap());
        drop(held);
        assert!(!in_use(dir.path()).unwrap());
    }
}
