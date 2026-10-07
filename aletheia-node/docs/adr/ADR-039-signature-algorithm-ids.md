# ADR-039: Signature algorithm identifiers
Status: Accepted
Date: 2026-10-07
Context: Section 6.6 requires every public key and signature in protocol objects to carry an
algorithm ID. Sections 11 and 13 encode it as `u8 alg_id`. No values are assigned. See ERRATA E-6.
Options considered:
  A. Start at 0 for Ed25519. Then zero-initialized memory decodes as a valid algorithm.
  B. Start at 1 and reserve 0 as invalid.
Decision: B.
  0 invalid; never accepted.
  1 Ed25519, strict RFC 8032 verification (ADR-003).
  2 BLS12-381 min-pk, ciphersuite BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_ (ADR-004).
  3 reserved for ML-DSA (address type 4). Rejected until a protocol version activates it.
Consequences: Decoding an unknown or reserved ID is `DecodeNonCanonical` inside ACE values and
`CryptoAlgorithmUnsupported` elsewhere. Adding an algorithm is a class 4 change (Section 44.2):
a new crypto profile under a new protocol version.
Protocol impact: APS-0037 records the table. Implemented in
`crates/crypto/src/algorithm.rs`.
