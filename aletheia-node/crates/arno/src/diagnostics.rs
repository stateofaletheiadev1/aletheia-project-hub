//! Compiler messages (spec Section 25.7): file, line, column, a stable code and a plain
//! English sentence.
//!
//! ```text
//! escrow.arno(31,21): error A2004: 'Deposit' was already moved on line 30 and cannot be used again.
//! ```
//!
//! Code ranges: A1xxx lexical and syntax, A2xxx coins (linearity), A3xxx effects and
//! directives, A4xxx loops and names, A5xxx types, A6xxx routines and calls.

use crate::source::{SourceFile, Span};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diagnostic {
    pub severity: Severity,
    /// Stable code, for example `A2004`.
    pub code: &'static str,
    pub span: Span,
    pub message: String,
}

impl Diagnostic {
    pub fn error(code: &'static str, span: Span, message: impl Into<String>) -> Diagnostic {
        Diagnostic {
            severity: Severity::Error,
            code,
            span,
            message: message.into(),
        }
    }

    /// `name(line,col): error CODE: message`, with 1-based line and character column.
    pub fn render(&self, file: &SourceFile) -> String {
        let (line, column) = file.line_column(self.span.start);
        let severity = match self.severity {
            Severity::Error => "error",
        };
        format!(
            "{}({line},{column}): {severity} {}: {}",
            file.name(),
            self.code,
            self.message
        )
    }
}

/// Collects diagnostics, bounded so a pathological input cannot produce unbounded output.
#[derive(Debug, Clone, Default)]
pub struct Diagnostics {
    items: Vec<Diagnostic>,
}

/// Most diagnostics reported for one compilation.
pub const MAX_DIAGNOSTICS: usize = 200;

impl Diagnostics {
    pub fn push(&mut self, diagnostic: Diagnostic) {
        if self.items.len() < MAX_DIAGNOSTICS {
            self.items.push(diagnostic);
        }
    }

    pub fn error(&mut self, code: &'static str, span: Span, message: impl Into<String>) {
        self.push(Diagnostic::error(code, span, message));
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn has_errors(&self) -> bool {
        self.items.iter().any(|d| d.severity == Severity::Error)
    }

    /// In source order, then by code, so output is deterministic.
    pub fn into_sorted(mut self) -> Vec<Diagnostic> {
        self.items
            .sort_by(|a, b| (a.span.start, a.code).cmp(&(b.span.start, b.code)));
        self.items
    }

    pub fn iter(&self) -> impl Iterator<Item = &Diagnostic> {
        self.items.iter()
    }
}
