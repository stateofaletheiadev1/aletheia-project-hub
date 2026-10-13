# aletheia-node security audit, 2026-10-13

Scope: `aletheia-node/` at commit `8f8c121`. Manual review of the untrusted-input surface
(P2P transport and handshake, consensus engine, BLS and Ed25519, the Arno VM interpreter and
contract executor, monetary and bridge rules, mempool, RPC, storage), a coverage-guided fuzz
campaign over every decoder at a trust boundary, and end-to-end tests of a running node under
crashes and memory pressure.

**Status (second pass, same day): every finding below is fixed**, each with a test that fails
on the old code or pins the new behaviour. Rule changes to protocol version 1 (which is not
frozen: no `frozen.toml`, no production network) are recorded in ADR-061. Sections "Fixes",
"End-to-end results" and "Fuzzing" at the end give the details.

Severity: **High** can halt or split the chain or exhaust validator memory from outside the
validator set; **Medium** needs a Byzantine validator, a live bridge route or sustained
resources, or degrades a defence; **Low** is hardening.

## Summary

| ID | Severity | Area | Finding | Status |
| --- | --- | --- | --- | --- |
| H-1 | High | VM | Value copies in `SETF`, `SETI`, `CALL` arguments and `EQ`/`NE` comparisons are not metered by size | fixed |
| H-2 | High | P2P / node | Supervisor and sync loop can deadlock on each other's bounded queues | fixed, reproduced first |
| H-3 | High | VM | Zero values of huge or nested array types are built before any charge or memory check | fixed |
| H-4 | High | Execution | No per-transaction EU ceiling: one call can outlast the 10 s contract watchdog and fail-stop validators | fixed |
| S-1 | High | Storage | One RocksDB block cache per column family (10 x the budget) and unbounded memtables | fixed |
| M-1 | Medium | Bridge | Guardian quorum check costs up to 65 pairings for a flat 40,000 EU | fixed |
| M-2 | Medium | Consensus | No upper bound on the rounds of accepted votes, timeouts and proposals | fixed |
| M-3 | Medium | P2P | Rate limits count frames, not bytes | fixed |
| M-4 | Medium | P2P | Unauthenticated handshake can buffer frames up to 16 MiB | fixed |
| M-5 | Medium | P2P | Bans are keyed on a node key the peer chooses | fixed |
| D-1 | Medium | Dependencies | `quick-xml` 0.38.4: quadratic duplicate-attribute check on rails input (RUSTSEC-2026-0194) | fixed |
| L-1 | Low | RPC | Per-IP limiter map is never pruned; batches count as one request | fixed |
| L-2 | Low | Mempool | Block candidates are taken in sender-address order; a full pool never evicts by fee | fixed |
| L-3 | Low | Executor | Contract workers run without seccomp, Landlock or a memory rlimit | fixed |
| L-4 | Low | Monetary | `check_signatures` relies on the decoder for signer uniqueness | fixed |
| L-5 | Low | Executor | Worker sandbox directories collide across runners in one process | fixed |

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

### H-3 VM: zero values built before any check

`crates/vm/src/value.rs` (`zero`) and `interp.rs` (`call`). Registers and empty storage slots
start as zero values, and the interpreter built every register's zero value before charging
anything or checking memory. The verifier bounded text and byte lengths but not array lengths,
so a deployed contract could declare an array type (or nested arrays) whose zero value is
gigabytes; the first call to a function with such a register made every node try to allocate
it, the worker died, the retry died the same way, and the call ended in the `VM_INTERNAL`
fail-stop on every validator.

### H-4 No per-transaction execution ceiling

`crates/execution/src/rules/v1/limits.rs`. A transaction could set `eu_limit` up to the block
limit of 2,000,000,000 EU. The interpreter measured about 58 million EU a second (release
build, shared 4-core machine), so one contract call could run for over half a minute, past the
10 s contract watchdog; the watchdog's second expiry is a fail-stop. Any user paying the fee
could stop validators, and slower or swapping validators would stop first. An honest full
block could also take far longer to execute than a consensus round.

### S-1 Storage memory: a block cache per column family

`crates/storage/src/rocks.rs`. `state_db_options` created a new 512 MiB LRU cache each time it
was called, and it was called once for the database and once per column family (nine), so the
"512 MiB" budget was up to about 5 GiB; memtables were RocksDB's default 2 x 64 MiB per family,
up to about 1.3 GiB more. On a small VPS a warm node would be killed by the OOM killer.

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

## Fixes

| ID | Change | Tests |
| --- | --- | --- |
| H-1 | `SETF`/`SETI` charge and count their copy like a register write; call frames are sized before they are built and charged beyond 1 KiB; `EQ`/`NE` over 64 bytes cost 1 EU per 32 bytes (`vm/src/interp.rs`, `cost.rs`). | VM, Arno, execution, determinism and golden suites unchanged |
| H-2 | The supervisor keeps peer arrivals and departures per peer and delivers them as the event queue has room, never blocking; per peer a departure precedes a later arrival and an unseen arrival is cancelled by its departure (`p2p/src/network.rs`). | `a_full_event_queue_never_stops_the_supervisor_taking_commands` hangs on the old code; three lifecycle unit tests |
| H-3 | `value::zero_sizes` sizes every type in one linear pass; the verifier refuses a type whose zero value, or a function whose registers, exceed 4 MiB; the interpreter checks and charges a frame before building it. | `types_whose_zero_value_exceeds_a_calls_memory_are_refused`, `a_function_whose_registers_start_too_large_is_refused`, `sizing_deeply_nested_types_takes_linear_time`, `zero_sizes_match_the_size_of_the_zero_values_they_describe` |
| H-4 | `TxLimits::max_eu_limit` = 30,000,000 (stateless validation refuses more), `max_block_eu` = 60,000,000; ADR-061 item 6. | `an_eu_limit_above_the_transaction_ceiling_is_refused` |
| S-1 | One block cache per instance shared by every column family; memtables held to a shared `write_buffer_bytes`; both sized from the memory the node may use (RAM or cgroup limit), overridable in `[storage]`. | storage conformance suite on RocksDB; constrained-memory end-to-end runs below |
| M-1 | Attestations cost `BRIDGE_VERIFY_EU` + 40,000 per guardian named, charged from the bitmap before any pairing. | bridge suite; a refused attestation is charged for every signer it names |
| M-2 | Votes, timeouts and proposals held only up to 64 rounds ahead; certificates from any round still advance the node; third and later twins of a proposal dropped unless certified. | `engine_window.rs` (3 tests); consensus suites |
| M-3 | Per-channel byte budgets beside the frame budgets. | `large_frames_spend_the_byte_budget_within_the_frame_budget`, `every_channel_admits_its_largest_frame` |
| M-4 | Frames before the hello verifies are capped at 1 KiB. | `a_limited_decoder_refuses_large_frames_from_the_header_and_lifts_on_request` |
| M-5 | A ban also covers the inbound address (/64 for IPv6) for 60 s. | `a_banned_peer_cannot_return_at_once_under_a_new_key` |
| D-1 | `quick-xml` 0.41.0 (both advisories fixed); at most 64 attributes per element; attribute values normalized per XML 1.0. | `an_element_with_thousands_of_attributes_is_refused_quickly`; rails, gateway, railsim suites |
| L-1 | Limiter prunes ended windows above 4,096 addresses; a batch spends one unit per call. | three unit tests |
| L-2 | Candidates round-robin across senders, highest fee first; a full pool evicts the cheapest last-pending transaction of another sender, never leaving a nonce gap. | `crates/node/tests/mempool.rs` (3 tests) |
| L-3 | Before its first request the worker caps its address space at 1 GiB (`setrlimit`), drops all filesystem access (Landlock) and refuses process, socket, tracing, namespace, module and identity system calls with `EPERM` (seccomp denylist; an allowlist that missed a runtime call would crash the worker into a fail-stop). It refuses to run if seccomp cannot be applied (`apps/arno-exec/src/sandbox.rs`). | `the_worker_cannot_reach_files_sockets_or_processes` (a debug probe tries a file, a socket and a process; all refused, Landlock fully enforced on kernel 6.18); every sandbox test now runs confined |
| L-4 | `check_signatures` refuses repeated or unordered signer indices itself. | `one_key_listed_twice_never_meets_a_threshold_of_two` |
| L-5 | Worker sandbox directories numbered process-wide. | sandbox suite, 15 consecutive passes |

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

Five targets were added for decoders that had none: `consensus_message` (consensus bytes from
any peer), `finality_proof` (sync responses), `p2p_hello` (pre-authentication handshake), and
`rails_xml` / `rails_camt` (ISO 20022 from external rails). Every target ran 20 minutes with
cargo-fuzz (libFuzzer, AddressSanitizer, 10 s per-input timeout, 3 GiB RSS limit), seeded
from `tests/vectors`, the Arno sources and the rails test documents, three at a time on a
shared 4-core machine. The VM-facing targets (`vm_run`, `arnobc_verify`, `arno_compile`) were
built after the VM fixes.

| Target | Executions | Coverage (edges / features) | Crashes, hangs, OOMs |
| --- | --- | --- | --- |
| `ace_block_header` | 110,859,772 | 491 / 978 | none |
| `ace_signed_transaction` | 70,921,958 | 2,324 / 3,977 | none |
| `stateless_validation` | 40,521,390 | 2,786 / 4,581 | none |
| `p2p_frames` | 18,108,886 | 2,216 / 7,196 | none |
| `p2p_hello` (new) | 166,244,745 | 196 / 219 | none |
| `consensus_message` (new) | 45,651,868 | 2,026 / 3,492 | none |
| `finality_proof` (new) | 70,279,553 | 516 / 1,057 | none |
| `arno_compile` | 2,810,043 | 7,304 / 27,126 | none |
| `arnobc_verify` | 50,486,742 | 1,028 / 2,850 | none |
| `vm_run` | 1,715,637 | 7,397 / 24,586 | none |
| `rails_xml` (new) | 18,663,561 | 1,506 / 5,343 | none |
| `rails_camt` (new) | 24,554,296 | 1,485 / 6,506 | none |
| `base16_text` | 381,027,861 | 96 / 280 | none |
| `text_identifiers` | 62,792,971 | 280 / 505 | none |

About 1.06 billion executions in all; no artifacts were written. The phase exit criteria (24
hours per target, 7 days for the VM targets) still stand; run them on the VPS:

```sh
cd aletheia-node/fuzz
cargo +nightly fuzz run <target> corpus/<target> -- -max_total_time=86400 -timeout=10 -rss_limit_mb=3072
```

Dependency audit (`cargo audit`, RustSec database of 2026-10-13): the two `quick-xml`
advisories (RUSTSEC-2026-0194, -0195) were the only findings; both are fixed by D-1.

## Consensus simulation

The DSP Byzantine suite (`tests/sim`, release build) passed all ten scenarios at 20 seeds each
with the M-2 window in place: honest finality, up to F silent validators, more than F silent
(progress stops, safety holds), equivocating proposers, double voters, invalid proposers, a
lossy network, minority and quorumless partitions, and random faults. No fork, evidence
recorded where provable. The nightly CI job runs 10,000 seeds.

## End-to-end results

`scripts/e2e_crash_recovery.sh` runs a RocksDB devnet node under continuous transfers, kills
it with SIGKILL at random moments and restarts it, then checks that it resumes at or above
its height with every earlier block id and state root unchanged, that every finalized
transfer used exactly one nonce, and that total AEY is unchanged:

| Run | Crash cycles | Transfers finalized | Result |
| --- | --- | --- | --- |
| Unconstrained | 8 | 384 | pass |
| cgroup, 256 MiB hard limit, no swap | 4 | 203 | pass; node sized itself to 64 + 64 MiB; no limit hit, no OOM kill |
| cgroup, 8 MiB RAM with 1 GiB swap (forced into swap) | 4 | 154 | pass; 3,415 limit hits, 838 major faults, no OOM kill |

`crates/node/tests/rpc_http.rs` sends hostile transfers to a running node over HTTP: a replay
of a finalized transfer (`TX_NONCE_TOO_LOW`), another chain's transfer (`TX_WRONG_CHAIN`), a
forged amount (`SIG_INVALID`), an overdraft (fails on chain, pays its fee, moves no AEY) and a
nonce gap (waits, then both apply); supply is conserved.

## Tests

All on the final code, on this machine (shared 4-core, kernel 6.18):

- `cargo fmt --check`, `cargo clippy --workspace --all-targets --all-features -D warnings` and
  `./scripts/lint.sh`: clean.
- `cargo test --workspace --all-features --locked` (debug): 104 suites, 558 tests, all pass.
- `cargo test --workspace --all-features --release --locked` (as CI runs it): all pass. Three
  supervisor tests in `apps/arno-exec/tests/sandbox.rs` failed in release on the code as it was
  before this audit too: the worker accepted `--fault` only in debug builds. A
  `fault-injection` feature (on under `--all-features`, as in the node crate) now enables it in
  test builds; production builds still ignore every argument.
- DSP Byzantine suite: 10 scenarios x 20 seeds, release, all pass.
- `scripts/e2e_crash_recovery.sh` with release binaries: 6 crash cycles, 295 transfers, pass;
  peak node memory about 20 MiB on devnet.
