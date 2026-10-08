# Implementation status

Spec Section 1.2: one row per module. "Implemented" means code exists on `main`. "Tested"
means unit and property tests run in `cargo test --workspace`. Nothing below is described as
done unless it is.

Current phase: **Phase 10 (native registries)**, exit criteria met (table below). Phase 9 met except the 7-day fuzz campaign (scheduled `node:fuzz-vm` job, not yet run); Phases 6-8 met.
partly written; see the end of this file.

## crates/core

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Strong types (`types.rs`) | 3.2 | yes | yes | unit | no | rustdoc | no |
| Errors and code registry (`error.rs`, `error_codes.rs`) | APS-0038 | yes | yes | unit, registry match | n/a | registry TOML | n/a |
| ACE reader/writer (`ace.rs`) | APS-0041 | yes | yes | unit, property | **no** | rustdoc | no |
| Network identity, `H_domain` (`network.rs`) | APS-0001 | yes | yes | unit | n/a | rustdoc | no |
| Base16 text codec (`base16.rs`) | APS-0048 | yes | yes | unit, property | **no** | rustdoc | no |
| Bech32m engine (`bech32m.rs`) | APS-0002 | yes | yes | BIP-350 vectors, property vs `bech32` crate | **no** | rustdoc | no |
| `AL:` addresses (`address.rs`) | APS-0002 | yes | yes | unit, property | **no** | rustdoc | no |
| `AL:T` / `AL:B` identifiers (`ids.rs`) | 12, 12.1 | yes | yes | unit, property | **no** | rustdoc | no |
| Transaction wire format (`tx.rs`) | APS-0003 | yes (+ ERRATA E-10, E-12) | yes | unit, property, vectors | target written, smoke only | rustdoc | no |
| Block wire format, QC, TC, signer bitmap (`block.rs`) | APS-0004, APS-0009 | yes (+ ERRATA E-11) | yes | unit, property, vectors | target written, smoke only | rustdoc | no |

## crates/execution

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Rules` registry, V1 limits and types (`rules/`) | 44.3 | yes | yes (V1 not frozen) | unit | n/a | rustdoc | n/a |
| Stateless validator (`stateless.rs`) | APS-0003, R.4 | yes | yes | one integration test per step, vectors | target written, smoke only | rustdoc | no |

## crates/p2p and node networking (Phase 4)

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Frame codec and channels (`p2p/frame.rs`) | APS-0029, 36 | yes | yes | unit, property (chunking, bounded buffering) | target `p2p_frames` (smoke) | rustdoc | no |
| Channel messages (`p2p/message.rs`) | 36 | yes | yes | round trip, bounds | target `p2p_frames` (smoke) | rustdoc | n/a |
| TLS 1.3 mutual auth (`p2p/tls.rs`) | ADR-016 | yes | yes (ring provider, P-256 certs, pinning) | localhost TLS tests | n/a | rustdoc | no |
| Signed handshake (`p2p/handshake.rs`) | 36 (+ E-19) | yes | yes | wrong network, versions, pinned key, self, timeout | **no** | rustdoc | n/a |
| Network service: peers, budgets, scoring, bans, limits (`p2p/network.rs`) | 36, 46.2 | yes | yes | peering, priority, simultaneous dial, bans, rate limit, handshake cap | n/a | rustdoc | no |
| Mempool (`node/mempool.rs`) | 21 | yes | yes (eviction of non-ready low-fee txs not yet) | via network tests | n/a | rustdoc | no |
| Chain thread (`node/chain.rs`) | 46A.1 | yes | yes | via network tests | n/a | rustdoc | n/a |
| Block propagation, block sync, tx gossip (`node/sync.rs`) | 36 | yes | yes | 7-node convergence, late joiner (80+ blocks), restart | n/a | rustdoc | no |
| Devnet producer (feature `devnet-producer`) | 62 (stand-in) | n/a | yes, devnet/regtest only | refused on mainnet | n/a | rustdoc | n/a |
| State sync over the network (JMT chunks) | 42.4 | yes | **no** (snapshots exist locally; serving them is next) | no | no | no | no |
| Peer exchange, keepalive pings, peer-version reporting | 36 | yes | **no** | no | no | no | no |

## apps/aletheiad

| Item | Spec | State |
| --- | --- | --- |
| Strict TOML config, plaintext keys refused outside devnet/regtest | 46A.2, 19.2 | Implemented; exit 78 on refusal |
| Start-up order and operator log lines | 46A.2, 46A.4 | Implemented for the components that exist (no RPC yet) |
| Validator consensus key (`consensus_key_file`) | 19.2 | Implemented for devnet and regtest (plaintext key material); production uses the signer daemon, not yet built |
| Exit codes 0 / 64 / 70 / 75 / 78 | 46A.1, 44.4 | Implemented; `docs/operations/exit-codes.md` |
| Crash recovery on real RocksDB | 24.3 | Verified by hand: killed at height 8, restarted at height 8 and continued |
| Graceful SIGTERM shutdown order | 46A.3 | Implemented; not yet exercised on Linux (Windows `timeout` kills without a signal) |
| Binary compressed logs, systemd notify and watchdog, metrics | 45, 46.5, 47 | **Not yet**: stderr lines stand in for the log backend |

## Phase 4 exit criteria (spec Section 62)

| Criterion | State |
| --- | --- |
| 7-node private validation network syncs | Met in-process over real TLS: all 7 nodes hold the producer's identical block and state root at height 20; transactions submitted to one node reach the producer by gossip and are all included. |
| Fuzzed framing | Target written and in the smoke run; the 24-hour campaign is the scheduled `node:fuzz` job. |
| DoS limits tested | Met: oversized/unknown frames, invalid messages (ban), channel floods (rate-limit ban), pending-handshake cap, handshake deadline. |

## crates/execution (Phase 3)

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| State records (`model.rs`) | 15, 18.3, 23, 44.4 | yes | yes | via execution scenarios | n/a | rustdoc | n/a |
| Receipts and events (`receipt.rs`) | APS-0031/0032 (+ E-17) | yes | yes | via execution scenarios | **no** | rustdoc | n/a |
| Canonical ordering (`ordering.rs`) | APS-0011, R.12 | yes | yes | order, gap, repeat, replay | n/a | rustdoc | no |
| Rules v1: lifecycle, transfer, batch, fees (`rules/v1/`) | 13, 23, 29 | yes | yes (not frozen) | 13 scenarios | n/a | rustdoc | no |
| Block executor (`executor.rs`) | APS-0012 | yes | yes | scenarios, determinism corpus | n/a | rustdoc | no |
| Protocol schedule and clean halt (`continuity.rs`) | 44.4 | yes | yes | mixed-version, replay, clean halt (feature `test-protocol-v2`) | n/a | rustdoc | n/a |
| Genesis (`genesis.rs`) | APS-0035 | partly: chain, fees, assets, schedule, allocations, epoch-0 validators, supply ledgers | yes for that part | harness, determinism, `genesis_validators.rs` | **no** | rustdoc | n/a |
| Supply check after every block (`executor.rs::check_supply`) | 18.4 | yes | yes | `supply_invariants.rs` (property, forged blocks) | n/a | rustdoc | no |
| Test-only protocol version 2 (`rules/test_v2.rs`) | 62.1 | yes | yes, feature-gated | continuity tests | n/a | rustdoc | n/a |

## crates/monetary

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Monetary arithmetic (`arith.rs`) | APS-0020, R.7 | yes | yes | property: division identity, native agreement | **no** | rustdoc | no |
| Supply ledger and invariants I1-I8 (`ledger.rs`) | 18.4, R.8 | yes | yes | unit per invariant, property (I7, encoding) | **no** | rustdoc | no |
| Asset framework: registry (decimals, transferable), AEY and ALnT records, genesis supply | 18.3, 18.7 | yes | yes | via execution and supply tests | n/a | rustdoc | n/a |
| AEY operations: mint (M-of-N authority), burn, lock and release (types 18-19), redeem (agent co-signed), reserve attestations, I9 at issuance (`execution/rules/v1/monetary.rs`) | 18.5, 18.8 (+ E-23, E-24) | yes | yes | `tests/harness/tests/monetary.rs`: 14 scenarios incl. attacks | **no** | rustdoc | no |
| Monetary payloads and digests (`core/monetary.rs`) | 13, 18.5, 18.8 | yes | yes | round trip, canonical signer lists, digest binding | **no** | rustdoc | n/a |
| Governed capacity changes (`MonetaryPolicyUpdate`), `max_capacity_increase_per_epoch` | 18.1, 35 | yes | **no** (governance, Phase 10) | no | no | no | no |

## crates/node

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ledger: validator re-execution and finalize path (`ledger.rs`) | 20, 24.2 | yes | yes | follow a proposer, wrong root, wrong parent | n/a | rustdoc | no |
| Crash recovery (`ledger.rs`) | 24.3 | yes (single node) | yes | crash after FINALIZE_BEGIN, archive append, KV commit; damaged archive; wrong genesis; lock | n/a | rustdoc | no |
| Speculative execution and building on uncommitted parents (`ledger.rs`, `storage/layered.rs`) | 19.3 | yes | yes | chained state, fork pruning, unknown parent, wrong root, wrong validator set | n/a | rustdoc | no |
| Safety data in the WAL, finality proofs with the block (`ledger.rs`) | 24.2, 24.3 | yes | yes | via the restart test | n/a | rustdoc | n/a |
| Chain thread, sync service, DSP driver, P2P wiring (`chain.rs`, `sync.rs`, `consensus.rs`, `runtime.rs`) | 46A, 19 | yes | yes | 4 validators over TLS, restart, observer, refusals; 7-node producer network | n/a | rustdoc | no |
| RPC | 12 | yes | **no** (Phase 12) | no | no | no | no |

## crates/consensus and crates/signer (Phase 5)

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Validator set, Q = N − F (`validator_set.rs`) | 19.1 (+ E-20, E-21) | yes | yes | unit | n/a | rustdoc | n/a |
| Leader schedule (`schedule.rs`) | 19.6 (+ E-22) | yes | yes | unit, property (permutation) | n/a | rustdoc | n/a |
| Safety rules V2-V5 (`safety.rs`) | 19.5, R.11 | yes | yes | unit, property | n/a | rustdoc | n/a |
| QC/TC verification and collectors (`certificate.rs`) | APS-0009 (+ E-11) | yes | yes | unit | **no** | rustdoc | no |
| Pacemaker (`pacemaker.rs`) | 19.4 | yes | yes | unit | n/a | rustdoc | n/a |
| Engine, 2-chain finality, evidence (`engine.rs`, `finality.rs`) | 19 | yes | yes | Byzantine simulator | n/a | rustdoc | no |
| Local signer with persistent high-water marks (`signer`) | 19.2, R.10 | yes | yes | equivocation, lower round, restart, crash, lock, corruption | n/a | rustdoc | n/a |
| Signer daemon, remote protocol, HSM counter check | 19.2 | yes | **no** | no | no | no | no |
| Activation at an epoch boundary, readiness signalling | 62.1 | yes | **no** | no | no | no | no |

## Phase 5 exit criteria (spec Sections 62, 62.1)

| Criterion | State |
| --- | --- |
| Simulator Byzantine suite green (10k seeds) | Green at 25 seeds in release (10 scenarios: silent, equivocating proposer, double voter, invalid proposer, partitions, loss, random faults). The 10k-seed run is the scheduled `node:sim` job, not yet run. |
| Chaos 24 h, no safety violation | **Not yet run.** |
| Activation with readiness just above and below threshold | **Not yet**: epoch transitions are not implemented. |

## crates/arno, crates/vm, apps/arno (Phase 8)

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lexer, parser, diagnostics (`arno/lexer.rs`, `parser.rs`, `diagnostics.rs`); Java/Solidity-shaped syntax with English operators | 25.6, 25.7, 26 | yes (+ `docs/arno/grammar.ebnf`, ADR-049, E-27) | yes | reference contracts, recovery, property | `arno_compile` | rustdoc | no |
| Names, types, coins, effects, bounds, recursion (`check.rs`, `linear.rs`, `effects.rs`) | 25 | yes (+ E-25) | yes | `tests/arno/diagnostics` (19 golden files), clean contracts, property | `arno_compile` | rustdoc | no |
| Code generation and packaging (`codegen.rs`) | 26, 27 | yes | yes | reference packages verified, byte-identical, golden hashes, 400 random well-typed programs | `arno_compile` | rustdoc | no |
| Bytecode format and verifier (`vm/opcode.rs`, `package.rs`, `verifier.rs`) | 27, APS-0014 | yes (+ ADR-046) | yes | one test per rule, property | `arnobc_verify` | rustdoc | no |
| `arno` command: check, compile, inspect | 26 | yes | yes | by hand | n/a | usage text | n/a |
| SSA IR with CSE, `arno fmt`, `arno-test` | 26 | yes | **no**: code is generated from the checked tree with fixed registers; formatter and test runner not yet built | no | no | no | no |

## Phase 10: native registries and governance

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Payloads and digests (`core/registry.rs`) | APS-0022..0026 (+ E-26) | yes | yes | via registry tests | via transaction decoding | rustdoc | n/a |
| Identity and credentials, revocation bitmaps | 31 (+ ADR-048) | yes | yes | permissions, scope, rotation, final revocation, inactive issuer | n/a | rustdoc | no |
| Residence with history and computed expiry | 32 | yes | yes | permissions, scope, transitions, history | n/a | rustdoc | no |
| Land: parcels, encumbrances, co-signed transfers, history | 33 | yes | yes | controller-only transfers, locks, co-signature (and replay), history proofs | n/a | rustdoc | no |
| Governance: council, proposals, timelocks, designated actions | 35 | yes | yes | threshold, timelock, rejection, expiry, bounds, capacity, upgrade scheduling | n/a | rustdoc | n/a |
| Separate `identity`, `residence`, `land`, `governance` crates (Section 5.5) | 5.5 | yes | **no**: implemented as modules of `execution`, beside the other native modules | n/a | n/a | n/a | n/a |
| Emergency validator suspension (timelock class 0) | 35 | yes | **no**: needs the validator registry operations | no | no | no | no |

## Phase 10 exit criteria (spec Section 62)

| Criterion | State |
| --- | --- |
| Permission tests | Met: every registry operation is refused for every party but the one permitted (issuer, authority, controller, holder, council member), including deactivated issuers, out-of-scope schemas and classes, replayed co-signatures and outsiders proposing or voting (`tests/harness/tests/registry.rs`). |
| History proofs | Met: land and residence history entries are read back and proven with JMT state proofs against the block's state root; forged entries and false absence claims fail verification. |

## Phase 9: the Arno VM

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Interpreter, metering, memory limits, traps (`vm/interp.rs`, `value.rs`, `cost.rs`, `trap.rs`) | 28, 29 (+ ADR-047) | yes | yes | compiled contracts end to end, each trap, exact EU stop, 300 random programs (no internal error, deterministic) | `vm_run` | rustdoc | **no**: costs are the spec's devnet defaults, not yet calibrated |
| Contracts on chain: deploy (32), call (33), contract storage, coins (`execution/rules/v1/contract.rs`) | 11, 15, 27 | yes | yes | `tests/harness/tests/contracts.rs` (lifecycle, reverts, EU, errors, escapes) | via `vm_run` | rustdoc | no |
| Sandboxed executor: worker binary, protocol, watchdog, retry, fail-stop (`vm/wire.rs`, `vm/worker.rs`, `executor`, `apps/arno-exec`) | 28.1 | yes | yes, over pipes | `apps/arno-exec/tests/sandbox.rs` (identical results, crash, hang, garbage) | n/a | rustdoc | no |
| Worker OS confinement (seccomp, landlock; shared-memory ring) | 28.1 | yes | **no**: worker has an empty environment and directory and only its pipes; the syscall filter and the ring transport are tracked for hardening (Phase 13) | no | no | no | no |

## Phase 9 exit criteria (spec Section 62)

| Criterion | State |
| --- | --- |
| VM conformance vectors | Met: `tests/vectors/APS-0015/vm-execution.json`, nine cases with package bytes, canonical arguments, expected results or trap codes, exact EU, final storage and events; checked against the implementation on every test run. |
| 7-day fuzz clean | **Not yet run**: the `node:fuzz-vm` CI job runs `vm_run`, `arnobc_verify` and `arno_compile` for 7 days each when scheduled with `FUZZ_CAMPAIGN=vm`; the same targets run in every smoke run. |
| Sandbox escape tests | Met for the contract and worker boundaries: contracts cannot reach other contracts' storage or coins, overdraw a vault, exceed memory or store oversized values; a crashed worker is replaced without doubled effects, and a hanging or lying worker ends in fail-stop. OS-level confinement tests arrive with the syscall filter. |

## Phase 8 exit criteria (spec Section 62)

| Criterion | State |
| --- | --- |
| Reference contracts compile byte-identically across machines | Met: Escrow, Payroll and a contract using most of the language compile to packages the VM verifier accepts; their code hashes are pinned in `tests/arno/golden-hashes.txt` (written on Windows), and the Linux CI test job compares them, so any machine or architecture difference fails the build. LF line endings are enforced for sources. |
| Compiler fuzzed | Targets `arno_compile` (accepted output must verify and be reproducible) and `arnobc_verify` (accepted packages are canonical) are written and in the smoke run, including 2,000 mutations of the Escrow source per run; the long campaign is the scheduled `node:fuzz` job. |

## Phase 7 exit criteria (spec Section 62)

| Criterion | State |
| --- | --- |
| Monetary attack tests | Met: replayed authorization; too few, unregistered, forged, tampered and cross-chain signatures; one authority signing twice; ALnT issuance; expired authorization; capacity (I3) and epoch cap (I4) with the epoch reset; minting without a fresh attestation and beyond the attested reserve (I9) while transfers continue; attestations from outsiders, from the future, not newer, and large moves without the higher threshold; redemptions without an agent, with a stolen or reused co-signature; unlocking more than locked; spending locked funds. Every block also passes the per-block supply check. |
| Invariant fail-stop tested | Met: a finalized supply ledger corrupted underneath a verifying JMT stops start-up with 9011 (`crates/node/tests/recovery.rs`). |

## Phase 6 exit criteria (spec Section 62)

| Criterion | State |
| --- | --- |
| Supply invariants property-tested | Met: random blocks of transfers and batch transfers in AEY and ALnT, failing payloads and fees in either asset, fully audited after every block (sum of all balances equals digital supply, I1-I8, issued supply unchanged); forged blocks that create value or record unbacked supply are refused. |

## Phase 3 exit criteria (spec Sections 62, 62.1)

| Criterion | State |
| --- | --- |
| Determinism test green | Met on x86-64: seeded 200-block corpus with golden hashes and a full state-dump hash; release and debug builds agree. aarch64 needs a CI runner. |
| Recovery tests green | Met for the single-node finalize path (three crash points, damaged archive, torn WAL tail). |
| `Rules` with V1 and a test-only V2; schedule namespace 66; clean halt exit 75 | Met in execution (halt error and message); the process exit code 75 arrives with the `aletheiad` binary. |
| Mixed-version and clean-halt tests | Met. |
| Replay of a 1M-block devnet history reproduces every root | **Not yet**: replay is tested across an upgrade on short histories; the 1M-block run needs the replay tool and a CI budget. |

## crates/storage

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `KvStore` contract (`kv.rs`) | 42.1 | yes | yes | conformance suite | n/a | rustdoc | n/a |
| Memory backend (`memory.rs`, NON-PRODUCTION) | 42.1 | yes | yes | conformance suite | n/a | rustdoc | n/a |
| RocksDB backend (`rocks.rs`, feature `rocksdb`) | 42.2 | yes (+ ERRATA E-16) | yes | conformance suite | n/a | rustdoc | no |
| Data directory and manifest (`datadir.rs`) | APS-0055 | yes | yes | decision table, lock, corruption, wrong chain, refuse-newer | **no** | rustdoc | n/a |
| Consensus WAL (`wal.rs`) | APS-0034 | yes | yes | torn tail at every offset, corruption, gaps, rotation, pruning | **no** | rustdoc | no |
| Block archive (`archive.rs`) | 42.3 | yes | yes | round trip, order, tamper, wrong network, torn tail | **no** | rustdoc | no |
| Migration framework (`migrate.rs`) | 44.5 | yes | yes | dummy 1->2 step: clean run, crash-and-resume from journal, rollback, failed tip check | n/a | rustdoc | no |
| Snapshots (`crates/state/src/snapshot.rs`) | 42.4 | yes | yes (restore holds state in memory; streaming restore with state sync in Phase 4) | round trip, tampered chunk, forged root | **no** | rustdoc | no |
| State sync over the network | 42.4 | yes | **no** (Phase 4) | no | no | no | no |

## crates/state

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| State keys and namespaces (`key.rs`) | APS-0005 | yes | yes | unit | n/a | rustdoc | n/a |
| `StateOverlay` (`overlay.rs`) | 15 | yes | yes | unit (nested checkpoints, stacking) | n/a | rustdoc | no |
| Jellyfish Merkle Tree (`jmt/`) | 16.1 (+ ERRATA E-15) | yes | yes | property: root == naive root over random histories; historical reads | **no** | rustdoc | no |
| State proofs (`jmt/proof.rs`) | 16.3, R.5 | yes | yes | property: inclusion, non-inclusion, wrong value, wrong network | **no** | rustdoc | no |
| JMT stale-node pruning (`prune_stale`) | 42.4 | yes | yes (rate-limited per call; the background task arrives with the node supervisor) | unit: newer versions and proofs intact | n/a | rustdoc | no |

## Phase 2 exit criteria (spec Section 62, 62.1)

| Criterion | State |
| --- | --- |
| KvStore conformance | Met: memory and RocksDB backends pass the same suite. |
| JMT root == naive root (property) | Met. |
| Power-loss suite green | Partly: WAL and archive truncation tests simulate torn writes at every offset. A dm-log-writes replay of the finalize path needs Linux and the node's finalize path (Phase 3). |
| DATADIR manifest, storage schema 1 | Met. |
| Migration framework, dummy 1->2 step, migration-crash test | Met (memory backend; the RocksDB checkpoint path is covered by the conformance suite). |
| Refuse-newer test | Met (decision table). |

## crates/crypto

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Secret<T>` | CLAUDE.md 7 | yes | yes | compile-time no-Debug/no-Clone check | n/a | rustdoc | n/a |
| Algorithm IDs | APS-0037, ADR-039 | yes | yes | unit | n/a | ADR-039 | n/a |
| Ed25519 strict | ADR-003 | yes | yes | RFC 8032 KATs, non-canonical S, weak keys | **no** | rustdoc | no |
| BLS12-381 min-pk, PoP, aggregate | APS-0009 | yes | yes | consensus-spec KAT, PoP, aggregate | **no** | rustdoc | no |
| List Merkle trees and inclusion proofs | APS-0006 | yes | yes | unit, property | **no** | rustdoc | no |
| Address derivation (Ed25519, contract) | APS-0002 | yes | yes | unit | n/a | rustdoc | n/a |
| Address derivation (multisig, authorization) | APS-0002 | yes (ERRATA E-4 adopted) | yes | unit | n/a | rustdoc | n/a |

## Phase 1 exit criteria (spec Section 62)

| Criterion | State |
| --- | --- |
| KATs pass | Ed25519 (RFC 8032) and BLS (consensus-spec `sign` vector) pass. BLAKE3 is exercised through `H_domain` against the normative formula; upstream BLAKE3 KATs are not yet in the suite. |
| Round-trip property tests | ACE integers, lists and byte strings; base16; Bech32m regrouping; addresses; IDs. |
| Fuzzers 24 h clean | **Not met yet.** Five targets in `fuzz/` (transaction and header decoding, text identifiers, base16, stateless validation). A stable smoke run (2,000 random and mutated inputs per target) passes on every CI run. The 24-hour coverage-guided campaign runs in the `node:fuzz` GitLab job (nightly, scheduled or manual) and has not been run yet. |
| Vectors published | Done: `tests/vectors/` APS-0001, 0002, 0003, 0004, 0006, 0009, 0041, 0048, checked against the implementation by `tests/conformance`. |
| Transaction and block structures (Sections 13, 14) | Done (wire format, IDs, digests, stateless validation). |

## Phase 0 documents (spec Section 65)

Written: `CLAUDE.md`, `docs/spec/MASTER.md`, `docs/spec/ERRATA.md`, `docs/STATUS.md`,
`docs/adr/ADR-000-template.md`, ADR-037 to ADR-039, `docs/aps/APS-0038-error-codes.toml`,
`rust-toolchain.toml`, `Cargo.toml`, `Cargo.lock`, `.cargo/config.toml`, `rustfmt.toml`,
`clippy.toml`, `deny.toml`, `scripts/check_banned.sh`, `scripts/check_no_0x.sh`,
`scripts/check_prose.sh`, `scripts/lint.sh`, `.gitlab-ci.yml` (repository root).

Not yet written: ADR-001 to ADR-036, the APS documents, `docs/architecture/*`,
`docs/security/*`, `docs/operations/*`, `docs/dsp/dsp-v0.1.md`, `docs/arno/*`, `docs/apn/*`,
`docs/rpc/openrpc.json`, `scripts/coverage.sh`, `coverage-gates.toml`, `tools/*`,
`scripts/check_ui_tells.sh`, `scripts/check_frozen_rules.sh`, rail profiles,
`crates/execution/src/rules/frozen.toml`.

Open decisions: none. ERRATA E-1 and E-4 were adopted on the project lead's instruction; the seats may still object.
