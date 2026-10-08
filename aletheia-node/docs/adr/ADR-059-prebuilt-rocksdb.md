# ADR-059: Prebuilt RocksDB on developer machines
Status: Accepted
Date: 2026-10-08
Context: RocksDB stays the production key-value backend (Sections 5.1, 42.2). The
`librocksdb-sys` crate compiles RocksDB's C++ sources inside every target directory, which
takes several minutes and hundreds of megabytes per build configuration. On Windows
developer machines that build repeatedly broke: an interrupted or overlapping build left
cargo's records saying the library was built while the `.rlib` was gone ("crate
`librocksdb_sys` required to be available in rlib format"), and the only repair was a full
C++ rebuild. Its build script also rebuilds whenever any file under its bundled sources
changes time stamp.
Decision:
  1. `scripts/rocksdb-prebuilt.sh` builds RocksDB once, with release optimisation, from the
     exact `librocksdb-sys` version in `Cargo.lock` and the same features (lz4, zstd), into
     `~/.aletheia-deps/rocksdb-<version>/lib`, outside every target directory.
  2. Developer machines point cargo at it in the per-user `~/.cargo/config.toml`
     (`ROCKSDB_LIB_DIR`, `ROCKSDB_STATIC = "1"`), together with `LIBCLANG_PATH` for the
     bindings, so every cargo invocation (shell, editor, language server) sees the same
     settings and none of them triggers a rebuild. The build script then only generates
     bindings from the bundled headers of the same version and links the prebuilt archive.
  3. The library is the same RocksDB version and configuration that the crate would build;
     only where it is compiled changes. The `KvStore` conformance suite runs against it.
  4. A version bump of `librocksdb-sys` changes the directory name, so a stale library is
     never linked: `bash scripts/rocksdb-prebuilt.sh --check` reports the mismatch and the
     script builds the new one.
  5. CI and release builds keep compiling RocksDB from source, unchanged.
Consequences: `cargo clean` no longer costs a RocksDB rebuild, and test builds link an
optimised RocksDB. A developer machine needs the one-time build and the config lines;
`docs/operations/building.md` lists them.
