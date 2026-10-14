# ACE: Aletheia Compute Engine

ACE builds the Aletheia StableChain node from a pinned GitLab commit, checks the environment,
launches and supervises `aletheiad`, discovers and verifies its RPC, takes and restores
verifiable checkpoints, and says plainly whether a deployment is ephemeral or persistent.

It lives beside the StableChain workspace (`../aletheia-node/`), not inside it, and drives the
daemon only through its public interfaces. GitLab
(`https://gitlab.com/emeka.iwuagwu/aletheia-project-hub.git`) stays the authority for StableChain
source; GitHub hosts ACE and runs bounded build and test sessions.

(StableChain also uses "ACE" for its Aletheia Canonical Encoding. The two are unrelated.)

## What it can run today

A single-node **devnet** producer: at the pinned commit `aletheiad` refuses plaintext keys on
every other network and no other network is published. See `docs/KNOWN_LIMITATIONS.md`.

## Quick start

```sh
cargo build --release --locked
cd deploy/devnet
../../target/release/ace build            # fetch 1b4f4dc… from GitLab, compile, hash, verify
../../target/release/ace start --run-for 300 &
../../target/release/ace status
../../target/release/ace health
../../target/release/ace stop
../../target/release/ace checkpoint
```

## Documents

| Document | Contents |
| --- | --- |
| `docs/REPOSITORY_AUDIT.md` | Phase 0: what StableChain actually requires, with evidence and VERIFIED/INFERRED/UNKNOWN/BLOCKED findings |
| `docs/ARCHITECTURE.md` | Modules, lifecycle, restart policy |
| `docs/CONFIGURATION.md` | `ace.toml`, environment, node TOML checks |
| `docs/CLI.md` | Commands, side effects, exit statuses |
| `docs/RPC_DISCOVERY.md` | How the RPC listener is found and proven |
| `docs/STORAGE_AND_RECOVERY.md` | Persistence classes, checkpoints, restore, disk safety, growth |
| `docs/DEPLOYMENT.md` | Local, GitHub Actions, persistent host, public tunnel |
| `docs/SECURITY.md` | Threat model, controls, residual risks |
| `docs/TROUBLESHOOTING.md` | Symptom → cause → action |
| `docs/KNOWN_LIMITATIONS.md` | What does not work, and why |

## Tests

```sh
cargo fmt --check && cargo clippy --all-targets -- -D warnings
cargo test                                   # unit tests; e2e tests print SKIPPED
# against real node binaries:
ACE_TEST_BIN_DIR=deploy/devnet/work/bin \
ACE_TEST_WORKSPACE=deploy/devnet/work/src/aletheia-node \
ACE_TEST_COMMIT=1b4f4dc409255e730b566b434c7fd955742cbc7c \
ACE_REQUIRE_E2E=1 cargo test --release --test node_e2e
```

## Phase status

| Phase | State | Evidence |
| --- | --- | --- |
| 0 Repository audit | done | `docs/REPOSITORY_AUDIT.md` |
| 1 Foundation (config, CLI, source pinning, preflight, diagnostics) | done | unit tests; `ace preflight`, `ace inspect-source` run |
| 2 Build and artifact verification | done | `ace build` fetched and built `1b4f4dc` in 432 s; hashes and daemon check verified |
| 3 Configuration and runtime | done | e2e: lifecycle, missing executor, tampered binary, wrong genesis, restart policy |
| 4 RPC discovery | done | e2e: discovery, protocol check, P2P≠RPC, RPC disabled, occupied ports |
| 5 Storage and recovery | done | e2e: checkpoint, restore, state-root verification after restore |
| 6 GitHub Actions adapter | written | `.github/workflows/ace-ci.yml`, `ace-stablechain.yml`; run state is on the repository's Actions tab |
| 7 Public endpoint | implemented, not validated | no tunnel credentials; rate-limit gap in `docs/SECURITY.md` |
| 8 Reliability and security validation | partly | fault injection in e2e; exit 75 and tunnel not exercised |
| 9 Persistent-host compatibility | written | `deploy/persistent-host/` (systemd unit, profile); not run on a VPS |
