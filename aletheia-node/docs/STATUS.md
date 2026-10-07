# Implementation status

Spec Section 1.2: one row per module. "Implemented" means code exists on `main`. "Tested"
means unit and property tests run in `cargo test --workspace`. Nothing below is described as
done unless it is.

Current phase: **Phase 1 (crypto and encoding)** is in progress. Phase 0 documents are
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

## crates/crypto

| Module | APS | Specified | Implemented | Tested | Fuzzed | Documented | Benchmarked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Secret<T>` | CLAUDE.md 7 | yes | yes | compile-time no-Debug/no-Clone check | n/a | rustdoc | n/a |
| Algorithm IDs | APS-0037, ADR-039 | yes | yes | unit | n/a | ADR-039 | n/a |
| Ed25519 strict | ADR-003 | yes | yes | RFC 8032 KATs, non-canonical S, weak keys | **no** | rustdoc | no |
| BLS12-381 min-pk, PoP, aggregate | APS-0009 | yes | yes | consensus-spec KAT, PoP, aggregate | **no** | rustdoc | no |
| List Merkle trees and inclusion proofs | APS-0006 | yes | yes | unit, property | **no** | rustdoc | no |
| Address derivation (Ed25519, contract) | APS-0002 | yes | yes | unit | n/a | rustdoc | n/a |
| Address derivation (multisig) | APS-0002 | **blocked** (ERRATA E-4) | no | no | no | no | no |

## Phase 1 exit criteria (spec Section 62)

| Criterion | State |
| --- | --- |
| KATs pass | Ed25519 (RFC 8032) and BLS (consensus-spec `sign` vector) pass. BLAKE3 is exercised through `H_domain` against the normative formula; upstream BLAKE3 KATs are not yet in the suite. |
| Round-trip property tests | ACE integers, lists and byte strings; base16; Bech32m regrouping; addresses; IDs. |
| Fuzzers 24 h clean | **Not started.** `cargo-fuzz` targets for ACE, base16, address and ID parsing are next. |
| Vectors published | **Not started.** `tests/vectors/APS-0002`, `APS-0041`, `APS-0048` to follow. |
| Transaction and block structures (Sections 13, 14) | **Not started.** Next after fuzz targets. |

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

Open decisions: ERRATA E-1 (ADR numbering) and E-4 (multisig derivation).
