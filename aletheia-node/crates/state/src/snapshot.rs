//! State snapshots (spec Section 42.4, APS-0033).
//!
//! ```text
//! snapshots/<height>/manifest.ace        checksummed ACE manifest
//! snapshots/<height>/chunk-000000.zst    zstd(ACE(list<(StateKey, value bytes)>)), keys ascending
//! SnapshotManifest = height u64 | state_root Hash32 | chunk_hashes list<Hash32>
//!                  | finality_proof bytes (opaque here; the consensus layer fills and checks it)
//! chunk_hash = BLAKE3(uncompressed chunk bytes)
//! ```
//!
//! A snapshot is never trusted without proof. Restore checks every chunk against the
//! manifest's hash as it is read, keys must ascend strictly across all chunks, and the tree
//! rebuilt from them must have exactly the manifest's state root. The manifest itself is bound
//! to the chain by the finality proof, which the caller verifies before restoring.
//!
//! Restore currently rebuilds the tree in one batch, holding the state in memory; streaming
//! restore for large states is planned with state sync (Phase 4).

use std::fs;
use std::path::{Path, PathBuf};

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32, NetworkIdentity,
};
use aletheia_storage::KvStore;

use crate::jmt::tree::JellyfishMerkleTree;
use crate::key::{MAX_STATE_VALUE_BYTES, StateKey, StateValue};

/// Uncompressed bytes per chunk before a new one starts (Section 42.4: 16 MiB).
pub const DEFAULT_CHUNK_BYTES: usize = 16 * 1024 * 1024;
/// Decompression cap: a chunk plus one maximal value.
const MAX_CHUNK_BYTES: usize = DEFAULT_CHUNK_BYTES + MAX_STATE_VALUE_BYTES + 64;
const MAX_CHUNKS: u32 = 1 << 20;
const MAX_FINALITY_PROOF_BYTES: u32 = 64 * 1024;
const MANIFEST_MAGIC: &[u8; 8] = b"ALSNAP01";
const ZSTD_LEVEL: i32 = 3;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotManifest {
    pub height: u64,
    pub state_root: Hash32,
    pub chunk_hashes: Vec<Hash32>,
    pub finality_proof: Vec<u8>,
}

impl AceEncode for SnapshotManifest {
    fn encode(&self, out: &mut AceWriter) {
        out.u64(self.height);
        self.state_root.encode(out);
        out.list(&self.chunk_hashes);
        out.bytes(&self.finality_proof);
    }
}

impl AceDecode for SnapshotManifest {
    fn decode(input: &mut AceReader<'_>) -> Result<SnapshotManifest, AletheiaError> {
        Ok(SnapshotManifest {
            height: input.u64()?,
            state_root: Hash32::decode(input)?,
            chunk_hashes: input.list(MAX_CHUNKS)?,
            finality_proof: input.bytes(MAX_FINALITY_PROOF_BYTES)?.to_vec(),
        })
    }
}

fn io(action: &str, path: &Path, error: &std::io::Error) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoIo,
        format!("{action} {}: {error}", path.display()),
    )
}

/// The file name of chunk `index` in a snapshot directory.
pub fn chunk_file_name(index: usize) -> String {
    format!("chunk-{index:06}.zst")
}

fn chunk_path(dir: &Path, index: usize) -> PathBuf {
    dir.join(chunk_file_name(index))
}

/// Largest compressed chunk a snapshot can hold: zstd's bound on the largest raw chunk.
pub const MAX_COMPRESSED_CHUNK_BYTES: usize = MAX_CHUNK_BYTES + MAX_CHUNK_BYTES / 128 + 1024;

/// Checks one compressed chunk against the hash its manifest records, as a download
/// completes, so a bad chunk is fetched again from another peer instead of failing the
/// restore. The restore checks every chunk again.
pub fn check_chunk(
    compressed: &[u8],
    expected: &Hash32,
    index: usize,
) -> Result<(), AletheiaError> {
    let raw = zstd::bulk::decompress(compressed, MAX_CHUNK_BYTES).map_err(|e| {
        AletheiaError::new(
            ErrorCode::ProofInvalid,
            format!("snapshot chunk {index} does not decompress: {e}"),
        )
    })?;
    if chunk_hash(&raw) != *expected {
        return Err(AletheiaError::new(
            ErrorCode::ProofInvalid,
            format!("snapshot chunk {index} does not match its manifest hash"),
        ));
    }
    Ok(())
}

/// Writes a synced file into a snapshot directory (a downloaded chunk).
pub fn write_chunk(dir: &Path, index: usize, compressed: &[u8]) -> Result<(), AletheiaError> {
    write_file_synced(&chunk_path(dir, index), compressed)
}

/// Writes `manifest.ace` for a snapshot assembled from parts (a download).
pub fn write_manifest(dir: &Path, manifest: &SnapshotManifest) -> Result<(), AletheiaError> {
    write_file_synced(&dir.join("manifest.ace"), &manifest_file_bytes(manifest))
}

fn manifest_file_bytes(manifest: &SnapshotManifest) -> Vec<u8> {
    let encoded = manifest.to_ace_bytes();
    let mut file_bytes = MANIFEST_MAGIC.to_vec();
    file_bytes.extend_from_slice(&encoded);
    file_bytes.extend_from_slice(&crc32c_of(&encoded).to_le_bytes());
    file_bytes
}

fn chunk_hash(bytes: &[u8]) -> Hash32 {
    Hash32::from_bytes(*blake3::hash(bytes).as_bytes())
}

fn encode_chunk(entries: &[(StateKey, StateValue)]) -> Vec<u8> {
    let mut out = AceWriter::new();
    out.u32(u32::try_from(entries.len()).unwrap_or(u32::MAX));
    for (key, value) in entries {
        key.hash().encode(&mut out);
        out.bytes(value);
    }
    out.into_bytes()
}

fn write_file_synced(path: &Path, bytes: &[u8]) -> Result<(), AletheiaError> {
    use std::io::Write;
    let mut file = fs::File::create(path).map_err(|e| io("create", path, &e))?;
    file.write_all(bytes).map_err(|e| io("write", path, &e))?;
    file.sync_all().map_err(|e| io("sync", path, &e))
}

/// Entries one [`SnapshotWriter::step`] reads by default: small enough that a node writing a
/// snapshot between other work never holds that work up for long.
pub const STEP_ENTRIES: usize = 4096;

/// Writes the state at one height into a directory a page at a time, so the owner of the
/// store can interleave the work with everything else it does. The version being written must
/// stay readable until [`SnapshotWriter::finish`] (no pruning of it meanwhile).
#[derive(Debug)]
pub struct SnapshotWriter {
    dir: PathBuf,
    height: u64,
    state_root: Hash32,
    chunk_bytes: usize,
    chunk_hashes: Vec<Hash32>,
    pending: Vec<(StateKey, StateValue)>,
    pending_bytes: usize,
    after: Option<StateKey>,
    done: bool,
}

impl SnapshotWriter {
    /// Starts a snapshot of `height` in `dir`, which must not exist.
    pub fn begin(
        tree: &JellyfishMerkleTree<'_>,
        height: u64,
        dir: &Path,
        chunk_bytes: usize,
    ) -> Result<SnapshotWriter, AletheiaError> {
        if dir.exists() {
            return Err(AletheiaError::new(
                ErrorCode::StoIo,
                format!("snapshot directory {} already exists", dir.display()),
            ));
        }
        fs::create_dir_all(dir).map_err(|e| io("create snapshot directory", dir, &e))?;
        Ok(SnapshotWriter {
            dir: dir.to_path_buf(),
            height,
            state_root: tree.root_hash(height)?,
            chunk_bytes: chunk_bytes.max(1),
            chunk_hashes: Vec::new(),
            pending: Vec::new(),
            pending_bytes: 0,
            after: None,
            done: false,
        })
    }

    pub fn height(&self) -> u64 {
        self.height
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    /// Reads up to `entries` more live entries, flushing every chunk that fills. Returns true
    /// once every entry has been read; then call [`SnapshotWriter::finish`].
    pub fn step(
        &mut self,
        tree: &JellyfishMerkleTree<'_>,
        entries: usize,
    ) -> Result<bool, AletheiaError> {
        if self.done {
            return Ok(true);
        }
        let page = tree.live_entries(self.height, self.after.as_ref(), entries.max(1))?;
        if page.is_empty() {
            self.done = true;
            return Ok(true);
        }
        for entry in page {
            self.pending_bytes = self
                .pending_bytes
                .saturating_add(entry.1.len())
                .saturating_add(36);
            self.after = Some(entry.0);
            self.pending.push(entry);
            if self.pending_bytes >= self.chunk_bytes {
                let index = self.chunk_hashes.len();
                self.chunk_hashes
                    .push(flush_chunk(&self.dir, index, &self.pending)?);
                self.pending.clear();
                self.pending_bytes = 0;
            }
        }
        Ok(false)
    }

    /// Flushes the last chunk and writes the manifest (synced). The snapshot is complete only
    /// once this returns.
    pub fn finish(mut self, finality_proof: Vec<u8>) -> Result<SnapshotManifest, AletheiaError> {
        if !self.done {
            return Err(AletheiaError::new(
                ErrorCode::StoIo,
                format!(
                    "snapshot at height {} finished before every entry was read",
                    self.height
                ),
            ));
        }
        if !self.pending.is_empty() || self.chunk_hashes.is_empty() {
            let index = self.chunk_hashes.len();
            self.chunk_hashes
                .push(flush_chunk(&self.dir, index, &self.pending)?);
        }
        let manifest = SnapshotManifest {
            height: self.height,
            state_root: self.state_root,
            chunk_hashes: self.chunk_hashes,
            finality_proof,
        };
        write_file_synced(
            &self.dir.join("manifest.ace"),
            &manifest_file_bytes(&manifest),
        )?;
        sync_dir(&self.dir)?;
        Ok(manifest)
    }
}

/// Makes a directory's entries (new files, renames) durable where the platform allows it.
pub fn sync_dir(dir: &Path) -> Result<(), AletheiaError> {
    #[cfg(unix)]
    {
        fs::File::open(dir)
            .and_then(|d| d.sync_all())
            .map_err(|e| io("sync directory", dir, &e))?;
    }
    #[cfg(not(unix))]
    let _ = dir;
    Ok(())
}

/// Writes the state at `height` into `dir` (which must not exist) and returns its manifest.
pub fn create(
    tree: &JellyfishMerkleTree<'_>,
    height: u64,
    finality_proof: Vec<u8>,
    dir: &Path,
    chunk_bytes: usize,
) -> Result<SnapshotManifest, AletheiaError> {
    let mut writer = SnapshotWriter::begin(tree, height, dir, chunk_bytes)?;
    while !writer.step(tree, STEP_ENTRIES)? {}
    writer.finish(finality_proof)
}

/// The manifest's own integrity check; its authenticity comes from the finality proof.
fn crc32c_of(bytes: &[u8]) -> u32 {
    crc32c::crc32c(bytes)
}

fn flush_chunk(
    dir: &Path,
    index: usize,
    entries: &[(StateKey, StateValue)],
) -> Result<Hash32, AletheiaError> {
    let raw = encode_chunk(entries);
    let compressed = zstd::bulk::compress(&raw, ZSTD_LEVEL).map_err(|e| {
        AletheiaError::new(
            ErrorCode::StoIo,
            format!("compress snapshot chunk {index}: {e}"),
        )
    })?;
    write_file_synced(&chunk_path(dir, index), &compressed)?;
    Ok(chunk_hash(&raw))
}

pub fn read_manifest(dir: &Path) -> Result<SnapshotManifest, AletheiaError> {
    let path = dir.join("manifest.ace");
    let bytes = fs::read(&path).map_err(|e| io("read", &path, &e))?;
    let corrupt = |reason: &str| {
        AletheiaError::new(
            ErrorCode::StoCorrupt,
            format!("{}: {reason}", path.display()),
        )
    };
    let body = bytes
        .strip_prefix(&MANIFEST_MAGIC[..])
        .ok_or_else(|| corrupt("wrong magic"))?;
    let (encoded, crc) = body
        .split_at_checked(body.len().saturating_sub(4))
        .ok_or_else(|| corrupt("truncated"))?;
    if crc != crc32c_of(encoded).to_le_bytes() {
        return Err(corrupt("checksum mismatch"));
    }
    SnapshotManifest::from_ace_bytes(encoded).map_err(|e| corrupt(e.detail()))
}

/// Restores the snapshot in `dir` into `store` as version `manifest.height`. The caller has
/// already verified `manifest.finality_proof` against the validator set.
pub fn restore(
    store: &dyn KvStore,
    network: &NetworkIdentity,
    dir: &Path,
    manifest: &SnapshotManifest,
) -> Result<(), AletheiaError> {
    let batch = restore_batch(store, network, dir, manifest)?;
    store.write_sync(batch)
}

/// [`restore`] without the write: the batch holding the rebuilt tree, verified against the
/// manifest's root, for a caller that commits it together with its own records.
pub fn restore_batch(
    store: &dyn KvStore,
    network: &NetworkIdentity,
    dir: &Path,
    manifest: &SnapshotManifest,
) -> Result<aletheia_storage::WriteBatch, AletheiaError> {
    let invalid = |reason: String| {
        AletheiaError::new(
            ErrorCode::ProofInvalid,
            format!("snapshot at height {}: {reason}", manifest.height),
        )
    };
    let mut entries: Vec<(StateKey, Option<StateValue>)> = Vec::new();
    for (index, expected) in manifest.chunk_hashes.iter().enumerate() {
        let path = chunk_path(dir, index);
        let compressed = fs::read(&path).map_err(|e| io("read", &path, &e))?;
        let raw = zstd::bulk::decompress(&compressed, MAX_CHUNK_BYTES)
            .map_err(|e| invalid(format!("chunk {index} does not decompress: {e}")))?;
        if chunk_hash(&raw) != *expected {
            return Err(invalid(format!(
                "chunk {index} does not match its manifest hash"
            )));
        }
        let mut reader = AceReader::new(&raw);
        let count = reader.u32()?;
        for _ in 0..count {
            let key = StateKey::from_hash(Hash32::decode(&mut reader)?);
            let value = reader
                .bytes(u32::try_from(MAX_STATE_VALUE_BYTES).unwrap_or(u32::MAX))?
                .to_vec();
            if entries.last().is_some_and(|(previous, _)| *previous >= key) {
                return Err(invalid(format!(
                    "keys are not strictly ascending in chunk {index}"
                )));
            }
            entries.push((key, Some(value)));
        }
        reader.finish()?;
    }
    let tree = JellyfishMerkleTree::new(store, *network);
    let mut batch = store.batch();
    let root = tree.apply(None, manifest.height, &entries, &mut batch)?;
    if root != manifest.state_root {
        return Err(invalid(format!(
            "restored root {root} differs from manifest root {}",
            manifest.state_root
        )));
    }
    Ok(batch)
}
