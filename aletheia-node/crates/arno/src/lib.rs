//! The Arno compiler (spec Sections 25-27).
//!
//! ```text
//! source → lexer → parser → AST → name resolution → type, coins and effect checks
//!        → semantic checks → IR → codegen → verifier → .arnobc package
//! ```
//!
//! Implemented so far: the front end and every check (names, types, coins, effects, loop
//! bounds, recursion). Code generation and packaging follow.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing
    )
)]

pub mod ast;
pub mod check;
pub mod diagnostics;
pub mod effects;
pub mod hir;
pub mod lexer;
pub mod linear;
pub mod parser;
pub mod source;
pub mod types;

pub use diagnostics::{Diagnostic, Diagnostics, Severity};
pub use source::{SourceFile, Span};

/// Lexes and parses one file. The unit is `None` only when the file is too broken for a tree.
pub fn parse_source(file: &SourceFile) -> (Option<ast::Unit>, Vec<Diagnostic>) {
    let mut diagnostics = Diagnostics::default();
    let tokens = lexer::lex(file.text(), &mut diagnostics);
    let unit = parser::parse(&tokens, &mut diagnostics);
    (unit, diagnostics.into_sorted())
}

/// Runs every check on one file: lexing, parsing, names and types, then the coins and effect
/// rules. Returns the checked program only when there are no errors.
pub fn check_source(file: &SourceFile) -> (Option<hir::Program>, Vec<Diagnostic>) {
    let mut diagnostics = Diagnostics::default();
    let tokens = lexer::lex(file.text(), &mut diagnostics);
    let program = parser::parse(&tokens, &mut diagnostics)
        .filter(|_| !diagnostics.has_errors())
        .and_then(|unit| check::check(&unit, &mut diagnostics));
    if let Some(program) = &program {
        linear::check(program, file, &mut diagnostics);
        effects::check(program, &mut diagnostics);
    }
    let program = program.filter(|_| !diagnostics.has_errors());
    (program, diagnostics.into_sorted())
}
