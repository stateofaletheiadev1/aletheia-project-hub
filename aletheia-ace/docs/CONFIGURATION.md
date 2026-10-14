# Configuration

ACE reads two files: its own `ace.toml`, and the node's `aletheiad` TOML, which ACE inspects but
never writes. Both are parsed strictly: unknown keys are errors.

## ace.toml

Relative paths are relative to the directory holding `ace.toml`. A path starting with `@source/`
(or `@source` alone) is inside the StableChain workspace checkout
(`[source] checkout_dir` / `[source] workspace`).

### `config_version` (required)

Must be `1`.

### `[source]` (required)

| Key | Required | Meaning |
| --- | --- | --- |
| `repository` | yes | https URL of the authoritative StableChain repository, without credentials |
| `commit` | yes | full 40-hex commit; branch names and short hashes are refused |
| `reference` | no | label recorded in provenance (e.g. `main`); never used to fetch |
| `workspace` | yes | Cargo workspace inside the repository (`aletheia-node`) |
| `checkout_dir` | yes | where ACE keeps its checkout (it refuses directories it did not create) |

### `[build]` (required)

| Key | Default | Meaning |
| --- | --- | --- |
| `profile` | — | `release` or `hardened-release` |
| `packages` | — | Cargo packages, e.g. `["aletheiad", "aletheia-arno-exec", "aletheia-cli"]` |
| `features` | `[]` | e.g. `["aletheiad/devnet-producer"]` |
| `binaries` | — | executables to collect and hash; must include `aletheiad` |
| `target_dir`, `output_dir` | — | Cargo target directory; collected binaries and `provenance.json` |
| `max_duration_s` | 5400 | build wall-time limit (60-21600) |
| `min_free_disk_mb` | 2048 | build stops if free space falls below (256+) |

### `[node]` (required)

| Key | Meaning |
| --- | --- |
| `config` | the `aletheiad` TOML |
| `working_dir` | the daemon's working directory; relative paths in its TOML resolve here |
| `role` | `devnet-producer`, `observer` or `validator`; must match what the node TOML configures |
| `expected_network` | `mainnet`, `private-validation`, `devnet` or `regtest` |
| `expected_chain_id` | e.g. `7771` |
| `expected_genesis_id` | 64 hex; strongly recommended: chain id alone does not identify a devnet |

### `[runtime]` (optional)

| Key | Default | Range |
| --- | --- | --- |
| `state_dir` | `run` | — |
| `startup_timeout_s` | 120 | 5-3600 |
| `rpc_ready_timeout_s` | 60 | 1-3600 |
| `shutdown_deadline_s` | 120 | 5-3600 (the node's own unit uses 120) |
| `max_restarts` | 3 | 0-20 |
| `restart_window_s` | 600 | 10-86400 |
| `backoff_initial_ms` / `backoff_max_ms` | 2000 / 60000 | |
| `max_log_bytes` | 64 MiB | node.log + node.log.1 together |
| `health_interval_s` | 10 | |
| `stall_after_s` | 30 | producer/validator DEGRADED after this long without a new finalized block |

### `[limits]` (optional)

| Key | Default | Meaning |
| --- | --- | --- |
| `min_free_disk_mb` | 1024 | node not started below it; a running node is stopped cleanly |
| `min_memory_mb` | 1024 | usable memory (physical or cgroup) needed to start |
| `max_snapshot_mb` | 2048 | largest checkpoint ACE creates or restores |

These are operator budgets, not measured StableChain requirements. Measured values are in
`REPOSITORY_AUDIT.md` section 4.

### `[persistence]` (required)

| Key | Meaning |
| --- | --- |
| `mode` | `ephemeral` or `persistent-host` |
| `checkpoint_dir` | where checkpoints are written and looked up |

`persistent-host` on a GitHub-hosted runner or on tmpfs is refused (`PERSISTENCE_UNAVAILABLE`).

### `[tunnel]` (optional)

| Key | Meaning |
| --- | --- |
| `provider` | `none` (default) or `cloudflared` |
| `public_url` | https URL, e.g. `https://rpc.stateofaletheia.org` |

## Environment

| Variable | Used by | Meaning |
| --- | --- | --- |
| `ACE_GITLAB_TOKEN`, `ACE_GITLAB_USER` | source | read-only deploy token for a private repository; passed to git as an HTTP header via `GIT_CONFIG_*` |
| `ACE_DEADLINE_EPOCH` | preflight, supervisor | Unix time by which the job must be done; the supervisor stops the node `shutdown_deadline_s + 60` s before it |
| `TUNNEL_TOKEN` | tunnel | cloudflared tunnel token |
| `GITHUB_ACTIONS`, `RUNNER_ENVIRONMENT` | host | recognise GitHub-hosted runners |

Values of `ACE_GITLAB_TOKEN`, `TUNNEL_TOKEN` and `GITHUB_TOKEN` are replaced by `[redacted]` in
every log line and report ACE writes.

## The node's TOML

See `REPOSITORY_AUDIT.md` section 3 for the schema. ACE adds two refusals the daemon does not
make up front, because the daemon would fail later and less clearly: a one-component relative
`data_dir` (audit F28) and an RPC listener on the P2P port.

`ace inspect-config` prints the effective configuration: resolved paths, role, listeners,
peers (with whether keys are pinned), executor, storage overrides, warnings. Key files are
checked for shape and permissions; their contents are never read into a report.
