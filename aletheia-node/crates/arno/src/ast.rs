//! The syntax tree, immutable once parsed (spec Section 26). Every node carries its span.

use crate::source::Span;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ident {
    /// As written.
    pub name: String,
    pub span: Span,
}

impl Ident {
    /// The key names are compared by: the name exactly as written (names are
    /// case-sensitive, as in Java; ADR-054).
    pub fn key(&self) -> String {
        self.name.clone()
    }

    pub fn is(&self, word: &str) -> bool {
        self.name == word
    }
}

/// `A.B.C`, as in `Std.Coins.AEY`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QualIdent {
    pub parts: Vec<Ident>,
    pub span: Span,
}

impl QualIdent {
    pub fn text(&self) -> String {
        self.parts
            .iter()
            .map(|p| p.name.as_str())
            .collect::<Vec<_>>()
            .join(".")
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Unit {
    pub name: Ident,
    pub version: (u16, u16),
    pub version_span: Span,
    pub uses: Vec<QualIdent>,
    pub consts: Vec<ConstDecl>,
    pub types: Vec<TypeDecl>,
    pub errors: Vec<ErrorDecl>,
    pub events: Vec<EventDecl>,
    pub storage: Vec<FieldGroup>,
    pub routines: Vec<Routine>,
    pub span: Span,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConstDecl {
    pub name: Ident,
    pub value: Expr,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TypeDecl {
    pub name: Ident,
    pub def: TypeDef,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TypeDef {
    /// `(Open, Funded, Released)`.
    Enum(Vec<Ident>),
    /// `record ... end`.
    Record(Vec<FieldGroup>),
    Alias(TypeExpr),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ErrorDecl {
    pub name: Ident,
    pub message: String,
    pub message_span: Span,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventDecl {
    pub name: Ident,
    pub params: Vec<FieldGroup>,
}

/// `A, B: T` in storage, records, parameters and `var` blocks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldGroup {
    pub names: Vec<Ident>,
    pub ty: TypeExpr,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TypeExprKind {
    /// `UInt128`, `Address`, `Phase`, `Std.Coins.AEY`, ...
    Named(QualIdent),
    /// `List of T max N`.
    List { elem: Box<TypeExpr>, max: Box<Expr> },
    /// `Map of K to V`.
    Map {
        key: Box<TypeExpr>,
        value: Box<TypeExpr>,
    },
    /// `Optional of T`.
    Optional(Box<TypeExpr>),
    /// `Coins of A`.
    Coins(QualIdent),
    /// `Vault of A`.
    Vault(QualIdent),
    /// `Text max N`.
    Text(Box<Expr>),
    /// `Bytes[N]`.
    BytesFixed(Box<Expr>),
    /// `Bytes max N`.
    BytesMax(Box<Expr>),
    /// `array[L..H] of T`.
    Array {
        low: Box<Expr>,
        high: Box<Expr>,
        elem: Box<TypeExpr>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TypeExpr {
    pub kind: TypeExprKind,
    pub span: Span,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum RoutineKind {
    Constructor,
    Procedure,
    Function,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Directive {
    Entry,
    View,
    Reentrant,
}

/// The effects a routine declares (Section 25, "Explicit effects").
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Effect {
    ChangesStorage,
    ReceivesCoins,
    SendsCoins,
    EmitsEvents,
    CallsContracts,
}

impl Effect {
    pub const fn phrase(self) -> &'static str {
        match self {
            Effect::ChangesStorage => "changes storage",
            Effect::ReceivesCoins => "receives coins",
            Effect::SendsCoins => "sends coins",
            Effect::EmitsEvents => "emits events",
            Effect::CallsContracts => "calls contracts",
        }
    }

    /// Bit in the package `effects_mask` (Section 27).
    pub const fn bit(self) -> u8 {
        match self {
            Effect::ChangesStorage => 1,
            Effect::ReceivesCoins => 2,
            Effect::SendsCoins => 4,
            Effect::EmitsEvents => 8,
            Effect::CallsContracts => 16,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Routine {
    pub kind: RoutineKind,
    pub name: Ident,
    pub params: Vec<FieldGroup>,
    pub returns: Option<TypeExpr>,
    pub directives: Vec<(Directive, Span)>,
    pub effects: Vec<(Effect, Span)>,
    pub vars: Vec<FieldGroup>,
    pub body: Block,
    pub span: Span,
}

impl Routine {
    pub fn has(&self, directive: Directive) -> bool {
        self.directives.iter().any(|(d, _)| *d == directive)
    }

    pub fn declares(&self, effect: Effect) -> bool {
        self.effects.iter().any(|(e, _)| *e == effect)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Block {
    pub stmts: Vec<Stmt>,
    pub span: Span,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaseArm {
    pub labels: Vec<Expr>,
    pub body: Stmt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StmtKind {
    Assign {
        target: Expr,
        value: Expr,
    },
    /// A routine call used as a statement (with or without parentheses).
    Call(Expr),
    If {
        cond: Expr,
        then: Box<Stmt>,
        otherwise: Option<Box<Stmt>>,
    },
    Case {
        subject: Expr,
        arms: Vec<CaseArm>,
        otherwise: Option<Box<Stmt>>,
    },
    ForTo {
        var: Ident,
        from: Expr,
        to: Expr,
        body: Box<Stmt>,
    },
    ForEach {
        var: Ident,
        collection: Expr,
        body: Box<Stmt>,
    },
    While {
        cond: Expr,
        /// `at most N times`; `None` only after a reported error (A4002).
        bound: Option<Expr>,
        body: Box<Stmt>,
    },
    Require {
        cond: Expr,
        error: Ident,
    },
    Fail(Ident),
    Emit {
        event: Ident,
        args: Vec<Expr>,
    },
    Exit,
    Block(Block),
    Empty,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stmt {
    pub kind: StmtKind,
    pub span: Span,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum UnaryOp {
    Not,
    Neg,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum BinaryOp {
    Or,
    Xor,
    And,
    Eq,
    NotEq,
    Lt,
    LtEq,
    Gt,
    GtEq,
    Add,
    Sub,
    Mul,
    Div,
    Mod,
}

impl BinaryOp {
    pub const fn symbol(self) -> &'static str {
        match self {
            BinaryOp::Or => "or",
            BinaryOp::Xor => "xor",
            BinaryOp::And => "and",
            BinaryOp::Eq => "is",
            BinaryOp::NotEq => "is not",
            BinaryOp::Lt => "<",
            BinaryOp::LtEq => "<=",
            BinaryOp::Gt => ">",
            BinaryOp::GtEq => ">=",
            BinaryOp::Add => "+",
            BinaryOp::Sub => "-",
            BinaryOp::Mul => "*",
            BinaryOp::Div => "div",
            BinaryOp::Mod => "mod",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExprKind {
    Int(u128),
    Str(String),
    Bool(bool),
    Name(Ident),
    /// `A.B`: a record field, a member such as `Caller.Address`, or a routine without
    /// arguments such as `Safe.WithdrawAll`; the checker decides which.
    Field(Box<Expr>, Ident),
    Index(Box<Expr>, Box<Expr>),
    Call {
        callee: Box<Expr>,
        args: Vec<Expr>,
    },
    Unary(UnaryOp, Box<Expr>),
    Binary(BinaryOp, Box<Expr>, Box<Expr>),
    /// `move X`.
    Move(Ident),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Expr {
    pub kind: ExprKind,
    pub span: Span,
}
