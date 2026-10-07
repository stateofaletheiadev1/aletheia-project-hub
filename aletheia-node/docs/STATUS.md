# Implementation status

Spec Section 1.2: one row per module. "Implemented" means code exists on `main`. "Tested"
means unit and property tests run in `cargo test --workspace`. Nothing below is described as
done unless it is.

Current phase: **Phase 3 (single-node state machine)**, exit criteria largely met (table below). Phase 1 still lacks the 24-hour fuzz campaign; Phase 2 lacks the Linux dm-log-writes power-loss replay. Phase 0 documents are
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

## crates/execution (Phase 3)

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| State records (`model.rs`) | 15, 18.3, 23, 44.4 | yes | yes | via execution scenarios | n/a | rustdoc | n/a |
| Receipts and events (`receipt.rs`) | APS-0031/0032 (+ E-17) | yes | yes | via execution scenarios | **no** | rustdoc | n/a |
| Canonical ordering (`ordering.rs`) | APS-0011, R.12 | yes | yes | order, gap, repeat, replay | n/a | rustdoc | no |
| Rules v1: lifecycle, transfer, batch, fees (`rules/v1/`) | 13, 23, 29 | yes | yes (not frozen) | 13 scenarios | n/a | rustdoc | no |
| Block executor (`executor.rs`) | APS-0012 | yes | yes | scenarios, determinism corpus | n/a | rustdoc | no |
| Protocol schedule and clean halt (`continuity.rs`) | 44.4 | yes | yes | mixed-version, replay, clean halt (feature `test-protocol-v2`) | n/a | rustdoc | n/a |
| Genesis (`genesis.rs`) | APS-0035 | partly: chain, fees, assets, schedule, allocations | yes for that part | via harness and determinism | **no** | rustdoc | n/a |
| Test-only protocol version 2 (`rules/test_v2.rs`) | 62.1 | yes | yes, feature-gated | continuity tests | n/a | rustdoc | n/a |

## crates/monetary

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Monetary arithmetic (`arith.rs`) | APS-0020, R.7 | yes | yes | property: division identity, native agreement | **no** | rustdoc | no |
| Asset framework, ALnT, AEY, supply ledger, invariants | 18 | yes | **no** (Phases 6-7) | no | no | no | no |

## crates/node

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ledger: validator re-execution and finalize path (`ledger.rs`) | 20, 24.2 | yes | yes | follow a proposer, wrong root, wrong parent | n/a | rustdoc | no |
| Crash recovery (`ledger.rs`) | 24.3 | yes (single node) | yes | crash after FINALIZE_BEGIN, archive append, KV commit; damaged archive; wrong genesis; lock | n/a | rustdoc | no |
| Supervision tree, P2P, consensus, RPC wiring | 46A | yes | **no** | no | no | no | no |

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
