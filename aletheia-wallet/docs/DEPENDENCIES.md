# Dependencies

Runtime (shipped to the browser), all pinned exactly:

| Package                          | Why                                                                   | Notes                                             |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| @noble/curves 2.4.0              | Ed25519                                                               | audited, no dependencies                          |
| @noble/hashes 2.4.0              | BLAKE3 (domain hash), Keccak-256 (checksum), SHA-512/HMAC (SLIP-0010) | audited                                           |
| @noble/ciphers 2.4.0             | XChaCha20-Poly1305                                                    | audited                                           |
| @scure/bip39 2.4.0               | BIP-39 words, checksum, PBKDF2 seed                                   | audited                                           |
| hash-wasm 4.12.0                 | Argon2id at 64 MiB in reasonable time                                 | WebAssembly; needs `'wasm-unsafe-eval'`           |
| qrcode-generator 2.0.4           | QR matrix (drawing is ours)                                           | no dependencies                                   |
| @zxcvbn-ts/core, language-common | password strength score                                               | lazy-loaded on the create/import/security screens |

Fonts: @fontsource-variable/manrope (dev dependency; files copied to `static/fonts`). Everything else is
build and test tooling (SvelteKit, Vite, TypeScript, Vitest, Playwright, axe, ESLint, Prettier).
No UI kit, icon set, animation runtime or Ethereum library.
