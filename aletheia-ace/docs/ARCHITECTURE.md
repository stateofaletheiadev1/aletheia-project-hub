# ACE architecture

ACE is one Rust crate (`aletheia-compute-engine`) with a library (`ace`) and one binary (`ace`).
It lives in `aletheia-ace/` of the monorepo, outside the StableChain Cargo workspace, and never
builds against StableChain crates: it drives the daemon as an external program and talks to it
over its documented interfaces (command line, configuration file, log lines, exit status, RPC,
data directory manifest). That keeps ACE independent of StableChain's internal APIs, and means a
StableChain change that breaks one of those interfaces shows up as a failing ACE test, not a
silent mismatch.

A single crate was chosen over the brief's twelve: the modules are small, share types, and have no
reason to be versioned separately. The boundaries are module boundaries.

## Modules

| Module | Responsibility |
| --- | --- |
| `settings` | `ace.toml`: strict parsing, range checks, path resolution (`@source/`) |
| `source` | GitLab fetch of one pinned commit; credentials via environment only; workspace manifest inspection |
| `preflight`, `host` | Memory (physical and cgroup), disk, CPU, platform, tools, libclang, network, job deadline; one verdict |
| `builder` | `cargo build --locked` under time and disk watchdogs; collection, SHA-256, provenance; `verify` |
| `nodecfg` | The daemon's TOML schema mirrored with its rules; redacted effective configuration |
| `supervisor` | Start, follow, probe, restart policy, graceful stop, `state.json` |
| `lifecycle` | The state machine and its transition table |
| `node_exit` | What each daemon exit means, and whether a restart can help |
| `rpc`, `sockets` | Listener discovery (configuration, daemon log, socket table) and protocol-level checks |
| `datadir` | `DATADIR.txt` identity; the node's `LOCK` |
| `snapshot` | Checkpoints: create under lock, validate, restore through staging, select latest valid |
| `persistence` | EPHEMERAL / declared-persistent / unavailable classification |
| `tunnel` | Optional cloudflared process and external verification |
| `oplog` | Categorized log lines with secret redaction |

## Runtime interfaces

The brief proposes `ComputeProvider`, `BuildExecutor`, `NodeRuntime`, `StorageProvider`,
`ArtifactProvider`, `TunnelProvider` and `HealthMonitor` traits. ACE does not define them as
traits, because there is exactly one implementation of each and the platform differences turned
out to sit outside the engine:

- Compute: the engine runs on any Linux host. What differs between a GitHub runner and a VPS is
  what persists and how long the host lives; `host::compute_kind` and `persistence` capture that,
  and `ACE_DEADLINE_EPOCH` carries a job's time limit.
- Artifacts: moving binaries and checkpoints between GitHub jobs is done by the workflow
  (`actions/upload-artifact`); ACE re-verifies whatever arrives (`verify-build`,
  `validate-snapshot`) and never trusts the transport.
- Supervision: on a VPS systemd supervises ACE, and ACE supervises the node
  (`deploy/persistent-host/ace.service`). On GitHub the job runs `ace start --run-for`.

A trait is worth adding when a second implementation appears (another tunnel provider, a remote
checkpoint store).

## Lifecycle

```text
UNINITIALIZED → PREFLIGHT → FETCHING_SOURCE → BUILDING → BUILD_VERIFICATION
PREFLIGHT → STARTING_NODE → WAITING_FOR_RPC → SYNCING → READY | EPHEMERAL_MODE
                                     ↘ DEGRADED ↔ READY | EPHEMERAL_MODE | SYNCING
any running state → STOPPING → STOPPED;  any running state → RECOVERING → STARTING_NODE
any state → FAILED → PREFLIGHT
```

The full table is `lifecycle::allowed`; its tests prove READY is unreachable from STARTING_NODE
(an application-level RPC check must come first) and that FAILED needs a new preflight.

`EPHEMERAL_MODE` is READY on storage that does not outlive the host; it is reported instead of
READY so nobody mistakes a GitHub run for a durable deployment.

Serving rules per role (`supervisor::serving_state`):

| Role | Serving when | Otherwise |
| --- | --- | --- |
| devnet-producer, validator | RPC valid for the expected chain and the finalized height was seen to advance within `stall_after_s` | DEGRADED (stalled) |
| observer with peers | never READY: the node reports `syncing=false` unconditionally, so catching up cannot be observed | SYNCING |
| observer without peers | never | DEGRADED |
| RPC disabled | never | WAITING_FOR_RPC, then DEGRADED |

## Restart policy

| Exit | Meaning | ACE |
| --- | --- | --- |
| 0 after ACE asked | clean stop | STOPPED |
| 0 nobody asked for | someone signalled the node | FAILED, operator |
| 70 fail-stop | recovery runs at start | restart with backoff |
| 70 naming a failed `listen on` | port taken (audit F25) | FAILED, operator |
| 70 naming a lock | second node (F26) | FAILED, operator |
| 70 `STO_DATA_DIR_WRONG_CHAIN` | other chain's directory | FAILED, operator; never reset |
| 75 | protocol upgrade required | FAILED, operator installs a release |
| 64, 78 | usage, configuration | FAILED, operator |
| killed by a signal ACE did not send | OOM killer, kill -9 | restart with backoff |

Restarts are bounded by `max_restarts` within `restart_window_s` (default 3 in 600 s, as the
node's own systemd unit), backoff doubles from `backoff_initial_ms` to `backoff_max_ms`, and a
Run-stage preflight must pass before each restart.
