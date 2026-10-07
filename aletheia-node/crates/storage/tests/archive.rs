//! Block archive: append order, verified reads, tamper detection and torn tails (spec 42.3).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects,
    clippy::as_conversions,
    clippy::cast_possible_truncation
)]

use aletheia_core::block::{Block, BlockBody, BlockHeader, Proposal, QuorumCertificate};
use aletheia_core::{
    AceDecode, ChainId, Epoch, ErrorCode, Hash32, Height, NetworkIdentity, NetworkKind,
    ProtocolVersion, Slot, ValidatorIndex,
};
use aletheia_storage::archive::{
    ArchiveConfig, ArchiveLocation, BlockArchive, height_key, index_entries,
};
use aletheia_storage::{ColumnFamily, KvStore, MemoryKvStore};
use std::path::PathBuf;

fn network() -> NetworkIdentity {
    NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
}

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-archive-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn proposal(height: u64) -> Proposal {
    Proposal {
        block: Block {
            header: BlockHeader {
                version: ProtocolVersion::new(1),
                chain_id: ChainId::new(7771),
                height: Height::new(height),
                epoch: Epoch::new(0),
                slot: Slot::new(height),
                protocol_time_ms: 1_791_331_200_000 + height * 500,
                proposer: ValidatorIndex::new(0),
                parent_hash: Hash32::from_bytes([height as u8; 32]),
                parent_qc: QuorumCertificate::genesis(),
                timeout_cert: None,
                tx_root: Hash32::ZERO,
                receipt_root: Hash32::ZERO,
                state_root: Hash32::from_bytes([7; 32]),
                event_root: Hash32::ZERO,
                validator_set_hash: Hash32::ZERO,
                next_validator_set_hash: Hash32::ZERO,
                monetary_root: Hash32::ZERO,
                eu_used: 0,
                tx_count: 0,
                extensions: Vec::new(),
            },
            body: BlockBody {
                transactions: Vec::new(),
            },
        },
        proposer_signature: [9; 96],
    }
}

fn small() -> ArchiveConfig {
    ArchiveConfig { segment_bytes: 600 }
}

#[test]
fn appended_blocks_read_back_verified() {
    let dir = scratch("roundtrip");
    let mut archive = BlockArchive::open(&dir, network(), small()).unwrap();
    let locations: Vec<ArchiveLocation> = (1..=10)
        .map(|h| archive.append(&proposal(h)).unwrap())
        .collect();
    assert!(
        locations.last().unwrap().segment > 0,
        "small segments force rotation"
    );
    for (h, location) in (1..=10).zip(&locations) {
        assert_eq!(
            archive.read(*location, Height::new(h)).unwrap(),
            proposal(h)
        );
    }
}

#[test]
fn heights_must_be_consecutive() {
    let dir = scratch("order");
    let mut archive = BlockArchive::open(&dir, network(), ArchiveConfig::default()).unwrap();
    archive.append(&proposal(1)).unwrap();
    assert_eq!(
        archive.append(&proposal(3)).unwrap_err().code(),
        ErrorCode::FinalizeOutOfOrder
    );
    assert_eq!(
        archive.append(&proposal(1)).unwrap_err().code(),
        ErrorCode::FinalizeOutOfOrder
    );
    archive.append(&proposal(2)).unwrap();
}

#[test]
fn reopening_continues_after_the_last_block() {
    let dir = scratch("reopen");
    {
        let mut archive = BlockArchive::open(&dir, network(), small()).unwrap();
        for h in 1..=6 {
            archive.append(&proposal(h)).unwrap();
        }
    }
    let mut archive = BlockArchive::open(&dir, network(), small()).unwrap();
    assert_eq!(archive.last_height(), Some(Height::new(6)));
    archive.append(&proposal(7)).unwrap();
}

#[test]
fn a_record_at_the_wrong_height_is_an_archive_mismatch() {
    let dir = scratch("height");
    let mut archive = BlockArchive::open(&dir, network(), ArchiveConfig::default()).unwrap();
    let location = archive.append(&proposal(1)).unwrap();
    assert_eq!(
        archive.read(location, Height::new(2)).unwrap_err().code(),
        ErrorCode::StoArchiveMismatch
    );
}

#[test]
fn a_flipped_byte_is_detected() {
    let dir = scratch("flip");
    let mut archive = BlockArchive::open(&dir, network(), ArchiveConfig::default()).unwrap();
    let location = archive.append(&proposal(1)).unwrap();
    drop(archive);
    let path = dir.join("seg-000000000000.blk");
    let mut bytes = std::fs::read(&path).unwrap();
    let inside_frame = (location.offset as usize) + 60;
    bytes[inside_frame] ^= 0x40;
    std::fs::write(&path, bytes).unwrap();
    let archive = BlockArchive::open(&dir, network(), ArchiveConfig::default());
    // The flipped record is the last one, so open treats it as torn and truncates it, or the
    // read rejects it; either way corrupted bytes never come back as a block.
    match archive {
        Ok(archive) => assert!(archive.read(location, Height::new(1)).is_err()),
        Err(error) => assert_eq!(error.code(), ErrorCode::StoCorrupt),
    }
}

#[test]
fn the_wrong_network_never_verifies_an_archived_block() {
    let dir = scratch("network");
    let mut archive = BlockArchive::open(&dir, network(), ArchiveConfig::default()).unwrap();
    let location = archive.append(&proposal(1)).unwrap();
    drop(archive);
    let mainnet = NetworkIdentity::new(ChainId::new(7771), NetworkKind::Mainnet, Hash32::ZERO);
    let other = BlockArchive::open(&dir, mainnet, ArchiveConfig::default()).unwrap();
    assert_eq!(
        other.read(location, Height::new(1)).unwrap_err().code(),
        ErrorCode::StoArchiveMismatch
    );
}

#[test]
fn a_torn_tail_is_truncated_and_the_next_append_succeeds() {
    let dir = scratch("torn");
    {
        let mut archive = BlockArchive::open(&dir, network(), ArchiveConfig::default()).unwrap();
        archive.append(&proposal(1)).unwrap();
        archive.append(&proposal(2)).unwrap();
    }
    let path = dir.join("seg-000000000000.blk");
    let bytes = std::fs::read(&path).unwrap();
    std::fs::write(&path, &bytes[..bytes.len() - 5]).unwrap();
    let mut archive = BlockArchive::open(&dir, network(), ArchiveConfig::default()).unwrap();
    assert_eq!(archive.last_height(), Some(Height::new(1)));
    archive.append(&proposal(2)).unwrap();
}

#[test]
fn index_entries_map_height_to_location_and_hash_to_height() {
    let dir = scratch("index");
    let mut archive = BlockArchive::open(&dir, network(), ArchiveConfig::default()).unwrap();
    let block = proposal(1);
    let location = archive.append(&block).unwrap();
    let store = MemoryKvStore::new();
    let mut batch = store.batch();
    let hash = block.block.header.block_hash(&network());
    index_entries(&mut batch, Height::new(1), &hash, location);
    store.write_sync(batch).unwrap();

    let stored = store
        .get(ColumnFamily::BlockIndex, &height_key(Height::new(1)))
        .unwrap()
        .unwrap();
    let found = ArchiveLocation::from_ace_bytes(&stored).unwrap();
    assert_eq!(archive.read(found, Height::new(1)).unwrap(), block);
}
