//! Links the Windows system libraries RocksDB's port layer calls (UUIDs, paths).
//! librocksdb-sys declares them only when it compiles RocksDB itself; a prebuilt RocksDB
//! (ADR-059) needs them declared here. Repeating them on a from-source build is harmless.

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    let windows = std::env::var("CARGO_CFG_TARGET_OS").is_ok_and(|os| os == "windows");
    if windows && std::env::var_os("CARGO_FEATURE_ROCKSDB").is_some() {
        println!("cargo:rustc-link-lib=dylib=rpcrt4");
        println!("cargo:rustc-link-lib=dylib=shlwapi");
    }
}
