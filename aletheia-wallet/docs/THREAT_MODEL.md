# Threat model (STRIDE)

Assets: the recovery phrase and derived keys; the keystore password; the integrity of what is signed;
the user's attention at the moment of signing.

| # | Threat | Control | Evidence |
|---|---|---|---|
| S1 | A fake node or MITM poses as AletheiaChain | network gate: chain id, kind, protocol, pinned genesis block, asset decimals; re-verified at approval; HTTPS + HSTS | `engine.test.ts` gate cases; devnet refused as mainnet |
| S2 | A phishing clone of the wallet | canonical domain in copy, HSTS, `frame-ancestors 'none'`, no third-party origins | headers in `hooks.server.ts`, `vercel.json` |
| T1 | The page or a script alters what is signed | the worker decodes the body and checks sender and network before signing; the review is decoded from the bytes; re-sign must be byte-identical | `vault.test.ts` refusals; Send page |
| T2 | Tampered keystore in storage | AEAD tag over the secret; clear metadata re-derived and compared on unlock | `custody.test.ts`, `vault.test.ts` |
| T3 | Address substitution (clipboard, foreign network) | EIP-55 network checksum, strict parse, foreign network blocked, grouped display, Help guidance | `identifiers.test.ts` |
| R1 | "It said done" disputes | only node-reported finality is called final; local records keep submission time and expiry | state machine tests |
| I1 | Phrase or key leaves the browser | generated and used in a worker; never in URLs, SSR, storage in clear, or logs; no analytics | `vault.test.ts` (keystore JSON lacks the words), redaction test, bundle check |
| I2 | Phrase observed on screen or clipboard | masked by default, no copy, not selectable, hidden from print | DDR-0005 |
| I3 | Simulation leaks a valid signed transfer to the RPC operator | preview identical to the final transfer (same nonce): it can only perform what the user drafted; disclosed in the UI; change requested (D-3) | ADR-0006 |
| D1 | Rate limiting or node outage | backoff, honest "unreachable", last finalized state kept, nothing lost | client tests |
| E1 | XSS via memos or node strings | all node strings rendered as text; no `{@html}` with data; strict CSP | ESLint, CSP |
| E2 | Supply-chain compromise | 8 runtime dependencies, exact pins, lockfile, audited crypto libraries | `DEPENDENCIES.md` |
| E3 | Brute force of the keystore password | Argon2id 64 MiB × 3, strength meter, unlock throttling with backoff | `throttle` tests |

JavaScript cannot guarantee zeroization: the wallet overwrites every secret buffer it owns
(`Uint8Array.fill(0)`) and discards the worker on lock, but strings (the words while shown, the password
while typed) live until the engine collects them.
