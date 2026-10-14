# StableChain repository audit for ACE (Phase 0)

Audited: `https://gitlab.com/emeka.iwuagwu/aletheia-project-hub.git`, workspace `aletheia-node/`,
commit `1b4f4dc409255e730b566b434c7fd955742cbc7c` (GitLab `HEAD` on 2026-10-13; identical to the
GitHub mirror at that time). Paths below are relative to `aletheia-node/` unless they start with
`aletheia-ace/`. Line numbers are at that commit.

Method: read the manifests, the daemon, its configuration loader, the RPC server, the node
runtime, storage and recovery code and the operations documents; then built the release binaries
and ran the daemon to observe start-up, RPC, shutdown, crash recovery and every failure mode
listed in section 11. Observations are marked **observed**; they were made on Ubuntu 24.04,
x86_64, 4 CPUs, 16 GB RAM (13.3 GiB cgroup limit), ext4.

## 1. Classification of findings

| # | Finding | Class | Evidence |
| --- | --- | --- | --- |
| F1 | The node daemon is the `aletheiad` package, binary `aletheiad`, started as `aletheiad --config <path>` and nothing else | VERIFIED | `apps/aletheiad/src/main.rs:30-37`; observed exit 64 with `usage: aletheiad --config <path/to/node.toml>` |
| F2 | The contract executor `aletheia-arno-exec` is mandatory by default and must sit beside `aletheiad` | VERIFIED | `apps/aletheiad/src/config.rs:242-268` (`current_exe().with_file_name`), `docs/operations/vps.md` §1 |
| F3 | RocksDB is the production store and is in `aletheiad`'s default features | VERIFIED | `apps/aletheiad/Cargo.toml:24-27`; without it the daemon keeps state in RAM and says so (`main.rs:58-65`) |
| F4 | Release build command: `cargo build --release --locked -p aletheiad -p aletheia-arno-exec -p aletheia-cli` (+ `--features aletheiad/devnet-producer` for a devnet producer) | VERIFIED | `docs/operations/vps.md` §1; built by ACE in 432 s (section 4) |
| F5 | Toolchain is pinned to Rust 1.91.1 (`rust-toolchain.toml`), edition 2024, `rust-version = "1.91.1"` | VERIFIED | `rust-toolchain.toml`, `Cargo.toml` `[workspace.package]`; `rustc 1.91.1 (ed61e7d7e 2025-11-07)` used |
| F6 | Native requirements: a C++ compiler and libclang (librocksdb-sys 0.17.3+10.4.2 is C++ with bindgen) | VERIFIED | `docs/operations/building.md`, `.gitlab-ci.yml` installs `clang libclang-dev`, `Cargo.lock` |
| F7 | RPC is optional: present only when the configuration has `[rpc]`; no default listener exists | VERIFIED | `config.rs:56,314-319`, `main.rs:159-180` |
| F8 | RPC routes are `POST /rpc/v1` (JSON-RPC 2.0) and `/api/v1/{*path}` (REST). There is no `/` route and no WebSocket route | VERIFIED | `crates/rpc/src/server.rs:152-156`; observed `/` → 404 |
| F9 | Port 8545 appears nowhere; `127.0.0.1:7781` is the documented RPC example and `7771` the P2P example | VERIFIED | `config.rs:33`, `configs/devnet-explorer.toml`, `vps.md` §2 |
| F10 | RPC method names are StableChain's own (16 methods, `getNetworkStatus` …); Ethereum names return `-32601` | VERIFIED | `crates/rpc/src/service.rs:18-35`; observed `eth_blockNumber` → `-32601 Method not found` |
| F11 | RPC protections: 1 MiB body cap, per-client-IP request budget (50/s default), batches ≤ 50, no CORS headers | VERIFIED | `server.rs:1-3,24-55,155`, `jsonrpc.rs:1-14` |
| F12 | `getNetworkStatus` always reports `syncing: false` and `peers: null`: sync progress cannot be read over RPC | VERIFIED | `crates/node/src/rpc.rs:83-91`; `docs/STATUS.md` ("peer counts in status": not yet) |
| F13 | Plaintext node and consensus keys are refused on every network except devnet and regtest; the signer daemon that would replace them does not exist | VERIFIED | `config.rs:207-213`, `crates/core/src/network.rs:107-109`, `docs/STATUS.md` line 115 |
| F14 | The only genesis files in the repository are devnet genesis files (`genesis/devnet.toml`, `genesis/devnet-explorer.toml`); no mainnet, private-validation or public devnet genesis or peer list exists | VERIFIED | `genesis/`, `configs/` |
| F15 | `devnet.toml` and `devnet-explorer.toml` share `chain_id = 7771` but have different genesis ids (`ee6e8c5e…` and `9164487f…`): chain id alone does not identify the chain | VERIFIED (observed) | `aletheiad` log `configuration loaded … genesis_id=` for each |
| F16 | Without `[devnet]` and without validators, a node is an observer; with `[devnet] produce_every_ms` it produces blocks (needs the `devnet-producer` feature, devnet/regtest only) | VERIFIED | `crates/node/src/runtime.rs:85-103,105-152` |
| F17 | An observer with no peers serves genesis forever; state sync over the network is not implemented | VERIFIED | `runtime.rs`, `docs/STATUS.md` lines 45, 270 |
| F18 | Data directory layout: `DATADIR` (binary, crc32c, authoritative), `DATADIR.txt` (text copy), `LOCK`, `wal/ state/ chain/ blocks/ snapshots/ migrations/`; RocksDB lives in `state/` | VERIFIED (observed) | `crates/storage/src/datadir.rs:1-36`, `main.rs:39-56` |
| F19 | A data directory created for another chain is refused (`STO_DATA_DIR_WRONG_CHAIN`, exit 70); a newer schema is refused unless it declared this binary a reader | VERIFIED (observed) | `datadir.rs:194-240` |
| F20 | `DATADIR.txt` `last_finalized` is refreshed at a clean stop, not on every block; after SIGKILL it lags the real tip | VERIFIED (observed) | stayed at height 30 after a SIGKILL at ~36 |
| F21 | Crash recovery runs at start-up and never resumes below the last reported finalized height | VERIFIED (observed) | `docs/operations/recovery.md`; SIGKILL at ≥30, resumed at 36; ACE e2e test `a_node_killed_from_outside…` |
| F22 | No operator-usable snapshot export or import exists. `crates/state/src/snapshot.rs` is a library for state chunks; neither `aletheiad` nor `aletheia-cli` exposes it, and it omits blocks, WAL and consensus safety data | VERIFIED | `grep` for callers; `docs/STATUS.md` lines 269-270 |
| F23 | The supported backup and move procedure is a cold copy of the whole data directory while the node is stopped | VERIFIED | `vps.md` §5 ("stop it, copy `/var/lib/aletheia` whole") |
| F24 | Exit statuses 0, 64, 70, 75, 78 as documented | VERIFIED (observed 0, 64, 70, 78) | `main.rs:25-28`, `docs/operations/exit-codes.md`; 75 not provoked (needs a protocol upgrade schedule) |
| F25 | A P2P listener that cannot bind exits **70 (fail-stop)**, not 78, after the data directory was created; a supervisor following the exit-code table would restart it in a loop | VERIFIED (observed) | `crates/p2p/src/network.rs:256-261` (`P2pConnectionLimit`); log `fail-stop: P2P_CONNECTION_LIMIT (8009): listen on 127.0.0.1:27771: Address already in use` |
| F26 | A second daemon on the same data directory fails on RocksDB's own lock as `STO_IO` (exit 70), before the data-directory lock that would report `STO_DATA_DIR_LOCKED` | VERIFIED (observed) | `main.rs:136-139` opens the store before `Node::start` takes `LOCK` |
| F27 | An RPC listener that cannot bind exits 78, after the node has opened its data directory | VERIFIED (observed) | `main.rs:159-177` |
| F28 | A one-component relative `data_dir` (e.g. `"devnet-data"`) cannot be initialized: the node fsyncs the empty parent path and fail-stops with `STO_IO … sync directory : No such file or directory`. The repository's own `configs/devnet-node.toml` and `configs/devnet-explorer.toml` use such paths | VERIFIED (observed) | `crates/storage/src/fsutil.rs:35-40`; `"./devnet-data"` works |
| F29 | If the RPC server task fails after start, the daemon keeps running without RPC; the task is only aborted at shutdown | VERIFIED (code) | `main.rs:159-178,194-196` |
| F30 | Release binaries are not reproducible across checkout paths: the same commit built in two directories gave different hashes | VERIFIED (observed) | `aletheiad` `213cf8a5…` vs `050657fe…` |
| F31 | Behind a tunnel or reverse proxy every client arrives from one address, so the node's per-IP limiter becomes one budget shared by all public clients | INFERRED | `server.rs:71-79` keys the limiter on the TCP peer address; no forwarded-header support (by design) |
| F32 | RAM in use by a devnet producer is small (~17-18 MB RSS at heights 5-40); the RocksDB cache defaults scale with memory (1/8 of RAM, 64-512 MiB) | VERIFIED (observed) + VERIFIED (code) | `/proc/<pid>/status`; `config.rs:80-126`. Use under real load is UNKNOWN |
| F33 | Storage growth per block on an empty devnet chain: see section 4; growth under transaction load | UNKNOWN | not measured |
| F34 | Graceful SIGTERM shutdown drains and checkpoints in well under a second on a devnet | VERIFIED (observed) | `stopped cleanly finalized_height=…` |
| F35 | "ACE" already names the Aletheia Canonical Encoding in StableChain (APS-0041; `DATADIR` is an "ACE manifest") | VERIFIED | `crates/core/src/lib.rs:2`, `crates/storage/src/datadir.rs:4` |
| F36 | Exit 75 (protocol upgrade required) behaviour end to end | UNKNOWN | needs a genesis with a protocol schedule and a binary lacking the next version |
| F37 | Production deployment of any network other than devnet/regtest | BLOCKED | F13, F14, F17 |

## 2. Repository structure relevant to ACE

| Path | Role |
| --- | --- |
| `apps/aletheiad` | Daemon: argument parsing, `config.rs` (strict TOML), store opening, RPC listener, signals, exit codes |
| `apps/arno-exec` | `aletheia-arno-exec`, the sandboxed contract worker the daemon spawns |
| `apps/aletheia-cli` | Operator client over RPC (`status`, `balance`, `transfer` …); default `--rpc 127.0.0.1:7781` |
| `crates/node` | Node runtime (`runtime.rs`), ledger and crash recovery, mempool, sync, RPC backend (`rpc.rs`), memory sizing (`host.rs`) |
| `crates/rpc` | Service layer, JSON-RPC and REST adapters, Axum server |
| `crates/storage` | Data directory manifest and lock (`datadir.rs`), WAL, archive, RocksDB adapter (`rocks.rs`, feature `rocksdb`) |
| `crates/p2p` | TLS 1.3 + signed handshake transport, peer management |
| `crates/consensus`, `crates/signer` | DSP consensus; local signer with persistent high-water marks (no remote signer daemon) |
| `crates/state/src/snapshot.rs` | State-chunk snapshot library (not wired into any binary) |
| `genesis/` | `devnet.toml`, `devnet-explorer.toml` only |
| `configs/` | Devnet node configurations and the published devnet node key |
| `deploy/systemd/aletheiad.service`, `deploy/sysctl/` | Hardened unit: `Restart=on-failure`, `RestartPreventExitStatus=64 75 78`, `StartLimitBurst=3` per 600 s |
| `scripts/e2e_crash_recovery.sh` | SIGKILL-under-load recovery test |
| `docs/operations/` | `building.md`, `exit-codes.md`, `recovery.md`, `vps.md` |

## 3. Start-up, configuration schema and listeners

Start-up order (`main.rs`, `runtime.rs`): parse arguments → load configuration and genesis
(exit 78 on refusal) → log `configuration loaded … network= chain_id= genesis_id=` → install the
contract runner → open RocksDB at `<data_dir>/state` → `Node::start`: lock and open or initialize
the data directory, recover, choose DSP or the devnet producer, start the chain thread, bind P2P →
bind RPC if configured and log `rpc listening on <addr> (REST /api/v1, JSON-RPC /rpc/v1)` → log
`following data_dir=… listen=<p2p> finalized_height=…`. These three lines are what ACE reads to
learn the genesis id and the effective listeners (`aletheia-ace/src/rpc.rs` `log_facts`).

Configuration (`config.rs`, every table `deny_unknown_fields`):

| Key | Required | Notes |
| --- | --- | --- |
| `[node] data_dir, genesis, listen, node_key_file` | yes | paths opened as given, i.e. relative to the working directory |
| `[node] consensus_key_file` | no | validators; devnet/regtest only |
| `[[peers]] address, node_key?, transport_cert_sha256?` | no | dial targets with optional pins |
| `[devnet] produce_every_ms` | no | needs `devnet-producer` feature and a devnet/regtest genesis without validators |
| `[execution] executor, executor_path, call_timeout_ms` | no | `sandboxed` (default) or `in-process` (devnet/regtest) |
| `[storage] block_cache_mb, write_buffer_mb, max_open_files, background_jobs` | no | range-checked |
| `[rpc] listen, requests_per_second` | no | absent: no RPC |

ACE mirrors this schema in `aletheia-ace/src/nodecfg.rs` and its integration tests check that it
agrees with the real daemon.

## 4. Build and resource measurements

| Measurement | Value | How |
| --- | --- | --- |
| Release build, 3 packages, `devnet-producer`, cold target directory, RocksDB from source | 419 s and 432 s | two runs, 4 CPUs (ACE provenance `seconds`) |
| Peak target directory | 555-597 MB | sampled every 15-30 s |
| Cargo registry (sources + index) | 160 MB | `du` |
| Binaries | `aletheiad` 14.1 MB, `aletheia-arno-exec` 0.67 MB, `aletheia-cli` 1.3 MB | stripped, fat LTO |
| Node RSS, devnet producer, heights 5-40 | 17-18 MB | `VmRSS` |
| Fresh data directory | 208-268 KB | `du` |
| Data directory at height 42 (empty blocks) | 864 KB | `du` |
| Growth over a two-minute session | see `docs/STORAGE_AND_RECOVERY.md` | ACE `data_dir_bytes` |

The ">4 GB RAM" figure in the brief is not supported by these measurements for compilation of
this commit on 4 CPUs, nor for a devnet node; `vps.md` asks for 2 GB to build. ACE's build
preflight requires 2048 MiB (citing `vps.md`) and 1.5 GiB of disk plus a configurable floor.

## 5. Supported network modes at this commit

| Mode | Possible? | Why |
| --- | --- | --- |
| Single-node devnet with the devnet producer | **yes** | the only mode that runs without peers or a signer daemon |
| Devnet observer of someone else's devnet | only with peers configured | none are published |
| Regtest | yes, with a regtest genesis the operator writes | none in the repository |
| Private validation / mainnet observer | **BLOCKED** | plaintext node keys refused (F13), no genesis (F14), no peers, no state sync (F17) |
| Validator outside devnet/regtest | **BLOCKED** | signer daemon and HSM path do not exist (F13) |

## 6. Storage and recovery

See F18-F23. Consequences for ACE: checkpoints are cold copies taken while ACE holds the node's
own `LOCK` (no node can run on or start on the directory during the copy); identity comes from
`DATADIR.txt`; the node's start-up recovery is the integrity check of the database itself; and ACE
compares the restored node's state root at the checkpoint height through RPC. Files that must
never be copied while the node runs: all of them, the RocksDB `state/` directory and `wal/` in
particular. Details: `docs/STORAGE_AND_RECOVERY.md`.

## 7. Security concerns

- Only devnet/regtest can run, with a published development key (`configs/devnet-node.key`); any
  public RPC therefore exposes a development chain, not a sovereign network.
- `submitTransaction` is the one state-changing RPC method; there are no administrative methods.
- F31: a tunnel collapses the per-IP limiter into one shared budget. A per-client limiter in
  front of the node (keyed on the tunnel's client address header) is needed before a public
  endpoint carries real traffic.
- F30: without path-independent builds, a binary hash cannot be compared across build hosts;
  ACE compares only against the provenance it recorded itself.

## 8. Tests required before deployment, and their state

| Test | State |
| --- | --- |
| Build of the pinned commit from GitLab with the pinned toolchain | passed (ACE, 2026-10-13) |
| Binary hashes and daemon identity (exit 64 + usage) | passed |
| Start, RPC discovery, protocol check, P2P not answering as RPC | passed (e2e) |
| RPC disabled → never READY | passed (e2e) |
| Occupied RPC and P2P ports, missing executor, tampered binary, wrong genesis pin, insufficient disk | passed (e2e) |
| SIGKILL recovery, restart budget, restart disabled | passed (e2e) |
| Graceful stop, checkpoint, validation, restore, post-restore state-root check | passed (e2e) |
| Exit 75 handling against a real upgrade | not run (F36) |
| Public tunnel end to end | not run: no tunnel credentials in this environment |
| GitHub Actions workflows | written; see `docs/DEPLOYMENT.md` for their run state |

## 9. Missing or incomplete StableChain capabilities that limit ACE

1. Signer daemon / HSM (blocks every non-development network).
2. A published network: genesis, peers, bootstrap.
3. State sync over the network.
4. A supported snapshot export/import with finality proof.
5. Sync and peer reporting in `getNetworkStatus`.
6. Correct exit class for listener bind failures (F25) and an early data-directory lock (F26).
7. One-component relative `data_dir` (F28).
8. Path-independent reproducible builds (F30).

## 10. Implementation plan

Phases as in the engineering brief; status is kept in `README.md`.

1. Foundation: `ace.toml`, CLI, source pinning, preflight, diagnostics.
2. Build and artifact verification with provenance.
3. Configuration inspection with the daemon's rules; supervised runtime and lifecycle.
4. RPC discovery from configuration, daemon log and socket table; protocol-level check.
5. Checkpoints (cold copy under the node's lock) and verified restore.
6. GitHub Actions: bounded build, e2e tests, supervised run, checkpoint artifact.
7. Optional Cloudflare tunnel with external verification (needs credentials to validate).
8. Fault injection and security review.
9. Persistent Linux host: systemd unit running `ace start` (`deploy/systemd/`).

## 11. Failure modes observed directly

| Provoked | Exit | Log line |
| --- | --- | --- |
| no arguments | 64 | `usage: aletheiad --config <path/to/node.toml>` |
| `data_dir = "data"` (fresh) | 70 | `fail-stop: STO_IO (7001): sync directory : No such file or directory` |
| second daemon on the same data directory | 70 | `fail-stop: STO_IO (7001): RocksDB open ./fresh/state: IO error: While lock file: …: Resource temporarily unavailable` |
| P2P port taken | 70 | `fail-stop: P2P_CONNECTION_LIMIT (8009): listen on 127.0.0.1:27771: Address already in use (os error 98)` |
| RPC port taken | 78 | `cannot listen for rpc on 127.0.0.1:27781: Address already in use (os error 98)` |
| other genesis on an existing directory | 70 | `fail-stop: STO_DATA_DIR_WRONG_CHAIN (7010): data directory is for chain 7771 (devnet, genesis 9164…); this node is configured for chain 7771 (devnet, genesis ee6e…)` |
| SIGTERM | 0 | `stopped cleanly finalized_height=30 state_root=…` |
| SIGKILL, restart | 137, then running | `following … finalized_height=36` (was ≥ 30) |
| corrupted `DATADIR` | 70 | fail-stop on every start (ACE e2e `repeated_fail_stops_do_not_loop`) |
