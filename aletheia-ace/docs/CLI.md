# `ace` command reference

```text
ace [--config ace.toml] <command>
```

Reports go to stdout (JSON, except `status` and `logs`); log lines go to stderr as
`ace <level> <category> <message>`.

## Exit statuses

| Status | Meaning |
| --- | --- |
| 0 | done |
| 1 | other failure (ACE's own files, internal) |
| 2 | usage |
| 3 | ACE or node configuration refused |
| 4 | preflight verdict does not permit the operation |
| 5 | source fetch or verification failed |
| 6 | build failed or exceeded its budget |
| 7 | a binary or artifact failed verification |
| 8 | the node failed to start, stopped unexpectedly, or needs an operator |
| 9 | RPC disabled, unreachable, or not the expected protocol or chain |
| 10 | checkpoint invalid, or a restore was refused |
| 11 | durable persistence required and unavailable |
| 12 | public tunnel failed or could not be verified |
| 13 | another supervisor or node holds the deployment |

## Commands

| Command | Side effects | Fails with |
| --- | --- | --- |
| `inspect-source [--resolve REF]` | none (`--resolve` contacts GitLab) | 5 |
| `fetch-source` | creates or updates ACE's checkout at the pinned commit | 5 |
| `preflight [--stage build\|run]` | none | 4 |
| `build` | preflight, fetch, compile into `target_dir`, write `output_dir` binaries, `provenance.json`, `SHA256SUMS`, `run/build.log` | 4, 5, 6, 7 |
| `verify-build` | runs `aletheiad` without arguments (expects exit 64) | 7 |
| `inspect-config` | none | 3 |
| `inspect-rpc` | one `getNetworkStatus` to the RPC and one to the P2P port | 9 |
| `start [--run-for S] [--no-restart]` | runs the node in the foreground, writes `run/state.json` and `run/node.log` | 3, 4, 7, 8, 11, 13 |
| `status [--json]` | none | 1 if no state yet |
| `health` | one RPC probe; 0 only if the process runs, RPC is valid and the supervisor reports it serving | 8, 9 |
| `logs [--lines N]` | none | — |
| `stop [--wait S]` | SIGTERM to the supervisor, which stops the node cleanly | 8 |
| `checkpoint` | takes the node's `LOCK`, writes an archive and manifest to `checkpoint_dir` | 10 |
| `validate-snapshot MANIFEST` | none | 10 |
| `restore-snapshot MANIFEST\|latest --yes` | **writes the data directory** (only if absent or empty) | 10 |
| `verify-restore MANIFEST` | two RPC calls | 9, 10 |
| `public-check` | requests through the public URL | 12 |
| `diagnose [--out DIR]` | writes a redacted bundle | — |

Commands that write the data directory require `--yes` and refuse while a node runs. No command
deletes or resets chain data.
