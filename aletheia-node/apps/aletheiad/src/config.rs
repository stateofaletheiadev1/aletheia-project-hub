//! `node.toml`: parsed strictly at the boundary (spec Section 46A.2 step 1). Unknown keys are
//! errors; safety settings have no defaults.
//!
//! ```toml
//! [node]
//! data_dir = "/var/lib/aletheia"
//! genesis = "/etc/aletheia/genesis.toml"
//! listen = "0.0.0.0:7771"
//! node_key_file = "/etc/aletheia/node.key"   # 64 lowercase hex digits; devnet/regtest only
//! consensus_key_file = "/etc/aletheia/consensus.key"  # validators: 64 hex digits of BLS key
//!                                             # material; devnet/regtest only
//!
//! [[peers]]
//! address = "10.0.0.2:7771"
//! node_key = "<64 hex>"                # optional pin
//! transport_cert_sha256 = "<64 hex>"   # optional pin
//!
//! [devnet]
//! produce_every_ms = 500               # devnet/regtest builds with devnet-producer only
//!
//! [execution]                          # optional
//! executor = "sandboxed"               # default; "in-process" on devnet/regtest only
//! executor_path = "/usr/lib/aletheia/aletheia-arno-exec"   # default: beside aletheiad
//! call_timeout_ms = 10000              # watchdog per contract call
//! ```

use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

use aletheia_core::{Hash32, base16};
use aletheia_crypto::{BlsSecretKey, Ed25519SigningKey, Secret};
use aletheia_execution::{GenesisConfig, GenesisState};
use aletheia_p2p::{DialTarget, PeerExpectation};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct FileConfig {
    node: NodeSection,
    #[serde(default)]
    peers: Vec<PeerSection>,
    devnet: Option<DevnetSection>,
    execution: Option<ExecutionSection>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ExecutionSection {
    executor: Option<String>,
    executor_path: Option<PathBuf>,
    call_timeout_ms: Option<u64>,
}

/// How contracts run (spec Section 28.1).
#[derive(Debug, Clone)]
pub(crate) enum Executor {
    Sandboxed { program: PathBuf, timeout: Duration },
    InProcess,
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

pub(crate) struct Settings {
    pub(crate) data_dir: PathBuf,
    pub(crate) genesis: GenesisState,
    pub(crate) listen: SocketAddr,
    pub(crate) peers: Vec<DialTarget>,
    pub(crate) node_key: Ed25519SigningKey,
    pub(crate) produce_every: Option<Duration>,
    pub(crate) consensus_key: Option<BlsSecretKey>,
    pub(crate) executor: Executor,
}

fn read(path: &std::path::Path, what: &str) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| format!("cannot read {what} {}: {e}", path.display()))
}

pub(crate) fn load(path: &std::path::Path) -> Result<Settings, String> {
    let file: FileConfig = toml::from_str(&read(path, "configuration")?)
        .map_err(|e| format!("{}: {e}", path.display()))?;

    let genesis_text = read(&file.node.genesis, "genesis")?;
    let genesis = GenesisConfig::from_toml(&genesis_text)
        .and_then(|config| config.to_state())
        .map_err(|e| format!("{}: {}", file.node.genesis.display(), e.detail()))?;

    // High-value keys never exist as plaintext config outside devnet and regtest (19.2).
    if !genesis.network_kind.allows_development_keys() {
        return Err(format!(
            "node_key_file holds a plaintext key, which is refused on {}; use the signer (Phase 5)",
            genesis.network_kind
        ));
    }
    let key_text = read(&file.node.node_key_file, "node key")?;
    let seed = base16::decode_fixed::<32>(key_text.trim()).map_err(|e| {
        format!(
            "{}: node key must be 64 lowercase hex digits ({})",
            file.node.node_key_file.display(),
            e.detail()
        )
    })?;
    let node_key = Ed25519SigningKey::from_seed(&Secret::new(seed));
    let consensus_key = file
        .node
        .consensus_key_file
        .as_ref()
        .map(|path| {
            let text = read(path, "consensus key")?;
            let material = base16::decode_fixed::<32>(text.trim()).map_err(|e| {
                format!(
                    "{}: consensus key must be 64 lowercase hex digits ({})",
                    path.display(),
                    e.detail()
                )
            })?;
            BlsSecretKey::from_key_material(&Secret::new(material))
                .map_err(|e| format!("{}: {}", path.display(), e.detail()))
        })
        .transpose()?;

    let execution = file.execution.as_ref();
    let executor = match execution
        .and_then(|e| e.executor.as_deref())
        .unwrap_or("sandboxed")
    {
        "sandboxed" => {
            let program = match execution.and_then(|e| e.executor_path.clone()) {
                Some(path) => path,
                None => std::env::current_exe()
                    .map_err(|e| format!("cannot locate aletheiad to find the executor: {e}"))?
                    .with_file_name(format!(
                        "aletheia-arno-exec{}",
                        std::env::consts::EXE_SUFFIX
                    )),
            };
            if !program.is_file() {
                return Err(format!(
                    "the contract executor {} does not exist; install it or set [execution] executor_path",
                    program.display()
                ));
            }
            Executor::Sandboxed {
                program,
                timeout: Duration::from_millis(
                    execution.and_then(|e| e.call_timeout_ms).unwrap_or(10_000),
                ),
            }
        }
        "in-process" if genesis.network_kind.allows_development_keys() => Executor::InProcess,
        "in-process" => {
            return Err(format!(
                "in-process contract execution is refused on {}; contracts run in the sandboxed executor",
                genesis.network_kind
            ));
        }
        other => {
            return Err(format!(
                "[execution] executor \"{other}\" is not \"sandboxed\" or \"in-process\""
            ));
        }
    };

    let mut peers = Vec::with_capacity(file.peers.len());
    for peer in file.peers {
        let node_key = peer
            .node_key
            .map(|text| {
                base16::decode_fixed::<32>(&text)
                    .map_err(|e| format!("peer {} node_key: {}", peer.address, e.detail()))
            })
            .transpose()?;
        let cert_hash = peer
            .transport_cert_sha256
            .map(|text| {
                Hash32::parse(&text).map_err(|e| {
                    format!(
                        "peer {} transport_cert_sha256: {}",
                        peer.address,
                        e.detail()
                    )
                })
            })
            .transpose()?;
        peers.push(DialTarget {
            address: peer.address,
            expect: PeerExpectation {
                node_key,
                cert_hash,
            },
        });
    }

    Ok(Settings {
        data_dir: file.node.data_dir,
        genesis,
        listen: file.node.listen,
        peers,
        node_key,
        produce_every: file
            .devnet
            .map(|devnet| Duration::from_millis(devnet.produce_every_ms)),
        consensus_key,
        executor,
    })
}
