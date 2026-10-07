//! Consensus WAL: format, sync policy, rotation, and crash recovery (spec Section 24).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects,
    clippy::as_conversions,
    clippy::cast_possible_truncation
)]

use aletheia_core::{ErrorCode, ProtocolVersion};
use aletheia_storage::wal::{RECORD_HEADER_LEN, RecordType, SEGMENT_HEADER_LEN, Wal, WalConfig};
use std::path::{Path, PathBuf};

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-wal-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn small() -> WalConfig {
    WalConfig {
        segment_bytes: 256,
        protocol_version: ProtocolVersion::new(1),
    }
}

fn segments(dir: &Path) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect();
    files.sort();
    files
}

/// Record `i` carries `i * 7` bytes of value `i`; every third is a SafetyData record.
fn write_records(dir: &Path, config: WalConfig, count: u8) {
    let (mut wal, _) = Wal::open(dir, config).unwrap();
    for i in 0..count {
        let kind = if i % 3 == 0 {
            RecordType::SafetyData
        } else {
            RecordType::ProposalReceived
        };
        wal.append(kind, &vec![i; usize::from(i) * 7]).unwrap();
    }
    wal.sync().unwrap();
}

#[test]
fn records_survive_reopen_in_order_with_consecutive_sequences() {
    let dir = scratch("reopen");
    write_records(&dir, WalConfig::default(), 10);
    let (wal, recovery) = Wal::open(&dir, WalConfig::default()).unwrap();
    assert_eq!(recovery.truncated_tail_bytes, 0);
    assert_eq!(recovery.records.len(), 10);
    for (i, record) in recovery.records.iter().enumerate() {
        assert_eq!(record.sequence, i as u64);
        assert_eq!(record.payload, vec![i as u8; i * 7]);
    }
    assert_eq!(wal.next_sequence(), 10);
}

#[test]
fn appending_after_reopen_continues_the_sequence() {
    let dir = scratch("continue");
    write_records(&dir, small(), 5);
    let (mut wal, _) = Wal::open(&dir, small()).unwrap();
    assert_eq!(wal.append(RecordType::Checkpoint, b"tip").unwrap(), 5);
    drop(wal);
    let (_, recovery) = Wal::open(&dir, small()).unwrap();
    assert_eq!(
        recovery.records.last().unwrap().kind,
        RecordType::Checkpoint
    );
}

#[test]
fn segments_rotate_and_are_read_back_as_one_log() {
    let dir = scratch("rotate");
    write_records(&dir, small(), 30);
    assert!(
        segments(&dir).len() > 3,
        "small segment size forces rotation"
    );
    let (_, recovery) = Wal::open(&dir, small()).unwrap();
    assert_eq!(recovery.records.len(), 30);
}

#[test]
fn only_safety_and_finalize_records_sync_immediately() {
    let immediate: Vec<RecordType> = [
        RecordType::SafetyData,
        RecordType::ProposalReceived,
        RecordType::BlockExecuted,
        RecordType::QuorumCertificate,
        RecordType::TimeoutCertificate,
        RecordType::FinalizeBegin,
        RecordType::FinalizeCommitted,
        RecordType::Evidence,
        RecordType::Checkpoint,
    ]
    .into_iter()
    .filter(|kind| kind.syncs_immediately())
    .collect();
    assert_eq!(
        immediate,
        [
            RecordType::SafetyData,
            RecordType::FinalizeBegin,
            RecordType::FinalizeCommitted
        ]
    );
}

/// Power loss mid-write: cut the last segment at every offset inside its final record. Recovery
/// must return exactly the records before it and leave a WAL that accepts new appends.
#[test]
fn a_torn_final_record_is_truncated_at_every_cut_point() {
    let base = scratch("torn-base");
    write_records(&base, WalConfig::default(), 4);
    let path = segments(&base).pop().unwrap();
    let full = std::fs::read(&path).unwrap();
    let last_start = full.len() - (RECORD_HEADER_LEN + 3 * 7);

    for cut in last_start..full.len() {
        let dir = scratch(&format!("torn-{cut}"));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(path.file_name().unwrap()), &full[..cut]).unwrap();
        let (mut wal, recovery) = Wal::open(&dir, WalConfig::default()).unwrap();
        assert_eq!(recovery.records.len(), 3, "cut at {cut}");
        assert_eq!(
            recovery.truncated_tail_bytes,
            (cut - last_start) as u64,
            "cut at {cut}"
        );
        assert_eq!(
            wal.append(RecordType::SafetyData, b"after crash").unwrap(),
            3
        );
        drop(wal);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}

#[test]
fn a_zero_filled_tail_is_a_torn_write() {
    let dir = scratch("zeros");
    write_records(&dir, WalConfig::default(), 3);
    let path = segments(&dir).pop().unwrap();
    let mut bytes = std::fs::read(&path).unwrap();
    bytes.extend_from_slice(&[0u8; 4096]);
    std::fs::write(&path, bytes).unwrap();
    let (_, recovery) = Wal::open(&dir, WalConfig::default()).unwrap();
    assert_eq!(recovery.records.len(), 3);
    assert_eq!(recovery.truncated_tail_bytes, 4096);
}

#[test]
fn a_bad_checksum_followed_by_more_records_refuses_to_start() {
    let dir = scratch("middle");
    write_records(&dir, WalConfig::default(), 4);
    let path = segments(&dir).pop().unwrap();
    let mut bytes = std::fs::read(&path).unwrap();
    // Record 1 starts after record 0 (empty payload); flip a byte of record 1's payload.
    let record_1_payload = SEGMENT_HEADER_LEN + RECORD_HEADER_LEN + RECORD_HEADER_LEN;
    bytes[record_1_payload] ^= 0x01;
    std::fs::write(&path, bytes).unwrap();
    assert_eq!(
        Wal::open(&dir, WalConfig::default()).unwrap_err().code(),
        ErrorCode::StoWalChecksum
    );
}

#[test]
fn damage_in_an_earlier_segment_refuses_to_start() {
    let dir = scratch("earlier");
    write_records(&dir, small(), 30);
    let first = segments(&dir).remove(0);
    let mut bytes = std::fs::read(&first).unwrap();
    let last = bytes.len() - 1;
    bytes[last] ^= 0xff;
    std::fs::write(&first, bytes).unwrap();
    assert_eq!(
        Wal::open(&dir, small()).unwrap_err().code(),
        ErrorCode::StoWalChecksum
    );
}

#[test]
fn a_missing_middle_segment_is_a_sequence_gap() {
    let dir = scratch("gap");
    write_records(&dir, small(), 30);
    let all = segments(&dir);
    std::fs::remove_file(&all[1]).unwrap();
    assert_eq!(
        Wal::open(&dir, small()).unwrap_err().code(),
        ErrorCode::StoWalSequenceGap
    );
}

#[test]
fn a_bad_segment_header_refuses_to_start() {
    let dir = scratch("header");
    write_records(&dir, WalConfig::default(), 2);
    let path = segments(&dir).pop().unwrap();
    let mut bytes = std::fs::read(&path).unwrap();
    bytes[18] = 1; // reserved byte must be zero
    std::fs::write(&path, bytes).unwrap();
    assert_eq!(
        Wal::open(&dir, WalConfig::default()).unwrap_err().code(),
        ErrorCode::StoWalChecksum
    );
}

#[test]
fn pruning_keeps_the_newest_segments_and_the_log_stays_readable() {
    let dir = scratch("prune");
    write_records(&dir, small(), 40);
    let before = segments(&dir).len();
    let (mut wal, _) = Wal::open(&dir, small()).unwrap();
    let checkpoint = wal.append(RecordType::Checkpoint, b"tip").unwrap();
    let removed = wal.prune_before(checkpoint).unwrap();
    assert!(
        removed > 0 && removed < before,
        "removed {removed} of {before}"
    );
    assert!(segments(&dir).len() >= 2);
    drop(wal);
    let (_, after) = Wal::open(&dir, small()).unwrap();
    assert_eq!(after.records.last().unwrap().sequence, checkpoint);
}
