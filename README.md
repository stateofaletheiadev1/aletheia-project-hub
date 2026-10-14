# aletheia-project-hub

Monorepo for the Sovereign Covenant State of Aletheia.

| Path | What it is |
| --- | --- |
| `aletheia-web/` | National web platform: Next.js app. The Citizen Portal and Officer console run on AletheiaDB: `aletheia-web/docs/BACKEND.md`. See also `aletheia-web/CLAUDE.md` and `aletheia-web/AGENTS.md`. |
| `aletheia-gov/` | Government website (aletheiagov.org): Next.js app. Brief in `aletheia-gov/aletheiagov-master-engineering-prompt-v2.md`, status in `aletheia-gov/PROGRESS.md`. |
| `aletheia-db/` | AletheiaDB, our own document database (Rust), live at db.stateofaletheia.org. See `aletheia-db/README.md`. |
| `aletheia-node/` | Aletheia StableChain node: Rust Cargo workspace. Spec in `aletheia-node/docs/spec/MASTER.md`, progress in `aletheia-node/docs/STATUS.md`. |
| `aletheia-ace/` | ACE, the Aletheia Compute Engine (Rust): builds the node from a pinned GitLab commit, supervises it, verifies its RPC, takes and restores checkpoints. See `aletheia-ace/README.md`. |
| `aletheia-explorer/` | Aletheia Explorer, "The Public Ledger" (spec Section 41A). Not started; Phase 12C. |

All work lands on the `main` branch.

## Web platform

```sh
cd aletheia-web
npm install
npm run dev
```

## StableChain node

Requires the Rust toolchain pinned in `aletheia-node/rust-toolchain.toml` (rustup installs it
automatically).

```sh
cd aletheia-node
cargo test --workspace --locked                 # memory backend only, no C++ toolchain
cargo test --workspace --all-features --locked  # includes RocksDB; needs clang/libclang
./scripts/lint.sh
```

On Windows, RocksDB needs LLVM (`winget install LLVM.LLVM`) with `LIBCLANG_PATH` set to
`C:\Program Files\LLVMin` and that directory on `PATH`.
