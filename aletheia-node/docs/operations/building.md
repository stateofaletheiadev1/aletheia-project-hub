# Building aletheia-node on a developer machine

## Toolchain

- Rust stable (see `rust-toolchain.toml`), with rustfmt and clippy.
- LLVM, for `libclang` (the RocksDB bindings are generated with bindgen). On Windows install
  it under `C:\Program Files\LLVM`.
- A C++ compiler: Visual Studio Build Tools on Windows, GCC or Clang elsewhere.

## RocksDB, built once (ADR-059)

RocksDB is compiled once, outside `target/`, and linked from there:

```sh
bash scripts/rocksdb-prebuilt.sh          # one-time build, about 10 minutes
bash scripts/rocksdb-prebuilt.sh --check  # verify the library and the cargo config
```

Then add to the per-user `~/.cargo/config.toml` (the script prints the exact lines):

```toml
[env]
LIBCLANG_PATH = "C:\Program Files\LLVM\bin"
ROCKSDB_LIB_DIR = "C:\Users\<you>\.aletheia-deps\rocksdb-<version>\lib"
ROCKSDB_STATIC = "1"
```

After a `librocksdb-sys` version bump, `--check` fails until the script is run again.

## Gates before every commit

```sh
cargo fmt --all
cargo clippy --workspace --all-targets --all-features
cargo test --workspace --all-features --no-fail-fast
bash scripts/lint.sh
```

Run one cargo command at a time on a target directory. If an editor's language server runs
cargo checks, give it its own target directory (for rust-analyzer:
`"rust-analyzer.cargo.targetDir": true`).
