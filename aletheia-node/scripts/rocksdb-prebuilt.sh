#!/usr/bin/env bash
# Builds RocksDB once, optimised, from the exact librocksdb-sys version in Cargo.lock, into a
# directory outside target/. Cargo then links it instead of compiling RocksDB's C++ in every
# target directory, so `cargo clean`, feature changes and interrupted builds never force the
# C++ build again (ADR-059).
#
#   bash scripts/rocksdb-prebuilt.sh          build (skips if already built)
#   bash scripts/rocksdb-prebuilt.sh --check  only verify the prebuilt library and cargo config
#
# Destination: ${ALETHEIA_DEPS:-$HOME/.aletheia-deps}/rocksdb-<librocksdb-sys version>/lib
# CI builds RocksDB from source as before; this is for developer machines.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
version="$(grep -A1 '^name = "librocksdb-sys"$' "$root/Cargo.lock" | sed -n 's/^version = "\(.*\)"$/\1/p')"
if [ -z "$version" ]; then
  echo "librocksdb-sys is not in Cargo.lock" >&2
  exit 1
fi
deps="${ALETHEIA_DEPS:-$HOME/.aletheia-deps}"
dest="$deps/rocksdb-$version"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) archive="rocksdb.lib" ;;
  *) archive="librocksdb.a" ;;
esac

check() {
  local ok=0
  if [ -f "$dest/lib/$archive" ] && [ "$(cat "$dest/VERSION" 2>/dev/null)" = "$version" ]; then
    echo "prebuilt RocksDB: $dest/lib/$archive (librocksdb-sys $version)"
  else
    echo "prebuilt RocksDB for librocksdb-sys $version is missing: run bash scripts/rocksdb-prebuilt.sh" >&2
    ok=1
  fi
  local config="$HOME/.cargo/config.toml"
  if grep -q "rocksdb-$version" "$config" 2>/dev/null && grep -q '^ROCKSDB_STATIC' "$config"; then
    echo "cargo config: $config points at it"
  else
    echo "cargo config: $config does not point at rocksdb-$version; add:" >&2
    print_config >&2
    ok=1
  fi
  return $ok
}

print_config() {
  local lib_dir="$dest/lib"
  if command -v cygpath >/dev/null; then
    lib_dir="$(cygpath -w "$lib_dir" | sed 's/\\/\\\\/g')"
  fi
  cat <<EOF
[env]
ROCKSDB_LIB_DIR = "$lib_dir"
ROCKSDB_STATIC = "1"
EOF
}

if [ "${1:-}" = "--check" ]; then
  check
  exit $?
fi

if [ -f "$dest/lib/$archive" ] && [ "$(cat "$dest/VERSION" 2>/dev/null)" = "$version" ]; then
  echo "already built: $dest"
  check || true
  exit 0
fi

# A throwaway target directory; the C++ objects never land in the working target/.
build_dir="$root/target/rocksdb-prebuild"
echo "building RocksDB from librocksdb-sys $version (release, lz4 + zstd) in $build_dir"
(
  cd "$root"
  # Compile even if ROCKSDB_LIB_DIR is already configured (a rebuild after a version bump).
  ROCKSDB_COMPILE=1 CARGO_TARGET_DIR="$build_dir" \
    cargo build --release -p aletheia-storage --features rocksdb
)
built="$(ls -t "$build_dir"/release/build/librocksdb-sys-*/out/"$archive" 2>/dev/null | head -1)"
if [ -z "$built" ]; then
  echo "the build produced no $archive" >&2
  exit 1
fi
mkdir -p "$dest/lib"
cp "$built" "$dest/lib/$archive"
echo "$version" > "$dest/VERSION"
echo "lz4,zstd" > "$dest/FEATURES"
rm -rf "$build_dir"
echo "installed $dest/lib/$archive"
check || true
