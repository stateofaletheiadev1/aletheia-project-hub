//! Snapshots written by a running node (ADR-072, spec Section 42.4).
//!
//! Every `every_blocks` finalized blocks, at the first tip that carries a finality proof, the
//! chain thread starts a snapshot of that height in `<data_dir>/snapshots/.partial-<height>`
//! and writes it a page at a time whenever its request queue is empty, so consensus and reads
//! are never held up by more than one page. A finished snapshot gets its anchor and is renamed
//! to `<data_dir>/snapshots/<height>`; only complete snapshots ever carry that name. The
//! newest `keep` are kept. A snapshot that fails (a full disk, say) is removed, reported, and
//! tried again an interval later; it never stops the node.

use std::path::{Path, PathBuf};

use aletheia_consensus::FinalityProof;
use aletheia_core::{AceEncode, AletheiaError, Height};
use aletheia_state::JellyfishMerkleTree;
use aletheia_state::snapshot::{DEFAULT_CHUNK_BYTES, STEP_ENTRIES, SnapshotWriter, sync_dir};
use aletheia_storage::KvStore;

use crate::bootstrap::{ANCHOR_FILE, SnapshotAnchor, write_anchor};
use crate::consensus::operator_note;
use crate::ledger::Ledger;

/// About one day of 500 ms slots.
pub const DEFAULT_EVERY_BLOCKS: u64 = 172_800;
pub const DEFAULT_KEEP: usize = 2;
const PARTIAL_PREFIX: &str = ".partial-";

/// How often a node writes snapshots and how many it keeps. `every_blocks = 0` writes none.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SnapshotPolicy {
    pub every_blocks: u64,
    pub keep: usize,
}

impl SnapshotPolicy {
    pub const DISABLED: SnapshotPolicy = SnapshotPolicy {
        every_blocks: 0,
        keep: DEFAULT_KEEP,
    };
}

impl Default for SnapshotPolicy {
    fn default() -> SnapshotPolicy {
        SnapshotPolicy::DISABLED
    }
}

/// Where a new data directory's snapshot comes from.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RestoreFrom {
    /// A snapshot directory copied to this host (ADR-072).
    Directory(PathBuf),
    /// Fetched from peers over the SnapshotSync channel and verified (ADR-073).
    Peers,
}

impl core::fmt::Display for RestoreFrom {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            RestoreFrom::Directory(path) => write!(f, "{}", path.display()),
            RestoreFrom::Peers => f.write_str("peers"),
        }
    }
}

struct Active {
    writer: SnapshotWriter,
    anchor: SnapshotAnchor,
    proof: FinalityProof,
    started: std::time::Instant,
}

pub(crate) struct Exporter {
    root: PathBuf,
    policy: SnapshotPolicy,
    /// The height of the newest finished (or last attempted) snapshot.
    last: u64,
    active: Option<Active>,
}

/// The complete snapshots in `root`, by height, ascending.
pub fn complete_snapshots(root: &Path) -> Vec<(u64, PathBuf)> {
    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };
    let mut found: Vec<(u64, PathBuf)> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let height = entry.file_name().to_str()?.parse::<u64>().ok()?;
            let path = entry.path();
            (path.join("manifest.ace").is_file() && path.join(ANCHOR_FILE).is_file())
                .then_some((height, path))
        })
        .collect();
    found.sort();
    found
}

impl Exporter {
    /// Removes what an interrupted snapshot left behind and finds the newest complete one.
    pub(crate) fn open(data_dir: &Path, policy: SnapshotPolicy) -> Exporter {
        let root = data_dir.join("snapshots");
        if let Ok(entries) = std::fs::read_dir(&root) {
            for entry in entries.filter_map(Result::ok) {
                if entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| name.starts_with(PARTIAL_PREFIX))
                {
                    let _ = std::fs::remove_dir_all(entry.path());
                }
            }
        }
        let last = complete_snapshots(&root).last().map_or(0, |(h, _)| *h);
        Exporter {
            root,
            policy,
            last,
            active: None,
        }
    }

    pub(crate) fn busy(&self) -> bool {
        self.active.is_some()
    }

    /// After each request: start a snapshot when one is due and the tip can be proven.
    pub(crate) fn after_request<S: KvStore>(&mut self, ledger: &Ledger<S>) {
        if self.policy.every_blocks == 0 || self.active.is_some() {
            return;
        }
        let tip = ledger.tip().height;
        if tip.get() < self.last.saturating_add(self.policy.every_blocks) {
            return;
        }
        // Only a height with a stored proof can anchor a snapshot; most runs end in one.
        match ledger.finality_proof(tip) {
            Ok(Some(_)) => {}
            Ok(None) => return,
            Err(error) => return self.contain(Err(error), tip.get()),
        }
        let started = self.begin(ledger, tip);
        self.contain(started, tip.get());
    }

    fn begin<S: KvStore>(&mut self, ledger: &Ledger<S>, tip: Height) -> Result<(), AletheiaError> {
        let (anchor, proof) = ledger.snapshot_anchor(tip)?;
        std::fs::create_dir_all(&self.root).map_err(|e| {
            AletheiaError::new(
                aletheia_core::ErrorCode::StoIo,
                format!("create {}: {e}", self.root.display()),
            )
        })?;
        let partial = self.root.join(format!("{PARTIAL_PREFIX}{}", tip.get()));
        let _ = std::fs::remove_dir_all(&partial);
        let tree = JellyfishMerkleTree::new(ledger.store(), *ledger.network());
        let writer = SnapshotWriter::begin(&tree, tip.get(), &partial, DEFAULT_CHUNK_BYTES)?;
        operator_note(&format!(
            "info snapshot started height={} epoch_changes={}",
            tip.get(),
            anchor.links.len()
        ));
        self.active = Some(Active {
            writer,
            anchor,
            proof,
            started: std::time::Instant::now(),
        });
        Ok(())
    }

    /// One page of the snapshot in progress; finishes it when the last page is written.
    pub(crate) fn step<S: KvStore>(&mut self, ledger: &Ledger<S>) {
        let Some(height) = self.active.as_ref().map(|active| active.writer.height()) else {
            return;
        };
        let result = self.step_inner(ledger);
        self.contain(result, height);
    }

    fn step_inner<S: KvStore>(&mut self, ledger: &Ledger<S>) -> Result<(), AletheiaError> {
        let Some(active) = self.active.as_mut() else {
            return Ok(());
        };
        let tree = JellyfishMerkleTree::new(ledger.store(), *ledger.network());
        if !active.writer.step(&tree, STEP_ENTRIES)? {
            return Ok(());
        }
        let Some(active) = self.active.take() else {
            return Ok(());
        };
        let height = active.writer.height();
        let partial = active.writer.dir().to_path_buf();
        let manifest = active.writer.finish(active.proof.to_ace_bytes())?;
        write_anchor(&partial, &active.anchor)?;
        sync_dir(&partial)?;
        let done = self.root.join(height.to_string());
        let _ = std::fs::remove_dir_all(&done);
        std::fs::rename(&partial, &done).map_err(|e| {
            AletheiaError::new(
                aletheia_core::ErrorCode::StoIo,
                format!("rename {} to {}: {e}", partial.display(), done.display()),
            )
        })?;
        sync_dir(&self.root)?;
        self.last = height;
        operator_note(&format!(
            "info snapshot written height={height} chunks={} state_root={} seconds={} path={}",
            manifest.chunk_hashes.len(),
            manifest.state_root,
            active.started.elapsed().as_secs(),
            done.display()
        ));
        self.prune();
        Ok(())
    }

    /// A failed snapshot is removed and reported; it is tried again an interval later. A
    /// snapshot is a by-product: it never stops the node. Damage to the store itself is found
    /// and handled by the finalize and recovery paths, which read the same data.
    fn contain(&mut self, result: Result<(), AletheiaError>, height: u64) {
        match result {
            Ok(()) => {}
            Err(error) => {
                if let Some(active) = self.active.take() {
                    let _ = std::fs::remove_dir_all(active.writer.dir());
                }
                self.last = height;
                operator_note(&format!(
                    "warn snapshot at height {height} failed: {} ({}): {}; next attempt in {} blocks",
                    error.code().name(),
                    error.code().get(),
                    error.detail(),
                    self.policy.every_blocks
                ));
            }
        }
    }

    fn prune(&self) {
        let complete = complete_snapshots(&self.root);
        let excess = complete.len().saturating_sub(self.policy.keep.max(1));
        for (_, path) in complete.into_iter().take(excess) {
            let _ = std::fs::remove_dir_all(path);
        }
    }
}

/// The newest complete snapshot under `root` as an offer (ADR-073); height 0 when there is
/// none. Blocking: runs off the sync task.
pub(crate) fn offer(root: &Path) -> aletheia_p2p::Message {
    for (height, path) in complete_snapshots(root).into_iter().rev() {
        let manifest = aletheia_state::snapshot::read_manifest(&path);
        let anchor = crate::bootstrap::read_anchor(&path);
        if let (Ok(manifest), Ok(anchor)) = (manifest, anchor) {
            return aletheia_p2p::Message::SnapshotOffer {
                height,
                manifest: manifest.to_ace_bytes(),
                anchor: anchor.to_ace_bytes(),
            };
        }
    }
    aletheia_p2p::Message::SnapshotOffer {
        height: 0,
        manifest: Vec::new(),
        anchor: Vec::new(),
    }
}

/// Up to 4 MiB of one chunk of a complete snapshot from `offset` (ADR-073); `total` 0 when
/// this node does not serve it. The path is built from numbers only. Blocking.
pub(crate) fn part(root: &Path, height: u64, chunk: u32, offset: u64) -> aletheia_p2p::Message {
    use std::io::{Read, Seek, SeekFrom};
    let none = aletheia_p2p::Message::SnapshotPart {
        height,
        chunk,
        offset,
        total: 0,
        data: Vec::new(),
    };
    let dir = root.join(height.to_string());
    if !dir.join("manifest.ace").is_file() || !dir.join(ANCHOR_FILE).is_file() {
        return none;
    }
    let Ok(index) = usize::try_from(chunk) else {
        return none;
    };
    let path = dir.join(aletheia_state::snapshot::chunk_file_name(index));
    let read = || -> std::io::Result<(u64, Vec<u8>)> {
        let mut file = std::fs::File::open(&path)?;
        let total = file.metadata()?.len();
        if offset >= total {
            return Ok((0, Vec::new()));
        }
        let want = total
            .saturating_sub(offset)
            .min(u64::from(aletheia_p2p::message::MAX_SNAPSHOT_PART_BYTES));
        file.seek(SeekFrom::Start(offset))?;
        let mut data = vec![0u8; usize::try_from(want).unwrap_or(0)];
        file.read_exact(&mut data)?;
        Ok((total, data))
    };
    match read() {
        Ok((total, data)) if total > 0 => aletheia_p2p::Message::SnapshotPart {
            height,
            chunk,
            offset,
            total,
            data,
        },
        _ => none,
    }
}

#[cfg(test)]
mod tests {
    #![allow(
        clippy::unwrap_used,
        clippy::panic,
        clippy::arithmetic_side_effects,
        clippy::cast_possible_truncation,
        clippy::as_conversions
    )]

    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("aletheia-snapshots-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn a_chunk_is_served_in_parts_of_at_most_four_mebibytes() {
        let root = scratch("parts");
        let dir = root.join("77");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("manifest.ace"), b"m").unwrap();
        std::fs::write(dir.join(ANCHOR_FILE), b"a").unwrap();
        let chunk: Vec<u8> = (0..9 * 1024 * 1024).map(|i| (i % 251) as u8).collect();
        std::fs::write(dir.join("chunk-000000.zst"), &chunk).unwrap();
        let mut assembled = Vec::new();
        let mut parts = 0;
        while assembled.len() < chunk.len() {
            let offset = assembled.len() as u64;
            match part(&root, 77, 0, offset) {
                aletheia_p2p::Message::SnapshotPart {
                    total,
                    data,
                    offset: o,
                    ..
                } => {
                    assert_eq!(total, chunk.len() as u64);
                    assert_eq!(o, offset);
                    assert!(data.len() <= 4 * 1024 * 1024);
                    assembled.extend_from_slice(&data);
                    parts += 1;
                }
                other => panic!("{other:?}"),
            }
        }
        assert_eq!(parts, 3);
        assert_eq!(assembled, chunk);
        let not_served = |message| matches!(message, aletheia_p2p::Message::SnapshotPart { total: 0, ref data, .. } if data.is_empty());
        assert!(
            not_served(part(&root, 77, 0, chunk.len() as u64)),
            "past the end"
        );
        assert!(not_served(part(&root, 77, 1, 0)), "no such chunk");
        assert!(not_served(part(&root, 78, 0, 0)), "no such snapshot");
        // An incomplete snapshot (no anchor yet) is never served.
        std::fs::remove_file(dir.join(ANCHOR_FILE)).unwrap();
        assert!(not_served(part(&root, 77, 0, 0)));
    }

    #[test]
    fn a_node_without_snapshots_offers_none() {
        match offer(&scratch("none")) {
            aletheia_p2p::Message::SnapshotOffer {
                height,
                manifest,
                anchor,
            } => {
                assert_eq!(height, 0);
                assert!(manifest.is_empty() && anchor.is_empty());
            }
            other => panic!("{other:?}"),
        }
    }
}
