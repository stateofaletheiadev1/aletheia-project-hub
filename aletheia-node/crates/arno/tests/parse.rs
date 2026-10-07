//! The parser against the spec's reference contracts (Sections 25.2, 25.3) and its error
//! recovery.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic
)]

use aletheia_arno::ast::{Directive, Effect, ExprKind, RoutineKind, StmtKind, TypeDef};
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
        "Buyer, Seller, Arbiter share one group"
    );
    let names: Vec<_> = unit.routines.iter().map(|r| r.name.name.as_str()).collect();
    assert_eq!(names, ["Create", "Fund", "Release", "Refund", "Status"]);
    let fund = &unit.routines[1];
    assert_eq!(fund.kind, RoutineKind::Procedure);
    assert!(fund.has(Directive::Entry));
    assert!(fund.declares(Effect::ReceivesCoins) && fund.declares(Effect::EmitsEvents));
    assert!(unit.routines[4].has(Directive::View));
    // `Safe.Deposit(move Deposit)` is a call with a move argument.
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
        "contract T; version 0.1; procedure P; begin require A > 0 and B > 0 otherwise E; end; end.",
    );
    let unit = parse_source(&file).0.unwrap();
    let StmtKind::Require { cond, .. } = &unit.routines[0].body.stmts[0].kind else {
        panic!("not a require");
    };
    assert!(matches!(
        &cond.kind,
        ExprKind::Binary(aletheia_arno::ast::BinaryOp::And, _, _)
    ));
}

#[test]
fn a_while_loop_without_a_bound_gets_the_plain_english_message() {
    let file = SourceFile::new(
        "payroll.arno",
        "contract T; version 0.1;\nprocedure P;\nbegin\n  while X > 0 do X := X - 1;\nend;\nend.",
    );
    let (_, diagnostics) = parse_source(&file);
    assert_eq!(diagnostics.len(), 1);
    assert_eq!(
        diagnostics[0].render(&file),
        "payroll.arno(4,3): error A4002: This while-loop needs a bound, for example 'at most 100 times'."
    );
}

#[test]
fn one_mistake_does_not_hide_the_next() {
    // Two separate missing semicolons, in two routines: both reported, parsing continues.
    let text = "contract T; version 0.1;\nprocedure A; begin X := 1 Y := 2; end;\nprocedure B; begin Z := 3 W := 4; end;\nend.";
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
        codes("contract T; version 0.1; procedure P; begin end;"),
        ["A1103"]
    );
    assert_eq!(codes("contract T; version 0.1; end. extra"), ["A1104"]);
    assert_eq!(codes("contract T; version 0.1; var begin; end."), ["A1101"]);
    assert_eq!(
        codes("contract T; version 0.1; procedure P; begin if A < B < C then exit; end; end."),
        ["A1108"]
    );
    assert!(codes("contract Begin; version 0.1; end.").contains(&"A1102"));
}

#[test]
fn deep_nesting_is_refused_not_overflowed() {
    let deep = format!(
        "contract T; version 0.1; procedure P; begin X := {}1{}; end; end.",
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
            "contract", "T", ";", "version", "0", ".", "1", "procedure", "begin", "end", "if",
            "then", "else", "while", "at", "most", "times", "do", "for", "each", "in", ":=",
            "(", ")", "[", "]", ",", ":", "require", "otherwise", "emit", "move", "X", "+",
            "and", "not", "case", "of", "List", "max", "record", "type", "=", "'t'", "storage",
        ]),
        0..120,
    )) {
        let _ = parse_source(&SourceFile::new("fuzz.arno", words.join(" ")));
    }
}
