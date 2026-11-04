# ADR-0001: The node's source is the protocol text

Status: Accepted · 2026-11-03

**Context.** APS-0030 is not in the repository and the master specification predates ADR-062 (`alt:`
identifiers). The running Mainnet Beta node is built from `aletheia-node/`.

**Decision.** Every byte layout the wallet produces is ported from `crates/core` (ACE, `TransactionBody`,
`Authorization`, `H_domain`, `text_id`) and `crates/crypto/src/address.rs`, with section and file cited in
comments. Correctness is proved against the Rust implementation, not against hand-typed values:
the devnet genesis account of seed `[0xA1; 32]`, a keystore written by `aletheia-cli`, and a real
`aletheiad` devnet accepting, executing and finalizing a transfer signed in TypeScript under the same id.

**Consequences.** A protocol change in the node must be mirrored here; the integration test fails when
they diverge.
