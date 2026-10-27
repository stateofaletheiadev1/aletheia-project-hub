//! `aletheia-signer`, the validator's signer daemon (spec Section 19.2, APS-0043, ADR-063).
//!
//! ```text
//! aletheia-signer keygen --kind consensus --out consensus-key.json --password-file pw \
//!                        --chain-id 7770 --network mainnet
//! aletheia-signer keygen --kind node --out node-key.json --password-file pw
//! aletheia-signer run --keystore consensus-key.json --password-file pw \
//!                     --state-dir /var/lib/aletheia-signer --socket /run/aletheia-signer/signer.sock
//! ```
//!
//! `keygen` writes a new key into an encrypted keystore (Argon2id + XChaCha20-Poly1305) and
//! prints the public values genesis needs. Key material is never printed.
//!
//! `run` holds the consensus key and answers `aletheiad` over a Unix socket. Every request
//! passes the high-water-mark check of `aletheia_signer::LocalSigner`, whose state is fsynced
//! before a signature leaves, so a compromised or restored node can get nothing signed that
//! could equivocate. The daemon opens no network sockets.
//!
//! Exit status: 0 stopped by a signal, 64 usage, 70 the state could not be made durable,
//! 78 configuration (keystore, password, state directory or socket).

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use aletheia_core::{ChainId, Hash32, NetworkIdentity, NetworkKind, base16};
use aletheia_crypto::{BlsSecretKey, Ed25519SigningKey, Secret};
use clap::{Parser, Subcommand, ValueEnum};

#[cfg_attr(not(unix), allow(dead_code, reason = "the daemon runs on Unix only"))]
const EXIT_FAIL_STOP: u8 = 70;
const EXIT_CONFIG: u8 = 78;

#[derive(Debug, Parser)]
#[command(
    name = "aletheia-signer",
    about = "The Aletheia validator signer daemon"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum Kind {
    /// The BLS12-381 consensus key (proposals, votes, timeouts).
    Consensus,
    /// The Ed25519 node identity key (peer-to-peer).
    Node,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Create a key in a new encrypted keystore and print its public values.
    Keygen {
        #[arg(long, value_enum)]
        kind: Kind,
        #[arg(long)]
        out: PathBuf,
        #[arg(long)]
        password_file: PathBuf,
        /// Consensus keys: the chain the proof of possession is for.
        #[arg(long)]
        chain_id: Option<u32>,
        /// Consensus keys: mainnet, private-validation, devnet or regtest.
        #[arg(long)]
        network: Option<String>,
    },
    /// Hold a consensus key and sign for aletheiad over a Unix socket.
    Run {
        #[arg(long)]
        keystore: PathBuf,
        #[arg(long)]
        password_file: PathBuf,
        #[arg(long)]
        state_dir: PathBuf,
        #[arg(long)]
        socket: PathBuf,
    },
}

fn log(level: &str, message: &str) {
    let line = format!("aletheia-signer {level} {message}\n");
    // A failed write to stderr has nowhere better to be reported.
    let _ = std::io::stderr().lock().write_all(line.as_bytes());
}

fn random<const N: usize>() -> Result<[u8; N], String> {
    let mut bytes = [0u8; N];
    getrandom::fill(&mut bytes).map_err(|e| format!("no randomness: {e}"))?;
    Ok(bytes)
}

fn network_kind(text: &str) -> Result<NetworkKind, String> {
    NetworkKind::ALL
        .into_iter()
        .find(|kind| kind.to_string() == text)
        .ok_or_else(|| {
            format!("network \"{text}\" is not one of mainnet, private-validation, devnet, regtest")
        })
}

/// Writes `contents` to a file that must not exist yet, readable by its owner only.
fn write_new(path: &Path, contents: &[u8]) -> Result<(), String> {
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(path)
        .map_err(|e| format!("cannot create {}: {e}", path.display()))?;
    file.write_all(contents)
        .and_then(|()| file.sync_all())
        .map_err(|e| format!("cannot write {}: {e}", path.display()))
}

fn keygen(
    kind: Kind,
    out: &Path,
    password_file: &Path,
    chain: Option<(u32, String)>,
) -> Result<String, String> {
    let password = std::fs::read_to_string(password_file)
        .map_err(|e| format!("cannot read {}: {e}", password_file.display()))?;
    let password = password
        .strip_suffix("\r\n")
        .or_else(|| password.strip_suffix('\n'))
        .unwrap_or(&password);
    if password.len() < 16 {
        return Err("the password must be at least 16 characters".to_owned());
    }
    let seed = Secret::new(random::<32>()?);
    let (label, printed) = match (kind, chain) {
        (Kind::Consensus, Some((chain_id, network))) => {
            let key = BlsSecretKey::from_key_material(&seed).map_err(|e| e.detail().to_owned())?;
            let public = key.public_key().to_bytes();
            // Before genesis exists its id is zero; proofs bind chain id and network kind only.
            let identity = NetworkIdentity::new(
                ChainId::new(chain_id),
                network_kind(&network)?,
                Hash32::ZERO,
            );
            let proof = key.prove_possession(&identity).to_bytes();
            (
                format!("consensus:{}", base16::encode(&public)),
                format!(
                    "consensus_key = \"{}\"\nproof_of_possession = \"{}\"\n",
                    base16::encode(&public),
                    base16::encode(&proof)
                ),
            )
        }
        (Kind::Consensus, None) => {
            return Err("a consensus key needs --chain-id and --network".to_owned());
        }
        (Kind::Node, _) => {
            let public = Ed25519SigningKey::from_seed(&seed).public_key().to_bytes();
            (
                format!("node:{}", base16::encode(&public)),
                format!("node_key = \"{}\"\n", base16::encode(&public)),
            )
        }
    };
    let sealed = aletheia_wallet::keystore::seal(
        &seed,
        password.as_bytes(),
        random::<16>()?,
        random::<24>()?,
        &label,
    )
    .map_err(|e| e.to_string())?;
    let mut text = sealed.to_string();
    text.push('\n');
    write_new(out, text.as_bytes())?;
    Ok(printed)
}

#[cfg(unix)]
fn run(keystore: &Path, password_file: &Path, state_dir: &Path, socket: &Path) -> ExitCode {
    use std::os::unix::fs::{FileTypeExt, PermissionsExt};
    use std::os::unix::net::UnixListener;
    use std::sync::{Arc, Mutex};

    let config_error = |message: String| {
        log("error", &format!("configuration refused: {message}"));
        ExitCode::from(EXIT_CONFIG)
    };
    let seed = match aletheia_wallet::keystore::open_with_password_file(keystore, password_file) {
        Ok(seed) => seed,
        Err(error) => return config_error(error.to_string()),
    };
    let key = match BlsSecretKey::from_key_material(&seed) {
        Ok(key) => key,
        Err(error) => return config_error(error.detail().to_owned()),
    };
    let signer = match aletheia_signer::LocalSigner::open(key, state_dir) {
        Ok(signer) => signer,
        Err(error) => return config_error(format!("{}: {}", state_dir.display(), error.detail())),
    };
    let public_key = base16::encode(&signer.public_key());
    let state = signer.state();
    let signer = Arc::new(Mutex::new(signer));

    if let Ok(metadata) = std::fs::symlink_metadata(socket) {
        if !metadata.file_type().is_socket() {
            return config_error(format!(
                "{} exists and is not a socket; refusing to replace it",
                socket.display()
            ));
        }
        if let Err(error) = std::fs::remove_file(socket) {
            return config_error(format!(
                "cannot remove the old {}: {error}",
                socket.display()
            ));
        }
    }
    let listener = match UnixListener::bind(socket) {
        Ok(listener) => listener,
        Err(error) => {
            return config_error(format!("cannot listen on {}: {error}", socket.display()));
        }
    };
    // Owner and group (aletheiad's) only.
    if let Err(error) = std::fs::set_permissions(socket, std::fs::Permissions::from_mode(0o660)) {
        return config_error(format!("cannot restrict {}: {error}", socket.display()));
    }
    let mark =
        |m: Option<aletheia_signer::Mark>| m.map_or("none".to_owned(), |m| m.round.to_string());
    log(
        "info",
        &format!(
            "signing on {} public_key={public_key} proposal_round={} vote_round={} timeout_round={}",
            socket.display(),
            mark(state.proposal),
            mark(state.vote),
            mark(state.timeout)
        ),
    );

    for connection in listener.incoming() {
        let mut stream = match connection {
            Ok(stream) => stream,
            Err(error) => {
                log("warn", &format!("accept failed: {error}"));
                continue;
            }
        };
        let signer = Arc::clone(&signer);
        let spawned = std::thread::Builder::new()
            .name("signer-connection".to_owned())
            .spawn(move || {
                match aletheia_signer::protocol::serve_connection(&signer, &mut stream) {
                    Ok(()) => {}
                    Err(aletheia_signer::protocol::ServeError::Io(error)) => {
                        log("warn", &format!("connection dropped: {error}"));
                    }
                    Err(aletheia_signer::protocol::ServeError::Fatal(error)) => {
                        log(
                            "error",
                            &format!(
                                "fail-stop: {} ({}): {}",
                                error.code().name(),
                                error.code().get(),
                                error.detail()
                            ),
                        );
                        std::process::exit(i32::from(EXIT_FAIL_STOP));
                    }
                }
            });
        if let Err(error) = spawned {
            log(
                "warn",
                &format!("cannot start a connection thread: {error}"),
            );
        }
    }
    ExitCode::SUCCESS
}

#[cfg(not(unix))]
fn run(_: &Path, _: &Path, _: &Path, _: &Path) -> ExitCode {
    log(
        "error",
        "the signer daemon serves a Unix socket and runs on Linux",
    );
    ExitCode::from(EXIT_CONFIG)
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Command::Keygen {
            kind,
            out,
            password_file,
            chain_id,
            network,
        } => {
            let chain = chain_id.zip(network);
            match keygen(kind, &out, &password_file, chain) {
                Ok(printed) => {
                    let _ = std::io::stdout().lock().write_all(printed.as_bytes());
                    ExitCode::SUCCESS
                }
                Err(message) => {
                    log("error", &message);
                    ExitCode::from(EXIT_CONFIG)
                }
            }
        }
        Command::Run {
            keystore,
            password_file,
            state_dir,
            socket,
        } => run(&keystore, &password_file, &state_dir, &socket),
    }
}
