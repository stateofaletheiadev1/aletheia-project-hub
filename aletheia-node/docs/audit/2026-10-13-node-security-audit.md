# aletheia-node security audit, 2026-10-13

Scope: `aletheia-node/` at commit `8f8c121`. Manual review of the untrusted-input surface
(P2P transport and handshake, consensus engine, BLS and Ed25519, the Arno VM interpreter and
contract executor, monetary and bridge rules, mempool, RPC), followed by a coverage-guided
fuzz campaign over every decoder at a trust boundary. No protocol or consensus code was
changed by this audit; every fix below that touches consensus behaviour needs a protocol
version per CLAUDE.md directive 13 and is left as a recommendation.

All findings below come from code review and are traced through the source; none has been
reproduced on a running network. Each fix should land with a test that reproduces it first.

Severity: **High** can halt or split the chain or exhaust validator memory from outside the
validator set; **Medium** needs a Byzantine validator, a live bridge route or sustained
resources, or degrades a defence; **Low** is hardening.

## Summary

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| H-1 | High | VM | Value copies in `SETF`, `SETI`, `CALL` arguments and `EQ`/`NE` comparisons are not metered by size |
| H-2 | High | P2P / node | Supervisor and sync loop can deadlock on each other's bounded queues |
| M-1 | Medium | Bridge | Guardian quorum check costs up to 65 pairings for a flat 40,000 EU |
| M-2 | Medium | Consensus | No upper bound on the rounds of accepted votes, timeouts and proposals |
| M-3 | Medium | P2P | Rate limits count frames, not bytes |
| M-4 | Medium | P2P | Unauthenticated handshake can buffer frames up to 16 MiB |
| M-5 | Medium | P2P | Bans are keyed on a node key the peer chooses |
| L-1 | Low | RPC | Per-IP limiter map is never pruned; batches count as one request; no header timeout |
| L-2 | Low | Mempool | Block candidates are taken in sender-address order; a full pool never evicts by fee |
| L-3 | Low | Executor | Contract workers run without seccomp, landlock or a memory rlimit |
| L-4 | Low | Monetary | `check_signatures` relies on the decoder for signer uniqueness |
| L-5 | Low | Executor | Worker sandbox directories collide across runners in one process (**fixed**) |
| D-1 | Medium | Dependencies | `quick-xml` 0.38.4: quadratic duplicate-attribute check on rails input (RUSTSEC-2026-0194) |

## High

### H-1 VM: size-dependent work charged at a flat cost

`crates/vm/src/interp.rs`. Metering charges memory through `Machine::set` and `allocate`
(3 EU per 32 bytes), but several paths copy or walk whole values without either:

- `Op::SetF` (line 558) and `Op::SetI` (line 580) clone the source register into a record
  field or array element and write it directly into `frame.regs`, bypassing `set`, so neither
  the copy nor the resulting memory growth is charged or counted against
  `MAX_CALL_MEMORY` / `MAX_TX_MEMORY`.
- `Op::Call` (line 460) deep-clones every non-coins argument; `call` (line 259) adds their
  sizes to `frame.memory` but `allocate(&mut frame, 0)` only checks limits, so the copy is
  covered only by the flat `NESTED_CALL` cost.
- `Op::Eq` / `Op::Ne` (line 418) compare whole values (lists, records, bytes) for `BASE`.

Effect: the work and memory a transaction causes are not bounded by its EU limit. The executor
(`crates/executor/src/lib.rs`) enforces a wall-clock watchdog and turns a second worker failure
into `VM_INTERNAL`, a fail-stop. A call that is slow or memory-heavy enough to trip the
watchdog or the host's memory on some validators and not others therefore stops those
validators, and with block EU at 2,000,000,000 there is a lot of headroom to do so.

Fix (protocol change): route every register and element write through one helper that charges
`allocate(value.size())`; charge argument copies in `call`; charge `EQ`/`NE` per 32 bytes
compared. Add a property test that, for random programs, peak memory and step count are bounded
by a function of `eu_used`. Set an `RLIMIT_AS` on workers (see L-3) so a metering bug degrades
to a deterministic trap rather than an OOM kill.

### H-2 P2P and sync loop can deadlock

`crates/p2p/src/network.rs` and `crates/node/src/sync.rs`. The network supervisor owns the
command queue (`NETWORK_COMMAND_QUEUE`, 1,024) and is the only producer of
`Connected`/`Disconnected` events; it sends them with `events.send(..).await` in `register`
(line 615) and `remove` (line 629). The sync service is the only consumer of the event queue
(4,096) and answers many messages (Ping, GetBlocks, GetProposal, TxAnnounce, GetTxs) with
`commands.send(..).await` (line 96).

When the event queue is full and a peer connects or disconnects, the supervisor blocks inside
`events.send`, and while blocked it stops draining commands. The sync service, still working
through the full event queue, fills the command queue and blocks in `commands.send`. Neither
side can proceed: the node stops processing consensus, sync and gossip. Peer reader tasks use
`events.send(..).await` for every channel except tx gossip, so remote peers can fill the event
queue with cheap, valid messages (BlockProp `NewBlock`, Mgmt `Ping`, consensus bytes) and then
force a disconnect, for example by sending one malformed frame.

Fix: never await a bounded send in the supervisor. Deliver peer lifecycle changes through a
separate channel the sync loop always polls, or with `try_send` and a coalesced peer-state
snapshot; have the sync loop use `try_send` for replies (dropping Pong / GetTxs replies under
pressure is acceptable). Add a test that fills both queues and asserts progress.

## Medium

### M-1 Bridge guardian verification underpriced

`crates/execution/src/rules/v1/bridge.rs`. `verify_quorum` (line 81) re-verifies the proof of
possession of every signer named in the bitmap (up to `MAX_GUARDIANS` = 64 pairing checks) and
then the aggregate, for the flat `BRIDGE_VERIFY_EU` charged at line 512. The bitmap is chosen by
the submitter and the work happens before the aggregate is known to be valid, so on a live
route anyone can fill blocks with failing `BridgeIn` transactions that cost validators roughly
two orders of magnitude more CPU per EU than other operations (compare `ED25519_VERIFY` at
3,000 EU for one far cheaper check).

Fix: proofs of possession are already checked in `register_guardians` (line 941); store the
keys in their proven form (or cache them per `set_id`) and skip re-verification. Price the
aggregate check per signer.

### M-2 Consensus accepts messages for arbitrarily distant rounds

`crates/consensus/src/engine.rs`. `on_vote` (line 474), `on_timeout` (line 507) and
`on_proposal` (line 293) bound rounds only from below (`> finalized.round`). One Byzantine
validator can sign votes and timeouts for unbounded future rounds and block hashes, growing
`seen_votes`, `VoteCollector`, `TimeoutCollector` and `TimeoutCollector::highest` until
finality passes those rounds, which for far-future rounds is never. As leader of future slots
it can also sign proposals on the finalized tip, each inserted into `blocks` and handed out for
execution.

Fix: accept votes, timeouts and proposals only within `[round − k, round + K]` of the
pacemaker round (QCs and TCs remain the way to jump ahead), and cap per-validator entries.

### M-3 Rate limits count frames, not bytes

`crates/p2p/src/limits.rs` (`rate_budget`, line 37) and `peer_score.rs` (`admit`, line 68).
Consensus allows 1,000 frames per second with frames up to 8 MiB, state sync 20 per second at
up to 16 MiB. Combined with H-2's 4,096-entry event queue holding decoded messages, a handful
of peers can make a node hold gigabytes. Add per-channel byte budgets and size the event queue
in bytes.

### M-4 Large frames accepted before authentication

`crates/p2p/src/connection.rs` line 253. The hello is read with a general `FrameDecoder`, so an
unauthenticated peer may announce and stream a 16 MiB StateSync frame during the handshake.
With 32 pending handshakes that is about 512 MiB. During the handshake accept only a Mgmt frame
of type 0 and at most the hello size plus signature.

### M-5 Ban evasion

`crates/p2p/src/network.rs` (`banned`, line 506; `is_banned`, line 518). Bans key on the
Ed25519 node key, which an open-peering attacker generates freely. `MAX_PEERS_PER_IP` = 8
limits the damage but does not stop reconnecting with a new key immediately after a ban.
Also record a short ban on the source address (per /64 for IPv6).

## Low

- **L-1** `crates/rpc/src/server.rs` line 30: the per-IP `HashMap` is never pruned (an IPv6
  sender can grow it without limit); a 50-call batch counts as one request; `axum::serve` has
  no header-read timeout or connection cap. Behind a reverse proxy every client shares one IP.
- **L-2** `crates/node/src/mempool.rs` line 129: candidates are taken in `BTreeMap` order of
  sender address, so low addresses always go first; when the pool is at 200 MiB new
  transactions are refused regardless of fee.
- **L-3** `crates/executor/src/lib.rs`: workers have no syscall filter and no memory rlimit
  (acknowledged in the module docs). Set `RLIMIT_AS`, then seccomp and landlock.
- **L-5 (fixed)** `crates/executor/src/lib.rs` `spawn`: each worker's sandbox directory was
  named `aletheia-arno-exec-{pid}-{n}` with `n` counted per `ProcessRunner`, so two runners in
  one process shared `…-1`, `…-2`; when one worker was dropped it deleted the directory under
  the other, whose spawn then failed ("cannot start the executor"). Two failed attempts on one
  call end in `VM_INTERNAL`, a fail-stop. This made `sandbox::a_crashed_worker_is_replaced_and_its_attempt_undone`
  fail about one run in three when tests ran in parallel. The name now uses a process-wide
  counter; the sandbox suite passed 15 of 15 consecutive runs afterwards.
- **L-4** `crates/execution/src/rules/v1/monetary.rs` `check_signatures`: signer uniqueness is
  enforced only by `decode_signatures`. Re-check strict ordering inside `check_signatures` so a
  future non-decoder caller cannot count one key twice.

## What held up

- Frame decoder checks channel and size from the header before buffering payload.
- BLS: keys validated (`key_validate`), signatures subgroup-checked, aggregation only over
  proof-of-possession-verified keys (enforced by type), distinct DSTs for PoP and signatures.
- Ed25519 uses `verify_strict` and rejects weak keys.
- Safety rules V2-V5, persist-before-send ordering, and 2-chain commit are implemented as
  specified; equivocation is evidenced, not acted on.
- Mint authorization: M-of-N with deduplicated keys, strictly ascending signer indices,
  consumed-ID replay guard, epoch expiry.
- Bridge: two-thirds threshold, distinct keys, bitmap bounds, strict sequencing, equivocation
  pauses the route.
- Handshake signature binds the TLS exporter and role.
- Plaintext development keys refused outside devnet and regtest.
- `unsafe_code = "forbid"` and strict clippy denies across the workspace.

## Fuzzing

Three targets were added for decoders that had none: `consensus_message` (consensus bytes
from any peer), `finality_proof` (sync responses) and `p2p_hello` (pre-authentication
handshake). The campaign ran with cargo-fuzz (libFuzzer, AddressSanitizer), seeded from
`tests/vectors` and the Arno sources, with a 10 s per-input timeout and a 3 GiB RSS limit.

First pass, stopped after about 15 minutes when the session was interrupted (three
targets had run on a shared 4-core machine; the full campaign over all fourteen targets was
restarted afterwards):

| Target | Executions | Coverage (edges / features) | Crashes, hangs, OOMs |
| --- | --- | --- | --- |
| `ace_block_header` | 65,340,630 | 489 / 949 | none |
| `ace_signed_transaction` | 44,709,655 | 1,931 / 3,369 | none |
| `arno_compile` | 1,545,216 | 7,122 / 24,202 | none |

Dependency audit (`cargo audit`, RustSec database of 2026-10-13): two advisories, both in
`quick-xml` 0.38.4, used by the rails ISO 20022 reader (`crates/rails/src/iso/xml.rs`):

- RUSTSEC-2026-0194 (7.5): quadratic time checking a start tag for duplicate attribute names.
  This applies: `element` iterates `start.attributes()`, which runs the duplicate check, on
  externally supplied messages of up to 1 MiB. Rated **Medium** here (rails gateway, not
  consensus).
- RUSTSEC-2026-0195 (7.5): unbounded namespace allocation in `NsReader`. The reader uses
  `Reader`, not `NsReader`, so this does not apply as written.

Fix: upgrade `quick-xml` to 0.41 or later; until then, cap the attribute count per element
before iterating.

The phase exit criteria (24 h per target, 7 days for the VM targets) still stand; this
campaign is a first pass on a 4-core machine, not a substitute. Run the full campaign on the
VPS:

```sh
cd aletheia-node/fuzz
cargo +nightly fuzz run <target> corpus/<target> -- -max_total_time=86400 -timeout=10 -rss_limit_mb=3072
```

## Tests

`cargo fmt --check`, `cargo clippy --all-targets --all-features -D warnings` on the changed
crates and `./scripts/lint.sh` pass. `cargo test --workspace --all-features --locked`: 102
suites, 526 tests passed and 1 failed before the L-5 fix (the sandbox test above, failing
intermittently); after the fix the executor, node and arno-exec suites pass and the sandbox
suite passed 15 consecutive runs.
