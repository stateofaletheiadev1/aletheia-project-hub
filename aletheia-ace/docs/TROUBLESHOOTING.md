# Troubleshooting

Start with `ace status`, `ace logs --lines 50` and, for a bundle to share, `ace diagnose`
(redacted). Log lines carry a category (`source`, `build`, `config`, `snapshot`, `startup`, `rpc`,
`public`, `persistence`, `recovery`, `health`, `shutdown`, `preflight`), so
`grep ' rpc '` shows one stage.

| Symptom | Cause | Action |
| --- | --- | --- |
| `preflight verdict MISSING_DEPENDENCY: libclang not found` | RocksDB bindings need libclang | `apt-get install clang libclang-dev`, or set `LIBCLANG_PATH` |
| `preflight … INSUFFICIENT_RESOURCES` (build-disk) | < 1.5 GiB + `min_free_disk_mb` free for the target directory | free space elsewhere, or point `target_dir` at a larger disk |
| `source: … is a git checkout ACE did not create` | `checkout_dir` points at an existing repository | choose an empty `checkout_dir` |
| `source: … has local modifications` | someone edited the checkout | discard the edits; ACE builds only unmodified source |
| `build: stopped after [build] max_duration_s` | slow host or cold cache | raise the limit or use a faster runner |
| `verification failed: … sha256 … the build recorded …` | binary changed after the build | rebuild, or restore the binaries from the verified artifact |
| `node configuration refused: [node] data_dir = "x": aletheiad cannot initialize a one-component relative data directory` | audit F28 | write `./x` or an absolute path |
| `node configuration refused: [devnet] needs a build with the aletheiad/devnet-producer feature` | binaries built without the producer | add the feature to `[build] features` and rebuild |
| `node: the RPC address … is already in use by another process` | another program holds the port | stop it or change `[rpc] listen` in the node TOML |
| `FAILED … a listener could not bind` | port taken between ACE's check and the node's bind | as above; ACE does not restart this |
| `FAILED … data directory belongs to another chain` | genesis changed, or wrong `data_dir` | point at the right directory; ACE never re-initializes |
| `FAILED … protocol upgrade required (exit 75)` | the chain moved to a protocol version this binary lacks | pin a StableChain commit that supports it, `ace build`, start again |
| `FAILED … 3 restarts within 600 s` | repeated fail-stops | read the three `fail-stop:` lines in `ace logs`; the data directory is untouched |
| state `DEGRADED`, reason `finalized height has not advanced` | producer stalled | `ace logs`; check CPU and disk; the node keeps running |
| state `DEGRADED`, reason `RPC disabled` | node TOML has no `[rpc]` | add `[rpc] listen = "127.0.0.1:<port>"` if RPC is wanted |
| state `SYNCING` forever on an observer | the node cannot report sync completion (audit F12) | compare `finalized_height` with a peer's; this is a StableChain limitation |
| status says `(stale: the supervisor is gone…)` | ACE was killed; the node may still be running unsupervised | `pgrep aletheiad`; stop it with SIGTERM, then `ace start` |
| `checkpoint: … is held: a node is running` | node still running | `ace stop` first |
| `checkpoint: an earlier restore was interrupted and left …` | crash during a restore | inspect the staging directory, remove it by hand, restore again |
| `public: cloudflared …` / public `OFFLINE` | no `TUNNEL_TOKEN`, cloudflared missing, dashboard origin wrong, or node unhealthy | `cat run/tunnel.log`; `ace public-check` |
| `ace stop`: `the supervisor did not finish within …` | the node is still draining | wait; systemd's `TimeoutStopSec` is 180 s |
