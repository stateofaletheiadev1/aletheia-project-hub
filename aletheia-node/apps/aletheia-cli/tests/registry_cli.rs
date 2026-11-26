//! `aletheia-cli validator` and `gov` against a running validator node (ADR-069): the Council
//! schedules protocol version 2, an operator registers with a bond, the Council rejects the
//! application and the bond comes back, and the set is read back. Keystores are made offline
//! first so genesis can name them.

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
use std::time::{Duration, Instant};

use aletheia_core::{Hash32, NetworkIdentity};
use aletheia_crypto::{BlsSecretKey, Ed25519SigningKey, Secret};
use aletheia_execution::GenesisConfig;
use aletheia_node::{Node, NodeConfig};
use aletheia_rpc::Service;
use aletheia_storage::MemoryKvStore;
use serde_json::Value;

const WAIT: Duration = Duration::from_secs(120);

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-cli-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn cli(rpc: Option<SocketAddr>, password_file: &Path, args: &[&str]) -> (bool, String, String) {
    let mut command = Command::new(env!("CARGO_BIN_EXE_aletheia-cli"));
    if let Some(rpc) = rpc {
        command.arg("--rpc").arg(rpc.to_string());
    }
    let output = command
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

async fn run(rpc: Option<SocketAddr>, password: &Path, args: &[&str]) -> (bool, String, String) {
    let password = password.to_path_buf();
    let args: Vec<String> = args.iter().map(|a| (*a).to_owned()).collect();
    tokio::task::spawn_blocking(move || {
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        cli(rpc, &password, &args)
    })
    .await
    .unwrap()
}

fn json(text: &str) -> Value {
    serde_json::from_str(text).unwrap_or_else(|_| panic!("not JSON: {text}"))
}

fn consensus_key(index: u8) -> BlsSecretKey {
    BlsSecretKey::from_key_material(&Secret::new([200 + index; 32])).unwrap()
}

fn node_key(index: u8) -> Ed25519SigningKey {
    Ed25519SigningKey::from_seed(&Secret::new([100 + index; 32]))
}

fn identity() -> NetworkIdentity {
    NetworkIdentity::new(
        aletheia_core::ChainId::new(7771),
        aletheia_core::NetworkKind::Devnet,
        Hash32::ZERO,
    )
}

/// Retries a governance execution until the proposal's timelock has passed: before that the
/// CLI's simulation refuses to sign.
async fn execute(rpc: SocketAddr, password: &Path, keystore: &str, proposal: &str) {
    let started = Instant::now();
    loop {
        let (ok, _, err) = run(
            Some(rpc),
            password,
            &[
                "gov",
                "execute",
                "--keystore",
                keystore,
                "--proposal",
                proposal,
                "--yes",
            ],
        )
        .await;
        if ok {
            return;
        }
        assert!(err.contains("GOV_PROPOSAL_STATE"), "{err}");
        assert!(started.elapsed() < WAIT, "the timelock never passed");
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
}

async fn alnt(rpc: SocketAddr, password: &Path, address: &str) -> u128 {
    let (ok, out, err) = run(
        Some(rpc),
        password,
        &["--output", "json", "balance", address, "--asset", "ALnT"],
    )
    .await;
    assert!(ok, "{err}");
    json(&out)["available"].as_str().unwrap().parse().unwrap()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_council_and_an_operator_use_the_registry_through_the_cli() {
    let dir = scratch("registry");
    let password = dir.join("password");
    std::fs::write(&password, "a long passphrase\n").unwrap();
    let council = dir.join("council.json").to_str().unwrap().to_owned();
    let operator = dir.join("operator.json").to_str().unwrap().to_owned();

    // Offline keystores for chain 7771, before genesis exists.
    let mut addresses = Vec::new();
    for keystore in [&council, &operator] {
        let (ok, out, err) = run(
            None,
            &password,
            &[
                "--output",
                "json",
                "--network",
                "devnet",
                "keys",
                "new",
                "--keystore",
                keystore,
                "--chain-id",
                "7771",
            ],
        )
        .await;
        assert!(ok, "{err}");
        addresses.push(json(&out)["address"].as_str().unwrap().to_owned());
    }

    let key = consensus_key(0);
    let toml = format!(
        "[chain]\nchain_id = 7771\nnetwork = \"devnet\"\nprotocol_version = 1\ngenesis_time_ms = 1767225600000\nslot_duration_ms = 100\n\n[fees]\neu_price_aey = \"1000000000\"\neu_price_alnt = \"1\"\n\n\
         [[allocations]]\naddress = \"{c}\"\nasset = \"ALnT\"\nunits = \"100000000\"\n\n\
         [[allocations]]\naddress = \"{o}\"\nasset = \"ALnT\"\nunits = \"100000000\"\n\n\
         [[validators]]\nconsensus_key = \"{ck}\"\nproof_of_possession = \"{pop}\"\nnode_key = \"{nk}\"\n\n\
         [governance]\ncouncil = [\"{c}\"]\nthreshold = 1\nepoch_slots = 2\nvoting_epochs = 50\nexecution_window_epochs = 100000\nmax_aey_capacity_increase = \"0\"\n",
        c = addresses[0],
        o = addresses[1],
        ck = aletheia_core::base16::encode(&key.public_key().to_bytes()),
        pop = aletheia_core::base16::encode(&key.prove_possession(&identity()).to_bytes()),
        nk = aletheia_core::base16::encode(&node_key(0).public_key().to_bytes()),
    );
    let genesis = GenesisConfig::from_toml(&toml).unwrap().to_state().unwrap();
    let mut node = Node::start(
        NodeConfig {
            data_dir: dir.join("node"),
            genesis,
            listen: "127.0.0.1:0".parse().unwrap(),
            peers: Vec::new(),
            node_key: node_key(0),
            produce_every: None,
            consensus_key: Some(consensus_key(0)),
            remote_signer: None,
        },
        Arc::new(MemoryKvStore::new()),
    )
    .await
    .unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let rpc = listener.local_addr().unwrap();
    let server = tokio::spawn(aletheia_rpc::server::serve(
        listener,
        Service::new(node.rpc_backend()),
        1_000,
    ));
    node.wait_for_height(aletheia_core::Height::new(3), WAIT)
        .await
        .unwrap();

    // Before version 2 the node's simulation refuses a registration; nothing is signed.
    let new_key = consensus_key(1);
    let ck = aletheia_core::base16::encode(&new_key.public_key().to_bytes());
    let pop = aletheia_core::base16::encode(&new_key.prove_possession(&identity()).to_bytes());
    let nk = aletheia_core::base16::encode(&node_key(1).public_key().to_bytes());
    let register = |bond: &'static str| {
        vec![
            "validator".to_owned(),
            "register".to_owned(),
            "--keystore".to_owned(),
            operator.clone(),
            "--consensus-key".to_owned(),
            ck.clone(),
            "--proof-of-possession".to_owned(),
            pop.clone(),
            "--node-key".to_owned(),
            nk.clone(),
            "--bond".to_owned(),
            bond.to_owned(),
            "--yes".to_owned(),
        ]
    };
    let args = register("10000");
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (ok, _, err) = run(Some(rpc), &password, &refs).await;
    assert!(
        !ok && err.contains("TX_TYPE_NOT_ACTIVE") && err.contains("protocol version 1"),
        "{err}"
    );

    // A proof of possession for another key is caught before anything is sent.
    let mut bad = register("10000");
    bad[7] =
        aletheia_core::base16::encode(&consensus_key(2).prove_possession(&identity()).to_bytes());
    let refs: Vec<&str> = bad.iter().map(String::as_str).collect();
    let (ok, _, err) = run(Some(rpc), &password, &refs).await;
    assert!(
        !ok && err.contains("does not match the consensus key"),
        "{err}"
    );

    // The Council schedules version 2.
    let tip = node.tip().height.get();
    let height = (tip + 200).to_string();
    let (ok, out, err) = run(
        Some(rpc),
        &password,
        &[
            "--output",
            "json",
            "gov",
            "propose",
            "--keystore",
            &council,
            "--yes",
            "schedule-upgrade",
            "--version",
            "2",
            "--height",
            &height,
        ],
    )
    .await;
    assert!(ok, "{err}");
    let proposal = json(&out)["proposalId"].as_str().unwrap().to_owned();
    execute(rpc, &password, &council, &proposal).await;
    node.wait_for_height(aletheia_core::Height::new(tip + 202), WAIT)
        .await
        .unwrap();

    // The operator registers; the bond leaves its balance.
    let before = alnt(rpc, &password, &addresses[1]).await;
    let args = register("10000");
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (ok, out, err) = run(Some(rpc), &password, &refs).await;
    assert!(ok, "{err}");
    assert!(out.contains("SUCCESS"), "{out}");
    let registered = alnt(rpc, &password, &addresses[1]).await;
    assert!(
        before - registered >= 10_000_000,
        "{before} -> {registered}"
    );

    // The Council rejects the application; the bond returns.
    let (ok, out, err) = run(
        Some(rpc),
        &password,
        &[
            "--output",
            "json",
            "gov",
            "propose",
            "--keystore",
            &council,
            "--yes",
            "reject-validator",
            "--node-key",
            &nk,
        ],
    )
    .await;
    assert!(ok, "{err}");
    let proposal = json(&out)["proposalId"].as_str().unwrap().to_owned();
    execute(rpc, &password, &council, &proposal).await;
    let refunded = alnt(rpc, &password, &addresses[1]).await;
    assert_eq!(refunded, registered + 10_000_000, "the bond came back");

    // The set is still the founder's one validator.
    let (ok, out, err) = run(
        Some(rpc),
        &password,
        &["--output", "json", "validator", "set"],
    )
    .await;
    assert!(ok, "{err}");
    let set = json(&out);
    assert_eq!(set["validators"].as_array().unwrap().len(), 1);
    let (ok, out, _) = run(Some(rpc), &password, &["validator", "set"]).await;
    assert!(ok && out.contains("Validators       1"), "{out}");

    server.abort();
    node.shutdown().await.unwrap();
}
