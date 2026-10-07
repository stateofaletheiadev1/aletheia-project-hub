//! Code generation (spec Sections 26, 27): the checked program to an Arno package.
//!
//! - Every local has a fixed register (parameters first); temporaries come from free lists
//!   kept per type, because each register has one declared type.
//! - Loops test their condition at the bottom so the `LOOP` counter can start at
//!   `bound - 1`: a loop that runs exactly `bound` times never trips it, and one more pass
//!   traps (the transaction aborts).
//! - `and` / `or` short-circuit, so `require X > 0 and Y div X > 2` cannot trap on the
//!   division.
//! - Everything is ordered (`BTreeMap`, declaration order); the output depends only on the
//!   program, so the same source always gives the same bytes.

use std::collections::BTreeMap;

use aletheia_vm::package::{
    ErrorDef as PErrorDef, EventDef as PEventDef, FLAG_CONSTRUCTOR, FLAG_ENTRY, FLAG_REENTRANT,
    FLAG_VIEW, StorageSlot,
};
use aletheia_vm::{Constant, FunctionDef, HostFn, Instr, Op, Package, TypeDef};

use crate::ast::{BinaryOp, Directive, RoutineKind, UnaryOp};
use crate::diagnostics::Diagnostics;
use crate::hir::{Builtin, Expr, ExprKind, Method, Place, Program, RoutineDef, Stmt, StmtKind};
use crate::source::Span;
use crate::types::Ty;

/// Registers available to one function (Section 28).
pub const MAX_REGISTERS: usize = 255;
/// Instructions in one function (jump targets are 16-bit).
pub const MAX_INSTRUCTIONS: usize = 65_535;

#[derive(Debug)]
struct Failed;

type Gen<T> = Result<T, Failed>;

/// Package tables shared by all functions.
struct Tables {
    constants: Vec<Constant>,
    constant_index: BTreeMap<ConstKey, u16>,
    types: Vec<TypeDef>,
    type_index: BTreeMap<Ty, u16>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum ConstKey {
    Int(u128),
    Text(Vec<u8>),
}

impl Tables {
    fn constant(&mut self, key: ConstKey) -> Gen<u16> {
        if let Some(index) = self.constant_index.get(&key) {
            return Ok(*index);
        }
        let index = u16::try_from(self.constants.len()).map_err(|_| Failed)?;
        if usize::from(index) >= 4096 {
            return Err(Failed);
        }
        self.constants.push(match &key {
            ConstKey::Int(value) => Constant::Int(*value),
            ConstKey::Text(bytes) => Constant::Text(bytes.clone()),
        });
        self.constant_index.insert(key, index);
        Ok(index)
    }

    fn text(&mut self, text: &str) -> Gen<u16> {
        self.constant(ConstKey::Text(text.as_bytes().to_vec()))
    }

    /// Interns a type; its parts are interned first, so references point backwards.
    fn ty(&mut self, program: &Program, ty: &Ty) -> Gen<u16> {
        if let Some(index) = self.type_index.get(ty) {
            return Ok(*index);
        }
        let def = match ty {
            Ty::Bool => TypeDef::Bool,
            Ty::U8 => TypeDef::U8,
            Ty::U16 => TypeDef::U16,
            Ty::U32 => TypeDef::U32,
            Ty::U64 => TypeDef::U64,
            Ty::U128 => TypeDef::U128,
            Ty::I64 => TypeDef::I64,
            Ty::Address => TypeDef::Address,
            Ty::Hash => TypeDef::Hash,
            Ty::Height => TypeDef::Height,
            Ty::Slot => TypeDef::Slot,
            Ty::Epoch => TypeDef::Epoch,
            Ty::Text(max) => TypeDef::Text { max: *max },
            Ty::BytesFixed(len) => TypeDef::BytesFixed { len: *len },
            Ty::BytesMax(max) => TypeDef::BytesMax { max: *max },
            Ty::Enum(id) => {
                let e = program.enums.get(usize::from(*id)).ok_or(Failed)?;
                let name = self.text(&e.name)?;
                let variants = e
                    .variants
                    .iter()
                    .map(|v| self.text(v))
                    .collect::<Gen<_>>()?;
                TypeDef::Enum { name, variants }
            }
            Ty::Record(id) => {
                let r = program.records.get(usize::from(*id)).ok_or(Failed)?;
                let name = self.text(&r.name)?;
                let mut fields = Vec::new();
                for (field, field_ty) in &r.fields {
                    fields.push((self.text(field)?, self.ty(program, field_ty)?));
                }
                TypeDef::Record { name, fields }
            }
            Ty::Array { len, elem } => TypeDef::Array {
                len: *len,
                elem: self.ty(program, elem)?,
            },
            Ty::List { max, elem } => TypeDef::List {
                max: *max,
                elem: self.ty(program, elem)?,
            },
            Ty::Map { key, value } => TypeDef::Map {
                key: self.ty(program, key)?,
                value: self.ty(program, value)?,
            },
            Ty::Optional(elem) => TypeDef::Optional {
                elem: self.ty(program, elem)?,
            },
            Ty::Coins(asset) => TypeDef::Coins { asset: asset.id() },
            Ty::Vault(asset) => TypeDef::Vault { asset: asset.id() },
            Ty::Signer => TypeDef::Signer,
            Ty::Unit | Ty::Error => return Err(Failed),
        };
        let index = u16::try_from(self.types.len()).map_err(|_| Failed)?;
        self.types.push(def);
        self.type_index.insert(ty.clone(), index);
        Ok(index)
    }
}

/// One function being generated.
struct FnGen<'a> {
    program: &'a Program,
    routine: &'a RoutineDef,
    tables: &'a mut Tables,
    diagnostics: &'a mut Diagnostics,
    code: Vec<Instr>,
    registers: Vec<u16>,
    /// Free temporaries by type index.
    free: BTreeMap<u16, Vec<u8>>,
    /// Consecutive argument blocks, reused per callee / event / host function.
    blocks: BTreeMap<(u8, u16), u8>,
    /// Loop counters. The verifier lets nothing but constant loads and `LOOP` write a
    /// counter register anywhere in the function, so counters never share the general pool.
    counters: Vec<u8>,
    counters_free: Vec<u8>,
}

impl FnGen<'_> {
    fn fail(&mut self, span: Span, message: &str) -> Failed {
        self.diagnostics.error("A7001", span, message.to_owned());
        Failed
    }

    fn emit(&mut self, instr: Instr) -> Gen<usize> {
        if self.code.len() >= MAX_INSTRUCTIONS {
            let span = self.routine.name_span;
            return Err(self.fail(
                span,
                "This routine is too long to compile. Split it into smaller routines.",
            ));
        }
        self.code.push(instr);
        Ok(self.code.len().saturating_sub(1))
    }

    fn here(&self) -> u16 {
        u16::try_from(self.code.len()).unwrap_or(u16::MAX)
    }

    /// Points the forward jump at `at` to the current position.
    fn patch(&mut self, at: usize) {
        let target = self.here();
        if let Some(instr) = self.code.get_mut(at) {
            *instr = Instr::abx(instr.op, instr.a, target);
        }
    }

    fn new_register(&mut self, ty: u16) -> Gen<u8> {
        if self.registers.len() >= MAX_REGISTERS {
            let span = self.routine.name_span;
            return Err(self.fail(
                span,
                "This routine needs more than 255 registers. Split it into smaller routines.",
            ));
        }
        self.registers.push(ty);
        u8::try_from(self.registers.len().saturating_sub(1)).map_err(|_| Failed)
    }

    fn temp(&mut self, ty: &Ty) -> Gen<u8> {
        let index = self.tables.ty(self.program, ty)?;
        if let Some(r) = self.free.get_mut(&index).and_then(Vec::pop) {
            return Ok(r);
        }
        self.new_register(index)
    }

    fn release(&mut self, r: u8) {
        if usize::from(r) < self.routine.locals.len().min(MAX_REGISTERS) {
            return; // a local's own register
        }
        if self.counters.contains(&r) {
            if !self.counters_free.contains(&r) {
                self.counters_free.push(r);
            }
            return;
        }
        if let Some(ty) = self.registers.get(usize::from(r)).copied() {
            let list = self.free.entry(ty).or_default();
            if !list.contains(&r) {
                list.push(r);
            }
        }
    }

    /// `count` consecutive registers of the given types, reused per `key`.
    fn block(&mut self, key: (u8, u16), types: &[Ty]) -> Gen<u8> {
        if let Some(start) = self.blocks.get(&key) {
            return Ok(*start);
        }
        let mut start = None;
        for ty in types {
            let index = self.tables.ty(self.program, ty)?;
            let r = self.new_register(index)?;
            start.get_or_insert(r);
        }
        let start = start.ok_or(Failed)?;
        self.blocks.insert(key, start);
        Ok(start)
    }

    fn local(id: u16) -> Gen<u8> {
        u8::try_from(id).map_err(|_| Failed)
    }

    fn load_int(&mut self, dest: u8, value: u128) -> Gen<()> {
        match u16::try_from(value) {
            Ok(small) => self.emit(Instr::abx(Op::LoadI, dest, small))?,
            Err(_) => {
                let k = self.tables.constant(ConstKey::Int(value))?;
                self.emit(Instr::abx(Op::LoadK, dest, k))?
            }
        };
        Ok(())
    }

    /// The register holding an expression's value. For a plain read of a local this is the
    /// local's own register; callers must not change it.
    fn value(&mut self, e: &Expr) -> Gen<u8> {
        if let ExprKind::Read(Place::Local(id)) | ExprKind::Move(id) = &e.kind {
            return Self::local(*id);
        }
        let dest = self.temp(&e.ty)?;
        self.into(e, dest)?;
        Ok(dest)
    }

    /// Copies or moves `src` into `dest` (same type).
    fn transfer(&mut self, dest: u8, src: u8, ty: &Ty) -> Gen<()> {
        if dest != src {
            let op = if ty.is_linear() { Op::Move } else { Op::Mov };
            self.emit(Instr::abc(op, dest, src, 0))?;
        }
        Ok(())
    }

    fn storage_slot(place: &Place) -> Option<u8> {
        match place {
            Place::Storage(slot) => u8::try_from(*slot).ok(),
            _ => None,
        }
    }

    fn storage_ty(&self, slot: u16) -> Ty {
        self.program
            .storage
            .get(usize::from(slot))
            .map_or(Ty::Error, |s| s.ty.clone())
    }

    fn place_ty(&self, place: &Place) -> Ty {
        match place {
            Place::Local(id) => self
                .routine
                .locals
                .get(usize::from(*id))
                .map_or(Ty::Error, |l| l.ty.clone()),
            Place::Storage(slot) => self.storage_ty(*slot),
            Place::Field(inner, index) => match self.place_ty(inner) {
                Ty::Record(record) => self
                    .program
                    .records
                    .get(usize::from(record))
                    .and_then(|r| r.fields.get(usize::from(*index)))
                    .map_or(Ty::Error, |(_, ty)| ty.clone()),
                _ => Ty::Error,
            },
            Place::Index(inner, _) => match self.place_ty(inner) {
                Ty::Array { elem, .. } | Ty::List { elem, .. } => *elem,
                _ => Ty::Error,
            },
        }
    }

    /// A register holding the place's current value, and whether it *is* the place (a local),
    /// so changes to it need no write-back.
    fn read_place(&mut self, place: &Place, span: Span) -> Gen<(u8, bool)> {
        match place {
            Place::Local(id) => Ok((Self::local(*id)?, true)),
            Place::Storage(slot) => {
                let ty = self.storage_ty(*slot);
                if matches!(ty, Ty::Vault(_) | Ty::Map { .. }) {
                    return Err(self.fail(span, "A vault or map is used here as a plain value."));
                }
                let r = self.temp(&ty)?;
                self.emit(Instr::abx(Op::SLoad, r, *slot))?;
                Ok((r, false))
            }
            Place::Field(inner, index) => {
                let (base, _) = self.read_place(inner, span)?;
                let ty = self.place_ty(place);
                let r = self.temp(&ty)?;
                let field = u8::try_from(*index).map_err(|_| Failed)?;
                self.emit(Instr::abc(Op::GetF, r, base, field))?;
                self.release(base);
                Ok((r, false))
            }
            Place::Index(inner, index) => {
                let (base, _) = self.read_place(inner, span)?;
                let i = self.value(index)?;
                let ty = self.place_ty(place);
                let r = self.temp(&ty)?;
                self.emit(Instr::abc(Op::GetI, r, base, i))?;
                self.release(i);
                self.release(base);
                Ok((r, false))
            }
        }
    }

    /// Stores `value` into a place, writing changed aggregates back to where they live.
    fn write_place(&mut self, place: &Place, value: u8, span: Span) -> Gen<()> {
        match place {
            Place::Local(id) => {
                let ty = self.place_ty(place);
                self.transfer(Self::local(*id)?, value, &ty)
            }
            Place::Storage(slot) => {
                self.emit(Instr::abx(Op::SStore, value, *slot))?;
                Ok(())
            }
            Place::Field(inner, index) => {
                let (base, alias) = self.read_place(inner, span)?;
                let field = u8::try_from(*index).map_err(|_| Failed)?;
                self.emit(Instr::abc(Op::SetF, base, field, value))?;
                if !alias {
                    self.write_place(inner, base, span)?;
                    self.release(base);
                }
                Ok(())
            }
            Place::Index(inner, index) => {
                let (base, alias) = self.read_place(inner, span)?;
                let i = self.value(index)?;
                self.emit(Instr::abc(Op::SetI, base, i, value))?;
                self.release(i);
                if !alias {
                    self.write_place(inner, base, span)?;
                    self.release(base);
                }
                Ok(())
            }
        }
    }

    fn host(&mut self, dest: u8, host: HostFn, args: &[Expr], result: &Ty) -> Gen<()> {
        let mut types = vec![result.clone()];
        types.extend(args.iter().map(|a| a.ty.clone()));
        let start = self.block((3, host.id()), &types)?;
        for (k, arg) in (1u8..).zip(args) {
            let r = self.value(arg)?;
            let slot = start.checked_add(k).ok_or(Failed)?;
            self.transfer(slot, r, &arg.ty)?;
            self.release(r);
        }
        self.emit(Instr::abx(Op::Host, start, host.id()))?;
        self.transfer(dest, start, result)
    }

    /// Generates `e` into `dest`.
    #[allow(
        clippy::too_many_lines,
        reason = "one arm per expression kind reads best together"
    )]
    fn into(&mut self, e: &Expr, dest: u8) -> Gen<()> {
        match &e.kind {
            ExprKind::Int(value) => self.load_int(dest, *value)?,
            ExprKind::Bool(value) => {
                self.emit(Instr::abx(Op::LoadI, dest, u16::from(*value)))?;
            }
            ExprKind::EnumVariant { variant, .. } => {
                self.emit(Instr::abx(Op::LoadI, dest, *variant))?;
            }
            ExprKind::Text(text) => {
                let k = self.tables.text(text)?;
                self.emit(Instr::abx(Op::LoadK, dest, k))?;
            }
            ExprKind::Nothing => {
                self.emit(Instr::abc(Op::LoadNothing, dest, 0, 0))?;
            }
            ExprKind::Read(place) => {
                let (r, _) = self.read_place(place, e.span)?;
                self.transfer(dest, r, &e.ty)?;
                self.release(r);
            }
            ExprKind::Move(id) => self.transfer(dest, Self::local(*id)?, &e.ty)?,
            ExprKind::Some(inner) => {
                let r = self.value(inner)?;
                self.emit(Instr::abc(Op::Some, dest, r, 0))?;
                self.release(r);
            }
            ExprKind::Convert(inner) => {
                let r = self.value(inner)?;
                self.emit(Instr::abc(Op::Conv, dest, r, 0))?;
                self.release(r);
            }
            ExprKind::Unary(op, inner) => {
                let r = self.value(inner)?;
                let op = match op {
                    UnaryOp::Not => Op::Not,
                    UnaryOp::Neg => Op::Neg,
                };
                self.emit(Instr::abc(op, dest, r, 0))?;
                self.release(r);
            }
            ExprKind::Binary(op @ (BinaryOp::And | BinaryOp::Or), left, right) => {
                // Short-circuit: the right side runs only when it decides the result. Built
                // in a temporary, so a right side that reads `dest` sees its old value.
                let t = self.temp(&Ty::Bool)?;
                self.into(left, t)?;
                let skip = if *op == BinaryOp::And {
                    Op::JmpIfNot
                } else {
                    Op::JmpIf
                };
                let jump = self.emit(Instr::abx(skip, t, 0))?;
                self.into(right, t)?;
                self.patch(jump);
                self.transfer(dest, t, &Ty::Bool)?;
                self.release(t);
            }
            ExprKind::Binary(op, left, right) => {
                let l = self.value(left)?;
                let r = self.value(right)?;
                let instr = match op {
                    BinaryOp::Add => Instr::abc(Op::Add, dest, l, r),
                    BinaryOp::Sub => Instr::abc(Op::Sub, dest, l, r),
                    BinaryOp::Mul => Instr::abc(Op::Mul, dest, l, r),
                    BinaryOp::Div => Instr::abc(Op::Div, dest, l, r),
                    BinaryOp::Mod => Instr::abc(Op::Mod, dest, l, r),
                    BinaryOp::Xor => Instr::abc(Op::Xor, dest, l, r),
                    BinaryOp::Eq => Instr::abc(Op::Eq, dest, l, r),
                    BinaryOp::NotEq => Instr::abc(Op::Ne, dest, l, r),
                    BinaryOp::Lt => Instr::abc(Op::Lt, dest, l, r),
                    BinaryOp::LtEq => Instr::abc(Op::Le, dest, l, r),
                    BinaryOp::Gt => Instr::abc(Op::Lt, dest, r, l),
                    BinaryOp::GtEq => Instr::abc(Op::Le, dest, r, l),
                    BinaryOp::And | BinaryOp::Or => return Err(Failed),
                };
                self.emit(instr)?;
                self.release(l);
                self.release(r);
            }
            ExprKind::Call { routine, args } => {
                let callee = self
                    .program
                    .routines
                    .get(usize::from(*routine))
                    .ok_or(Failed)?;
                let params: Vec<Ty> = callee
                    .locals
                    .iter()
                    .take(usize::from(callee.params))
                    .map(|l| l.ty.clone())
                    .collect();
                let mut values = Vec::new();
                for arg in args {
                    values.push(self.value(arg)?);
                }
                let start = if params.is_empty() {
                    0
                } else {
                    self.block((1, *routine), &params)?
                };
                for ((k, value), ty) in (0u8..).zip(values.iter().copied()).zip(&params) {
                    let slot = start.checked_add(k).ok_or(Failed)?;
                    self.transfer(slot, value, ty)?;
                }
                for value in values {
                    self.release(value);
                }
                let function = u8::try_from(*routine).map_err(|_| Failed)?;
                let result = if callee.returns.is_some() { dest } else { 0 };
                self.emit(Instr::abc(Op::Call, start, function, result))?;
            }
            ExprKind::Builtin { op, args } => self.builtin(*op, args, dest, &e.ty, e.span)?,
            ExprKind::Method { op, receiver, args } => {
                self.method(*op, receiver, args, dest, e.span)?;
            }
            ExprKind::Transfer { coins, to } => {
                let c = self.value(coins)?;
                let a = self.value(to)?;
                self.emit(Instr::abc(Op::Transfer, c, a, 0))?;
                self.release(c);
                self.release(a);
            }
            ExprKind::RecordValue { .. } => {
                return Err(self.fail(e.span, "Record values are not supported here yet."));
            }
        }
        Ok(())
    }

    fn builtin(&mut self, op: Builtin, args: &[Expr], dest: u8, ty: &Ty, span: Span) -> Gen<()> {
        let first = args.first();
        match op {
            Builtin::SignerAddress
            | Builtin::CoinsValue
            | Builtin::ListLength
            | Builtin::TextLength
            | Builtin::OptionalIsSome
            | Builtin::OptionalValue => {
                let r = self.value(first.ok_or(Failed)?)?;
                let opcode = match op {
                    Builtin::SignerAddress => Op::SignerAddr,
                    Builtin::CoinsValue => Op::CValue,
                    Builtin::ListLength | Builtin::TextLength => Op::Len,
                    Builtin::OptionalIsSome => Op::IsSome,
                    _ => Op::Unwrap,
                };
                self.emit(Instr::abc(opcode, dest, r, 0))?;
                self.release(r);
            }
            Builtin::VaultBalance => {
                let slot = match first.map(|a| &a.kind) {
                    Some(ExprKind::Read(place)) => Self::storage_slot(place),
                    _ => None,
                }
                .ok_or_else(|| self.fail(span, "A vault balance is read from a storage vault."))?;
                self.emit(Instr::abc(Op::VBalance, dest, slot, 0))?;
            }
            Builtin::MapGet | Builtin::MapContains => {
                let slot = match first.map(|a| &a.kind) {
                    Some(ExprKind::Read(place)) => Self::storage_slot(place),
                    _ => None,
                }
                .ok_or_else(|| self.fail(span, "Maps are used through storage fields."))?;
                let key = self.value(args.get(1).ok_or(Failed)?)?;
                let opcode = if op == Builtin::MapGet {
                    Op::MGet
                } else {
                    Op::MHas
                };
                self.emit(Instr::abc(opcode, dest, slot, key))?;
                self.release(key);
            }
            Builtin::ChainHeight => self.host(dest, HostFn::ChainHeight, args, ty)?,
            Builtin::ChainSlot => self.host(dest, HostFn::ChainSlot, args, ty)?,
            Builtin::ChainEpoch => self.host(dest, HostFn::ChainEpoch, args, ty)?,
            Builtin::ChainProtocolTime => self.host(dest, HostFn::ChainProtocolTime, args, ty)?,
            Builtin::ChainTxId => self.host(dest, HostFn::ChainTxId, args, ty)?,
            Builtin::Blake3 => self.host(dest, HostFn::Blake3, args, ty)?,
            Builtin::VerifyEd25519 => self.host(dest, HostFn::VerifyEd25519, args, ty)?,
            Builtin::MulDiv { round_up } => {
                let start = self.block((2, 0), &[Ty::U128, Ty::U128, Ty::U128])?;
                for (k, arg) in (0u8..).zip(args) {
                    let r = self.value(arg)?;
                    let slot = start.checked_add(k).ok_or(Failed)?;
                    self.transfer(slot, r, &Ty::U128)?;
                    self.release(r);
                }
                let opcode = if round_up { Op::MulDivUp } else { Op::MulDiv };
                self.emit(Instr::abc(opcode, dest, start, 0))?;
            }
            Builtin::Min | Builtin::Max => {
                let a = self.value(first.ok_or(Failed)?)?;
                let b = self.value(args.get(1).ok_or(Failed)?)?;
                let opcode = if op == Builtin::Min { Op::Min } else { Op::Max };
                self.emit(Instr::abc(opcode, dest, a, b))?;
                self.release(a);
                self.release(b);
            }
            Builtin::VaultEmpty => {
                return Err(self.fail(
                    span,
                    "'Vault.Empty' can only be assigned to a storage vault.",
                ));
            }
        }
        Ok(())
    }

    fn method(
        &mut self,
        op: Method,
        receiver: &Place,
        args: &[Expr],
        dest: u8,
        span: Span,
    ) -> Gen<()> {
        let slot = Self::storage_slot(receiver);
        match op {
            Method::VaultDeposit => {
                let slot = slot.ok_or_else(|| self.fail(span, "Vaults live in storage."))?;
                let coins = self.value(args.first().ok_or(Failed)?)?;
                self.emit(Instr::abc(Op::VDeposit, coins, slot, 0))?;
                self.release(coins);
            }
            Method::VaultWithdraw => {
                let slot = slot.ok_or_else(|| self.fail(span, "Vaults live in storage."))?;
                let amount = self.value(args.first().ok_or(Failed)?)?;
                self.emit(Instr::abc(Op::VWithdraw, dest, slot, amount))?;
                self.release(amount);
            }
            Method::VaultWithdrawAll => {
                let slot = slot.ok_or_else(|| self.fail(span, "Vaults live in storage."))?;
                self.emit(Instr::abc(Op::VWithdrawAll, dest, slot, 0))?;
            }
            Method::MapPut | Method::MapRemove => {
                let slot = slot.ok_or_else(|| self.fail(span, "Maps live in storage."))?;
                let key = self.value(args.first().ok_or(Failed)?)?;
                if op == Method::MapPut {
                    let value = self.value(args.get(1).ok_or(Failed)?)?;
                    self.emit(Instr::abc(Op::MPut, value, slot, key))?;
                    self.release(value);
                } else {
                    self.emit(Instr::abc(Op::MDel, 0, slot, key))?;
                }
                self.release(key);
            }
            Method::ListAdd => {
                let item = self.value(args.first().ok_or(Failed)?)?;
                let (list, alias) = self.read_place(receiver, span)?;
                self.emit(Instr::abc(Op::Push, list, item, 0))?;
                if !alias {
                    self.write_place(receiver, list, span)?;
                    self.release(list);
                }
                self.release(item);
            }
            Method::CoinsSplit | Method::CoinsJoin => {
                let Place::Local(id) = receiver else {
                    return Err(self.fail(span, "Split and Join work on a Coins variable."));
                };
                let target = Self::local(*id)?;
                let arg = self.value(args.first().ok_or(Failed)?)?;
                if op == Method::CoinsSplit {
                    self.emit(Instr::abc(Op::CSplit, dest, target, arg))?;
                } else {
                    self.emit(Instr::abc(Op::CJoin, target, arg, 0))?;
                }
                self.release(arg);
            }
        }
        Ok(())
    }

    /// The `LOOP` counter for a bound, loaded with `bound - 1` (bottom-tested loops).
    fn counter(&mut self, bound: u64) -> Gen<u8> {
        let r = match self.counters_free.pop() {
            Some(r) => r,
            None => {
                let ty = self.tables.ty(self.program, &Ty::U64)?;
                let r = self.new_register(ty)?;
                self.counters.push(r);
                r
            }
        };
        self.load_int(r, u128::from(bound.saturating_sub(1)))?;
        Ok(r)
    }

    fn stmts(&mut self, body: &[Stmt]) -> Gen<()> {
        for stmt in body {
            self.stmt(stmt)?;
        }
        Ok(())
    }

    #[allow(
        clippy::too_many_lines,
        reason = "one arm per statement kind reads best together"
    )]
    fn stmt(&mut self, stmt: &Stmt) -> Gen<()> {
        match &stmt.kind {
            StmtKind::Assign { place, value } => {
                if let (
                    Place::Storage(slot),
                    ExprKind::Builtin {
                        op: Builtin::VaultEmpty,
                        ..
                    },
                ) = (place, &value.kind)
                {
                    self.emit(Instr::abx(Op::VEmpty, 0, *slot))?;
                    return Ok(());
                }
                if let Place::Local(id) = place {
                    let r = Self::local(*id)?;
                    // Into the local directly, unless the value reads the local in a way a
                    // partial write could disturb (a plain read is handled by `transfer`).
                    match &value.kind {
                        ExprKind::Read(Place::Local(_)) | ExprKind::Move(_) => {
                            let v = self.value(value)?;
                            self.transfer(r, v, &value.ty)?;
                        }
                        _ => self.into(value, r)?,
                    }
                    return Ok(());
                }
                let v = self.value(value)?;
                self.write_place(place, v, stmt.span)?;
                self.release(v);
            }
            StmtKind::Eval(e) => {
                if e.ty == Ty::Unit {
                    self.into(e, 0)?;
                } else {
                    let r = self.value(e)?;
                    self.release(r);
                }
            }
            StmtKind::If {
                cond,
                then,
                otherwise,
            } => {
                let c = self.value(cond)?;
                let to_else = self.emit(Instr::abx(Op::JmpIfNot, c, 0))?;
                self.release(c);
                self.stmts(then)?;
                if otherwise.is_empty() {
                    self.patch(to_else);
                } else {
                    let to_end = self.emit(Instr::abx(Op::Jmp, 0, 0))?;
                    self.patch(to_else);
                    self.stmts(otherwise)?;
                    self.patch(to_end);
                }
            }
            StmtKind::Case {
                subject,
                arms,
                otherwise,
            } => {
                let s = self.value(subject)?;
                let label = self.temp(&subject.ty)?;
                let hit = self.temp(&Ty::Bool)?;
                let mut to_arm: Vec<Vec<usize>> = Vec::new();
                for (labels, _) in arms {
                    let mut jumps = Vec::new();
                    for value in labels {
                        self.load_int(label, *value)?;
                        self.emit(Instr::abc(Op::Eq, hit, s, label))?;
                        jumps.push(self.emit(Instr::abx(Op::JmpIf, hit, 0))?);
                    }
                    to_arm.push(jumps);
                }
                self.release(label);
                self.release(hit);
                self.release(s);
                self.stmts(otherwise)?;
                let mut to_end = vec![self.emit(Instr::abx(Op::Jmp, 0, 0))?];
                for ((_, body), jumps) in arms.iter().zip(to_arm) {
                    for jump in jumps {
                        self.patch(jump);
                    }
                    self.stmts(body)?;
                    to_end.push(self.emit(Instr::abx(Op::Jmp, 0, 0))?);
                }
                for jump in to_end {
                    self.patch(jump);
                }
            }
            StmtKind::ForRange {
                var,
                from,
                to,
                bound,
                body,
            } => {
                let v = Self::local(*var)?;
                let ty = self
                    .routine
                    .locals
                    .get(usize::from(*var))
                    .map_or(Ty::Error, |l| l.ty.clone());
                self.into(from, v)?;
                let limit = self.temp(&ty)?;
                self.into(to, limit)?;
                let test = self.temp(&Ty::Bool)?;
                self.emit(Instr::abc(Op::Le, test, v, limit))?;
                let skip = self.emit(Instr::abx(Op::JmpIfNot, test, 0))?;
                let counter = self.counter(*bound)?;
                let one = self.temp(&ty)?;
                let start = self.here();
                self.stmts(body)?;
                self.emit(Instr::abc(Op::Eq, test, v, limit))?;
                let done = self.emit(Instr::abx(Op::JmpIf, test, 0))?;
                self.emit(Instr::abx(Op::LoadI, one, 1))?;
                self.emit(Instr::abc(Op::Add, v, v, one))?;
                self.emit(Instr::abx(Op::Loop, counter, start))?;
                self.patch(skip);
                self.patch(done);
                for r in [limit, test, counter, one] {
                    self.release(r);
                }
            }
            StmtKind::ForEach {
                var,
                collection,
                bound,
                body,
            } => {
                let v = Self::local(*var)?;
                let coll = self.temp(&collection.ty)?;
                self.into(collection, coll)?;
                let n = self.temp(&Ty::U64)?;
                self.emit(Instr::abc(Op::Len, n, coll, 0))?;
                let i = self.temp(&Ty::U64)?;
                self.emit(Instr::abx(Op::LoadI, i, 1))?;
                let test = self.temp(&Ty::Bool)?;
                self.emit(Instr::abc(Op::Le, test, i, n))?;
                let skip = self.emit(Instr::abx(Op::JmpIfNot, test, 0))?;
                let counter = self.counter(*bound)?;
                let one = self.temp(&Ty::U64)?;
                let start = self.here();
                self.emit(Instr::abc(Op::GetI, v, coll, i))?;
                self.stmts(body)?;
                self.emit(Instr::abc(Op::Eq, test, i, n))?;
                let done = self.emit(Instr::abx(Op::JmpIf, test, 0))?;
                self.emit(Instr::abx(Op::LoadI, one, 1))?;
                self.emit(Instr::abc(Op::Add, i, i, one))?;
                self.emit(Instr::abx(Op::Loop, counter, start))?;
                self.patch(skip);
                self.patch(done);
                for r in [coll, n, i, test, counter, one] {
                    self.release(r);
                }
            }
            StmtKind::While { cond, bound, body } => {
                let counter = self.counter(*bound)?;
                let c = self.temp(&Ty::Bool)?;
                self.into(cond, c)?;
                let skip = self.emit(Instr::abx(Op::JmpIfNot, c, 0))?;
                let start = self.here();
                self.stmts(body)?;
                self.into(cond, c)?;
                let done = self.emit(Instr::abx(Op::JmpIfNot, c, 0))?;
                self.emit(Instr::abx(Op::Loop, counter, start))?;
                self.patch(skip);
                self.patch(done);
                self.release(c);
                self.release(counter);
            }
            StmtKind::Require { cond, error } => {
                let c = self.value(cond)?;
                self.emit(Instr::abx(Op::Assert, c, *error))?;
                self.release(c);
            }
            StmtKind::Fail(error) => {
                self.emit(Instr::abx(Op::Abort, 0, *error))?;
            }
            StmtKind::Emit { event, args } => {
                let fields: Vec<Ty> = self
                    .program
                    .events
                    .get(usize::from(*event))
                    .map_or_else(Vec::new, |e| {
                        e.fields.iter().map(|(_, t)| t.clone()).collect()
                    });
                let start = if fields.is_empty() {
                    0
                } else {
                    self.block((4, *event), &fields)?
                };
                for ((k, arg), ty) in (0u8..).zip(args).zip(&fields) {
                    let r = self.value(arg)?;
                    let slot = start.checked_add(k).ok_or(Failed)?;
                    self.transfer(slot, r, ty)?;
                    self.release(r);
                }
                let event = u8::try_from(*event).map_err(|_| Failed)?;
                let count = u8::try_from(fields.len()).map_err(|_| Failed)?;
                self.emit(Instr::abc(Op::Emit, start, event, count))?;
            }
            StmtKind::Exit => self.ret()?,
        }
        Ok(())
    }

    fn ret(&mut self) -> Gen<()> {
        match self.routine.result {
            Some(id) => self.emit(Instr::abc(Op::Ret, Self::local(id)?, 0, 0))?,
            None => self.emit(Instr::abc(Op::RetV, 0, 0, 0))?,
        };
        Ok(())
    }
}

/// Generates the package. The bytecode verifier runs on the result in [`crate::compile`].
pub fn generate(
    program: &Program,
    compiler: &str,
    source_hash: aletheia_core::Hash32,
    diagnostics: &mut Diagnostics,
) -> Option<Package> {
    let mut tables = Tables {
        constants: Vec::new(),
        constant_index: BTreeMap::new(),
        types: Vec::new(),
        type_index: BTreeMap::new(),
    };
    let mut build = || -> Gen<Package> {
        let name = tables.text(&program.name)?;
        let mut storage = Vec::new();
        for field in &program.storage {
            storage.push(StorageSlot {
                name: tables.text(&field.name)?,
                ty: tables.ty(program, &field.ty)?,
            });
        }
        let mut errors = Vec::new();
        for error in &program.errors {
            errors.push(PErrorDef {
                name: tables.text(&error.name)?,
                message: tables.text(&error.message)?,
            });
        }
        let mut events = Vec::new();
        for event in &program.events {
            let mut fields = Vec::new();
            for (field, ty) in &event.fields {
                fields.push((tables.text(field)?, tables.ty(program, ty)?));
            }
            events.push(PEventDef {
                name: tables.text(&event.name)?,
                fields,
            });
        }
        let mut functions = Vec::new();
        let mut code = Vec::new();
        for routine in &program.routines {
            let mut registers = Vec::new();
            for local in &routine.locals {
                registers.push(tables.ty(program, &local.ty)?);
            }
            if registers.len() > MAX_REGISTERS {
                diagnostics.error(
                    "A7001",
                    routine.name_span,
                    "This routine has more than 255 variables. Split it into smaller routines.",
                );
                return Err(Failed);
            }
            let mut f = FnGen {
                program,
                routine,
                tables: &mut tables,
                diagnostics,
                code: Vec::new(),
                registers,
                free: BTreeMap::new(),
                blocks: BTreeMap::new(),
                counters: Vec::new(),
                counters_free: Vec::new(),
            };
            f.stmts(&routine.body)?;
            f.ret()?;
            let FnGen {
                code: instrs,
                registers,
                ..
            } = f;
            let bytes: Vec<u8> = instrs.iter().flat_map(|i| i.encode()).collect();
            let mut flags = 0u8;
            if routine.has(Directive::Entry) {
                flags |= FLAG_ENTRY;
            }
            if routine.has(Directive::View) {
                flags |= FLAG_VIEW;
            }
            if routine.has(Directive::Reentrant) {
                flags |= FLAG_REENTRANT;
            }
            if routine.kind == RoutineKind::Constructor {
                flags |= FLAG_CONSTRUCTOR;
            }
            functions.push(FunctionDef {
                name: tables.text(&routine.name)?,
                params: u8::try_from(routine.params).map_err(|_| Failed)?,
                returns: routine
                    .returns
                    .as_ref()
                    .map(|ty| tables.ty(program, ty))
                    .transpose()?,
                flags,
                effects: routine.effects_mask(),
                registers,
                code_offset: u32::try_from(code.len()).map_err(|_| Failed)?,
                code_len: u32::try_from(bytes.len()).map_err(|_| Failed)?,
            });
            code.extend(bytes);
        }
        Ok(Package {
            arno_version: (program.version.0 << 8) | program.version.1,
            compiler: compiler.to_owned(),
            source_hash,
            name,
            constants: tables.constants.clone(),
            types: tables.types.clone(),
            functions,
            storage,
            errors,
            events,
            code,
        })
    };
    build().ok()
}
