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

fn chunk_path(dir: &Path, index: usize) -> PathBuf {
    dir.join(format!("chunk-{index:06}.zst"))
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

/// Writes the state at `height` into `dir` (which must not exist) and returns its manifest.
pub fn create(
    tree: &JellyfishMerkleTree<'_>,
    height: u64,
    finality_proof: Vec<u8>,
    dir: &Path,
    chunk_bytes: usize,
) -> Result<SnapshotManifest, AletheiaError> {
    if dir.exists() {
        return Err(AletheiaError::new(
            ErrorCode::StoIo,
            format!("snapshot directory {} already exists", dir.display()),
        ));
    }
    fs::create_dir_all(dir).map_err(|e| io("create snapshot directory", dir, &e))?;
    let state_root = tree.root_hash(height)?;
    let mut chunk_hashes = Vec::new();
    let mut pending: Vec<(StateKey, StateValue)> = Vec::new();
    let mut pending_bytes = 0usize;
    let mut after: Option<StateKey> = None;
    loop {
        let page = tree.live_entries(height, after.as_ref(), 4096)?;
        let done = page.is_empty();
        for entry in page {
            pending_bytes = pending_bytes
                .saturating_add(entry.1.len())
                .saturating_add(36);
            after = Some(entry.0);
            pending.push(entry);
            if pending_bytes >= chunk_bytes {
                chunk_hashes.push(flush_chunk(dir, chunk_hashes.len(), &pending)?);
                pending.clear();
                pending_bytes = 0;
            }
        }
        if done {
            break;
        }
    }
    if !pending.is_empty() || chunk_hashes.is_empty() {
        chunk_hashes.push(flush_chunk(dir, chunk_hashes.len(), &pending)?);
    }
    let manifest = SnapshotManifest {
        height,
        state_root,
        chunk_hashes,
        finality_proof,
    };
    let encoded = manifest.to_ace_bytes();
    let mut file_bytes = MANIFEST_MAGIC.to_vec();
    file_bytes.extend_from_slice(&encoded);
    file_bytes.extend_from_slice(&crc32c_of(&encoded).to_le_bytes());
    write_file_synced(&dir.join("manifest.ace"), &file_bytes)?;
    Ok(manifest)
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
    store.write_sync(batch)
}
