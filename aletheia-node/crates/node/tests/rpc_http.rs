//! The public RPC of a running node over real HTTP (spec Section 37): a transfer submitted
//! with JSON-RPC is finalized by the devnet producer and read back over both interfaces, and
//! the per-IP budget answers 429 beyond it. Needs `--features devnet-producer`.

#![cfg(feature = "devnet-producer")]
#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use aletheia_core::{AceEncode, AssetId, base16};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use aletheia_node::{Node, NodeConfig};
use aletheia_rpc::Service;
use aletheia_storage::MemoryKvStore;
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};
use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

async fn start_node(devnet: &Devnet, test: &str) -> Node {
    let dir = std::env::temp_dir().join(format!("aletheia-rpc-{}-{test}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let config = NodeConfig {
        data_dir: dir,
        genesis: devnet.genesis.clone(),
        listen: "127.0.0.1:0".parse().unwrap(),
        peers: Vec::new(),
        node_key: Ed25519SigningKey::from_seed(&Secret::new([77; 32])),
        produce_every: Some(Duration::from_millis(100)),
        consensus_key: None,
    };
    Node::start(config, Arc::new(MemoryKvStore::new()))
        .await
        .unwrap()
}

/// The server holds a handle to the chain thread: it is stopped before the node shuts down,
/// as `aletheiad` does.
async fn serve(
    node: &Node,
    per_second: u32,
) -> (SocketAddr, tokio::task::JoinHandle<std::io::Result<()>>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let service = Service::new(node.rpc_backend());
    (
        address,
        tokio::spawn(aletheia_rpc::server::serve(listener, service, per_second)),
    )
}

async fn stop(server: tokio::task::JoinHandle<std::io::Result<()>>, node: Node) {
    server.abort();
    let _ = server.await;
    node.shutdown().await.unwrap();
}

/// One HTTP/1.1 request; returns status and body.
async fn http(address: SocketAddr, method: &str, path: &str, body: &str) -> (u16, String) {
    let mut stream = TcpStream::connect(address).await.unwrap();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {address}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(request.as_bytes()).await.unwrap();
    let mut response = Vec::new();
    stream.read_to_end(&mut response).await.unwrap();
    let text = String::from_utf8_lossy(&response).into_owned();
    let status: u16 = text.split_whitespace().nth(1).unwrap().parse().unwrap();
    let body = text
        .split_once("\r\n\r\n")
        .map(|(_, b)| b.to_owned())
        .unwrap_or_default();
    (status, body)
}

async fn call(address: SocketAddr, method: &str, params: Value) -> Value {
    let body = json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params }).to_string();
    let (status, text) = http(address, "POST", "/rpc/v1", &body).await;
    assert_eq!(status, 200, "{text}");
    serde_json::from_str(&text).unwrap()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_transfer_goes_through_the_http_rpc_and_back() {
    let devnet = Devnet::new(3, 100 * ONE_AEY, 1_000 * ONE_ALNT);
    let network = devnet.genesis.network();
    let node = start_node(&devnet, "transfer").await;
    let (address, server) = serve(&node, 1_000).await;

    let status = call(address, "getNetworkStatus", json!({})).await;
    assert_eq!(status["result"]["chainId"], network.chain_id().get());

    let to = devnet.address(1);
    let tx = devnet.transfer(0, 0, to, AssetId::AEY, 3 * ONE_AEY);
    let simulated = call(
        address,
        "simulateTransaction",
        json!({ "tx": base16::encode(&tx.to_ace_bytes()) }),
    )
    .await;
    assert_eq!(
        simulated["result"]["receipt"]["status"], "SUCCESS",
        "{simulated}"
    );
    let submitted = call(
        address,
        "submitTransaction",
        json!({ "tx": base16::encode(&tx.to_ace_bytes()) }),
    )
    .await;
    let tx_id = submitted["result"]["txId"].as_str().unwrap().to_owned();

    // Wait for the producer to finalize it.
    let mut shown = Value::Null;
    for _ in 0..100 {
        shown = call(address, "getTransaction", json!({ "txId": tx_id })).await;
        if shown.get("result").is_some() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert_eq!(shown["result"]["status"], "FINALIZED", "{shown}");
    assert_eq!(
        shown["result"]["transfer"]["display"],
        "3.000000000000000000"
    );
    assert_eq!(shown["result"]["receipt"]["status"], "SUCCESS");

    let receipt = call(address, "getReceipt", json!({ "txId": tx_id })).await;
    assert_eq!(receipt["result"]["status"], "SUCCESS");
    let to_text = to.to_text(network.network_kind());
    let balance = call(
        address,
        "getBalance",
        json!({ "address": to_text, "asset": "AEY" }),
    )
    .await;
    assert_eq!(balance["result"]["available"], (103 * ONE_AEY).to_string());

    // REST returns the same transaction (the ':' may arrive escaped).
    let path = format!("/api/v1/transactions/{}", tx_id.replace(':', "%3A"));
    let (status, body) = http(address, "GET", &path, "").await;
    assert_eq!(status, 200, "{body}");
    let rest: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(rest, shown["result"]);
    let (status, _) = http(address, "GET", "/api/v1/blocks/height/999999", "").await;
    assert_eq!(status, 404);

    stop(server, node).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn each_client_ip_has_a_request_budget() {
    let devnet = Devnet::new(2, ONE_AEY, ONE_ALNT);
    let node = start_node(&devnet, "budget").await;
    let (address, server) = serve(&node, 3).await;
    let mut statuses = Vec::new();
    for _ in 0..6 {
        statuses.push(http(address, "GET", "/api/v1/network/status", "").await.0);
    }
    assert_eq!(&statuses[..3], &[200, 200, 200]);
    assert!(statuses[3..].contains(&429), "{statuses:?}");
    stop(server, node).await;
}
