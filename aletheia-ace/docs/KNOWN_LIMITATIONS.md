# Known limitations

## From StableChain at the pinned commit

1. **Only devnet and regtest can run.** `aletheiad` refuses plaintext node keys on every other
   network and the signer daemon that would hold them does not exist. ACE does not and will not
   work around this.
2. **No network to join.** The repository holds devnet genesis files only, and no peers are
   published. The practical deployment is a single-node devnet producer, a chain of its own.
3. **No state sync over the network**, so an observer can only follow peers block by block.
4. **No operator snapshot export/import.** ACE checkpoints are cold copies of a stopped data
   directory, the procedure the node's documentation gives for moving a node.
5. **Sync status is not observable**: `getNetworkStatus` reports `syncing: false` and
   `peers: null` unconditionally. ACE never reports an observer READY.
6. **Exit classes**: a listener that cannot bind and a second daemon on the same directory both
   exit 70 (documented as restartable); ACE reads the log line to tell them apart. If StableChain
   changes those lines, the e2e tests `occupied_ports…` and the unit tests in `node_exit.rs` fail.
7. **One-component relative `data_dir`** (the repository's own devnet configs) fail-stops a new
   node; ACE refuses such configurations and ships `./devnet-explorer-data`.
8. **Builds are path-dependent**: the same commit built in two directories produced different
   hashes. ACE verifies against its own provenance only.
9. **Exit 75** has not been exercised against a real protocol upgrade.

## Of ACE

1. **The public tunnel has not carried traffic**: no Cloudflare credentials were available. It is
   implemented and unit-tested for refusal and offline detection only.
2. **Shared rate-limit budget behind a tunnel** (`SECURITY.md`): no per-client limiter in front of
   the node yet.
3. **Checkpoints are not signed**; origin is recorded, not proven.
4. **Persistence is declared, not measured**, on hosts other than CI runners and tmpfs.
5. **Linux only** (x86_64, aarch64): socket inspection and memory measurement read `/proc`.
6. **GitHub Actions runs are bounded test sessions**, at most `run_minutes` (≤ 45) per run, with
   checkpoints kept as 7-day artifacts. There is no always-on deployment on GitHub, by design.
7. **The supervisor is not a daemon itself**: on a VPS it relies on systemd (unit provided); if
   ACE is killed, the node keeps running unsupervised and `ace status` says so.
8. **Workflow actions are pinned by tag**, not commit SHA.
9. **Validator role** is accepted by the configuration checks, but no validator deployment was
   tested (it needs a genesis with a validator set and is devnet/regtest only).
