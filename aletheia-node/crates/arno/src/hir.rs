//! The checked program: every name resolved, every expression typed. Code generation reads
//! only this.

use crate::ast::{BinaryOp, Directive, Effect, RoutineKind, UnaryOp};
use crate::source::Span;
use crate::types::{Ty, TypeNames};

pub type LocalId = u16;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnumDef {
    pub name: String,
    pub variants: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordDef {
    pub name: String,
    pub fields: Vec<(String, Ty)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ErrorDef {
    pub name: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventDef {
    pub name: String,
    pub fields: Vec<(String, Ty)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StorageField {
    pub name: String,
    pub ty: Ty,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Local {
    pub name: String,
    pub ty: Ty,
    pub span: Span,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RoutineDef {
    pub name: String,
    pub kind: RoutineKind,
    /// The first `params` locals are the parameters, in order.
    pub params: u16,
    pub locals: Vec<Local>,
    pub returns: Option<Ty>,
    /// The implicit `Result` of a function.
    pub result: Option<LocalId>,
    pub directives: Vec<Directive>,
    pub declared_effects: Vec<Effect>,
    pub body: Vec<Stmt>,
    pub span: Span,
    pub name_span: Span,
}

impl RoutineDef {
    pub fn has(&self, directive: Directive) -> bool {
        self.directives.contains(&directive)
    }

    /// The package `effects_mask` (Section 27).
    pub fn effects_mask(&self) -> u8 {
        self.declared_effects
            .iter()
            .fold(0u8, |mask, effect| mask | effect.bit())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Program {
    pub name: String,
    pub version: (u16, u16),
    pub enums: Vec<EnumDef>,
    pub records: Vec<RecordDef>,
    pub errors: Vec<ErrorDef>,
    pub events: Vec<EventDef>,
    pub storage: Vec<StorageField>,
    pub routines: Vec<RoutineDef>,
}

impl TypeNames for Program {
    fn enum_name(&self, id: u16) -> &str {
        self.enums
            .get(usize::from(id))
            .map_or("?", |e| e.name.as_str())
    }

    fn record_name(&self, id: u16) -> &str {
        self.records
            .get(usize::from(id))
            .map_or("?", |r| r.name.as_str())
    }
}

/// Where a value is stored and can be assigned.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Place {
    Local(LocalId),
    Storage(u16),
    /// Field `index` of a record.
    Field(Box<Place>, u16),
    /// Element of an array or list (1-based in the source; the index expression as written).
    Index(Box<Place>, Box<Expr>),
}

impl Place {
    /// The storage field this place lives in, if any.
    pub fn storage_root(&self) -> Option<u16> {
        match self {
            Place::Storage(slot) => Some(*slot),
            Place::Local(_) => None,
            Place::Field(inner, _) | Place::Index(inner, _) => inner.storage_root(),
        }
    }
}

/// Pure operations from the standard library and members of built-in types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Builtin {
    SignerAddress,
    CoinsValue,
    VaultEmpty,
    VaultBalance,
    ChainHeight,
    ChainSlot,
    ChainEpoch,
    ChainProtocolTime,
    ChainTxId,
    MulDiv { round_up: bool },
    Min,
    Max,
    Blake3,
    VerifyEd25519,
    ListLength,
    MapGet,
    MapContains,
    OptionalIsSome,
    OptionalValue,
    TextLength,
}

/// Operations that change a place (a vault, list or map in storage or a local) or hand
/// coins away.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Method {
    VaultDeposit,
    VaultWithdraw,
    VaultWithdrawAll,
    ListAdd,
    MapPut,
    MapRemove,
    /// `Split(X, Amount)`: takes `Amount` out of coins `X`, which stays live.
    CoinsSplit,
    /// `Join(X, move Y)`: adds `Y` to `X`.
    CoinsJoin,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExprKind {
    Int(u128),
    Bool(bool),
    Text(String),
    Read(Place),
    /// A named coins value handed over (`move X`, or a temporary passed straight on).
    Move(LocalId),
    EnumVariant {
        enumeration: u16,
        variant: u16,
    },
    Nothing,
    Some(Box<Expr>),
    /// Integer conversion with a range check, to the expression's type.
    Convert(Box<Expr>),
    Unary(UnaryOp, Box<Expr>),
    Binary(BinaryOp, Box<Expr>, Box<Expr>),
    Call {
        routine: u16,
        args: Vec<Expr>,
    },
    Builtin {
        op: Builtin,
        args: Vec<Expr>,
    },
    Method {
        op: Method,
        receiver: Place,
        args: Vec<Expr>,
    },
    /// `Transfer(Coins, Address)`.
    Transfer {
        coins: Box<Expr>,
        to: Box<Expr>,
    },
    /// A record value built from its fields, in declaration order.
    RecordValue {
        record: u16,
        fields: Vec<Expr>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Expr {
    pub kind: ExprKind,
    pub ty: Ty,
    pub span: Span,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StmtKind {
    Assign {
        place: Place,
        value: Expr,
    },
    /// A call evaluated for its effect (its value, if any, is not coins).
    Eval(Expr),
    If {
        cond: Expr,
        then: Vec<Stmt>,
        otherwise: Vec<Stmt>,
    },
    Case {
        subject: Expr,
        arms: Vec<(Vec<u128>, Vec<Stmt>)>,
        otherwise: Vec<Stmt>,
    },
    ForRange {
        var: LocalId,
        from: Expr,
        to: Expr,
        bound: u64,
        body: Vec<Stmt>,
    },
    ForEach {
        var: LocalId,
        collection: Expr,
        bound: u64,
        body: Vec<Stmt>,
    },
    While {
        cond: Expr,
        bound: u64,
        body: Vec<Stmt>,
    },
    Require {
        cond: Expr,
        error: u16,
    },
    Fail(u16),
    Emit {
        event: u16,
        args: Vec<Expr>,
    },
    Exit,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stmt {
    pub kind: StmtKind,
    pub span: Span,
}
