//! NON-PRODUCTION devnet traffic for the Explorer.
//!
//! ```text
//! devnet-traffic genesis                 print [[allocations]] for the development accounts
//! devnet-traffic run [rpc] [interval_ms] sign and submit transfers between them, forever
//! ```
//!
//! The accounts come from published seeds (bytes 0xA1..=0xA8 repeated): anyone can spend
//! them, so this refuses every network except devnet. Each sender is used once per round, so
//! a sender's previous transfer is final before its next one reads the nonce.

use std::io::Write;
use std::time::Duration;

use aletheia_core::{AssetId, ChainId, Hash32, NetworkIdentity, NetworkKind};
use aletheia_crypto::Secret;
use aletheia_wallet::{Account, HttpRpc, TransferRequest, node_network, transfer};

const ACCOUNTS: u8 = 8;
const ONE_AEY: u128 = 1_000_000_000_000_000_000;
const CENT: u128 = ONE_AEY / 100;

fn accounts(network: NetworkIdentity) -> Vec<Account> {
    (0..ACCOUNTS)
        .map(|i| Account::new(&Secret::new([0xA1_u8.wrapping_add(i); 32]), network))
        .collect()
}

fn say(line: &str) {
    let _ = writeln!(std::io::stdout(), "{line}");
}

/// A small deterministic generator; traffic only needs variety, not secrecy.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        self.0 >> 33
    }

    /// A value in `0..bound` (`bound` > 0).
    fn below(&mut self, bound: u64) -> u64 {
        self.next().checked_rem(bound).unwrap_or(0)
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> std::process::ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let devnet = NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO);
    match args.first().map(String::as_str) {
        Some("genesis") => {
            say("# Development accounts of devnet-traffic (published seeds; devnet only).");
            for account in accounts(devnet) {
                let address = account.address().to_text(NetworkKind::Devnet);
                for (asset, units) in [("AEY", 1_000_000 * ONE_AEY), ("ALnT", 50_000_000_000_u128)]
                {
                    say(&format!(
                        "[[allocations]]\naddress = \"{address}\"\nasset = \"{asset}\"\nunits = \"{units}\"\n"
                    ));
                }
            }
            std::process::ExitCode::SUCCESS
        }
        Some("run") => {
            let url = args.get(1).map_or("http://127.0.0.1:7781", String::as_str);
            let interval = args.get(2).and_then(|v| v.parse().ok()).unwrap_or(600u64);
            match run(url, interval).await {
                Ok(()) => std::process::ExitCode::SUCCESS,
                Err(message) => {
                    let _ = writeln!(std::io::stderr(), "devnet-traffic: {message}");
                    std::process::ExitCode::FAILURE
                }
            }
        }
        _ => {
            let _ = writeln!(
                std::io::stderr(),
                "usage: devnet-traffic genesis | run [http://host:port] [interval_ms]"
            );
            std::process::ExitCode::from(64)
        }
    }
}

async fn run(url: &str, interval_ms: u64) -> Result<(), String> {
    let rpc = HttpRpc::parse(url).map_err(|e| e.0)?;
    let (network, _) = node_network(&rpc).await.map_err(|e| e.0)?;
    if network.network_kind() != NetworkKind::Devnet {
        return Err(format!(
            "the node is on {}; development accounts are refused there",
            network.network_kind()
        ));
    }
    let accounts = accounts(network);
    let mut rng = Rng(0x5eed_a1e7_4e1a);
    say(&format!(
        "devnet-traffic: {ACCOUNTS} accounts, one transfer every {interval_ms} ms"
    ));
    loop {
        for (index, sender) in accounts.iter().enumerate() {
            let span = u64::from(ACCOUNTS.saturating_sub(1));
            let offset = usize::try_from(rng.below(span))
                .unwrap_or(0)
                .saturating_add(1);
            let recipient = accounts
                .get(
                    index
                        .saturating_add(offset)
                        .checked_rem(accounts.len())
                        .unwrap_or(0),
                )
                .map(Account::address)
                .ok_or("no recipient")?;
            // Mostly everyday amounts, now and then a large one.
            let whole = match rng.below(10) {
                0 => rng.below(50_000).saturating_add(1_000),
                1..=3 => rng.below(900).saturating_add(100),
                _ => rng.below(99).saturating_add(1),
            };
            let amount = u128::from(whole)
                .saturating_mul(ONE_AEY)
                .saturating_add(u128::from(rng.below(100)).saturating_mul(CENT));
            let request = TransferRequest {
                recipient,
                asset: AssetId::AEY,
                amount,
                fee_asset: AssetId::ALNT,
                max_fee: 50_000,
                eu_limit: 50_000,
                validity_slots: 600,
            };
            match transfer(&rpc, sender, &request, |_| true, Duration::ZERO).await {
                Ok(sent) => say(&format!("sent {} AEY  {}", whole, sent.tx_id)),
                Err(error) => say(&format!("skipped: {}", error.0)),
            }
            tokio::time::sleep(Duration::from_millis(interval_ms)).await;
        }
    }
}
