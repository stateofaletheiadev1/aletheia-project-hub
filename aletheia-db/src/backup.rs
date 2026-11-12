//! Online backups (ADR 0004). The server holds the data file's exclusive lock, so a backup is
//! made inside it: one read transaction (a consistent snapshot; writers keep going) is copied
//! into a fresh redb file, the copy is reopened and its content digest checked against the one
//! taken while copying, and only then is it renamed into place beside a JSON manifest. Old
//! backups beyond the configured count are deleted, oldest first; files that are not this
//! module's are never touched.
//!
//! The content digest is SHA-256 over every row of every table in key order, each table and
//! row length-prefixed, so it identifies the data independently of redb's page layout.
//! `aletheiadb verify-backup <file>` recomputes it offline.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{DbError, Result};
use crate::store::Store;
use crate::time;

/// File names are `aletheia-<UTC timestamp>.redb` with a `.json` manifest beside them.
const PREFIX: &str = "aletheia-";

/// Where and how often the server backs itself up (`ALETHEIADB_BACKUP_*`).
#[derive(Debug)]
pub struct Schedule {
    pub dir: PathBuf,
    pub every: std::time::Duration,
    pub keep: usize,
    /// One backup at a time, scheduled or requested.
    pub running: tokio::sync::Mutex<()>,
}

impl Schedule {
    /// Runs one backup now, unless one is already running.
    pub async fn run_now(&self, store: std::sync::Arc<Store>) -> Result<Manifest> {
        let Ok(_guard) = self.running.try_lock() else {
            return Err(DbError::Conflict("a backup is already running".into()));
        };
        let (dir, keep) = (self.dir.clone(), self.keep);
        tokio::task::spawn_blocking(move || run(&store, &dir, keep))
            .await
            .map_err(|e| internal("backup task", e))?
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub format: u32,
    pub engine_version: String,
    pub created: String,
    pub file: String,
    pub bytes: u64,
    /// Rows per table, by table name.
    pub rows: Vec<(String, u64)>,
    /// Hex SHA-256 of the content, as [`Store::content_digest`] computes it.
    pub content_sha256: String,
}

fn internal(context: &str, error: impl std::fmt::Display) -> DbError {
    DbError::Internal(format!("{context}: {error}"))
}

/// `2026-11-12T07:05:09.123Z` -> `20261112T070509123Z`, sortable and safe in file names.
fn stamp(rfc3339: &str) -> String {
    let digits: String = rfc3339.chars().take(23).filter(|c| c.is_ascii_digit() || *c == 'T').collect();
    format!("{digits}Z")
}

/// Makes a verified backup of `store` in `dir` and keeps the newest `keep` of them.
pub fn run(store: &Store, dir: &Path, keep: usize) -> Result<Manifest> {
    fs::create_dir_all(dir).map_err(|e| internal("create backup directory", e))?;
    let created = time::now_rfc3339();
    let name = format!("{PREFIX}{}.redb", stamp(&created));
    let final_path = dir.join(&name);
    let partial = dir.join(format!(".{name}.partial"));
    let _ = fs::remove_file(&partial);

    let copied = store.copy_to(&partial);
    let outcome = copied.and_then(|(rows, digest)| {
        // Reopen what was written and check it holds exactly what was read.
        let (check_rows, check_digest) = Store::digest_file(&partial)?;
        if check_digest != digest || check_rows != rows {
            return Err(DbError::Internal("backup copy does not match the snapshot it was made from".into()));
        }
        Ok((rows, digest))
    });
    let (rows, digest) = match outcome {
        Ok(v) => v,
        Err(e) => {
            let _ = fs::remove_file(&partial);
            return Err(e);
        }
    };
    let bytes = fs::metadata(&partial).map_err(|e| internal("stat backup", e))?.len();
    fs::rename(&partial, &final_path).map_err(|e| internal("move backup into place", e))?;

    let manifest = Manifest {
        format: 1,
        engine_version: crate::api::VERSION.to_string(),
        created,
        file: name.clone(),
        bytes,
        rows,
        content_sha256: digest,
    };
    let json = serde_json::to_vec_pretty(&manifest).map_err(|e| internal("encode manifest", e))?;
    fs::write(dir.join(name.replace(".redb", ".json")), json).map_err(|e| internal("write manifest", e))?;
    prune(dir, keep)?;
    Ok(manifest)
}

/// This module's backups in `dir`, oldest first.
pub fn list(dir: &Path) -> Result<Vec<Manifest>> {
    let mut out = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(out),
        Err(e) => return Err(internal("read backup directory", e)),
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with(PREFIX) && name.ends_with(".json") {
            let text = fs::read(entry.path()).map_err(|e| internal("read manifest", e))?;
            if let Ok(manifest) = serde_json::from_slice::<Manifest>(&text) {
                out.push(manifest);
            }
        }
    }
    out.sort_by(|a, b| a.file.cmp(&b.file));
    Ok(out)
}

fn prune(dir: &Path, keep: usize) -> Result<()> {
    let all = list(dir)?;
    let excess = all.len().saturating_sub(keep.max(1));
    for old in all.iter().take(excess) {
        let data = dir.join(&old.file);
        fs::remove_file(&data).map_err(|e| internal("delete old backup", e))?;
        let _ = fs::remove_file(dir.join(old.file.replace(".redb", ".json")));
    }
    Ok(())
}

/// Checks a backup file against the manifest beside it: the content digest and row counts.
pub fn verify(file: &Path) -> Result<Manifest> {
    let manifest_path: PathBuf = file.with_extension("json");
    let text = fs::read(&manifest_path).map_err(|e| internal("read manifest", e))?;
    let manifest: Manifest = serde_json::from_slice(&text).map_err(|e| internal("decode manifest", e))?;
    let (rows, digest) = Store::digest_file(file)?;
    if digest != manifest.content_sha256 || rows != manifest.rows {
        return Err(DbError::Invalid(format!(
            "{} does not match its manifest: the backup is damaged or was changed",
            file.display()
        )));
    }
    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stamps_sort_and_fit_in_file_names() {
        assert_eq!(stamp("2026-11-12T07:05:09.123Z"), "20261112T070509123Z");
        assert!(stamp("2026-11-12T07:05:09.123Z") < stamp("2026-11-12T07:05:09.124Z"));
        assert!(stamp("2026-11-12T07:05:09.999Z") < stamp("2026-11-12T07:05:10.000Z"));
    }
}
