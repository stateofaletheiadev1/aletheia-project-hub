//! `aletheiad`, the node daemon (spec Sections 46A.2-46A.4, 56, 59).
//!
//! ```text
//! aletheiad --config /etc/aletheia/node.toml
//! ```
//!
//! Exit status (docs/operations/exit-codes.md):
//!   0   stopped cleanly on SIGTERM / SIGINT
//!   64  usage error
//!   70  fail-stop (EX_SOFTWARE): an invariant, storage or finality error; recovery runs on restart
//!   75  clean halt (EX_TEMPFAIL): the next height needs a protocol version this binary lacks
//!   78  configuration error (EX_CONFIG)
//!
//! Log lines are written for the operator during an incident (46A.4): lower-case, `key=value`,
//! no decoration. They go to stderr until the binary log backend (Section 45) lands.

mod config;
mod oplog;

use std::process::ExitCode;

use aletheia_core::{AletheiaError, ErrorCode};
use aletheia_node::{Node, NodeConfig};

const EXIT_USAGE: u8 = 64;
const EXIT_FAIL_STOP: u8 = 70;
const EXIT_UPGRADE_REQUIRED: u8 = 75;
const EXIT_CONFIG: u8 = 78;

fn config_path() -> Result<std::path::PathBuf, String> {
    let mut args = std::env::args().skip(1);
    match (args.next().as_deref(), args.next(), args.next()) {
        (Some("--config"), Some(path), None) => Ok(path.into()),
        _ => Err("usage: aletheiad --config <path/to/node.toml>".to_owned()),
    }
}

#[cfg(feature = "rocksdb")]
fn open_store(
    data_dir: &std::path::Path,
    storage: &config::StorageSettings,
) -> Result<aletheia_storage::rocks::RocksKvStore, AletheiaError> {
    use aletheia_storage::rocks::{OpenMode, RocksKvStore, StorageBudget};
    let mode = if data_dir.join("DATADIR").exists() {
        OpenMode::Existing
    } else {
        OpenMode::CreateNew
    };
    let budget = StorageBudget {
        max_open_files: storage.max_open_files,
        background_jobs: storage.background_jobs,
        block_cache_bytes: storage.block_cache_bytes,
        write_buffer_bytes: storage.write_buffer_bytes,
    };
    RocksKvStore::open(&data_dir.join("state"), &budget, mode)
}

#[cfg(not(feature = "rocksdb"))]
fn open_store(
    _: &std::path::Path,
    _: &config::StorageSettings,
) -> Result<aletheia_storage::MemoryKvStore, AletheiaError> {
    oplog::warn(
        "storage=memory: this build keeps state in RAM only (NON-PRODUCTION); build with --features rocksdb",
    );
    Ok(aletheia_storage::MemoryKvStore::new())
}

/// Reaches the signer daemon before the node starts, so a missing or wrong signer is a
/// configuration error rather than a validator that silently never votes.
#[cfg(unix)]
fn connect_signer(
    signer: Option<&config::SignerSettings>,
) -> Result<Option<aletheia_signer::RemoteSigner>, String> {
    let Some(signer) = signer else {
        return Ok(None);
    };
    let remote = aletheia_signer::RemoteSigner::unix(signer.socket.clone(), signer.timeout)
        .map_err(|e| format!("signer: {}", e.detail()))?;
    oplog::line(&format!(
        "consensus key held by the signer at {} public_key={}",
        signer.socket.display(),
        aletheia_core::base16::encode(&remote.public_key())
    ));
    Ok(Some(remote))
}

#[cfg(not(unix))]
fn connect_signer(
    signer: Option<&config::SignerSettings>,
) -> Result<Option<aletheia_signer::RemoteSigner>, String> {
    match signer {
        None => Ok(None),
        Some(_) => Err("the signer daemon needs a Unix host".to_owned()),
    }
}

fn exit_for(error: &AletheiaError) -> ExitCode {
    if error.code() == ErrorCode::ProtocolUpgradeRequired {
        oplog::line(&format!("stopped cleanly: {}", error.detail()));
        oplog::line(
            "install a release that supports that version and start the node again; it continues from its last finalized height",
        );
        return ExitCode::from(EXIT_UPGRADE_REQUIRED);
    }
    oplog::error(&format!(
        "fail-stop: {} ({}): {} - recovery runs on restart, see docs/operations/recovery.md",
        error.code().name(),
        error.code().get(),
        error.detail()
    ));
    ExitCode::from(EXIT_FAIL_STOP)
}

#[tokio::main(flavor = "multi_thread", worker_threads = 4)]
async fn main() -> ExitCode {
    let path = match config_path() {
        Ok(path) => path,
        Err(usage) => {
            oplog::error(&usage);
            return ExitCode::from(EXIT_USAGE);
        }
    };
    let settings = match config::load(&path) {
        Ok(settings) => settings,
        Err(reason) => {
            oplog::error(&format!("configuration refused: {reason}"));
            return ExitCode::from(EXIT_CONFIG);
        }
    };
    let network = settings.genesis.network();
    oplog::line(&format!(
        "configuration loaded path={} network={} chain_id={} genesis_id={}",
        path.display(),
        network.network_kind(),
        network.chain_id(),
        network.genesis_id()
    ));

    match &settings.executor {
        config::Executor::Sandboxed { program, timeout } => {
            aletheia_execution::runner::install(Box::new(aletheia_executor::ProcessRunner::new(
                aletheia_executor::ExecutorConfig {
                    program: program.clone(),
                    args: Vec::new(),
                    timeout: *timeout,
                    pool: 2,
                },
            )));
            oplog::line(&format!(
                "contracts run in the sandboxed executor {}",
                program.display()
            ));
        }
        config::Executor::InProcess => {
            oplog::line("contracts run in-process (devnet/regtest only)");
        }
    }

    oplog::line(&format!(
        "storage block_cache_mb={} write_buffer_mb={} max_open_files={} background_jobs={}",
        settings.storage.block_cache_bytes / (1024 * 1024),
        settings.storage.write_buffer_bytes / (1024 * 1024),
        settings.storage.max_open_files,
        settings.storage.background_jobs
    ));
    let store = match open_store(&settings.data_dir, &settings.storage) {
        Ok(store) => store,
        Err(error) => return exit_for(&error),
    };
    let remote_signer = match connect_signer(settings.signer.as_ref()) {
        Ok(remote) => remote,
        Err(reason) => {
            oplog::error(&format!("configuration refused: {reason}"));
            return ExitCode::from(EXIT_CONFIG);
        }
    };
    let config = NodeConfig {
        data_dir: settings.data_dir.clone(),
        genesis: settings.genesis,
        listen: settings.listen,
        peers: settings.peers,
        node_key: settings.node_key,
        produce_every: settings.produce_every,
        consensus_key: settings.consensus_key,
        remote_signer,
    };
    let mut node = match Node::start(config, store).await {
        Ok(node) => node,
        Err(error) if error.code() == ErrorCode::DecodeNonCanonical => {
            oplog::error(&format!("configuration refused: {}", error.detail()));
            return ExitCode::from(EXIT_CONFIG);
        }
        Err(error) => return exit_for(&error),
    };
    let rpc_task = match settings.rpc {
        Some(rpc) => match tokio::net::TcpListener::bind(rpc.listen).await {
            Ok(listener) => {
                let bound = listener.local_addr().map_or(rpc.listen, |a| a);
                oplog::line(&format!(
                    "rpc listening on {bound} (REST /api/v1, JSON-RPC /rpc/v1)"
                ));
                let service = aletheia_rpc::Service::new(node.rpc_backend());
                Some(tokio::spawn(aletheia_rpc::server::serve(
                    listener,
                    service,
                    rpc.requests_per_second,
                )))
            }
            Err(error) => {
                oplog::error(&format!("cannot listen for rpc on {}: {error}", rpc.listen));
                let _ = node.shutdown().await;
                return ExitCode::from(EXIT_CONFIG);
            }
        },
        None => None,
    };
    let tip = node.tip();
    oplog::line(&format!(
        "following data_dir={} listen={} finalized_height={} hash={} state_root={}",
        settings.data_dir.display(),
        node.local_addr(),
        tip.height,
        aletheia_core::BlockId::from_hash(tip.hash).to_text(network.network_kind()),
        tip.state_root
    ));

    let outcome = tokio::select! {
        result = node.stopped() => result,
        () = shutdown_signal() => {
            oplog::line("shutdown requested: stopping intake, draining the chain thread");
            Ok(())
        }
    };
    if let Some(task) = rpc_task {
        task.abort();
    }
    let last = node.tip();
    let drained = node.shutdown().await;
    match outcome.and(drained) {
        Ok(()) => {
            oplog::line(&format!(
                "stopped cleanly finalized_height={} state_root={}",
                last.height, last.state_root
            ));
            ExitCode::SUCCESS
        }
        Err(error) => exit_for(&error),
    }
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let mut term =
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                Ok(term) => term,
                Err(_) => return std::future::pending().await,
            };
        tokio::select! {
            _ = term.recv() => {}
            _ = tokio::signal::ctrl_c() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
