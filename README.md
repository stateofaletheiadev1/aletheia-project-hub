# aletheia-project-hub

Monorepo for the Sovereign Covenant State of Aletheia.

| Path | What it is |
| --- | --- |
| `/` (root) | National web platform: Next.js app (`app/`, `components/`, `lib/`, `public/`). See `CLAUDE.md` and `AGENTS.md`. |
| `aletheia-node/` | Aletheia StableChain node: Rust Cargo workspace. Spec in `aletheia-node/docs/spec/MASTER.md`, progress in `aletheia-node/docs/STATUS.md`. |
| `aletheia-explorer/` | Aletheia Explorer, "The Public Ledger" (spec Section 41A). Not started; Phase 12C. |

All work lands on the `main` branch.

## Web platform

```sh
npm install
npm run dev
```

## StableChain node

Requires the Rust toolchain pinned in `aletheia-node/rust-toolchain.toml` (rustup installs it
automatically).

```sh
cd aletheia-node
cargo test --workspace --locked
./scripts/lint.sh
```
