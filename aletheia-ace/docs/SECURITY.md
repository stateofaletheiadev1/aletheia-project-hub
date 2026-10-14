# Security

## Assets

- The integrity of the binaries that run (built from a pinned commit, hashed, re-verified).
- The chain data and its identity (network, chain id, genesis id): never silently changed.
- Credentials: a GitLab deploy token (only if the repository is private), a Cloudflare tunnel
  token, the GitHub token of a workflow run.
- Node keys. At the pinned commit only devnet/regtest keys exist as files; the devnet key in the
  repository is published and worthless by design.

## Threats and controls

| Threat | Control |
| --- | --- |
| Building something other than the reviewed commit | Full 40-hex commit required; branch tips refused; HEAD re-checked after checkout; a dirty or foreign checkout refused; `--locked` builds; provenance records repository, commit, toolchain, command, features, hashes |
| Running a swapped or corrupted binary (artifact store, disk) | `verify-build` before every start: SHA-256 and size against provenance, ELF magic, executable and not world-writable, daemon behaviour check (exit 64 + usage) |
| Cache poisoning in CI | Only Cargo's download cache is cached; compiled output never |
| Credential leakage | Tokens only via environment; git receives the GitLab token as an HTTP header through `GIT_CONFIG_*`, never in a URL, argument, file or log; URLs with credentials refused in `ace.toml`; secret values and URL credentials redacted from every log line, report and diagnostic bundle; key files never read into reports |
| Argument or command injection | Every process is started with an argument vector; Cargo package/feature/binary names validated against a strict character set; git references starting with `-` refused; workflow inputs validated as numbers and passed through `env`, never interpolated into scripts |
| Untrusted code with secrets | `ace-stablechain` has no `pull_request` trigger; secrets are scoped to the single build step that may need them; `contents: read`, `actions: read` only; `persist-credentials: false` |
| Malicious checkpoint (path traversal, links, devices, oversize, wrong chain) | Entries must be files or directories under `data/` with normal components; per-file SHA-256 and size; nothing extra or missing; network, chain and pinned genesis checked; size limit; restore only into an empty directory through staging |
| Copying a live database | Checkpoints require the node's own `LOCK`; held for the whole copy |
| Destructive "recovery" | No code path deletes or resets a data directory; wrong-chain, lock and corruption exits stop for an operator; restore never overwrites |
| Restart storms | Restart only after fail-stop or an outside kill; budget per window; exponential backoff; fresh preflight before each restart; port and lock conflicts are never restarted |
| Development key handling in production | ACE refuses plaintext keys outside devnet/regtest, mirroring the daemon; there is no option to bypass it |
| Public RPC abuse | RPC stays on loopback; exposure only through the tunnel; the node's 1 MiB body cap, batch limit and per-IP budget remain; tunnel only up while the node is healthy |

## Public exposure: known gaps

1. **Shared rate-limit budget.** The node limits requests per client IP. Through a tunnel every
   request arrives from the local cloudflared, so all public clients share one budget
   (`requests_per_second`). One client can exhaust it for everyone. A per-client limiter keyed on
   Cloudflare's client address header must sit in front of the node (or the node must learn to
   trust that header from the tunnel only) before real traffic. Cloudflare-side rate limiting is
   an alternative. ACE does not yet provide this.
2. **`submitTransaction` is public** when RPC is public. It is an ordinary user method, not
   administrative; the node has no administrative methods. On a devnet with published keys it
   lets anyone with a funded development key move devnet funds, which is the devnet's purpose.
3. **CORS** is off in the node and ACE does not change it.
4. **TLS** terminates at Cloudflare; the hop from cloudflared to the node is loopback HTTP.

## Residual risks

- Checkpoints are not signed. `origin` records where one came from; it is not proof. A signing
  step (e.g. with a key held outside the runner) is future work.
- Binary hashes are comparable only on the host layout that produced them (audit F30).
- GitHub Actions in workflows are pinned by major tag (`@v4`), not by commit SHA. Pinning to SHAs
  is recommended once the versions are reviewed.
- The log redaction masks values of the known secret variables and URL credentials; a secret
  passed under another name would not be masked. Do not pass secrets any other way.
- `ace stop` signals the supervisor whose pid is recorded in `state.json`; anyone who can write
  that file can make `ace stop` signal another of their own processes. Keep `state_dir` private
  (the systemd unit's `UMask=0077` does).
