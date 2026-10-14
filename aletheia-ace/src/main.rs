//! `ace`: the operator command line. Reports go to stdout (JSON unless stated), log lines to
//! stderr. Exit statuses are listed in `ace::error::exit` and docs/CLI.md.

use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Duration;

use ace::builder;
use ace::error::{AceError, Result, exit};
use ace::lifecycle::State;
use ace::nodecfg;
use ace::oplog::{self, Category};
use ace::preflight::{self, Stage};
use ace::rpc;
use ace::settings::Deployment;
use ace::snapshot::{self, Expectations};
use ace::source;
use ace::supervisor::{self, StartOptions};
use clap::{Parser, Subcommand, ValueEnum};
use serde::Serialize;

#[derive(Debug, Parser)]
#[command(
    name = "ace",
    version,
    about = "Aletheia Compute Engine: build, run and recover the StableChain node"
)]
struct Cli {
    /// The deployment configuration.
    #[arg(long, short, global = true, default_value = "ace.toml")]
    config: PathBuf,
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum StageArg {
    Build,
    Run,
}

#[derive(Debug, Subcommand)]
enum Cmd {
    /// Report the pinned source and the workspace manifests it holds. Read-only.
    InspectSource {
        /// Also resolve this branch or tag on the remote (information only; never built).
        #[arg(long)]
        resolve: Option<String>,
    },
    /// Fetch the pinned commit from GitLab into the checkout directory and verify it.
    FetchSource,
    /// Measure the environment and give a verdict. Read-only.
    Preflight {
        #[arg(long, value_enum, default_value_t = StageArg::Build)]
        stage: StageArg,
    },
    /// Preflight, fetch, compile, collect, hash and verify the binaries.
    Build,
    /// Re-check the collected binaries against their provenance record. Read-only.
    VerifyBuild,
    /// Read the node configuration with the daemon's rules and print it redacted. Read-only.
    InspectConfig,
    /// Discover the RPC listener and check it at the protocol level. Read-only.
    InspectRpc,
    /// Take a checkpoint of the stopped node's data directory.
    Checkpoint,
    /// Validate a checkpoint completely without restoring it. Read-only.
    ValidateSnapshot { manifest: PathBuf },
    /// Restore a validated checkpoint into the (absent or empty) data directory.
    RestoreSnapshot {
        /// A checkpoint manifest, or "latest" for the newest valid one in checkpoint_dir.
        manifest: String,
        /// Required: this writes the node's data directory.
        #[arg(long)]
        yes: bool,
    },
    /// After a restore, check the running node against the checkpoint it came from.
    VerifyRestore { manifest: PathBuf },
    /// Run the node under supervision in the foreground until stopped.
    Start {
        /// Stop cleanly after this many seconds (bounded runs on temporary compute).
        #[arg(long)]
        run_for: Option<u64>,
        /// Never restart the node, whatever its exit.
        #[arg(long)]
        no_restart: bool,
    },
    /// The supervisor's recorded state. Read-only.
    Status {
        #[arg(long)]
        json: bool,
    },
    /// Check the node now, at the application level. Exit 0 only when it serves. Read-only.
    Health,
    /// Print the end of the node's log.
    Logs {
        #[arg(long, default_value_t = 100)]
        lines: usize,
    },
    /// Ask the supervisor to stop the node cleanly and wait for it.
    Stop {
        #[arg(long, default_value_t = 180)]
        wait: u64,
    },
    /// Check the public endpoint from this host.
    PublicCheck,
    /// Collect a diagnostic bundle (no secrets) into a directory.
    Diagnose {
        #[arg(long, default_value = "ace-diagnostics")]
        out: PathBuf,
    },
}

fn print_json<T: Serialize>(value: &T) -> Result<()> {
    let text = serde_json::to_string_pretty(value).map_err(|e| AceError::Other(e.to_string()))?;
    println!("{}", oplog::redact(&text));
    Ok(())
}

fn expectations(deployment: &Deployment) -> Expectations {
    let config = &deployment.config;
    Expectations {
        network: config.node.expected_network.clone(),
        chain_id: config.node.expected_chain_id,
        genesis_id: config.node.expected_genesis_id.clone(),
        binary_storage_schema: snapshot::source_storage_schema(&deployment.workspace_dir()),
        max_bytes: config.limits.max_snapshot_mb.saturating_mul(1024 * 1024),
    }
}

fn node_plan(deployment: &Deployment) -> Result<nodecfg::NodePlan> {
    let facts = builder::load_provenance(&deployment.output_dir())
        .map(|p| p.facts())
        .unwrap_or_else(|_| {
            oplog::warn(
                Category::Config,
                "no build provenance yet: assuming a build without devnet-producer",
            );
            nodecfg::BuildFacts {
                devnet_producer: false,
            }
        });
    nodecfg::inspect(
        &deployment.node_config(),
        &deployment.node_working_dir(),
        &deployment.daemon_path(),
        facts,
    )
}

fn running_pid(deployment: &Deployment) -> Option<u32> {
    supervisor::read_state(&deployment.state_dir())
        .ok()
        .and_then(|s| s.node_pid)
        .filter(|p| supervisor::alive(*p))
}

fn run(cli: Cli) -> Result<()> {
    let deployment = Deployment::load(&cli.config)?;
    let config = &deployment.config;
    match cli.command {
        Cmd::InspectSource { resolve } => {
            #[derive(Serialize)]
            struct Report {
                repository: String,
                pinned_commit: String,
                reference_label: Option<String>,
                resolved: Option<(String, String)>,
                workspace: Option<source::WorkspaceReport>,
                workspace_error: Option<String>,
            }
            let resolved = match resolve {
                Some(r) => Some((
                    r.clone(),
                    source::resolve_remote(&config.source.repository, &r)?,
                )),
                None => None,
            };
            let (workspace, workspace_error) = match source::inspect_workspace(&deployment) {
                Ok(w) => (Some(w), None),
                Err(e) => (None, Some(e.to_string())),
            };
            print_json(&Report {
                repository: config.source.repository.clone(),
                pinned_commit: config.source.commit.clone(),
                reference_label: config.source.reference.clone(),
                resolved,
                workspace,
                workspace_error,
            })
        }
        Cmd::FetchSource => {
            let commit = source::fetch(&deployment)?;
            print_json(
                &serde_json::json!({ "commit": commit, "checkout": deployment.checkout_dir() }),
            )
        }
        Cmd::Preflight { stage } => {
            let stage = match stage {
                StageArg::Build => Stage::Build,
                StageArg::Run => Stage::Run,
            };
            let report = preflight::run(&deployment, stage, None);
            print_json(&report)?;
            oplog::info(
                Category::Preflight,
                &format!("verdict {}", report.verdict.name()),
            );
            if report.verdict.permits() {
                Ok(())
            } else {
                Err(AceError::Preflight(format!(
                    "verdict {}",
                    report.verdict.name()
                )))
            }
        }
        Cmd::Build => {
            let report = preflight::run(&deployment, Stage::Build, None);
            for f in report
                .findings
                .iter()
                .filter(|f| f.verdict != preflight::Verdict::Ready)
            {
                oplog::warn(
                    Category::Preflight,
                    &format!("{}: {} ({})", f.check, f.detail, f.verdict.name()),
                );
            }
            if !report.verdict.permits() {
                return Err(AceError::Preflight(format!(
                    "verdict {}",
                    report.verdict.name()
                )));
            }
            source::fetch(&deployment)?;
            let workspace = source::inspect_workspace(&deployment)?;
            if !workspace.problems.is_empty() {
                return Err(AceError::Source(workspace.problems.join("; ")));
            }
            let provenance =
                builder::build(&deployment, &deployment.state_dir().join("build.log"))?;
            builder::verify(&deployment)?;
            print_json(&provenance)
        }
        Cmd::VerifyBuild => print_json(&builder::verify(&deployment)?),
        Cmd::InspectConfig => {
            let plan = node_plan(&deployment)?;
            plan.check_expectations(
                config.node.role,
                &config.node.expected_network,
                config.node.expected_chain_id,
            )?;
            print_json(&plan)
        }
        Cmd::InspectRpc => {
            let plan = node_plan(&deployment)?;
            let log = supervisor::tail(
                &deployment.state_dir().join(supervisor::NODE_LOG),
                256 * 1024,
            );
            let report = rpc::inspect(
                &plan,
                running_pid(&deployment),
                &log,
                &config.node.expected_network,
                config.node.expected_chain_id,
                Duration::from_secs(5),
            );
            print_json(&report)?;
            if report.healthy() {
                Ok(())
            } else {
                Err(AceError::Rpc(
                    report
                        .problem
                        .unwrap_or_else(|| "RPC unavailable".to_owned()),
                ))
            }
        }
        Cmd::Checkpoint => {
            let plan = node_plan(&deployment)?;
            let state = supervisor::read_state(&deployment.state_dir()).ok();
            if let Some(s) = &state
                && s.node_pid.is_some_and(supervisor::alive)
            {
                return Err(AceError::Snapshot(
                    "the node is running; stop it first (ace stop)".to_owned(),
                ));
            }
            let provenance = builder::load_provenance(&deployment.output_dir())?;
            let daemon_hash = provenance
                .binaries
                .iter()
                .find(|b| b.name == "aletheiad")
                .map(|b| b.sha256.clone())
                .unwrap_or_default();
            let path = snapshot::create(&snapshot::CreateInput {
                data_dir: &plan.data_dir,
                out_dir: &deployment.checkpoint_dir(),
                source_commit: &provenance.commit,
                aletheiad_sha256: &daemon_hash,
                last_clean_stop: state.and_then(|s| s.last_clean_stop).map(|c| c.height),
                max_bytes: config.limits.max_snapshot_mb.saturating_mul(1024 * 1024),
            })?;
            // Prove the checkpoint just written reads back.
            let manifest = snapshot::validate(&path, &expectations(&deployment))?;
            print_json(
                &serde_json::json!({ "manifest": path, "height": manifest.identity.last_finalized.map(|f| f.height), "clean_stop": manifest.clean_stop, "archive_sha256": manifest.archive_sha256, "verified": true }),
            )
        }
        Cmd::ValidateSnapshot { manifest } => {
            let m = snapshot::validate(&manifest, &expectations(&deployment))?;
            print_json(&m)
        }
        Cmd::RestoreSnapshot { manifest, yes } => {
            if !yes {
                return Err(AceError::Snapshot(
                    "restoring writes the node's data directory; pass --yes to confirm".to_owned(),
                ));
            }
            if running_pid(&deployment).is_some() {
                return Err(AceError::Snapshot(
                    "the node is running; stop it first".to_owned(),
                ));
            }
            let expect = expectations(&deployment);
            let path = if manifest == "latest" {
                snapshot::latest_valid(&deployment.checkpoint_dir(), &expect)?
                    .map(|(p, _)| p)
                    .ok_or_else(|| {
                        AceError::Snapshot(format!(
                            "no valid checkpoint in {}",
                            deployment.checkpoint_dir().display()
                        ))
                    })?
            } else {
                PathBuf::from(manifest)
            };
            let plan = node_plan(&deployment)?;
            let report = snapshot::restore(&path, &plan.data_dir, &expect)?;
            builder::write_atomically(
                &deployment.state_dir().join("restore-report.json"),
                &serde_json::to_vec_pretty(&report).map_err(|e| AceError::Other(e.to_string()))?,
            )?;
            print_json(&report)
        }
        Cmd::VerifyRestore { manifest } => {
            let m = snapshot::load(&manifest)?;
            let state = supervisor::read_state(&deployment.state_dir())?;
            let url = state.rpc_url.ok_or_else(|| {
                AceError::Rpc("the supervisor has not discovered an RPC URL".to_owned())
            })?;
            let status = rpc::status_at(&url, Duration::from_secs(5))?;
            rpc::check_identity(&status, &m.identity.network, m.identity.chain_id)?;
            let Some(f) = &m.identity.last_finalized else {
                return print_json(
                    &serde_json::json!({ "verified": true, "note": "checkpoint at genesis; nothing to compare" }),
                );
            };
            if status.finalized_height < f.height {
                return Err(AceError::Snapshot(format!(
                    "the restored node is at height {}, below the checkpoint's {}: finalized history was lost",
                    status.finalized_height, f.height
                )));
            }
            let block =
                rpc::block_at(&url, f.height, Duration::from_secs(5))?.ok_or_else(|| {
                    AceError::Snapshot(format!("the restored node has no block at {}", f.height))
                })?;
            if block.state_root != f.state_root {
                return Err(AceError::Snapshot(format!(
                    "state root at height {} is {}, the checkpoint recorded {}",
                    f.height, block.state_root, f.state_root
                )));
            }
            oplog::info(
                Category::Recovery,
                &format!(
                    "restore verified: height {} state_root {} matches; node now at {}",
                    f.height, f.state_root, status.finalized_height
                ),
            );
            print_json(
                &serde_json::json!({ "verified": true, "checkpoint_height": f.height, "state_root": f.state_root, "block": block.id, "node_height": status.finalized_height }),
            )
        }
        Cmd::Start {
            run_for,
            no_restart,
        } => supervisor::start(
            &deployment,
            &StartOptions {
                run_for: run_for.map(Duration::from_secs),
                no_restart,
            },
        ),
        Cmd::Status { json } => {
            let state = supervisor::read_state(&deployment.state_dir())?;
            let supervisor_alive = supervisor::alive(state.supervisor_pid);
            if json {
                return print_json(
                    &serde_json::json!({ "supervisor_alive": supervisor_alive, "state": state }),
                );
            }
            let shown = if supervisor_alive
                || !matches!(
                    state.state,
                    State::Ready
                        | State::EphemeralMode
                        | State::Syncing
                        | State::Degraded
                        | State::WaitingForRpc
                        | State::StartingNode
                ) {
                state.state.name().to_owned()
            } else {
                format!(
                    "{} (stale: the supervisor is gone; the node is not supervised)",
                    state.state.name()
                )
            };
            let opt = |v: &Option<String>| v.clone().unwrap_or_else(|| "-".to_owned());
            println!(
                "ace {}  state {shown}  since {}",
                state.ace_version, state.since
            );
            if let Some(r) = &state.reason {
                println!("  reason        {r}");
            }
            println!("  commit        {}", state.commit);
            println!("  aletheiad     sha256 {}", state.aletheiad_sha256);
            println!(
                "  network       {} chain {} genesis {}",
                state.network,
                state.chain_id,
                opt(&state.genesis_id)
            );
            println!("  role          {:?}", state.role);
            println!(
                "  node          {}",
                state
                    .node_pid
                    .map_or("not running".to_owned(), |p| format!("pid {p}"))
            );
            println!(
                "  persistence   {}",
                serde_json::to_string(&state.persistence).unwrap_or_default()
            );
            println!(
                "  finalized     height {} block {}",
                state
                    .finalized_height
                    .map_or("-".to_owned(), |h| h.to_string()),
                opt(&state.finalized_block)
            );
            println!("  p2p           {}", opt(&state.p2p_listen));
            println!(
                "  rpc           {} listen {} url {} healthy {}",
                if state.rpc_enabled {
                    "enabled"
                } else {
                    "DISABLED"
                },
                opt(&state.rpc_listen),
                opt(&state.rpc_url),
                state.rpc_healthy
            );
            println!(
                "  public        {} {}",
                opt(&state.public_url),
                state
                    .public_healthy
                    .map_or("not configured".to_owned(), |h| if h {
                        "verified online".to_owned()
                    } else {
                        "OFFLINE".to_owned()
                    })
            );
            println!(
                "  last stop     {}",
                state
                    .last_clean_stop
                    .as_ref()
                    .map_or("-".to_owned(), |c| format!(
                        "clean at height {} ({})",
                        c.height, c.at
                    ))
            );
            println!(
                "  resources     rss {} data_dir {} disk_free {}",
                state
                    .node_rss_bytes
                    .map_or("-".to_owned(), |b| format!("{} MiB", b / 1048576)),
                state
                    .data_dir_bytes
                    .map_or("-".to_owned(), |b| format!("{} KiB", b / 1024)),
                state
                    .data_disk_free_bytes
                    .map_or("-".to_owned(), |b| format!("{} MiB", b / 1048576))
            );
            println!("  restarts      {}", state.restarts);
            println!("  last error    {}", opt(&state.last_error));
            Ok(())
        }
        Cmd::Health => {
            let plan = node_plan(&deployment)?;
            let pid = running_pid(&deployment);
            let log = supervisor::tail(
                &deployment.state_dir().join(supervisor::NODE_LOG),
                256 * 1024,
            );
            let report = rpc::inspect(
                &plan,
                pid,
                &log,
                &config.node.expected_network,
                config.node.expected_chain_id,
                Duration::from_secs(5),
            );
            let state = supervisor::read_state(&deployment.state_dir()).ok();
            let serving = state
                .as_ref()
                .is_some_and(|s| s.state.is_serving() && supervisor::alive(s.supervisor_pid));
            print_json(&serde_json::json!({
                "process": if pid.is_some() { "running" } else { "not running" },
                "rpc": report,
                "supervisor_state": state.map(|s| s.state.name()),
            }))?;
            if pid.is_none() {
                Err(AceError::Node("the node is not running".to_owned()))
            } else if !report.healthy() {
                Err(AceError::Rpc(
                    report.problem.unwrap_or_else(|| "RPC unhealthy".to_owned()),
                ))
            } else if !serving {
                Err(AceError::Node(
                    "RPC answers but the supervisor does not report the node as serving".to_owned(),
                ))
            } else {
                Ok(())
            }
        }
        Cmd::Logs { lines } => {
            let text = supervisor::tail(
                &deployment.state_dir().join(supervisor::NODE_LOG),
                4 * 1024 * 1024,
            );
            let all: Vec<&str> = text.lines().collect();
            for line in all.iter().skip(all.len().saturating_sub(lines)) {
                println!("{}", oplog::redact(line));
            }
            Ok(())
        }
        Cmd::Stop { wait } => {
            let state = supervisor::stop(&deployment, Duration::from_secs(wait))?;
            print_json(
                &serde_json::json!({ "state": state.state.name(), "reason": state.reason, "last_exit": state.last_exit, "last_clean_stop": state.last_clean_stop }),
            )
        }
        Cmd::PublicCheck => {
            let url = config.tunnel.public_url.clone().ok_or_else(|| {
                AceError::Tunnel("no [tunnel] public_url is configured".to_owned())
            })?;
            let state = supervisor::read_state(&deployment.state_dir()).ok();
            let local_height = state.as_ref().and_then(|s| s.finalized_height);
            let status = ace::tunnel::verify_public(
                &url,
                config.node.expected_chain_id,
                &config.node.expected_network,
                local_height,
            )?;
            if let (Some(local_url), Some(h)) = (state.and_then(|s| s.rpc_url), local_height) {
                ace::tunnel::same_history(&local_url, &url, h)?;
            }
            oplog::info(
                Category::Public,
                &format!(
                    "{url} verified online at height {}",
                    status.finalized_height
                ),
            );
            print_json(&status)
        }
        Cmd::Diagnose { out } => diagnose(&deployment, &out),
    }
}

fn diagnose(deployment: &Deployment, out: &Path) -> Result<()> {
    std::fs::create_dir_all(out).map_err(|e| AceError::io("create", out, e))?;
    let write = |name: &str, value: serde_json::Value| -> Result<()> {
        let text = oplog::redact(&serde_json::to_string_pretty(&value).unwrap_or_default());
        std::fs::write(out.join(name), text).map_err(|e| AceError::io("write", out.join(name), e))
    };
    let to_value = |r: std::result::Result<serde_json::Value, String>| {
        r.unwrap_or_else(|e| serde_json::json!({ "error": e }))
    };
    write(
        "preflight-run.json",
        to_value(
            serde_json::to_value(preflight::run(deployment, Stage::Run, None))
                .map_err(|e| e.to_string()),
        ),
    )?;
    write(
        "source.json",
        to_value(
            source::inspect_workspace(deployment)
                .map_err(|e| e.to_string())
                .and_then(|w| serde_json::to_value(w).map_err(|e| e.to_string())),
        ),
    )?;
    write(
        "provenance.json",
        to_value(
            builder::load_provenance(&deployment.output_dir())
                .map_err(|e| e.to_string())
                .and_then(|p| serde_json::to_value(p).map_err(|e| e.to_string())),
        ),
    )?;
    write(
        "verify-build.json",
        to_value(
            builder::verify(deployment)
                .map_err(|e| e.to_string())
                .and_then(|p| serde_json::to_value(p).map_err(|e| e.to_string())),
        ),
    )?;
    let plan = node_plan(deployment);
    write(
        "node-config.json",
        to_value(
            plan.as_ref()
                .map_err(|e| e.to_string())
                .and_then(|p| serde_json::to_value(p).map_err(|e| e.to_string())),
        ),
    )?;
    write(
        "state.json",
        to_value(
            supervisor::read_state(&deployment.state_dir())
                .map_err(|e| e.to_string())
                .and_then(|s| serde_json::to_value(s).map_err(|e| e.to_string())),
        ),
    )?;
    if let Ok(plan) = &plan {
        let log = supervisor::tail(
            &deployment.state_dir().join(supervisor::NODE_LOG),
            256 * 1024,
        );
        let report = rpc::inspect(
            plan,
            running_pid(deployment),
            &log,
            &deployment.config.node.expected_network,
            deployment.config.node.expected_chain_id,
            Duration::from_secs(5),
        );
        write("rpc.json", serde_json::to_value(report).unwrap_or_default())?;
        write(
            "interrupted-restores.json",
            serde_json::json!(snapshot::interrupted_restores(&plan.data_dir)),
        )?;
    }
    for (name, max) in [
        ("node.log", 1024 * 1024),
        ("node.log.1", 256 * 1024),
        ("build.log", 512 * 1024),
        ("tunnel.log", 256 * 1024),
    ] {
        let text = supervisor::tail(&deployment.state_dir().join(name), max);
        if !text.is_empty() {
            std::fs::write(out.join(name), oplog::redact(&text))
                .map_err(|e| AceError::io("write", out.join(name), e))?;
        }
    }
    oplog::info(
        Category::Health,
        &format!("diagnostics written to {}", out.display()),
    );
    print_json(&serde_json::json!({ "diagnostics": out }))
}

fn main() -> ExitCode {
    let cli = match Cli::try_parse() {
        Ok(cli) => cli,
        Err(e) => {
            let _ = e.print();
            return ExitCode::from(if e.use_stderr() {
                exit::USAGE
            } else {
                exit::OK
            });
        }
    };
    match run(cli) {
        Ok(()) => ExitCode::from(exit::OK),
        Err(error) => {
            oplog::error(Category::Health, &error.to_string());
            ExitCode::from(error.exit_code())
        }
    }
}
