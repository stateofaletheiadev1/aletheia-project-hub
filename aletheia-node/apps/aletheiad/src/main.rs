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
) -> Result<aletheia_storage::rocks::RocksKvStore, AletheiaError> {
    use aletheia_storage::rocks::{OpenMode, RocksKvStore, StorageBudget};
    let mode = if data_dir.join("DATADIR").exists() {
        OpenMode::Existing
    } else {
        OpenMode::CreateNew
    };
    RocksKvStore::open(&data_dir.join("state"), &StorageBudget::default(), mode)
}

#[cfg(not(feature = "rocksdb"))]
fn open_store(_: &std::path::Path) -> Result<aletheia_storage::MemoryKvStore, AletheiaError> {
    oplog::warn(
        "storage=memory: this build keeps state in RAM only (NON-PRODUCTION); build with --features rocksdb",
    );
    Ok(aletheia_storage::MemoryKvStore::new())
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

    let store = match open_store(&settings.data_dir) {
        Ok(store) => store,
        Err(error) => return exit_for(&error),
    };
    let config = NodeConfig {
        data_dir: settings.data_dir.clone(),
        genesis: settings.genesis,
        listen: settings.listen,
        peers: settings.peers,
        node_key: settings.node_key,
        produce_every: settings.produce_every,
        consensus_key: settings.consensus_key,
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
