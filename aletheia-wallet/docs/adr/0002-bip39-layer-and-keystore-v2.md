# ADR-0002: BIP-39 layer and keystore v2

Status: Accepted for devnet; mainnet pending owner confirmation (D-1, D-2)

**Context.** Spec §41: BIP-39 (optional) → SLIP-0010 Ed25519 on `m/44'/coin'/account'/0'/index'`. The CLI
keystore (v1) seals a random 32-byte SLIP-0010 seed and has no words.

**Decision.** 24 English words (256-bit entropy), empty passphrase, PBKDF2 seed, SLIP-0010 master, coin type
7771 (same as `aletheia-cli`), accounts on the index: `m/44'/7771'/0'/0'/i'`. Keystore v2 seals the 32
bytes of BIP-39 *entropy* with exactly v1's cipher suite (Argon2id 64 MiB/3/1, XChaCha20-Poly1305), so the
phrase can be re-verified; public account metadata is in clear and is re-derived and compared on every
unlock (a mismatch is "corrupt"). v1 files are opened read-for-use. Audited libraries: @scure/bip39,
@noble/hashes, @noble/curves, @noble/ciphers, hash-wasm (Argon2id).

**Consequences.** Argon2id in WASM needs CSP `'wasm-unsafe-eval'` (ADR-0005). The CLI should learn v2.
