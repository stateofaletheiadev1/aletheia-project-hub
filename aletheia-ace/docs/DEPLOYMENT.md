# Deployment

Two targets share one engine: bounded runs on GitHub Actions, and a long-lived Linux host. Both
run a **devnet** at the pinned commit; nothing else can run yet (`KNOWN_LIMITATIONS.md`).

## Local (any Linux machine)

Needs git, rustup (the 1.91.1 toolchain installs from `rust-toolchain.toml`), a C++ compiler and
libclang (`apt-get install clang libclang-dev`).

```sh
cd aletheia-ace
cargo build --release --locked
cd deploy/devnet
../../target/release/ace preflight --stage build
../../target/release/ace build              # ~7 min on 4 CPUs, ~0.6 GB target directory
../../target/release/ace inspect-config
../../target/release/ace start --run-for 300 &
../../target/release/ace status
../../target/release/ace health && ../../target/release/ace inspect-rpc
../../target/release/ace stop
../../target/release/ace checkpoint
```

Everything ACE writes for this profile is under `deploy/devnet/work/` (git-ignored), except the
data directory, which the node TOML places in the checkout (`work/src/aletheia-node/devnet-explorer-data`,
ignored by the StableChain repository's own `.gitignore`).

## GitHub Actions (temporary compute)

`.github/workflows/ace-ci.yml`: format, clippy, unit tests on every change to `aletheia-ace/`.
No secrets.

`.github/workflows/ace-stablechain.yml`, on a change to `aletheia-ace/` or by hand
(`workflow_dispatch` with `run_minutes` 1-45 and an optional `restore_run_id`):

| Job | What it does |
| --- | --- |
| build (≤ 90 min) | sets `ACE_DEADLINE_EPOCH`; installs clang/libclang and Rust 1.91.1; builds ACE; `ace preflight`; `ace build` (fetch from GitLab, compile, hash, verify); runs the end-to-end tests against the fresh binaries with `ACE_REQUIRE_E2E=1`; uploads binaries + provenance (7 days) |
| run (≤ 60 min) | downloads ACE and the binaries; `ace verify-build` re-hashes them (an artifact is never trusted for existing); fetches the source for genesis and key; optionally restores the `checkpoint` artifact of an earlier run and later `verify-restore`s; `ace start --run-for` with a health wait; `ace inspect-rpc`; checkpoint after the clean stop; uploads the checkpoint and diagnostics |

Properties:

- **Bounded.** The node runs at most `run_minutes`, and ACE stops it before the job deadline
  regardless. There is no self-dispatching, job chaining or other device to keep a node up past
  GitHub's limits; a run is a test session, not a service.
- **Ephemeral.** Every run reports `EPHEMERAL_MODE`. The RPC listener is on the runner's loopback
  and nobody outside the runner can reach it.
- **Recoverable across runs.** The `checkpoint` artifact of one run can seed the next
  (`restore_run_id`), subject to artifact retention (7 days here, at most what the repository
  allows) and size limits. It is a recovery point, not the database.
- **Least privilege.** `contents: read` and `actions: read` (to fetch an earlier run's
  artifact). `ACE_GITLAB_TOKEN`/`ACE_GITLAB_USER` secrets are only needed if the GitLab repository
  becomes private, and are passed only to the build step. Pull-request events are not a trigger
  of this workflow, so code from a fork never runs with them. Workflow inputs are validated as
  numbers in the shell, never interpolated into scripts.
- **No compiled cache.** Only Cargo's download cache is cached (crate sources are checked against
  `Cargo.lock`); the target directory is rebuilt every run, so a poisoned cache cannot supply a
  binary.
- **Concurrency.** One run per ref at a time (`concurrency: ace-stablechain-<ref>`).

Measured on a 4-CPU host: the StableChain build takes about 7 minutes from cold; a GitHub-hosted
`ubuntu-24.04` runner (4 vCPU, 16 GB) is expected to be in the same range, with the e2e tests
adding about a minute. Runner disk is ample for the 0.6 GB target directory.

## Long-lived Linux host (persistent)

`deploy/persistent-host/`:

```sh
# as root, once
useradd --system --home /var/lib/aletheia --shell /usr/sbin/nologin aletheia
install -d -o aletheia -g aletheia -m 0700 /var/lib/aletheia /var/lib/ace
install -d -m 0755 /etc/ace /etc/aletheia
install -m 0644 deploy/persistent-host/ace.toml deploy/persistent-host/node.toml /etc/ace/
# from the checkout of the pinned commit:
install -m 0644 genesis/devnet-explorer.toml /etc/aletheia/genesis.toml
install -m 0640 -g aletheia configs/devnet-node.key /etc/aletheia/node.key
install -m 0755 aletheia-ace/target/release/ace /usr/local/bin/ace

# as aletheia: build (or copy work/bin from a verified build and run ace verify-build)
sudo -u aletheia ace --config /etc/ace/ace.toml build
sudo -u aletheia ace --config /etc/ace/ace.toml inspect-config

install -m 0644 deploy/persistent-host/ace.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now ace
ace --config /etc/ace/ace.toml status
```

systemd supervises ACE and ACE supervises the node. ACE exits non-zero only when an operator must
act, so the unit restarts ACE only on abnormal termination (`Restart=on-abnormal`). `KillMode=mixed`
sends SIGTERM to ACE alone; ACE gives the node up to 120 s to drain. Back up with
`systemctl stop ace && ace … checkpoint && systemctl start ace`, and copy checkpoints off the host.

The engine, configuration format and lifecycle are the same as on GitHub; only the profile
differs (`mode = "persistent-host"`, absolute paths).

## Public endpoint (optional)

Target: `https://rpc.stateofaletheia.org` → Cloudflare → `cloudflared` on the node's host →
the RPC listener ACE verified → `aletheiad`.

1. Create a Cloudflare Tunnel for the hostname; set its origin service to the address
   `ace inspect-rpc` reports (`http://127.0.0.1:7781` for the shipped profiles).
2. Install `cloudflared` on the host; give ACE the token as `TUNNEL_TOKEN` (systemd
   `EnvironmentFile=` with mode 0600, or a GitHub secret).
3. Add to `ace.toml`:
   ```toml
   [tunnel]
   provider = "cloudflared"
   public_url = "https://rpc.stateofaletheia.org"
   ```
4. ACE starts cloudflared only while the node is serving, stops it as soon as an RPC check fails,
   and reports the endpoint online only after a request through the public URL answers for the
   same chain at a height not behind the local node. `ace public-check` adds a block-id comparison.

**Not validated here:** no Cloudflare account or token was available, so the tunnel path has
unit tests (refusals, offline detection) but has not carried traffic. Before relying on it, read
the per-IP rate-limit caveat in `SECURITY.md`: behind a tunnel all clients share one budget.

On GitHub Actions a tunnel would make a public endpoint that exists only for the length of one
job; ACE supports it for bounded external tests, and reports it offline when the job ends,
because it is.
