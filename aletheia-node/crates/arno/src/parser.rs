//! The parser (spec Section 26, syntax per ADR-049): hand-written recursive descent,
//! precedence climbing for expressions, and error recovery so one mistake does not hide the
//! rest.
//!
//! Arno is shaped like Java and Solidity (a `contract { }` with `public` and `private`
//! members, braces and semicolons) but uses words where those languages use symbols:
//! `is`, `is not`, `and`, `or`, `not`, `require ... otherwise`, `for each ... in`.
//!
//! Expression precedence, lowest first (see `docs/arno/grammar.ebnf`):
//!
//! ```text
//! or xor  <  and  <  is, is not, < <= > >= (not chained)  <  + -  <  * div mod  <  not, unary -
//! ```
//!
//! Local variables may be declared anywhere in a function body (`UInt128 total = 0;`); the
//! parser collects them into the routine's variable list, so each name is declared once per
//! function. `return X;` stores `X` in the routine's result and leaves the routine.

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
    /// Local variables declared so far in the routine being parsed.
    locals: Vec<FieldGroup>,
    /// Whether the routine being parsed declares `returns`.
    returns_value: bool,
}

const EOF: TokenKind = TokenKind::Eof;

/// Keywords that start a contract member; error recovery resumes at them.
const MEMBER_START: [Keyword; 12] = [
    Keyword::Constant,
    Keyword::Type,
    Keyword::Enum,
    Keyword::Record,
    Keyword::Error,
    Keyword::Event,
    Keyword::Public,
    Keyword::Private,
    Keyword::Constructor,
    Keyword::Function,
    Keyword::View,
    Keyword::Reentrant,
];

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

    fn semicolon(&mut self, context: &str) -> Parse<Span> {
        self.expect(&TokenKind::Semicolon, context)
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
                format!("This is nested more than {MAX_NESTING} levels deep. Split it into smaller functions."),
            );
            return Err(Reported);
        }
        self.depth = self.depth.saturating_add(1);
        Ok(())
    }

    fn leave(&mut self) {
        self.depth = self.depth.saturating_sub(1);
    }

    /// Skips the rest of a broken statement: past its `;`, or past a `{ }` group it opened,
    /// stopping before a `}` that closes the enclosing block.
    fn sync_statement(&mut self) {
        let mut depth = 0u32;
        loop {
            match self.peek() {
                TokenKind::Eof => return,
                TokenKind::Semicolon if depth == 0 => {
                    self.bump();
                    return;
                }
                TokenKind::LBrace => {
                    depth = depth.saturating_add(1);
                    self.bump();
                }
                TokenKind::RBrace => {
                    if depth == 0 {
                        return;
                    }
                    depth = depth.saturating_sub(1);
                    self.bump();
                    if depth == 0 {
                        return;
                    }
                }
                _ => {
                    self.bump();
                }
            }
        }
    }

    /// Skips the rest of a broken member: past its `;` or its `{ }` body, or up to the next
    /// keyword that starts a member, or up to the contract's closing `}`.
    fn sync_member(&mut self) {
        let mut depth = 0u32;
        loop {
            match self.peek() {
                TokenKind::Eof => return,
                TokenKind::Keyword(keyword) if depth == 0 && MEMBER_START.contains(keyword) => {
                    return;
                }
                TokenKind::Semicolon if depth == 0 => {
                    self.bump();
                    return;
                }
                TokenKind::LBrace => {
                    depth = depth.saturating_add(1);
                    self.bump();
                }
                TokenKind::RBrace => {
                    if depth == 0 {
                        return;
                    }
                    depth = depth.saturating_sub(1);
                    self.bump();
                    if depth == 0 {
                        return;
                    }
                }
                _ => {
                    self.bump();
                }
            }
        }
    }

    // ---- the contract and its members ----

    fn unit(&mut self) -> Parse<Unit> {
        let start = self.span();
        self.expect_kw(Keyword::Contract, "at the start of the file")?;
        let name = self.ident("after 'contract'")?;
        self.expect(&TokenKind::LBrace, "after the contract name")?;
        self.expect_kw(
            Keyword::Version,
            "as the contract's first line (as in 'version 0.1;')",
        )?;
        let (version, version_span) = self.version()?;
        self.semicolon("after the version")?;

        let mut uses = Vec::new();
        if self.eat_kw(Keyword::Uses) {
            while let Ok(unit) = self.qual_ident("in the uses list") {
                uses.push(unit);
                if !self.eat(&TokenKind::Comma) {
                    break;
                }
            }
            if self.semicolon("after the uses list").is_err() {
                self.sync_member();
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
            let result = match self.peek() {
                TokenKind::RBrace => break,
                TokenKind::Eof => {
                    let span = self.span();
                    self.diagnostics.error(
                        "A1103",
                        span,
                        "The contract must end with '}' after its last member.",
                    );
                    return Err(Reported);
                }
                TokenKind::Keyword(Keyword::Constant) => self.constant(&mut unit.consts),
                TokenKind::Keyword(Keyword::Type) => self.type_alias(&mut unit.types),
                TokenKind::Keyword(Keyword::Enum) => self.enumeration(&mut unit.types),
                TokenKind::Keyword(Keyword::Record) => self.record(&mut unit.types),
                TokenKind::Keyword(Keyword::Error) => self.error_decl(&mut unit.errors),
                TokenKind::Keyword(Keyword::Event) => self.event(&mut unit.events),
                TokenKind::Keyword(Keyword::Constructor) => self
                    .constructor()
                    .map(|routine| unit.routines.push(routine)),
                TokenKind::Keyword(
                    Keyword::Function | Keyword::View | Keyword::Reentrant | Keyword::Public,
                ) if self.routine_ahead() => {
                    self.routine().map(|routine| unit.routines.push(routine))
                }
                TokenKind::Keyword(Keyword::Private) if self.routine_ahead() => {
                    self.routine().map(|routine| unit.routines.push(routine))
                }
                TokenKind::Keyword(Keyword::Public | Keyword::Private)
                | TokenKind::Ident(_)
                | TokenKind::Keyword(Keyword::Array) => self.storage_field(&mut unit.storage),
                _ => Err(self.error_here(
                    "a member (a variable, function, constant, type, error or event)",
                    "inside the contract",
                )),
            };
            if result.is_err() {
                let before = self.position;
                self.sync_member();
                if self.position == before {
                    // Recovery must always move forward, or a stray `view` would loop forever.
                    self.bump();
                }
            }
        }
        let end = self.expect(&TokenKind::RBrace, "at the end of the contract")?;
        if !self.at(&TokenKind::Eof) {
            let span = self.span();
            self.diagnostics.error(
                "A1104",
                span,
                "Nothing may follow the contract's closing '}'.",
            );
        }
        unit.span = start.to(end);
        Ok(unit)
    }

    /// After `public`, `private`, `view` or `reentrant`: does a function follow the modifiers?
    fn routine_ahead(&self) -> bool {
        let mut ahead = 0usize;
        loop {
            match self.peek_at(ahead) {
                TokenKind::Keyword(Keyword::Function) => return true,
                TokenKind::Keyword(
                    Keyword::Public | Keyword::Private | Keyword::View | Keyword::Reentrant,
                ) => ahead = ahead.saturating_add(1),
                _ => return false,
            }
        }
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

    /// `constant MaxStaff = 500;`
    fn constant(&mut self, out: &mut Vec<ConstDecl>) -> Parse<()> {
        self.bump();
        let name = self.ident("for the constant")?;
        self.expect(&TokenKind::Assign, "after the constant's name")?;
        let value = self.expr()?;
        self.semicolon("after the constant")?;
        out.push(ConstDecl { name, value });
        Ok(())
    }

    /// `type Amount = UInt128;`
    fn type_alias(&mut self, out: &mut Vec<TypeDecl>) -> Parse<()> {
        self.bump();
        let name = self.ident("for the type")?;
        self.expect(&TokenKind::Assign, "after the type's name")?;
        let def = TypeDef::Alias(self.type_expr()?);
        self.semicolon("after the type")?;
        out.push(TypeDecl { name, def });
        Ok(())
    }

    /// `enum Phase { Open, Funded, Closed }`
    fn enumeration(&mut self, out: &mut Vec<TypeDecl>) -> Parse<()> {
        self.bump();
        let name = self.ident("for the enum")?;
        self.expect(&TokenKind::LBrace, "after the enum's name")?;
        let mut variants = vec![self.ident("in the enum")?];
        while self.eat(&TokenKind::Comma) {
            if self.at(&TokenKind::RBrace) {
                break;
            }
            variants.push(self.ident("in the enum")?);
        }
        self.expect(&TokenKind::RBrace, "to close the enum")?;
        out.push(TypeDecl {
            name,
            def: TypeDef::Enum(variants),
        });
        Ok(())
    }

    /// `record Employee { Address wallet; UInt128 salary; }`
    fn record(&mut self, out: &mut Vec<TypeDecl>) -> Parse<()> {
        self.bump();
        let name = self.ident("for the record")?;
        self.expect(&TokenKind::LBrace, "after the record's name")?;
        let mut fields = Vec::new();
        while !self.at(&TokenKind::RBrace) && !self.at(&TokenKind::Eof) {
            match self.declared_names("in the record") {
                Ok(group) => fields.push(group),
                Err(Reported) => self.sync_statement(),
            }
        }
        self.expect(&TokenKind::RBrace, "to close the record")?;
        out.push(TypeDecl {
            name,
            def: TypeDef::Record(fields),
        });
        Ok(())
    }

    /// `error NotOwner "Only the owner can do this.";`
    fn error_decl(&mut self, out: &mut Vec<ErrorDecl>) -> Parse<()> {
        self.bump();
        let name = self.ident("for the error")?;
        let message_span = self.span();
        let TokenKind::Str(message) = self.peek().clone() else {
            return Err(self.error_here(
                "an English message in double quotes",
                "after the error's name",
            ));
        };
        self.bump();
        self.semicolon("after the error message")?;
        out.push(ErrorDecl {
            name,
            message,
            message_span,
        });
        Ok(())
    }

    /// `event Paid(Address wallet, UInt128 amount);`
    fn event(&mut self, out: &mut Vec<EventDecl>) -> Parse<()> {
        self.bump();
        let name = self.ident("for the event")?;
        let params = if self.at(&TokenKind::LParen) {
            self.params()?
        } else {
            Vec::new()
        };
        self.semicolon("after the event")?;
        out.push(EventDecl { name, params });
        Ok(())
    }

    /// `private Address owner;` (or without `private`). Storage is always private.
    fn storage_field(&mut self, out: &mut Vec<FieldGroup>) -> Parse<()> {
        if self.at_kw(Keyword::Public) {
            let span = self.bump();
            self.diagnostics.error(
                "A1110",
                span,
                "Contract variables are always private. To let others read one, add a 'public view function' that returns it.",
            );
        } else {
            self.eat_kw(Keyword::Private);
        }
        out.push(self.declared_names("for the contract variable")?);
        Ok(())
    }

    /// `Type a, b;` in records and storage.
    fn declared_names(&mut self, context: &str) -> Parse<FieldGroup> {
        let ty = self.type_expr()?;
        let mut names = vec![self.ident(context)?];
        while self.eat(&TokenKind::Comma) {
            names.push(self.ident(context)?);
        }
        self.semicolon(&format!("after the declaration {context}"))?;
        Ok(FieldGroup { names, ty })
    }

    /// `(Type a, Type b)`: one name per type, as in Java.
    fn params(&mut self) -> Parse<Vec<FieldGroup>> {
        self.expect(&TokenKind::LParen, "to start the parameters")?;
        let mut groups = Vec::new();
        if !self.at(&TokenKind::RParen) {
            loop {
                let ty = self.type_expr()?;
                let name = self.ident("for the parameter, after its type")?;
                groups.push(FieldGroup {
                    names: vec![name],
                    ty,
                });
                if !self.eat(&TokenKind::Comma) {
                    break;
                }
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
                "after the list's item type (every list has a maximum)",
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

    // ---- functions ----

    /// `constructor(Signer caller, ...) changes storage { ... }`
    fn constructor(&mut self) -> Parse<Routine> {
        let start = self.bump();
        let name = Ident {
            name: "constructor".to_owned(),
            span: start,
        };
        let params = self.params()?;
        let effects = self.effects()?;
        self.routine_body(
            RoutineKind::Constructor,
            name,
            params,
            None,
            Vec::new(),
            effects,
            start,
        )
    }

    /// `public view function name(Type a) returns Type changes storage { ... }`
    ///
    /// A public function without a result is an entry the outside world calls; a view function
    /// is readable by anyone; a private function is a helper only this contract calls.
    fn routine(&mut self) -> Parse<Routine> {
        let start = self.span();
        let mut public = None;
        let mut private = false;
        let mut view = None;
        let mut reentrant = None;
        loop {
            match self.peek() {
                TokenKind::Keyword(Keyword::Public) => public = Some(self.bump()),
                TokenKind::Keyword(Keyword::Private) => {
                    let span = self.bump();
                    private = true;
                    if view.is_some() {
                        self.private_view(span);
                    }
                }
                TokenKind::Keyword(Keyword::View) => {
                    let span = self.bump();
                    if private {
                        self.private_view(span);
                    }
                    view = Some(span);
                }
                TokenKind::Keyword(Keyword::Reentrant) => reentrant = Some(self.bump()),
                _ => break,
            }
        }
        self.expect_kw(Keyword::Function, "after the function's modifiers")?;
        let name = self.ident("for the function")?;
        let params = self.params()?;
        let returns = if self.eat_kw(Keyword::Returns) {
            Some(self.type_expr()?)
        } else {
            None
        };
        let effects = self.effects()?;

        let mut directives = Vec::new();
        match (view, public) {
            (Some(span), _) => directives.push((Directive::View, span)),
            (None, Some(span)) => directives.push((Directive::Entry, span)),
            (None, None) => {}
        }
        if let Some(span) = reentrant {
            directives.push((Directive::Reentrant, span));
        }
        let kind = if returns.is_some() {
            RoutineKind::Function
        } else {
            RoutineKind::Procedure
        };
        self.routine_body(kind, name, params, returns, directives, effects, start)
    }

    fn private_view(&mut self, span: Span) {
        self.diagnostics.error(
            "A1112",
            span,
            "A view function can be read by anyone, so it cannot be private. Write 'public view function'.",
        );
    }

    #[allow(clippy::too_many_arguments)]
    fn routine_body(
        &mut self,
        kind: RoutineKind,
        name: Ident,
        params: Vec<FieldGroup>,
        returns: Option<TypeExpr>,
        directives: Vec<(Directive, Span)>,
        effects: Vec<(Effect, Span)>,
        start: Span,
    ) -> Parse<Routine> {
        self.locals.clear();
        self.returns_value = returns.is_some();
        let mut body = self.block()?;
        drop_trailing_exit(&mut body);
        Ok(Routine {
            kind,
            name,
            params,
            returns,
            directives,
            effects,
            vars: std::mem::take(&mut self.locals),
            body,
            span: start.to(self.previous_span()),
        })
    }

    /// `changes storage, sends coins, ...` before the body; may be empty.
    fn effects(&mut self) -> Parse<Vec<(Effect, Span)>> {
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
        }
        Ok(effects)
    }

    fn effect(&mut self) -> Parse<(Effect, Span)> {
        let start = self.span();
        let effect = if self.eat_word("changes") {
            self.expect_word("storage", "after 'changes'")?;
            Effect::ChangesStorage
        } else if self.eat_word("receives") {
            self.expect_word("coins", "after 'receives'")?;
            Effect::ReceivesCoins
        } else if self.eat_word("sends") {
            self.expect_word("coins", "after 'sends'")?;
            Effect::SendsCoins
        } else if self.eat_word("emits") {
            self.expect_word("events", "after 'emits'")?;
            Effect::EmitsEvents
        } else if self.eat_word("calls") {
            self.expect_word("contracts", "after 'calls'")?;
            Effect::CallsContracts
        } else {
            return Err(self.error_here(
                "an effect (changes storage, receives coins, sends coins, emits events, calls contracts)",
                "in the effects list",
            ));
        };
        Ok((effect, start.to(self.previous_span())))
    }

    // ---- statements ----

    fn block(&mut self) -> Parse<Block> {
        let start = self.expect(&TokenKind::LBrace, "to start the block")?;
        let mut stmts = Vec::new();
        while !self.at(&TokenKind::RBrace) && !self.at(&TokenKind::Eof) {
            let before = self.position;
            match self.stmt() {
                Ok(stmt) => stmts.push(stmt),
                Err(Reported) => self.sync_statement(),
            }
            if self.position == before && !self.at(&TokenKind::RBrace) {
                self.bump();
            }
        }
        let end = self.expect(&TokenKind::RBrace, "to close the block")?;
        Ok(Block {
            stmts,
            span: start.to(end),
        })
    }

    fn block_stmt(&mut self) -> Parse<Stmt> {
        let block = self.block()?;
        Ok(Stmt {
            span: block.span,
            kind: StmtKind::Block(block),
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
        let declaration = self.declaration_ahead();
        let kind = match self.peek() {
            _ if declaration => self.declaration()?,
            TokenKind::Semicolon => {
                self.bump();
                StmtKind::Empty
            }
            TokenKind::LBrace => StmtKind::Block(self.block()?),
            TokenKind::Keyword(Keyword::If) => self.if_stmt()?,
            TokenKind::Keyword(Keyword::Switch) => self.switch_stmt()?,
            TokenKind::Keyword(Keyword::For) => self.for_stmt()?,
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
                StmtKind::While {
                    cond,
                    bound,
                    body: Box::new(self.block_stmt()?),
                }
            }
            TokenKind::Keyword(Keyword::Require) => {
                self.bump();
                let cond = self.expr()?;
                self.expect_kw(Keyword::Otherwise, "after the 'require' condition")?;
                let error = self.ident("after 'otherwise' (the name of an error)")?;
                self.semicolon("after the 'require'")?;
                StmtKind::Require { cond, error }
            }
            TokenKind::Keyword(Keyword::Fail) => {
                self.bump();
                let error = self.ident("after 'fail' (the name of an error)")?;
                self.semicolon("after the 'fail'")?;
                StmtKind::Fail(error)
            }
            TokenKind::Keyword(Keyword::Emit) => {
                self.bump();
                let event = self.ident("after 'emit' (the name of an event)")?;
                let args = if self.at(&TokenKind::LParen) {
                    self.args()?
                } else {
                    Vec::new()
                };
                self.semicolon("after the 'emit'")?;
                StmtKind::Emit { event, args }
            }
            TokenKind::Keyword(Keyword::Return) => self.return_stmt()?,
            _ => {
                let target = self.expr()?;
                let kind = if self.eat(&TokenKind::Assign) {
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
                        "This expression does nothing on its own. A statement assigns with '=' or calls a function.",
                    );
                    return Err(Reported);
                };
                self.semicolon("at the end of the statement")?;
                kind
            }
        };
        Ok(Stmt {
            kind,
            span: start.to(self.previous_span()),
        })
    }

    /// `if X { } else if Y { } else { }`
    fn if_stmt(&mut self) -> Parse<StmtKind> {
        self.bump();
        let cond = self.expr()?;
        let then = self.block_stmt()?;
        let otherwise = if self.eat_kw(Keyword::Else) {
            if self.at_kw(Keyword::If) {
                Some(Box::new(self.stmt()?))
            } else {
                Some(Box::new(self.block_stmt()?))
            }
        } else {
            None
        };
        Ok(StmtKind::If {
            cond,
            then: Box::new(then),
            otherwise,
        })
    }

    /// `switch X { case A, B -> ...; default -> ...; }`
    fn switch_stmt(&mut self) -> Parse<StmtKind> {
        self.bump();
        let subject = self.expr()?;
        self.expect(&TokenKind::LBrace, "after the 'switch' value")?;
        let mut arms = Vec::new();
        let mut otherwise = None;
        loop {
            if self.at(&TokenKind::RBrace) || self.at(&TokenKind::Eof) {
                break;
            }
            if self.eat_kw(Keyword::Default) {
                self.expect(&TokenKind::Arrow, "after 'default'")?;
                otherwise = Some(Box::new(self.stmt()?));
                break;
            }
            self.expect_kw(Keyword::Case, "to start a 'switch' arm")?;
            let mut labels = vec![self.expr()?];
            while self.eat(&TokenKind::Comma) {
                labels.push(self.expr()?);
            }
            self.expect(&TokenKind::Arrow, "after the case values")?;
            let body = self.stmt()?;
            arms.push(CaseArm { labels, body });
        }
        self.expect(
            &TokenKind::RBrace,
            "to close the 'switch' ('default' must be the last arm)",
        )?;
        Ok(StmtKind::Case {
            subject,
            arms,
            otherwise,
        })
    }

    /// `for each [Type] x in list { }` or `for [Type] i from 1 to 10 { }`. Without a type,
    /// the checker gives the variable the items' type (or UInt64 when counting).
    fn for_stmt(&mut self) -> Parse<StmtKind> {
        self.bump();
        if self.eat_word("each") {
            let var = self.loop_variable(|next| next == &TokenKind::Keyword(Keyword::In))?;
            self.expect_kw(Keyword::In, "after the loop variable")?;
            let collection = self.expr()?;
            Ok(StmtKind::ForEach {
                var,
                collection,
                body: Box::new(self.block_stmt()?),
            })
        } else {
            let var = self.loop_variable(
                |next| matches!(next, TokenKind::Ident(w) if w.eq_ignore_ascii_case("from")),
            )?;
            self.expect_word(
                "from",
                "after the loop variable (as in 'for i from 1 to 10')",
            )?;
            let from = self.expr()?;
            self.expect_kw(Keyword::To, "after the loop's first value")?;
            let to = self.expr()?;
            Ok(StmtKind::ForTo {
                var,
                from,
                to,
                body: Box::new(self.block_stmt()?),
            })
        }
    }

    /// The loop variable, with an optional type before it that declares it.
    fn loop_variable(&mut self, ends: impl Fn(&TokenKind) -> bool) -> Parse<Ident> {
        if matches!(self.peek(), TokenKind::Ident(_)) && ends(self.peek_at(1)) {
            return self.ident("for the loop variable");
        }
        let ty = self.type_expr()?;
        let var = self.ident("for the loop variable, after its type")?;
        self.locals.push(FieldGroup {
            names: vec![var.clone()],
            ty,
        });
        Ok(var)
    }

    /// `return;` or `return X;`.
    fn return_stmt(&mut self) -> Parse<StmtKind> {
        let keyword = self.bump();
        if self.eat(&TokenKind::Semicolon) {
            return Ok(StmtKind::Exit);
        }
        let value = self.expr()?;
        self.semicolon("after the 'return'")?;
        if !self.returns_value {
            self.diagnostics.error(
                "A1111",
                value.span,
                "This function has no 'returns' type, so 'return' cannot give back a value. Write 'return;', or add 'returns <Type>'.",
            );
            return Err(Reported);
        }
        let result = Expr {
            kind: ExprKind::Name(Ident {
                name: "Result".to_owned(),
                span: keyword,
            }),
            span: keyword,
        };
        let span = keyword.to(self.previous_span());
        Ok(StmtKind::Block(Block {
            stmts: vec![
                Stmt {
                    kind: StmtKind::Assign {
                        target: result,
                        value,
                    },
                    span,
                },
                Stmt {
                    kind: StmtKind::Exit,
                    span: keyword,
                },
            ],
            span,
        }))
    }

    /// Does a local variable declaration (`Type name ...`) start here? Tries to read a type
    /// followed by a name, then rewinds; nothing it reports while trying is kept.
    fn declaration_ahead(&mut self) -> bool {
        if !matches!(
            self.peek(),
            TokenKind::Ident(_) | TokenKind::Keyword(Keyword::Array)
        ) {
            return false;
        }
        if matches!(self.peek_at(1), TokenKind::Ident(_)) {
            return true;
        }
        let (position, depth) = (self.position, self.depth);
        let saved = std::mem::take(self.diagnostics);
        let found = self.type_expr().is_ok() && matches!(self.peek(), TokenKind::Ident(_));
        *self.diagnostics = saved;
        self.position = position;
        self.depth = depth;
        found
    }

    /// `Type a = 1, b;`: the names join the function's variables; initial values become
    /// assignments in place.
    fn declaration(&mut self) -> Parse<StmtKind> {
        let ty = self.type_expr()?;
        let mut names = Vec::new();
        let mut assignments = Vec::new();
        loop {
            let name = self.ident("for the variable, after its type")?;
            if self.eat(&TokenKind::Assign) {
                let value = self.expr()?;
                let span = name.span.to(value.span);
                assignments.push(Stmt {
                    kind: StmtKind::Assign {
                        target: Expr {
                            span: name.span,
                            kind: ExprKind::Name(name.clone()),
                        },
                        value,
                    },
                    span,
                });
            }
            names.push(name);
            if !self.eat(&TokenKind::Comma) {
                break;
            }
        }
        self.semicolon("after the variable declaration")?;
        self.locals.push(FieldGroup { names, ty });
        Ok(match assignments.len() {
            0 => StmtKind::Empty,
            1 => assignments.pop().map_or(StmtKind::Empty, |stmt| stmt.kind),
            _ => {
                let span = assignments
                    .first()
                    .map_or(Span::default(), |s| s.span)
                    .to(self.previous_span());
                StmtKind::Block(Block {
                    stmts: assignments,
                    span,
                })
            }
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

    /// The operator here: what it is, how tightly it binds, and how many tokens it spans.
    fn binary_op(&self) -> Option<(BinaryOp, u8, usize)> {
        Some(match self.peek() {
            TokenKind::Keyword(Keyword::Or) => (BinaryOp::Or, 1, 1),
            TokenKind::Keyword(Keyword::Xor) => (BinaryOp::Xor, 1, 1),
            TokenKind::Keyword(Keyword::And) => (BinaryOp::And, 2, 1),
            TokenKind::Keyword(Keyword::Is)
                if self.peek_at(1) == &TokenKind::Keyword(Keyword::Not) =>
            {
                (BinaryOp::NotEq, 3, 2)
            }
            TokenKind::Keyword(Keyword::Is) => (BinaryOp::Eq, 3, 1),
            TokenKind::EqEq => (BinaryOp::Eq, 3, 1),
            TokenKind::BangEq => (BinaryOp::NotEq, 3, 1),
            TokenKind::Lt => (BinaryOp::Lt, 3, 1),
            TokenKind::LtEq => (BinaryOp::LtEq, 3, 1),
            TokenKind::Gt => (BinaryOp::Gt, 3, 1),
            TokenKind::GtEq => (BinaryOp::GtEq, 3, 1),
            TokenKind::Plus => (BinaryOp::Add, 4, 1),
            TokenKind::Minus => (BinaryOp::Sub, 4, 1),
            TokenKind::Star => (BinaryOp::Mul, 5, 1),
            TokenKind::Keyword(Keyword::Div) => (BinaryOp::Div, 5, 1),
            TokenKind::Keyword(Keyword::Mod) => (BinaryOp::Mod, 5, 1),
            _ => return None,
        })
    }

    /// Precedence climbing: parses operators binding at least as tightly as `min`.
    fn binary(&mut self, min: u8) -> Parse<Expr> {
        let mut left = self.unary()?;
        while let Some((op, precedence, width)) = self.binary_op() {
            if precedence < min {
                break;
            }
            if matches!(self.peek(), TokenKind::EqEq | TokenKind::BangEq) {
                let span = self.span();
                let word = if op == BinaryOp::Eq { "is" } else { "is not" };
                self.diagnostics.error(
                    "A1113",
                    span,
                    format!(
                        "Arno compares with words: write '{word}' instead of '{}'.",
                        self.peek().describe().trim_matches('\'')
                    ),
                );
            }
            for _ in 0..width {
                self.bump();
            }
            let right = self.binary(precedence.saturating_add(1))?;
            if precedence == 3
                && let Some((_, 3, _)) = self.binary_op()
            {
                let span = self.span();
                self.diagnostics.error(
                    "A1108",
                    span,
                    "Comparisons cannot be chained. Join them with 'and', for example 'a < b and b < c'.",
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

/// Leaving at the very end of a body does nothing, so a `return X;` in tail position (last
/// in the body, or last in a final `if`, `else` or `switch` arm) becomes just the assignment
/// of `X` to the result. Loops are not entered: there, leaving ends more than the iteration.
fn drop_trailing_exit(body: &mut Block) {
    strip_tail(&mut body.stmts);
}

fn strip_tail(stmts: &mut Vec<Stmt>) {
    let Some(last) = stmts.last_mut() else {
        return;
    };
    match &mut last.kind {
        StmtKind::Exit => {
            stmts.pop();
        }
        StmtKind::Block(inner) => {
            strip_tail(&mut inner.stmts);
            if inner.stmts.len() == 1
                && let Some(only) = inner.stmts.pop()
            {
                *last = only;
            }
        }
        StmtKind::If {
            then, otherwise, ..
        } => {
            strip_tail_stmt(then);
            if let Some(otherwise) = otherwise {
                strip_tail_stmt(otherwise);
            }
        }
        StmtKind::Case {
            arms, otherwise, ..
        } => {
            for arm in arms {
                strip_tail_stmt(&mut arm.body);
            }
            if let Some(otherwise) = otherwise {
                strip_tail_stmt(otherwise);
            }
        }
        _ => {}
    }
}

fn strip_tail_stmt(stmt: &mut Stmt) {
    let mut one = vec![std::mem::replace(
        stmt,
        Stmt {
            kind: StmtKind::Empty,
            span: Span::default(),
        },
    )];
    strip_tail(&mut one);
    *stmt = one.pop().unwrap_or(Stmt {
        kind: StmtKind::Empty,
        span: Span::default(),
    });
}

/// Parses a token stream (ending with `Eof`) into a unit. Returns `None` when the file is
/// too broken to give a tree; diagnostics say why either way.
pub fn parse(tokens: &[Token], diagnostics: &mut Diagnostics) -> Option<Unit> {
    let mut parser = Parser {
        tokens,
        position: 0,
        diagnostics,
        depth: 0,
        locals: Vec::new(),
        returns_value: false,
    };
    parser.unit().ok()
}
