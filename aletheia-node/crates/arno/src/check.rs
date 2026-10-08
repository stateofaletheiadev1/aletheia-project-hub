//! Name resolution and type checking (spec Sections 25, 26): turns the syntax tree into the
//! checked program ([`crate::hir`]). The coins and effect rules run afterwards, on the result
//! ([`crate::linear`], [`crate::effects`]).
//!
//! Names are case-insensitive. Two declarations whose names differ only by letter case are an
//! error (A4007); a name declared twice is A4008. Integer literals take the type their context
//! expects, and nothing else converts implicitly (A5001).

use std::collections::{BTreeMap, BTreeSet};

use crate::ast::{self, BinaryOp, Directive, ExprKind as A, RoutineKind, StmtKind as S, UnaryOp};
use crate::diagnostics::Diagnostics;
use crate::hir::{
    Builtin, EnumDef, ErrorDef, EventDef, Expr, ExprKind, Local, LocalId, Method, Place, Program,
    RecordDef, RoutineDef, Stmt, StmtKind, StorageField,
};
use crate::source::Span;
use crate::types::{Asset, Ty, TypeNames};

/// Upper bounds on sizes in types, keeping every value bounded (Section 25: deterministic).
pub const MAX_COLLECTION: u128 = 65_536;
pub const MAX_TEXT_BYTES: u128 = 16 * 1024;

#[derive(Debug, Clone)]
struct Signature {
    params: Vec<Ty>,
    returns: Option<Ty>,
    kind: RoutineKind,
    name: String,
}

struct Checker<'a> {
    diagnostics: &'a mut Diagnostics,
    program: Program,
    uses: BTreeSet<String>,
    /// Every global declaration by lowercase name: spelling and span (A4007, A4008).
    declared: BTreeMap<String, (String, Span)>,
    consts: BTreeMap<String, u128>,
    types: BTreeMap<String, Ty>,
    variants: BTreeMap<String, (u16, u16)>,
    errors: BTreeMap<String, u16>,
    events: BTreeMap<String, u16>,
    storage: BTreeMap<String, u16>,
    routines: BTreeMap<String, u16>,
    signatures: Vec<Signature>,
}

/// Per-routine state while checking a body.
struct Body {
    locals: Vec<Local>,
    scope: BTreeMap<String, LocalId>,
    result: Option<LocalId>,
    /// Loop variables cannot be assigned inside their loop.
    loop_vars: BTreeSet<LocalId>,
}

fn key(name: &str) -> String {
    name.to_ascii_lowercase()
}

/// Names the language and standard library give meaning to; a contract cannot declare them.
const RESERVED_NAMES: &[&str] = &[
    "boolean",
    "uint8",
    "uint16",
    "uint32",
    "uint64",
    "uint128",
    "int64",
    "address",
    "hash",
    "height",
    "slot",
    "epoch",
    "signer",
    "text",
    "bytes",
    "list",
    "map",
    "optional",
    "coins",
    "vault",
    "aey",
    "alnt",
    "transfer",
    "split",
    "join",
    "muldiv",
    "min",
    "max",
    "blake3",
    "verifyed25519",
    "some",
    "nothing",
    "chain",
    "result",
    "rounddown",
    "roundup",
];

fn reserved(ident: &ast::Ident) -> bool {
    RESERVED_NAMES.contains(&ident.key().as_str())
}

fn len_u16(len: usize) -> u16 {
    u16::try_from(len).unwrap_or(u16::MAX)
}

impl TypeNames for Checker<'_> {
    fn enum_name(&self, id: u16) -> &str {
        self.program.enum_name(id)
    }
    fn record_name(&self, id: u16) -> &str {
        self.program.record_name(id)
    }
}

impl Checker<'_> {
    fn error(&mut self, code: &'static str, span: Span, message: impl Into<String>) {
        self.diagnostics.error(code, span, message);
    }

    fn uses(&self, unit: &str) -> bool {
        self.uses.contains(&key(unit))
    }

    fn require_unit(&mut self, unit: &str, what: &str, span: Span) {
        if !self.uses(unit) {
            self.error(
                "A6004",
                span,
                format!(
                    "'{what}' comes from {unit}. Add '{}' to the uses list.",
                    unit.strip_prefix("Std.").unwrap_or(unit)
                ),
            );
        }
    }

    /// Records a global declaration; reports duplicates and case clashes.
    fn declare(&mut self, ident: &ast::Ident) -> bool {
        if reserved(ident) {
            self.error(
                "A4012",
                ident.span,
                format!(
                    "'{}' is a name Arno already uses. Choose a different name.",
                    ident.name
                ),
            );
            return false;
        }
        let lower = ident.key();
        if let Some((spelling, span)) = self.declared.get(&lower).cloned() {
            if spelling == ident.name {
                self.error(
                    "A4008",
                    ident.span,
                    format!(
                        "'{}' is already declared. Use a different name.",
                        ident.name
                    ),
                );
            } else {
                self.error(
                    "A4007",
                    ident.span,
                    format!(
                        "'{}' and '{}' differ only by letter case. Use one name.",
                        spelling, ident.name
                    ),
                );
            }
            let _ = span;
            return false;
        }
        self.declared
            .insert(lower, (ident.name.clone(), ident.span));
        true
    }

    // ---- constants and types ----

    fn const_eval(&mut self, expr: &ast::Expr) -> Option<u128> {
        let overflow = |this: &mut Self| {
            this.error(
                "A5008",
                expr.span,
                "This constant expression overflows or divides by zero.",
            );
            None
        };
        match &expr.kind {
            A::Int(value) => Some(*value),
            A::Name(ident) => match self.consts.get(&ident.key()) {
                Some(value) => Some(*value),
                None => {
                    self.error(
                        "A5009",
                        expr.span,
                        format!(
                            "'{}' is not a constant. Sizes and loop bounds must be constants.",
                            ident.name
                        ),
                    );
                    None
                }
            },
            A::Binary(op, left, right) => {
                let (left, right) = (self.const_eval(left)?, self.const_eval(right)?);
                let value = match op {
                    BinaryOp::Add => left.checked_add(right),
                    BinaryOp::Sub => left.checked_sub(right),
                    BinaryOp::Mul => left.checked_mul(right),
                    BinaryOp::Div => left.checked_div(right),
                    BinaryOp::Mod => left.checked_rem(right),
                    _ => {
                        self.error(
                            "A5009",
                            expr.span,
                            "Only + - * div mod may appear in a constant.",
                        );
                        return None;
                    }
                };
                value.or_else(|| overflow(self))
            }
            _ => {
                self.error(
                    "A5009",
                    expr.span,
                    "This must be a constant: a number, a named constant, or + - * div mod of those.",
                );
                None
            }
        }
    }

    /// A positive constant size within `max`, as u32.
    fn size(&mut self, expr: &ast::Expr, max: u128, what: &str) -> u32 {
        match self.const_eval(expr) {
            Some(0) => {
                self.error("A5015", expr.span, format!("{what} must be at least 1."));
                1
            }
            Some(value) if value > max => {
                self.error("A5015", expr.span, format!("{what} may be at most {max}."));
                1
            }
            Some(value) => u32::try_from(value).unwrap_or(1),
            None => 1,
        }
    }

    fn asset(&mut self, name: &ast::QualIdent) -> Option<Asset> {
        self.require_unit("Std.Coins", "Coins", name.span);
        let last = name.parts.last()?;
        let asset = Asset::from_name(&last.name);
        if asset.is_none() {
            self.error(
                "A5016",
                name.span,
                format!(
                    "'{}' is not a known asset. Arno 0.1 knows AEY and ALnT.",
                    name.text()
                ),
            );
        }
        asset
    }

    fn resolve_type(&mut self, ty: &ast::TypeExpr) -> Ty {
        use ast::TypeExprKind as T;
        match &ty.kind {
            T::Named(name) => {
                let [ident] = name.parts.as_slice() else {
                    self.error(
                        "A5017",
                        ty.span,
                        format!("There is no type named '{}'.", name.text()),
                    );
                    return Ty::Error;
                };
                let builtin = match ident.key().as_str() {
                    "boolean" => Some(Ty::Bool),
                    "uint8" => Some(Ty::U8),
                    "uint16" => Some(Ty::U16),
                    "uint32" => Some(Ty::U32),
                    "uint64" => Some(Ty::U64),
                    "uint128" => Some(Ty::U128),
                    "int64" => Some(Ty::I64),
                    "address" => Some(Ty::Address),
                    "hash" => Some(Ty::Hash),
                    "height" => Some(Ty::Height),
                    "slot" => Some(Ty::Slot),
                    "epoch" => Some(Ty::Epoch),
                    "signer" => {
                        self.require_unit("Std.Auth", "Signer", ty.span);
                        Some(Ty::Signer)
                    }
                    _ => None,
                };
                if let Some(builtin) = builtin {
                    return builtin;
                }
                match self.types.get(&ident.key()) {
                    Some(found) => found.clone(),
                    None => {
                        let hint = match ident.key().as_str() {
                            "real" | "double" | "single" | "float" => {
                                " Arno has no floating-point types; use whole numbers of base units."
                            }
                            "text" => " Write 'Text max N' with a maximum length.",
                            "bytes" => " Write 'Bytes[N]' or 'Bytes max N'.",
                            _ => "",
                        };
                        self.error(
                            "A5017",
                            ty.span,
                            format!("There is no type named '{}'.{hint}", ident.name),
                        );
                        Ty::Error
                    }
                }
            }
            T::List { elem, max } => {
                let elem = self.resolve_type(elem);
                let max = self.size(max, MAX_COLLECTION, "A list's maximum");
                Ty::List {
                    max,
                    elem: Box::new(elem),
                }
            }
            T::Map { key: k, value } => {
                let k = self.resolve_type(k);
                if !matches!(
                    k,
                    Ty::U8
                        | Ty::U16
                        | Ty::U32
                        | Ty::U64
                        | Ty::U128
                        | Ty::I64
                        | Ty::Address
                        | Ty::Hash
                        | Ty::Enum(_)
                        | Ty::Height
                        | Ty::Slot
                        | Ty::Epoch
                        | Ty::BytesFixed(_)
                        | Ty::Error
                ) {
                    let described = self.describe(&k);
                    self.error(
                        "A5018",
                        ty.span,
                        format!("{described} cannot be a map key. Use a number, Address, Hash, enumeration or Bytes[N]."),
                    );
                }
                Ty::Map {
                    key: Box::new(k),
                    value: Box::new(self.resolve_type(value)),
                }
            }
            T::Optional(elem) => Ty::Optional(Box::new(self.resolve_type(elem))),
            T::Coins(asset) => self.asset(asset).map_or(Ty::Error, Ty::Coins),
            T::Vault(asset) => self.asset(asset).map_or(Ty::Error, Ty::Vault),
            T::Text(max) => Ty::Text(self.size(max, MAX_TEXT_BYTES, "A text's maximum length")),
            T::BytesFixed(n) => Ty::BytesFixed(self.size(n, MAX_TEXT_BYTES, "A byte count")),
            T::BytesMax(n) => Ty::BytesMax(self.size(n, MAX_TEXT_BYTES, "A byte maximum")),
            T::Array { low, high, elem } => {
                if self.const_eval(low) != Some(1) {
                    self.error(
                        "A5007",
                        low.span,
                        "Arrays start at 1 in Arno 0.1, as in 'array[1..N]'.",
                    );
                }
                let len = self.size(high, MAX_COLLECTION, "An array's length");
                Ty::Array {
                    len,
                    elem: Box::new(self.resolve_type(elem)),
                }
            }
        }
    }

    fn declarations(&mut self, unit: &ast::Unit) {
        for used in &unit.uses {
            // `uses Coins` is short for `uses Std.Coins`.
            let name = match used.parts.as_slice() {
                [only] => format!("Std.{}", only.name),
                _ => used.text(),
            };
            let known = [
                "Std.Coins",
                "Std.Auth",
                "Std.Chain",
                "Std.Crypto",
                "Std.Identity",
                "Std.Math",
                "Std.Text",
            ];
            if !known.iter().any(|k| k.eq_ignore_ascii_case(&name)) {
                self.error(
                    "A6008",
                    used.span,
                    format!(
                        "There is no standard unit named '{}'. Known units: {}.",
                        used.text(),
                        known
                            .iter()
                            .map(|k| k.trim_start_matches("Std."))
                            .collect::<Vec<_>>()
                            .join(", ")
                    ),
                );
            }
            self.uses.insert(key(&name));
        }
        for declaration in &unit.consts {
            if self.declare(&declaration.name)
                && let Some(value) = self.const_eval(&declaration.value)
            {
                self.consts.insert(declaration.name.key(), value);
            }
        }
        for declaration in &unit.types {
            if !self.declare(&declaration.name) {
                continue;
            }
            let ty = match &declaration.def {
                ast::TypeDef::Enum(variants) => {
                    let id = len_u16(self.program.enums.len());
                    for (index, variant) in variants.iter().enumerate() {
                        if self.declare(variant) {
                            self.variants.insert(variant.key(), (id, len_u16(index)));
                        }
                    }
                    if variants.len() > 256 {
                        self.error(
                            "A5019",
                            declaration.name.span,
                            "An enumeration has at most 256 values.",
                        );
                    }
                    self.program.enums.push(EnumDef {
                        name: declaration.name.name.clone(),
                        variants: variants.iter().map(|v| v.name.clone()).collect(),
                    });
                    Ty::Enum(id)
                }
                ast::TypeDef::Record(groups) => {
                    let mut fields: Vec<(String, Ty)> = Vec::new();
                    let mut seen: BTreeMap<String, String> = BTreeMap::new();
                    for group in groups {
                        let ty = self.resolve_type(&group.ty);
                        if ty.contains_coins_or_signer() {
                            self.error(
                                "A2007",
                                group.ty.span,
                                "A record cannot hold Coins or a Signer.",
                            );
                        }
                        for name in &group.names {
                            if let Some(spelling) = seen.get(&name.key()) {
                                let (code, message) = if *spelling == name.name {
                                    (
                                        "A4008",
                                        format!(
                                            "'{}' is already a field of this record.",
                                            name.name
                                        ),
                                    )
                                } else {
                                    (
                                        "A4007",
                                        format!(
                                            "'{spelling}' and '{}' differ only by letter case. Use one name.",
                                            name.name
                                        ),
                                    )
                                };
                                self.error(code, name.span, message);
                                continue;
                            }
                            seen.insert(name.key(), name.name.clone());
                            fields.push((name.name.clone(), ty.clone()));
                        }
                    }
                    let id = len_u16(self.program.records.len());
                    self.program.records.push(RecordDef {
                        name: declaration.name.name.clone(),
                        fields,
                    });
                    Ty::Record(id)
                }
                ast::TypeDef::Alias(ty) => self.resolve_type(ty),
            };
            self.types.insert(declaration.name.key(), ty);
        }
        for declaration in &unit.errors {
            if self.declare(&declaration.name) {
                self.errors
                    .insert(declaration.name.key(), len_u16(self.program.errors.len()));
                self.program.errors.push(ErrorDef {
                    name: declaration.name.name.clone(),
                    message: declaration.message.clone(),
                });
            }
        }
        for declaration in &unit.events {
            if !self.declare(&declaration.name) {
                continue;
            }
            let mut fields = Vec::new();
            for group in &declaration.params {
                let ty = self.resolve_type(&group.ty);
                if ty.contains_coins_or_signer() || matches!(ty, Ty::Vault(_) | Ty::Map { .. }) {
                    self.error("A5020", group.ty.span, "An event field must be a plain value, not coins, a vault, a map or a signer.");
                }
                fields.extend(group.names.iter().map(|n| (n.name.clone(), ty.clone())));
            }
            self.events
                .insert(declaration.name.key(), len_u16(self.program.events.len()));
            self.program.events.push(EventDef {
                name: declaration.name.name.clone(),
                fields,
            });
        }
        for group in &unit.storage {
            let ty = self.resolve_type(&group.ty);
            if matches!(ty, Ty::Coins(_)) {
                self.error(
                    "A2007",
                    group.ty.span,
                    "Coins cannot be kept in storage. Use a 'Vault of' the asset instead.",
                );
            } else if ty.contains_coins_or_signer() {
                self.error(
                    "A5014",
                    group.ty.span,
                    "A Signer exists only during a transaction and cannot be stored.",
                );
            }
            for name in &group.names {
                if self.declare(name) {
                    self.storage
                        .insert(name.key(), len_u16(self.program.storage.len()));
                    self.program.storage.push(StorageField {
                        name: name.name.clone(),
                        ty: ty.clone(),
                    });
                }
            }
        }
    }

    fn signatures(&mut self, unit: &ast::Unit) {
        let mut constructors = 0usize;
        for routine in &unit.routines {
            if routine.kind == RoutineKind::Constructor {
                constructors = constructors.saturating_add(1);
                if constructors > 1 {
                    self.error(
                        "A3008",
                        routine.name.span,
                        "A contract has at most one constructor.",
                    );
                }
            }
            self.declare(&routine.name);
            let mut params = Vec::new();
            for group in &routine.params {
                let ty = self.resolve_type(&group.ty);
                if matches!(ty, Ty::Vault(_) | Ty::Map { .. }) {
                    self.error(
                        "A5013",
                        group.ty.span,
                        "Vaults and maps live only in storage; they cannot be parameters.",
                    );
                }
                params.extend(group.names.iter().map(|_| ty.clone()));
            }
            let returns = routine.returns.as_ref().map(|ty| self.resolve_type(ty));
            match (routine.kind, &returns) {
                (RoutineKind::Function, None) => self.error(
                    "A5012",
                    routine.name.span,
                    format!("Function '{}' needs a result type, as in 'function {}() returns UInt128'.", routine.name.name, routine.name.name),
                ),
                (RoutineKind::Procedure | RoutineKind::Constructor, Some(_)) => self.error(
                    "A5012",
                    routine.name.span,
                    "Only a function returns a value. Make this a function, or remove the result type.",
                ),
                _ => {}
            }
            for (directive, span) in &routine.directives {
                match (directive, routine.kind) {
                    (Directive::View, RoutineKind::Procedure | RoutineKind::Constructor) => {
                        self.error("A3003", *span, "A view function gives back a value: add 'returns <Type>'.")
                    }
                    (Directive::Entry, RoutineKind::Function) => self.error(
                        "A3004",
                        *span,
                        "A public function that returns a value must be a view: write 'public view function'.",
                    ),
                    _ => {}
                }
            }
            let entry = routine.has(Directive::Entry) || routine.kind == RoutineKind::Constructor;
            if entry && params.first() != Some(&Ty::Signer) {
                self.error(
                    "A3006",
                    routine.name.span,
                    if routine.kind == RoutineKind::Constructor {
                        "The constructor must take the caller's Signer as its first parameter.".to_owned()
                    } else {
                        format!(
                            "Public function '{}' must take the caller's Signer as its first parameter.",
                            routine.name.name
                        )
                    },
                );
            }
            if !entry && params.contains(&Ty::Signer) {
                self.error(
                    "A3007",
                    routine.name.span,
                    "Only a public function or the constructor receives a Signer.",
                );
            }
            self.routines
                .insert(routine.name.key(), len_u16(self.signatures.len()));
            self.signatures.push(Signature {
                params,
                returns,
                kind: routine.kind,
                name: routine.name.name.clone(),
            });
        }
    }

    // ---- bodies ----

    fn routine(&mut self, routine: &ast::Routine, index: u16) -> RoutineDef {
        let signature = self.signatures.get(usize::from(index)).cloned();
        let mut body = Body {
            locals: Vec::new(),
            scope: BTreeMap::new(),
            result: None,
            loop_vars: BTreeSet::new(),
        };
        let mut param_types = signature
            .as_ref()
            .map_or_else(Vec::new, |s| s.params.clone())
            .into_iter();
        for group in &routine.params {
            for name in &group.names {
                let ty = param_types.next().unwrap_or(Ty::Error);
                self.add_local(&mut body, name, ty);
            }
        }
        let params = len_u16(body.locals.len());
        for group in &routine.vars {
            let ty = self.resolve_type(&group.ty);
            if matches!(ty, Ty::Vault(_) | Ty::Map { .. }) {
                self.error(
                    "A5013",
                    group.ty.span,
                    "Vaults and maps live only in storage; they cannot be local variables.",
                );
            }
            for name in &group.names {
                self.add_local(&mut body, name, ty.clone());
            }
        }
        let returns = signature.as_ref().and_then(|s| s.returns.clone());
        if let Some(ty) = &returns {
            let id = len_u16(body.locals.len());
            body.locals.push(Local {
                name: "Result".to_owned(),
                ty: ty.clone(),
                span: routine.name.span,
            });
            body.result = Some(id);
        }
        let stmts = self.block(&mut body, &routine.body.stmts);
        RoutineDef {
            name: routine.name.name.clone(),
            kind: routine.kind,
            params,
            locals: body.locals,
            returns,
            result: body.result,
            directives: routine.directives.iter().map(|(d, _)| *d).collect(),
            declared_effects: routine.effects.iter().map(|(e, _)| *e).collect(),
            body: stmts,
            span: routine.span,
            name_span: routine.name.span,
        }
    }

    fn add_local(&mut self, body: &mut Body, name: &ast::Ident, ty: Ty) {
        if reserved(name) {
            self.error(
                "A4012",
                name.span,
                format!(
                    "'{}' is a name Arno already uses. Choose a different name.",
                    name.name
                ),
            );
        }
        if let Some((spelling, _)) = self.declared.get(&name.key()).cloned() {
            let (code, message) = if spelling == name.name {
                (
                    "A4008",
                    format!(
                        "'{}' is already declared for the whole contract. Use a different name.",
                        name.name
                    ),
                )
            } else {
                (
                    "A4007",
                    format!(
                        "'{spelling}' and '{}' differ only by letter case. Use one name.",
                        name.name
                    ),
                )
            };
            self.error(code, name.span, message);
        }
        if let Some(existing) = body.scope.get(&name.key()).copied() {
            let spelling = body
                .locals
                .get(usize::from(existing))
                .map_or(String::new(), |l| l.name.clone());
            let (code, message) = if spelling == name.name {
                (
                    "A4008",
                    format!(
                        "'{}' is already declared in this function. Each name is declared once per function.",
                        name.name
                    ),
                )
            } else {
                (
                    "A4007",
                    format!(
                        "'{spelling}' and '{}' differ only by letter case. Use one name.",
                        name.name
                    ),
                )
            };
            self.error(code, name.span, message);
            return;
        }
        let id = len_u16(body.locals.len());
        body.scope.insert(name.key(), id);
        body.locals.push(Local {
            name: name.name.clone(),
            ty,
            span: name.span,
        });
    }

    fn local_ty(body: &Body, id: LocalId) -> Ty {
        body.locals
            .get(usize::from(id))
            .map_or(Ty::Error, |l| l.ty.clone())
    }

    fn block(&mut self, body: &mut Body, stmts: &[ast::Stmt]) -> Vec<Stmt> {
        let mut out = Vec::new();
        for stmt in stmts {
            self.stmt(body, stmt, &mut out);
        }
        out
    }

    /// A nested statement as a list (a `begin ... end` block flattens into it).
    fn nested(&mut self, body: &mut Body, stmt: &ast::Stmt) -> Vec<Stmt> {
        let mut out = Vec::new();
        self.stmt(body, stmt, &mut out);
        out
    }

    fn bool_cond(&mut self, body: &mut Body, expr: &ast::Expr) -> Expr {
        let cond = self.expr(body, expr, Some(&Ty::Bool));
        if cond.ty != Ty::Bool && cond.ty != Ty::Error {
            let described = self.describe(&cond.ty);
            self.error(
                "A5011",
                expr.span,
                format!("A condition must be True or False, but this is {described}."),
            );
        }
        cond
    }

    fn stmt(&mut self, body: &mut Body, stmt: &ast::Stmt, out: &mut Vec<Stmt>) {
        let span = stmt.span;
        let kind = match &stmt.kind {
            S::Empty => return,
            S::Block(block) => {
                for inner in &block.stmts {
                    self.stmt(body, inner, out);
                }
                return;
            }
            S::Assign { target, value } => {
                let Some((place, ty)) = self.place(body, target) else {
                    let _ = self.expr(body, value, None);
                    return;
                };
                if let Place::Local(id) = place
                    && body.loop_vars.contains(&id)
                {
                    self.error(
                        "A4010",
                        target.span,
                        "A loop variable cannot be changed inside its loop.",
                    );
                }
                if matches!(ty, Ty::Signer) {
                    self.error("A5021", target.span, "A Signer cannot be replaced.");
                }
                let value = self.expr(body, value, Some(&ty));
                self.expect_type(&value, &ty);
                StmtKind::Assign { place, value }
            }
            S::Call(expr) => {
                let value = self.expr(body, expr, None);
                let is_call = matches!(
                    value.kind,
                    ExprKind::Call { .. }
                        | ExprKind::Method { .. }
                        | ExprKind::Transfer { .. }
                        | ExprKind::Builtin { .. }
                );
                if !is_call && value.ty != Ty::Error {
                    self.error("A1107", expr.span, "This does nothing on its own. A statement assigns with '=' or calls a function.");
                }
                StmtKind::Eval(value)
            }
            S::If {
                cond,
                then,
                otherwise,
            } => {
                let cond = self.bool_cond(body, cond);
                let then = self.nested(body, then);
                let otherwise = otherwise
                    .as_ref()
                    .map_or_else(Vec::new, |o| self.nested(body, o));
                StmtKind::If {
                    cond,
                    then,
                    otherwise,
                }
            }
            S::Case {
                subject,
                arms,
                otherwise,
            } => {
                let subject = self.expr(body, subject, None);
                if !(subject.ty.is_integer() || matches!(subject.ty, Ty::Enum(_) | Ty::Error)) {
                    let described = self.describe(&subject.ty);
                    self.error(
                        "A5022",
                        subject.span,
                        format!("'case' works on numbers and enumerations, not {described}."),
                    );
                }
                let mut seen = BTreeSet::new();
                let mut checked = Vec::new();
                for arm in arms {
                    let mut labels = Vec::new();
                    for label in &arm.labels {
                        let value = self.case_label(body, label, &subject.ty);
                        if let Some(value) = value {
                            if !seen.insert(value) {
                                self.error(
                                    "A4011",
                                    label.span,
                                    "This case label appears more than once.",
                                );
                            }
                            labels.push(value);
                        }
                    }
                    checked.push((labels, self.nested(body, &arm.body)));
                }
                let otherwise = otherwise
                    .as_ref()
                    .map_or_else(Vec::new, |o| self.nested(body, o));
                StmtKind::Case {
                    subject,
                    arms: checked,
                    otherwise,
                }
            }
            S::ForTo {
                var,
                from,
                to,
                body: inner,
            } => {
                let Some(id) = self.loop_var(body, var, Ty::U64) else {
                    return;
                };
                let ty = Self::local_ty(body, id);
                if !ty.is_integer() && ty != Ty::Error {
                    self.error(
                        "A5023",
                        var.span,
                        "A 'for ... to' loop variable must be a whole-number type.",
                    );
                }
                let from_expr = self.expr(body, from, Some(&ty));
                self.expect_type(&from_expr, &ty);
                let Some(last) = self.loop_bound(
                    to,
                    "The end of this for-loop must be a constant, so the loop has a known bound.",
                ) else {
                    return;
                };
                let to_expr = self.expr(body, to, Some(&ty));
                self.expect_type(&to_expr, &ty);
                body.loop_vars.insert(id);
                let inner = self.nested(body, inner);
                body.loop_vars.remove(&id);
                StmtKind::ForRange {
                    var: id,
                    from: from_expr,
                    to: to_expr,
                    bound: u64::try_from(last.saturating_add(1)).unwrap_or(u64::MAX),
                    body: inner,
                }
            }
            S::ForEach {
                var,
                collection,
                body: inner,
            } => {
                let collection = self.expr(body, collection, None);
                let (elem, bound) = match &collection.ty {
                    Ty::List { max, elem } => (elem.as_ref().clone(), u64::from(*max)),
                    Ty::Array { len, elem } => (elem.as_ref().clone(), u64::from(*len)),
                    Ty::Error => (Ty::Error, 0),
                    other => {
                        let described = self.describe(other);
                        self.error(
                            "A4005",
                            collection.span,
                            format!("'for each' needs a list or an array, not {described}."),
                        );
                        (Ty::Error, 0)
                    }
                };
                if elem.is_linear() {
                    self.error(
                        "A2008",
                        collection.span,
                        "Coins cannot be walked over with 'for each'.",
                    );
                }
                let Some(id) = self.loop_var(body, var, elem.clone()) else {
                    return;
                };
                let var_ty = Self::local_ty(body, id);
                if var_ty != elem && elem != Ty::Error && var_ty != Ty::Error {
                    let (v, e) = (self.describe(&var_ty), self.describe(&elem));
                    self.error(
                        "A5002",
                        var.span,
                        format!("'{}' is {v}, but the items are {e}.", var.name),
                    );
                }
                body.loop_vars.insert(id);
                let inner = self.nested(body, inner);
                body.loop_vars.remove(&id);
                StmtKind::ForEach {
                    var: id,
                    collection,
                    bound,
                    body: inner,
                }
            }
            S::While {
                cond,
                bound,
                body: inner,
            } => {
                let cond = self.bool_cond(body, cond);
                let bound = match bound {
                    Some(bound) => self
                        .loop_bound(
                            bound,
                            "A while-loop's bound must be a constant, as in 'at most 100 times'.",
                        )
                        .unwrap_or(1),
                    None => 1,
                };
                let inner = self.nested(body, inner);
                StmtKind::While {
                    cond,
                    bound: u64::try_from(bound).unwrap_or(u64::MAX),
                    body: inner,
                }
            }
            S::Require { cond, error } => {
                let cond = self.bool_cond(body, cond);
                let Some(error) = self.error_ref(error) else {
                    return;
                };
                StmtKind::Require { cond, error }
            }
            S::Fail(error) => {
                let Some(error) = self.error_ref(error) else {
                    return;
                };
                StmtKind::Fail(error)
            }
            S::Emit { event, args } => {
                let Some(index) = self.events.get(&event.key()).copied() else {
                    self.error(
                        "A6007",
                        event.span,
                        format!(
                            "There is no event named '{}'. Declare it with 'event {}(...);'.",
                            event.name, event.name
                        ),
                    );
                    return;
                };
                let fields = self
                    .program
                    .events
                    .get(usize::from(index))
                    .map_or_else(Vec::new, |e| e.fields.clone());
                if fields.len() != args.len() {
                    self.error(
                        "A6009",
                        stmt.span,
                        format!(
                            "Event '{}' has {} fields, but {} values are given.",
                            event.name,
                            fields.len(),
                            args.len()
                        ),
                    );
                }
                let args = args
                    .iter()
                    .zip(
                        fields
                            .iter()
                            .map(|(_, ty)| Some(ty))
                            .chain(std::iter::repeat(None)),
                    )
                    .map(|(arg, ty)| {
                        let value = self.expr(body, arg, ty);
                        if let Some(ty) = ty {
                            self.expect_type(&value, ty);
                        }
                        value
                    })
                    .collect();
                StmtKind::Emit { event: index, args }
            }
            S::Exit => StmtKind::Exit,
        };
        out.push(Stmt { kind, span });
    }

    /// The loop variable: the one already declared under that name, or a new one of type
    /// `inferred` (the items' type for `for each`, UInt64 when counting).
    fn loop_var(&mut self, body: &mut Body, var: &ast::Ident, inferred: Ty) -> Option<LocalId> {
        if let Some(id) = body.scope.get(&var.key()).copied() {
            return Some(id);
        }
        self.add_local(body, var, inferred);
        body.scope.get(&var.key()).copied()
    }

    fn loop_bound(&mut self, expr: &ast::Expr, message: &str) -> Option<u128> {
        let constant = match &expr.kind {
            A::Int(_) => true,
            A::Name(ident) => self.consts.contains_key(&ident.key()),
            A::Binary(..) => true,
            _ => false,
        };
        if !constant {
            self.error("A4003", expr.span, message);
            return None;
        }
        self.const_eval(expr)
    }

    fn error_ref(&mut self, error: &ast::Ident) -> Option<u16> {
        let found = self.errors.get(&error.key()).copied();
        if found.is_none() {
            self.error(
                "A6003",
                error.span,
                format!(
                    "There is no error named '{}'. Declare it with 'error {} \"...\";'.",
                    error.name, error.name
                ),
            );
        }
        found
    }

    fn case_label(&mut self, body: &mut Body, label: &ast::Expr, subject: &Ty) -> Option<u128> {
        match (&label.kind, subject) {
            (A::Name(ident), Ty::Enum(enumeration)) => match self.variants.get(&ident.key()) {
                Some((e, variant)) if e == enumeration => Some(u128::from(*variant)),
                _ => {
                    let described = self.describe(subject);
                    self.error(
                        "A5002",
                        label.span,
                        format!("'{}' is not a value of {described}.", ident.name),
                    );
                    None
                }
            },
            (_, ty) if ty.is_integer() => {
                let value = self.const_eval(label)?;
                if !ty.fits(value) {
                    let described = self.describe(ty);
                    self.error(
                        "A5003",
                        label.span,
                        format!("The number {value} does not fit in {described}."),
                    );
                }
                Some(value)
            }
            _ => {
                let _ = self.expr(body, label, None);
                None
            }
        }
    }

    /// Reports a type mismatch between a checked value and the type its context needs.
    fn expect_type(&mut self, value: &Expr, expected: &Ty) {
        if value.ty == *expected || value.ty == Ty::Error || *expected == Ty::Error {
            return;
        }
        if value.ty == Ty::Unit {
            self.error(
                "A6016",
                value.span,
                "This call does not produce a value, so it cannot be used here.",
            );
            return;
        }
        let (found, wanted) = (self.describe(&value.ty), self.describe(expected));
        if value.ty.is_ordered() && expected.is_ordered() {
            self.error(
                "A5001",
                value.span,
                format!("Implicit conversion from {found} to {wanted} is not allowed. Use {wanted}(...) with a range check."),
            );
        } else {
            self.error(
                "A5002",
                value.span,
                format!("Expected {wanted} here, but this is {found}."),
            );
        }
    }

    /// Resolves an assignable location.
    fn place(&mut self, body: &mut Body, expr: &ast::Expr) -> Option<(Place, Ty)> {
        match &expr.kind {
            A::Name(ident) => {
                if let Some(id) = body.scope.get(&ident.key()).copied() {
                    return Some((Place::Local(id), Self::local_ty(body, id)));
                }
                if ident.is("Result")
                    && let Some(id) = body.result
                {
                    return Some((Place::Local(id), Self::local_ty(body, id)));
                }
                if let Some(slot) = self.storage.get(&ident.key()).copied() {
                    let ty = self
                        .program
                        .storage
                        .get(usize::from(slot))
                        .map_or(Ty::Error, |f| f.ty.clone());
                    return Some((Place::Storage(slot), ty));
                }
                self.error(
                    "A6005",
                    ident.span,
                    format!(
                        "'{}' is not a variable or storage field that can be assigned.",
                        ident.name
                    ),
                );
                None
            }
            A::Field(base, member) => {
                let (place, ty) = self.place(body, base)?;
                let Ty::Record(record) = ty else {
                    let described = self.describe(&ty);
                    self.error(
                        "A5024",
                        member.span,
                        format!(
                            "{described} has no field '{}' that can be assigned.",
                            member.name
                        ),
                    );
                    return None;
                };
                let fields = self
                    .program
                    .records
                    .get(usize::from(record))
                    .map_or_else(Vec::new, |r| r.fields.clone());
                match fields
                    .iter()
                    .position(|(name, _)| name.eq_ignore_ascii_case(&member.name))
                {
                    Some(index) => {
                        let ty = fields.get(index).map_or(Ty::Error, |(_, t)| t.clone());
                        Some((Place::Field(Box::new(place), len_u16(index)), ty))
                    }
                    None => {
                        let name = self.program.record_name(record).to_owned();
                        self.error(
                            "A5024",
                            member.span,
                            format!("Record '{name}' has no field '{}'.", member.name),
                        );
                        None
                    }
                }
            }
            A::Index(base, index) => {
                let (place, ty) = self.place(body, base)?;
                let elem = match ty {
                    Ty::Array { elem, .. } | Ty::List { elem, .. } => *elem,
                    other => {
                        let described = self.describe(&other);
                        self.error(
                            "A5025",
                            base.span,
                            format!("{described} cannot be indexed with [ ]."),
                        );
                        return None;
                    }
                };
                let index = self.expr(body, index, Some(&Ty::U64));
                self.expect_type(&index, &Ty::U64);
                Some((Place::Index(Box::new(place), Box::new(index)), elem))
            }
            _ => {
                self.error("A6010", expr.span, "Only a variable, a storage field, a record field or a list item can be assigned.");
                None
            }
        }
    }

    fn typed(kind: ExprKind, ty: Ty, span: Span) -> Expr {
        Expr { kind, ty, span }
    }

    fn poison(span: Span) -> Expr {
        Self::typed(ExprKind::Bool(false), Ty::Error, span)
    }

    fn int(&mut self, value: u128, expected: Option<&Ty>, span: Span) -> Expr {
        let ty = match expected {
            Some(ty) if ty.is_integer() => ty.clone(),
            _ => Ty::U128,
        };
        if !ty.fits(value) {
            let described = self.describe(&ty);
            self.error(
                "A5003",
                span,
                format!("The number {value} does not fit in {described}."),
            );
        }
        Self::typed(ExprKind::Int(value), ty, span)
    }

    fn expr(&mut self, body: &mut Body, expr: &ast::Expr, expected: Option<&Ty>) -> Expr {
        let span = expr.span;
        match &expr.kind {
            A::Int(value) => self.int(*value, expected, span),
            A::Bool(value) => Self::typed(ExprKind::Bool(*value), Ty::Bool, span),
            A::Str(text) => {
                let len = u32::try_from(text.len()).unwrap_or(u32::MAX);
                let ty = match expected {
                    Some(Ty::Text(max)) => {
                        if len > *max {
                            self.error(
                                "A5004",
                                span,
                                format!("This text is {len} bytes long; at most {max} fit here."),
                            );
                        }
                        Ty::Text(*max)
                    }
                    _ => Ty::Text(len.max(1)),
                };
                Self::typed(ExprKind::Text(text.clone()), ty, span)
            }
            A::Move(ident) => {
                match body.scope.get(&ident.key()).copied() {
                    Some(id) => {
                        let ty = Self::local_ty(body, id);
                        if !ty.is_linear() && ty != Ty::Error {
                            self.error("A2006", span, format!("Only Coins are handed over with 'move'; '{}' is a plain value.", ident.name));
                        }
                        Self::typed(ExprKind::Move(id), ty, span)
                    }
                    None => {
                        self.error(
                            "A6005",
                            ident.span,
                            format!("There is no variable named '{}' to move.", ident.name),
                        );
                        Self::poison(span)
                    }
                }
            }
            A::Name(ident) => self.name(body, ident, expected, span),
            A::Field(base, member) => self.member(body, base, member, expected, span),
            A::Index(..) => match self.place(body, expr) {
                Some((place, ty)) => Self::typed(ExprKind::Read(place), ty, span),
                None => Self::poison(span),
            },
            A::Call { callee, args } => self.call(body, callee, args, expected, span),
            A::Unary(UnaryOp::Not, operand) => {
                let operand = self.expr(body, operand, Some(&Ty::Bool));
                self.expect_type(&operand, &Ty::Bool);
                Self::typed(
                    ExprKind::Unary(UnaryOp::Not, Box::new(operand)),
                    Ty::Bool,
                    span,
                )
            }
            A::Unary(UnaryOp::Neg, operand) => {
                let operand = self.expr(body, operand, Some(&Ty::I64));
                if operand.ty != Ty::I64 && operand.ty != Ty::Error {
                    self.error(
                        "A5010",
                        span,
                        "Only Int64 values can be negative. Unsigned numbers cannot be negated.",
                    );
                }
                let ty = operand.ty.clone();
                Self::typed(ExprKind::Unary(UnaryOp::Neg, Box::new(operand)), ty, span)
            }
            A::Binary(op, left, right) => self.binary(body, *op, left, right, expected, span),
        }
    }

    fn binary(
        &mut self,
        body: &mut Body,
        op: BinaryOp,
        left: &ast::Expr,
        right: &ast::Expr,
        expected: Option<&Ty>,
        span: Span,
    ) -> Expr {
        let logical = matches!(op, BinaryOp::And | BinaryOp::Or | BinaryOp::Xor);
        if logical {
            let l = self.expr(body, left, Some(&Ty::Bool));
            let r = self.expr(body, right, Some(&Ty::Bool));
            self.expect_type(&l, &Ty::Bool);
            self.expect_type(&r, &Ty::Bool);
            return Self::typed(
                ExprKind::Binary(op, Box::new(l), Box::new(r)),
                Ty::Bool,
                span,
            );
        }
        let comparison = matches!(
            op,
            BinaryOp::Eq
                | BinaryOp::NotEq
                | BinaryOp::Lt
                | BinaryOp::LtEq
                | BinaryOp::Gt
                | BinaryOp::GtEq
        );
        // A literal takes the other side's type, so check the non-literal first.
        let operand_hint = if comparison { None } else { expected };
        let (l, r) = if matches!(left.kind, A::Int(_)) && !matches!(right.kind, A::Int(_)) {
            let r = self.expr(body, right, operand_hint);
            let l = self.expr(body, left, Some(&r.ty));
            (l, r)
        } else {
            let l = self.expr(body, left, operand_hint);
            let r = self.expr(body, right, Some(&l.ty));
            (l, r)
        };
        if l.ty == Ty::Error || r.ty == Ty::Error {
            return Self::poison(span);
        }
        if l.ty != r.ty {
            let (a, b) = (self.describe(&l.ty), self.describe(&r.ty));
            let code = if l.ty.is_ordered() && r.ty.is_ordered() {
                "A5001"
            } else {
                "A5002"
            };
            self.error(code, span, format!("'{}' needs both sides to be the same type, but they are {a} and {b}. Convert one with {a}(...) or {b}(...).", op.symbol()));
            return Self::poison(span);
        }
        if comparison {
            let ordering = !matches!(op, BinaryOp::Eq | BinaryOp::NotEq);
            let comparable = matches!(
                l.ty,
                Ty::Bool
                    | Ty::Address
                    | Ty::Hash
                    | Ty::Enum(_)
                    | Ty::Text(_)
                    | Ty::BytesFixed(_)
                    | Ty::BytesMax(_)
            ) || l.ty.is_ordered();
            if (ordering && !l.ty.is_ordered()) || !comparable {
                let described = self.describe(&l.ty);
                self.error(
                    "A5026",
                    span,
                    format!(
                        "{described} values cannot be compared with '{}'.",
                        op.symbol()
                    ),
                );
                return Self::poison(span);
            }
            return Self::typed(
                ExprKind::Binary(op, Box::new(l), Box::new(r)),
                Ty::Bool,
                span,
            );
        }
        if !l.ty.is_integer() {
            let described = self.describe(&l.ty);
            self.error(
                "A5027",
                span,
                format!("'{}' works on whole numbers, not {described}.", op.symbol()),
            );
            return Self::poison(span);
        }
        let ty = l.ty.clone();
        Self::typed(ExprKind::Binary(op, Box::new(l), Box::new(r)), ty, span)
    }

    fn name(
        &mut self,
        body: &mut Body,
        ident: &ast::Ident,
        expected: Option<&Ty>,
        span: Span,
    ) -> Expr {
        let k = ident.key();
        if let Some(id) = body.scope.get(&k).copied() {
            let ty = Self::local_ty(body, id);
            return Self::typed(ExprKind::Read(Place::Local(id)), ty, span);
        }
        if ident.is("Result")
            && let Some(id) = body.result
        {
            let ty = Self::local_ty(body, id);
            return Self::typed(ExprKind::Read(Place::Local(id)), ty, span);
        }
        if let Some(slot) = self.storage.get(&k).copied() {
            let ty = self
                .program
                .storage
                .get(usize::from(slot))
                .map_or(Ty::Error, |f| f.ty.clone());
            return Self::typed(ExprKind::Read(Place::Storage(slot)), ty, span);
        }
        if let Some(value) = self.consts.get(&k).copied() {
            return self.int(value, expected, span);
        }
        if let Some((enumeration, variant)) = self.variants.get(&k).copied() {
            return Self::typed(
                ExprKind::EnumVariant {
                    enumeration,
                    variant,
                },
                Ty::Enum(enumeration),
                span,
            );
        }
        if ident.is("Nothing") {
            return match expected {
                Some(Ty::Optional(_)) => Self::typed(
                    ExprKind::Nothing,
                    expected.cloned().unwrap_or(Ty::Error),
                    span,
                ),
                _ => {
                    self.error(
                        "A5028",
                        span,
                        "'Nothing' needs a context that says what it is optional of.",
                    );
                    Self::poison(span)
                }
            };
        }
        if self.routines.contains_key(&k) {
            return self.call(
                body,
                &ast::Expr {
                    kind: A::Name(ident.clone()),
                    span,
                },
                &[],
                expected,
                span,
            );
        }
        self.error(
            "A6005",
            span,
            format!("There is nothing named '{}'.", ident.name),
        );
        Self::poison(span)
    }

    /// `Base.Member` without arguments.
    fn member(
        &mut self,
        body: &mut Body,
        base: &ast::Expr,
        member: &ast::Ident,
        expected: Option<&Ty>,
        span: Span,
    ) -> Expr {
        if let A::Name(unit) = &base.kind
            && !body.scope.contains_key(&unit.key())
            && !self.storage.contains_key(&unit.key())
        {
            if unit.is("Chain") {
                self.require_unit("Std.Chain", "Chain", unit.span);
                let (op, ty) = match member.key().as_str() {
                    "height" => (Builtin::ChainHeight, Ty::Height),
                    "slot" => (Builtin::ChainSlot, Ty::Slot),
                    "epoch" => (Builtin::ChainEpoch, Ty::Epoch),
                    "protocoltime" => (Builtin::ChainProtocolTime, Ty::U64),
                    "txid" => (Builtin::ChainTxId, Ty::Hash),
                    _ => {
                        self.error("A6005", member.span, format!("Chain has no '{}'. It has Height, Slot, Epoch, ProtocolTime and TxId.", member.name));
                        return Self::poison(span);
                    }
                };
                return Self::typed(
                    ExprKind::Builtin {
                        op,
                        args: Vec::new(),
                    },
                    ty,
                    span,
                );
            }
            if unit.is("Vault") && member.is("Empty") {
                self.require_unit("Std.Coins", "Vault", unit.span);
                return match expected {
                    Some(ty @ Ty::Vault(_)) => Self::typed(
                        ExprKind::Builtin {
                            op: Builtin::VaultEmpty,
                            args: Vec::new(),
                        },
                        ty.clone(),
                        span,
                    ),
                    _ => {
                        self.error(
                            "A5028",
                            span,
                            "'Vault.Empty' needs a context that says which asset the vault holds.",
                        );
                        Self::poison(span)
                    }
                };
            }
            if let Some(Ty::Enum(enumeration)) = self.types.get(&unit.key()).cloned() {
                return match self.variants.get(&member.key()).copied() {
                    Some((e, variant)) if e == enumeration => Self::typed(
                        ExprKind::EnumVariant {
                            enumeration,
                            variant,
                        },
                        Ty::Enum(enumeration),
                        span,
                    ),
                    _ => {
                        self.error(
                            "A6005",
                            member.span,
                            format!("'{}' has no value '{}'.", unit.name, member.name),
                        );
                        Self::poison(span)
                    }
                };
            }
        }
        // Mutating members without arguments (`Safe.WithdrawAll`).
        if member.is("WithdrawAll") {
            return self.method(body, base, member, &[], span);
        }
        let base_expr = self.expr(body, base, None);
        let builtin = |op: Builtin, ty: Ty, base_expr: Expr| {
            Self::typed(
                ExprKind::Builtin {
                    op,
                    args: vec![base_expr],
                },
                ty,
                span,
            )
        };
        let ty = base_expr.ty.clone();
        match (&ty, member.key().as_str()) {
            (Ty::Error, _) => Self::poison(span),
            (Ty::Signer, "address") => builtin(Builtin::SignerAddress, Ty::Address, base_expr),
            (Ty::Coins(_), "value") => builtin(Builtin::CoinsValue, Ty::U128, base_expr),
            (Ty::Vault(_), "balance") => builtin(Builtin::VaultBalance, Ty::U128, base_expr),
            (Ty::List { .. }, "length") => builtin(Builtin::ListLength, Ty::U64, base_expr),
            (Ty::Text(_) | Ty::BytesMax(_), "length") => {
                builtin(Builtin::TextLength, Ty::U64, base_expr)
            }
            (Ty::Optional(_), "issome") => builtin(Builtin::OptionalIsSome, Ty::Bool, base_expr),
            (Ty::Optional(inner), "value") => {
                let inner = inner.as_ref().clone();
                builtin(Builtin::OptionalValue, inner, base_expr)
            }
            (Ty::Record(record), _) => {
                let fields = self
                    .program
                    .records
                    .get(usize::from(*record))
                    .map_or_else(Vec::new, |r| r.fields.clone());
                match fields
                    .iter()
                    .position(|(name, _)| name.eq_ignore_ascii_case(&member.name))
                {
                    Some(index) => {
                        let field_ty = fields.get(index).map_or(Ty::Error, |(_, t)| t.clone());
                        match base_expr.kind {
                            ExprKind::Read(place) => Self::typed(
                                ExprKind::Read(Place::Field(Box::new(place), len_u16(index))),
                                field_ty,
                                span,
                            ),
                            _ => {
                                self.error(
                                    "A5024",
                                    span,
                                    "Fields can be read only from a variable or storage field.",
                                );
                                Self::poison(span)
                            }
                        }
                    }
                    None => {
                        let name = self.program.record_name(*record).to_owned();
                        self.error(
                            "A5024",
                            member.span,
                            format!("Record '{name}' has no field '{}'.", member.name),
                        );
                        Self::poison(span)
                    }
                }
            }
            (other, _) => {
                let described = self.describe(other);
                self.error(
                    "A5024",
                    member.span,
                    format!("{described} has no member '{}'.", member.name),
                );
                Self::poison(span)
            }
        }
    }

    /// An argument that must be coins: a named coins variable needs 'move' (A2005).
    fn coins_arg(&mut self, body: &mut Body, arg: &ast::Expr, asset: Option<Asset>) -> Expr {
        let expected = asset.map(Ty::Coins);
        let value = self.expr(body, arg, expected.as_ref());
        if let (A::Name(ident), ExprKind::Read(Place::Local(_)), Ty::Coins(_)) =
            (&arg.kind, &value.kind, &value.ty)
        {
            self.error(
                "A2005",
                arg.span,
                format!(
                    "'{}' holds Coins. Hand it over with 'move {}'.",
                    ident.name, ident.name
                ),
            );
        }
        match (&value.ty, asset) {
            (Ty::Coins(found), Some(wanted)) if *found != wanted => {
                self.error(
                    "A5029",
                    arg.span,
                    format!(
                        "These are Coins of {}, but Coins of {} are needed here.",
                        found.name(),
                        wanted.name()
                    ),
                );
            }
            (Ty::Coins(_) | Ty::Error, _) => {}
            (other, _) => {
                let described = self.describe(other);
                self.error(
                    "A5002",
                    arg.span,
                    format!("Expected Coins here, but this is {described}."),
                );
            }
        }
        value
    }

    fn method(
        &mut self,
        body: &mut Body,
        base: &ast::Expr,
        member: &ast::Ident,
        args: &[ast::Expr],
        span: Span,
    ) -> Expr {
        let Some((receiver, ty)) = self.place(body, base) else {
            return Self::poison(span);
        };
        let wanted = match (&ty, member.key().as_str()) {
            (Ty::Error, _) => return Self::poison(span),
            (Ty::Vault(_), "deposit" | "withdraw")
            | (Ty::List { .. }, "add")
            | (Ty::Map { .. }, "remove" | "get" | "contains") => 1,
            (Ty::Vault(_), "withdrawall") => 0,
            (Ty::Map { .. }, "put") => 2,
            (other, _) => {
                let described = self.describe(other);
                self.error(
                    "A6012",
                    member.span,
                    format!("{described} has no function '{}'.", member.name),
                );
                return Self::poison(span);
            }
        };
        if args.len() != wanted {
            self.error(
                "A6011",
                span,
                format!(
                    "'{}' takes {wanted} value(s), but {} are given.",
                    member.name,
                    args.len()
                ),
            );
            return Self::poison(span);
        }
        let typed_arg = |this: &mut Self, body: &mut Body, index: usize, ty: &Ty| -> Option<Expr> {
            let arg = args.get(index)?;
            let value = this.expr(body, arg, Some(ty));
            this.expect_type(&value, ty);
            Some(value)
        };
        let (op, result, checked): (Method, Ty, Vec<Expr>) = match (&ty, member.key().as_str()) {
            (Ty::Vault(asset), "deposit") => {
                let asset = *asset;
                let coins = args.first().map(|a| self.coins_arg(body, a, Some(asset)));
                (Method::VaultDeposit, Ty::Unit, coins.into_iter().collect())
            }
            (Ty::Vault(asset), "withdraw") => {
                let asset = *asset;
                let amount = typed_arg(self, body, 0, &Ty::U128);
                (
                    Method::VaultWithdraw,
                    Ty::Coins(asset),
                    amount.into_iter().collect(),
                )
            }
            (Ty::Vault(asset), _) => (Method::VaultWithdrawAll, Ty::Coins(*asset), Vec::new()),
            (Ty::List { elem, .. }, _) => {
                let elem = elem.as_ref().clone();
                let item = typed_arg(self, body, 0, &elem);
                (Method::ListAdd, Ty::Unit, item.into_iter().collect())
            }
            (Ty::Map { key: k, value }, "put") => {
                let (k, value) = (k.as_ref().clone(), value.as_ref().clone());
                let checked = [
                    typed_arg(self, body, 0, &k),
                    typed_arg(self, body, 1, &value),
                ]
                .into_iter()
                .flatten()
                .collect();
                (Method::MapPut, Ty::Unit, checked)
            }
            (Ty::Map { key: k, .. }, "remove") => {
                let k = k.as_ref().clone();
                let key_expr = typed_arg(self, body, 0, &k);
                (Method::MapRemove, Ty::Unit, key_expr.into_iter().collect())
            }
            (Ty::Map { key: k, value }, op) => {
                let (k, value) = (k.as_ref().clone(), value.as_ref().clone());
                let key_expr = typed_arg(self, body, 0, &k);
                let (builtin, result) = if op == "get" {
                    (Builtin::MapGet, Ty::Optional(Box::new(value)))
                } else {
                    (Builtin::MapContains, Ty::Bool)
                };
                let mut all = vec![Self::typed(ExprKind::Read(receiver), ty.clone(), base.span)];
                all.extend(key_expr);
                return Self::typed(
                    ExprKind::Builtin {
                        op: builtin,
                        args: all,
                    },
                    result,
                    span,
                );
            }
            _ => return Self::poison(span),
        };
        Self::typed(
            ExprKind::Method {
                op,
                receiver,
                args: checked,
            },
            result,
            span,
        )
    }

    fn call(
        &mut self,
        body: &mut Body,
        callee: &ast::Expr,
        args: &[ast::Expr],
        expected: Option<&Ty>,
        span: Span,
    ) -> Expr {
        if let A::Field(base, member) = &callee.kind {
            return self.method(body, base, member, args, span);
        }
        let A::Name(name) = &callee.kind else {
            self.error("A6013", callee.span, "Only a named function can be called.");
            return Self::poison(span);
        };
        let arity = |this: &mut Self, n: usize| {
            if args.len() != n {
                this.error(
                    "A6011",
                    span,
                    format!(
                        "'{}' takes {n} value(s), but {} are given.",
                        name.name,
                        args.len()
                    ),
                );
                false
            } else {
                true
            }
        };
        // Integer and chain-position conversions with a range check.
        let target = match name.key().as_str() {
            "uint8" => Some(Ty::U8),
            "uint16" => Some(Ty::U16),
            "uint32" => Some(Ty::U32),
            "uint64" => Some(Ty::U64),
            "uint128" => Some(Ty::U128),
            "int64" => Some(Ty::I64),
            "slot" => Some(Ty::Slot),
            "height" => Some(Ty::Height),
            "epoch" => Some(Ty::Epoch),
            _ => None,
        };
        if let Some(target) = target {
            if !arity(self, 1) {
                return Self::poison(span);
            }
            let Some(arg) = args.first() else {
                return Self::poison(span);
            };
            let value = self.expr(body, arg, None);
            if !value.ty.is_ordered() && value.ty != Ty::Error {
                let described = self.describe(&value.ty);
                self.error(
                    "A5030",
                    arg.span,
                    format!("Only numbers and chain positions convert; this is {described}."),
                );
            }
            return Self::typed(ExprKind::Convert(Box::new(value)), target, span);
        }
        match name.key().as_str() {
            "transfer" => {
                self.require_unit("Std.Coins", "Transfer", name.span);
                if !arity(self, 2) {
                    return Self::poison(span);
                }
                let (Some(coins), Some(to)) = (args.first(), args.get(1)) else {
                    return Self::poison(span);
                };
                let coins = self.coins_arg(body, coins, None);
                let to = self.expr(body, to, Some(&Ty::Address));
                self.expect_type(&to, &Ty::Address);
                return Self::typed(
                    ExprKind::Transfer {
                        coins: Box::new(coins),
                        to: Box::new(to),
                    },
                    Ty::Error,
                    span,
                )
                .with_ty_unit();
            }
            "split" | "join" => {
                self.require_unit("Std.Coins", &name.name, name.span);
                if !arity(self, 2) {
                    return Self::poison(span);
                }
                let (Some(target_arg), Some(second)) = (args.first(), args.get(1)) else {
                    return Self::poison(span);
                };
                let Some((receiver, ty)) = self.place(body, target_arg) else {
                    return Self::poison(span);
                };
                let Ty::Coins(asset) = ty else {
                    self.error(
                        "A5002",
                        target_arg.span,
                        "Split and Join work on a Coins variable.",
                    );
                    return Self::poison(span);
                };
                return if name.is("split") {
                    let amount = self.expr(body, second, Some(&Ty::U128));
                    self.expect_type(&amount, &Ty::U128);
                    Self::typed(
                        ExprKind::Method {
                            op: Method::CoinsSplit,
                            receiver,
                            args: vec![amount],
                        },
                        Ty::Coins(asset),
                        span,
                    )
                } else {
                    let other = self.coins_arg(body, second, Some(asset));
                    Self::typed(
                        ExprKind::Method {
                            op: Method::CoinsJoin,
                            receiver,
                            args: vec![other],
                        },
                        Ty::Error,
                        span,
                    )
                    .with_ty_unit()
                };
            }
            "muldiv" => {
                self.require_unit("Std.Math", "MulDiv", name.span);
                if !arity(self, 4) {
                    return Self::poison(span);
                }
                let mut checked = Vec::new();
                for arg in args.iter().take(3) {
                    let value = self.expr(body, arg, Some(&Ty::U128));
                    self.expect_type(&value, &Ty::U128);
                    checked.push(value);
                }
                let round_up = match args.get(3).map(|a| &a.kind) {
                    Some(A::Name(mode)) if mode.is("RoundUp") => true,
                    Some(A::Name(mode)) if mode.is("RoundDown") => false,
                    _ => {
                        let at = args.get(3).map_or(span, |a| a.span);
                        self.error(
                            "A6014",
                            at,
                            "MulDiv's last value says how to round: RoundDown or RoundUp.",
                        );
                        false
                    }
                };
                return Self::typed(
                    ExprKind::Builtin {
                        op: Builtin::MulDiv { round_up },
                        args: checked,
                    },
                    Ty::U128,
                    span,
                );
            }
            "min" | "max" => {
                self.require_unit("Std.Math", &name.name, name.span);
                if !arity(self, 2) {
                    return Self::poison(span);
                }
                let (Some(a), Some(b)) = (args.first(), args.get(1)) else {
                    return Self::poison(span);
                };
                let a = self.expr(body, a, expected);
                let b = self.expr(body, b, Some(&a.ty));
                self.expect_type(&b, &a.ty);
                if !a.ty.is_ordered() && a.ty != Ty::Error {
                    self.error(
                        "A5027",
                        span,
                        "Min and Max work on numbers and chain positions.",
                    );
                }
                let ty = a.ty.clone();
                let op = if name.is("min") {
                    Builtin::Min
                } else {
                    Builtin::Max
                };
                return Self::typed(
                    ExprKind::Builtin {
                        op,
                        args: vec![a, b],
                    },
                    ty,
                    span,
                );
            }
            "blake3" => {
                self.require_unit("Std.Crypto", "Blake3", name.span);
                if !arity(self, 1) {
                    return Self::poison(span);
                }
                let value = args.first().map(|a| self.expr(body, a, None));
                if let Some(value) = &value
                    && !matches!(
                        value.ty,
                        Ty::BytesFixed(_) | Ty::BytesMax(_) | Ty::Text(_) | Ty::Hash | Ty::Error
                    )
                {
                    self.error("A5002", value.span, "Blake3 hashes bytes, text or a hash.");
                }
                return Self::typed(
                    ExprKind::Builtin {
                        op: Builtin::Blake3,
                        args: value.into_iter().collect(),
                    },
                    Ty::Hash,
                    span,
                );
            }
            "verifyed25519" => {
                self.require_unit("Std.Crypto", "VerifyEd25519", name.span);
                if !arity(self, 3) {
                    return Self::poison(span);
                }
                let expectations = [Ty::BytesFixed(32), Ty::Hash, Ty::BytesFixed(64)];
                let mut checked = Vec::new();
                for (arg, ty) in args.iter().zip(expectations.iter()) {
                    let value = self.expr(body, arg, Some(ty));
                    self.expect_type(&value, ty);
                    checked.push(value);
                }
                return Self::typed(
                    ExprKind::Builtin {
                        op: Builtin::VerifyEd25519,
                        args: checked,
                    },
                    Ty::Bool,
                    span,
                );
            }
            "some" => {
                if !arity(self, 1) {
                    return Self::poison(span);
                }
                let inner_expected = match expected {
                    Some(Ty::Optional(inner)) => Some(inner.as_ref().clone()),
                    _ => None,
                };
                let Some(arg) = args.first() else {
                    return Self::poison(span);
                };
                let value = self.expr(body, arg, inner_expected.as_ref());
                if let Some(inner) = &inner_expected {
                    self.expect_type(&value, inner);
                }
                if value.ty.is_linear() {
                    self.error("A2008", arg.span, "Coins cannot be wrapped in an Optional.");
                }
                let ty = Ty::Optional(Box::new(value.ty.clone()));
                return Self::typed(ExprKind::Some(Box::new(value)), ty, span);
            }
            _ => {}
        }
        let Some(index) = self.routines.get(&name.key()).copied() else {
            self.error(
                "A6005",
                name.span,
                format!("There is no function named '{}'.", name.name),
            );
            for arg in args {
                let _ = self.expr(body, arg, None);
            }
            return Self::poison(span);
        };
        let Some(signature) = self.signatures.get(usize::from(index)).cloned() else {
            return Self::poison(span);
        };
        if signature.kind == RoutineKind::Constructor {
            self.error(
                "A6015",
                name.span,
                "The constructor runs once, at deployment, and cannot be called.",
            );
        }
        if signature.params.len() != args.len() {
            self.error(
                "A6011",
                span,
                format!(
                    "'{}' takes {} value(s), but {} are given.",
                    signature.name,
                    signature.params.len(),
                    args.len()
                ),
            );
        }
        let mut checked = Vec::new();
        for (arg, ty) in args.iter().zip(
            signature
                .params
                .iter()
                .map(Some)
                .chain(std::iter::repeat(None)),
        ) {
            let value = match ty {
                Some(Ty::Coins(asset)) => self.coins_arg(body, arg, Some(*asset)),
                Some(ty) => {
                    let value = self.expr(body, arg, Some(ty));
                    self.expect_type(&value, ty);
                    value
                }
                None => self.expr(body, arg, None),
            };
            checked.push(value);
        }
        let ty = signature.returns.clone().unwrap_or(Ty::Error);
        Self::typed(
            ExprKind::Call {
                routine: index,
                args: checked,
            },
            ty,
            span,
        )
        .with_returns(signature.returns.is_some())
    }
}

trait UnitTyped {
    fn with_ty_unit(self) -> Self;
    fn with_returns(self, returns: bool) -> Self;
}

impl UnitTyped for Expr {
    /// A call that produces no value.
    fn with_ty_unit(mut self) -> Expr {
        self.ty = Ty::Unit;
        self
    }

    fn with_returns(self, returns: bool) -> Expr {
        if returns { self } else { self.with_ty_unit() }
    }
}

/// Resolves and type-checks a unit. Returns the program when there were no errors in this
/// phase (later phases may still report more).
pub fn check(unit: &ast::Unit, diagnostics: &mut Diagnostics) -> Option<Program> {
    let before = diagnostics.len();
    let mut checker = Checker {
        diagnostics,
        program: Program {
            name: unit.name.name.clone(),
            version: unit.version,
            enums: Vec::new(),
            records: Vec::new(),
            errors: Vec::new(),
            events: Vec::new(),
            storage: Vec::new(),
            routines: Vec::new(),
        },
        uses: BTreeSet::new(),
        declared: BTreeMap::new(),
        consts: BTreeMap::new(),
        types: BTreeMap::new(),
        variants: BTreeMap::new(),
        errors: BTreeMap::new(),
        events: BTreeMap::new(),
        storage: BTreeMap::new(),
        routines: BTreeMap::new(),
        signatures: Vec::new(),
    };
    if unit.version != (0, 1) {
        checker.error(
            "A1109",
            unit.version_span,
            format!(
                "This compiler understands Arno 0.1; the contract says version {}.{}.",
                unit.version.0, unit.version.1
            ),
        );
    }
    checker.declarations(unit);
    checker.signatures(unit);
    let mut routines = Vec::new();
    for (index, routine) in unit.routines.iter().enumerate() {
        routines.push(checker.routine(routine, len_u16(index)));
    }
    checker.program.routines = routines;
    let program = checker.program;
    (diagnostics.len() == before).then_some(program)
}
