//! Runs and watches one `aletheiad`.
//!
//! `ace start` is the supervisor: it verifies the binaries and configuration, starts the
//! daemon with an argument vector in its configured working directory, follows its log,
//! checks RPC at the application level, and records every state change in
//! `<state_dir>/state.json` for `ace status`. It restarts the node only after the exits the
//! node documents as recoverable (fail-stop, or a kill from outside), with exponential backoff,
//! a restart budget per window and a fresh resource check; any other exit stops it and names
//! what an operator must do. It never deletes or resets chain data.
//!
//! Stop: SIGTERM or SIGINT to the supervisor (what `ace stop` sends), the end of `--run-for`,
//! or the job deadline (`ACE_DEADLINE_EPOCH`). The node gets SIGTERM and
//! `[runtime] shutdown_deadline_s` to drain and checkpoint; only then SIGKILL, recorded as an
//! unclean stop.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use nix::sys::signal::{Signal, kill};
use nix::unistd::Pid;
use serde::{Deserialize, Serialize};

use crate::builder::{self, Provenance, now_unix, rfc3339, write_atomically};
use crate::datadir;
use crate::error::{AceError, Result};
use crate::host;
use crate::lifecycle::{Lifecycle, State};
use crate::node_exit::{self, NodeExit, RestartAdvice};
use crate::nodecfg::{self, NodePlan};
use crate::oplog::{self, Category};
use crate::persistence::{self, Persistence};
use crate::preflight;
use crate::rpc::{self, NetworkStatus};
use crate::settings::{Deployment, Role};
use crate::tunnel::{self, Tunnel};

pub const STATE_FILE: &str = "state.json";
pub const NODE_LOG: &str = "node.log";
pub const SUPERVISOR_LOCK: &str = "supervisor.lock";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CleanStop {
    pub height: u64,
    pub state_root: String,
    pub at: String,
}

/// What `ace status` reads. Written atomically on every change.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeState {
    pub ace_version: String,
    pub state: State,
    pub since: String,
    pub reason: Option<String>,
    pub supervisor_pid: u32,
    pub node_pid: Option<u32>,
    pub commit: String,
    pub aletheiad_sha256: String,
    pub role: Role,
    pub network: String,
    pub chain_id: u32,
    pub genesis_id: Option<String>,
    pub persistence: Persistence,
    pub data_dir: PathBuf,
    pub p2p_listen: Option<String>,
    pub rpc_enabled: bool,
    pub rpc_listen: Option<String>,
    pub rpc_url: Option<String>,
    pub rpc_healthy: bool,
    pub public_url: Option<String>,
    pub public_healthy: Option<bool>,
    pub finalized_height: Option<u64>,
    pub finalized_block: Option<String>,
    pub last_height_change: Option<String>,
    pub restarts: u32,
    pub last_exit: Option<NodeExit>,
    pub last_clean_stop: Option<CleanStop>,
    pub last_error: Option<String>,
    pub node_rss_bytes: Option<u64>,
    pub data_dir_bytes: Option<u64>,
    pub data_disk_free_bytes: Option<u64>,
    pub updated_at: String,
}

pub fn read_state(state_dir: &Path) -> Result<RuntimeState> {
    let path = state_dir.join(STATE_FILE);
    let text = std::fs::read_to_string(&path).map_err(|e| AceError::io("read", &path, e))?;
    serde_json::from_str(&text).map_err(|e| AceError::Other(format!("{}: {e}", path.display())))
}

/// Whether a process with this id exists and has not exited. An exited process its parent
/// has not yet reaped (a zombie) still answers signal 0, so on Linux its state is read too.
pub fn alive(pid: u32) -> bool {
    if !i32::try_from(pid).is_ok_and(|p| kill(Pid::from_raw(p), None).is_ok()) {
        return false;
    }
    match std::fs::read_to_string(format!("/proc/{pid}/stat")) {
        // "pid (comm) S ...": the state follows the last ')'.
        Ok(stat) => stat
            .rsplit_once(')')
            .and_then(|(_, rest)| rest.split_whitespace().next())
            .is_none_or(|state| state != "Z" && state != "X"),
        Err(_) => true,
    }
}

/// Last `max` bytes of a file, as text.
pub fn tail(path: &Path, max: u64) -> String {
    let Ok(mut file) = File::open(path) else {
        return String::new();
    };
    let len = file.metadata().map(|m| m.len()).unwrap_or(0);
    let _ = file.seek(SeekFrom::Start(len.saturating_sub(max)));
    let mut bytes = Vec::new();
    let _ = file.read_to_end(&mut bytes);
    String::from_utf8_lossy(&bytes).into_owned()
}

fn rss_bytes(pid: u32) -> Option<u64> {
    let status = std::fs::read_to_string(format!("/proc/{pid}/status")).ok()?;
    let kib: u64 = status
        .lines()
        .find(|l| l.starts_with("VmRSS:"))?
        .split_whitespace()
        .nth(1)?
        .parse()
        .ok()?;
    kib.checked_mul(1024)
}

fn dir_bytes(path: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|e| match e.file_type() {
            Ok(t) if t.is_dir() => dir_bytes(&e.path()),
            Ok(t) if t.is_file() => e.metadata().map(|m| m.len()).unwrap_or(0),
            _ => 0,
        })
        .sum()
}

/// Copies the node's output into `node.log`, rotating once to `node.log.1` when the file
/// reaches half the byte budget, so the two never exceed `[runtime] max_log_bytes`.
fn pump(
    mut from: impl Read + Send + 'static,
    log: PathBuf,
    budget: u64,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let half = budget / 2;
        let open = |p: &Path| {
            std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(p)
        };
        let Ok(mut file) = open(&log) else { return };
        let mut buffer = [0u8; 8192];
        loop {
            let n = match from.read(&mut buffer) {
                Ok(0) | Err(_) => return,
                Ok(n) => n,
            };
            let _ = file.write_all(buffer.get(..n).unwrap_or_default());
            if file.metadata().map(|m| m.len()).unwrap_or(0) >= half {
                let _ = std::fs::rename(&log, log.with_extension("log.1"));
                match open(&log) {
                    Ok(f) => file = f,
                    Err(_) => return,
                }
            }
        }
    })
}

#[derive(Debug, Clone)]
pub struct StartOptions {
    /// Stop cleanly after this long (bounded runs on temporary compute).
    pub run_for: Option<Duration>,
    /// Never restart, whatever the exit.
    pub no_restart: bool,
}

/// Everything checked before a node may start. Shared by `ace start` and `ace inspect-config`.
pub struct Prepared {
    pub provenance: Provenance,
    pub plan: NodePlan,
    pub persistence: Persistence,
}

pub fn prepare(deployment: &Deployment) -> Result<Prepared> {
    let config = &deployment.config;
    builder::verify(deployment)?;
    let provenance = builder::load_provenance(&deployment.output_dir())?;
    let plan = nodecfg::inspect(
        &deployment.node_config(),
        &deployment.node_working_dir(),
        &deployment.daemon_path(),
        provenance.facts(),
    )?;
    plan.check_expectations(
        config.node.role,
        &config.node.expected_network,
        config.node.expected_chain_id,
    )?;
    for warning in &plan.warnings {
        oplog::warn(Category::Config, warning);
    }
    if plan.data_dir_initialized {
        let manifest = datadir::read_manifest(&plan.data_dir)?;
        if manifest.chain_id != config.node.expected_chain_id
            || manifest.network != config.node.expected_network
        {
            return Err(AceError::NodeConfig(format!(
                "data directory {} holds chain {} on {}; the deployment expects chain {} on {}",
                plan.data_dir.display(),
                manifest.chain_id,
                manifest.network,
                config.node.expected_chain_id,
                config.node.expected_network
            )));
        }
        if let Some(expected) = &config.node.expected_genesis_id
            && manifest.genesis_id != *expected
        {
            return Err(AceError::NodeConfig(format!(
                "data directory {} holds genesis {}; the deployment pins {expected}. ACE never re-initializes or replaces it",
                plan.data_dir.display(),
                manifest.genesis_id
            )));
        }
    }
    let persistence = persistence::classify(config.persistence.mode, &plan.data_dir);
    Ok(Prepared {
        provenance,
        plan,
        persistence,
    })
}

struct Supervisor<'a> {
    deployment: &'a Deployment,
    prepared: Prepared,
    lifecycle: Lifecycle,
    state: RuntimeState,
    log_path: PathBuf,
    stop_flag: Arc<AtomicBool>,
    restarts: Vec<Instant>,
    tunnel: Option<Tunnel>,
    /// Set when ACE itself stopped the node for a reason restarting cannot fix.
    halt: Option<String>,
}

impl Supervisor<'_> {
    fn save(&mut self) {
        self.state.state = self.lifecycle.state();
        self.state.updated_at = rfc3339(now_unix());
        if let Ok(json) = serde_json::to_vec_pretty(&self.state) {
            let path = self.deployment.state_dir().join(STATE_FILE);
            if let Err(e) = write_atomically(&path, &json) {
                oplog::warn(Category::Health, &format!("cannot record state: {e}"));
            }
        }
    }

    fn enter(&mut self, to: State, reason: Option<String>) {
        if self.lifecycle.state() == to && self.state.reason == reason {
            return;
        }
        match self.lifecycle.advance(to) {
            Ok(()) => {
                let line = match &reason {
                    Some(r) => format!("state {} ({r})", to.name()),
                    None => format!("state {}", to.name()),
                };
                let category = match to {
                    State::StartingNode => Category::Startup,
                    State::WaitingForRpc => Category::Rpc,
                    State::Recovering => Category::Recovery,
                    State::Stopping | State::Stopped => Category::Shutdown,
                    _ => Category::Health,
                };
                if matches!(to, State::Failed | State::Degraded) {
                    oplog::error(category, &line);
                } else {
                    oplog::info(category, &line);
                }
                self.state.since = rfc3339(now_unix());
                self.state.reason = reason;
            }
            Err(e) => oplog::error(Category::Health, &e.to_string()),
        }
        self.save();
    }

    fn stop_requested(&self) -> bool {
        self.stop_flag.load(Ordering::SeqCst)
    }

    fn spawn(&mut self) -> Result<Child> {
        let config = &self.deployment.config;
        let plan = &self.prepared.plan;
        // Refuse to start a second node, or on ports something else holds.
        if datadir::in_use(&plan.data_dir)? {
            return Err(AceError::Busy(format!(
                "{} is locked: a node is already running on it",
                plan.data_dir.display()
            )));
        }
        for (what, address) in std::iter::once(("P2P", plan.p2p_listen))
            .chain(plan.rpc.as_ref().map(|r| ("RPC", r.listen)))
        {
            if address.port() != 0
                && crate::sockets::holder(None, address) == crate::sockets::Holder::Other
            {
                return Err(AceError::Node(format!(
                    "the {what} address {address} is already in use by another process; the node would fail to bind it"
                )));
            }
        }
        let free = host::free_mib(&plan.data_dir).unwrap_or(0);
        if free < config.limits.min_free_disk_mb {
            return Err(AceError::Node(format!(
                "{free} MiB free for the data directory, below [limits] min_free_disk_mb = {}",
                config.limits.min_free_disk_mb
            )));
        }
        let daemon = self.deployment.daemon_path();
        let mut child = Command::new(&daemon)
            .arg("--config")
            .arg(&plan.config_path)
            .current_dir(&plan.working_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AceError::Node(format!("cannot start {}: {e}", daemon.display())))?;
        let budget = config.runtime.max_log_bytes;
        if let Some(out) = child.stdout.take() {
            pump(out, self.log_path.clone(), budget);
        }
        if let Some(err) = child.stderr.take() {
            pump(err, self.log_path.clone(), budget);
        }
        self.state.node_pid = Some(child.id());
        oplog::info(
            Category::Startup,
            &format!(
                "started {} --config {} pid={} cwd={}",
                daemon.display(),
                plan.config_path.display(),
                child.id(),
                plan.working_dir.display()
            ),
        );
        Ok(child)
    }

    fn log_text(&self) -> String {
        tail(&self.log_path, 256 * 1024)
    }

    /// Stops the node: SIGTERM, then SIGKILL after the deadline. Returns the exit.
    fn stop_node(&mut self, child: &mut Child) -> NodeExit {
        if let Some(tunnel) = self.tunnel.as_mut() {
            tunnel.stop();
        }
        let deadline = Duration::from_secs(self.deployment.config.runtime.shutdown_deadline_s);
        if let Ok(pid) = i32::try_from(child.id()) {
            let _ = kill(Pid::from_raw(pid), Signal::SIGTERM);
        }
        let started = Instant::now();
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break Some(status),
                Ok(None) if started.elapsed() < deadline => {
                    std::thread::sleep(Duration::from_millis(200))
                }
                _ => break None,
            }
        };
        let status = match status {
            Some(s) => s,
            None => {
                oplog::error(
                    Category::Shutdown,
                    &format!(
                        "the node did not stop within {} s; killing it (recovery runs at the next start)",
                        deadline.as_secs()
                    ),
                );
                let _ = child.kill();
                match child.wait() {
                    Ok(s) => s,
                    Err(e) => {
                        return NodeExit::Unknown {
                            code: e.raw_os_error().unwrap_or(-1),
                        };
                    }
                }
            }
        };
        // Let the log pumps catch the last lines.
        std::thread::sleep(Duration::from_millis(300));
        self.exit_of(status)
    }

    fn exit_of(&mut self, status: std::process::ExitStatus) -> NodeExit {
        use std::os::unix::process::ExitStatusExt;
        let log = self.log_text();
        let exit = node_exit::classify(status.code(), status.signal(), &log);
        let facts = rpc::log_facts(&log);
        if exit == NodeExit::CleanStop {
            if let (Some(height), Some(root)) = (
                facts.stopped_cleanly_height,
                facts.stopped_cleanly_state_root,
            ) {
                self.state.last_clean_stop = Some(CleanStop {
                    height,
                    state_root: root,
                    at: rfc3339(now_unix()),
                });
            }
        } else {
            self.state.last_clean_stop = None;
        }
        self.state.last_exit = Some(exit.clone());
        self.state.node_pid = None;
        exit
    }

    /// Waits for the node's `following` line (start-up finished) or its exit.
    fn await_startup(&mut self, child: &mut Child) -> std::result::Result<(), NodeExit> {
        let deadline =
            Instant::now() + Duration::from_secs(self.deployment.config.runtime.startup_timeout_s);
        loop {
            if let Ok(Some(status)) = child.try_wait() {
                std::thread::sleep(Duration::from_millis(300));
                return Err(self.exit_of(status));
            }
            let facts = rpc::log_facts(&self.log_text());
            if facts.p2p_listen.is_some() {
                self.state.genesis_id = facts.genesis_id.clone();
                self.state.p2p_listen = facts.p2p_listen.map(|a| a.to_string());
                return Ok(());
            }
            if Instant::now() >= deadline || self.stop_requested() {
                return Err(self.stop_node(child));
            }
            std::thread::sleep(Duration::from_millis(250));
        }
    }

    fn check_genesis(&mut self) -> Result<()> {
        let expected = self.deployment.config.node.expected_genesis_id.clone();
        match (&self.state.genesis_id, expected) {
            (Some(actual), Some(expected)) if *actual != expected => Err(AceError::Node(format!(
                "the node loaded genesis {actual}; the deployment pins {expected}"
            ))),
            (None, _) => Err(AceError::Node(
                "the node did not report its genesis id".to_owned(),
            )),
            (Some(actual), None) => {
                oplog::warn(
                    Category::Config,
                    &format!(
                        "no expected_genesis_id is pinned; the node runs genesis {actual}. Pin it in ace.toml once this chain is the intended one"
                    ),
                );
                Ok(())
            }
            _ => Ok(()),
        }
    }

    fn probe_rpc(&mut self, pid: u32) -> Option<NetworkStatus> {
        let config = &self.deployment.config;
        let report = rpc::inspect(
            &self.prepared.plan,
            Some(pid),
            &self.log_text(),
            &config.node.expected_network,
            config.node.expected_chain_id,
            Duration::from_secs(5),
        );
        self.state.rpc_listen = report.effective_listen.map(|a| a.to_string());
        self.state.rpc_url = report.json_rpc_url.clone();
        self.state.rpc_healthy = report.healthy();
        if let Some(problem) = &report.problem {
            self.state.last_error = Some(problem.clone());
        }
        if report.p2p_is_not_rpc == Some(false) {
            self.state.last_error = Some(
                "the P2P listener answered as RPC; refusing to treat either as healthy".to_owned(),
            );
            self.state.rpc_healthy = false;
            return None;
        }
        report.status.filter(|_| report.problem.is_none())
    }

    /// The serving state for the current facts.
    fn serving_state(&self, advancing: bool) -> (State, Option<String>) {
        let plan = &self.prepared.plan;
        match plan.role {
            Role::Observer if plan.peers.is_empty() => (
                State::Degraded,
                Some(
                    "observer with no peers: it serves genesis and cannot follow a chain"
                        .to_owned(),
                ),
            ),
            // The node reports syncing=false unconditionally at the audited commit, and peer
            // heights are not exposed, so "caught up" cannot be observed for a follower.
            Role::Observer => (
                State::Syncing,
                Some(
                    "following peers; completion of sync is not observable at this commit"
                        .to_owned(),
                ),
            ),
            Role::DevnetProducer | Role::Validator if !advancing => (
                State::Degraded,
                Some(format!(
                    "finalized height has not advanced for {} s",
                    self.deployment.config.runtime.stall_after_s
                )),
            ),
            Role::DevnetProducer | Role::Validator => {
                if self.prepared.persistence.is_durable() {
                    (State::Ready, None)
                } else {
                    (
                        State::EphemeralMode,
                        Some("serving; chain data does not outlive this host".to_owned()),
                    )
                }
            }
        }
    }

    fn run(&mut self, options: &StartOptions) -> Result<()> {
        let config = self.deployment.config.clone();
        let started = Instant::now();
        let deadline = preflight::seconds_remaining().map(|left| {
            // Leave time for the node's shutdown and for ACE to save diagnostics.
            Instant::now()
                + Duration::from_secs(left.saturating_sub(config.runtime.shutdown_deadline_s + 60))
        });
        loop {
            self.enter(State::StartingNode, None);
            let mut child = match self.spawn() {
                Ok(child) => child,
                Err(e) => {
                    self.state.last_error = Some(e.to_string());
                    self.enter(State::Failed, Some(e.to_string()));
                    return Err(e);
                }
            };
            let pid = child.id();
            let exit = match self.await_startup(&mut child) {
                Err(exit) => exit,
                Ok(()) => {
                    if let Err(e) = self.check_genesis() {
                        self.state.last_error = Some(e.to_string());
                        self.enter(State::Stopping, Some(e.to_string()));
                        let exit = self.stop_node(&mut child);
                        self.enter(State::Stopped, Some(exit.summary()));
                        self.enter(State::Failed, Some(e.to_string()));
                        return Err(e);
                    }
                    self.watch(&mut child, pid, options, started, deadline)
                }
            };
            if let Some(reason) = self.halt.take() {
                self.enter(State::Failed, Some(reason.clone()));
                return Err(AceError::Node(reason));
            }
            let requested = self.stop_requested()
                || options.run_for.is_some_and(|d| started.elapsed() >= d)
                || deadline.is_some_and(|d| Instant::now() >= d);
            let advice = exit.advice(requested);
            match advice {
                RestartAdvice::None => {
                    if self.lifecycle.state() != State::Stopping {
                        self.enter(State::Stopping, None);
                    }
                    self.enter(State::Stopped, Some(exit.summary()));
                    return Ok(());
                }
                RestartAdvice::Operator => {
                    let reason = exit.summary();
                    self.state.last_error = Some(reason.clone());
                    self.enter(State::Failed, Some(reason.clone()));
                    return Err(AceError::Node(reason));
                }
                RestartAdvice::Restart => {
                    oplog::error(
                        Category::Recovery,
                        &format!("node exited: {}", exit.summary()),
                    );
                    if options.no_restart {
                        let reason = format!("{} (restart disabled)", exit.summary());
                        self.enter(State::Failed, Some(reason.clone()));
                        return Err(AceError::Node(reason));
                    }
                    let window = Duration::from_secs(config.runtime.restart_window_s);
                    self.restarts.retain(|t| t.elapsed() < window);
                    if self.restarts.len()
                        >= usize::try_from(config.runtime.max_restarts).unwrap_or(0)
                    {
                        let reason = format!(
                            "{} restarts within {} s; leaving the node down for an operator. Last exit: {}",
                            self.restarts.len(),
                            window.as_secs(),
                            exit.summary()
                        );
                        self.enter(State::Failed, Some(reason.clone()));
                        return Err(AceError::Node(reason));
                    }
                    let attempt = u32::try_from(self.restarts.len()).unwrap_or(u32::MAX);
                    let backoff = config
                        .runtime
                        .backoff_initial_ms
                        .saturating_mul(1u64 << attempt.min(16))
                        .min(config.runtime.backoff_max_ms);
                    self.restarts.push(Instant::now());
                    self.state.restarts = self.state.restarts.saturating_add(1);
                    self.enter(
                        State::Recovering,
                        Some(format!(
                            "restarting in {backoff} ms after: {}",
                            exit.summary()
                        )),
                    );
                    let wake = Instant::now() + Duration::from_millis(backoff);
                    while Instant::now() < wake {
                        if self.stop_requested() {
                            self.enter(
                                State::Stopped,
                                Some("stop requested during recovery".to_owned()),
                            );
                            return Ok(());
                        }
                        std::thread::sleep(Duration::from_millis(200));
                    }
                    // Recheck resources before every restart.
                    let check = preflight::run(
                        self.deployment,
                        preflight::Stage::Run,
                        Some(&self.prepared.plan.data_dir),
                    );
                    if !check.verdict.permits() {
                        let reason =
                            format!("not restarting: preflight is {}", check.verdict.name());
                        self.enter(State::Failed, Some(reason.clone()));
                        return Err(AceError::Preflight(reason));
                    }
                }
            }
        }
    }

    /// Watches a started node until it exits or must be stopped. Returns its exit.
    fn watch(
        &mut self,
        child: &mut Child,
        pid: u32,
        options: &StartOptions,
        started: Instant,
        deadline: Option<Instant>,
    ) -> NodeExit {
        let config = self.deployment.config.clone();
        let interval = Duration::from_secs(config.runtime.health_interval_s);
        let stall = Duration::from_secs(config.runtime.stall_after_s);
        let rpc_deadline = Instant::now() + Duration::from_secs(config.runtime.rpc_ready_timeout_s);
        let mut last_height: Option<u64> = None;
        let mut last_change = Instant::now();
        let mut seen_advance = false;
        let mut next_check = Instant::now();
        if self.prepared.plan.rpc.is_some() {
            self.enter(State::WaitingForRpc, None);
        } else {
            self.enter(
                State::WaitingForRpc,
                Some("RPC is disabled in the node configuration; no application-level health check is possible".to_owned()),
            );
        }
        loop {
            if let Ok(Some(status)) = child.try_wait() {
                std::thread::sleep(Duration::from_millis(300));
                return self.exit_of(status);
            }
            let bounded_out = options.run_for.is_some_and(|d| started.elapsed() >= d);
            let deadline_out = deadline.is_some_and(|d| Instant::now() >= d);
            if self.stop_requested() || bounded_out || deadline_out {
                let why = if bounded_out {
                    "the bounded run (--run-for) ended"
                } else if deadline_out {
                    "the job deadline is near"
                } else {
                    "stop requested"
                };
                self.enter(State::Stopping, Some(why.to_owned()));
                return self.stop_node(child);
            }
            if Instant::now() < next_check {
                std::thread::sleep(Duration::from_millis(200));
                continue;
            }
            // Poll every second until the node is serving, then at the health interval.
            next_check = Instant::now()
                + if self.lifecycle.state().is_serving()
                    || self.lifecycle.state() == State::Degraded
                {
                    interval
                } else {
                    Duration::from_secs(1)
                };

            // Resources: a node below the disk floor is stopped cleanly before the disk fills.
            self.state.node_rss_bytes = rss_bytes(pid);
            let data_dir = self.prepared.plan.data_dir.clone();
            self.state.data_dir_bytes = Some(dir_bytes(&data_dir));
            let disk = host::disk(&data_dir);
            self.state.data_disk_free_bytes = disk.as_ref().map(|d| d.free_bytes);
            if let Some(d) = disk
                && d.free_bytes / (1024 * 1024) < config.limits.min_free_disk_mb
            {
                let reason = format!(
                    "{} MiB free for the data directory, below [limits] min_free_disk_mb = {}; stopping the node cleanly before the disk fills",
                    d.free_bytes / (1024 * 1024),
                    config.limits.min_free_disk_mb
                );
                self.state.last_error = Some(reason.clone());
                self.enter(State::Stopping, Some(reason.clone()));
                // Not restartable: the disk is still full.
                self.halt = Some(reason);
                return self.stop_node(child);
            }

            if self.prepared.plan.rpc.is_none() {
                if Instant::now() >= rpc_deadline && self.lifecycle.state() == State::WaitingForRpc
                {
                    self.enter(
                        State::Degraded,
                        Some(
                            "RPC disabled: the node runs but cannot be checked or served"
                                .to_owned(),
                        ),
                    );
                }
                self.save();
                continue;
            }
            match self.probe_rpc(pid) {
                Some(status) => {
                    if last_height != Some(status.finalized_height) {
                        if last_height.is_some() {
                            seen_advance = true;
                        }
                        last_height = Some(status.finalized_height);
                        last_change = Instant::now();
                        self.state.last_height_change = Some(rfc3339(now_unix()));
                    }
                    self.state.finalized_height = Some(status.finalized_height);
                    self.state.finalized_block = Some(status.finalized_block.clone());
                    let advancing = last_change.elapsed() < stall;
                    if !seen_advance
                        && advancing
                        && matches!(
                            self.prepared.plan.role,
                            Role::DevnetProducer | Role::Validator
                        )
                    {
                        // Wait for one observed advance before claiming the chain is live.
                        self.enter(
                            State::Syncing,
                            Some(
                                "RPC answers; waiting to observe the finalized height advance"
                                    .to_owned(),
                            ),
                        );
                    } else {
                        let (state, reason) = self.serving_state(advancing);
                        self.enter(state, reason);
                    }
                    self.manage_tunnel();
                }
                None => {
                    if let Some(t) = self.tunnel.as_mut() {
                        // Never leave a public route open to an unhealthy node.
                        t.stop();
                        self.state.public_healthy = Some(false);
                    }
                    let state = self.lifecycle.state();
                    if state == State::WaitingForRpc && Instant::now() < rpc_deadline {
                        self.save();
                        continue;
                    }
                    let reason = self
                        .state
                        .last_error
                        .clone()
                        .unwrap_or_else(|| "RPC check failed".to_owned());
                    self.enter(State::Degraded, Some(reason));
                }
            }
            self.save();
        }
    }

    fn manage_tunnel(&mut self) {
        let config = &self.deployment.config;
        if config.tunnel.provider == crate::settings::TunnelProvider::None {
            return;
        }
        let Some(listen) = self.state.rpc_listen.as_ref().and_then(|l| l.parse().ok()) else {
            return;
        };
        if !self.lifecycle.state().is_serving() {
            return;
        }
        let tunnel = self
            .tunnel
            .get_or_insert_with(|| Tunnel::new(&config.tunnel, &self.deployment.state_dir()));
        if let Err(e) = tunnel.ensure(rpc::connect_address(listen)) {
            self.state.last_error = Some(e.to_string());
            self.state.public_healthy = Some(false);
            return;
        }
        let expected = (
            self.state.chain_id,
            self.state.network.clone(),
            self.state.finalized_height,
        );
        self.state.public_healthy = Some(
            tunnel::verify_public(tunnel.public_url(), expected.0, &expected.1, expected.2).is_ok(),
        );
    }
}

pub fn start(deployment: &Deployment, options: &StartOptions) -> Result<()> {
    let state_dir = deployment.state_dir();
    std::fs::create_dir_all(&state_dir).map_err(|e| AceError::io("create", &state_dir, e))?;
    let lock_path = state_dir.join(SUPERVISOR_LOCK);
    let lock = File::create(&lock_path).map_err(|e| AceError::io("create", &lock_path, e))?;
    if lock.try_lock().is_err() {
        return Err(AceError::Busy(format!(
            "another ace supervisor holds {}",
            lock_path.display()
        )));
    }
    let mut lifecycle = Lifecycle::default();
    let _ = lifecycle.advance(State::Preflight);
    let check = preflight::run(deployment, preflight::Stage::Run, None);
    for finding in &check.findings {
        if finding.verdict != preflight::Verdict::Ready {
            oplog::warn(
                Category::Preflight,
                &format!(
                    "{}: {} ({})",
                    finding.check,
                    finding.detail,
                    finding.verdict.name()
                ),
            );
        }
    }
    if !check.verdict.permits() {
        return Err(AceError::Preflight(format!(
            "verdict {}",
            check.verdict.name()
        )));
    }
    let prepared = prepare(deployment)?;
    let config = &deployment.config;
    let stop_flag = Arc::new(AtomicBool::new(false));
    for signal in [signal_hook::consts::SIGTERM, signal_hook::consts::SIGINT] {
        signal_hook::flag::register(signal, Arc::clone(&stop_flag))
            .map_err(|e| AceError::Other(format!("cannot install signal handler: {e}")))?;
    }
    let previous = read_state(&state_dir).ok();
    let state = RuntimeState {
        ace_version: env!("CARGO_PKG_VERSION").to_owned(),
        state: State::Stopped,
        since: rfc3339(now_unix()),
        reason: None,
        supervisor_pid: std::process::id(),
        node_pid: None,
        commit: prepared.provenance.commit.clone(),
        aletheiad_sha256: prepared
            .provenance
            .binaries
            .iter()
            .find(|b| b.name == "aletheiad")
            .map(|b| b.sha256.clone())
            .unwrap_or_default(),
        role: config.node.role,
        network: config.node.expected_network.clone(),
        chain_id: config.node.expected_chain_id,
        genesis_id: None,
        persistence: prepared.persistence.clone(),
        data_dir: prepared.plan.data_dir.clone(),
        p2p_listen: None,
        rpc_enabled: prepared.plan.rpc.is_some(),
        rpc_listen: None,
        rpc_url: None,
        rpc_healthy: false,
        public_url: config.tunnel.public_url.clone(),
        public_healthy: None,
        finalized_height: None,
        finalized_block: None,
        last_height_change: None,
        restarts: 0,
        last_exit: None,
        last_clean_stop: previous.and_then(|p| p.last_clean_stop),
        last_error: None,
        node_rss_bytes: None,
        data_dir_bytes: None,
        data_disk_free_bytes: None,
        updated_at: rfc3339(now_unix()),
    };
    match &prepared.persistence {
        Persistence::EphemeralMode { reason } => {
            oplog::warn(Category::Persistence, &format!("EPHEMERAL_MODE: {reason}"))
        }
        Persistence::PersistenceUnavailable { reason } => {
            return Err(AceError::Persistence(reason.clone()));
        }
        Persistence::PersistentDeclared { .. } => oplog::info(
            Category::Persistence,
            "data directory declared persistent by the operator",
        ),
    }
    let mut supervisor = Supervisor {
        deployment,
        prepared,
        lifecycle,
        state,
        log_path: state_dir.join(NODE_LOG),
        stop_flag,
        restarts: Vec::new(),
        tunnel: None,
        halt: None,
    };
    supervisor.save();
    let result = supervisor.run(options);
    if let Some(t) = supervisor.tunnel.as_mut() {
        t.stop();
    }
    supervisor.save();
    drop(lock);
    result
}

/// Asks a running supervisor to stop the node cleanly, and waits for it.
pub fn stop(deployment: &Deployment, wait: Duration) -> Result<RuntimeState> {
    let state_dir = deployment.state_dir();
    let state = read_state(&state_dir)?;
    if !alive(state.supervisor_pid) {
        return Err(AceError::Node(format!(
            "no supervisor is running (pid {} is gone); state {}",
            state.supervisor_pid,
            state.state.name()
        )));
    }
    let pid =
        i32::try_from(state.supervisor_pid).map_err(|_| AceError::Other("bad pid".to_owned()))?;
    kill(Pid::from_raw(pid), Signal::SIGTERM)
        .map_err(|e| AceError::Node(format!("cannot signal supervisor {pid}: {e}")))?;
    let until = Instant::now() + wait;
    while Instant::now() < until {
        if !alive(state.supervisor_pid) {
            return read_state(&state_dir);
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    Err(AceError::Node(format!(
        "the supervisor did not finish within {} s; it may still be draining the node",
        wait.as_secs()
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_exited_unreaped_process_is_not_alive() {
        let mut child = Command::new("true").spawn().unwrap();
        let pid = child.id();
        // Give it time to exit without reaping it.
        for _ in 0..50 {
            if !alive(pid) {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(!alive(pid), "a zombie counts as gone");
        child.wait().unwrap();
        assert!(alive(std::process::id()));
    }

    #[test]
    fn the_log_tail_is_bounded() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("log");
        std::fs::write(&path, "a".repeat(1000) + "end").unwrap();
        assert_eq!(tail(&path, 3), "end");
        assert_eq!(tail(&dir.path().join("missing"), 3), "");
    }
}
