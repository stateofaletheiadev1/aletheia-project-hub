# Security

- **Custody.** Non-custodial. The phrase and keys exist only inside the wallet worker while unlocked; the
  page receives public keys, addresses and signatures. Locking — manual, after 1–30 min idle, or after
  a minute hidden — wipes the worker's buffers and terminates it.
- **At rest.** IndexedDB holds the sealed keystore (Argon2id 64 MiB/3 passes/1 lane; XChaCha20-Poly1305),
  public transfer records and contacts. localStorage holds preferences and the unlock-throttle counter only.
- **Signing.** Only after the network gate passes within the last 30 s, a fresh price (< 60 s), and a
  deliberate hold (or checkbox + click). Mainnet signing stays off until the owner confirms D-1/D-2.
- **Browser.** CSP and headers per ADR-0005; no third-party scripts, fonts or analytics; external links
  `noopener noreferrer`; wallet routes `noindex` and `no-store`.
- **Report a vulnerability:** security@stateofaletheia.org.
