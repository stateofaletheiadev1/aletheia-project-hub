//! What the host offers: memory (physical or the control group's limit, as the node itself
//! computes it in `aletheia-node/crates/node/src/host.rs`), free disk, CPUs, architecture,
//! filesystem type, and whether this is a CI runner.

use std::path::Path;

use serde::Serialize;

const MIB: u64 = 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct Memory {
    pub physical_bytes: Option<u64>,
    pub available_bytes: Option<u64>,
    pub cgroup_limit_bytes: Option<u64>,
    /// What the node may use: the lower of physical memory and the cgroup limit.
    pub usable_bytes: Option<u64>,
    pub swap_bytes: Option<u64>,
}

fn meminfo_field(text: &str, field: &str) -> Option<u64> {
    let line = text.lines().find(|l| l.starts_with(field))?;
    let kib: u64 = line.split_whitespace().nth(1)?.parse().ok()?;
    kib.checked_mul(1024)
}

/// The memory limit of this process's control group (v2 `memory.max`, v1
/// `memory.limit_in_bytes`); `None` when unlimited or unreadable.
pub fn cgroup_limit(self_cgroup: &str, read: &dyn Fn(&str) -> Option<String>) -> Option<u64> {
    const UNLIMITED_ABOVE: u64 = 1 << 60;
    for line in self_cgroup.lines() {
        let mut parts = line.splitn(3, ':');
        let (_, controllers, path) = (parts.next()?, parts.next()?, parts.next()?);
        let file = if controllers.is_empty() {
            format!("/sys/fs/cgroup{path}/memory.max")
        } else if controllers.split(',').any(|c| c == "memory") {
            format!("/sys/fs/cgroup/memory{path}/memory.limit_in_bytes")
        } else {
            continue;
        };
        if let Some(limit) = read(&file)
            .and_then(|t| t.trim().parse::<u64>().ok())
            .filter(|l| *l < UNLIMITED_ABOVE)
        {
            return Some(limit);
        }
    }
    None
}

pub fn memory() -> Memory {
    let meminfo = std::fs::read_to_string("/proc/meminfo").unwrap_or_default();
    let physical = meminfo_field(&meminfo, "MemTotal:");
    let cgroup = std::fs::read_to_string("/proc/self/cgroup")
        .ok()
        .and_then(|t| cgroup_limit(&t, &|p| std::fs::read_to_string(p).ok()));
    let usable = match (physical, cgroup) {
        (Some(p), Some(c)) => Some(p.min(c)),
        (p, c) => p.or(c),
    };
    Memory {
        physical_bytes: physical,
        available_bytes: meminfo_field(&meminfo, "MemAvailable:"),
        cgroup_limit_bytes: cgroup,
        usable_bytes: usable,
        swap_bytes: meminfo_field(&meminfo, "SwapTotal:"),
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Disk {
    pub path: String,
    pub free_bytes: u64,
    pub total_bytes: u64,
    pub filesystem: Option<String>,
}

/// The nearest existing ancestor of `path` (a directory that will be created later is
/// measured on the filesystem it will be created on).
fn existing_ancestor(path: &Path) -> Option<&Path> {
    path.ancestors().find(|p| p.exists())
}

pub fn disk(path: &Path) -> Option<Disk> {
    let at = existing_ancestor(path)?;
    let stat = nix::sys::statvfs::statvfs(at).ok()?;
    let block = stat.fragment_size();
    let free = stat.blocks_available().saturating_mul(block);
    let total = stat.blocks().saturating_mul(block);
    Some(Disk {
        path: path.display().to_string(),
        free_bytes: free,
        total_bytes: total,
        filesystem: filesystem_type(at),
    })
}

pub fn free_mib(path: &Path) -> Option<u64> {
    disk(path).map(|d| d.free_bytes / MIB)
}

/// The filesystem type of the mount holding `path`, from `/proc/self/mountinfo`.
pub fn filesystem_type(path: &Path) -> Option<String> {
    let path = std::fs::canonicalize(path).ok()?;
    let mountinfo = std::fs::read_to_string("/proc/self/mountinfo").ok()?;
    mount_for(&mountinfo, &path.to_string_lossy())
}

/// The filesystem type of the longest mount point containing `path`.
pub fn mount_for(mountinfo: &str, path: &str) -> Option<String> {
    let mut best: Option<(usize, String)> = None;
    for line in mountinfo.lines() {
        let fields: Vec<&str> = line.split(' ').collect();
        let Some(mount_point) = fields.get(4) else {
            continue;
        };
        let Some(dash) = fields.iter().position(|f| *f == "-") else {
            continue;
        };
        let Some(fstype) = fields.get(dash + 1) else {
            continue;
        };
        let inside = *mount_point == "/"
            || path == *mount_point
            || path.starts_with(&format!("{mount_point}/"));
        if inside
            && best
                .as_ref()
                .is_none_or(|(len, _)| mount_point.len() >= *len)
        {
            best = Some((mount_point.len(), (*fstype).to_owned()));
        }
    }
    best.map(|(_, t)| t)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ComputeKind {
    /// A GitHub-hosted Actions runner: discarded when the job ends.
    GithubHostedRunner,
    /// A self-hosted Actions runner: lifetime unknown to ACE.
    GithubSelfHostedRunner,
    /// Any other host.
    Host,
}

pub fn compute_kind() -> ComputeKind {
    compute_kind_from(
        std::env::var("GITHUB_ACTIONS").ok().as_deref(),
        std::env::var("RUNNER_ENVIRONMENT").ok().as_deref(),
    )
}

pub fn compute_kind_from(actions: Option<&str>, environment: Option<&str>) -> ComputeKind {
    match (actions, environment) {
        (Some("true"), Some("self-hosted")) => ComputeKind::GithubSelfHostedRunner,
        // Hosted is the default when the variable is absent (older runners did not set it).
        (Some("true"), _) => ComputeKind::GithubHostedRunner,
        _ => ComputeKind::Host,
    }
}

pub fn cpu_count() -> usize {
    std::thread::available_parallelism().map_or(1, usize::from)
}

#[derive(Debug, Clone, Serialize)]
pub struct Platform {
    pub os: &'static str,
    pub arch: &'static str,
    pub distribution: Option<String>,
    pub kernel: Option<String>,
}

pub fn platform() -> Platform {
    let distribution = std::fs::read_to_string("/etc/os-release")
        .ok()
        .and_then(|t| {
            t.lines()
                .find_map(|l| l.strip_prefix("PRETTY_NAME="))
                .map(|v| v.trim_matches('"').to_owned())
        });
    let kernel = std::fs::read_to_string("/proc/sys/kernel/osrelease")
        .ok()
        .map(|t| t.trim().to_owned());
    Platform {
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        distribution,
        kernel,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_longest_mount_point_wins() {
        let mountinfo = "22 1 252:0 / / rw - ext4 /dev/vda rw\n\
                         30 22 0:30 / /tmp rw - tmpfs tmpfs rw\n\
                         31 22 0:31 / /tmpdata rw - xfs /dev/vdb rw\n";
        assert_eq!(mount_for(mountinfo, "/tmp/x").as_deref(), Some("tmpfs"));
        assert_eq!(mount_for(mountinfo, "/tmpdata/x").as_deref(), Some("xfs"));
        assert_eq!(mount_for(mountinfo, "/var/lib").as_deref(), Some("ext4"));
    }

    #[test]
    fn cgroup_v2_and_v1_limits_are_read() {
        let v2 = |p: &str| (p == "/sys/fs/cgroup/svc/memory.max").then(|| "268435456\n".to_owned());
        assert_eq!(cgroup_limit("0::/svc\n", &v2), Some(268_435_456));
        assert_eq!(cgroup_limit("0::/svc\n", &|_| Some("max".to_owned())), None);
        let v1 = |p: &str| {
            (p == "/sys/fs/cgroup/memory/box/memory.limit_in_bytes").then(|| "536870912".to_owned())
        };
        assert_eq!(cgroup_limit("4:memory:/box\n", &v1), Some(536_870_912));
    }

    #[test]
    fn runners_are_recognised() {
        assert_eq!(
            compute_kind_from(Some("true"), Some("github-hosted")),
            ComputeKind::GithubHostedRunner
        );
        assert_eq!(
            compute_kind_from(Some("true"), None),
            ComputeKind::GithubHostedRunner
        );
        assert_eq!(
            compute_kind_from(Some("true"), Some("self-hosted")),
            ComputeKind::GithubSelfHostedRunner
        );
        assert_eq!(compute_kind_from(None, None), ComputeKind::Host);
    }

    #[test]
    fn meminfo_fields_are_kib() {
        assert_eq!(meminfo_field("MemTotal: 2 kB\n", "MemTotal:"), Some(2048));
        assert_eq!(meminfo_field("", "MemTotal:"), None);
    }
}
