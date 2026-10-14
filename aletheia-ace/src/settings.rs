//! The ACE deployment configuration (`ace.toml`), parsed strictly: unknown keys are errors,
//! limits are range-checked, and nothing about the node (ports, network, paths) has a default
//! that could silently stand in for the node's own configuration.
//!
//! Paths are relative to the directory holding `ace.toml`. A path starting with `@source/` is
//! inside the StableChain workspace checkout (`[source] checkout_dir` + `workspace`), so a
//! deployment can use the repository's own configuration and genesis files unchanged.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AceError, Result};

/// The only configuration format this ACE release reads.
pub const CONFIG_VERSION: u32 = 1;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AceConfig {
    pub config_version: u32,
    pub source: SourceSection,
    pub build: BuildSection,
    pub node: NodeSection,
    #[serde(default)]
    pub runtime: RuntimeSection,
    #[serde(default)]
    pub limits: LimitsSection,
    pub persistence: PersistenceSection,
    #[serde(default)]
    pub tunnel: TunnelSection,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SourceSection {
    /// The authoritative StableChain repository (GitLab).
    pub repository: String,
    /// Full 40-hex commit. Required: ACE never builds an unpinned branch tip.
    pub commit: String,
    /// Optional human label (branch or tag) recorded next to the commit; never used to fetch.
    pub reference: Option<String>,
    /// The Cargo workspace inside the repository.
    pub workspace: String,
    pub checkout_dir: PathBuf,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct BuildSection {
    /// A Cargo profile defined by the workspace: "release" or "hardened-release".
    pub profile: String,
    pub packages: Vec<String>,
    #[serde(default)]
    pub features: Vec<String>,
    /// Executables to collect, verify and hash. Must include `aletheiad`.
    pub binaries: Vec<String>,
    pub target_dir: PathBuf,
    pub output_dir: PathBuf,
    #[serde(default = "default_build_seconds")]
    pub max_duration_s: u64,
    /// The build is stopped if free space on the target directory's filesystem drops below.
    #[serde(default = "default_build_free_mb")]
    pub min_free_disk_mb: u64,
}

fn default_build_seconds() -> u64 {
    5400
}
fn default_build_free_mb() -> u64 {
    2048
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Role {
    /// Follows a chain from configured peers; signs nothing.
    Observer,
    /// Holds a consensus key (devnet/regtest only until the signer daemon exists).
    Validator,
    /// Single-node devnet/regtest chain produced by the `devnet-producer` stand-in.
    DevnetProducer,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NodeSection {
    /// The `aletheiad` TOML file.
    pub config: PathBuf,
    /// The daemon's working directory: relative paths in the node configuration resolve here,
    /// exactly as they do when `aletheiad` runs.
    pub working_dir: PathBuf,
    pub role: Role,
    /// "mainnet", "private-validation", "devnet" or "regtest".
    pub expected_network: String,
    pub expected_chain_id: u32,
    /// 64 lowercase hex. Once a chain is known, pin it: ACE then refuses any node, data
    /// directory or checkpoint that reports another genesis.
    pub expected_genesis_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields, default)]
pub struct RuntimeSection {
    pub state_dir: PathBuf,
    pub startup_timeout_s: u64,
    pub rpc_ready_timeout_s: u64,
    pub shutdown_deadline_s: u64,
    pub max_restarts: u32,
    pub restart_window_s: u64,
    pub backoff_initial_ms: u64,
    pub backoff_max_ms: u64,
    pub max_log_bytes: u64,
    pub health_interval_s: u64,
    /// A devnet producer whose finalized height does not advance for this long is DEGRADED.
    pub stall_after_s: u64,
}

impl Default for RuntimeSection {
    fn default() -> RuntimeSection {
        RuntimeSection {
            state_dir: PathBuf::from("run"),
            startup_timeout_s: 120,
            rpc_ready_timeout_s: 60,
            shutdown_deadline_s: 120,
            max_restarts: 3,
            restart_window_s: 600,
            backoff_initial_ms: 2_000,
            backoff_max_ms: 60_000,
            max_log_bytes: 64 * 1024 * 1024,
            health_interval_s: 10,
            stall_after_s: 30,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields, default)]
pub struct LimitsSection {
    /// Below this much free space on the data directory's filesystem the node is not started
    /// (and a running node is stopped cleanly).
    pub min_free_disk_mb: u64,
    /// Below this much memory available to the node it is not started.
    pub min_memory_mb: u64,
    pub max_snapshot_mb: u64,
}

impl Default for LimitsSection {
    fn default() -> LimitsSection {
        LimitsSection {
            min_free_disk_mb: 1024,
            min_memory_mb: 1024,
            max_snapshot_mb: 2048,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PersistenceMode {
    /// Nothing survives the host. Chain data lasts as long as the host does.
    Ephemeral,
    /// The operator declares the data directory to be on durable storage attached to a
    /// long-lived host. ACE still checks what it can (not tmpfs, not a CI runner).
    PersistentHost,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PersistenceSection {
    pub mode: PersistenceMode,
    /// Where verified checkpoints are written and read.
    pub checkpoint_dir: PathBuf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum TunnelProvider {
    #[default]
    None,
    Cloudflared,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(deny_unknown_fields)]
pub struct TunnelSection {
    pub provider: TunnelProvider,
    /// e.g. "https://rpc.stateofaletheia.org". Checked from outside before it is reported up.
    pub public_url: Option<String>,
}

/// A loaded configuration with every path resolved.
#[derive(Debug, Clone)]
pub struct Deployment {
    pub file: PathBuf,
    pub base_dir: PathBuf,
    pub config: AceConfig,
}

pub fn is_full_commit(text: &str) -> bool {
    text.len() == 40
        && text
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

pub fn is_hash32_hex(text: &str) -> bool {
    text.len() == 64
        && text
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// Names a Cargo package, feature or binary may take; anything else could smuggle arguments.
fn is_cargo_name(text: &str) -> bool {
    !text.is_empty()
        && !text.starts_with('-')
        && text
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'/'))
}

const NETWORKS: [&str; 4] = ["mainnet", "private-validation", "devnet", "regtest"];

fn check_range(name: &str, value: u64, low: u64, high: u64) -> Result<()> {
    if (low..=high).contains(&value) {
        Ok(())
    } else {
        Err(AceError::Config(format!(
            "{name} = {value} is outside {low} to {high}"
        )))
    }
}

impl AceConfig {
    pub fn validate(&self) -> Result<()> {
        if self.config_version != CONFIG_VERSION {
            return Err(AceError::Config(format!(
                "config_version = {} but this ACE reads version {CONFIG_VERSION}",
                self.config_version
            )));
        }
        let repo = &self.source.repository;
        if !repo.starts_with("https://") || repo.contains('@') || repo.contains(char::is_whitespace)
        {
            return Err(AceError::Config(format!(
                "[source] repository must be an https URL without embedded credentials, got \"{repo}\""
            )));
        }
        if !is_full_commit(&self.source.commit) {
            return Err(AceError::Config(format!(
                "[source] commit must be a full 40-digit lowercase hex commit, got \"{}\"; ACE never builds an unpinned branch tip",
                self.source.commit
            )));
        }
        if self.source.workspace.contains("..") || Path::new(&self.source.workspace).is_absolute() {
            return Err(AceError::Config(
                "[source] workspace must be a relative path inside the repository".to_owned(),
            ));
        }
        if !matches!(self.build.profile.as_str(), "release" | "hardened-release") {
            return Err(AceError::Config(format!(
                "[build] profile \"{}\" is not \"release\" or \"hardened-release\"",
                self.build.profile
            )));
        }
        for name in self
            .build
            .packages
            .iter()
            .chain(&self.build.features)
            .chain(&self.build.binaries)
        {
            if !is_cargo_name(name) {
                return Err(AceError::Config(format!(
                    "[build] \"{name}\" is not a Cargo package, feature or binary name"
                )));
            }
        }
        if !self.build.binaries.iter().any(|b| b == "aletheiad") {
            return Err(AceError::Config(
                "[build] binaries must include \"aletheiad\"".to_owned(),
            ));
        }
        check_range(
            "[build] max_duration_s",
            self.build.max_duration_s,
            60,
            6 * 3600,
        )?;
        check_range(
            "[build] min_free_disk_mb",
            self.build.min_free_disk_mb,
            256,
            1 << 20,
        )?;
        if !NETWORKS.contains(&self.node.expected_network.as_str()) {
            return Err(AceError::Config(format!(
                "[node] expected_network \"{}\" is not one of {}",
                self.node.expected_network,
                NETWORKS.join(", ")
            )));
        }
        if let Some(id) = &self.node.expected_genesis_id
            && !is_hash32_hex(id)
        {
            return Err(AceError::Config(
                "[node] expected_genesis_id must be 64 lowercase hex digits".to_owned(),
            ));
        }
        let r = &self.runtime;
        check_range("[runtime] startup_timeout_s", r.startup_timeout_s, 5, 3600)?;
        check_range(
            "[runtime] rpc_ready_timeout_s",
            r.rpc_ready_timeout_s,
            1,
            3600,
        )?;
        check_range(
            "[runtime] shutdown_deadline_s",
            r.shutdown_deadline_s,
            5,
            3600,
        )?;
        check_range("[runtime] max_restarts", u64::from(r.max_restarts), 0, 20)?;
        check_range("[runtime] restart_window_s", r.restart_window_s, 10, 86_400)?;
        check_range(
            "[runtime] backoff_initial_ms",
            r.backoff_initial_ms,
            100,
            600_000,
        )?;
        check_range(
            "[runtime] backoff_max_ms",
            r.backoff_max_ms,
            r.backoff_initial_ms,
            3_600_000,
        )?;
        check_range("[runtime] max_log_bytes", r.max_log_bytes, 1 << 20, 1 << 34)?;
        check_range("[runtime] health_interval_s", r.health_interval_s, 1, 3600)?;
        check_range("[runtime] stall_after_s", r.stall_after_s, 2, 86_400)?;
        let l = &self.limits;
        check_range("[limits] min_free_disk_mb", l.min_free_disk_mb, 64, 1 << 24)?;
        check_range("[limits] min_memory_mb", l.min_memory_mb, 128, 1 << 22)?;
        check_range("[limits] max_snapshot_mb", l.max_snapshot_mb, 1, 1 << 24)?;
        match (&self.tunnel.provider, &self.tunnel.public_url) {
            (TunnelProvider::None, _) => {}
            (TunnelProvider::Cloudflared, Some(url)) if url.starts_with("https://") => {}
            (TunnelProvider::Cloudflared, _) => {
                return Err(AceError::Config(
                    "[tunnel] provider = \"cloudflared\" needs an https public_url".to_owned(),
                ));
            }
        }
        Ok(())
    }
}

impl Deployment {
    pub fn load(file: &Path) -> Result<Deployment> {
        let text = std::fs::read_to_string(file).map_err(|e| AceError::io("read", file, e))?;
        let config: AceConfig = toml::from_str(&text)
            .map_err(|e| AceError::Config(format!("{}: {e}", file.display())))?;
        config.validate()?;
        let file = std::path::absolute(file).map_err(|e| AceError::io("resolve", file, e))?;
        let base_dir = file.parent().map(Path::to_path_buf).ok_or_else(|| {
            AceError::Config(format!("{} has no parent directory", file.display()))
        })?;
        Ok(Deployment {
            file,
            base_dir,
            config,
        })
    }

    /// The checkout of the StableChain repository.
    pub fn checkout_dir(&self) -> PathBuf {
        self.base_dir.join(&self.config.source.checkout_dir)
    }

    /// The Cargo workspace inside the checkout.
    pub fn workspace_dir(&self) -> PathBuf {
        self.checkout_dir().join(&self.config.source.workspace)
    }

    /// Resolves a path from `ace.toml` (see the module documentation).
    pub fn resolve(&self, path: &Path) -> PathBuf {
        match path.strip_prefix("@source") {
            Ok(inside) => self.workspace_dir().join(inside),
            Err(_) => self.base_dir.join(path),
        }
    }

    pub fn target_dir(&self) -> PathBuf {
        self.resolve(&self.config.build.target_dir)
    }
    pub fn output_dir(&self) -> PathBuf {
        self.resolve(&self.config.build.output_dir)
    }
    pub fn node_config(&self) -> PathBuf {
        self.resolve(&self.config.node.config)
    }
    pub fn node_working_dir(&self) -> PathBuf {
        self.resolve(&self.config.node.working_dir)
    }
    pub fn state_dir(&self) -> PathBuf {
        self.resolve(&self.config.runtime.state_dir)
    }
    pub fn checkpoint_dir(&self) -> PathBuf {
        self.resolve(&self.config.persistence.checkpoint_dir)
    }
    pub fn daemon_path(&self) -> PathBuf {
        self.output_dir().join("aletheiad")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    pub(crate) const SAMPLE: &str = r#"
config_version = 1

[source]
repository = "https://gitlab.com/emeka.iwuagwu/aletheia-project-hub.git"
commit = "1b4f4dc409255e730b566b434c7fd955742cbc7c"
workspace = "aletheia-node"
checkout_dir = "work/src"

[build]
profile = "release"
packages = ["aletheiad", "aletheia-arno-exec"]
features = ["aletheiad/devnet-producer"]
binaries = ["aletheiad", "aletheia-arno-exec"]
target_dir = "work/target"
output_dir = "work/bin"

[node]
config = "@source/configs/devnet-explorer.toml"
working_dir = "@source"
role = "devnet-producer"
expected_network = "devnet"
expected_chain_id = 7771

[persistence]
mode = "ephemeral"
checkpoint_dir = "work/checkpoints"
"#;

    fn parse(text: &str) -> Result<AceConfig> {
        let config: AceConfig =
            toml::from_str(text).map_err(|e| AceError::Config(e.to_string()))?;
        config.validate()?;
        Ok(config)
    }

    #[test]
    fn the_sample_is_accepted_with_documented_defaults() {
        let config = parse(SAMPLE).unwrap();
        assert_eq!(config.runtime.max_restarts, 3);
        assert_eq!(config.tunnel.provider, TunnelProvider::None);
        assert_eq!(config.node.role, Role::DevnetProducer);
    }

    #[test]
    fn unknown_keys_are_refused() {
        let text = SAMPLE.replace("[persistence]", "[persistence]\nretain_forever = true");
        assert!(parse(&text).is_err());
    }

    #[test]
    fn an_unpinned_reference_is_refused() {
        let text = SAMPLE.replace("1b4f4dc409255e730b566b434c7fd955742cbc7c", "main");
        let error = parse(&text).unwrap_err().to_string();
        assert!(error.contains("unpinned"), "{error}");
        let short = SAMPLE.replace("1b4f4dc409255e730b566b434c7fd955742cbc7c", "1b4f4dc");
        assert!(parse(&short).is_err());
    }

    #[test]
    fn credentials_in_the_repository_url_are_refused() {
        let text = SAMPLE.replace("https://gitlab.com", "https://deploy:secret@gitlab.com");
        assert!(parse(&text).is_err());
    }

    #[test]
    fn argument_smuggling_through_build_names_is_refused() {
        let text = SAMPLE.replace(
            "\"aletheia-arno-exec\"]\nfeatures",
            "\"--config=x\"]\nfeatures",
        );
        assert!(parse(&text).is_err());
        let text = SAMPLE.replace("[\"aletheiad/devnet-producer\"]", "[\"a b\"]");
        assert!(parse(&text).is_err());
    }

    #[test]
    fn out_of_range_limits_are_refused() {
        let text = format!("{SAMPLE}\n[runtime]\nmax_restarts = 1000\n");
        assert!(parse(&text).is_err());
        let text = format!("{SAMPLE}\n[limits]\nmin_free_disk_mb = 1\n");
        assert!(parse(&text).is_err());
    }

    #[test]
    fn a_tunnel_without_an_https_url_is_refused() {
        let text = format!("{SAMPLE}\n[tunnel]\nprovider = \"cloudflared\"\n");
        assert!(parse(&text).is_err());
        let ok = format!(
            "{SAMPLE}\n[tunnel]\nprovider = \"cloudflared\"\npublic_url = \"https://rpc.stateofaletheia.org\"\n"
        );
        assert!(parse(&ok).is_ok());
    }

    #[test]
    fn source_paths_resolve_inside_the_workspace() {
        let deployment = Deployment {
            file: PathBuf::from("/srv/ace/ace.toml"),
            base_dir: PathBuf::from("/srv/ace"),
            config: parse(SAMPLE).unwrap(),
        };
        assert_eq!(
            deployment.node_config(),
            PathBuf::from("/srv/ace/work/src/aletheia-node/configs/devnet-explorer.toml")
        );
        assert_eq!(
            deployment.node_working_dir(),
            PathBuf::from("/srv/ace/work/src/aletheia-node")
        );
        assert_eq!(deployment.output_dir(), PathBuf::from("/srv/ace/work/bin"));
    }
}
