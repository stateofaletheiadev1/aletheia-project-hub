//! The committed vectors in `tests/vectors/` must equal what the implementation produces.
//!
//! To regenerate after an intended protocol change (which also needs a protocol-version
//! decision, Section 44.2): `ALETHEIA_WRITE_VECTORS=1 cargo test -p aletheia-conformance`.
//! Review the diff like any other protocol change.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::path::PathBuf;

fn vectors_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("vectors")
}

#[test]
fn committed_vectors_match_the_implementation() {
    let write = std::env::var_os("ALETHEIA_WRITE_VECTORS").is_some();
    let mut stale = Vec::new();
    for (relative, contents) in aletheia_conformance::vectors::all() {
        let path = vectors_dir().join(relative);
        let mut expected = serde_json::to_string_pretty(&contents).unwrap();
        expected.push('\n');
        if write {
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, &expected).unwrap();
            continue;
        }
        match std::fs::read_to_string(&path) {
            Ok(committed) if committed.replace("\r\n", "\n") == expected => {}
            Ok(_) => stale.push(format!("{relative}: differs from the implementation")),
            Err(error) => stale.push(format!("{relative}: {error}")),
        }
    }
    assert!(
        stale.is_empty(),
        "vectors out of date (regenerate with ALETHEIA_WRITE_VECTORS=1 only if the change is intended):\n{}",
        stale.join("\n")
    );
}

#[test]
fn every_vector_file_records_its_aps() {
    for (relative, contents) in aletheia_conformance::vectors::all() {
        let aps = contents["aps"].as_str().unwrap();
        assert!(
            relative.starts_with(aps),
            "{relative} is filed under the wrong APS ({aps})"
        );
    }
}
