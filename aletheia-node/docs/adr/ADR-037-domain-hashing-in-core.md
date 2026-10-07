# ADR-037: Domain-separated hashing lives in aletheia-core
Status: Accepted
Date: 2026-10-07
Context: Spec Section 6.7 says `crypto` depends on nothing protocol-specific. But
`H_domain(tag, msg)` (Section 10) hashes `chain_id` and `network_kind`, and its tag registry
is protocol. Section 55 puts Merkle trees in `crypto`, and they need `H_domain`. Section 3.3
also requires `Result<T, AletheiaError>` on every crypto path, and `AletheiaError` lives in
`core`. See ERRATA E-9.
Options considered:
  A. `crypto` defines `H_domain` and takes `chain_id`/`network_kind` as plain integers. Then
     `core` cannot compute transaction or block IDs without depending on `crypto`, and the tag
     registry splits from the identity types it is defined against.
  B. `core` owns `H_domain`, `DomainTag` and `NetworkIdentity` and depends on the `blake3`
     crate directly. `crypto` depends on `core` for errors, strong types and `H_domain`, and
     wraps the signature primitives and Merkle trees.
  C. A third crate just for hashing. That adds a seam with one implementation, which
     Section 3.4 rejects.
Decision: B.
Consequences: The dependency graph stays acyclic and points downward: core <- crypto <- the
rest. BLAKE3 is the v0.1 commitment hash. A future hash goes behind a new protocol version and
a new tag version (`.../v2`), not a new crate. `crypto` stays free of storage, network and
execution concerns.
Protocol impact: None. This only places existing rules in code.
