//! Recovery checkpoints of the node's data directory.
//!
//! StableChain at the audited commit has no snapshot export or import an operator can run:
//! `crates/state/src/snapshot.rs` writes and restores state chunks as a library, but neither
//! `aletheiad` nor `aletheia-cli` exposes it, and a state snapshot alone lacks the block
//! archive, WAL and consensus safety data a node resumes from. The supported procedure is the
//! one `docs/operations/vps.md` section 5 gives for moving a node: stop it, copy the data
//! directory whole, start it elsewhere. A checkpoint is exactly that copy, made safe:
//!
//! - taken only while ACE holds the node's own `LOCK`, so no node runs on the directory while
//!   it is read and none can start until the copy is complete;
//! - recorded with the chain identity from `DATADIR.txt`, the source commit and daemon hash,
//!   and the SHA-256 of every file and of the archive;
//! - validated entry by entry before restoring: regular files and directories only, relative
//!   paths under `data/`, sizes and hashes as recorded, no extra or missing files;
//! - restored only into an empty or absent data directory, through a staging directory on the
//!   same filesystem and one rename, so a failed restore never looks like a data directory and
//!   a working directory is never overwritten.
//!
//! A checksum proves the bytes are the ones recorded, not that the chain they hold is true.
//! The node re-verifies its WAL, its archived tip and its state root when it starts on a
//! restored directory (recovery.md), and `ace verify-restore` compares the restored node's
//! state root at the checkpoint height with the one recorded. Who produced a checkpoint is
//! recorded (`origin`), not proven: there is no signature yet (docs/SECURITY.md).

use std::collections::BTreeMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::builder::{now_unix, rfc3339, sha256_file, write_atomically};
use crate::datadir::{self, Manifest};
use crate::error::{AceError, Result};
use crate::host;
use crate::oplog::{self, Category};

pub const FORMAT: &str = "ace-checkpoint";
pub const FORMAT_VERSION: u32 = 1;
const ROOT: &str = "data";
const MIB: u64 = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileRecord {
    pub path: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Origin {
    pub host_kind: String,
    pub github_repository: Option<String>,
    pub github_run_id: Option<String>,
    pub github_sha: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointManifest {
    pub format: String,
    pub format_version: u32,
    pub created_at: String,
    pub ace_version: String,
    pub source_commit: String,
    pub aletheiad_sha256: String,
    pub identity: Manifest,
    /// The node stopped with exit 0 at exactly the height `identity.last_finalized` records.
    /// When false the copy is crash-consistent: the node recovers from it at start-up, and the
    /// recorded height is a lower bound.
    pub clean_stop: bool,
    pub archive_file: String,
    pub archive_sha256: String,
    pub archive_bytes: u64,
    pub unpacked_bytes: u64,
    pub files: Vec<FileRecord>,
    pub directories: Vec<String>,
    pub origin: Origin,
}

/// What a checkpoint must match to be used here.
#[derive(Debug, Clone)]
pub struct Expectations {
    pub network: String,
    pub chain_id: u32,
    pub genesis_id: Option<String>,
    /// The storage schema the node binary writes (from the pinned source), if known.
    pub binary_storage_schema: Option<u32>,
    pub max_bytes: u64,
}

/// `BINARY_STORAGE_SCHEMA` and `MIN_READER_SCHEMA` declared by the pinned source
/// (`crates/storage/src/datadir.rs`), or `None` if the checkout is not present.
pub fn source_storage_schema(workspace: &Path) -> Option<u32> {
    let text = std::fs::read_to_string(workspace.join("crates/storage/src/datadir.rs")).ok()?;
    text.lines()
        .find_map(|l| {
            l.trim()
                .strip_prefix("pub const BINARY_STORAGE_SCHEMA: u32 = ")
        })
        .and_then(|v| v.trim_end_matches(';').trim().parse().ok())
}

fn walk(root: &Path, dir: &Path, files: &mut Vec<PathBuf>, dirs: &mut Vec<PathBuf>) -> Result<()> {
    let mut entries: Vec<_> = std::fs::read_dir(dir)
        .map_err(|e| AceError::io("list", dir, e))?
        .collect::<std::result::Result<_, _>>()
        .map_err(|e| AceError::io("list", dir, e))?;
    entries.sort_by_key(std::fs::DirEntry::file_name);
    for entry in entries {
        let path = entry.path();
        let kind = entry
            .file_type()
            .map_err(|e| AceError::io("stat", &path, e))?;
        let relative = path
            .strip_prefix(root)
            .map(Path::to_path_buf)
            .unwrap_or_default();
        if kind.is_symlink() {
            return Err(AceError::Snapshot(format!(
                "{} is a symbolic link; a data directory holds none, refusing to copy it",
                path.display()
            )));
        } else if kind.is_dir() {
            dirs.push(relative);
            walk(root, &path, files, dirs)?;
        } else if kind.is_file() {
            // The lock file is the node's, held by ACE right now; it is recreated at start.
            if relative != Path::new("LOCK") {
                files.push(relative);
            }
        } else {
            return Err(AceError::Snapshot(format!(
                "{} is not a regular file",
                path.display()
            )));
        }
    }
    Ok(())
}

fn text_path(path: &Path) -> Result<String> {
    path.to_str()
        .map(|s| s.replace('\\', "/"))
        .ok_or_else(|| AceError::Snapshot(format!("{} is not UTF-8", path.display())))
}

fn header(kind: tar::EntryType, size: u64, mode: u32) -> tar::Header {
    let mut header = tar::Header::new_gnu();
    header.set_entry_type(kind);
    header.set_size(size);
    header.set_mode(mode);
    header.set_mtime(0);
    header.set_uid(0);
    header.set_gid(0);
    header
}

fn origin() -> Origin {
    Origin {
        host_kind: format!("{:?}", host::compute_kind()),
        github_repository: std::env::var("GITHUB_REPOSITORY").ok(),
        github_run_id: std::env::var("GITHUB_RUN_ID").ok(),
        github_sha: std::env::var("GITHUB_SHA").ok(),
    }
}

pub struct CreateInput<'a> {
    pub data_dir: &'a Path,
    pub out_dir: &'a Path,
    pub source_commit: &'a str,
    pub aletheiad_sha256: &'a str,
    /// Height of the node's last clean stop as ACE recorded it, if any.
    pub last_clean_stop: Option<u64>,
    pub max_bytes: u64,
}

/// Creates a checkpoint of a stopped node's data directory. Returns the manifest path.
pub fn create(input: &CreateInput<'_>) -> Result<PathBuf> {
    let data_dir = input.data_dir;
    if !data_dir.join("DATADIR").is_file() {
        return Err(AceError::Snapshot(format!(
            "{} holds no initialized data directory",
            data_dir.display()
        )));
    }
    let _lock = datadir::lock(data_dir).map_err(|e| match e {
        AceError::Busy(m) => AceError::Snapshot(format!(
            "{m}; stop the node first (ace stop), a running database is never copied"
        )),
        other => other,
    })?;
    let identity = datadir::read_manifest(data_dir)?;
    if identity.migration_in_progress {
        return Err(AceError::Snapshot(
            "a storage migration is in progress; let the node finish it before taking a checkpoint"
                .to_owned(),
        ));
    }
    let mut files = Vec::new();
    let mut dirs = Vec::new();
    walk(data_dir, data_dir, &mut files, &mut dirs)?;
    let unpacked: u64 = files
        .iter()
        .map(|f| {
            std::fs::metadata(data_dir.join(f))
                .map(|m| m.len())
                .unwrap_or(0)
        })
        .sum();
    if unpacked > input.max_bytes {
        return Err(AceError::Snapshot(format!(
            "the data directory holds {} MiB, above [limits] max_snapshot_mb = {} MiB",
            unpacked / MIB,
            input.max_bytes / MIB
        )));
    }
    std::fs::create_dir_all(input.out_dir).map_err(|e| AceError::io("create", input.out_dir, e))?;
    let free = host::disk(input.out_dir).map(|d| d.free_bytes).unwrap_or(0);
    if free < unpacked.saturating_mul(2) {
        return Err(AceError::Snapshot(format!(
            "{} MiB free at {}, need about {} MiB",
            free / MIB,
            input.out_dir.display(),
            unpacked.saturating_mul(2) / MIB
        )));
    }
    let height = identity.last_finalized.as_ref().map_or(0, |f| f.height);
    let now = now_unix();
    let stamp = rfc3339(now).replace([':', '-'], "");
    let name = format!(
        "checkpoint-{}-{}-h{height}-{stamp}",
        identity.network, identity.chain_id
    );
    let archive_path = input.out_dir.join(format!("{name}.tar.gz"));
    let temp = input.out_dir.join(format!(".{name}.tar.gz.partial"));

    let mut records = Vec::with_capacity(files.len());
    {
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            // Chain data, like the node's own files (its unit runs with UMask=0077).
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = options
            .open(&temp)
            .map_err(|e| AceError::io("create", &temp, e))?;
        let encoder = flate2::write::GzEncoder::new(file, flate2::Compression::default());
        let mut builder = tar::Builder::new(encoder);
        for dir in &dirs {
            let name = format!("{ROOT}/{}/", text_path(dir)?);
            let mut h = header(tar::EntryType::Directory, 0, 0o700);
            builder
                .append_data(&mut h, &name, std::io::empty())
                .map_err(|e| AceError::io("archive", &temp, e))?;
        }
        for relative in &files {
            let path = data_dir.join(relative);
            let (sha256, size) = sha256_file(&path)?;
            let reader = File::open(&path).map_err(|e| AceError::io("open", &path, e))?;
            let mut h = header(tar::EntryType::Regular, size, 0o600);
            let name = format!("{ROOT}/{}", text_path(relative)?);
            // The size in the header was taken from the same hashing pass; a file that changed
            // since (impossible while the lock is held) makes the append fail.
            builder
                .append_data(&mut h, &name, reader.take(size))
                .map_err(|e| AceError::io("archive", &path, e))?;
            records.push(FileRecord {
                path: text_path(relative)?,
                sha256,
                size,
            });
        }
        let encoder = builder
            .into_inner()
            .map_err(|e| AceError::io("finish", &temp, e))?;
        let file = encoder
            .finish()
            .map_err(|e| AceError::io("finish", &temp, e))?;
        file.sync_all()
            .map_err(|e| AceError::io("sync", &temp, e))?;
    }
    // Re-hash after the copy: the lock guarantees nothing changed, and this proves it.
    for record in &records {
        let (sha256, _) = sha256_file(&data_dir.join(&record.path))?;
        if sha256 != record.sha256 {
            let _ = std::fs::remove_file(&temp);
            return Err(AceError::Snapshot(format!(
                "{} changed while it was copied",
                record.path
            )));
        }
    }
    std::fs::rename(&temp, &archive_path).map_err(|e| AceError::io("rename", &archive_path, e))?;
    let (archive_sha256, archive_bytes) = sha256_file(&archive_path)?;
    let clean_stop = matches!((input.last_clean_stop, &identity.last_finalized), (Some(h), Some(f)) if h == f.height);
    let manifest = CheckpointManifest {
        format: FORMAT.to_owned(),
        format_version: FORMAT_VERSION,
        created_at: rfc3339(now),
        ace_version: env!("CARGO_PKG_VERSION").to_owned(),
        source_commit: input.source_commit.to_owned(),
        aletheiad_sha256: input.aletheiad_sha256.to_owned(),
        identity,
        clean_stop,
        archive_file: format!("{name}.tar.gz"),
        archive_sha256,
        archive_bytes,
        unpacked_bytes: unpacked,
        files: records,
        directories: dirs.iter().map(|d| text_path(d)).collect::<Result<_>>()?,
        origin: origin(),
    };
    let manifest_path = input.out_dir.join(format!("{name}.json"));
    let json = serde_json::to_vec_pretty(&manifest).map_err(|e| AceError::Other(e.to_string()))?;
    write_atomically(&manifest_path, &json)?;
    oplog::info(
        Category::Snapshot,
        &format!(
            "checkpoint {} height={height} clean_stop={clean_stop} files={} unpacked={} archive={} sha256={}",
            manifest_path.display(),
            manifest.files.len(),
            unpacked,
            archive_bytes,
            manifest.archive_sha256
        ),
    );
    Ok(manifest_path)
}

pub fn load(manifest_path: &Path) -> Result<CheckpointManifest> {
    let text = std::fs::read_to_string(manifest_path)
        .map_err(|e| AceError::io("read", manifest_path, e))?;
    let manifest: CheckpointManifest = serde_json::from_str(&text)
        .map_err(|e| AceError::Snapshot(format!("{}: {e}", manifest_path.display())))?;
    if manifest.format != FORMAT || manifest.format_version != FORMAT_VERSION {
        return Err(AceError::Snapshot(format!(
            "{} is format {} version {}; this ACE reads {FORMAT} version {FORMAT_VERSION}",
            manifest_path.display(),
            manifest.format,
            manifest.format_version
        )));
    }
    Ok(manifest)
}

/// Checks the manifest against the deployment (no archive access).
pub fn check_identity(manifest: &CheckpointManifest, expect: &Expectations) -> Result<()> {
    let id = &manifest.identity;
    if id.network != expect.network || id.chain_id != expect.chain_id {
        return Err(AceError::Snapshot(format!(
            "checkpoint is chain {} on {}; the deployment runs chain {} on {}",
            id.chain_id, id.network, expect.chain_id, expect.network
        )));
    }
    match &expect.genesis_id {
        Some(g) if *g != id.genesis_id => {
            return Err(AceError::Snapshot(format!(
                "checkpoint holds genesis {}; the deployment pins {g}",
                id.genesis_id
            )));
        }
        Some(_) => {}
        None => oplog::warn(
            Category::Snapshot,
            &format!(
                "no expected_genesis_id is pinned; the checkpoint's genesis {} is accepted on chain id alone, which does not identify a devnet (devnet.toml and devnet-explorer.toml share chain 7771)",
                id.genesis_id
            ),
        ),
    }
    if let Some(schema) = expect.binary_storage_schema
        && id.storage_schema > schema
        && id.min_reader_schema > schema
    {
        return Err(AceError::Snapshot(format!(
            "checkpoint storage schema {} needs a reader of schema {} or newer; this node binary is schema {schema}",
            id.storage_schema, id.min_reader_schema
        )));
    }
    if id.migration_in_progress {
        return Err(AceError::Snapshot(
            "checkpoint was taken during a storage migration".to_owned(),
        ));
    }
    if manifest.unpacked_bytes > expect.max_bytes {
        return Err(AceError::Snapshot(format!(
            "checkpoint unpacks to {} MiB, above [limits] max_snapshot_mb",
            manifest.unpacked_bytes / MIB
        )));
    }
    Ok(())
}

/// A relative path under `data/`, with only normal components. Returns the part after it.
fn safe_entry_path(path: &Path) -> Result<PathBuf> {
    let mut components = path.components();
    match components.next() {
        Some(Component::Normal(first)) if first == ROOT => {}
        _ => {
            return Err(AceError::Snapshot(format!(
                "archive entry {} is outside {ROOT}/",
                path.display()
            )));
        }
    }
    let rest: PathBuf = components.clone().collect();
    if components.any(|c| !matches!(c, Component::Normal(_))) {
        return Err(AceError::Snapshot(format!(
            "archive entry {} escapes the data directory",
            path.display()
        )));
    }
    Ok(rest)
}

struct HashingWriter<W: Write> {
    inner: W,
    hasher: sha2::Sha256,
    written: u64,
}

impl<W: Write> Write for HashingWriter<W> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        use sha2::Digest;
        let n = self.inner.write(buf)?;
        self.hasher.update(buf.get(..n).unwrap_or_default());
        self.written = self.written.saturating_add(u64::try_from(n).unwrap_or(0));
        Ok(n)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

/// Reads the whole archive, checking every entry; with `extract_to`, writes the files there.
fn read_archive(
    manifest: &CheckpointManifest,
    archive: &Path,
    extract_to: Option<&Path>,
) -> Result<()> {
    use sha2::Digest;
    let expected: BTreeMap<&str, &FileRecord> = manifest
        .files
        .iter()
        .map(|f| (f.path.as_str(), f))
        .collect();
    let mut seen = BTreeMap::new();
    let file = File::open(archive).map_err(|e| AceError::io("open", archive, e))?;
    let mut tar = tar::Archive::new(flate2::read::GzDecoder::new(file));
    let entries = tar
        .entries()
        .map_err(|e| AceError::Snapshot(format!("{}: {e}", archive.display())))?;
    for entry in entries {
        let mut entry = entry.map_err(|e| {
            AceError::Snapshot(format!("{}: damaged archive: {e}", archive.display()))
        })?;
        let path = entry
            .path()
            .map_err(|e| AceError::Snapshot(format!("archive entry name: {e}")))?
            .into_owned();
        let relative = safe_entry_path(&path)?;
        let kind = entry.header().entry_type();
        match kind {
            tar::EntryType::Directory => {
                if let Some(root) = extract_to {
                    let dir = root.join(&relative);
                    std::fs::create_dir_all(&dir).map_err(|e| AceError::io("create", &dir, e))?;
                }
            }
            tar::EntryType::Regular => {
                let key = text_path(&relative)?;
                let record = expected.get(key.as_str()).ok_or_else(|| {
                    AceError::Snapshot(format!(
                        "archive holds {key}, which the manifest does not list"
                    ))
                })?;
                if entry.size() != record.size {
                    return Err(AceError::Snapshot(format!(
                        "{key}: archive size {} differs from manifest {}",
                        entry.size(),
                        record.size
                    )));
                }
                let mut sink: Box<dyn Write> = match extract_to {
                    Some(root) => {
                        let target = root.join(&relative);
                        if let Some(parent) = target.parent() {
                            std::fs::create_dir_all(parent)
                                .map_err(|e| AceError::io("create", parent, e))?;
                        }
                        let mut options = std::fs::OpenOptions::new();
                        options.write(true).create_new(true);
                        #[cfg(unix)]
                        {
                            use std::os::unix::fs::OpenOptionsExt;
                            options.mode(0o600);
                        }
                        Box::new(
                            options
                                .open(&target)
                                .map_err(|e| AceError::io("create", &target, e))?,
                        )
                    }
                    None => Box::new(std::io::sink()),
                };
                let mut writer = HashingWriter {
                    inner: &mut sink,
                    hasher: sha2::Sha256::new(),
                    written: 0,
                };
                std::io::copy(&mut entry, &mut writer)
                    .map_err(|e| AceError::Snapshot(format!("{key}: {e}")))?;
                writer
                    .flush()
                    .map_err(|e| AceError::Snapshot(format!("{key}: {e}")))?;
                let digest: String = writer
                    .hasher
                    .finalize()
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect();
                if digest != record.sha256 || writer.written != record.size {
                    return Err(AceError::Snapshot(format!(
                        "{key}: content does not match its recorded sha256"
                    )));
                }
                seen.insert(key, ());
            }
            other => {
                return Err(AceError::Snapshot(format!(
                    "archive entry {} is a {other:?}; only files and directories are accepted",
                    path.display()
                )));
            }
        }
    }
    if let Some(missing) = expected.keys().find(|k| !seen.contains_key(**k)) {
        return Err(AceError::Snapshot(format!(
            "archive lacks {missing}, which the manifest lists"
        )));
    }
    Ok(())
}

/// Validates a checkpoint completely: identity, archive hash, every entry.
pub fn validate(manifest_path: &Path, expect: &Expectations) -> Result<CheckpointManifest> {
    let manifest = load(manifest_path)?;
    check_identity(&manifest, expect)?;
    let dir = manifest_path.parent().unwrap_or(Path::new("."));
    if manifest.archive_file.contains('/') || manifest.archive_file.contains("..") {
        return Err(AceError::Snapshot(
            "archive_file must be a plain file name".to_owned(),
        ));
    }
    let archive = dir.join(&manifest.archive_file);
    let (sha256, size) = sha256_file(&archive)?;
    if sha256 != manifest.archive_sha256 || size != manifest.archive_bytes {
        return Err(AceError::Snapshot(format!(
            "{} has sha256 {sha256} ({size} bytes); the manifest records {} ({} bytes)",
            archive.display(),
            manifest.archive_sha256,
            manifest.archive_bytes
        )));
    }
    read_archive(&manifest, &archive, None)?;
    oplog::info(
        Category::Snapshot,
        &format!(
            "checkpoint {} valid: chain {} {} genesis {} height {} ({} files)",
            manifest_path.display(),
            manifest.identity.chain_id,
            manifest.identity.network,
            manifest.identity.genesis_id,
            manifest
                .identity
                .last_finalized
                .as_ref()
                .map_or(0, |f| f.height),
            manifest.files.len()
        ),
    );
    Ok(manifest)
}

#[derive(Debug, Clone, Serialize)]
pub struct RestoreReport {
    pub checkpoint: PathBuf,
    pub data_dir: PathBuf,
    pub height: u64,
    pub state_root: Option<String>,
    pub genesis_id: String,
    pub files: usize,
    pub restored_at: String,
}

/// Leftover staging directories of an interrupted restore, next to `data_dir`.
pub fn interrupted_restores(data_dir: &Path) -> Vec<PathBuf> {
    let (Some(parent), Some(name)) = (data_dir.parent(), data_dir.file_name()) else {
        return Vec::new();
    };
    let prefix = format!(".{}.ace-restore-", name.to_string_lossy());
    std::fs::read_dir(parent)
        .map(|d| {
            d.flatten()
                .filter(|e| e.file_name().to_string_lossy().starts_with(&prefix))
                .map(|e| e.path())
                .collect()
        })
        .unwrap_or_default()
}

/// Restores a validated checkpoint into `data_dir`, which must be absent or empty.
pub fn restore(
    manifest_path: &Path,
    data_dir: &Path,
    expect: &Expectations,
) -> Result<RestoreReport> {
    if data_dir.exists() {
        let empty = std::fs::read_dir(data_dir)
            .map_err(|e| AceError::io("list", data_dir, e))?
            .next()
            .is_none();
        if !empty {
            return Err(AceError::Snapshot(format!(
                "{} is not empty; ACE never overwrites a data directory. Move it aside yourself if it is to be replaced",
                data_dir.display()
            )));
        }
    }
    let leftovers = interrupted_restores(data_dir);
    if !leftovers.is_empty() {
        return Err(AceError::Snapshot(format!(
            "an earlier restore was interrupted and left {}; inspect and remove it first",
            leftovers
                .iter()
                .map(|p| p.display().to_string())
                .collect::<Vec<_>>()
                .join(", ")
        )));
    }
    let manifest = validate(manifest_path, expect)?;
    let parent = data_dir.parent().ok_or_else(|| {
        AceError::Snapshot(format!("{} has no parent directory", data_dir.display()))
    })?;
    std::fs::create_dir_all(parent).map_err(|e| AceError::io("create", parent, e))?;
    let free = host::disk(parent).map(|d| d.free_bytes).unwrap_or(0);
    let need = manifest.unpacked_bytes.saturating_add(64 * MIB);
    if free < need {
        return Err(AceError::Snapshot(format!(
            "{} MiB free at {}, the restore needs {} MiB",
            free / MIB,
            parent.display(),
            need / MIB
        )));
    }
    let name = data_dir
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let staging = parent.join(format!(".{name}.ace-restore-{}", now_unix()));
    std::fs::create_dir(&staging).map_err(|e| AceError::io("create", &staging, e))?;
    let archive = manifest_path
        .parent()
        .unwrap_or(Path::new("."))
        .join(&manifest.archive_file);
    oplog::info(
        Category::Snapshot,
        &format!("restoring into staging {}", staging.display()),
    );
    if let Err(e) = read_archive(&manifest, &archive, Some(&staging)) {
        // The staging directory is ACE's own and holds nothing else; remove it.
        let _ = std::fs::remove_dir_all(&staging);
        return Err(e);
    }
    let restored = datadir::read_manifest(&staging)?;
    if restored != manifest.identity {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(AceError::Snapshot(
            "the restored DATADIR.txt does not match the checkpoint manifest".to_owned(),
        ));
    }
    if data_dir.exists() {
        // Empty, checked above; rmdir refuses anything else.
        std::fs::remove_dir(data_dir).map_err(|e| AceError::io("replace empty", data_dir, e))?;
    }
    std::fs::rename(&staging, data_dir).map_err(|e| AceError::io("rename", data_dir, e))?;
    let report = RestoreReport {
        checkpoint: manifest_path.to_path_buf(),
        data_dir: data_dir.to_path_buf(),
        height: manifest
            .identity
            .last_finalized
            .as_ref()
            .map_or(0, |f| f.height),
        state_root: manifest
            .identity
            .last_finalized
            .as_ref()
            .map(|f| f.state_root.clone()),
        genesis_id: manifest.identity.genesis_id.clone(),
        files: manifest.files.len(),
        restored_at: rfc3339(now_unix()),
    };
    oplog::info(
        Category::Recovery,
        &format!(
            "restored {} files into {} at height {}",
            report.files,
            data_dir.display(),
            report.height
        ),
    );
    Ok(report)
}

/// The newest checkpoint in `dir` that validates; skipped ones are logged with the reason.
pub fn latest_valid(
    dir: &Path,
    expect: &Expectations,
) -> Result<Option<(PathBuf, CheckpointManifest)>> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Ok(None);
    };
    let mut candidates: Vec<(u64, String, PathBuf)> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "json")
            && let Ok(m) = load(&path)
        {
            let height = m.identity.last_finalized.as_ref().map_or(0, |f| f.height);
            candidates.push((height, m.created_at.clone(), path));
        }
    }
    candidates.sort();
    for (_, _, path) in candidates.into_iter().rev() {
        match validate(&path, expect) {
            Ok(m) => return Ok(Some((path, m))),
            Err(e) => oplog::warn(
                Category::Snapshot,
                &format!("skipping {}: {e}", path.display()),
            ),
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEXT: &str = "chain_id             7771\ngenesis_id           9164487f5f211839f5796c6b2193e17d289a285d9eebce6bbc592f26a4c7719e\nnetwork_kind         devnet\nstorage_schema       1\nmin_reader_schema    1\nlast_writer_release  aletheiad 0.1.0\nlast_finalized       height 30 hash 48d7 state_root cd0e\nmigration_in_progress none\n";

    fn data_dir(root: &Path) -> PathBuf {
        let d = root.join("data");
        for sub in ["wal", "state", "chain", "blocks", "snapshots", "migrations"] {
            std::fs::create_dir_all(d.join(sub)).unwrap();
        }
        std::fs::write(d.join("DATADIR"), b"ALDATA\0\x01binary").unwrap();
        std::fs::write(d.join("DATADIR.txt"), TEXT).unwrap();
        std::fs::write(d.join("LOCK"), b"").unwrap();
        std::fs::write(d.join("state/000001.sst"), vec![7u8; 5000]).unwrap();
        std::fs::write(d.join("wal/wal.log"), b"wal").unwrap();
        d
    }

    fn expect() -> Expectations {
        Expectations {
            network: "devnet".into(),
            chain_id: 7771,
            genesis_id: Some(
                "9164487f5f211839f5796c6b2193e17d289a285d9eebce6bbc592f26a4c7719e".into(),
            ),
            binary_storage_schema: Some(1),
            max_bytes: 1 << 30,
        }
    }

    fn make(root: &Path) -> PathBuf {
        let data = data_dir(root);
        create(&CreateInput {
            data_dir: &data,
            out_dir: &root.join("cp"),
            source_commit: "1b4f4dc409255e730b566b434c7fd955742cbc7c",
            aletheiad_sha256: "00",
            last_clean_stop: Some(30),
            max_bytes: 1 << 30,
        })
        .unwrap()
    }

    #[test]
    fn a_checkpoint_round_trips_into_an_empty_directory() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = make(dir.path());
        let m = load(&manifest).unwrap();
        assert!(m.clean_stop);
        assert!(!m.files.iter().any(|f| f.path == "LOCK"));
        let target = dir.path().join("restored");
        let report = restore(&manifest, &target, &expect()).unwrap();
        assert_eq!(report.height, 30);
        assert_eq!(
            std::fs::read(target.join("state/000001.sst")).unwrap(),
            vec![7u8; 5000]
        );
        assert!(
            target.join("migrations").is_dir(),
            "empty directories are kept"
        );
        assert!(interrupted_restores(&target).is_empty());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let archive = dir.path().join("cp").join(&m.archive_file);
            assert_eq!(
                std::fs::metadata(archive).unwrap().permissions().mode() & 0o777,
                0o600
            );
            let restored = std::fs::metadata(target.join("wal/wal.log")).unwrap();
            assert_eq!(restored.permissions().mode() & 0o777, 0o600);
        }
    }

    #[test]
    fn a_running_node_s_directory_is_never_copied() {
        let dir = tempfile::tempdir().unwrap();
        let data = data_dir(dir.path());
        let held = datadir::lock(&data).unwrap();
        let error = create(&CreateInput {
            data_dir: &data,
            out_dir: &dir.path().join("cp"),
            source_commit: "x",
            aletheiad_sha256: "x",
            last_clean_stop: None,
            max_bytes: 1 << 30,
        })
        .unwrap_err();
        assert!(error.to_string().contains("stop the node"), "{error}");
        drop(held);
    }

    #[test]
    fn a_working_directory_is_never_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = make(dir.path());
        let error = restore(&manifest, &dir.path().join("data"), &expect()).unwrap_err();
        assert!(error.to_string().contains("not empty"), "{error}");
    }

    #[test]
    fn a_corrupt_or_truncated_archive_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = make(dir.path());
        let m = load(&manifest).unwrap();
        let archive = dir.path().join("cp").join(&m.archive_file);
        let mut bytes = std::fs::read(&archive).unwrap();
        bytes.truncate(bytes.len() / 2);
        std::fs::write(&archive, &bytes).unwrap();
        assert!(validate(&manifest, &expect()).is_err());
        assert!(restore(&manifest, &dir.path().join("r"), &expect()).is_err());
        assert!(!dir.path().join("r").exists());
    }

    #[test]
    fn a_tampered_file_with_a_matching_archive_hash_is_still_refused() {
        // Someone rewrites the archive and the archive hash, but not the per-file records.
        let dir = tempfile::tempdir().unwrap();
        let manifest_path = make(dir.path());
        let mut m = load(&manifest_path).unwrap();
        let data = dir.path().join("data");
        std::fs::write(data.join("wal/wal.log"), b"WAL").unwrap();
        std::fs::remove_file(data.join("LOCK")).unwrap();
        let other = create(&CreateInput {
            data_dir: &data,
            out_dir: &dir.path().join("cp2"),
            source_commit: "x",
            aletheiad_sha256: "x",
            last_clean_stop: None,
            max_bytes: 1 << 30,
        })
        .unwrap();
        let o = load(&other).unwrap();
        std::fs::copy(
            dir.path().join("cp2").join(&o.archive_file),
            dir.path().join("cp").join(&m.archive_file),
        )
        .unwrap();
        m.archive_sha256 = o.archive_sha256;
        m.archive_bytes = o.archive_bytes;
        std::fs::write(&manifest_path, serde_json::to_vec(&m).unwrap()).unwrap();
        let error = validate(&manifest_path, &expect()).unwrap_err().to_string();
        assert!(error.contains("wal/wal.log"), "{error}");
    }

    #[test]
    fn a_wrong_network_or_genesis_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = make(dir.path());
        let mut e = expect();
        e.genesis_id =
            Some("ee6e8c5e4d28ea10e699e27daccd13911974f819aaf777ef2f0f21c2897a379a".into());
        assert!(validate(&manifest, &e).is_err());
        let mut e = expect();
        e.network = "mainnet".into();
        assert!(validate(&manifest, &e).is_err());
        let mut e = expect();
        e.max_bytes = 10;
        assert!(validate(&manifest, &e).is_err());
    }

    #[test]
    fn traversal_and_links_in_archives_are_refused() {
        assert!(safe_entry_path(Path::new("data/state/x")).is_ok());
        assert!(safe_entry_path(Path::new("data/../etc/passwd")).is_err());
        assert!(safe_entry_path(Path::new("/data/x")).is_err());
        assert!(safe_entry_path(Path::new("other/x")).is_err());

        // A symlink entry in an otherwise valid archive.
        let dir = tempfile::tempdir().unwrap();
        let manifest_path = make(dir.path());
        let m = load(&manifest_path).unwrap();
        let archive = dir.path().join("cp").join(&m.archive_file);
        let file = File::create(&archive).unwrap();
        let mut b = tar::Builder::new(flate2::write::GzEncoder::new(
            file,
            flate2::Compression::default(),
        ));
        let mut h = tar::Header::new_gnu();
        h.set_entry_type(tar::EntryType::Symlink);
        h.set_size(0);
        b.append_link(&mut h, "data/state/link", "/etc/passwd")
            .unwrap();
        b.into_inner().unwrap().finish().unwrap();
        let (sha, size) = sha256_file(&archive).unwrap();
        let mut m2 = m.clone();
        m2.archive_sha256 = sha;
        m2.archive_bytes = size;
        std::fs::write(&manifest_path, serde_json::to_vec(&m2).unwrap()).unwrap();
        let error = validate(&manifest_path, &expect()).unwrap_err().to_string();
        assert!(error.contains("Symlink"), "{error}");
    }

    #[test]
    fn an_interrupted_restore_blocks_the_next_one() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = make(dir.path());
        std::fs::create_dir(dir.path().join(".restored.ace-restore-1")).unwrap();
        let error = restore(&manifest, &dir.path().join("restored"), &expect()).unwrap_err();
        assert!(error.to_string().contains("interrupted"), "{error}");
    }

    #[test]
    fn the_latest_valid_checkpoint_is_chosen_and_broken_ones_skipped() {
        let dir = tempfile::tempdir().unwrap();
        let first = make(dir.path());
        assert_eq!(
            latest_valid(&dir.path().join("cp"), &expect())
                .unwrap()
                .map(|(p, _)| p),
            Some(first.clone())
        );
        let m = load(&first).unwrap();
        std::fs::write(dir.path().join("cp").join(&m.archive_file), b"broken").unwrap();
        assert!(
            latest_valid(&dir.path().join("cp"), &expect())
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn the_schema_is_read_from_the_pinned_source() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("crates/storage/src");
        std::fs::create_dir_all(&path).unwrap();
        std::fs::write(
            path.join("datadir.rs"),
            "/// x\npub const BINARY_STORAGE_SCHEMA: u32 = 1;\n",
        )
        .unwrap();
        assert_eq!(source_storage_schema(dir.path()), Some(1));
    }
}
