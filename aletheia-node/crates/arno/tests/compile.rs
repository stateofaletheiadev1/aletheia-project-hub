//! Compilation end to end (spec Section 26; Phase 8 exit: "reference contracts compile
//! byte-identically across machines").
//!
//! Every reference contract compiles, its package passes the VM's bytecode verifier, and the
//! bytes are the same every time. `tests/arno/golden-hashes.txt` pins each package's code
//! hash; CI compares it on Linux, so a difference between machines or architectures fails
//! the build. `ARNO_BLESS=1` rewrites it after an intended change (review the diff).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::path::PathBuf;

use aletheia_arno::{SourceFile, compile};
use aletheia_vm::{Op, Package, verify_bytes};

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

const REFERENCE: [&str; 3] = [
    "examples/arno/escrow.arno",
    "examples/arno/payroll.arno",
    "tests/arno/ok/features.arno",
];

fn build(path: &str) -> Vec<u8> {
    let full = root().join(path);
    let name = full.file_name().unwrap().to_string_lossy().into_owned();
    let file = SourceFile::new(name, std::fs::read_to_string(&full).unwrap());
    compile(&file).unwrap_or_else(|diagnostics| {
        panic!(
            "{path} does not compile:\n{}",
            diagnostics
                .iter()
                .map(|d| d.render(&file))
                .collect::<Vec<_>>()
                .join("\n")
        )
    })
}

#[test]
fn reference_contracts_compile_to_verified_packages() {
    for path in REFERENCE {
        let bytes = build(path);
        let package = verify_bytes(&bytes).unwrap_or_else(|e| panic!("{path}: {e}"));
        assert!(!package.functions.is_empty(), "{path}");
        assert!(package.compiler.starts_with("arno "), "{path}");
    }
}

#[test]
fn the_same_source_always_gives_the_same_bytes() {
    for path in REFERENCE {
        assert_eq!(build(path), build(path), "{path}");
    }
}

#[test]
fn package_hashes_match_the_committed_golden_file() {
    let golden = root().join("tests/arno/golden-hashes.txt");
    let actual: String = REFERENCE
        .iter()
        .map(|path| {
            let package = Package::from_bytes(&build(path)).unwrap();
            format!("{} {}\n", package.code_hash(), path)
        })
        .collect();
    if std::env::var_os("ARNO_BLESS").is_some() {
        std::fs::write(&golden, &actual).unwrap();
        return;
    }
    let expected = std::fs::read_to_string(&golden).unwrap_or_default();
    assert_eq!(
        expected, actual,
        "package bytes changed; if intended, rerun with ARNO_BLESS=1"
    );
}

#[test]
fn the_escrow_package_looks_like_its_source() {
    let package = Package::from_bytes(&build("examples/arno/escrow.arno")).unwrap();
    let names: Vec<_> = package
        .functions
        .iter()
        .map(|f| package.text(f.name).unwrap().to_owned())
        .collect();
    assert_eq!(names, ["Create", "Fund", "Release", "Refund", "Status"]);
    assert_eq!(package.text(package.name), Some("Escrow"));
    assert_eq!(package.errors.len(), 4);
    assert_eq!(package.events.len(), 3);
    assert_eq!(
        package.storage.len(),
        6,
        "Buyer, Seller, Arbiter, Deadline, Safe, State"
    );
    // Release withdraws and transfers: its code holds both instructions.
    let release = &package.functions[2];
    let start = usize::try_from(release.code_offset).unwrap();
    let end = start + usize::try_from(release.code_len).unwrap();
    let ops: Vec<Op> = package.code[start..end]
        .chunks_exact(4)
        .map(|w| {
            aletheia_vm::Instr::decode(w.try_into().unwrap())
                .unwrap()
                .op
        })
        .collect();
    assert!(
        ops.contains(&Op::VWithdrawAll) && ops.contains(&Op::Transfer),
        "{ops:?}"
    );
}

#[test]
fn errors_stop_compilation_with_diagnostics() {
    let file = SourceFile::new(
        "bad.arno",
        "contract Bad; version 0.1; procedure P; var X: UInt64; begin X := Y; end; end.",
    );
    let diagnostics = compile(&file).unwrap_err();
    assert_eq!(diagnostics[0].code, "A6005");
}

/// A random, always well-typed statement over locals X, Y, I (UInt64), B (Boolean), storage S
/// and event Ev, nested at most `depth` deep.
fn statement(seed: &mut u64, depth: u32) -> String {
    let mut next = |n: u64| {
        *seed ^= *seed << 13;
        *seed ^= *seed >> 7;
        *seed ^= *seed << 17;
        *seed % n
    };
    let operand = |k: u64| ["X", "Y", "S", "1", "7", "1000"][usize::try_from(k % 6).unwrap()];
    let op = |k: u64| ["+", "-", "*", "div", "mod"][usize::try_from(k % 5).unwrap()];
    let cmp = |k: u64| ["=", "<>", "<", "<=", ">", ">="][usize::try_from(k % 6).unwrap()];
    let choice = if depth == 0 { next(5) } else { next(11) };
    let (a, b, c, d) = (next(6), next(5), next(6), next(6));
    match choice {
        0 => format!("X := {} {} {}", operand(a), op(b), operand(c)),
        1 => format!("Y := {}", operand(a)),
        2 => format!("S := {}", operand(a)),
        3 => format!("B := ({} {} {}) and not B", operand(a), cmp(b), operand(c)),
        4 => format!(
            "require {} {} {} otherwise E",
            operand(a),
            cmp(d),
            operand(c)
        ),
        5 => format!(
            "if {} {} {} then {} else {}",
            operand(a),
            cmp(b),
            operand(c),
            statement(seed, depth - 1),
            statement(seed, depth - 1)
        ),
        6 => format!(
            "while X > 0 at most {} times do begin X := X - 1; {} end",
            1 + a,
            statement(seed, depth - 1)
        ),
        7 => format!("for I := 1 to {} do {}", 1 + a, statement(seed, depth - 1)),
        8 => format!(
            "case X of 1: {}; 2, 3: Y := 2; else Y := 0; end",
            statement(seed, depth - 1)
        ),
        9 => format!("emit Ev({})", operand(a)),
        _ => format!(
            "begin {}; {} end",
            statement(seed, depth - 1),
            statement(seed, depth - 1)
        ),
    }
}

proptest::proptest! {
    #![proptest_config(proptest::prelude::ProptestConfig::with_cases(400))]

    /// Every well-typed program compiles, and the verifier accepts what the code generator
    /// emits: the two never disagree (an A9001 would be a compiler bug).
    #[test]
    fn well_typed_programs_always_compile_to_verified_code(seed in 1u64.., count in 1usize..8) {
        let mut state = seed;
        let body: Vec<String> = (0..count).map(|_| statement(&mut state, 3)).collect();
        let text = format!(
            "contract R; version 0.1;\nerrors E = 'e';\nevents Ev(V: UInt64);\nstorage S: UInt64;\n\
             procedure P; changes storage, emits events;\nvar X, Y, I: UInt64; B: Boolean;\nbegin\n{};\nend;\nend.",
            body.join(";\n")
        );
        let file = SourceFile::new("random.arno", text);
        match compile(&file) {
            Ok(bytes) => { verify_bytes(&bytes).unwrap(); }
            Err(diagnostics) => {
                let rendered: Vec<String> = diagnostics.iter().map(|d| d.render(&file)).collect();
                proptest::prop_assert!(false, "{}\n{}", file.text(), rendered.join("\n"));
            }
        }
    }
}
