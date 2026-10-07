//! The Arno compiler (spec Sections 25-27).
//!
//! ```text
//! source → lexer → parser → AST → name resolution → type, coins and effect checks
//!        → semantic checks → IR → codegen → verifier → .arnobc package
//! ```
//!
//! Implemented so far: the lexer, the parser and the diagnostics they produce. The checks,
//! code generation and packaging follow.

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
pub mod diagnostics;
pub mod lexer;
pub mod parser;
pub mod source;

pub use diagnostics::{Diagnostic, Diagnostics, Severity};
pub use source::{SourceFile, Span};

/// Lexes and parses one file. The unit is `None` only when the file is too broken for a tree.
pub fn parse_source(file: &SourceFile) -> (Option<ast::Unit>, Vec<Diagnostic>) {
    let mut diagnostics = Diagnostics::default();
    let tokens = lexer::lex(file.text(), &mut diagnostics);
    let unit = parser::parse(&tokens, &mut diagnostics);
    (unit, diagnostics.into_sorted())
}
