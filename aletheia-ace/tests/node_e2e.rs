//! End-to-end tests against the real StableChain daemon, driven through the `ace` binary.
//!
//! They need the node binaries and the workspace they were built from:
//!
//! ```text
//! ACE_TEST_BIN_DIR=/path/with/aletheiad+aletheia-arno-exec  (built with aletheiad/devnet-producer)
//! ACE_TEST_WORKSPACE=/path/to/aletheia-node                 (for genesis and the devnet key)
//! ACE_TEST_COMMIT=<40 hex the binaries were built from>
//! ```
//!
//! Without them every test prints "SKIPPED" and returns: CI runs them in the job that has
//! the binaries (.github/workflows/ace-stablechain.yml), and a skipped test is reported there
//! as a failure of that job, not as a pass. Each test uses its own ports and directories.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};
use std::time::{Duration, Instant};

use serde_json::Value;

struct Env {
    bins: PathBuf,
    workspace: PathBuf,
    commit: String,
}

fn env() -> Option<Env> {
    let bins = PathBuf::from(std::env::var_os("ACE_TEST_BIN_DIR")?);
    let workspace = PathBuf::from(std::env::var_os("ACE_TEST_WORKSPACE")?);
    let commit = std::env::var("ACE_TEST_COMMIT").ok()?;
    Some(Env {
        bins,
        workspace,
        commit,
    })
}

macro_rules! require_env {
    () => {
        match env() {
            Some(e) => e,
            None => {
                eprintln!("SKIPPED: set ACE_TEST_BIN_DIR, ACE_TEST_WORKSPACE and ACE_TEST_COMMIT");
                if std::env::var_os("ACE_REQUIRE_E2E").is_some() {
                    panic!("ACE_REQUIRE_E2E is set but the node binaries are not available");
                }
                return;
            }
        }
    };
}

fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

const GENESIS_ID: &str = "9164487f5f211839f5796c6b2193e17d289a285d9eebce6bbc592f26a4c7719e";

struct Deployment {
    dir: tempfile::TempDir,
    p2p: u16,
    rpc: u16,
}

impl Deployment {
    fn path(&self) -> &Path {
        self.dir.path()
    }
    fn config(&self) -> PathBuf {
        self.path().join("ace.toml")
    }
    fn data_dir(&self) -> PathBuf {
        self.path().join("node/data")
    }
}

struct Options {
    rpc: bool,
    genesis_pin: Option<&'static str>,
    executor: bool,
    min_free_disk_mb: u64,
    max_restarts: u32,
    extra_runtime: &'static str,
}

impl Default for Options {
    fn default() -> Options {
        Options {
            rpc: true,
            genesis_pin: Some(GENESIS_ID),
            executor: true,
            min_free_disk_mb: 64,
            max_restarts: 3,
            extra_runtime: "",
        }
    }
}

/// A deployment whose binaries are copies of the test binaries, with a provenance record made
/// by hashing them (the build itself is covered by the build workflow, not here).
fn deployment(env: &Env, options: &Options) -> Deployment {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    let bin = root.join("bin");
    std::fs::create_dir_all(&bin).unwrap();
    let mut binaries = Vec::new();
    let mut names = vec!["aletheiad"];
    if options.executor {
        names.push("aletheia-arno-exec");
    }
    for name in &names {
        std::fs::copy(env.bins.join(name), bin.join(name)).unwrap();
        let (sha256, size) = ace::builder::sha256_file(&bin.join(name)).unwrap();
        binaries.push(serde_json::json!({ "name": name, "sha256": sha256, "size": size }));
    }
    let provenance = serde_json::json!({
        "provenance_version": 1, "ace_version": "test", "ace_config_version": 1, "ace_config_sha256": "",
        "repository": "https://gitlab.com/emeka.iwuagwu/aletheia-project-hub.git", "reference": null,
        "commit": env.commit, "rustc": "", "cargo": "", "os": "linux", "arch": "", "distribution": null,
        "profile": "release", "packages": ["aletheiad"], "features": ["aletheiad/devnet-producer"],
        "command": [], "librocksdb_sys": null, "started_at": "", "finished_at": "", "seconds": 0,
        "peak_target_dir_bytes": null, "result": "success", "failure": null, "binaries": binaries,
    });
    std::fs::write(
        bin.join("provenance.json"),
        serde_json::to_vec(&provenance).unwrap(),
    )
    .unwrap();
    let (p2p, rpc) = (free_port(), free_port());
    std::fs::create_dir_all(root.join("node")).unwrap();
    let rpc_section = if options.rpc {
        format!("[rpc]\nlisten = \"127.0.0.1:{rpc}\"\nrequests_per_second = 1000\n")
    } else {
        String::new()
    };
    std::fs::write(
        root.join("node/node.toml"),
        format!(
            "[node]\ndata_dir = \"./data\"\ngenesis = \"{}\"\nlisten = \"127.0.0.1:{p2p}\"\nnode_key_file = \"{}\"\n\n[devnet]\nproduce_every_ms = 500\n\n{rpc_section}",
            env.workspace.join("genesis/devnet-explorer.toml").display(),
            env.workspace.join("configs/devnet-node.key").display(),
        ),
    )
    .unwrap();
    let pin = options
        .genesis_pin
        .map(|g| format!("expected_genesis_id = \"{g}\"\n"))
        .unwrap_or_default();
    let binaries_list = names
        .iter()
        .map(|n| format!("\"{n}\""))
        .collect::<Vec<_>>()
        .join(", ");
    std::fs::write(
        root.join("ace.toml"),
        format!(
            r#"config_version = 1
[source]
repository = "https://gitlab.com/emeka.iwuagwu/aletheia-project-hub.git"
commit = "{commit}"
workspace = "aletheia-node"
checkout_dir = "src"
[build]
profile = "release"
packages = ["aletheiad"]
features = ["aletheiad/devnet-producer"]
binaries = [{binaries_list}]
target_dir = "target"
output_dir = "bin"
[node]
config = "node/node.toml"
working_dir = "node"
role = "devnet-producer"
expected_network = "devnet"
expected_chain_id = 7771
{pin}[runtime]
state_dir = "run"
health_interval_s = 1
stall_after_s = 10
shutdown_deadline_s = 30
max_restarts = {max_restarts}
backoff_initial_ms = 200
backoff_max_ms = 1000
{extra}
[limits]
min_free_disk_mb = {disk}
min_memory_mb = 256
max_snapshot_mb = 256
[persistence]
mode = "ephemeral"
checkpoint_dir = "checkpoints"
"#,
            commit = env.commit,
            max_restarts = options.max_restarts,
            extra = options.extra_runtime,
            disk = options.min_free_disk_mb,
        ),
    )
    .unwrap();
    Deployment { dir, p2p, rpc }
}

fn ace(d: &Deployment, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_ace"))
        .arg("--config")
        .arg(d.config())
        .args(args)
        .output()
        .unwrap()
}

fn spawn_start(d: &Deployment, args: &[&str]) -> Child {
    let log = std::fs::File::create(d.path().join("supervisor.log")).unwrap();
    Command::new(env!("CARGO_BIN_EXE_ace"))
        .arg("--config")
        .arg(d.config())
        .arg("start")
        .args(args)
        .stdout(Stdio::from(log.try_clone().unwrap()))
        .stderr(Stdio::from(log))
        .spawn()
        .unwrap()
}

fn state(d: &Deployment) -> Option<Value> {
    let text = std::fs::read_to_string(d.path().join("run/state.json")).ok()?;
    serde_json::from_str(&text).ok()
}

fn wait_for(
    d: &Deployment,
    what: &str,
    timeout: Duration,
    predicate: impl Fn(&Value) -> bool,
) -> Value {
    let until = Instant::now() + timeout;
    loop {
        if let Some(s) = state(d)
            && predicate(&s)
        {
            return s;
        }
        if Instant::now() > until {
            let log = std::fs::read_to_string(d.path().join("supervisor.log")).unwrap_or_default();
            let node = std::fs::read_to_string(d.path().join("run/node.log")).unwrap_or_default();
            panic!(
                "timed out waiting for {what}; state {:?}\nsupervisor:\n{log}\nnode:\n{node}",
                state(d)
            );
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

fn state_is(s: &Value, name: &str) -> bool {
    s["state"] == name
}

fn finish(mut child: Child, timeout: Duration) -> Option<i32> {
    let until = Instant::now() + timeout;
    loop {
        if let Some(status) = child.try_wait().unwrap() {
            return status.code();
        }
        if Instant::now() > until {
            let _ = child.kill();
            panic!("ace start did not finish in time");
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[test]
fn full_lifecycle_rpc_checkpoint_restore() {
    let env = require_env!();
    let d = deployment(&env, &Options::default());
    let child = spawn_start(&d, &[]);
    let s = wait_for(&d, "EPHEMERAL_MODE", Duration::from_secs(90), |s| {
        state_is(s, "EPHEMERAL_MODE")
    });
    assert_eq!(s["genesis_id"], GENESIS_ID);
    assert_eq!(s["rpc_listen"], format!("127.0.0.1:{}", d.rpc));
    assert_eq!(s["p2p_listen"], format!("127.0.0.1:{}", d.p2p));
    assert_eq!(s["rpc_url"], format!("http://127.0.0.1:{}/rpc/v1", d.rpc));
    assert_eq!(s["persistence"]["class"], "EPHEMERAL_MODE");

    // Application-level checks, independent of the supervisor.
    let health = ace(&d, &["health"]);
    assert!(
        health.status.success(),
        "{}",
        String::from_utf8_lossy(&health.stderr)
    );
    let rpc = ace(&d, &["inspect-rpc"]);
    assert!(rpc.status.success());
    let report: Value = serde_json::from_slice(&rpc.stdout).unwrap();
    assert_eq!(report["socket_holder"], "process");
    assert_eq!(
        report["p2p_is_not_rpc"], true,
        "the P2P port must not answer as RPC"
    );
    assert_eq!(report["announced_by_daemon"], true);
    assert_eq!(report["status"]["chain_id"], 7771);

    // A second supervisor on the same deployment is refused.
    let second = ace(&d, &["start", "--run-for", "5"]);
    assert_eq!(
        second.status.code(),
        Some(13),
        "{}",
        String::from_utf8_lossy(&second.stderr)
    );

    // A checkpoint of a running node is refused.
    let refused = ace(&d, &["checkpoint"]);
    assert_eq!(refused.status.code(), Some(10));

    let stop = ace(&d, &["stop", "--wait", "60"]);
    assert!(
        stop.status.success(),
        "{}",
        String::from_utf8_lossy(&stop.stderr)
    );
    assert_eq!(finish(child, Duration::from_secs(60)), Some(0));
    let s = state(&d).unwrap();
    assert!(state_is(&s, "STOPPED"));
    let clean_height = s["last_clean_stop"]["height"].as_u64().unwrap();
    assert!(clean_height > 0);
    assert_eq!(s["last_exit"]["kind"], "clean-stop");

    // Checkpoint, then restore into a second deployment and verify against the running node.
    let cp = ace(&d, &["checkpoint"]);
    assert!(
        cp.status.success(),
        "{}",
        String::from_utf8_lossy(&cp.stderr)
    );
    let cp: Value = serde_json::from_slice(&cp.stdout).unwrap();
    assert_eq!(cp["clean_stop"], true);
    assert_eq!(cp["height"].as_u64(), Some(clean_height));
    let manifest = cp["manifest"].as_str().unwrap().to_owned();

    let d2 = deployment(&env, &Options::default());
    let refused = ace(&d2, &["restore-snapshot", &manifest]);
    assert_eq!(
        refused.status.code(),
        Some(10),
        "restore without --yes is refused"
    );
    let restored = ace(&d2, &["restore-snapshot", &manifest, "--yes"]);
    assert!(
        restored.status.success(),
        "{}",
        String::from_utf8_lossy(&restored.stderr)
    );
    let again = ace(&d2, &["restore-snapshot", &manifest, "--yes"]);
    assert_eq!(
        again.status.code(),
        Some(10),
        "a restored directory is never overwritten"
    );

    let child2 = spawn_start(&d2, &[]);
    let s2 = wait_for(&d2, "serving after restore", Duration::from_secs(90), |s| {
        state_is(s, "EPHEMERAL_MODE")
    });
    assert!(s2["finalized_height"].as_u64().unwrap() >= clean_height);
    let verify = ace(&d2, &["verify-restore", &manifest]);
    assert!(
        verify.status.success(),
        "{}",
        String::from_utf8_lossy(&verify.stderr)
    );
    let node_log = std::fs::read_to_string(d2.path().join("run/node.log")).unwrap();
    assert!(
        node_log.contains(&format!("finalized_height={clean_height} ")),
        "resumed at the checkpoint height: {node_log}"
    );
    assert!(ace(&d2, &["stop"]).status.success());
    assert_eq!(finish(child2, Duration::from_secs(60)), Some(0));
}

#[test]
fn a_node_killed_from_outside_is_recovered_without_losing_height() {
    let env = require_env!();
    let d = deployment(&env, &Options::default());
    let child = spawn_start(&d, &[]);
    let s = wait_for(&d, "serving", Duration::from_secs(90), |s| {
        state_is(s, "EPHEMERAL_MODE")
    });
    let pid = s["node_pid"].as_u64().unwrap();
    std::thread::sleep(Duration::from_secs(2));
    let before = state(&d).unwrap()["finalized_height"].as_u64().unwrap();
    Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status()
        .unwrap();
    let s = wait_for(&d, "recovered", Duration::from_secs(90), |s| {
        s["restarts"] == 1 && state_is(s, "EPHEMERAL_MODE") && s["node_pid"].as_u64() != Some(pid)
    });
    assert!(
        s["finalized_height"].as_u64().unwrap() >= before,
        "height never goes back"
    );
    assert_eq!(s["last_exit"]["kind"], "signal");
    assert!(ace(&d, &["stop"]).status.success());
    assert_eq!(finish(child, Duration::from_secs(60)), Some(0));
}

#[test]
fn rpc_disabled_is_degraded_and_never_ready() {
    let env = require_env!();
    let d = deployment(
        &env,
        &Options {
            rpc: false,
            extra_runtime: "rpc_ready_timeout_s = 2",
            ..Options::default()
        },
    );
    let child = spawn_start(&d, &["--run-for", "8"]);
    let s = wait_for(&d, "DEGRADED", Duration::from_secs(60), |s| {
        state_is(s, "DEGRADED")
    });
    assert_eq!(s["rpc_enabled"], false);
    assert!(s["reason"].as_str().unwrap().contains("RPC disabled"));
    let health = ace(&d, &["health"]);
    assert_eq!(health.status.code(), Some(9));
    let rpc = ace(&d, &["inspect-rpc"]);
    let report: Value = serde_json::from_slice(&rpc.stdout).unwrap();
    assert!(
        report["problem"]
            .as_str()
            .unwrap()
            .contains("RPC is disabled")
    );
    assert_eq!(finish(child, Duration::from_secs(60)), Some(0));
}

#[test]
fn occupied_ports_are_refused_before_the_node_starts() {
    let env = require_env!();
    for which in ["rpc", "p2p"] {
        let d = deployment(&env, &Options::default());
        let port = if which == "rpc" { d.rpc } else { d.p2p };
        let _squatter = TcpListener::bind(("127.0.0.1", port)).unwrap();
        let out = ace(&d, &["start", "--run-for", "5"]);
        assert_eq!(
            out.status.code(),
            Some(8),
            "{which}: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        assert!(String::from_utf8_lossy(&out.stderr).contains("already in use"));
        assert!(
            !d.data_dir().join("DATADIR").exists(),
            "{which}: the node was never started"
        );
    }
}

#[test]
fn a_missing_executor_is_a_configuration_error() {
    let env = require_env!();
    let d = deployment(
        &env,
        &Options {
            executor: false,
            ..Options::default()
        },
    );
    let out = ace(&d, &["start", "--run-for", "5"]);
    assert_eq!(
        out.status.code(),
        Some(3),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert!(String::from_utf8_lossy(&out.stderr).contains("contract executor"));
}

#[test]
fn a_tampered_binary_is_refused() {
    let env = require_env!();
    let d = deployment(&env, &Options::default());
    let mut bytes = std::fs::read(d.path().join("bin/aletheiad")).unwrap();
    let last = bytes.len() - 1;
    bytes[last] ^= 0xff;
    std::fs::write(d.path().join("bin/aletheiad"), bytes).unwrap();
    let out = ace(&d, &["verify-build"]);
    assert_eq!(out.status.code(), Some(7));
    let out = ace(&d, &["start", "--run-for", "5"]);
    assert_eq!(out.status.code(), Some(7));
}

#[test]
fn a_wrong_genesis_pin_stops_the_node_and_fails() {
    let env = require_env!();
    let other = "ee6e8c5e4d28ea10e699e27daccd13911974f819aaf777ef2f0f21c2897a379a";
    let d = deployment(
        &env,
        &Options {
            genesis_pin: Some(other),
            ..Options::default()
        },
    );
    let out = ace(&d, &["start", "--run-for", "20"]);
    assert_eq!(
        out.status.code(),
        Some(8),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    let s = state(&d).unwrap();
    assert!(state_is(&s, "FAILED"));
    assert!(s["reason"].as_str().unwrap().contains(other));
    // The directory it created now refuses to start before the node runs.
    let out = ace(&d, &["start", "--run-for", "5"]);
    assert_eq!(
        out.status.code(),
        Some(3),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
}

#[test]
fn insufficient_disk_is_refused_by_preflight() {
    let env = require_env!();
    let d = deployment(
        &env,
        &Options {
            min_free_disk_mb: 1 << 23,
            ..Options::default()
        },
    );
    let out = ace(&d, &["start", "--run-for", "5"]);
    assert_eq!(
        out.status.code(),
        Some(4),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    let out = ace(&d, &["preflight", "--stage", "run"]);
    let report: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(report["verdict"], "INSUFFICIENT_RESOURCES");
}

#[test]
fn repeated_fail_stops_do_not_loop() {
    let env = require_env!();
    // Make a real data directory, then corrupt its manifest so every start fail-stops (70).
    let d = deployment(
        &env,
        &Options {
            max_restarts: 2,
            ..Options::default()
        },
    );
    let child = spawn_start(&d, &["--run-for", "3"]);
    assert_eq!(finish(child, Duration::from_secs(60)), Some(0));
    let manifest = d.data_dir().join("DATADIR");
    let mut bytes = std::fs::read(&manifest).unwrap();
    let middle = bytes.len() / 2;
    bytes[middle] ^= 0xff;
    std::fs::write(&manifest, bytes).unwrap();
    let started = Instant::now();
    let out = ace(&d, &["start"]);
    assert_eq!(
        out.status.code(),
        Some(8),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    let s = state(&d).unwrap();
    assert!(state_is(&s, "FAILED"));
    assert_eq!(s["restarts"], 2);
    assert!(s["reason"].as_str().unwrap().contains("restarts within"));
    assert_eq!(s["last_exit"]["kind"], "fail-stop");
    assert!(started.elapsed() < Duration::from_secs(60));
    // ACE never "repairs" the directory.
    assert!(d.data_dir().join("DATADIR").exists());
}

#[test]
fn a_restart_disabled_run_fails_on_unexpected_termination() {
    let env = require_env!();
    let d = deployment(&env, &Options::default());
    let child = spawn_start(&d, &["--no-restart"]);
    let s = wait_for(&d, "serving", Duration::from_secs(90), |s| {
        state_is(s, "EPHEMERAL_MODE")
    });
    let pid = s["node_pid"].as_u64().unwrap();
    Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status()
        .unwrap();
    assert_eq!(finish(child, Duration::from_secs(30)), Some(8));
    let s = state(&d).unwrap();
    assert!(state_is(&s, "FAILED"));
    assert!(s["reason"].as_str().unwrap().contains("restart disabled"));
}
