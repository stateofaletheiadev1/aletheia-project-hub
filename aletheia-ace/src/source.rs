//! Retrieves the pinned StableChain commit from GitLab and inspects the workspace it holds.
//!
//! Only a full commit is ever fetched (`git fetch --depth 1 origin <sha>`), and the checkout is
//! accepted only if `HEAD` is that commit and the tree is clean. A branch or tag can be
//! resolved for information (`ace inspect-source --resolve <ref>`), never built from.
//!
//! Credentials: when `ACE_GITLAB_TOKEN` is set (a read-only deploy token; `ACE_GITLAB_USER`
//! names its user), git receives it as an HTTP header through `GIT_CONFIG_*` environment
//! variables. It never appears in a URL, an argument (visible in process listings), a file,
//! or a log line.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::Serialize;

use crate::error::{AceError, Result};
use crate::oplog::{self, Category};
use crate::settings::{Deployment, is_full_commit};

const MARKER: &str = ".ace-checkout";

fn base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b = [
            chunk.first().copied().unwrap_or(0),
            chunk.get(1).copied().unwrap_or(0),
            chunk.get(2).copied().unwrap_or(0),
        ];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        for (i, shift) in [18u32, 12, 6, 0].iter().enumerate() {
            if i <= chunk.len() {
                let index = usize::try_from((n >> shift) & 63).unwrap_or(0);
                out.push(char::from(TABLE.get(index).copied().unwrap_or(b'A')));
            } else {
                out.push('=');
            }
        }
    }
    out
}

/// A git command with no prompts, no system or global configuration surprises, and the
/// deploy token (if any) passed as a header scoped to the repository's host.
fn git(repository: &str, dir: Option<&Path>) -> Command {
    let mut command = Command::new("git");
    if let Some(dir) = dir {
        command.current_dir(dir);
    }
    command.env("GIT_TERMINAL_PROMPT", "0");
    command.env("GIT_CONFIG_NOSYSTEM", "1");
    if let Ok(token) = std::env::var("ACE_GITLAB_TOKEN")
        && !token.is_empty()
    {
        let user = std::env::var("ACE_GITLAB_USER").unwrap_or_else(|_| "oauth2".to_owned());
        let host = repository
            .strip_prefix("https://")
            .and_then(|r| r.split('/').next())
            .unwrap_or("gitlab.com");
        command.env("GIT_CONFIG_COUNT", "1");
        command.env(
            "GIT_CONFIG_KEY_0",
            format!("http.https://{host}/.extraHeader"),
        );
        command.env(
            "GIT_CONFIG_VALUE_0",
            format!(
                "Authorization: Basic {}",
                base64(format!("{user}:{token}").as_bytes())
            ),
        );
    }
    command
}

fn run(mut command: Command, what: &str) -> Result<String> {
    let output = command
        .output()
        .map_err(|e| AceError::Source(format!("{what}: cannot run git: {e}")))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
    } else {
        Err(AceError::Source(format!(
            "{what} failed ({}): {}",
            output.status,
            oplog::redact(String::from_utf8_lossy(&output.stderr).trim())
        )))
    }
}

/// Runs a network operation up to three times: GitLab and the runner's network both drop
/// connections now and then; a missing commit fails the same way every time.
fn with_retries<T>(what: &str, mut attempt: impl FnMut() -> Result<T>) -> Result<T> {
    let mut delay = Duration::from_secs(2);
    let mut last = None;
    for round in 1..=3 {
        match attempt() {
            Ok(value) => return Ok(value),
            Err(error) => {
                oplog::warn(
                    Category::Source,
                    &format!("{what}: attempt {round} of 3 failed: {error}"),
                );
                last = Some(error);
                if round < 3 {
                    std::thread::sleep(delay);
                    delay = delay.saturating_mul(2);
                }
            }
        }
    }
    Err(last.unwrap_or_else(|| AceError::Source(format!("{what} failed"))))
}

/// The commit a branch or tag points to on the remote. Information only.
pub fn resolve_remote(repository: &str, reference: &str) -> Result<String> {
    if reference.starts_with('-') || reference.contains(char::is_whitespace) {
        return Err(AceError::Source(format!(
            "\"{reference}\" is not a git reference"
        )));
    }
    let output = with_retries("git ls-remote", || {
        let mut command = git(repository, None);
        command.args(["ls-remote", "--", repository, reference]);
        run(command, "git ls-remote")
    })?;
    let mut commits = output
        .lines()
        .filter_map(|l| l.split_whitespace().next())
        .filter(|c| is_full_commit(c));
    match (commits.next(), commits.next()) {
        (Some(commit), None) => Ok(commit.to_owned()),
        (None, _) => Err(AceError::Source(format!(
            "{reference} does not exist on {repository}"
        ))),
        (Some(_), Some(_)) => Err(AceError::Source(format!(
            "{reference} is ambiguous on {repository}; name it fully (refs/heads/… or refs/tags/…)"
        ))),
    }
}

fn head(dir: &Path, repository: &str) -> Result<String> {
    let mut command = git(repository, Some(dir));
    command.args(["rev-parse", "HEAD"]);
    run(command, "git rev-parse")
}

fn is_clean(dir: &Path, repository: &str) -> Result<bool> {
    let mut command = git(repository, Some(dir));
    command.args(["status", "--porcelain", "--untracked-files=no"]);
    Ok(run(command, "git status")?.is_empty())
}

/// Fetches the pinned commit into the checkout directory, or confirms an existing checkout.
pub fn fetch(deployment: &Deployment) -> Result<String> {
    let source = &deployment.config.source;
    let dir = deployment.checkout_dir();
    let commit = &source.commit;
    if dir.join(".git").exists() {
        if !dir.join(MARKER).exists() {
            return Err(AceError::Source(format!(
                "{} is a git checkout ACE did not create; refusing to change it (remove it or choose another checkout_dir)",
                dir.display()
            )));
        }
        if head(&dir, &source.repository)? == *commit && is_clean(&dir, &source.repository)? {
            oplog::info(
                Category::Source,
                &format!("checkout {} already at {commit}", dir.display()),
            );
            return Ok(commit.clone());
        }
        if !is_clean(&dir, &source.repository)? {
            return Err(AceError::Source(format!(
                "{} has local modifications; ACE builds only unmodified source",
                dir.display()
            )));
        }
    } else {
        if dir.exists()
            && std::fs::read_dir(&dir)
                .map(|mut d| d.next().is_some())
                .unwrap_or(true)
        {
            return Err(AceError::Source(format!(
                "{} exists and is not empty; refusing to fetch into it",
                dir.display()
            )));
        }
        std::fs::create_dir_all(&dir).map_err(|e| AceError::io("create", &dir, e))?;
        let mut init = git(&source.repository, Some(&dir));
        init.args(["init", "--quiet"]);
        run(init, "git init")?;
        let mut remote = git(&source.repository, Some(&dir));
        remote.args(["remote", "add", "origin", &source.repository]);
        run(remote, "git remote add")?;
        std::fs::write(
            dir.join(MARKER),
            "created by ACE; holds one pinned StableChain commit\n",
        )
        .map_err(|e| AceError::io("write", dir.join(MARKER), e))?;
        // Keep the marker out of `git status`.
        let exclude = dir.join(".git/info/exclude");
        std::fs::write(&exclude, format!("{MARKER}\n"))
            .map_err(|e| AceError::io("write", &exclude, e))?;
    }
    oplog::info(
        Category::Source,
        &format!("fetching {commit} from {}", source.repository),
    );
    with_retries("git fetch", || {
        let mut command = git(&source.repository, Some(&dir));
        command.args([
            "fetch",
            "--quiet",
            "--depth",
            "1",
            "--no-tags",
            "origin",
            commit,
        ]);
        run(command, "git fetch")
    })?;
    let mut checkout = git(&source.repository, Some(&dir));
    checkout.args(["checkout", "--quiet", "--detach", "--force", commit]);
    run(checkout, "git checkout")?;
    let actual = head(&dir, &source.repository)?;
    if actual != *commit {
        return Err(AceError::Source(format!(
            "after checkout HEAD is {actual}, not the pinned {commit}"
        )));
    }
    oplog::info(
        Category::Source,
        &format!("checkout {} verified at {actual}", dir.display()),
    );
    Ok(actual)
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceReport {
    pub workspace: PathBuf,
    pub commit: Option<String>,
    pub clean: Option<bool>,
    pub edition: Option<String>,
    pub rust_version: Option<String>,
    pub toolchain_channel: Option<String>,
    pub aletheiad_default_features: Vec<String>,
    pub aletheiad_features: Vec<String>,
    pub rocksdb_in_default_build: bool,
    pub librocksdb_sys: Option<String>,
    pub members_found: Vec<String>,
    pub members_missing: Vec<String>,
    pub problems: Vec<String>,
}

fn read_toml(path: &Path) -> Result<toml::Table> {
    let text = std::fs::read_to_string(path).map_err(|e| AceError::io("read", path, e))?;
    toml::from_str(&text).map_err(|e| AceError::Source(format!("{}: {e}", path.display())))
}

fn str_at<'a>(table: &'a toml::Table, path: &[&str]) -> Option<&'a str> {
    let (last, parents) = path.split_last()?;
    let mut current = table;
    for key in parents {
        current = current.get(*key)?.as_table()?;
    }
    current.get(*last)?.as_str()
}

/// The version of a package as `Cargo.lock` records it.
pub fn locked_version(lock: &str, package: &str) -> Option<String> {
    let mut lines = lock.lines();
    while let Some(line) = lines.next() {
        if line == format!("name = \"{package}\"") {
            return lines
                .next()?
                .strip_prefix("version = \"")?
                .strip_suffix('"')
                .map(str::to_owned);
        }
    }
    None
}

/// Reads the workspace manifests the build depends on. `packages` are the Cargo packages the
/// deployment builds; each must be a workspace member.
pub fn inspect_workspace(deployment: &Deployment) -> Result<WorkspaceReport> {
    let workspace = deployment.workspace_dir();
    let repository = &deployment.config.source.repository;
    let checkout = deployment.checkout_dir();
    let has_git = checkout.join(".git").exists();
    let manifest = read_toml(&workspace.join("Cargo.toml"))?;
    let toolchain = read_toml(&workspace.join("rust-toolchain.toml")).ok();
    let daemon = read_toml(&workspace.join("apps/aletheiad/Cargo.toml"))?;
    let lock = std::fs::read_to_string(workspace.join("Cargo.lock"))
        .map_err(|e| AceError::io("read", workspace.join("Cargo.lock"), e))?;

    let members: Vec<String> = manifest
        .get("workspace")
        .and_then(|w| w.get("members"))
        .and_then(toml::Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    // Package names are declared in each member's manifest.
    let mut package_names = Vec::new();
    for member in &members {
        if let Ok(member_manifest) = read_toml(&workspace.join(member).join("Cargo.toml"))
            && let Some(name) = str_at(&member_manifest, &["package", "name"])
        {
            package_names.push(name.to_owned());
        }
    }
    let (found, missing): (Vec<String>, Vec<String>) = deployment
        .config
        .build
        .packages
        .iter()
        .cloned()
        .partition(|p| package_names.contains(p));

    let features = daemon.get("features").and_then(toml::Value::as_table);
    let default_features: Vec<String> = features
        .and_then(|f| f.get("default"))
        .and_then(toml::Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    let all_features: Vec<String> = features
        .map(|f| f.keys().filter(|k| *k != "default").cloned().collect())
        .unwrap_or_default();

    let mut problems = Vec::new();
    if !missing.is_empty() {
        problems.push(format!(
            "packages not in the workspace: {}",
            missing.join(", ")
        ));
    }
    for feature in &deployment.config.build.features {
        let name = feature.strip_prefix("aletheiad/").unwrap_or(feature);
        if feature.starts_with("aletheiad/") && !all_features.iter().any(|f| f == name) {
            problems.push(format!("aletheiad has no feature \"{name}\""));
        }
    }
    let rocksdb = default_features.iter().any(|f| f == "rocksdb");
    if !rocksdb {
        problems.push(
            "aletheiad's default features do not include rocksdb: the build would keep state in memory (NON-PRODUCTION)".to_owned(),
        );
    }
    let (commit, clean) = if has_git {
        (
            head(&checkout, repository).ok(),
            is_clean(&checkout, repository).ok(),
        )
    } else {
        (None, None)
    };
    if let Some(commit) = &commit
        && *commit != deployment.config.source.commit
    {
        problems.push(format!(
            "checkout is at {commit}, the deployment pins {}",
            deployment.config.source.commit
        ));
    }
    Ok(WorkspaceReport {
        workspace,
        commit,
        clean,
        edition: str_at(&manifest, &["workspace", "package", "edition"]).map(str::to_owned),
        rust_version: str_at(&manifest, &["workspace", "package", "rust-version"])
            .map(str::to_owned),
        toolchain_channel: toolchain
            .as_ref()
            .and_then(|t| str_at(t, &["toolchain", "channel"]))
            .map(str::to_owned),
        aletheiad_default_features: default_features,
        aletheiad_features: all_features,
        rocksdb_in_default_build: rocksdb,
        librocksdb_sys: locked_version(&lock, "librocksdb-sys"),
        members_found: found,
        members_missing: missing,
        problems,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_matches_rfc4648() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"user:token"), "dXNlcjp0b2tlbg==");
    }

    #[test]
    fn locked_versions_are_read() {
        let lock =
            "[[package]]\nname = \"librocksdb-sys\"\nversion = \"0.17.3+10.4.2\"\nsource = \"x\"\n";
        assert_eq!(
            locked_version(lock, "librocksdb-sys").as_deref(),
            Some("0.17.3+10.4.2")
        );
        assert_eq!(locked_version(lock, "rocksdb"), None);
    }

    #[test]
    fn references_that_look_like_options_are_refused() {
        assert!(resolve_remote("https://gitlab.com/x.git", "--upload-pack=evil").is_err());
    }
}
