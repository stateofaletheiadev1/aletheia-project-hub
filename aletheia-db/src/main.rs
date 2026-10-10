use std::sync::Arc;
use std::time::{Duration, Instant};

use aletheiadb::api::{self, AppState, VERSION};
use aletheiadb::auth;
use aletheiadb::config::Config;
use aletheiadb::store::Store;

const HELP: &str = "AletheiaDB — the document database of the Sovereign Covenant State of Aletheia

Usage:
  aletheiadb serve      Run the server (configured by environment variables)
  aletheiadb keygen     Generate a root key and the hash to put in ALETHEIADB_ROOT_KEY_SHA256
  aletheiadb version    Print the version

Environment:
  ALETHEIADB_LISTEN            address:port (default 127.0.0.1:7790)
  ALETHEIADB_DATA_DIR          data directory (default ./data)
  ALETHEIADB_ROOT_KEY_SHA256   SHA-256 of the root key secret (unset disables the root key)
  ALETHEIADB_CACHE_MB          page cache in MB (default 64)
  RUST_LOG                     log filter (default info)";

fn main() {
    let cmd = std::env::args().nth(1).unwrap_or_default();
    match cmd.as_str() {
        "serve" => serve(),
        "keygen" => keygen(),
        "version" | "--version" | "-V" => println!("aletheiadb {VERSION}"),
        _ => {
            println!("{HELP}");
            if !matches!(cmd.as_str(), "" | "help" | "--help" | "-h") {
                std::process::exit(2);
            }
        }
    }
}

fn keygen() {
    let secret = auth::new_secret();
    println!("Root key (store it in a password manager; it is shown once):");
    println!("  root.{secret}");
    println!();
    println!("Put this line in the server's aletheiadb.env:");
    println!("  ALETHEIADB_ROOT_KEY_SHA256={}", auth::sha256_hex(secret.as_bytes()));
}

fn serve() {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with_current_span(false)
        .init();

    let cfg = match Config::from_env() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("configuration error: {e}");
            std::process::exit(2);
        }
    };

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .max_blocking_threads(8)
        .enable_all()
        .build()
        .expect("tokio runtime");
    runtime.block_on(async move {
        if let Err(e) = std::fs::create_dir_all(&cfg.data_dir) {
            tracing::error!(error = %e, dir = %cfg.data_dir.display(), "cannot create data directory");
            std::process::exit(1);
        }
        let path = cfg.data_dir.join("aletheia.redb");
        let store = match Store::open(&path, cfg.cache_bytes) {
            Ok(s) => Arc::new(s),
            Err(e) => {
                tracing::error!(error = %e, file = %path.display(), "cannot open the database file");
                std::process::exit(1);
            }
        };
        if cfg.root_secret_sha256.is_none() {
            tracing::warn!("ALETHEIADB_ROOT_KEY_SHA256 is not set: the root key is disabled");
        }

        // Expired idempotency records are swept hourly.
        let sweeper = store.clone();
        tokio::spawn(async move {
            let mut every = tokio::time::interval(Duration::from_secs(3600));
            loop {
                every.tick().await;
                let s = sweeper.clone();
                match tokio::task::spawn_blocking(move || s.purge_idempotency()).await {
                    Ok(Ok(left)) => tracing::info!(remaining = left, "idempotency records swept"),
                    Ok(Err(e)) => tracing::warn!(error = %e, "idempotency sweep failed"),
                    Err(e) => tracing::warn!(error = %e, "idempotency sweep panicked"),
                }
            }
        });

        let state = AppState {
            store,
            root_secret_sha256: cfg.root_secret_sha256.clone(),
            started: Instant::now(),
        };
        let listener = match tokio::net::TcpListener::bind(cfg.listen).await {
            Ok(l) => l,
            Err(e) => {
                tracing::error!(error = %e, listen = %cfg.listen, "cannot listen");
                std::process::exit(1);
            }
        };
        tracing::info!(version = VERSION, listen = %cfg.listen, data = %path.display(), "aletheiadb started");
        axum::serve(listener, api::router(state))
            .with_graceful_shutdown(shutdown())
            .await
            .expect("server error");
        tracing::info!("aletheiadb stopped");
    });
}

async fn shutdown() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let term = async {
        if let Ok(mut s) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            s.recv().await;
        }
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = term => {} }
}
