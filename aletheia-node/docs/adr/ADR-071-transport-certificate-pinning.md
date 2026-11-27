# ADR-071: Persistent transport certificates, pinned from the validator registry
Status: Accepted
Date: 2026-11-27
Context: Section 36 pins validator TLS certificates to `transport_cert_hash` in the validator
registry, and ADR-069 records that hash with every registration, but a node generated a new
certificate at every start, so no registered hash could ever match, and the dialer's pinning
support was never fed a value. Identity already comes from the signed hello bound to the TLS
session; pinning adds a second, independent check for validators: a stolen node key alone does
not let an attacker stand in for a registered validator.

Decision:
  1. **One certificate per node, kept.** `TransportCertificate::load_or_create` reads
     `<data_dir>/p2p/transport-cert.der` and `transport-key.pk8`, or creates them on first start
     (ECDSA P-256, self-signed). The key file is written owner-only (0600) through a temporary
     file and a rename. A certificate and key that do not belong together stop start-up with an
     instruction to restore both from backup; they are never silently replaced, which would
     break the registered hash. The node logs `transport certificate sha256=<hex>` at start.
  2. **Pins come with the validator set.** When the node tells the network the epoch's
     validators (ADR-070), each carries the certificate hash its registration records; a genesis
     validator, or a registration with a zero hash, carries none and is not pinned.
  3. **The network enforces them.** Dial tasks to validators pin the hash in the TLS verifier;
     an inbound connection from a validator presenting another certificate is refused; when the
     pins change, a connected validator that no longer matches is disconnected.

Consequences: an operator registers the hash its node logs (`validator register --cert-hash`)
and backs up `p2p/` with the node keystore: a lost certificate means the validator's
connections are refused until it exits and registers again. Rotation through the registry
(`RotateTransportCert`, Section 34, every 90 days per Section 19.2) needs a new transaction type
in a later protocol version and follows separately. Tests: the certificate survives a restart
and a mismatched pair is refused (`tls.rs`); a validator presenting another certificate than the
registered one is refused and the registered one is accepted (`tests/network.rs`); the
end-to-end validator run registers the operator node's real hash and finalizes with it pinned
(`tests/validator_epochs.rs`).
