//! Measures the environment before compiling or starting anything and returns one verdict.
//!
//! Every requirement below cites where its number comes from. Numbers measured by ACE on the
//! audited commit are estimates for that commit and that hardware; they are reported as such
//! and can be overridden in `ace.toml`.

use std::net::ToSocketAddrs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::Serialize;

use crate::host::{self, ComputeKind};
use crate::persistence::{self, Persistence};
use crate::settings::Deployment;

const MIB: u64 = 1024 * 1024;

/// `docs/operations/vps.md` section 1: "2 GB RAM or more for the build".
pub const BUILD_MEMORY_MIB: u64 = 2048;
/// Measured by ACE (docs/REPOSITORY_AUDIT.md): the release build of aletheiad,
/// aletheia-arno-exec and aletheia-cli peaked at 555 MB of target directory plus 160 MB of
/// Cargo registry. Doubled for headroom; `[build] min_free_disk_mb` is added on top.
pub const BUILD_DISK_ESTIMATE_MIB: u64 = 1500;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Verdict {
    // Ordered from best to worst: the overall verdict is the maximum.
    Ready,
    ReadyWithLimitations,
    UnknownRequiresMeasurement,
    PersistenceUnavailable,
    InsufficientResources,
    MissingDependency,
    UnsupportedRuntime,
}

impl Verdict {
    pub fn name(self) -> &'static str {
        match self {
            Verdict::Ready => "READY",
            Verdict::ReadyWithLimitations => "READY_WITH_LIMITATIONS",
            Verdict::UnknownRequiresMeasurement => "UNKNOWN_REQUIRES_MEASUREMENT",
            Verdict::PersistenceUnavailable => "PERSISTENCE_UNAVAILABLE",
            Verdict::InsufficientResources => "INSUFFICIENT_RESOURCES",
            Verdict::MissingDependency => "MISSING_DEPENDENCY",
            Verdict::UnsupportedRuntime => "UNSUPPORTED_RUNTIME",
        }
    }

    /// Whether work may proceed.
    pub fn permits(self) -> bool {
        matches!(self, Verdict::Ready | Verdict::ReadyWithLimitations)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Finding {
    pub check: &'static str,
    pub verdict: Verdict,
    pub detail: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stage {
    /// Fetch and compile.
    Build,
    /// Start the node from built binaries.
    Run,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreflightReport {
    pub verdict: Verdict,
    pub platform: host::Platform,
    pub compute: ComputeKind,
    pub cpus: usize,
    pub memory: host::Memory,
    pub disks: Vec<host::Disk>,
    pub seconds_remaining: Option<u64>,
    pub persistence: Persistence,
    pub findings: Vec<Finding>,
}

fn tool_version(program: &str, args: &[&str], dir: Option<&Path>) -> Option<String> {
    let mut command = Command::new(program);
    command.args(args);
    if let Some(dir) = dir {
        command.current_dir(dir);
    }
    let output = command.output().ok()?;
    output.status.success().then(|| {
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_owned()
    })
}

/// Where bindgen (used by librocksdb-sys) finds libclang: `LIBCLANG_PATH`, else the
/// distribution's LLVM directories.
fn find_libclang() -> Option<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::env::var_os("LIBCLANG_PATH")
        .map(PathBuf::from)
        .into_iter()
        .collect();
    if let Ok(entries) = std::fs::read_dir("/usr/lib") {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with("llvm-") {
                dirs.push(entry.path().join("lib"));
            }
        }
    }
    dirs.extend(
        [
            "/usr/lib/x86_64-linux-gnu",
            "/usr/lib/aarch64-linux-gnu",
            "/usr/lib64",
            "/usr/lib",
        ]
        .map(PathBuf::from),
    );
    dirs.into_iter().find_map(|dir| {
        std::fs::read_dir(&dir).ok()?.flatten().find_map(|e| {
            e.file_name()
                .to_string_lossy()
                .starts_with("libclang")
                .then(|| e.path())
                .filter(|p| p.to_string_lossy().contains(".so"))
        })
    })
}

/// Seconds left before the job must be finished, from `ACE_DEADLINE_EPOCH` (set by the
/// workflow from the job's start time and `timeout-minutes`; GitHub does not expose it).
pub fn seconds_remaining() -> Option<u64> {
    let deadline: u64 = std::env::var("ACE_DEADLINE_EPOCH").ok()?.parse().ok()?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();
    Some(deadline.saturating_sub(now))
}

fn reachable(url: &str) -> Result<(), String> {
    let host = url
        .strip_prefix("https://")
        .and_then(|r| r.split('/').next())
        .ok_or_else(|| format!("{url} is not an https URL"))?;
    let address = format!("{host}:443")
        .to_socket_addrs()
        .map_err(|e| format!("{host}: name resolution failed: {e}"))?
        .next()
        .ok_or_else(|| format!("{host}: no address"))?;
    std::net::TcpStream::connect_timeout(&address, Duration::from_secs(10))
        .map(|_| ())
        .map_err(|e| format!("{host}:443: {e}"))
}

pub fn run(deployment: &Deployment, stage: Stage, data_dir: Option<&Path>) -> PreflightReport {
    let config = &deployment.config;
    let mut findings = Vec::new();
    let mut add = |check: &'static str, verdict: Verdict, detail: String| {
        findings.push(Finding {
            check,
            verdict,
            detail,
        });
    };

    let platform = host::platform();
    let compute = host::compute_kind();
    match (platform.os, platform.arch) {
        ("linux", "x86_64" | "aarch64") => add(
            "platform",
            Verdict::Ready,
            format!("{} {}", platform.os, platform.arch),
        ),
        (os, arch) => add(
            "platform",
            Verdict::UnsupportedRuntime,
            format!(
                "{os} {arch}: StableChain validators and ACE support Linux on x86_64 and aarch64 only"
            ),
        ),
    }

    let memory = host::memory();
    let needed_mib = match stage {
        Stage::Build => BUILD_MEMORY_MIB,
        Stage::Run => config.limits.min_memory_mb,
    };
    match memory.usable_bytes {
        Some(bytes) if bytes / MIB >= needed_mib => add(
            "memory",
            Verdict::Ready,
            format!("{} MiB usable, {needed_mib} MiB required", bytes / MIB),
        ),
        Some(bytes) => add(
            "memory",
            Verdict::InsufficientResources,
            format!("{} MiB usable, {needed_mib} MiB required", bytes / MIB),
        ),
        None => add(
            "memory",
            Verdict::UnknownRequiresMeasurement,
            "memory could not be read from /proc".to_owned(),
        ),
    }

    let cpus = host::cpu_count();
    let mut disks = Vec::new();
    let mut check_disk =
        |check: &'static str,
         path: &Path,
         need_mib: u64,
         add: &mut dyn FnMut(&'static str, Verdict, String)| {
            match host::disk(path) {
                Some(disk) => {
                    let free = disk.free_bytes / MIB;
                    let verdict = if free >= need_mib {
                        Verdict::Ready
                    } else {
                        Verdict::InsufficientResources
                    };
                    add(
                        check,
                        verdict,
                        format!(
                            "{free} MiB free at {}, {need_mib} MiB required",
                            path.display()
                        ),
                    );
                    disks.push(disk);
                }
                None => add(
                    check,
                    Verdict::UnknownRequiresMeasurement,
                    format!("free space at {} could not be measured", path.display()),
                ),
            }
        };

    match stage {
        Stage::Build => {
            check_disk(
                "build-disk",
                &deployment.target_dir(),
                BUILD_DISK_ESTIMATE_MIB + config.build.min_free_disk_mb,
                &mut add,
            );
            for (program, args) in [
                ("git", vec!["--version"]),
                ("cargo", vec!["--version"]),
                ("rustup", vec!["--version"]),
            ] {
                match tool_version(program, &args, None) {
                    Some(v) => add("tool", Verdict::Ready, format!("{program}: {v}")),
                    None => add(
                        "tool",
                        Verdict::MissingDependency,
                        format!("{program} is not installed"),
                    ),
                }
            }
            let cxx = ["c++", "g++", "clang++"]
                .iter()
                .find_map(|c| tool_version(c, &["--version"], None).map(|v| format!("{c}: {v}")));
            match cxx {
                Some(v) => add("tool", Verdict::Ready, v),
                None => add(
                    "tool",
                    Verdict::MissingDependency,
                    "no C++ compiler: RocksDB (librocksdb-sys) is C++".to_owned(),
                ),
            }
            match find_libclang() {
                Some(p) => add("tool", Verdict::Ready, format!("libclang: {}", p.display())),
                None => add("tool", Verdict::MissingDependency, "libclang not found: librocksdb-sys generates its bindings with bindgen (install libclang-dev or set LIBCLANG_PATH)".to_owned()),
            }
            let workspace = deployment.workspace_dir();
            if workspace.join("rust-toolchain.toml").is_file() {
                match tool_version("rustc", &["--version"], Some(&workspace)) {
                    Some(v) => add("toolchain", Verdict::Ready, format!("{v} (selected by the workspace's rust-toolchain.toml)")),
                    None => add("toolchain", Verdict::MissingDependency, "the toolchain pinned by rust-toolchain.toml is not installed and could not be activated".to_owned()),
                }
            }
            match reachable(&config.source.repository) {
                Ok(()) => add(
                    "network",
                    Verdict::Ready,
                    format!("{} reachable", config.source.repository),
                ),
                Err(e) if deployment.workspace_dir().join("Cargo.lock").is_file() => add(
                    "network",
                    Verdict::ReadyWithLimitations,
                    format!(
                        "source host unreachable ({e}); an existing checkout will be used, crates must be cached"
                    ),
                ),
                Err(e) => add(
                    "network",
                    Verdict::MissingDependency,
                    format!("source host unreachable: {e}"),
                ),
            }
        }
        Stage::Run => {
            let data = data_dir
                .map(Path::to_path_buf)
                .unwrap_or_else(|| deployment.node_working_dir());
            check_disk("data-disk", &data, config.limits.min_free_disk_mb, &mut add);
            check_disk(
                "checkpoint-disk",
                &deployment.checkpoint_dir(),
                config.limits.max_snapshot_mb,
                &mut add,
            );
            for binary in &config.build.binaries {
                let path = deployment.output_dir().join(binary);
                if path.is_file() {
                    add("binary", Verdict::Ready, path.display().to_string());
                } else {
                    add(
                        "binary",
                        Verdict::MissingDependency,
                        format!("{} is missing; run ace build", path.display()),
                    );
                }
            }
        }
    }

    let remaining = seconds_remaining();
    match (remaining, stage) {
        (Some(left), Stage::Build) if left < 600 => add("time", Verdict::InsufficientResources, format!("{left} s left in the job; a build needs more")),
        (Some(left), Stage::Build) if left < config.build.max_duration_s => add("time", Verdict::ReadyWithLimitations, format!("{left} s left, less than [build] max_duration_s = {}", config.build.max_duration_s)),
        (Some(left), Stage::Run) if left < config.runtime.startup_timeout_s + config.runtime.shutdown_deadline_s => add("time", Verdict::InsufficientResources, format!("{left} s left: not enough to start and stop the node cleanly")),
        (Some(left), _) => add("time", Verdict::Ready, format!("{left} s left in the job")),
        (None, _) if compute == ComputeKind::GithubHostedRunner => add("time", Verdict::ReadyWithLimitations, "running in GitHub Actions without ACE_DEADLINE_EPOCH: the job's time limit is unknown to ACE".to_owned()),
        (None, _) => add("time", Verdict::Ready, "no execution deadline".to_owned()),
    }

    let data = data_dir
        .map(Path::to_path_buf)
        .unwrap_or_else(|| deployment.node_working_dir());
    let persistence = persistence::classify(config.persistence.mode, &data);
    match &persistence {
        Persistence::PersistenceUnavailable { reason } => add(
            "persistence",
            Verdict::PersistenceUnavailable,
            reason.clone(),
        ),
        Persistence::EphemeralMode { reason } => add(
            "persistence",
            Verdict::ReadyWithLimitations,
            format!("EPHEMERAL_MODE: {reason}"),
        ),
        Persistence::PersistentDeclared { filesystem } => add(
            "persistence",
            Verdict::Ready,
            format!(
                "declared persistent by the operator (filesystem {})",
                filesystem.as_deref().unwrap_or("unknown")
            ),
        ),
    }

    let verdict = findings
        .iter()
        .map(|f| f.verdict)
        .max()
        .unwrap_or(Verdict::UnknownRequiresMeasurement);
    PreflightReport {
        verdict,
        platform,
        compute,
        cpus,
        memory,
        disks,
        seconds_remaining: remaining,
        persistence,
        findings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_worst_finding_decides() {
        let all = [
            Verdict::Ready,
            Verdict::ReadyWithLimitations,
            Verdict::PersistenceUnavailable,
        ];
        assert_eq!(all.iter().max(), Some(&Verdict::PersistenceUnavailable));
        assert!(Verdict::ReadyWithLimitations.permits());
        assert!(!Verdict::UnknownRequiresMeasurement.permits());
        assert!(!Verdict::InsufficientResources.permits());
        assert!(Verdict::UnsupportedRuntime > Verdict::MissingDependency);
    }
}
