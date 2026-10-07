//! The Arno compiler (spec Sections 25-27).
//!
//! ```text
//! source → lexer → parser → AST → name resolution → type, coins and effect checks
//!        → semantic checks → IR → codegen → verifier → .arnobc package
//! ```
//!
//! [`compile`] runs the whole pipeline. The bytecode verifier the VM runs at deployment also
//! runs on every package this compiler produces: output it refuses is a compiler bug,
//! reported as A9001 and never written.

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
pub mod codegen;
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

/// The compiler's identity, recorded in every package.
pub const COMPILER_ID: &str = concat!("arno ", env!("CARGO_PKG_VERSION"));

/// The source hash recorded in packages: BLAKE3 in key-derivation mode over the source bytes.
pub fn source_hash(text: &str) -> aletheia_core::Hash32 {
    let mut hasher = blake3::Hasher::new_derive_key("ALETHEIA/ARNO-SOURCE/v1");
    hasher.update(text.as_bytes());
    aletheia_core::Hash32::from_bytes(*hasher.finalize().as_bytes())
}

/// Compiles one file to package bytes. The same source and compiler version always give the
/// same bytes (Section 26).
pub fn compile(file: &SourceFile) -> Result<Vec<u8>, Vec<Diagnostic>> {
    let (program, diagnostics) = check_source(file);
    let Some(program) = program else {
        return Err(diagnostics);
    };
    let mut diagnostics = Diagnostics::default();
    let package = codegen::generate(
        &program,
        COMPILER_ID,
        source_hash(file.text()),
        &mut diagnostics,
    );
    let Some(package) = package else {
        if diagnostics.is_empty() {
            diagnostics.error("A9001", Span::default(), "Internal compiler error: code generation failed. Please report this with the source file.");
        }
        return Err(diagnostics.into_sorted());
    };
    if let Err(error) = aletheia_vm::verify(&package) {
        diagnostics.error(
            "A9001",
            Span::default(),
            format!("Internal compiler error: the bytecode verifier refused the output ({}). Please report this with the source file.", error.detail()),
        );
        return Err(diagnostics.into_sorted());
    }
    Ok(package.to_bytes())
}
