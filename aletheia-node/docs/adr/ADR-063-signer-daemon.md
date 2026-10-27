# ADR-063: The aletheia-signer daemon with a software backend
Status: Accepted
Date: 2026-10-27
Context: Spec Section 19.2 keeps high-value keys out of plaintext configuration on every
network except devnet and regtest, and puts the consensus key in an HSM behind
`aletheia-signer`. Until now only the in-process `LocalSigner` existed (Phase 5), so a
`mainnet` or `private-validation` genesis could not run a validator at all. StableChain
Mainnet Beta starts as a single validator on a Linux VPS without an HSM, expanding to several
validators later.

Decision:
  1. `aletheia-signer` (package `apps/signerd`) is a separate process that holds the BLS
     consensus key and signs over a Unix socket. It wraps `LocalSigner`, so the high-water
     marks (APS-0043, R.10) are checked and fsynced inside the daemon before a signature
     leaves: a compromised or restored `aletheiad` can get nothing signed that could
     equivocate, and never holds the key.
  2. Wire protocol (`crates/signer/src/protocol.rs`): `u32_le` length-prefixed ACE frames,
     at most 1024 bytes; requests Hello, Proposal, Vote, Timeout; responses Hello (public key
     and marks), Signature, Refused. A lost answer may be asked for again; an identical
     request yields the same signature and a different one is refused.
  3. `RemoteSigner` (node side) verifies every signature against the key the daemon
     announced before consensus uses it, reconnects once on a broken stream, and reports an
     unreachable or refusing signer as `SIG_INVALID` (reject class): the validator misses
     that vote and retries next round instead of fail-stopping. At start-up `aletheiad`
     connects first and refuses to start (exit 78) when the signer is absent, holds a key
     other than the one registered, or is configured beside a plaintext consensus key.
  4. Software backend: the key is stored in the wallet keystore format (Argon2id 64 MiB, 3
     passes; XChaCha20-Poly1305). The daemon reads the password from a file that its group
     and others cannot read, delivered by systemd `LoadCredential=`. The node key, which
     19.2 allows as an "encrypted file", uses the same format (`node_keystore`,
     `node_key_password_file`). Plaintext `node_key_file` and `consensus_key_file` stay
     devnet/regtest only.
  5. Isolation: `deploy/systemd/aletheia-signer.service` runs the daemon as its own user with
     `PrivateNetwork=yes` (no network at all), a read-only system and its state in
     `/var/lib/aletheia-signer`. The socket directory is `0750` and the socket `0660`, group
     `aletheia-signer`; `aletheiad` joins that group through the validator drop-in.
  6. `aletheia-signer keygen` writes a new consensus or node keystore and prints only the
     public values genesis needs (consensus key and proof of possession for the given chain id
     and network, or the node key). `aletheia-cli keys new --chain-id N --network K` makes
     account keys offline before a genesis exists.

Consequences:
  - Mainnet-kind networks can run validators. Each validator's key and marks live in one
    daemon; running two daemons with one key is still an operator error the marks cannot
    catch across machines.
  - The software backend is weaker than an HSM: root on the host can read the key. The HSM
    backend (with the monotonic-counter check of 19.2) replaces it without changing the
    protocol or the node.
  - Unix sockets only: on Windows `aletheiad` refuses a `[signer]` section (ADR for the
    Windows VPS still open).
  - Tests: `crates/signer/tests/remote.rs` (protocol round trip, refusals across the
    socket, restart keeps marks, reconnect, a bad signature never reaches consensus, an
    unreachable signer is a rejection); `crates/node/tests/consensus.rs` (one validator
    whose key lives only in the daemon finalizes blocks; wrong key and key-plus-signer are
    refused at start). Kill -9 between persist and sign is covered by `LocalSigner`'s tests,
    which the daemon reuses unchanged.
