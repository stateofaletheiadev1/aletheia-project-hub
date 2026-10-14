//! `aletheia-cli`: the user and operator client (spec Section 56).
//!
//! ```text
//! aletheia-cli [--rpc 127.0.0.1:7781] [--output text|json] [--network devnet] <command>
//!   status
//!   keys new  --keystore wallet.json        create a key (password asked without echo)
//!   keys show --keystore wallet.json        the address, no password needed
//!   account <alt:…>                         nonce and existence
//!   balance <alt:…> [--asset AEY]
//!   transfer --keystore wallet.json --to <alt:…> --amount 1.5 [--asset AEY] [--yes]
//!   tx show <alt:T…>   receipt <alt:T…>   block show <height | alt:B…>
//! ```
//!
//! Every command checks that the node is on the expected network when `--network` is given.
//! Secrets are never printed; the password is read without echo, or from the file named by
//! `ALETHEIA_PASSWORD_FILE` for automation.

use std::io::Write;
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Duration;

use aletheia_core::{Address, AssetId};
use aletheia_crypto::Secret;
use aletheia_wallet::derive::{PROVISIONAL_COIN_TYPE, account_key};
use aletheia_wallet::{
    Account, HttpRpc, Rpc, TransferRequest, WalletError, keystore, node_network, parse_amount,
    transfer,
};
use clap::{Parser, Subcommand, ValueEnum};
use serde_json::{Value, json};

#[derive(Debug, Clone, Copy, ValueEnum, PartialEq, Eq)]
enum Output {
    Text,
    Json,
}

#[derive(Debug, Parser)]
#[command(name = "aletheia-cli", version, about = "Aletheia StableChain client")]
struct Cli {
    /// The node's RPC address (host:port).
    #[arg(long, global = true, default_value = "127.0.0.1:7781")]
    rpc: String,
    /// Output format: text for people, json for scripts (a stable schema).
    #[arg(long, global = true, value_enum, default_value_t = Output::Text)]
    output: Output,
    /// Refuse to talk to a node on any other network (mainnet, private-validation, devnet, regtest).
    #[arg(long, global = true)]
    network: Option<String>,
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// The node's network, protocol version and finalized height.
    Status,
    /// Key management.
    Keys {
        #[command(subcommand)]
        action: Keys,
    },
    /// An account's nonce.
    Account { address: String },
    /// An account's balance.
    Balance {
        address: String,
        #[arg(long, default_value = "AEY")]
        asset: String,
    },
    /// Send an asset: simulate, show a summary, sign, submit and track to FINALIZED.
    Transfer {
        #[arg(long)]
        keystore: PathBuf,
        #[arg(long)]
        to: String,
        /// Amount in the asset's units, e.g. 1.5.
        #[arg(long)]
        amount: String,
        #[arg(long, default_value = "AEY")]
        asset: String,
        #[arg(long, default_value = "ALnT")]
        fee_asset: String,
        #[arg(long, default_value_t = 10_000)]
        max_fee: u128,
        #[arg(long, default_value_t = 10_000)]
        eu_limit: u64,
        /// Sign without asking for confirmation.
        #[arg(long)]
        yes: bool,
    },
    /// Transactions.
    Tx {
        #[command(subcommand)]
        action: Tx,
    },
    /// A transaction's receipt.
    Receipt { tx_id: String },
    /// Blocks.
    Block {
        #[command(subcommand)]
        action: Block,
    },
}

#[derive(Debug, Subcommand)]
enum Keys {
    /// Create a new key and seal it in a keystore file.
    New {
        #[arg(long)]
        keystore: PathBuf,
    },
    /// Show the address in a keystore (no password needed).
    Show {
        #[arg(long)]
        keystore: PathBuf,
    },
}

#[derive(Debug, Subcommand)]
enum Tx {
    Show { tx_id: String },
}

#[derive(Debug, Subcommand)]
enum Block {
    Show { block: String },
}

fn fail(message: impl Into<String>) -> WalletError {
    WalletError(message.into())
}

fn out(text: &str) {
    let mut stdout = std::io::stdout();
    let _ = writeln!(stdout, "{text}");
}

fn password(prompt: &str) -> Result<Secret<String>, WalletError> {
    if let Ok(path) = std::env::var("ALETHEIA_PASSWORD_FILE") {
        let text = std::fs::read_to_string(&path)
            .map_err(|e| fail(format!("cannot read the password file {path}: {e}")))?;
        return Ok(Secret::new(text.trim_end_matches(['\r', '\n']).to_owned()));
    }
    rpassword::prompt_password(prompt)
        .map(Secret::new)
        .map_err(|e| fail(format!("cannot read the password: {e}")))
}

fn asset(text: &str) -> Result<AssetId, WalletError> {
    match text {
        "AEY" => Ok(AssetId::AEY),
        "ALnT" => Ok(AssetId::ALNT),
        other => other
            .parse::<u32>()
            .map(AssetId::new)
            .map_err(|_| fail(format!("\"{other}\" is not an asset"))),
    }
}

async fn checked_network(
    rpc: &HttpRpc,
    expected: Option<&str>,
) -> Result<aletheia_core::NetworkIdentity, WalletError> {
    let (network, _) = node_network(rpc).await?;
    if let Some(expected) = expected
        && network.network_kind().to_string() != expected
    {
        return Err(fail(format!(
            "the node is on {}, not {expected}; nothing was done",
            network.network_kind()
        )));
    }
    Ok(network)
}

/// `label  value` rows, aligned as in Section 56.
fn rows(pairs: &[(&str, String)]) -> String {
    pairs
        .iter()
        .map(|(label, value)| format!("{label:<17}{value}"))
        .collect::<Vec<_>>()
        .join("\n")
}

fn s(value: &Value, path: &[&str]) -> String {
    let node = path.iter().try_fold(value, |node, key| node.get(key));
    match node {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Null) | None => String::new(),
        Some(other) => other.to_string(),
    }
}

fn show_tx(tx: &Value) -> String {
    let mut pairs = vec![
        ("Transaction", s(tx, &["txId"])),
        ("Status", s(tx, &["status"])),
        (
            "Block",
            format!(
                "#{}   {}",
                s(tx, &["block", "height"]),
                s(tx, &["block", "id"])
            ),
        ),
        ("Slot", s(tx, &["block", "slot"])),
        ("Sender", s(tx, &["sender"])),
        ("Type", s(tx, &["type"])),
    ];
    if tx.get("transfer").is_some() {
        pairs.push(("Recipient", s(tx, &["transfer", "recipient"])));
        pairs.push((
            "Amount",
            format!(
                "{} {}",
                s(tx, &["transfer", "display"]),
                s(tx, &["transfer", "asset"])
            ),
        ));
    }
    if tx.get("receipt").is_some() {
        pairs.push((
            "Execution Units",
            format!(
                "{} / {}",
                s(tx, &["receipt", "euUsed"]),
                s(tx, &["fee", "euLimit"])
            ),
        ));
        pairs.push((
            "Fee",
            format!(
                "{} (base units of {})",
                s(tx, &["receipt", "feeCharged"]),
                s(tx, &["fee", "asset"])
            ),
        ));
        let error = s(tx, &["receipt", "errorName"]);
        let result = if error.is_empty() {
            s(tx, &["receipt", "status"])
        } else {
            format!("{}   {error}", s(tx, &["receipt", "status"]))
        };
        pairs.push(("State Result", result));
    }
    rows(&pairs)
}

async fn run(cli: Cli) -> Result<(), WalletError> {
    let rpc = HttpRpc::parse(&cli.rpc)?;
    let json_out = cli.output == Output::Json;
    let expected = cli.network.as_deref();
    let print = |value: &Value, text: String| {
        if json_out {
            out(&serde_json::to_string_pretty(value).unwrap_or_default());
        } else {
            out(&text);
        }
    };
    match cli.command {
        Command::Status => {
            checked_network(&rpc, expected).await?;
            let status = rpc.call("getNetworkStatus", json!({})).await?;
            print(
                &status,
                rows(&[
                    (
                        "Network",
                        format!(
                            "{} (chain {})",
                            s(&status, &["network"]),
                            s(&status, &["chainId"])
                        ),
                    ),
                    ("Protocol", s(&status, &["protocolVersion"])),
                    (
                        "Finalized",
                        format!(
                            "#{}   {}",
                            s(&status, &["finalizedHeight"]),
                            s(&status, &["finalizedBlock"])
                        ),
                    ),
                ]),
            );
        }
        Command::Keys {
            action: Keys::New { keystore: path },
        } => {
            if path.exists() {
                return Err(fail(format!(
                    "{} exists; nothing was overwritten",
                    path.display()
                )));
            }
            let network = checked_network(&rpc, expected).await?;
            let mut seed = [0u8; 32];
            getrandom::fill(&mut seed).map_err(|e| fail(format!("no randomness: {e}")))?;
            let seed = Secret::new(seed);
            let derived = account_key(seed.expose(), PROVISIONAL_COIN_TYPE, 0, 0)?;
            let address = Account::new(derived.key(), network)
                .address()
                .to_text(network.network_kind());
            let first = password("New keystore password: ")?;
            let second = password("Repeat the password: ")?;
            if first.expose() != second.expose() {
                return Err(fail("the passwords differ; nothing was written"));
            }
            let mut salt = [0u8; 16];
            let mut nonce = [0u8; 24];
            getrandom::fill(&mut salt).map_err(|e| fail(format!("no randomness: {e}")))?;
            getrandom::fill(&mut nonce).map_err(|e| fail(format!("no randomness: {e}")))?;
            let mut file = keystore::seal(&seed, first.expose().as_bytes(), salt, nonce, &address)?;
            if let Some(map) = file.as_object_mut() {
                map.insert(
                    "network".to_owned(),
                    json!(network.network_kind().to_string()),
                );
                map.insert("chainId".to_owned(), json!(network.chain_id().get()));
                map.insert(
                    "path".to_owned(),
                    json!(format!("m/44'/{PROVISIONAL_COIN_TYPE}'/0'/0'/0'")),
                );
            }
            std::fs::write(
                &path,
                serde_json::to_string_pretty(&file).unwrap_or_default(),
            )
            .map_err(|e| fail(format!("cannot write {}: {e}", path.display())))?;
            print(
                &json!({ "address": address, "keystore": path.display().to_string() }),
                rows(&[
                    ("Address", address.clone()),
                    ("Keystore", path.display().to_string()),
                ]),
            );
        }
        Command::Keys {
            action: Keys::Show { keystore: path },
        } => {
            let file: Value = serde_json::from_str(
                &std::fs::read_to_string(&path)
                    .map_err(|e| fail(format!("cannot read {}: {e}", path.display())))?,
            )
            .map_err(|_| fail(format!("{} is not a keystore", path.display())))?;
            let address = s(&file, &["address"]);
            print(
                &json!({ "address": address, "network": s(&file, &["network"]) }),
                rows(&[
                    ("Address", address.clone()),
                    ("Network", s(&file, &["network"])),
                ]),
            );
        }
        Command::Account { address } => {
            checked_network(&rpc, expected).await?;
            let account = rpc
                .call("getAccount", json!({ "address": address }))
                .await?;
            print(
                &account,
                rows(&[
                    ("Address", s(&account, &["address"])),
                    ("Nonce", s(&account, &["nonce"])),
                    ("Exists", s(&account, &["exists"])),
                ]),
            );
        }
        Command::Balance { address, asset } => {
            checked_network(&rpc, expected).await?;
            let balance = rpc
                .call("getBalance", json!({ "address": address, "asset": asset }))
                .await?;
            print(
                &balance,
                rows(&[
                    ("Address", s(&balance, &["address"])),
                    (
                        "Available",
                        format!("{} {}", s(&balance, &["display"]), s(&balance, &["asset"])),
                    ),
                    (
                        "Locked",
                        format!("{} (base units)", s(&balance, &["locked"])),
                    ),
                    ("At height", s(&balance, &["height"])),
                ]),
            );
        }
        Command::Transfer {
            keystore: path,
            to,
            amount,
            asset: asset_name,
            fee_asset,
            max_fee,
            eu_limit,
            yes,
        } => {
            let network = checked_network(&rpc, expected).await?;
            let file: Value = serde_json::from_str(
                &std::fs::read_to_string(&path)
                    .map_err(|e| fail(format!("cannot read {}: {e}", path.display())))?,
            )
            .map_err(|_| fail(format!("{} is not a keystore", path.display())))?;
            if file.get("chainId").and_then(Value::as_u64)
                != Some(u64::from(network.chain_id().get()))
            {
                return Err(fail(
                    "this keystore was made for another chain; nothing was signed",
                ));
            }
            let recipient = Address::parse(&to, network.network_kind())
                .map_err(|e| fail(format!("recipient: {}", e.detail())))?;
            let request = TransferRequest {
                recipient,
                asset: asset(&asset_name)?,
                amount: parse_amount(&amount, 18)?,
                fee_asset: asset(&fee_asset)?,
                max_fee,
                eu_limit,
                validity_slots: 1_000,
            };
            let pass = password("Keystore password: ")?;
            let seed = keystore::open(&file, pass.expose().as_bytes())?;
            let derived = account_key(seed.expose(), PROVISIONAL_COIN_TYPE, 0, 0)?;
            let account = Account::new(derived.key(), network);
            let confirm = |summary: &aletheia_wallet::Summary| {
                if json_out || yes {
                    return yes;
                }
                out(&summary.to_string());
                let mut stdout = std::io::stdout();
                let _ = write!(stdout, "Sign and send? [y/N] ");
                let _ = stdout.flush();
                let mut answer = String::new();
                std::io::stdin().read_line(&mut answer).is_ok()
                    && answer.trim().eq_ignore_ascii_case("y")
            };
            let sent = transfer(&rpc, &account, &request, confirm, Duration::from_secs(60)).await?;
            match &sent.finalized {
                Some(tx) => print(tx, show_tx(tx)),
                None => print(
                    &json!({ "txId": sent.tx_id, "status": "SUBMITTED" }),
                    format!(
                        "Submitted {}; not finalized yet: check with `tx show`.",
                        sent.tx_id
                    ),
                ),
            }
        }
        Command::Tx {
            action: Tx::Show { tx_id },
        } => {
            checked_network(&rpc, expected).await?;
            let tx = rpc.call("getTransaction", json!({ "txId": tx_id })).await?;
            print(&tx, show_tx(&tx));
        }
        Command::Receipt { tx_id } => {
            checked_network(&rpc, expected).await?;
            let receipt = rpc.call("getReceipt", json!({ "txId": tx_id })).await?;
            print(
                &receipt,
                rows(&[
                    ("Transaction", s(&receipt, &["txId"])),
                    ("Status", s(&receipt, &["status"])),
                    (
                        "Block",
                        format!(
                            "#{}   {}",
                            s(&receipt, &["height"]),
                            s(&receipt, &["block"])
                        ),
                    ),
                    ("Execution Units", s(&receipt, &["euUsed"])),
                    (
                        "Fee",
                        format!(
                            "{} {}",
                            s(&receipt, &["fee", "display"]),
                            s(&receipt, &["fee", "asset"])
                        ),
                    ),
                    ("Write set", s(&receipt, &["writeSetHash"])),
                ]),
            );
        }
        Command::Block {
            action: Block::Show { block },
        } => {
            checked_network(&rpc, expected).await?;
            let found = match block.parse::<u64>() {
                Ok(height) => {
                    rpc.call("getBlockByHeight", json!({ "height": height }))
                        .await?
                }
                Err(_) => rpc.call("getBlock", json!({ "block": block })).await?,
            };
            let txs = found
                .get("transactions")
                .and_then(Value::as_array)
                .map_or(0, Vec::len);
            print(
                &found,
                rows(&[
                    (
                        "Block",
                        format!("#{}   {}", s(&found, &["height"]), s(&found, &["id"])),
                    ),
                    (
                        "Slot",
                        format!(
                            "{}   (epoch {})",
                            s(&found, &["slot"]),
                            s(&found, &["epoch"])
                        ),
                    ),
                    ("Parent", s(&found, &["parent"])),
                    ("Transactions", txs.to_string()),
                    ("Execution Units", s(&found, &["euUsed"])),
                    ("State root", s(&found, &["stateRoot"])),
                ]),
            );
        }
    }
    Ok(())
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(cli).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            let mut stderr = std::io::stderr();
            let _ = writeln!(stderr, "aletheia-cli: {error}");
            ExitCode::from(1)
        }
    }
}
