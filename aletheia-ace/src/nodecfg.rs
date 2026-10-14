//! Reads an `aletheiad` configuration with the daemon's own rules, so ACE refuses what the
//! node would refuse and reports what the node will actually do, before anything is started.
//!
//! Mirrors `aletheia-node/apps/aletheiad/src/config.rs` at the pinned commit: the same
//! sections and keys, `deny_unknown_fields` everywhere, the same default executor location
//! (beside `aletheiad`), the same refusal of plaintext keys outside devnet and regtest. Paths
//! are resolved against the daemon's working directory, because `aletheiad` opens them as
//! given. The real daemon remains the final judge: the integration tests start it with
//! configurations ACE accepts and refuses and check that both agree (tests/node_e2e.rs).
//!
//! Key files are checked for existence, permissions and shape; their contents are never
//! stored, printed or written to a report.

use std::net::SocketAddr;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AceError, Result};
use crate::settings::Role;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct FileConfig {
    node: NodeSection,
    #[serde(default)]
    peers: Vec<PeerSection>,
    devnet: Option<DevnetSection>,
    execution: Option<ExecutionSection>,
    storage: Option<StorageSection>,
    rpc: Option<RpcSection>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct NodeSection {
    data_dir: PathBuf,
    genesis: PathBuf,
    listen: SocketAddr,
    node_key_file: PathBuf,
    consensus_key_file: Option<PathBuf>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PeerSection {
    address: SocketAddr,
    node_key: Option<String>,
    transport_cert_sha256: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct DevnetSection {
    produce_every_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ExecutionSection {
    executor: Option<String>,
    executor_path: Option<PathBuf>,
    call_timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct StorageSection {
    block_cache_mb: Option<u64>,
    write_buffer_mb: Option<u64>,
    max_open_files: Option<i32>,
    background_jobs: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RpcSection {
    listen: SocketAddr,
    requests_per_second: Option<u32>,
}

/// `aletheia_rpc::server::DEFAULT_REQUESTS_PER_SECOND` at the audited commit.
pub const NODE_DEFAULT_RPC_REQUESTS_PER_SECOND: u32 = 50;
/// The JSON-RPC route registered by `aletheia_rpc::server::router`.
pub const JSON_RPC_PATH: &str = "/rpc/v1";
/// The REST prefix registered by `aletheia_rpc::server::router`.
pub const REST_PREFIX: &str = "/api/v1";

/// What the genesis file says about the chain (only `[chain]` is read here; the daemon
/// validates the whole file and computes the genesis id).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GenesisSummary {
    pub path: PathBuf,
    pub chain_id: u32,
    pub network: String,
    pub protocol_version: u64,
    pub slot_duration_ms: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExecutorPlan {
    Sandboxed { program: PathBuf, timeout_ms: u64 },
    InProcess,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RpcPlan {
    pub listen: SocketAddr,
    pub requests_per_second: u32,
    pub json_rpc_path: &'static str,
    pub rest_prefix: &'static str,
    pub loopback_only: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PeerPlan {
    pub address: SocketAddr,
    pub node_key_pinned: bool,
    pub certificate_pinned: bool,
}

/// The effective node configuration, safe to print: no key material.
#[derive(Debug, Clone, Serialize)]
pub struct NodePlan {
    pub config_path: PathBuf,
    pub working_dir: PathBuf,
    pub data_dir: PathBuf,
    pub data_dir_initialized: bool,
    pub genesis: GenesisSummary,
    pub p2p_listen: SocketAddr,
    pub node_key_file: PathBuf,
    pub consensus_key_file: Option<PathBuf>,
    pub peers: Vec<PeerPlan>,
    pub produce_every_ms: Option<u64>,
    pub executor: ExecutorPlan,
    pub storage_overrides: Vec<String>,
    pub rpc: Option<RpcPlan>,
    pub role: Role,
    pub warnings: Vec<String>,
}

/// Facts about the build that decide whether a configuration can run.
#[derive(Debug, Clone, Copy)]
pub struct BuildFacts {
    pub devnet_producer: bool,
}

fn refuse(message: String) -> AceError {
    AceError::NodeConfig(message)
}

fn resolve(working_dir: &Path, path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        working_dir.join(path)
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::Digest;
    let digest = sha2::Sha256::digest(bytes);
    let mut out = String::with_capacity(64);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

fn read_genesis(path: &Path) -> Result<GenesisSummary> {
    let bytes = std::fs::read(path)
        .map_err(|e| refuse(format!("cannot read genesis {}: {e}", path.display())))?;
    let text = std::str::from_utf8(&bytes)
        .map_err(|_| refuse(format!("genesis {} is not UTF-8", path.display())))?;
    let value: toml::Table =
        toml::from_str(text).map_err(|e| refuse(format!("genesis {}: {e}", path.display())))?;
    let chain = value
        .get("chain")
        .and_then(toml::Value::as_table)
        .ok_or_else(|| refuse(format!("genesis {} has no [chain] table", path.display())))?;
    let integer = |key: &str| -> Result<u64> {
        chain
            .get(key)
            .and_then(toml::Value::as_integer)
            .and_then(|v| u64::try_from(v).ok())
            .ok_or_else(|| {
                refuse(format!(
                    "genesis {}: [chain] {key} is missing or not a whole number",
                    path.display()
                ))
            })
    };
    let chain_id = u32::try_from(integer("chain_id")?).map_err(|_| {
        refuse(format!(
            "genesis {}: chain_id exceeds 32 bits",
            path.display()
        ))
    })?;
    let network = chain
        .get("network")
        .and_then(toml::Value::as_str)
        .ok_or_else(|| {
            refuse(format!(
                "genesis {}: [chain] network is missing",
                path.display()
            ))
        })?
        .to_owned();
    Ok(GenesisSummary {
        path: path.to_path_buf(),
        chain_id,
        network,
        protocol_version: integer("protocol_version")?,
        slot_duration_ms: integer("slot_duration_ms")?,
        sha256: sha256_hex(&bytes),
    })
}

fn allows_development_keys(network: &str) -> bool {
    matches!(network, "devnet" | "regtest")
}

/// Checks a key file's shape (64 lowercase hex digits, as the daemon requires) and
/// permissions without keeping its contents.
fn check_key_file(path: &Path, what: &str, warnings: &mut Vec<String>) -> Result<()> {
    let text = std::fs::read_to_string(path)
        .map_err(|e| refuse(format!("cannot read {what} {}: {e}", path.display())))?;
    let trimmed = text.trim();
    let well_formed = trimmed.len() == 64
        && trimmed
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b));
    drop(text);
    if !well_formed {
        return Err(refuse(format!(
            "{}: {what} must be 64 lowercase hex digits",
            path.display()
        )));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(path)
            && meta.permissions().mode() & 0o004 != 0
        {
            warnings.push(format!(
                "{what} {} is readable by every user; use 0640 or tighter",
                path.display()
            ));
        }
    }
    Ok(())
}

/// Reads and checks the node configuration. `daemon` is the `aletheiad` that will run it:
/// its directory is where the daemon looks for the contract executor by default.
pub fn inspect(
    config_path: &Path,
    working_dir: &Path,
    daemon: &Path,
    build: BuildFacts,
) -> Result<NodePlan> {
    let text = std::fs::read_to_string(config_path)
        .map_err(|e| refuse(format!("cannot read {}: {e}", config_path.display())))?;
    let file: FileConfig =
        toml::from_str(&text).map_err(|e| refuse(format!("{}: {e}", config_path.display())))?;
    let mut warnings = Vec::new();

    let genesis = read_genesis(&resolve(working_dir, &file.node.genesis))?;
    let dev = allows_development_keys(&genesis.network);
    if !dev {
        // The daemon refuses this on every network but devnet and regtest (spec 19.2), and
        // there is no other way to supply a node key at this commit.
        return Err(refuse(format!(
            "node_key_file holds a plaintext key, which aletheiad refuses on {}; production keys need the signer daemon, which does not exist yet",
            genesis.network
        )));
    }
    let node_key_file = resolve(working_dir, &file.node.node_key_file);
    check_key_file(&node_key_file, "node key", &mut warnings)?;
    let consensus_key_file = file
        .node
        .consensus_key_file
        .as_ref()
        .map(|p| resolve(working_dir, p));
    if let Some(path) = &consensus_key_file {
        check_key_file(path, "consensus key", &mut warnings)?;
    }

    let execution = file.execution.as_ref();
    let executor = match execution
        .and_then(|e| e.executor.as_deref())
        .unwrap_or("sandboxed")
    {
        "sandboxed" => {
            let program = match execution.and_then(|e| e.executor_path.clone()) {
                // The daemon opens executor_path as given, i.e. against its working directory.
                Some(path) => resolve(working_dir, &path),
                None => daemon.with_file_name("aletheia-arno-exec"),
            };
            if !program.is_file() {
                return Err(refuse(format!(
                    "the contract executor {} does not exist; build aletheia-arno-exec beside aletheiad or set [execution] executor_path",
                    program.display()
                )));
            }
            ExecutorPlan::Sandboxed {
                program,
                timeout_ms: execution.and_then(|e| e.call_timeout_ms).unwrap_or(10_000),
            }
        }
        "in-process" if dev => {
            warnings.push(
                "contracts run in-process without the sandbox (devnet/regtest only)".to_owned(),
            );
            ExecutorPlan::InProcess
        }
        "in-process" => {
            return Err(refuse(format!(
                "in-process contract execution is refused on {}",
                genesis.network
            )));
        }
        other => {
            return Err(refuse(format!(
                "[execution] executor \"{other}\" is not \"sandboxed\" or \"in-process\""
            )));
        }
    };

    let mut storage_overrides = Vec::new();
    if let Some(s) = &file.storage {
        if let Some(mb) = s.block_cache_mb {
            if !(16..=65_536).contains(&mb) {
                return Err(refuse(format!(
                    "[storage] block_cache_mb = {mb} is outside 16 to 65536"
                )));
            }
            storage_overrides.push(format!("block_cache_mb={mb}"));
        }
        if let Some(mb) = s.write_buffer_mb {
            if !(16..=16_384).contains(&mb) {
                return Err(refuse(format!(
                    "[storage] write_buffer_mb = {mb} is outside 16 to 16384"
                )));
            }
            storage_overrides.push(format!("write_buffer_mb={mb}"));
        }
        if let Some(n) = s.max_open_files {
            if !(64..=1_000_000).contains(&n) {
                return Err(refuse(format!(
                    "[storage] max_open_files = {n} is outside 64 to 1000000"
                )));
            }
            storage_overrides.push(format!("max_open_files={n}"));
        }
        if let Some(n) = s.background_jobs {
            if !(1..=64).contains(&n) {
                return Err(refuse(format!(
                    "[storage] background_jobs = {n} is outside 1 to 64"
                )));
            }
            storage_overrides.push(format!("background_jobs={n}"));
        }
    }

    let mut peers = Vec::with_capacity(file.peers.len());
    for peer in &file.peers {
        if let Some(key) = &peer.node_key
            && (key.len() != 64 || !key.bytes().all(|b| b.is_ascii_hexdigit()))
        {
            return Err(refuse(format!(
                "peer {} node_key is not 64 hex digits",
                peer.address
            )));
        }
        if let Some(cert) = &peer.transport_cert_sha256
            && (cert.len() != 64 || !cert.bytes().all(|b| b.is_ascii_hexdigit()))
        {
            return Err(refuse(format!(
                "peer {} transport_cert_sha256 is not 64 hex digits",
                peer.address
            )));
        }
        peers.push(PeerPlan {
            address: peer.address,
            node_key_pinned: peer.node_key.is_some(),
            certificate_pinned: peer.transport_cert_sha256.is_some(),
        });
    }

    let produce_every_ms = file.devnet.as_ref().map(|d| d.produce_every_ms);
    if produce_every_ms.is_some() && !build.devnet_producer {
        return Err(refuse(
            "[devnet] needs a build with the aletheiad/devnet-producer feature; this build has none"
                .to_owned(),
        ));
    }
    let role = match (produce_every_ms.is_some(), consensus_key_file.is_some()) {
        (true, true) => {
            return Err(refuse(
                "[devnet] produce_every_ms and consensus_key_file together: a producer chain has no validators"
                    .to_owned(),
            ));
        }
        (true, false) => Role::DevnetProducer,
        (false, true) => Role::Validator,
        (false, false) => Role::Observer,
    };
    if role == Role::Observer && peers.is_empty() {
        warnings
            .push("observer with no [[peers]]: it will serve genesis and never advance".to_owned());
    }

    let rpc = file.rpc.as_ref().map(|section| RpcPlan {
        listen: section.listen,
        requests_per_second: section
            .requests_per_second
            .unwrap_or(NODE_DEFAULT_RPC_REQUESTS_PER_SECOND),
        json_rpc_path: JSON_RPC_PATH,
        rest_prefix: REST_PREFIX,
        loopback_only: section.listen.ip().is_loopback(),
    });
    if let Some(plan) = &rpc {
        if plan.listen == file.node.listen
            || (plan.listen.port() != 0 && plan.listen.port() == file.node.listen.port())
        {
            return Err(refuse(format!(
                "[rpc] listen {} uses the P2P port of [node] listen {}",
                plan.listen, file.node.listen
            )));
        }
        if !plan.loopback_only {
            warnings.push(format!(
                "RPC binds {} beyond loopback; publish it through a proxy or tunnel instead",
                plan.listen
            ));
        }
    } else {
        warnings.push("[rpc] is absent: the node serves no RPC".to_owned());
    }

    // aletheiad fsyncs the data directory's parent after creating it. For a relative path of
    // one component ("devnet-data") that parent is the empty path, the open fails, and a new
    // node fail-stops with "STO_IO: sync directory : No such file or directory" (observed at
    // the audited commit; crates/storage/src/fsutil.rs sync_dir). "./devnet-data" works.
    let raw = &file.node.data_dir;
    if raw.is_relative() && raw.components().count() == 1 && raw.parent() == Some(Path::new("")) {
        let data_dir = resolve(working_dir, raw);
        if !data_dir.join("DATADIR").is_file() {
            return Err(refuse(format!(
                "[node] data_dir = \"{}\": aletheiad cannot initialize a one-component relative data directory (it fsyncs the empty parent path and fail-stops); write \"./{}\" or an absolute path",
                raw.display(),
                raw.display()
            )));
        }
    }

    let data_dir = resolve(working_dir, &file.node.data_dir);
    Ok(NodePlan {
        config_path: config_path.to_path_buf(),
        working_dir: working_dir.to_path_buf(),
        data_dir_initialized: data_dir.join("DATADIR").is_file(),
        data_dir,
        genesis,
        p2p_listen: file.node.listen,
        node_key_file,
        consensus_key_file,
        peers,
        produce_every_ms,
        executor,
        storage_overrides,
        rpc,
        role,
        warnings,
    })
}

impl NodePlan {
    /// Checks the configuration against what the deployment expects to run.
    pub fn check_expectations(&self, role: Role, network: &str, chain_id: u32) -> Result<()> {
        if self.genesis.network != network || self.genesis.chain_id != chain_id {
            return Err(refuse(format!(
                "genesis {} is chain {} on {}; the deployment expects chain {chain_id} on {network}",
                self.genesis.path.display(),
                self.genesis.chain_id,
                self.genesis.network
            )));
        }
        if self.role != role {
            return Err(refuse(format!(
                "the node configuration runs a {:?}, the deployment expects a {:?}",
                self.role, role
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "0101010101010101010101010101010101010101010101010101010101010101";

    fn fixture(node_toml: &str) -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("genesis.toml"),
            "[chain]\nchain_id = 7771\nnetwork = \"devnet\"\nprotocol_version = 1\ngenesis_time_ms = 1\nslot_duration_ms = 500\n",
        )
        .unwrap();
        std::fs::write(dir.path().join("node.key"), KEY).unwrap();
        std::fs::write(dir.path().join("aletheia-arno-exec"), b"").unwrap();
        std::fs::write(dir.path().join("node.toml"), node_toml).unwrap();
        let config = dir.path().join("node.toml");
        (dir, config)
    }

    const BASE: &str = "[node]\ndata_dir = \"./data\"\ngenesis = \"genesis.toml\"\nlisten = \"127.0.0.1:7771\"\nnode_key_file = \"node.key\"\n";

    fn run(toml: &str, producer: bool) -> Result<NodePlan> {
        let (dir, config) = fixture(toml);
        let daemon = dir.path().join("aletheiad");
        let plan = inspect(
            &config,
            dir.path(),
            &daemon,
            BuildFacts {
                devnet_producer: producer,
            },
        );
        drop(dir);
        plan
    }

    #[test]
    fn rpc_disabled_is_reported_not_invented() {
        let plan = run(BASE, false).unwrap();
        assert!(plan.rpc.is_none());
        assert!(plan.warnings.iter().any(|w| w.contains("serves no RPC")));
        assert_eq!(plan.role, Role::Observer);
    }

    #[test]
    fn rpc_settings_come_from_the_file_with_the_node_default_budget() {
        let plan = run(
            &format!("{BASE}[rpc]\nlisten = \"127.0.0.1:7781\"\n"),
            false,
        )
        .unwrap();
        let rpc = plan.rpc.unwrap();
        assert_eq!(rpc.listen, "127.0.0.1:7781".parse().unwrap());
        assert_eq!(rpc.requests_per_second, 50);
        assert_eq!(rpc.json_rpc_path, "/rpc/v1");
        assert!(rpc.loopback_only);
    }

    #[test]
    fn invalid_ports_and_addresses_are_refused() {
        assert!(
            run(
                &format!("{BASE}[rpc]\nlisten = \"127.0.0.1:99999\"\n"),
                false
            )
            .is_err()
        );
        assert!(
            run(
                &format!("{BASE}[rpc]\nlisten = \"localhost:7781\"\n"),
                false
            )
            .is_err()
        );
        assert!(
            run(
                &format!("{BASE}[rpc]\nlisten = \"127.0.0.1:7771\"\n"),
                false
            )
            .is_err()
        );
    }

    #[test]
    fn unknown_keys_are_refused_like_the_daemon() {
        assert!(
            run(
                &format!("{BASE}[rpc]\nlisten = \"127.0.0.1:7781\"\ncors = true\n"),
                false
            )
            .is_err()
        );
        assert!(run(&format!("{BASE}unknown = 1\n"), false).is_err());
    }

    #[test]
    fn the_producer_needs_the_feature() {
        let toml = format!("{BASE}[devnet]\nproduce_every_ms = 500\n");
        assert!(run(&toml, false).is_err());
        assert_eq!(run(&toml, true).unwrap().role, Role::DevnetProducer);
    }

    #[test]
    fn a_missing_executor_is_refused() {
        let (dir, config) = fixture(BASE);
        std::fs::remove_file(dir.path().join("aletheia-arno-exec")).unwrap();
        let error = inspect(
            &config,
            dir.path(),
            &dir.path().join("aletheiad"),
            BuildFacts {
                devnet_producer: false,
            },
        )
        .unwrap_err()
        .to_string();
        assert!(error.contains("contract executor"), "{error}");
    }

    #[test]
    fn a_malformed_key_is_refused_without_echoing_it() {
        let (dir, config) = fixture(BASE);
        std::fs::write(dir.path().join("node.key"), "SECRETSECRET").unwrap();
        let error = inspect(
            &config,
            dir.path(),
            &dir.path().join("aletheiad"),
            BuildFacts {
                devnet_producer: false,
            },
        )
        .unwrap_err()
        .to_string();
        assert!(!error.contains("SECRETSECRET"), "{error}");
    }

    #[test]
    fn plaintext_keys_are_refused_off_devnet() {
        let (dir, config) = fixture(BASE);
        std::fs::write(
            dir.path().join("genesis.toml"),
            "[chain]\nchain_id = 1\nnetwork = \"mainnet\"\nprotocol_version = 1\nslot_duration_ms = 500\n",
        )
        .unwrap();
        let error = inspect(
            &config,
            dir.path(),
            &dir.path().join("aletheiad"),
            BuildFacts {
                devnet_producer: false,
            },
        )
        .unwrap_err()
        .to_string();
        assert!(error.contains("signer"), "{error}");
    }

    #[test]
    fn a_one_component_relative_data_dir_is_refused_before_the_node_fails() {
        let toml = BASE.replace("\"./data\"", "\"data\"");
        let error = run(&toml, false).unwrap_err().to_string();
        assert!(error.contains("./data"), "{error}");
        assert!(run(&BASE.replace("\"./data\"", "\"nested/data\""), false).is_ok());
    }

    #[test]
    fn the_plan_never_contains_key_material() {
        let plan = run(BASE, false).unwrap();
        let json = serde_json::to_string(&plan).unwrap();
        assert!(!json.contains(KEY));
    }

    #[test]
    fn expectations_catch_a_wrong_network_or_role() {
        let plan = run(BASE, false).unwrap();
        assert!(
            plan.check_expectations(Role::Observer, "devnet", 7771)
                .is_ok()
        );
        assert!(
            plan.check_expectations(Role::Observer, "mainnet", 7771)
                .is_err()
        );
        assert!(
            plan.check_expectations(Role::DevnetProducer, "devnet", 7771)
                .is_err()
        );
    }
}
