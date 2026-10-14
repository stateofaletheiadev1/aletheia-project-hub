//! Compiles the pinned StableChain workspace, collects the executables and records where
//! they came from. `verify` re-checks every recorded hash and that `aletheiad` behaves like
//! the daemon (exit 64 and its usage line without arguments) before anything runs it.
//!
//! The build runs under two watchdogs: wall time (`[build] max_duration_s`) and free disk on
//! the target directory's filesystem (`[build] min_free_disk_mb`). Either stops cargo and the
//! build fails visibly; nothing is deleted to make room.

use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{AceError, Result};
use crate::host;
use crate::nodecfg::{BuildFacts, sha256_hex};
use crate::oplog::{self, Category};
use crate::settings::Deployment;

pub const PROVENANCE_FILE: &str = "provenance.json";
pub const SUMS_FILE: &str = "SHA256SUMS";
pub const PROVENANCE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BinaryRecord {
    pub name: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provenance {
    pub provenance_version: u32,
    pub ace_version: String,
    pub ace_config_version: u32,
    pub ace_config_sha256: String,
    pub repository: String,
    pub reference: Option<String>,
    pub commit: String,
    pub rustc: String,
    pub cargo: String,
    pub os: String,
    pub arch: String,
    pub distribution: Option<String>,
    pub profile: String,
    pub packages: Vec<String>,
    pub features: Vec<String>,
    pub command: Vec<String>,
    pub librocksdb_sys: Option<String>,
    pub started_at: String,
    pub finished_at: String,
    pub seconds: u64,
    pub peak_target_dir_bytes: Option<u64>,
    pub result: String,
    pub failure: Option<String>,
    pub binaries: Vec<BinaryRecord>,
}

impl Provenance {
    pub fn facts(&self) -> BuildFacts {
        BuildFacts {
            devnet_producer: self
                .features
                .iter()
                .any(|f| f == "aletheiad/devnet-producer"),
        }
    }
}

/// `YYYY-MM-DDTHH:MM:SSZ` for a Unix time (UTC; days-from-civil inverse, Hinnant).
pub fn rfc3339(unix: u64) -> String {
    let days = i64::try_from(unix / 86_400).unwrap_or(0);
    let secs = unix % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        secs / 3600,
        (secs % 3600) / 60,
        secs % 60
    )
}

pub fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn sha256_file(path: &Path) -> Result<(String, u64)> {
    use sha2::Digest;
    let mut file = File::open(path).map_err(|e| AceError::io("open", path, e))?;
    let mut hasher = sha2::Sha256::new();
    let mut buffer = vec![0u8; 1 << 20];
    let mut size = 0u64;
    loop {
        let n = file
            .read(&mut buffer)
            .map_err(|e| AceError::io("read", path, e))?;
        if n == 0 {
            break;
        }
        hasher.update(buffer.get(..n).unwrap_or_default());
        size = size.saturating_add(u64::try_from(n).unwrap_or(0));
    }
    let digest = hasher.finalize();
    Ok((digest.iter().map(|b| format!("{b:02x}")).collect(), size))
}

/// Writes `bytes` to `path` through a temporary file and a rename, so a reader never sees a
/// half-written file.
pub fn write_atomically(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().unwrap_or(Path::new("."));
    std::fs::create_dir_all(parent).map_err(|e| AceError::io("create", parent, e))?;
    let temp = path.with_extension("tmp-ace");
    {
        let mut file = File::create(&temp).map_err(|e| AceError::io("create", &temp, e))?;
        file.write_all(bytes)
            .map_err(|e| AceError::io("write", &temp, e))?;
        file.sync_all()
            .map_err(|e| AceError::io("sync", &temp, e))?;
    }
    std::fs::rename(&temp, path).map_err(|e| AceError::io("rename", path, e))
}

fn first_line(program: &str, args: &[&str], dir: &Path) -> String {
    Command::new(program)
        .args(args)
        .current_dir(dir)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_owned()
        })
        .unwrap_or_else(|| "unknown".to_owned())
}

fn dir_size(path: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|e| match e.file_type() {
            Ok(t) if t.is_dir() => dir_size(&e.path()),
            Ok(t) if t.is_file() => e.metadata().map(|m| m.len()).unwrap_or(0),
            _ => 0,
        })
        .sum()
}

/// The cargo command line, as an argument vector (never a shell string).
pub fn cargo_args(deployment: &Deployment) -> Vec<String> {
    let build = &deployment.config.build;
    let mut args = vec!["build".to_owned(), "--locked".to_owned()];
    args.push("--profile".to_owned());
    args.push(build.profile.clone());
    for package in &build.packages {
        args.push("-p".to_owned());
        args.push(package.clone());
    }
    if !build.features.is_empty() {
        args.push("--features".to_owned());
        args.push(build.features.join(","));
    }
    args
}

fn profile_dir(profile: &str) -> &str {
    // Cargo puts the dev profile in target/debug; every other profile in target/<name>.
    if profile == "dev" { "debug" } else { profile }
}

pub fn build(deployment: &Deployment, log_path: &Path) -> Result<Provenance> {
    let config = &deployment.config;
    let workspace = deployment.workspace_dir();
    let target = deployment.target_dir();
    let output = deployment.output_dir();
    let args = cargo_args(deployment);
    let started = now_unix();
    let config_bytes =
        std::fs::read(&deployment.file).map_err(|e| AceError::io("read", &deployment.file, e))?;
    let lock = std::fs::read_to_string(workspace.join("Cargo.lock")).unwrap_or_default();
    let platform = host::platform();
    let mut provenance = Provenance {
        provenance_version: PROVENANCE_VERSION,
        ace_version: env!("CARGO_PKG_VERSION").to_owned(),
        ace_config_version: config.config_version,
        ace_config_sha256: sha256_hex(&config_bytes),
        repository: config.source.repository.clone(),
        reference: config.source.reference.clone(),
        commit: config.source.commit.clone(),
        rustc: first_line("rustc", &["--version"], &workspace),
        cargo: first_line("cargo", &["--version"], &workspace),
        os: platform.os.to_owned(),
        arch: platform.arch.to_owned(),
        distribution: platform.distribution,
        profile: config.build.profile.clone(),
        packages: config.build.packages.clone(),
        features: config.build.features.clone(),
        command: std::iter::once("cargo".to_owned())
            .chain(args.iter().cloned())
            .collect(),
        librocksdb_sys: crate::source::locked_version(&lock, "librocksdb-sys"),
        started_at: rfc3339(started),
        finished_at: String::new(),
        seconds: 0,
        peak_target_dir_bytes: None,
        result: "running".to_owned(),
        failure: None,
        binaries: Vec::new(),
    };
    oplog::info(
        Category::Build,
        &format!(
            "building commit {} with {} ({}) in {}",
            provenance.commit,
            provenance.rustc,
            provenance.command.join(" "),
            workspace.display()
        ),
    );
    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AceError::io("create", parent, e))?;
    }
    std::fs::create_dir_all(&target).map_err(|e| AceError::io("create", &target, e))?;
    let log = File::create(log_path).map_err(|e| AceError::io("create", log_path, e))?;
    let log_err = log
        .try_clone()
        .map_err(|e| AceError::io("open", log_path, e))?;
    let mut child = Command::new("cargo")
        .args(&args)
        .current_dir(&workspace)
        .env("CARGO_TARGET_DIR", &target)
        .env("CARGO_TERM_COLOR", "never")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err))
        .spawn()
        .map_err(|e| AceError::Build(format!("cannot start cargo: {e}")))?;

    let deadline = Instant::now() + Duration::from_secs(config.build.max_duration_s);
    let mut peak = 0u64;
    let mut last_size_check = Instant::now();
    let outcome: std::result::Result<(), String> = loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => break Ok(()),
            Ok(Some(status)) => {
                break Err(format!(
                    "cargo exited with {status}; see {}",
                    log_path.display()
                ));
            }
            Ok(None) => {}
            Err(e) => break Err(format!("waiting for cargo: {e}")),
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            break Err(format!(
                "stopped after [build] max_duration_s = {} s",
                config.build.max_duration_s
            ));
        }
        if let Some(free) = host::free_mib(&target)
            && free < config.build.min_free_disk_mb
        {
            let _ = child.kill();
            let _ = child.wait();
            break Err(format!(
                "stopped: {free} MiB free on the target directory's filesystem, below [build] min_free_disk_mb = {}",
                config.build.min_free_disk_mb
            ));
        }
        if last_size_check.elapsed() >= Duration::from_secs(30) {
            peak = peak.max(dir_size(&target));
            last_size_check = Instant::now();
        }
        std::thread::sleep(Duration::from_secs(2));
    };
    let finished = now_unix();
    provenance.finished_at = rfc3339(finished);
    provenance.seconds = finished.saturating_sub(started);
    provenance.peak_target_dir_bytes = Some(peak.max(dir_size(&target)));

    let collected = outcome.and_then(|()| {
        collect(
            deployment,
            &target.join(profile_dir(&config.build.profile)),
            &output,
        )
        .map_err(|e| e.to_string())
    });
    match collected {
        Ok(binaries) => {
            provenance.result = "success".to_owned();
            provenance.binaries = binaries;
        }
        Err(reason) => {
            provenance.result = "failure".to_owned();
            provenance.failure = Some(reason);
        }
    }
    let json =
        serde_json::to_vec_pretty(&provenance).map_err(|e| AceError::Other(e.to_string()))?;
    std::fs::create_dir_all(&output).map_err(|e| AceError::io("create", &output, e))?;
    write_atomically(&output.join(PROVENANCE_FILE), &json)?;
    if let Some(reason) = &provenance.failure {
        oplog::error(
            Category::Build,
            &format!("build failed after {} s: {reason}", provenance.seconds),
        );
        return Err(AceError::Build(reason.clone()));
    }
    let sums: String = provenance
        .binaries
        .iter()
        .map(|b| format!("{}  {}\n", b.sha256, b.name))
        .collect();
    write_atomically(&output.join(SUMS_FILE), sums.as_bytes())?;
    for b in &provenance.binaries {
        oplog::info(
            Category::Build,
            &format!("{} sha256={} size={}", b.name, b.sha256, b.size),
        );
    }
    oplog::info(
        Category::Build,
        &format!("build succeeded in {} s", provenance.seconds),
    );
    Ok(provenance)
}

/// Copies the configured executables out of the target directory and hashes them.
fn collect(deployment: &Deployment, from: &Path, to: &Path) -> Result<Vec<BinaryRecord>> {
    std::fs::create_dir_all(to).map_err(|e| AceError::io("create", to, e))?;
    let mut out = Vec::new();
    for name in &deployment.config.build.binaries {
        let source = from.join(name);
        if !source.is_file() {
            return Err(AceError::Build(format!(
                "cargo finished but {} is missing; is \"{name}\" built by the listed packages?",
                source.display()
            )));
        }
        let dest = to.join(name);
        let temp = to.join(format!(".{name}.tmp-ace"));
        std::fs::copy(&source, &temp).map_err(|e| AceError::io("copy", &source, e))?;
        std::fs::rename(&temp, &dest).map_err(|e| AceError::io("rename", &dest, e))?;
        let (sha256, size) = sha256_file(&dest)?;
        out.push(BinaryRecord {
            name: name.clone(),
            sha256,
            size,
        });
    }
    Ok(out)
}

pub fn load_provenance(output: &Path) -> Result<Provenance> {
    let path = output.join(PROVENANCE_FILE);
    let text = std::fs::read_to_string(&path).map_err(|e| AceError::io("read", &path, e))?;
    serde_json::from_str(&text).map_err(|e| AceError::Verify(format!("{}: {e}", path.display())))
}

#[derive(Debug, Clone, Serialize)]
pub struct VerifyReport {
    pub commit: String,
    pub binaries: Vec<BinaryRecord>,
    pub daemon_usage_check: String,
}

/// Re-hashes every recorded binary and checks that `aletheiad` is the daemon.
pub fn verify(deployment: &Deployment) -> Result<VerifyReport> {
    let output = deployment.output_dir();
    let provenance = load_provenance(&output)?;
    if provenance.result != "success" {
        return Err(AceError::Verify(format!(
            "the recorded build did not succeed: {}",
            provenance.failure.as_deref().unwrap_or("unknown")
        )));
    }
    if provenance.commit != deployment.config.source.commit {
        return Err(AceError::Verify(format!(
            "binaries were built from {}, the deployment pins {}",
            provenance.commit, deployment.config.source.commit
        )));
    }
    if provenance.features != deployment.config.build.features
        || provenance.profile != deployment.config.build.profile
    {
        return Err(AceError::Verify(format!(
            "binaries were built with profile {} and features [{}], the deployment asks for profile {} and [{}]",
            provenance.profile,
            provenance.features.join(","),
            deployment.config.build.profile,
            deployment.config.build.features.join(",")
        )));
    }
    for name in &deployment.config.build.binaries {
        let record = provenance
            .binaries
            .iter()
            .find(|b| &b.name == name)
            .ok_or_else(|| AceError::Verify(format!("{name} is not in the provenance record")))?;
        let path = output.join(name);
        let (sha256, size) = sha256_file(&path)?;
        if sha256 != record.sha256 || size != record.size {
            return Err(AceError::Verify(format!(
                "{} has sha256 {sha256} ({size} bytes); the build recorded {} ({} bytes)",
                path.display(),
                record.sha256,
                record.size
            )));
        }
        let mut magic = [0u8; 4];
        File::open(&path)
            .and_then(|mut f| f.read_exact(&mut magic))
            .map_err(|e| AceError::io("read", &path, e))?;
        if magic != *b"\x7fELF" {
            return Err(AceError::Verify(format!(
                "{} is not an ELF executable",
                path.display()
            )));
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path)
                .map_err(|e| AceError::io("stat", &path, e))?
                .permissions()
                .mode();
            if mode & 0o111 == 0 {
                return Err(AceError::Verify(format!(
                    "{} is not executable",
                    path.display()
                )));
            }
            if mode & 0o002 != 0 {
                return Err(AceError::Verify(format!(
                    "{} is writable by every user",
                    path.display()
                )));
            }
        }
    }
    // The daemon prints its usage and exits 64 without arguments (apps/aletheiad/src/main.rs).
    let daemon = deployment.daemon_path();
    let run = Command::new(&daemon)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| AceError::Verify(format!("cannot run {}: {e}", daemon.display())))?;
    let stderr = String::from_utf8_lossy(&run.stderr);
    if run.status.code() != Some(64) || !stderr.contains("usage: aletheiad --config") {
        return Err(AceError::Verify(format!(
            "{} without arguments exited {} instead of 64 with its usage line; it is not the expected daemon",
            daemon.display(),
            run.status
        )));
    }
    oplog::info(
        Category::Build,
        &format!(
            "verified {} binaries from commit {}",
            provenance.binaries.len(),
            provenance.commit
        ),
    );
    Ok(VerifyReport {
        commit: provenance.commit,
        binaries: provenance.binaries,
        daemon_usage_check: "exit 64 with usage line".to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamps_are_utc_rfc3339() {
        assert_eq!(rfc3339(0), "1970-01-01T00:00:00Z");
        assert_eq!(rfc3339(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(rfc3339(1_767_225_600), "2026-01-01T00:00:00Z");
        assert_eq!(rfc3339(1_792_000_000), "2026-10-14T17:46:40Z");
    }

    #[test]
    fn hashes_match_sha256sum() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("f");
        std::fs::write(&path, b"abc").unwrap();
        let (hash, size) = sha256_file(&path).unwrap();
        assert_eq!(
            hash,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(size, 3);
    }

    #[test]
    fn atomic_writes_leave_no_temporary_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x.json");
        write_atomically(&path, b"1").unwrap();
        write_atomically(&path, b"2").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"2");
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
