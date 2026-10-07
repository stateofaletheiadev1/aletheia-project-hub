# Aletheia Explorer

"The Public Ledger": the public block explorer for Aletheia StableChain, specified in
Section 41A of the master specification (`../aletheia-node/docs/spec/MASTER.md`) and
ADR-024 / ADR-033.

## Status

Not started. The Explorer is Phase 12C of the implementation plan (spec Section 62). It
reads only finalized data through the explorer API (`crates/explorer-api` in
`aletheia-node`), which sits on the indexer database, which in turn follows a running node.
None of those exist yet; work here begins once the node exposes finalized blocks and the
explorer API serves them.

## What will live here

- SvelteKit application with Svelte 5 runes (spec Section 41A.14).
- Manrope as the only typeface; no UI kits, gradients or generic card grids (41A.3, 41A.2).
- The generative guilloche seal derived from each block hash (41A.6).
- Proof verification in the browser through the `crates/verify` WASM build
  (`wasm-bindgen`, `wasm32-unknown-unknown`) - the seal is ornament, the Verify button is
  proof (41A.12).
- Amounts handled as `BigInt` only, never floating point (41A.7).
- Version-aware rendering of every historical and unknown transaction type (41A.13).
- CI gates: `scripts/check_ui_tells.sh`, visual regression, axe, Lighthouse budgets
  (41A.16, 41A.19).
