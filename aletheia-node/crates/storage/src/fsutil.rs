//! Durable file operations, isolated here so the fsync discipline lives in one place
//! (spec Sections 24.2, 44.5).
//!
//! Atomic replacement is: write a temp file, fsync it, rename over the target, fsync the
//! directory. A crash at any point leaves either the old file or the new one, never a mix.
//!
//! Checksummed files are `magic (8) | u32 payload_len | payload | u32 crc32c(magic || payload)`.

use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::Path;

use aletheia_core::{AletheiaError, ErrorCode};

pub(crate) fn io_error(action: &str, path: &Path, error: &std::io::Error) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoIo,
        format!("{action} {}: {error}", path.display()),
    )
}

pub(crate) fn create_dir_all(dir: &Path) -> Result<(), AletheiaError> {
    fs::create_dir_all(dir).map_err(|e| io_error("create directory", dir, &e))?;
    if let Some(parent) = dir.parent() {
        sync_dir(parent)?;
    }
    Ok(())
}

/// Makes a directory entry change (create, rename, delete) durable.
///
/// Linux needs an fsync on the directory itself. Windows offers no portable way to open a
/// directory for flushing from std, and NTFS journals metadata; validators run Linux only
/// (Section 3.1), so on other platforms this is a no-op.
pub(crate) fn sync_dir(dir: &Path) -> Result<(), AletheiaError> {
    #[cfg(unix)]
    {
        File::open(dir)
            .and_then(|handle| handle.sync_all())
            .map_err(|e| io_error("sync directory", dir, &e))?;
    }
    #[cfg(not(unix))]
    {
        let _ = dir;
    }
    Ok(())
}

pub(crate) fn write_atomically(path: &Path, contents: &[u8]) -> Result<(), AletheiaError> {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let temp = dir.join(format!(".{file_name}.tmp"));
    {
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&temp)
            .map_err(|e| io_error("create", &temp, &e))?;
        file.write_all(contents)
            .map_err(|e| io_error("write", &temp, &e))?;
        file.sync_all().map_err(|e| io_error("sync", &temp, &e))?;
    }
    fs::rename(&temp, path).map_err(|e| io_error("rename into place", path, &e))?;
    sync_dir(dir)
}

pub(crate) fn write_checksummed_atomically(
    path: &Path,
    magic: &[u8; 8],
    payload: &[u8],
) -> Result<(), AletheiaError> {
    let len = u32::try_from(payload.len()).map_err(|_| {
        AletheiaError::new(
            ErrorCode::StoIo,
            format!(
                "{} payload of {} bytes exceeds 4 GiB",
                path.display(),
                payload.len()
            ),
        )
    })?;
    let mut contents = Vec::with_capacity(payload.len().saturating_add(16));
    contents.extend_from_slice(magic);
    contents.extend_from_slice(&len.to_le_bytes());
    contents.extend_from_slice(payload);
    let crc = crc32c::crc32c_append(crc32c::crc32c(magic), payload);
    contents.extend_from_slice(&crc.to_le_bytes());
    write_atomically(path, &contents)
}

pub(crate) fn read_checksummed(path: &Path, magic: &[u8; 8]) -> Result<Vec<u8>, AletheiaError> {
    let contents = fs::read(path).map_err(|e| {
        let code = if e.kind() == std::io::ErrorKind::NotFound {
            ErrorCode::StoDataDirMissing
        } else {
            ErrorCode::StoIo
        };
        AletheiaError::new(code, format!("read {}: {e}", path.display()))
    })?;
    let corrupt = |reason: &str| {
        AletheiaError::new(
            ErrorCode::StoCorrupt,
            format!("{}: {reason}", path.display()),
        )
    };
    let (head, rest) = contents
        .split_at_checked(8)
        .ok_or_else(|| corrupt("shorter than its magic"))?;
    if head != magic {
        return Err(corrupt("wrong magic"));
    }
    let (len_bytes, rest) = rest
        .split_at_checked(4)
        .ok_or_else(|| corrupt("truncated length"))?;
    let len = u32::from_le_bytes(
        len_bytes
            .try_into()
            .map_err(|_| corrupt("truncated length"))?,
    );
    let len = usize::try_from(len).map_err(|_| corrupt("length exceeds address space"))?;
    let (payload, crc_bytes) = rest
        .split_at_checked(len)
        .ok_or_else(|| corrupt("truncated payload"))?;
    let stored: [u8; 4] = crc_bytes
        .try_into()
        .map_err(|_| corrupt("missing or extra bytes after payload"))?;
    if crc32c::crc32c_append(crc32c::crc32c(magic), payload) != u32::from_le_bytes(stored) {
        return Err(corrupt("checksum mismatch"));
    }
    Ok(payload.to_vec())
}

/// Opens (creating if needed) and exclusively locks `path` for the process lifetime. The lock
/// is released when the returned file is dropped or the process dies.
pub(crate) fn lock_exclusive(path: &Path) -> Result<File, AletheiaError> {
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)
        .map_err(|e| io_error("open lock file", path, &e))?;
    match file.try_lock() {
        Ok(()) => Ok(file),
        Err(fs::TryLockError::WouldBlock) => Err(AletheiaError::new(
            ErrorCode::StoDataDirLocked,
            format!(
                "{} is locked by another process; is aletheiad already running?",
                path.display()
            ),
        )),
        Err(fs::TryLockError::Error(e)) => Err(io_error("lock", path, &e)),
    }
}
