# Specification errata and resolutions

Discrepancies found in `MASTER.md` (v4.0) during implementation. Each entry states what the
code does. Entries marked **Open** need a decision from the named seat before anything
depends on them.

| # | Location | Discrepancy | Resolution | Status |
| --- | --- | --- | --- | --- |
| E-1 | Section 4 ADR register vs Sections 65 and "Changes in v4.0" | ADR-029 to ADR-032 mean different things in the two lists. Section 4 has Rust language policy, no public testnet, physical banknotes and rail access through institutions. Section 65 has versioned rules registry, storage schema, canonical payment model and PayNet boundary, continuing to ADR-036. | Proposed: the v4.0 numbering (Section 65) keeps 029-036. The four Section 4 decisions are renumbered ADR-040 to ADR-043. ADR-037 to ADR-039 are taken by decisions made during Phase 1. | **Open** (Protocol seat) |
| E-2 | Section 10 table; Section 24.1 WAL header | `protocol_version` is `u32` there, but `u16` in Section 3.2 (`ProtocolVersion(u16)`), in the block and transaction `version` fields, and in the protocol schedule (Section 44.4). | `u16` everywhere a protocol version is encoded (ADR-038). When the WAL is implemented, its header field is `u16` plus two reserved zero bytes, which keeps the 4-byte slot. | Resolved |
| E-3 | Section 5 | Two subsections are numbered 5.2 ("Rust engineering rules" and "Testing and Quality Frameworks"). | Editorial only. Cite them by title. | Resolved |
| E-4 | Section 11 | Multisig derivation `ace(threshold, sorted_pubkeys)` fixes neither the width of `threshold` nor whether each key carries an `alg_id`. | Multisig address derivation is not implemented until APS-0002 fixes both. Proposed: `threshold u8`, keys as a sorted list of `(alg_id u8, key bytes)`. | **Open** (Protocol, Security) |
| E-5 | Section 9 `AceReader::take` | Input that ends early is reported as `DecodeLengthExceeded`, the same code as a length prefix above its maximum. | Kept as specified. The detail string tells the two apart. | Resolved |
| E-6 | Sections 6.6, 11, 13 | Keys and signatures carry an `alg_id`, but no values are assigned. | ADR-039: 0 is invalid, 1 is Ed25519, 2 is BLS12-381 min-pk, 3 is reserved for ML-DSA. | Resolved |
| E-7 | Section 5.5 | The workspace member list names all 24 crates plus `apps/*`. Cargo refuses a workspace whose members do not exist. | Crates join `members` as they are implemented, in Section 62 phase order. | Resolved |
| E-8 | CLAUDE.md directive 5 vs Section 65 | The ADR template is `docs/adr/0000-template.md` in one place and `docs/adr/ADR-000-template.md` in the other. | `docs/adr/ADR-000-template.md`, matching the `ADR-xxx-<slug>.md` naming of Section 4. | Resolved |
| E-9 | Section 6.7 vs Sections 10 and 55 | "`crypto` depends on nothing protocol-specific", yet domain-separated hashing needs `chain_id` and `network_kind`, and Section 55 places Merkle trees in `crypto`. | ADR-037: `core` owns `H_domain` and the tag registry. `crypto` depends on `core` only for errors, strong types and `H_domain`. | Resolved |
