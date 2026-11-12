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

/// A GET over plain HTTP with optional extra headers; the status code.
async fn get_status(address: SocketAddr, path: &str, headers: &str) -> u16 {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut stream = tokio::net::TcpStream::connect(address).await.unwrap();
    let request =
        format!("GET {path} HTTP/1.1\r\nHost: {address}\r\n{headers}Connection: close\r\n\r\n");
    stream.write_all(request.as_bytes()).await.unwrap();
    let mut response = Vec::new();
    stream.read_to_end(&mut response).await.unwrap();
    String::from_utf8_lossy(&response)
        .split_whitespace()
        .nth(1)
        .unwrap()
        .parse()
        .unwrap()
}

/// ADR-066: a key made by `aletheia-cli api-key new` is accepted by a node configured with the
/// printed hash, and gets its own budget; the public budget and unknown keys are unaffected.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn an_api_key_from_the_cli_has_its_own_budget_on_the_node() {
    let unused: SocketAddr = "127.0.0.1:9".parse().unwrap();
    let dir = scratch("api-key");
    let (ok, stdout, stderr) = cli(
        unused,
        &dir.join("none"),
        &[
            "--output",
            "json",
            "api-key",
            "new",
            "--name",
            "explorer",
            "--requests-per-second",
            "20",
        ],
    );
    assert!(ok, "{stderr}");
    let made = json(&stdout);
    let key = made["key"].as_str().unwrap().to_owned();
    assert!(key.starts_with("alk_") && key.len() == 68);
    let hash: [u8; 32] = aletheia_core::base16::decode(made["blake3"].as_str().unwrap())
        .unwrap()
        .try_into()
        .unwrap();
    assert_eq!(
        hash,
        aletheia_rpc::server::api_key_hash(&key),
        "CLI and node hash alike"
    );
    // A second key is different.
    let (_, again, _) = cli(
        unused,
        &dir.join("none"),
        &["--output", "json", "api-key", "new", "--name", "x"],
    );
    assert_ne!(json(&again)["key"], made["key"]);
    let (refused, _, _) = cli(
        unused,
        &dir.join("none"),
        &["api-key", "new", "--name", "a\"b"],
    );
    assert!(!refused);

    let devnet = Devnet::new(1, ONE_AEY, ONE_ALNT);
    let config = NodeConfig {
        data_dir: dir.join("node"),
        genesis: devnet.genesis.clone(),
        listen: "127.0.0.1:0".parse().unwrap(),
        peers: Vec::new(),
        node_key: Ed25519SigningKey::from_seed(&Secret::new([6; 32])),
        produce_every: Some(Duration::from_millis(200)),
        consensus_key: None,
        remote_signer: None,
    };
    let node = Node::start(config, Arc::new(MemoryKvStore::new()))
        .await
        .unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let rpc = listener.local_addr().unwrap();
    let server = tokio::spawn(aletheia_rpc::server::serve_with(
        listener,
        Service::new(node.rpc_backend()),
        aletheia_rpc::server::ServerConfig {
            requests_per_second: 2,
            trusted_proxies: Vec::new(),
            api_keys: vec![aletheia_rpc::server::ApiKey {
                name: "explorer".to_owned(),
                hash,
                requests_per_second: 20,
            }],
        },
    ));

    let bearer = format!("Authorization: Bearer {key}\r\n");
    for _ in 0..10 {
        assert_eq!(
            get_status(rpc, "/api/v1/network/status", &bearer).await,
            200
        );
    }
    let x_api_key = format!("X-Api-Key: {key}\r\n");
    assert_eq!(
        get_status(rpc, "/api/v1/network/status", &x_api_key).await,
        200
    );
    // The public budget of this address is untouched by the keyed calls, then runs out.
    assert_eq!(get_status(rpc, "/api/v1/network/status", "").await, 200);
    assert_eq!(get_status(rpc, "/api/v1/network/status", "").await, 200);
    assert_eq!(get_status(rpc, "/api/v1/network/status", "").await, 429);
    assert_eq!(
        get_status(
            rpc,
            "/api/v1/network/status",
            "Authorization: Bearer alk_wrong\r\n"
        )
        .await,
        401
    );

    server.abort();
    node.shutdown().await.unwrap();
}
