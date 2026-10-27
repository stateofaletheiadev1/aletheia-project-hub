//! `aletheia-cli` against a running node (spec Section 56): create a key, receive AEY, send a
//! transfer to FINALIZED, and read it back; JSON output is parsed as scripts would.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use aletheia_core::{Address, AssetId, NetworkKind};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use aletheia_node::{Node, NodeConfig};
use aletheia_rpc::Service;
use aletheia_storage::MemoryKvStore;
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};
use serde_json::Value;

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-cli-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn cli(rpc: SocketAddr, password_file: &Path, args: &[&str]) -> (bool, String, String) {
    let output = Command::new(env!("CARGO_BIN_EXE_aletheia-cli"))
        .arg("--rpc")
        .arg(rpc.to_string())
        .args(args)
        .env("ALETHEIA_PASSWORD_FILE", password_file)
        .output()
        .unwrap();
    (
        output.status.success(),
        String::from_utf8_lossy(&output.stdout).into_owned(),
        String::from_utf8_lossy(&output.stderr).into_owned(),
    )
}

fn json(text: &str) -> Value {
    serde_json::from_str(text).unwrap_or_else(|_| panic!("not JSON: {text}"))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_key_receives_and_sends_aey_through_the_cli() {
    let devnet = Devnet::new(3, 100 * ONE_AEY, 1_000 * ONE_ALNT);
    let dir = scratch("flow");
    let config = NodeConfig {
        data_dir: dir.join("node"),
        genesis: devnet.genesis.clone(),
        listen: "127.0.0.1:0".parse().unwrap(),
        peers: Vec::new(),
        node_key: Ed25519SigningKey::from_seed(&Secret::new([5; 32])),
        produce_every: Some(Duration::from_millis(100)),
        consensus_key: None,
        remote_signer: None,
    };
    let node = Node::start(config, Arc::new(MemoryKvStore::new()))
        .await
        .unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let rpc = listener.local_addr().unwrap();
    let server = tokio::spawn(aletheia_rpc::server::serve(
        listener,
        Service::new(node.rpc_backend()),
        1_000,
    ));
    let password = dir.join("password");
    std::fs::write(&password, "a long passphrase\n").unwrap();
    let keystore = dir.join("wallet.json");
    let keystore_arg = keystore.to_str().unwrap().to_owned();

    // Status, and the network check.
    let (ok, out, err) = tokio::task::spawn_blocking({
        let p = password.clone();
        move || cli(rpc, &p, &["--output", "json", "status"])
    })
    .await
    .unwrap();
    assert!(ok, "{err}");
    assert_eq!(json(&out)["network"], "devnet");
    let (ok, _, err) = tokio::task::spawn_blocking({
        let p = password.clone();
        move || cli(rpc, &p, &["--network", "mainnet", "status"])
    })
    .await
    .unwrap();
    assert!(!ok && err.contains("not mainnet"), "{err}");

    // A new key; its address receives AEY and ALnT for fees.
    let (ok, out, err) = tokio::task::spawn_blocking({
        let (p, k) = (password.clone(), keystore_arg.clone());
        move || {
            cli(
                rpc,
                &p,
                &["--output", "json", "keys", "new", "--keystore", &k],
            )
        }
    })
    .await
    .unwrap();
    assert!(ok, "{err}");
    let address_text = json(&out)["address"].as_str().unwrap().to_owned();
    let file = std::fs::read_to_string(&keystore).unwrap();
    assert!(file.contains("xchacha20poly1305") && !file.contains("passphrase"));
    let me = Address::parse(&address_text, NetworkKind::Devnet).unwrap();
    node.submit(devnet.transfer(0, 0, me, AssetId::AEY, 20 * ONE_AEY))
        .await
        .unwrap();
    node.submit(devnet.transfer(0, 1, me, AssetId::ALNT, 100 * ONE_ALNT))
        .await
        .unwrap();
    let mut funded = false;
    for _ in 0..100 {
        let (_, out, _) = tokio::task::spawn_blocking({
            let (p, a) = (password.clone(), address_text.clone());
            move || {
                cli(
                    rpc,
                    &p,
                    &["--output", "json", "balance", &a, "--asset", "ALnT"],
                )
            }
        })
        .await
        .unwrap();
        if out.contains("available") && json(&out)["available"] != "0" {
            funded = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert!(funded, "the funding never finalized");

    // Send 2.5 AEY to account 1, without a prompt.
    let to = devnet.address(1).to_text(NetworkKind::Devnet);
    let (ok, out, err) = tokio::task::spawn_blocking({
        let (p, k, t) = (password.clone(), keystore_arg.clone(), to.clone());
        move || {
            cli(
                rpc,
                &p,
                &[
                    "--output",
                    "json",
                    "--network",
                    "devnet",
                    "transfer",
                    "--keystore",
                    &k,
                    "--to",
                    &t,
                    "--amount",
                    "2.5",
                    "--yes",
                ],
            )
        }
    })
    .await
    .unwrap();
    assert!(ok, "{err}");
    let sent = json(&out);
    assert_eq!(sent["status"], "FINALIZED", "{sent}");
    assert_eq!(sent["transfer"]["display"], "2.500000000000000000");
    let tx_id = sent["txId"].as_str().unwrap().to_owned();

    // Read it back as text, the way people see it.
    let (ok, out, err) = tokio::task::spawn_blocking({
        let (p, t) = (password.clone(), tx_id.clone());
        move || cli(rpc, &p, &["tx", "show", &t])
    })
    .await
    .unwrap();
    assert!(ok, "{err}");
    assert!(
        out.contains("Transaction")
            && out.contains("FINALIZED")
            && out.contains("2.500000000000000000 AEY"),
        "{out}"
    );
    assert!(out.contains("State Result     SUCCESS"), "{out}");
    let (ok, out, _) = tokio::task::spawn_blocking({
        let p = password.clone();
        move || cli(rpc, &p, &["block", "show", "1"])
    })
    .await
    .unwrap();
    assert!(ok && out.contains("Block            #1"), "{out}");

    // A wrong password signs nothing.
    std::fs::write(&password, "not the passphrase\n").unwrap();
    let (ok, _, err) = tokio::task::spawn_blocking({
        let (p, k, t) = (password.clone(), keystore_arg.clone(), to.clone());
        move || {
            cli(
                rpc,
                &p,
                &[
                    "transfer",
                    "--keystore",
                    &k,
                    "--to",
                    &t,
                    "--amount",
                    "1",
                    "--yes",
                ],
            )
        }
    })
    .await
    .unwrap();
    assert!(!ok && err.contains("wrong password"), "{err}");

    server.abort();
    let _ = server.await;
    node.shutdown().await.unwrap();
}
