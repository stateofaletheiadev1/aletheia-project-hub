//! `node.toml`: parsed strictly at the boundary (spec Section 46A.2 step 1). Unknown keys are
//! errors; safety settings have no defaults.
//!
//! ```toml
//! [node]
//! data_dir = "/var/lib/aletheia"
//! genesis = "/etc/aletheia/genesis.toml"
//! listen = "0.0.0.0:7771"
//! node_key_file = "/etc/aletheia/node.key"   # 64 lowercase hex digits; devnet/regtest only
//! node_keystore = "/etc/aletheia/node-key.json"       # or: the node key in an encrypted
//! node_key_password_file = "/run/credentials/aletheiad.service/node-key-password"  # keystore
//! consensus_key_file = "/etc/aletheia/consensus.key"  # validators: 64 hex digits of BLS key
//!                                             # material; devnet/regtest only
//!
//! [signer]                             # validators on every other network (ADR-063, Unix)
//! socket = "/run/aletheia-signer/signer.sock"
//! timeout_ms = 2000                    # per request; default 2000
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
//!
//! [storage]                            # optional: RocksDB memory and file budget
//! block_cache_mb = 256                 # default: an eighth of RAM, 64 to 512
//! write_buffer_mb = 128                # memtables, all column families; default as cache
//! max_open_files = 4096
//! background_jobs = 4
//!
//! [rpc]                                # optional: REST /api/v1 and JSON-RPC /rpc/v1
//! listen = "127.0.0.1:7781"
//! requests_per_second = 50             # per client IP; default 50
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
    storage: Option<StorageSection>,
    rpc: Option<RpcSection>,
    signer: Option<SignerSection>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SignerSection {
    socket: PathBuf,
    timeout_ms: Option<u64>,
}

/// The `aletheia-signer` daemon that holds this validator's consensus key.
#[derive(Debug, Clone)]
pub(crate) struct SignerSettings {
    pub(crate) socket: PathBuf,
    #[cfg_attr(
        not(unix),
        allow(dead_code, reason = "the signer daemon runs on Unix only")
    )]
    pub(crate) timeout: Duration,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct StorageSection {
    block_cache_mb: Option<u64>,
    write_buffer_mb: Option<u64>,
    max_open_files: Option<i32>,
    background_jobs: Option<i32>,
}

/// RocksDB's budget (Section 46.4). The block cache is the node's largest single use of
/// memory; on a small VPS it must leave room for the rest, with or without swap.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct StorageSettings {
    pub(crate) block_cache_bytes: usize,
    pub(crate) write_buffer_bytes: usize,
    pub(crate) max_open_files: i32,
    pub(crate) background_jobs: i32,
}

const MIB: u64 = 1024 * 1024;

/// An eighth of the memory the node may use (physical, or its control group's limit if
/// lower), kept between 64 MiB and 512 MiB: a 1 GiB VPS gets 128 MiB,
/// 4 GiB and more get 512 MiB. Swap is not counted: a cache that lives in swap is slower than
/// no cache at all.
fn default_block_cache_bytes(total: Option<u64>) -> u64 {
    total.map_or(512 * MIB, |bytes| (bytes / 8).clamp(64 * MIB, 512 * MIB))
}

fn storage_settings(section: Option<&StorageSection>) -> Result<StorageSettings, String> {
    let cache = match section.and_then(|s| s.block_cache_mb) {
        Some(mb) if !(16..=65_536).contains(&mb) => {
            return Err(format!(
                "[storage] block_cache_mb = {mb} is outside 16 to 65536"
            ));
        }
        Some(mb) => mb.saturating_mul(MIB),
        None => default_block_cache_bytes(aletheia_node::host::memory_limit_bytes()),
    };
    // Memtables default to the cache's size, at most 256 MiB: on a 1 GiB VPS 128 + 128 MiB.
    let write_buffer = match section.and_then(|s| s.write_buffer_mb) {
        Some(mb) if !(16..=16_384).contains(&mb) => {
            return Err(format!(
                "[storage] write_buffer_mb = {mb} is outside 16 to 16384"
            ));
        }
        Some(mb) => mb.saturating_mul(MIB),
        None => cache.min(256 * MIB),
    };
    let max_open_files = section.and_then(|s| s.max_open_files).unwrap_or(4096);
    if !(64..=1_000_000).contains(&max_open_files) {
        return Err(format!(
            "[storage] max_open_files = {max_open_files} is outside 64 to 1000000"
        ));
    }
    let background_jobs = section.and_then(|s| s.background_jobs).unwrap_or(4);
    if !(1..=64).contains(&background_jobs) {
        return Err(format!(
            "[storage] background_jobs = {background_jobs} is outside 1 to 64"
        ));
    }
    Ok(StorageSettings {
        block_cache_bytes: usize::try_from(cache).unwrap_or(usize::MAX),
        write_buffer_bytes: usize::try_from(write_buffer).unwrap_or(usize::MAX),
        max_open_files,
        background_jobs,
    })
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RpcSection {
    listen: SocketAddr,
    requests_per_second: Option<u32>,
}

/// Where the public RPC listens, and its per-IP budget.
#[derive(Debug, Clone, Copy)]
pub(crate) struct RpcSettings {
    pub(crate) listen: SocketAddr,
    pub(crate) requests_per_second: u32,
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
    node_key_file: Option<PathBuf>,
    node_keystore: Option<PathBuf>,
    node_key_password_file: Option<PathBuf>,
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
    pub(crate) signer: Option<SignerSettings>,
    pub(crate) executor: Executor,
    pub(crate) storage: StorageSettings,
    pub(crate) rpc: Option<RpcSettings>,
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
    let development = genesis.network_kind.allows_development_keys();
    let node_key = match (
        &file.node.node_key_file,
        &file.node.node_keystore,
        &file.node.node_key_password_file,
    ) {
        (Some(_), None, None) if !development => {
            return Err(format!(
                "node_key_file holds a plaintext key, which is refused on {}; use node_keystore",
                genesis.network_kind
            ));
        }
        (Some(path), None, None) => {
            let key_text = read(path, "node key")?;
            let seed = base16::decode_fixed::<32>(key_text.trim()).map_err(|e| {
                format!(
                    "{}: node key must be 64 lowercase hex digits ({})",
                    path.display(),
                    e.detail()
                )
            })?;
            Ed25519SigningKey::from_seed(&Secret::new(seed))
        }
        (None, Some(keystore), Some(password)) => {
            let seed = aletheia_wallet::keystore::open_with_password_file(keystore, password)
                .map_err(|e| format!("node key: {e}"))?;
            Ed25519SigningKey::from_seed(&seed)
        }
        _ => {
            return Err(
                "[node] needs node_key_file, or node_keystore with node_key_password_file"
                    .to_owned(),
            );
        }
    };
    if file.node.consensus_key_file.is_some() && !development {
        return Err(format!(
            "consensus_key_file holds a plaintext key, which is refused on {}; use [signer]",
            genesis.network_kind
        ));
    }
    let signer = file.signer.map(|section| SignerSettings {
        socket: section.socket,
        timeout: Duration::from_millis(section.timeout_ms.unwrap_or(2_000)),
    });
    if let Some(signer) = &signer {
        if file.node.consensus_key_file.is_some() {
            return Err("give consensus_key_file or [signer], not both".to_owned());
        }
        if !cfg!(unix) {
            return Err(format!(
                "[signer] socket {} needs a Unix host; the signer daemon runs on Linux",
                signer.socket.display()
            ));
        }
    }
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

    let storage = storage_settings(file.storage.as_ref())?;
    let rpc = file.rpc.map(|section| RpcSettings {
        listen: section.listen,
        requests_per_second: section
            .requests_per_second
            .unwrap_or(aletheia_rpc::server::DEFAULT_REQUESTS_PER_SECOND),
    });
    Ok(Settings {
        rpc,
        data_dir: file.node.data_dir,
        genesis,
        listen: file.node.listen,
        peers,
        node_key,
        produce_every: file
            .devnet
            .map(|devnet| Duration::from_millis(devnet.produce_every_ms)),
        consensus_key,
        signer,
        executor,
        storage,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_default_cache_scales_with_memory_within_bounds() {
        assert_eq!(default_block_cache_bytes(Some(512 * MIB)), 64 * MIB);
        assert_eq!(default_block_cache_bytes(Some(1024 * MIB)), 128 * MIB);
        assert_eq!(default_block_cache_bytes(Some(2048 * MIB)), 256 * MIB);
        assert_eq!(default_block_cache_bytes(Some(64 * 1024 * MIB)), 512 * MIB);
        assert_eq!(default_block_cache_bytes(None), 512 * MIB);
    }

    #[test]
    fn storage_settings_refuse_nonsense() {
        let section = |mb, files, jobs| StorageSection {
            block_cache_mb: mb,
            write_buffer_mb: None,
            max_open_files: files,
            background_jobs: jobs,
        };
        assert!(storage_settings(Some(&section(Some(8), None, None))).is_err());
        assert!(storage_settings(Some(&section(None, Some(10), None))).is_err());
        assert!(storage_settings(Some(&section(None, None, Some(0)))).is_err());
        let ok = storage_settings(Some(&section(Some(128), Some(1024), Some(2)))).unwrap();
        assert_eq!(ok.block_cache_bytes, 128 * 1024 * 1024);
        assert_eq!(ok.write_buffer_bytes, 128 * 1024 * 1024);
        assert_eq!((ok.max_open_files, ok.background_jobs), (1024, 2));
    }
}
