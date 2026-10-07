//! Append-only block archive (spec Section 42.3, ADR-007).
//!
//! ```text
//! blocks/seg-000000000123.blk   at most 256 MiB each, append-only, synced on finalize
//! Segment header (24 bytes): magic "ALBLK\0\1\0" | segment_seq u64 | format_version u16
//!                            | reserved u16 = 0 | header_crc32c u32
//! Record: u32 len | u32 crc32c(height || block_hash || frame) | u64 height | Hash32 block_hash
//!         | zstd_frame(ACE(Proposal))
//! ```
//!
//! Finalized blocks never change, so flat compressed segments beat an LSM: cheaper, simpler to
//! verify and to back up. The index (height -> location, hash -> height) lives in the
//! `BlockIndex` column family and is written in the same batch that finalizes the block;
//! [`index_entries`] builds those writes.
//!
//! Read path: read, verify the checksum, decompress with a size cap, decode, recompute the
//! block hash from the canonical bytes, compare. Compression is a storage artifact only; the
//! hash is over uncompressed ACE (42.2).
//!
//! Old segments are read forever and never rewritten (Section 44.5); a new format version
//! applies to new segments only. Trained zstd dictionaries (`dict-v1.zdict`) are not used yet:
//! frames are plain zstd until a devnet corpus exists to train on.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32, Height,
    NetworkIdentity, block::Proposal,
};

use crate::fsutil::{self, io_error};
use crate::kv::{ColumnFamily, WriteBatch};

pub const SEGMENT_MAGIC: &[u8; 8] = b"ALBLK\0\x01\0";
pub const FORMAT_VERSION: u16 = 1;
pub const SEGMENT_HEADER_LEN: usize = 24;
pub const RECORD_HEADER_LEN: usize = 48;
pub const DEFAULT_SEGMENT_BYTES: u64 = 256 * 1024 * 1024;
/// Decompression cap: a 4 MiB block (MAX_BLOCK_BYTES) plus header and certificates. A frame
/// claiming more is refused, so a damaged or hostile frame cannot exhaust memory.
pub const MAX_PROPOSAL_BYTES: usize = 5 * 1024 * 1024;
const ZSTD_LEVEL: i32 = 3;

const INDEX_BY_HEIGHT: u8 = b'h';
const INDEX_BY_HASH: u8 = b'b';

/// Where a block lives in the archive.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ArchiveLocation {
    pub segment: u64,
    pub offset: u64,
    /// Whole record length, header included.
    pub len: u32,
}

impl AceEncode for ArchiveLocation {
    fn encode(&self, out: &mut AceWriter) {
        out.u64(self.segment);
        out.u64(self.offset);
        out.u32(self.len);
    }
}

impl AceDecode for ArchiveLocation {
    fn decode(input: &mut AceReader<'_>) -> Result<ArchiveLocation, AletheiaError> {
        Ok(ArchiveLocation {
            segment: input.u64()?,
            offset: input.u64()?,
            len: input.u32()?,
        })
    }
}

/// `BlockIndex` key for a height. Big-endian so keys sort by height.
pub fn height_key(height: Height) -> [u8; 9] {
    let mut key = [0u8; 9];
    key[0] = INDEX_BY_HEIGHT;
    key[1..].copy_from_slice(&height.get().to_be_bytes());
    key
}

/// `BlockIndex` key for a block hash.
pub fn hash_key(hash: &Hash32) -> [u8; 33] {
    let mut key = [0u8; 33];
    key[0] = INDEX_BY_HASH;
    key[1..].copy_from_slice(hash.as_bytes());
    key
}

/// The index writes for an archived block, to go into the finalize batch.
pub fn index_entries(
    batch: &mut WriteBatch,
    height: Height,
    hash: &Hash32,
    location: ArchiveLocation,
) {
    batch.put(
        ColumnFamily::BlockIndex,
        &height_key(height),
        &location.to_ace_bytes(),
    );
    batch.put(
        ColumnFamily::BlockIndex,
        &hash_key(hash),
        &height.to_ace_bytes(),
    );
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ArchiveConfig {
    pub segment_bytes: u64,
}

impl Default for ArchiveConfig {
    fn default() -> ArchiveConfig {
        ArchiveConfig {
            segment_bytes: DEFAULT_SEGMENT_BYTES,
        }
    }
}

#[derive(Debug)]
pub struct BlockArchive {
    dir: PathBuf,
    network: NetworkIdentity,
    config: ArchiveConfig,
    segment_seq: u64,
    file: File,
    segment_len: u64,
    /// Height of the last record appended, if any.
    last_height: Option<Height>,
}

fn segment_path(dir: &Path, segment_seq: u64) -> PathBuf {
    dir.join(format!("seg-{segment_seq:012}.blk"))
}

fn corrupt(path: &Path, offset: u64, reason: &str) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoCorrupt,
        format!("archive {} at offset {offset}: {reason}", path.display()),
    )
}

fn segment_header(segment_seq: u64) -> [u8; SEGMENT_HEADER_LEN] {
    let mut header = [0u8; SEGMENT_HEADER_LEN];
    header[..8].copy_from_slice(SEGMENT_MAGIC);
    header[8..16].copy_from_slice(&segment_seq.to_le_bytes());
    header[16..18].copy_from_slice(&FORMAT_VERSION.to_le_bytes());
    let crc = crc32c::crc32c(&header[..20]);
    header[20..24].copy_from_slice(&crc.to_le_bytes());
    header
}

fn record_crc(height: u64, hash: &[u8], frame: &[u8]) -> u32 {
    let mut head = [0u8; 40];
    head[..8].copy_from_slice(&height.to_le_bytes());
    head[8..].copy_from_slice(hash);
    crc32c::crc32c_append(crc32c::crc32c(&head), frame)
}

/// A parsed record header.
struct RecordHeader {
    frame_len: usize,
    crc: u32,
    height: u64,
    hash: [u8; 32],
}

fn parse_record_header(bytes: &[u8]) -> Option<RecordHeader> {
    let mut reader = AceReader::new(bytes.get(..RECORD_HEADER_LEN)?);
    let frame_len = usize::try_from(reader.u32().ok()?).ok()?;
    Some(RecordHeader {
        frame_len,
        crc: reader.u32().ok()?,
        height: reader.u64().ok()?,
        hash: reader.array().ok()?,
    })
}

fn list_segments(dir: &Path) -> Result<Vec<u64>, AletheiaError> {
    let mut segments = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| io_error("list archive directory", dir, &e))? {
        let entry = entry.map_err(|e| io_error("list archive directory", dir, &e))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(number) = name
            .strip_prefix("seg-")
            .and_then(|n| n.strip_suffix(".blk"))
            && let Ok(seq) = number.parse::<u64>()
        {
            segments.push(seq);
        }
    }
    segments.sort_unstable();
    Ok(segments)
}

impl BlockArchive {
    /// Opens the archive, truncating a torn record at the tail of the last segment. Records
    /// beyond the finalized height recorded in `BlockIndex` are harmless: the index, not the
    /// archive, says what is final, and the next append for that height rewrites nothing.
    ///
    /// `finalized` is the index location of the last finalized block. A damaged record that
    /// ends at or before it is never treated as a torn write: truncating it would delete a
    /// finalized block, so it is corruption and the node refuses to start.
    pub fn open(
        dir: &Path,
        network: NetworkIdentity,
        config: ArchiveConfig,
        finalized: Option<ArchiveLocation>,
    ) -> Result<BlockArchive, AletheiaError> {
        fsutil::create_dir_all(dir)?;
        let segments = list_segments(dir)?;
        let Some(&segment_seq) = segments.last() else {
            let file = BlockArchive::create_segment(dir, 0)?;
            let segment_len = u64::try_from(SEGMENT_HEADER_LEN).unwrap_or(u64::MAX);
            return Ok(BlockArchive {
                dir: dir.to_path_buf(),
                network,
                config,
                segment_seq: 0,
                file,
                segment_len,
                last_height: None,
            });
        };
        let path = segment_path(dir, segment_seq);
        let bytes = fs::read(&path).map_err(|e| io_error("read archive segment", &path, &e))?;
        let header = bytes
            .get(..SEGMENT_HEADER_LEN)
            .ok_or_else(|| corrupt(&path, 0, "segment shorter than its header"))?;
        if header != segment_header(segment_seq) {
            return Err(corrupt(
                &path,
                0,
                "segment header is not a valid format-1 header for this segment",
            ));
        }

        let mut offset = SEGMENT_HEADER_LEN;
        let mut last_height = None;
        while let Some(rest) = bytes.get(offset..).filter(|rest| !rest.is_empty()) {
            let Some(record) = parse_record_header(rest) else {
                break;
            };
            let end = RECORD_HEADER_LEN.saturating_add(record.frame_len);
            let Some(frame) = rest.get(RECORD_HEADER_LEN..end) else {
                break;
            };
            if record_crc(record.height, &record.hash, frame) != record.crc {
                if end == rest.len() {
                    break; // torn final record
                }
                return Err(corrupt(
                    &path,
                    u64::try_from(offset).unwrap_or(u64::MAX),
                    "record checksum mismatch",
                ));
            }
            last_height = Some(Height::new(record.height));
            offset = offset.saturating_add(end);
        }
        let valid = u64::try_from(offset).unwrap_or(u64::MAX);
        if let Some(protected) = finalized.filter(|f| f.segment == segment_seq)
            && valid < protected.offset.saturating_add(u64::from(protected.len))
            && offset < bytes.len()
        {
            return Err(corrupt(
                &path,
                valid,
                "a finalized block's record is damaged; refusing to truncate it",
            ));
        }
        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .open(&path)
            .map_err(|e| io_error("open archive segment", &path, &e))?;
        if offset < bytes.len() {
            file.set_len(valid)
                .map_err(|e| io_error("truncate torn archive tail", &path, &e))?;
            file.sync_all()
                .map_err(|e| io_error("sync archive segment", &path, &e))?;
        }
        file.seek(SeekFrom::End(0))
            .map_err(|e| io_error("seek archive segment", &path, &e))?;
        if last_height.is_none() && segments.len() > 1 {
            last_height = BlockArchive::last_height_in(
                dir,
                segments
                    .get(segments.len().saturating_sub(2))
                    .copied()
                    .unwrap_or(0),
            )?;
        }
        Ok(BlockArchive {
            dir: dir.to_path_buf(),
            network,
            config,
            segment_seq,
            file,
            segment_len: valid,
            last_height,
        })
    }

    fn last_height_in(dir: &Path, segment_seq: u64) -> Result<Option<Height>, AletheiaError> {
        let path = segment_path(dir, segment_seq);
        let bytes = fs::read(&path).map_err(|e| io_error("read archive segment", &path, &e))?;
        let mut offset = SEGMENT_HEADER_LEN;
        let mut last = None;
        while let Some(record) = bytes.get(offset..).and_then(parse_record_header) {
            last = Some(Height::new(record.height));
            offset = offset
                .saturating_add(RECORD_HEADER_LEN)
                .saturating_add(record.frame_len);
        }
        Ok(last)
    }

    fn create_segment(dir: &Path, segment_seq: u64) -> Result<File, AletheiaError> {
        let path = segment_path(dir, segment_seq);
        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|e| io_error("create archive segment", &path, &e))?;
        file.write_all(&segment_header(segment_seq))
            .map_err(|e| io_error("write archive header", &path, &e))?;
        file.sync_all()
            .map_err(|e| io_error("sync archive header", &path, &e))?;
        fsutil::sync_dir(dir)?;
        Ok(file)
    }

    pub fn last_height(&self) -> Option<Height> {
        self.last_height
    }

    /// Appends the finalized block at the next height and syncs it. Returns its location for
    /// the index entries of the finalize batch.
    pub fn append(&mut self, proposal: &Proposal) -> Result<ArchiveLocation, AletheiaError> {
        let header = &proposal.block.header;
        let expected = match self.last_height {
            Some(last) => last.next()?,
            None => header.height,
        };
        if header.height != expected {
            return Err(AletheiaError::new(
                ErrorCode::FinalizeOutOfOrder,
                format!(
                    "archive append of height {} after {:?}; expected height {expected}",
                    header.height, self.last_height
                ),
            ));
        }
        let hash = header.block_hash(&self.network);
        let frame = zstd::bulk::compress(&proposal.to_ace_bytes(), ZSTD_LEVEL).map_err(|e| {
            AletheiaError::new(
                ErrorCode::StoIo,
                format!("compress block {}: {e}", header.height),
            )
        })?;
        let frame_len = u32::try_from(frame.len()).map_err(|_| {
            AletheiaError::new(
                ErrorCode::StoIo,
                format!("block {} frame exceeds 4 GiB", header.height),
            )
        })?;

        let mut record = Vec::with_capacity(RECORD_HEADER_LEN.saturating_add(frame.len()));
        record.extend_from_slice(&frame_len.to_le_bytes());
        record.extend_from_slice(
            &record_crc(header.height.get(), hash.as_bytes(), &frame).to_le_bytes(),
        );
        record.extend_from_slice(&header.height.get().to_le_bytes());
        record.extend_from_slice(hash.as_bytes());
        record.extend_from_slice(&frame);
        let record_len = u64::try_from(record.len()).unwrap_or(u64::MAX);

        if self.segment_len.saturating_add(record_len) > self.config.segment_bytes
            && self.segment_len > u64::try_from(SEGMENT_HEADER_LEN).unwrap_or(0)
        {
            let next = self.segment_seq.saturating_add(1);
            self.file = BlockArchive::create_segment(&self.dir, next)?;
            self.segment_seq = next;
            self.segment_len = u64::try_from(SEGMENT_HEADER_LEN).unwrap_or(u64::MAX);
        }

        let path = segment_path(&self.dir, self.segment_seq);
        let location = ArchiveLocation {
            segment: self.segment_seq,
            offset: self.segment_len,
            len: u32::try_from(record.len()).map_err(|_| {
                AletheiaError::new(ErrorCode::StoIo, "record exceeds 4 GiB".to_owned())
            })?,
        };
        self.file
            .write_all(&record)
            .map_err(|e| io_error("append archive record", &path, &e))?;
        self.file
            .sync_data()
            .map_err(|e| io_error("sync archive segment", &path, &e))?;
        self.segment_len = self.segment_len.saturating_add(record_len);
        self.last_height = Some(header.height);
        Ok(location)
    }

    /// Finds the record for `height` by scanning segments from the newest. Recovery only: a
    /// block appended just before a crash has no index entry yet (Section 24.3 step 7).
    pub fn find(&self, height: Height) -> Result<Option<ArchiveLocation>, AletheiaError> {
        for segment_seq in list_segments(&self.dir)?.into_iter().rev() {
            let path = segment_path(&self.dir, segment_seq);
            let bytes = fs::read(&path).map_err(|e| io_error("read archive segment", &path, &e))?;
            let mut offset = SEGMENT_HEADER_LEN;
            while let Some(record) = bytes.get(offset..).and_then(parse_record_header) {
                let len = RECORD_HEADER_LEN.saturating_add(record.frame_len);
                if record.height == height.get() {
                    return Ok(Some(ArchiveLocation {
                        segment: segment_seq,
                        offset: u64::try_from(offset).unwrap_or(u64::MAX),
                        len: u32::try_from(len).unwrap_or(u32::MAX),
                    }));
                }
                if record.height > height.get() && offset == SEGMENT_HEADER_LEN {
                    break; // this segment starts above the height; look in older ones
                }
                offset = offset.saturating_add(len);
            }
        }
        Ok(None)
    }

    /// Reads and fully verifies the block at `location`, which the caller got from the index
    /// for `expected_height`.
    pub fn read(
        &self,
        location: ArchiveLocation,
        expected_height: Height,
    ) -> Result<Proposal, AletheiaError> {
        let path = segment_path(&self.dir, location.segment);
        let mut file =
            File::open(&path).map_err(|e| io_error("open archive segment", &path, &e))?;
        file.seek(SeekFrom::Start(location.offset))
            .map_err(|e| io_error("seek archive segment", &path, &e))?;
        let mut record = vec![0u8; usize::try_from(location.len).unwrap_or(0)];
        file.read_exact(&mut record).map_err(|e| {
            if e.kind() == std::io::ErrorKind::UnexpectedEof {
                corrupt(
                    &path,
                    location.offset,
                    "the indexed record extends past the end of its segment",
                )
            } else {
                io_error("read archive record", &path, &e)
            }
        })?;

        let header = parse_record_header(&record)
            .ok_or_else(|| corrupt(&path, location.offset, "record header cut off"))?;
        let frame = record
            .get(RECORD_HEADER_LEN..RECORD_HEADER_LEN.saturating_add(header.frame_len))
            .filter(|frame| RECORD_HEADER_LEN.saturating_add(frame.len()) == record.len())
            .ok_or_else(|| {
                corrupt(
                    &path,
                    location.offset,
                    "record length disagrees with the index",
                )
            })?;
        if record_crc(header.height, &header.hash, frame) != header.crc {
            return Err(corrupt(&path, location.offset, "record checksum mismatch"));
        }
        if header.height != expected_height.get() {
            return Err(AletheiaError::new(
                ErrorCode::StoArchiveMismatch,
                format!(
                    "archive record at {}:{} holds height {}, index says {expected_height}",
                    path.display(),
                    location.offset,
                    header.height
                ),
            ));
        }
        let canonical = zstd::bulk::decompress(frame, MAX_PROPOSAL_BYTES).map_err(|e| {
            corrupt(
                &path,
                location.offset,
                &format!("zstd frame does not decompress within {MAX_PROPOSAL_BYTES} bytes: {e}"),
            )
        })?;
        let proposal = Proposal::from_ace_bytes(&canonical).map_err(|e| {
            corrupt(
                &path,
                location.offset,
                &format!("archived block is not canonical ACE: {}", e.detail()),
            )
        })?;
        let recomputed = proposal.block.header.block_hash(&self.network);
        if recomputed.as_bytes() != &header.hash || proposal.block.header.height != expected_height
        {
            return Err(AletheiaError::new(
                ErrorCode::StoArchiveMismatch,
                format!(
                    "archived block at height {expected_height} hashes to {recomputed}, recorded {}",
                    Hash32::from_bytes(header.hash)
                ),
            ));
        }
        Ok(proposal)
    }
}
