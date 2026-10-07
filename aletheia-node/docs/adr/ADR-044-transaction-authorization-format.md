# ADR-044: Transaction authorization carries its public keys
Status: Accepted
Date: 2026-10-07
Context: Section 13 defines `Authorization = { scheme u8, signatures list<{signer_index, alg_id,
signature}> }` with no keys (ERRATA E-10). Addresses are hashes of keys, and accounts store
only a `pubkey_commitment`, so there is no key to verify against before state is read.
Options considered:
  A. Look up the key in state during validation. That makes signature checks stateful, so
     they can't be batched or run in parallel before ordering. Section 58 relies on parallel
     stateless verification. It also gives no answer for an account's first transaction.
  B. Carry the keys in the authorization and bind them to the account statefully.
Decision: B.
  Authorization = scheme u8 | threshold u8 | public_keys list<PublicKeyEntry> (strictly sorted,
  at most 16) | signatures list<SignatureEntry> (strictly ascending signer_index, at most 16).
  Scheme codes: 0 invalid, 1 Ed25519 (one key, threshold 1), 2 MultiEd25519 (2-16 keys,
  1 <= threshold <= keys), 3 reserved for ML-DSA.
  The signature count must equal the threshold, so extra signatures cannot change the
  witness hash of the same intent.
  Stateful binding: for a new account, `authorization_address(keys) == sender`; for an
  existing account, the commitment to the keys must equal the stored `pubkey_commitment`,
  which lets keys rotate without changing the address.
Consequences: Witnesses grow by 33 bytes per key. Signatures verify before state access,
cheapest checks first. Key rotation stays possible.
Protocol impact: APS-0003 records the layout. Implemented in `crates/core/src/tx.rs` and
`crates/execution/src/stateless.rs`.
