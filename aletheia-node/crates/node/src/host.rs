//! What the host gives the node, for sizing its caches and pools (spec Section 46.4). Not
//! consensus: these only decide how much memory the node uses, never what it computes.

/// The memory the node may use: physical memory (`MemTotal` in `/proc/meminfo`), or the
/// limit of its control group if that is lower (a container, or systemd's `MemoryMax`).
/// Swap is not counted: a cache in swap is slower than no cache. `None` off Linux or if
/// nothing can be read.
pub fn memory_limit_bytes() -> Option<u64> {
    let physical = std::fs::read_to_string("/proc/meminfo")
        .ok()
        .and_then(|text| meminfo_total(&text));
    let cgroup = std::fs::read_to_string("/proc/self/cgroup")
        .ok()
        .and_then(|text| cgroup_limit(&text, &|path| std::fs::read_to_string(path).ok()));
    match (physical, cgroup) {
        (Some(p), Some(c)) => Some(p.min(c)),
        (p, c) => p.or(c),
    }
}

fn meminfo_total(text: &str) -> Option<u64> {
    let line = text.lines().find(|line| line.starts_with("MemTotal:"))?;
    let kib: u64 = line.split_whitespace().nth(1)?.parse().ok()?;
    kib.checked_mul(1024)
}

/// The memory limit of this process's control group, v2 (`memory.max`) or v1
/// (`memory.limit_in_bytes`); `None` when unlimited or unknown.
fn cgroup_limit(self_cgroup: &str, read: &dyn Fn(&str) -> Option<String>) -> Option<u64> {
    // v1 reports an unlimited group as a value near i64::MAX rounded to the page size.
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
            .and_then(|text| text.trim().parse::<u64>().ok())
            .filter(|limit| *limit < UNLIMITED_ABOVE)
        {
            return Some(limit);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meminfo_is_read_in_kib() {
        assert_eq!(
            meminfo_total("MemTotal:        2048000 kB\nMemFree: 1 kB\n"),
            Some(2_048_000 * 1024)
        );
        assert_eq!(meminfo_total("nothing here"), None);
    }

    #[test]
    fn cgroup_limits_are_found_in_v1_and_v2_and_unlimited_is_none() {
        let v2 = |path: &str| {
            (path == "/sys/fs/cgroup/node/memory.max").then(|| "268435456\n".to_owned())
        };
        assert_eq!(cgroup_limit("0::/node\n", &v2), Some(268_435_456));
        let v2_max = |_: &str| Some("max\n".to_owned());
        assert_eq!(cgroup_limit("0::/node\n", &v2_max), None);
        let v1 = |path: &str| {
            (path == "/sys/fs/cgroup/memory/box/memory.limit_in_bytes")
                .then(|| "536870912".to_owned())
        };
        assert_eq!(
            cgroup_limit("5:cpu,cpuacct:/box\n4:memory:/box\n", &v1),
            Some(536_870_912)
        );
        let v1_unlimited = |_: &str| Some("9223372036854771712".to_owned());
        assert_eq!(cgroup_limit("4:memory:/\n", &v1_unlimited), None);
    }
}
