//! The parser (spec Sections 25.6, 26): hand-written recursive descent, precedence climbing
//! for expressions, and error recovery so one mistake does not hide the rest.
//!
//! Expression precedence, lowest first (see `docs/arno/grammar.ebnf`):
//!
//! ```text
//! or xor  <  and  <  = <> < <= > >= (not chained)  <  + -  <  * div mod  <  not, unary -
//! ```
//!
//! Comparisons bind tighter than `and`/`or`, so `X > 0 and Y > 0` reads as written. This
//! departs from classic Pascal on purpose: Arno is meant to read like English.

use crate::ast::{
    BinaryOp, Block, CaseArm, ConstDecl, Directive, Effect, ErrorDecl, EventDecl, Expr, ExprKind,
    FieldGroup, Ident, QualIdent, Routine, RoutineKind, Stmt, StmtKind, TypeDecl, TypeDef,
    TypeExpr, TypeExprKind, UnaryOp, Unit,
};
use crate::diagnostics::Diagnostics;
use crate::lexer::{Keyword, Token, TokenKind};
use crate::source::Span;

/// Deepest nesting of statements and expressions accepted. Bounds recursion on hostile input.
pub const MAX_NESTING: u32 = 64;

/// The error has been reported; the caller recovers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Reported;

type Parse<T> = Result<T, Reported>;

struct Parser<'a> {
    tokens: &'a [Token],
    position: usize,
    diagnostics: &'a mut Diagnostics,
    depth: u32,
}

const EOF: TokenKind = TokenKind::Eof;

impl Parser<'_> {
    fn token(&self) -> Option<&Token> {
        self.tokens.get(self.position)
    }

    fn peek(&self) -> &TokenKind {
        self.token().map_or(&EOF, |t| &t.kind)
    }

    fn peek_at(&self, ahead: usize) -> &TokenKind {
        self.tokens
            .get(self.position.saturating_add(ahead))
            .map_or(&EOF, |t| &t.kind)
    }

    fn span(&self) -> Span {
        self.token()
            .or_else(|| self.tokens.last())
            .map_or(Span::default(), |t| t.span)
    }

    fn previous_span(&self) -> Span {
        self.position
            .checked_sub(1)
            .and_then(|i| self.tokens.get(i))
            .map_or(Span::default(), |t| t.span)
    }

    fn bump(&mut self) -> Span {
        let span = self.span();
        if self.position < self.tokens.len().saturating_sub(1) {
            self.position = self.position.saturating_add(1);
        }
        span
    }

    fn at(&self, kind: &TokenKind) -> bool {
        self.peek() == kind
    }

    fn at_kw(&self, keyword: Keyword) -> bool {
        self.peek() == &TokenKind::Keyword(keyword)
    }

    /// An identifier spelled `word` (case-insensitive): contextual keywords.
    fn at_word(&self, word: &str) -> bool {
        matches!(self.peek(), TokenKind::Ident(name) if name.eq_ignore_ascii_case(word))
    }

    fn eat(&mut self, kind: &TokenKind) -> bool {
        if self.at(kind) {
            self.bump();
            true
        } else {
            false
        }
    }

    fn eat_kw(&mut self, keyword: Keyword) -> bool {
        self.eat(&TokenKind::Keyword(keyword))
    }

    fn eat_word(&mut self, word: &str) -> bool {
        if self.at_word(word) {
            self.bump();
            true
        } else {
            false
        }
    }

    fn error_here(&mut self, expected: &str, context: &str) -> Reported {
        let found = self.peek().describe();
        let span = self.span();
        self.diagnostics.error(
            "A1101",
            span,
            format!("Expected {expected} {context}, but found {found}."),
        );
        Reported
    }

    fn expect(&mut self, kind: &TokenKind, context: &str) -> Parse<Span> {
        if self.at(kind) {
            Ok(self.bump())
        } else {
            Err(self.error_here(&kind.describe(), context))
        }
    }

    fn expect_kw(&mut self, keyword: Keyword, context: &str) -> Parse<Span> {
        self.expect(&TokenKind::Keyword(keyword), context)
    }

    fn expect_word(&mut self, word: &str, context: &str) -> Parse<Span> {
        if self.eat_word(word) {
            Ok(self.previous_span())
        } else {
            Err(self.error_here(&format!("'{word}'"), context))
        }
    }

    fn ident(&mut self, context: &str) -> Parse<Ident> {
        match self.peek().clone() {
            TokenKind::Ident(name) => {
                let span = self.bump();
                Ok(Ident { name, span })
            }
            TokenKind::Keyword(keyword) => {
                let span = self.span();
                self.diagnostics.error(
                    "A1102",
                    span,
                    format!(
                        "'{}' is a reserved word and cannot be used as a name {context}.",
                        keyword.as_str()
                    ),
                );
                Err(Reported)
            }
            _ => Err(self.error_here("a name", context)),
        }
    }

    fn qual_ident(&mut self, context: &str) -> Parse<QualIdent> {
        let first = self.ident(context)?;
        let start = first.span;
        let mut parts = vec![first];
        while self.at(&TokenKind::Dot) && matches!(self.peek_at(1), TokenKind::Ident(_)) {
            self.bump();
            parts.push(self.ident(context)?);
        }
        let span = parts.last().map_or(start, |last| start.to(last.span));
        Ok(QualIdent { parts, span })
    }

    fn enter(&mut self) -> Parse<()> {
        if self.depth >= MAX_NESTING {
            let span = self.span();
            self.diagnostics.error(
                "A1105",
                span,
                format!("This is nested more than {MAX_NESTING} levels deep. Split it into smaller routines."),
            );
            return Err(Reported);
        }
        self.depth = self.depth.saturating_add(1);
        Ok(())
    }

    fn leave(&mut self) {
        self.depth = self.depth.saturating_sub(1);
    }

    /// Skips to the next point a statement list can continue from.
    fn sync_statement(&mut self) {
        while !matches!(
            self.peek(),
            TokenKind::Semicolon
                | TokenKind::Eof
                | TokenKind::Keyword(Keyword::End | Keyword::Else | Keyword::Begin)
        ) {
            self.bump();
        }
    }

    /// Skips to the next declaration, section or routine.
    fn sync_declaration(&mut self) {
        loop {
            match self.peek() {
                TokenKind::Eof
                | TokenKind::Keyword(
                    Keyword::Const
                    | Keyword::Type
                    | Keyword::Errors
                    | Keyword::Events
                    | Keyword::Storage
                    | Keyword::Constructor
                    | Keyword::Procedure
                    | Keyword::Function
                    | Keyword::Begin
                    | Keyword::Var,
                ) => return,
                TokenKind::Semicolon => {
                    self.bump();
                    return;
                }
                _ => {
                    self.bump();
                }
            }
        }
    }

    // ---- units and declarations ----

    fn unit(&mut self) -> Parse<Unit> {
        let start = self.span();
        self.expect_kw(Keyword::Contract, "at the start of the file")?;
        let name = self.ident("after 'contract'")?;
        self.expect(&TokenKind::Semicolon, "after the contract name")?;
        self.expect_kw(Keyword::Version, "after the contract name")?;
        let (version, version_span) = self.version()?;
        self.expect(&TokenKind::Semicolon, "after the version")?;

        let mut uses = Vec::new();
        if self.eat_kw(Keyword::Uses) {
            while let Ok(unit) = self.qual_ident("in the uses list") {
                uses.push(unit);
                if !self.eat(&TokenKind::Comma) {
                    break;
                }
            }
            if self
                .expect(&TokenKind::Semicolon, "after the uses list")
                .is_err()
            {
                self.sync_declaration();
            }
        }

        let mut unit = Unit {
            name,
            version,
            version_span,
            uses,
            consts: Vec::new(),
            types: Vec::new(),
            errors: Vec::new(),
            events: Vec::new(),
            storage: Vec::new(),
            routines: Vec::new(),
            span: start,
        };
        loop {
            match self.peek() {
                TokenKind::Keyword(Keyword::Const) => {
                    self.bump();
                    self.const_section(&mut unit.consts);
                }
                TokenKind::Keyword(Keyword::Type) => {
                    self.bump();
                    self.type_section(&mut unit.types);
                }
                TokenKind::Keyword(Keyword::Errors) => {
                    self.bump();
                    self.errors_section(&mut unit.errors);
                }
                TokenKind::Keyword(Keyword::Events) => {
                    self.bump();
                    self.events_section(&mut unit.events);
                }
                TokenKind::Keyword(Keyword::Storage) => {
                    self.bump();
                    self.field_section(&mut unit.storage, "in the storage section");
                }
                TokenKind::Keyword(
                    Keyword::Constructor | Keyword::Procedure | Keyword::Function,
                ) => match self.routine() {
                    Ok(routine) => unit.routines.push(routine),
                    Err(Reported) => self.sync_declaration(),
                },
                TokenKind::Keyword(Keyword::End) => break,
                TokenKind::Eof => {
                    let span = self.span();
                    self.diagnostics.error(
                        "A1103",
                        span,
                        "The contract must end with 'end.' after its last routine.",
                    );
                    return Err(Reported);
                }
                _ => {
                    let _ = self.error_here(
                        "a section (const, type, errors, events, storage) or a routine",
                        "here",
                    );
                    // One report, then straight to the next thing that can start here.
                    while !matches!(
                        self.peek(),
                        TokenKind::Eof
                            | TokenKind::Keyword(
                                Keyword::Const
                                    | Keyword::Type
                                    | Keyword::Errors
                                    | Keyword::Events
                                    | Keyword::Storage
                                    | Keyword::Constructor
                                    | Keyword::Procedure
                                    | Keyword::Function
                                    | Keyword::End
                            )
                    ) {
                        self.bump();
                    }
                }
            }
        }
        self.expect_kw(Keyword::End, "at the end of the contract")?;
        let end = self.expect(&TokenKind::Dot, "after the final 'end'")?;
        if !self.at(&TokenKind::Eof) {
            let span = self.span();
            self.diagnostics.error(
                "A1104",
                span,
                "Nothing may follow the final 'end.' of a contract.",
            );
        }
        unit.span = start.to(end);
        Ok(unit)
    }

    fn version(&mut self) -> Parse<((u16, u16), Span)> {
        let start = self.span();
        let part = |parser: &mut Parser<'_>| -> Parse<u16> {
            match parser.peek().clone() {
                TokenKind::Int(value) => {
                    let span = parser.bump();
                    u16::try_from(value).map_err(|_| {
                        parser.diagnostics.error(
                            "A1106",
                            span,
                            "A version number part must be at most 65535.",
                        );
                        Reported
                    })
                }
                _ => Err(parser.error_here("a version such as 0.1", "after 'version'")),
            }
        };
        let major = part(self)?;
        self.expect(&TokenKind::Dot, "in the version number")?;
        let minor = part(self)?;
        Ok(((major, minor), start.to(self.previous_span())))
    }

    fn const_section(&mut self, out: &mut Vec<ConstDecl>) {
        while matches!(self.peek(), TokenKind::Ident(_)) {
            let declaration = (|| -> Parse<ConstDecl> {
                let name = self.ident("for a constant")?;
                self.expect(&TokenKind::Eq, "after the constant name")?;
                let value = self.expr()?;
                self.expect(&TokenKind::Semicolon, "after the constant")?;
                Ok(ConstDecl { name, value })
            })();
            match declaration {
                Ok(declaration) => out.push(declaration),
                Err(Reported) => self.sync_declaration(),
            }
        }
    }

    fn type_section(&mut self, out: &mut Vec<TypeDecl>) {
        while matches!(self.peek(), TokenKind::Ident(_)) {
            let declaration = (|| -> Parse<TypeDecl> {
                let name = self.ident("for a type")?;
                self.expect(&TokenKind::Eq, "after the type name")?;
                let def = if self.eat(&TokenKind::LParen) {
                    let mut variants = vec![self.ident("in the enumeration")?];
                    while self.eat(&TokenKind::Comma) {
                        variants.push(self.ident("in the enumeration")?);
                    }
                    self.expect(&TokenKind::RParen, "to close the enumeration")?;
                    TypeDef::Enum(variants)
                } else if self.eat_kw(Keyword::Record) {
                    let mut fields = Vec::new();
                    self.field_section(&mut fields, "in the record");
                    self.expect_kw(Keyword::End, "to close the record")?;
                    TypeDef::Record(fields)
                } else {
                    TypeDef::Alias(self.type_expr()?)
                };
                self.expect(&TokenKind::Semicolon, "after the type")?;
                Ok(TypeDecl { name, def })
            })();
            match declaration {
                Ok(declaration) => out.push(declaration),
                Err(Reported) => self.sync_declaration(),
            }
        }
    }

    fn errors_section(&mut self, out: &mut Vec<ErrorDecl>) {
        while matches!(self.peek(), TokenKind::Ident(_)) {
            let declaration = (|| -> Parse<ErrorDecl> {
                let name = self.ident("for an error")?;
                self.expect(&TokenKind::Eq, "after the error name")?;
                let message_span = self.span();
                let TokenKind::Str(message) = self.peek().clone() else {
                    return Err(self.error_here("an English message in quotes", "for the error"));
                };
                self.bump();
                self.expect(&TokenKind::Semicolon, "after the error message")?;
                Ok(ErrorDecl {
                    name,
                    message,
                    message_span,
                })
            })();
            match declaration {
                Ok(declaration) => out.push(declaration),
                Err(Reported) => self.sync_declaration(),
            }
        }
    }

    fn events_section(&mut self, out: &mut Vec<EventDecl>) {
        while matches!(self.peek(), TokenKind::Ident(_)) {
            let declaration = (|| -> Parse<EventDecl> {
                let name = self.ident("for an event")?;
                let params = if self.at(&TokenKind::LParen) {
                    self.params()?
                } else {
                    Vec::new()
                };
                self.expect(&TokenKind::Semicolon, "after the event")?;
                Ok(EventDecl { name, params })
            })();
            match declaration {
                Ok(declaration) => out.push(declaration),
                Err(Reported) => self.sync_declaration(),
            }
        }
    }

    /// `A, B: T;` groups while the next token is a name (storage, records, `var`).
    fn field_section(&mut self, out: &mut Vec<FieldGroup>, context: &str) {
        while matches!(self.peek(), TokenKind::Ident(_)) {
            let group = (|| -> Parse<FieldGroup> {
                let group = self.field_group(context)?;
                self.expect(
                    &TokenKind::Semicolon,
                    &format!("after the declaration {context}"),
                )?;
                Ok(group)
            })();
            match group {
                Ok(group) => out.push(group),
                Err(Reported) => self.sync_declaration(),
            }
        }
    }

    fn field_group(&mut self, context: &str) -> Parse<FieldGroup> {
        let mut names = vec![self.ident(context)?];
        while self.eat(&TokenKind::Comma) {
            names.push(self.ident(context)?);
        }
        self.expect(&TokenKind::Colon, "between the names and their type")?;
        let ty = self.type_expr()?;
        Ok(FieldGroup { names, ty })
    }

    /// `( A, B: T; C: U )`.
    fn params(&mut self) -> Parse<Vec<FieldGroup>> {
        self.expect(&TokenKind::LParen, "to start the parameters")?;
        let mut groups = Vec::new();
        if !self.at(&TokenKind::RParen) {
            groups.push(self.field_group("in the parameters")?);
            while self.eat(&TokenKind::Semicolon) {
                groups.push(self.field_group("in the parameters")?);
            }
        }
        self.expect(&TokenKind::RParen, "to close the parameters")?;
        Ok(groups)
    }

    fn type_expr(&mut self) -> Parse<TypeExpr> {
        self.enter()?;
        let result = self.type_expr_inner();
        self.leave();
        result
    }

    fn type_expr_inner(&mut self) -> Parse<TypeExpr> {
        let start = self.span();
        let of = |parser: &mut Parser<'_>, what: &str| {
            parser.expect_kw(Keyword::Of, &format!("after '{what}'"))
        };
        let kind = if self.eat_kw(Keyword::Array) {
            self.expect(&TokenKind::LBracket, "after 'array'")?;
            let low = self.expr()?;
            self.expect(&TokenKind::DotDot, "between the array bounds")?;
            let high = self.expr()?;
            self.expect(&TokenKind::RBracket, "to close the array bounds")?;
            of(self, "array[...]")?;
            TypeExprKind::Array {
                low: Box::new(low),
                high: Box::new(high),
                elem: Box::new(self.type_expr()?),
            }
        } else if self.at_word("List") && self.peek_at(1) == &TokenKind::Keyword(Keyword::Of) {
            self.bump();
            self.bump();
            let elem = self.type_expr()?;
            self.expect_word(
                "max",
                "after the list's element type (every list has a maximum)",
            )?;
            TypeExprKind::List {
                elem: Box::new(elem),
                max: Box::new(self.expr()?),
            }
        } else if self.at_word("Map") && self.peek_at(1) == &TokenKind::Keyword(Keyword::Of) {
            self.bump();
            self.bump();
            let key = self.type_expr()?;
            self.expect_kw(Keyword::To, "between the map's key and value types")?;
            TypeExprKind::Map {
                key: Box::new(key),
                value: Box::new(self.type_expr()?),
            }
        } else if self.at_word("Optional") && self.peek_at(1) == &TokenKind::Keyword(Keyword::Of) {
            self.bump();
            self.bump();
            TypeExprKind::Optional(Box::new(self.type_expr()?))
        } else if self.at_word("Coins") && self.peek_at(1) == &TokenKind::Keyword(Keyword::Of) {
            self.bump();
            self.bump();
            TypeExprKind::Coins(self.qual_ident("for the asset")?)
        } else if self.at_word("Vault") && self.peek_at(1) == &TokenKind::Keyword(Keyword::Of) {
            self.bump();
            self.bump();
            TypeExprKind::Vault(self.qual_ident("for the asset")?)
        } else if self.at_word("Text")
            && matches!(self.peek_at(1), TokenKind::Ident(w) if w.eq_ignore_ascii_case("max"))
        {
            self.bump();
            self.bump();
            TypeExprKind::Text(Box::new(self.expr()?))
        } else if self.at_word("Bytes") && self.peek_at(1) == &TokenKind::LBracket {
            self.bump();
            self.bump();
            let size = self.expr()?;
            self.expect(&TokenKind::RBracket, "to close the byte count")?;
            TypeExprKind::BytesFixed(Box::new(size))
        } else if self.at_word("Bytes")
            && matches!(self.peek_at(1), TokenKind::Ident(w) if w.eq_ignore_ascii_case("max"))
        {
            self.bump();
            self.bump();
            TypeExprKind::BytesMax(Box::new(self.expr()?))
        } else {
            TypeExprKind::Named(self.qual_ident("for a type")?)
        };
        Ok(TypeExpr {
            kind,
            span: start.to(self.previous_span()),
        })
    }

    fn routine(&mut self) -> Parse<Routine> {
        let start = self.span();
        let kind = match self.peek() {
            TokenKind::Keyword(Keyword::Constructor) => RoutineKind::Constructor,
            TokenKind::Keyword(Keyword::Procedure) => RoutineKind::Procedure,
            _ => RoutineKind::Function,
        };
        self.bump();
        let name = self.ident("for the routine")?;
        let params = if self.at(&TokenKind::LParen) {
            self.params()?
        } else {
            Vec::new()
        };
        let returns = if self.eat(&TokenKind::Colon) {
            Some(self.type_expr()?)
        } else {
            None
        };
        self.expect(&TokenKind::Semicolon, "after the routine heading")?;

        let mut directives = Vec::new();
        loop {
            let directive = match self.peek() {
                TokenKind::Keyword(Keyword::Entry) => Directive::Entry,
                TokenKind::Keyword(Keyword::View) => Directive::View,
                TokenKind::Keyword(Keyword::Reentrant) => Directive::Reentrant,
                _ => break,
            };
            let span = self.bump();
            directives.push((directive, span));
            self.expect(&TokenKind::Semicolon, "after the directive")?;
        }

        let mut effects = Vec::new();
        if ["changes", "receives", "sends", "emits", "calls"]
            .iter()
            .any(|word| self.at_word(word))
        {
            loop {
                effects.push(self.effect()?);
                if !self.eat(&TokenKind::Comma) {
                    break;
                }
            }
            self.expect(&TokenKind::Semicolon, "after the effects list")?;
        }

        let mut vars = Vec::new();
        if self.eat_kw(Keyword::Var) {
            self.field_section(&mut vars, "in the var block");
        }
        let body = self.block()?;
        self.expect(&TokenKind::Semicolon, "after the routine's 'end'")?;
        Ok(Routine {
            kind,
            name,
            params,
            returns,
            directives,
            effects,
            vars,
            body,
            span: start.to(self.previous_span()),
        })
    }

    fn effect(&mut self) -> Parse<(Effect, Span)> {
        let start = self.span();
        let context = "in the effects list";
        let effect = if self.eat_word("changes") {
            self.expect_kw(Keyword::Storage, "after 'changes'")?;
            Effect::ChangesStorage
        } else if self.eat_word("receives") {
            self.expect_word("coins", "after 'receives'")?;
            Effect::ReceivesCoins
        } else if self.eat_word("sends") {
            self.expect_word("coins", "after 'sends'")?;
            Effect::SendsCoins
        } else if self.eat_word("emits") {
            self.expect_kw(Keyword::Events, "after 'emits'")?;
            Effect::EmitsEvents
        } else if self.eat_word("calls") {
            self.expect_word("contracts", "after 'calls'")?;
            Effect::CallsContracts
        } else {
            return Err(self.error_here(
                "an effect (changes storage, receives coins, sends coins, emits events, calls contracts)",
                context,
            ));
        };
        Ok((effect, start.to(self.previous_span())))
    }

    // ---- statements ----

    fn block(&mut self) -> Parse<Block> {
        let start = self.expect_kw(Keyword::Begin, "to start the block")?;
        let mut stmts = Vec::new();
        loop {
            if self.at_kw(Keyword::End) || self.at(&TokenKind::Eof) {
                break;
            }
            match self.stmt() {
                Ok(stmt) => stmts.push(stmt),
                Err(Reported) => self.sync_statement(),
            }
            if self.eat(&TokenKind::Semicolon) {
                continue;
            }
            if self.at_kw(Keyword::End) || self.at(&TokenKind::Eof) {
                break;
            }
            let _ = self.error_here("';' between statements", "here");
            self.sync_statement();
            self.eat(&TokenKind::Semicolon);
        }
        let end = self.expect_kw(Keyword::End, "to close the block")?;
        Ok(Block {
            stmts,
            span: start.to(end),
        })
    }

    fn stmt(&mut self) -> Parse<Stmt> {
        self.enter()?;
        let result = self.stmt_inner();
        self.leave();
        result
    }

    fn stmt_inner(&mut self) -> Parse<Stmt> {
        let start = self.span();
        let kind = match self.peek() {
            TokenKind::Semicolon
            | TokenKind::Keyword(Keyword::End | Keyword::Else)
            | TokenKind::Eof => StmtKind::Empty,
            TokenKind::Keyword(Keyword::Begin) => StmtKind::Block(self.block()?),
            TokenKind::Keyword(Keyword::If) => {
                self.bump();
                let cond = self.expr()?;
                self.expect_kw(Keyword::Then, "after the 'if' condition")?;
                let then = self.stmt()?;
                let otherwise = if self.eat_kw(Keyword::Else) {
                    Some(Box::new(self.stmt()?))
                } else {
                    None
                };
                StmtKind::If {
                    cond,
                    then: Box::new(then),
                    otherwise,
                }
            }
            TokenKind::Keyword(Keyword::Case) => self.case_stmt()?,
            TokenKind::Keyword(Keyword::For) => {
                self.bump();
                if self.eat_word("each") {
                    let var = self.ident("after 'for each'")?;
                    self.expect_kw(Keyword::In, "after the loop variable")?;
                    let collection = self.expr()?;
                    self.expect_kw(Keyword::Do, "after the collection")?;
                    StmtKind::ForEach {
                        var,
                        collection,
                        body: Box::new(self.stmt()?),
                    }
                } else {
                    let var = self.ident("after 'for'")?;
                    self.expect(&TokenKind::Assign, "after the loop variable")?;
                    let from = self.expr()?;
                    self.expect_kw(Keyword::To, "after the loop's first value")?;
                    let to = self.expr()?;
                    self.expect_kw(Keyword::Do, "after the loop's last value")?;
                    StmtKind::ForTo {
                        var,
                        from,
                        to,
                        body: Box::new(self.stmt()?),
                    }
                }
            }
            TokenKind::Keyword(Keyword::While) => {
                let keyword = self.bump();
                let cond = self.expr()?;
                let bound = if self.eat_word("at") {
                    self.expect_word("most", "after 'at' (as in 'at most 100 times')")?;
                    let bound = self.expr()?;
                    self.expect_word("times", "after the loop bound (as in 'at most 100 times')")?;
                    Some(bound)
                } else {
                    self.diagnostics.error(
                        "A4002",
                        keyword,
                        "This while-loop needs a bound, for example 'at most 100 times'.",
                    );
                    None
                };
                self.expect_kw(Keyword::Do, "after the while condition")?;
                StmtKind::While {
                    cond,
                    bound,
                    body: Box::new(self.stmt()?),
                }
            }
            TokenKind::Keyword(Keyword::Require) => {
                self.bump();
                let cond = self.expr()?;
                self.expect_kw(Keyword::Otherwise, "after the 'require' condition")?;
                StmtKind::Require {
                    cond,
                    error: self.ident("after 'otherwise' (the name of an error)")?,
                }
            }
            TokenKind::Keyword(Keyword::Fail) => {
                self.bump();
                StmtKind::Fail(self.ident("after 'fail' (the name of an error)")?)
            }
            TokenKind::Keyword(Keyword::Emit) => {
                self.bump();
                let event = self.ident("after 'emit' (the name of an event)")?;
                let args = if self.at(&TokenKind::LParen) {
                    self.args()?
                } else {
                    Vec::new()
                };
                StmtKind::Emit { event, args }
            }
            TokenKind::Keyword(Keyword::Exit) => {
                self.bump();
                StmtKind::Exit
            }
            _ => {
                let target = self.expr()?;
                if self.eat(&TokenKind::Assign) {
                    StmtKind::Assign {
                        target,
                        value: self.expr()?,
                    }
                } else if matches!(
                    target.kind,
                    ExprKind::Name(_) | ExprKind::Field(..) | ExprKind::Call { .. }
                ) {
                    StmtKind::Call(target)
                } else {
                    self.diagnostics.error(
                        "A1107",
                        target.span,
                        "This expression does nothing on its own. A statement assigns with ':=' or calls a routine.",
                    );
                    return Err(Reported);
                }
            }
        };
        Ok(Stmt {
            kind,
            span: start.to(self.previous_span()),
        })
    }

    fn case_stmt(&mut self) -> Parse<StmtKind> {
        self.bump();
        let subject = self.expr()?;
        self.expect_kw(Keyword::Of, "after the 'case' value")?;
        let mut arms = Vec::new();
        let mut otherwise = None;
        loop {
            if self.at_kw(Keyword::End) || self.at(&TokenKind::Eof) {
                break;
            }
            if self.eat_kw(Keyword::Else) {
                otherwise = Some(Box::new(self.stmt()?));
                self.eat(&TokenKind::Semicolon);
                break;
            }
            let mut labels = vec![self.expr()?];
            while self.eat(&TokenKind::Comma) {
                labels.push(self.expr()?);
            }
            self.expect(&TokenKind::Colon, "after the case label")?;
            let body = self.stmt()?;
            arms.push(CaseArm { labels, body });
            if !self.eat(&TokenKind::Semicolon) {
                break;
            }
        }
        self.expect_kw(Keyword::End, "to close the 'case'")?;
        Ok(StmtKind::Case {
            subject,
            arms,
            otherwise,
        })
    }

    // ---- expressions ----

    fn args(&mut self) -> Parse<Vec<Expr>> {
        self.expect(&TokenKind::LParen, "to start the arguments")?;
        let mut args = Vec::new();
        if !self.at(&TokenKind::RParen) {
            args.push(self.expr()?);
            while self.eat(&TokenKind::Comma) {
                args.push(self.expr()?);
            }
        }
        self.expect(&TokenKind::RParen, "to close the arguments")?;
        Ok(args)
    }

    pub(crate) fn expr(&mut self) -> Parse<Expr> {
        self.enter()?;
        let result = self.binary(0);
        self.leave();
        result
    }

    fn binary_op(&self) -> Option<(BinaryOp, u8)> {
        Some(match self.peek() {
            TokenKind::Keyword(Keyword::Or) => (BinaryOp::Or, 1),
            TokenKind::Keyword(Keyword::Xor) => (BinaryOp::Xor, 1),
            TokenKind::Keyword(Keyword::And) => (BinaryOp::And, 2),
            TokenKind::Eq => (BinaryOp::Eq, 3),
            TokenKind::NotEq => (BinaryOp::NotEq, 3),
            TokenKind::Lt => (BinaryOp::Lt, 3),
            TokenKind::LtEq => (BinaryOp::LtEq, 3),
            TokenKind::Gt => (BinaryOp::Gt, 3),
            TokenKind::GtEq => (BinaryOp::GtEq, 3),
            TokenKind::Plus => (BinaryOp::Add, 4),
            TokenKind::Minus => (BinaryOp::Sub, 4),
            TokenKind::Star => (BinaryOp::Mul, 5),
            TokenKind::Keyword(Keyword::Div) => (BinaryOp::Div, 5),
            TokenKind::Keyword(Keyword::Mod) => (BinaryOp::Mod, 5),
            _ => return None,
        })
    }

    /// Precedence climbing: parses operators binding at least as tightly as `min`.
    fn binary(&mut self, min: u8) -> Parse<Expr> {
        let mut left = self.unary()?;
        while let Some((op, precedence)) = self.binary_op() {
            if precedence < min {
                break;
            }
            self.bump();
            let right = self.binary(precedence.saturating_add(1))?;
            if precedence == 3
                && let Some((_, 3)) = self.binary_op()
            {
                let span = self.span();
                self.diagnostics.error(
                    "A1108",
                    span,
                    "Comparisons cannot be chained. Join them with 'and', for example 'A < B and B < C'.",
                );
                return Err(Reported);
            }
            let span = left.span.to(right.span);
            left = Expr {
                kind: ExprKind::Binary(op, Box::new(left), Box::new(right)),
                span,
            };
        }
        Ok(left)
    }

    fn unary(&mut self) -> Parse<Expr> {
        let start = self.span();
        let op = if self.eat_kw(Keyword::Not) {
            Some(UnaryOp::Not)
        } else if self.eat(&TokenKind::Minus) {
            Some(UnaryOp::Neg)
        } else {
            None
        };
        match op {
            Some(op) => {
                self.enter()?;
                let operand = self.unary();
                self.leave();
                let operand = operand?;
                let span = start.to(operand.span);
                Ok(Expr {
                    kind: ExprKind::Unary(op, Box::new(operand)),
                    span,
                })
            }
            None => self.postfix(),
        }
    }

    fn postfix(&mut self) -> Parse<Expr> {
        let mut expr = self.primary()?;
        loop {
            if self.at(&TokenKind::Dot) {
                self.bump();
                let member = self.ident("after '.'")?;
                let span = expr.span.to(member.span);
                expr = Expr {
                    kind: ExprKind::Field(Box::new(expr), member),
                    span,
                };
            } else if self.at(&TokenKind::LBracket) {
                self.bump();
                let index = self.expr()?;
                let end = self.expect(&TokenKind::RBracket, "to close the index")?;
                let span = expr.span.to(end);
                expr = Expr {
                    kind: ExprKind::Index(Box::new(expr), Box::new(index)),
                    span,
                };
            } else if self.at(&TokenKind::LParen) {
                let args = self.args()?;
                let span = expr.span.to(self.previous_span());
                expr = Expr {
                    kind: ExprKind::Call {
                        callee: Box::new(expr),
                        args,
                    },
                    span,
                };
            } else {
                return Ok(expr);
            }
        }
    }

    fn primary(&mut self) -> Parse<Expr> {
        let start = self.span();
        let kind = match self.peek().clone() {
            TokenKind::Int(value) => {
                self.bump();
                ExprKind::Int(value)
            }
            TokenKind::Str(text) => {
                self.bump();
                ExprKind::Str(text)
            }
            TokenKind::Keyword(Keyword::True) => {
                self.bump();
                ExprKind::Bool(true)
            }
            TokenKind::Keyword(Keyword::False) => {
                self.bump();
                ExprKind::Bool(false)
            }
            TokenKind::Keyword(Keyword::Move) => {
                self.bump();
                ExprKind::Move(self.ident("after 'move' (the Coins value to hand over)")?)
            }
            TokenKind::Ident(name) => {
                let span = self.bump();
                ExprKind::Name(Ident { name, span })
            }
            TokenKind::LParen => {
                self.bump();
                let inner = self.expr()?;
                self.expect(&TokenKind::RParen, "to close the parenthesis")?;
                return Ok(Expr {
                    kind: inner.kind,
                    span: start.to(self.previous_span()),
                });
            }
            _ => return Err(self.error_here("a value", "here")),
        };
        Ok(Expr {
            kind,
            span: start.to(self.previous_span()),
        })
    }
}

/// Parses a token stream (ending with `Eof`) into a unit. Returns `None` when the file is
/// too broken to give a tree; diagnostics say why either way.
pub fn parse(tokens: &[Token], diagnostics: &mut Diagnostics) -> Option<Unit> {
    let mut parser = Parser {
        tokens,
        position: 0,
        diagnostics,
        depth: 0,
    };
    parser.unit().ok()
}
