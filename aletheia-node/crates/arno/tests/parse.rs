//! The parser against the reference contracts (spec Sections 25.2, 25.3, syntax per ADR-049)
//! and its error recovery.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic
)]

use aletheia_arno::ast::{BinaryOp, Directive, Effect, ExprKind, RoutineKind, StmtKind, TypeDef};
use aletheia_arno::{SourceFile, parse_source};

fn example(name: &str) -> SourceFile {
    let path = format!("{}/../../examples/arno/{name}", env!("CARGO_MANIFEST_DIR"));
    SourceFile::new(name, std::fs::read_to_string(path).unwrap())
}

fn codes(text: &str) -> Vec<&'static str> {
    parse_source(&SourceFile::new("t.arno", text))
        .1
        .iter()
        .map(|d| d.code)
        .collect()
}

#[test]
fn the_escrow_contract_parses() {
    let file = example("escrow.arno");
    let (unit, diagnostics) = parse_source(&file);
    assert!(
        diagnostics.is_empty(),
        "{:?}",
        diagnostics
            .iter()
            .map(|d| d.render(&file))
            .collect::<Vec<_>>()
    );
    let unit = unit.unwrap();
    assert_eq!(unit.name.name, "Escrow");
    assert_eq!(unit.version, (0, 1));
    assert_eq!(unit.uses.len(), 3);
    assert!(matches!(&unit.types[0].def, TypeDef::Enum(v) if v.len() == 4));
    assert_eq!(unit.errors.len(), 4);
    assert_eq!(unit.events.len(), 3);
    assert_eq!(
        unit.storage.len(),
        4,
        "buyer, seller, arbiter share one group"
    );
    let names: Vec<_> = unit.routines.iter().map(|r| r.name.name.as_str()).collect();
    assert_eq!(
        names,
        ["constructor", "fund", "release", "refund", "status"]
    );
    let fund = &unit.routines[1];
    assert_eq!(fund.kind, RoutineKind::Procedure);
    assert!(fund.has(Directive::Entry));
    assert!(fund.declares(Effect::ReceivesCoins) && fund.declares(Effect::EmitsEvents));
    assert!(unit.routines[4].has(Directive::View));
    // `safe.deposit(move deposit)` is a call with a move argument.
    let deposit = fund
        .body
        .stmts
        .iter()
        .find_map(|s| match &s.kind {
            StmtKind::Call(e) => Some(e),
            _ => None,
        })
        .unwrap();
    assert!(
        matches!(&deposit.kind, ExprKind::Call { args, .. } if matches!(args[0].kind, ExprKind::Move(_)))
    );
}

#[test]
fn the_payroll_contract_parses() {
    let file = example("payroll.arno");
    let (unit, diagnostics) = parse_source(&file);
    assert!(
        diagnostics.is_empty(),
        "{:?}",
        diagnostics
            .iter()
            .map(|d| d.render(&file))
            .collect::<Vec<_>>()
    );
    let unit = unit.unwrap();
    assert!(matches!(&unit.types[0].def, TypeDef::Record(fields) if fields.len() == 3));
    let pay = &unit.routines[0];
    let loops = pay
        .body
        .stmts
        .iter()
        .filter(|s| matches!(s.kind, StmtKind::ForEach { .. }))
        .count();
    assert_eq!(loops, 2);
}

#[test]
fn comparisons_bind_tighter_than_and() {
    let file = SourceFile::new(
        "t.arno",
        "contract T { version 0.1; private function p() { require a > 0 and b is not 0 otherwise E; } }",
    );
    let unit = parse_source(&file).0.unwrap();
    let StmtKind::Require { cond, .. } = &unit.routines[0].body.stmts[0].kind else {
        panic!("not a require");
    };
    let ExprKind::Binary(BinaryOp::And, _, right) = &cond.kind else {
        panic!("not an 'and'");
    };
    assert!(matches!(
        right.kind,
        ExprKind::Binary(BinaryOp::NotEq, _, _)
    ));
}

#[test]
fn modifiers_choose_entry_view_or_helper() {
    let file = SourceFile::new(
        "t.arno",
        "contract T { version 0.1;\n\
         public function a(Signer s) { }\n\
         public view function b() returns UInt8 { return 1; }\n\
         private function c() { }\n\
         function d() { }\n\
         public reentrant function e(Signer s) { }\n\
         constructor(Signer s) { } }",
    );
    let unit = parse_source(&file).0.unwrap();
    let r = &unit.routines;
    assert!(r[0].has(Directive::Entry) && r[0].kind == RoutineKind::Procedure);
    assert!(r[1].has(Directive::View) && !r[1].has(Directive::Entry));
    assert_eq!(r[1].kind, RoutineKind::Function);
    assert!(r[2].directives.is_empty() && r[3].directives.is_empty());
    assert!(r[4].has(Directive::Entry) && r[4].has(Directive::Reentrant));
    assert_eq!(r[5].kind, RoutineKind::Constructor);
}

#[test]
fn local_declarations_join_the_function_variables() {
    let file = SourceFile::new(
        "t.arno",
        "contract T { version 0.1; private function p() { UInt8 a = 1, b; if a is 1 { Text max 9 c; } for each UInt8 d in xs { } } }",
    );
    let unit = parse_source(&file).0.unwrap();
    let names: Vec<_> = unit.routines[0]
        .vars
        .iter()
        .flat_map(|g| g.names.iter().map(|n| n.name.as_str()))
        .collect();
    assert_eq!(names, ["a", "b", "c", "d"]);
    // `UInt8 a = 1, b;` keeps one assignment in place.
    assert!(matches!(
        unit.routines[0].body.stmts[0].kind,
        StmtKind::Assign { .. }
    ));
}

#[test]
fn a_final_return_is_just_the_result() {
    let file = SourceFile::new(
        "t.arno",
        "contract T { version 0.1; public view function f() returns UInt8 { if x { return 1; } return 2; } }",
    );
    let unit = parse_source(&file).0.unwrap();
    let stmts = &unit.routines[0].body.stmts;
    // The early return assigns and leaves; the last one only assigns.
    let StmtKind::If { then, .. } = &stmts[0].kind else {
        panic!("not an if");
    };
    let StmtKind::Block(inner) = &then.kind else {
        panic!("not a block");
    };
    assert!(matches!(&inner.stmts[0].kind, StmtKind::Block(b) if b.stmts.len() == 2));
    assert!(matches!(stmts[1].kind, StmtKind::Assign { .. }));

    // Returns in a final if/else only assign too; leaving there changes nothing.
    let file = SourceFile::new(
        "t.arno",
        "contract T { version 0.1; public view function f() returns UInt8 { if x { return 1; } else { return 2; } } }",
    );
    let unit = parse_source(&file).0.unwrap();
    let StmtKind::If {
        then,
        otherwise: Some(otherwise),
        ..
    } = &unit.routines[0].body.stmts[0].kind
    else {
        panic!("not an if/else");
    };
    assert!(matches!(then.kind, StmtKind::Assign { .. }));
    assert!(matches!(otherwise.kind, StmtKind::Assign { .. }));
}

#[test]
fn a_while_loop_without_a_bound_gets_the_plain_english_message() {
    let file = SourceFile::new(
        "payroll.arno",
        "contract T {\n    version 0.1;\n    private function p() {\n        while x > 0 { x = x - 1; }\n    }\n}",
    );
    let (_, diagnostics) = parse_source(&file);
    assert_eq!(diagnostics.len(), 1);
    assert_eq!(
        diagnostics[0].render(&file),
        "payroll.arno(4,9): error A4002: This while-loop needs a bound, for example 'at most 100 times'."
    );
}

#[test]
fn one_mistake_does_not_hide_the_next() {
    // Two separate missing semicolons, in two functions: both reported, parsing continues.
    let text = "contract T { version 0.1;\nprivate function a() { x = 1 y = 2; }\nprivate function b() { z = 3 w = 4; }\n}";
    let found = codes(text);
    assert_eq!(
        found.iter().filter(|c| **c == "A1101").count(),
        2,
        "{found:?}"
    );
}

#[test]
fn structural_errors_are_named() {
    assert_eq!(
        codes("contract T { version 0.1; private function p() { }"),
        ["A1103"]
    );
    assert_eq!(codes("contract T { version 0.1; } extra"), ["A1104"]);
    assert_eq!(codes("contract T { version 0.1; + }"), ["A1101"]);
    assert_eq!(
        codes("contract T { version 0.1; private function p() { if a < b < c { return; } } }"),
        ["A1108"]
    );
    assert!(codes("contract return { version 0.1; }").contains(&"A1102"));
    assert_eq!(
        codes("contract T { version 0.1; private view function f() returns UInt8 { return 1; } }"),
        ["A1112"]
    );
    assert_eq!(
        codes("contract T { version 0.1; private function p() { if a != b { return; } } }"),
        ["A1113"]
    );
}

#[test]
fn recovery_always_moves_forward() {
    // A modifier with no function after it once stopped recovery on the same token forever.
    for text in [
        "contract T { version 0.1; view x; }",
        "contract T { version 0.1; reentrant reentrant }",
        "contract T { version 0.1; private function p() { view } }",
        "contract T { version 0.1; public public 1 }",
    ] {
        assert!(!codes(text).is_empty(), "{text}");
    }
}

#[test]
fn deep_nesting_is_refused_not_overflowed() {
    let deep = format!(
        "contract T {{ version 0.1; private function p() {{ x = {}1{}; }} }}",
        "(".repeat(500),
        ")".repeat(500)
    );
    assert!(codes(&deep).contains(&"A1105"));
}

proptest::proptest! {
    /// Arbitrary text never panics the front end.
    #[test]
    fn any_text_parses_or_reports(text in "\\PC{0,300}") {
        let _ = parse_source(&SourceFile::new("fuzz.arno", text));
    }

    /// Random sequences of real tokens never panic it either, and reach deeper paths.
    #[test]
    fn any_token_soup_parses_or_reports(words in proptest::collection::vec(
        proptest::sample::select(vec![
            "contract", "T", ";", "version", "0", ".", "1", "public", "private", "view",
            "function", "constructor", "returns", "return", "{", "}", "if", "else", "while", "at",
            "most", "times", "for", "each", "from", "to", "in", "=", "(", ")", "[", "]", ",",
            "require", "otherwise", "emit", "move", "x", "+", "and", "not", "is", "switch",
            "case", "default", "->", "List", "of", "max", "record", "enum", "type", "\"t\"",
            "UInt8", "error", "event",
        ]),
        0..120,
    )) {
        let _ = parse_source(&SourceFile::new("fuzz.arno", words.join(" ")));
    }
}
