# ADR-057: Wallet and `aletheia-cli`
Status: Accepted
Date: 2026-10-08
Context: Section 41 sets the wallet standard: SLIP-0010 Ed25519 keys on
`m/44'/<coin type>'/<account>'/0'/<index>'`, an encrypted keystore (Argon2id +
XChaCha20-Poly1305), `aletheia:` payment URIs, and a signing flow that checks the network,
simulates, shows a summary, signs, submits and tracks to FINALIZED. Section 56 sets the CLI
with stable JSON output, a network check and no-echo prompts. New dependencies: `hmac`,
`argon2`, `chacha20poly1305` (RustCrypto), `clap`, `rpassword`; none touch consensus.
Decision:
  1. `crates/wallet`: SLIP-0010 derivation checked against the published test vectors; the
     keystore seals a 32-byte seed under Argon2id (64 MiB, 3 passes, 1 lane) and
     XChaCha20-Poly1305, so a wrong password or any change fails the tag; payment URIs
     parse amounts exactly (more decimals than the asset has is refused) and refuse a
     recipient of another network by its checksum.
  2. The flow reads the node's chain id and network and refuses to sign for another, reads
     the nonce and finalized slot, simulates and refuses a transfer that would fail, shows
     the summary for confirmation, signs the `TXSIG` digest, submits, and polls until the
     node reports the transaction (which it does only once finalized).
  3. The coin type is PROVISIONAL (7771): it is not registered in SLIP-0044 nor recorded in
     APS-0030. Changing it changes every derived address, so it must be settled before any
     mainnet key is derived.
  4. `aletheia-cli`: `status`, `keys new|show`, `account`, `balance`, `transfer`, `tx show`,
     `receipt`, `block show`; `--output json`; `--network` refuses a node on another network;
     passwords are read without echo, or from `ALETHEIA_PASSWORD_FILE` for automation;
     secrets are never printed. Its HTTP client speaks plain HTTP/1.1 to a local or private
     node; TLS to a remote node is still to come.
Consequences: BIP-39 mnemonics, hardware wallets, multisig accounts and TLS in the client
follow; so does the TypeScript SDK.
