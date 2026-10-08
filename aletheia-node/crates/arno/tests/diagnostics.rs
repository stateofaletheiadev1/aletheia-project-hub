//! Compiler messages (spec Section 25.7): every file in `tests/arno/diagnostics/` is
//! compiled and its rendered messages must equal the `.expected` file beside it, exactly.
//! `ARNO_BLESS=1` rewrites the expectations (review the diff before committing).
//!
//! The reference contracts in `examples/arno/` must check with no messages at all.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic
)]

use std::path::PathBuf;

use aletheia_arno::{SourceFile, check_source};

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn render(path: &std::path::Path) -> String {
    let name = path.file_name().unwrap().to_string_lossy().into_owned();
    let file = SourceFile::new(name, std::fs::read_to_string(path).unwrap());
    let (_, diagnostics) = check_source(&file);
    diagnostics
        .iter()
        .map(|d| d.render(&file))
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn every_diagnostic_file_produces_exactly_its_expected_messages() {
    let dir = root().join("tests/arno/diagnostics");
    let mut sources: Vec<PathBuf> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|e| e == "arno"))
        .collect();
    sources.sort();
    assert!(
        sources.len() >= 8,
        "the eight mandated messages each have a file"
    );
    let bless = std::env::var_os("ARNO_BLESS").is_some();
    let mut failures = Vec::new();
    for source in sources {
        let actual = render(&source);
        let expected_path = source.with_extension("expected");
        if bless {
            std::fs::write(&expected_path, format!("{actual}\n")).unwrap();
            continue;
        }
        let expected = std::fs::read_to_string(&expected_path).unwrap_or_default();
        if expected.trim_end() != actual {
            failures.push(format!(
                "{}:\n  expected: {}\n  actual:   {}",
                source.display(),
                expected.trim_end(),
                actual
            ));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

#[test]
fn the_reference_contracts_check_cleanly() {
    for path in [
        root().join("examples/arno/escrow.arno"),
        root().join("examples/arno/payroll.arno"),
        root().join("tests/arno/ok/features.arno"),
    ] {
        let name = path.display().to_string();
        let rendered = render(&path);
        assert!(rendered.is_empty(), "{name}:\n{rendered}");
    }
}

#[test]
fn a_clean_contract_yields_its_typed_program() {
    let path = root().join("tests/arno/ok/features.arno");
    let file = SourceFile::new("features.arno", std::fs::read_to_string(path).unwrap());
    let (program, diagnostics) = check_source(&file);
    assert!(diagnostics.is_empty());
    let program = program.expect("a checked program");
    assert_eq!(program.routines.len(), 9);
    assert_eq!(program.storage.len(), 7);
    assert_eq!(program.enums[0].variants, ["Viewer", "Spender", "Admin"]);
    let pay = program.routines.iter().find(|r| r.name == "pay").unwrap();
    assert_eq!(
        pay.effects_mask(),
        1 | 4 | 8,
        "changes storage, sends coins, emits events"
    );
}

proptest::proptest! {
    #![proptest_config(proptest::prelude::ProptestConfig::with_cases(512))]

    /// Every check survives arbitrary programs built from real Arno words.
    #[test]
    fn the_checks_never_panic(words in proptest::collection::vec(
        proptest::sample::select(vec![
            "contract T { version 0.1;", "uses Coins, Auth, Chain, Math;", "private UInt64 s;",
            "private Vault of AEY v;", "private List of UInt8 max 3 l;",
            "private Map of Address to UInt128 m;", "error E \"e\";", "event Ev(UInt64 a);",
            "public function p(Signer caller, Coins of AEY c)", "public view function f() returns UInt64",
            "changes storage,", "sends coins", "receives coins", "{", "}", "UInt64 x;",
            "Coins of AEY k;", "x = 1;", "s = x;", "k = v.withdrawAll;", "v.deposit(move c);",
            "v.deposit(move k);", "transfer(move k, caller.address);", "if x > 0 {", "} else {",
            "while x > 0 at most 3 times {", "for each y in l {", "for i from 1 to 3 {",
            "require x is 1 otherwise E;", "fail E;", "emit Ev(x);", "return;", "return f();",
            "p(caller, move c);", "return Chain.slot;", "switch x { case 1 -> x = 2; }",
            "x = UInt64(s);",
        ]),
        0..60,
    )) {
        let _ = check_source(&SourceFile::new("fuzz.arno", words.join("\n")));
    }
}
