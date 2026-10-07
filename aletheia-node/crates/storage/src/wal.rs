//! Consensus write-ahead log (spec Section 24, APS-0034).
//!
//! ```text
//! wal/000000000042.wal   segments, rotated at 64 MiB
//! Segment header (24 bytes): magic "ALWAL\0\1\0" | segment_seq u64
//!                            | created_protocol_version u16 | reserved u16 = 0 | header_crc32c u32
//! Record: u32 length | u32 crc32c(type || seq || payload) | u8 type | u64 seq | payload
//! ```
//!
//! The protocol-version slot is `u16` plus two reserved zero bytes (ADR-038), which keeps the
//! 4-byte layout Section 24.1 drew.
//!
//! Durability (Section 24.2): `SafetyData`, `FinalizeBegin` and `FinalizeCommitted` are synced
//! to disk before [`Wal::append`] returns, so a vote is never sent and a finalize batch never
//! committed ahead of its record. Other records are written immediately and made durable by
//! the next synced record or by [`Wal::sync`], which the node calls at least every 10 ms.
//!
//! Recovery (Section 24.3 steps 2-3): every segment header and record checksum is verified and
//! sequence numbers must be strictly consecutive across segments. A torn write - a record cut
//! off or zero-filled at the very end of the last segment - is truncated away. Any other
//! damage is corruption and the node refuses to start.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use aletheia_core::{AletheiaError, ErrorCode, ProtocolVersion};

use crate::fsutil::{self, io_error};

pub const SEGMENT_MAGIC: &[u8; 8] = b"ALWAL\0\x01\0";
pub const SEGMENT_HEADER_LEN: usize = 24;
pub const RECORD_HEADER_LEN: usize = 17;
pub const DEFAULT_SEGMENT_BYTES: u64 = 64 * 1024 * 1024;
/// Largest payload: a 4 MiB block proposal plus certificates, with headroom.
pub const MAX_PAYLOAD_BYTES: u32 = 8 * 1024 * 1024;
/// Segments kept even when older than the last checkpoint (Section 24.2: retain >= 2).
pub const MIN_RETAINED_SEGMENTS: usize = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum RecordType {
    SafetyData,
    ProposalReceived,
    BlockExecuted,
    QuorumCertificate,
    TimeoutCertificate,
    FinalizeBegin,
    FinalizeCommitted,
    Evidence,
    Checkpoint,
}

impl RecordType {
    pub const fn code(self) -> u8 {
        match self {
            RecordType::SafetyData => 1,
            RecordType::ProposalReceived => 2,
            RecordType::BlockExecuted => 3,
            RecordType::QuorumCertificate => 4,
            RecordType::TimeoutCertificate => 5,
            RecordType::FinalizeBegin => 6,
            RecordType::FinalizeCommitted => 7,
            RecordType::Evidence => 8,
            RecordType::Checkpoint => 9,
        }
    }

    pub fn from_code(code: u8) -> Option<RecordType> {
        [
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
        .find(|kind| kind.code() == code)
    }

    /// Records that must be on disk before the action that depends on them (Section 24.2).
    pub const fn syncs_immediately(self) -> bool {
        matches!(
            self,
            RecordType::SafetyData | RecordType::FinalizeBegin | RecordType::FinalizeCommitted
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WalRecord {
    pub sequence: u64,
    pub kind: RecordType,
    pub payload: Vec<u8>,
}

/// What [`Wal::open`] found and did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WalRecovery {
    pub records: Vec<WalRecord>,
    /// Bytes cut from the tail of the last segment as a torn write, if any.
    pub truncated_tail_bytes: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WalConfig {
    pub segment_bytes: u64,
    /// Written into the header of segments this binary creates.
    pub protocol_version: ProtocolVersion,
}

impl Default for WalConfig {
    fn default() -> WalConfig {
        WalConfig {
            segment_bytes: DEFAULT_SEGMENT_BYTES,
            protocol_version: ProtocolVersion::new(1),
        }
    }
}

#[derive(Debug)]
pub struct Wal {
    dir: PathBuf,
    config: WalConfig,
    segment_seq: u64,
    file: File,
    segment_len: u64,
    next_sequence: u64,
    unsynced: bool,
}

fn segment_path(dir: &Path, segment_seq: u64) -> PathBuf {
    dir.join(format!("{segment_seq:012}.wal"))
}

fn record_crc(kind: u8, sequence: u64, payload: &[u8]) -> u32 {
    let mut head = [0u8; 9];
    head[0] = kind;
    head[1..].copy_from_slice(&sequence.to_le_bytes());
    crc32c::crc32c_append(crc32c::crc32c(&head), payload)
}

fn segment_header(segment_seq: u64, version: ProtocolVersion) -> [u8; SEGMENT_HEADER_LEN] {
    let mut header = [0u8; SEGMENT_HEADER_LEN];
    header[..8].copy_from_slice(SEGMENT_MAGIC);
    header[8..16].copy_from_slice(&segment_seq.to_le_bytes());
    header[16..18].copy_from_slice(&version.get().to_le_bytes());
    // 18..20 reserved, zero
    let crc = crc32c::crc32c(&header[..20]);
    header[20..24].copy_from_slice(&crc.to_le_bytes());
    header
}

fn corrupt(path: &Path, offset: usize, reason: &str) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoWalChecksum,
        format!(
            "WAL {} at offset {offset}: {reason}; refusing to start (see docs/operations/recovery.md)",
            path.display()
        ),
    )
}

fn le_u32(bytes: &[u8], at: usize) -> Option<u32> {
    bytes
        .get(at..at.checked_add(4)?)
        .and_then(|s| s.try_into().ok())
        .map(u32::from_le_bytes)
}

fn le_u64(bytes: &[u8], at: usize) -> Option<u64> {
    bytes
        .get(at..at.checked_add(8)?)
        .and_then(|s| s.try_into().ok())
        .map(u64::from_le_bytes)
}

fn check_header(path: &Path, bytes: &[u8], expected_seq: u64) -> Result<(), AletheiaError> {
    let header = bytes
        .get(..SEGMENT_HEADER_LEN)
        .ok_or_else(|| corrupt(path, 0, "segment shorter than its header"))?;
    if header.get(..8) != Some(&SEGMENT_MAGIC[..]) {
        return Err(corrupt(path, 0, "wrong segment magic"));
    }
    if le_u32(header, 20) != Some(crc32c::crc32c(header.get(..20).unwrap_or_default())) {
        return Err(corrupt(path, 0, "segment header checksum mismatch"));
    }
    if le_u64(header, 8) != Some(expected_seq) {
        return Err(corrupt(
            path,
            8,
            "segment number in header does not match file name",
        ));
    }
    if header.get(18..20) != Some(&[0, 0][..]) {
        return Err(corrupt(path, 18, "reserved header bytes are not zero"));
    }
    Ok(())
}

/// Outcome of scanning one segment's records.
struct SegmentScan {
    records: Vec<WalRecord>,
    /// Offset just past the last intact record.
    valid_len: usize,
}

/// Scans records. In the last segment a damaged final record is a torn write and scanning
/// stops there; anywhere else damage is corruption.
fn scan_segment(
    path: &Path,
    bytes: &[u8],
    is_last: bool,
    next_sequence: &mut Option<u64>,
) -> Result<SegmentScan, AletheiaError> {
    let mut records = Vec::new();
    let mut offset = SEGMENT_HEADER_LEN;
    while offset < bytes.len() {
        let rest = bytes.get(offset..).unwrap_or_default();
        let torn = |reason: &str| -> Result<SegmentScan, AletheiaError> {
            if is_last {
                Ok(SegmentScan {
                    records: Vec::new(),
                    valid_len: offset,
                })
            } else {
                Err(corrupt(path, offset, reason))
            }
        };
        if rest.iter().all(|&b| b == 0) {
            // Zero-filled tail: the file was extended but the record never landed.
            let scan = torn("zero-filled region inside a non-final segment")?;
            return Ok(SegmentScan {
                records,
                valid_len: scan.valid_len,
            });
        }
        let (Some(len), Some(stored_crc), Some(&kind_code), Some(sequence)) = (
            le_u32(rest, 0),
            le_u32(rest, 4),
            rest.get(8),
            le_u64(rest, 9),
        ) else {
            let scan = torn("record header cut off")?;
            return Ok(SegmentScan {
                records,
                valid_len: scan.valid_len,
            });
        };
        if len > MAX_PAYLOAD_BYTES {
            return Err(corrupt(
                path,
                offset,
                &format!("record length {len} exceeds {MAX_PAYLOAD_BYTES}"),
            ));
        }
        let payload_len = usize::try_from(len)
            .map_err(|_| corrupt(path, offset, "length exceeds address space"))?;
        let end = RECORD_HEADER_LEN.saturating_add(payload_len);
        let Some(payload) = rest.get(RECORD_HEADER_LEN..end) else {
            let scan = torn("record payload cut off")?;
            return Ok(SegmentScan {
                records,
                valid_len: scan.valid_len,
            });
        };
        if record_crc(kind_code, sequence, payload) != stored_crc {
            // A bad checksum on the final record of the last segment is a torn write; with
            // intact-looking data after it, it is corruption.
            if is_last && end == rest.len() {
                return Ok(SegmentScan {
                    records,
                    valid_len: offset,
                });
            }
            return Err(corrupt(path, offset, "record checksum mismatch"));
        }
        let kind = RecordType::from_code(kind_code)
            .ok_or_else(|| corrupt(path, offset, &format!("unknown record type {kind_code}")))?;
        if let Some(expected) = *next_sequence
            && sequence != expected
        {
            return Err(AletheiaError::new(
                ErrorCode::StoWalSequenceGap,
                format!(
                    "WAL {} at offset {offset}: sequence {sequence}, expected {expected}",
                    path.display()
                ),
            ));
        }
        *next_sequence = sequence.checked_add(1);
        records.push(WalRecord {
            sequence,
            kind,
            payload: payload.to_vec(),
        });
        offset = offset.saturating_add(end);
    }
    Ok(SegmentScan {
        records,
        valid_len: offset,
    })
}

fn list_segments(dir: &Path) -> Result<Vec<u64>, AletheiaError> {
    let mut segments = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| io_error("list WAL directory", dir, &e))? {
        let entry = entry.map_err(|e| io_error("list WAL directory", dir, &e))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(number) = name.strip_suffix(".wal")
            && number.len() == 12
            && let Ok(seq) = number.parse::<u64>()
        {
            segments.push(seq);
        }
    }
    segments.sort_unstable();
    Ok(segments)
}

impl Wal {
    /// Opens (or creates) the WAL in `dir`, verifies it, truncates a torn tail and returns every
    /// intact record for recovery.
    pub fn open(dir: &Path, config: WalConfig) -> Result<(Wal, WalRecovery), AletheiaError> {
        fsutil::create_dir_all(dir)?;
        let segments = list_segments(dir)?;
        for pair in segments.windows(2) {
            if let [a, b] = pair
                && a.checked_add(1) != Some(*b)
            {
                return Err(AletheiaError::new(
                    ErrorCode::StoWalSequenceGap,
                    format!(
                        "WAL segments jump from {a:012} to {b:012} in {}",
                        dir.display()
                    ),
                ));
            }
        }

        let mut records = Vec::new();
        let mut next_sequence: Option<u64> = None;
        let mut truncated_tail_bytes = 0;
        for (index, &segment_seq) in segments.iter().enumerate() {
            let path = segment_path(dir, segment_seq);
            let bytes = fs::read(&path).map_err(|e| io_error("read WAL segment", &path, &e))?;
            let is_last = index.saturating_add(1) == segments.len();
            if is_last && bytes.len() < SEGMENT_HEADER_LEN {
                // Created but its header never fully landed: the whole file is a torn write.
                fs::remove_file(&path)
                    .map_err(|e| io_error("remove torn WAL segment", &path, &e))?;
                truncated_tail_bytes = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
                continue;
            }
            check_header(&path, &bytes, segment_seq)?;
            let scan = scan_segment(&path, &bytes, is_last, &mut next_sequence)?;
            if scan.valid_len < bytes.len() {
                let file = OpenOptions::new()
                    .write(true)
                    .open(&path)
                    .map_err(|e| io_error("open WAL segment", &path, &e))?;
                let valid = u64::try_from(scan.valid_len).unwrap_or(u64::MAX);
                file.set_len(valid)
                    .map_err(|e| io_error("truncate torn WAL tail", &path, &e))?;
                file.sync_all()
                    .map_err(|e| io_error("sync WAL segment", &path, &e))?;
                truncated_tail_bytes =
                    u64::try_from(bytes.len().saturating_sub(scan.valid_len)).unwrap_or(u64::MAX);
            }
            records.extend(scan.records);
        }

        let next_sequence = next_sequence.unwrap_or(0);
        let surviving = list_segments(dir)?;
        let wal = match surviving.last() {
            Some(&segment_seq) => {
                let path = segment_path(dir, segment_seq);
                let mut file = OpenOptions::new()
                    .read(true)
                    .append(true)
                    .open(&path)
                    .map_err(|e| io_error("open WAL segment", &path, &e))?;
                let segment_len = file
                    .seek(SeekFrom::End(0))
                    .map_err(|e| io_error("seek WAL segment", &path, &e))?;
                Wal {
                    dir: dir.to_path_buf(),
                    config,
                    segment_seq,
                    file,
                    segment_len,
                    next_sequence,
                    unsynced: false,
                }
            }
            None => {
                // Reuse the number of a torn segment that was removed, so names stay consecutive.
                let start = segments.last().copied().unwrap_or(0);
                let (file, segment_len) = Wal::create_segment(dir, start, config.protocol_version)?;
                Wal {
                    dir: dir.to_path_buf(),
                    config,
                    segment_seq: start,
                    file,
                    segment_len,
                    next_sequence,
                    unsynced: false,
                }
            }
        };
        Ok((
            wal,
            WalRecovery {
                records,
                truncated_tail_bytes,
            },
        ))
    }

    fn create_segment(
        dir: &Path,
        segment_seq: u64,
        version: ProtocolVersion,
    ) -> Result<(File, u64), AletheiaError> {
        let path = segment_path(dir, segment_seq);
        let mut file = OpenOptions::new()
            .read(true)
            .append(true)
            .create_new(true)
            .open(&path)
            .map_err(|e| io_error("create WAL segment", &path, &e))?;
        file.write_all(&segment_header(segment_seq, version))
            .map_err(|e| io_error("write WAL header", &path, &e))?;
        file.sync_all()
            .map_err(|e| io_error("sync WAL header", &path, &e))?;
        fsutil::sync_dir(dir)?;
        Ok((file, u64::try_from(SEGMENT_HEADER_LEN).unwrap_or(u64::MAX)))
    }

    /// The sequence number the next record will get.
    pub fn next_sequence(&self) -> u64 {
        self.next_sequence
    }

    /// Appends a record. Safety and finalize records are durable when this returns Ok.
    pub fn append(&mut self, kind: RecordType, payload: &[u8]) -> Result<u64, AletheiaError> {
        let len = u32::try_from(payload.len())
            .ok()
            .filter(|&len| len <= MAX_PAYLOAD_BYTES)
            .ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::StoIo,
                    format!(
                        "WAL record of {} bytes exceeds {MAX_PAYLOAD_BYTES}",
                        payload.len()
                    ),
                )
            })?;
        let record_len =
            u64::try_from(RECORD_HEADER_LEN.saturating_add(payload.len())).unwrap_or(u64::MAX);
        if self.segment_len.saturating_add(record_len) > self.config.segment_bytes
            && self.segment_len > u64::try_from(SEGMENT_HEADER_LEN).unwrap_or(0)
        {
            self.rotate()?;
        }

        let sequence = self.next_sequence;
        let mut record = Vec::with_capacity(RECORD_HEADER_LEN.saturating_add(payload.len()));
        record.extend_from_slice(&len.to_le_bytes());
        record.extend_from_slice(&record_crc(kind.code(), sequence, payload).to_le_bytes());
        record.push(kind.code());
        record.extend_from_slice(&sequence.to_le_bytes());
        record.extend_from_slice(payload);

        let path = segment_path(&self.dir, self.segment_seq);
        self.file
            .write_all(&record)
            .map_err(|e| io_error("append WAL record", &path, &e))?;
        self.segment_len = self.segment_len.saturating_add(record_len);
        self.next_sequence = sequence.checked_add(1).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::ArithmeticOverflow,
                "WAL sequence exhausted".to_owned(),
            )
        })?;
        self.unsynced = true;
        if kind.syncs_immediately() {
            self.sync()?;
        }
        Ok(sequence)
    }

    /// Makes every appended record durable (group commit).
    pub fn sync(&mut self) -> Result<(), AletheiaError> {
        if self.unsynced {
            let path = segment_path(&self.dir, self.segment_seq);
            self.file
                .sync_data()
                .map_err(|e| io_error("sync WAL segment", &path, &e))?;
            self.unsynced = false;
        }
        Ok(())
    }

    fn rotate(&mut self) -> Result<(), AletheiaError> {
        self.sync()?;
        let next = self.segment_seq.checked_add(1).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::ArithmeticOverflow,
                "WAL segment number exhausted".to_owned(),
            )
        })?;
        let (file, segment_len) =
            Wal::create_segment(&self.dir, next, self.config.protocol_version)?;
        self.file = file;
        self.segment_len = segment_len;
        self.segment_seq = next;
        Ok(())
    }

    /// Deletes whole segments whose records all precede `checkpoint_sequence`, keeping at
    /// least [`MIN_RETAINED_SEGMENTS`]. The caller passes the sequence of a `Checkpoint`
    /// record whose finalized height is already durable in the state database.
    pub fn prune_before(&mut self, checkpoint_sequence: u64) -> Result<usize, AletheiaError> {
        let segments = list_segments(&self.dir)?;
        let mut removable = Vec::new();
        for pair in segments.windows(2) {
            if let [current, next] = pair {
                // A segment's records all precede the first record of the following segment.
                let next_path = segment_path(&self.dir, *next);
                if first_sequence(&next_path)?.is_some_and(|first| first <= checkpoint_sequence) {
                    removable.push(*current);
                }
            }
        }
        let keep_from = segments.len().saturating_sub(MIN_RETAINED_SEGMENTS);
        let removable: Vec<u64> = removable
            .into_iter()
            .filter(|seq| segments.iter().position(|s| s == seq) < Some(keep_from))
            .collect();
        for segment_seq in &removable {
            let path = segment_path(&self.dir, *segment_seq);
            fs::remove_file(&path).map_err(|e| io_error("remove WAL segment", &path, &e))?;
        }
        if !removable.is_empty() {
            fsutil::sync_dir(&self.dir)?;
        }
        Ok(removable.len())
    }
}

fn first_sequence(path: &Path) -> Result<Option<u64>, AletheiaError> {
    let mut header = [0u8; SEGMENT_HEADER_LEN + RECORD_HEADER_LEN];
    let mut file = File::open(path).map_err(|e| io_error("open WAL segment", path, &e))?;
    match file.read_exact(&mut header) {
        Ok(()) => Ok(le_u64(&header, SEGMENT_HEADER_LEN + 9)),
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => Ok(None),
        Err(e) => Err(io_error("read WAL segment", path, &e)),
    }
}
