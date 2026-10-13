//! The deploy-time bytecode verifier (spec Section 27) [CONSENSUS-CRITICAL].
//!
//! Every validator runs it before a package is stored, and the compiler runs the same code on
//! everything it emits. It rejects:
//!
//! - malformed tables: names that are not text, type references that are not to earlier
//!   types, storage or events holding coins, functions whose code ranges do not tile `code`;
//! - invalid instructions: unknown opcodes, registers, constants, functions, storage slots,
//!   errors or events out of range, operand types that do not fit the opcode;
//! - unbounded control flow: jumps go forward within the function; the only way back is
//!   `LOOP`, whose counter register no instruction but a constant load (or `LOOP` itself)
//!   writes; every function ends in `RET`, `RETV` or `ABORT`;
//! - lost or duplicated coins: on every path each coins register is filled before use and
//!   emptied exactly once, two paths meeting must agree, and nothing is left at a return;
//! - effects beyond the declared mask, including those of called functions;
//! - recursion and call chains deeper than [`MAX_CALL_DEPTH`].
//!
//! Registers start at their type's zero value (coins registers start empty), so a read before
//! a write is defined and deterministic.

use std::collections::{BTreeMap, BTreeSet};

use aletheia_core::{AletheiaError, ErrorCode};

use crate::opcode::{HostFn, Instr, Op};
use crate::package::{
    Constant, EFFECT_CALLS_CONTRACTS, EFFECT_CHANGES_STORAGE, EFFECT_EMITS_EVENTS,
    EFFECT_RECEIVES_COINS, EFFECT_SENDS_COINS, FLAG_CONSTRUCTOR, FLAG_ENTRY, FLAG_REENTRANT,
    FLAG_VIEW, FunctionDef, MAX_PARAMS, MAX_TEXT_CONSTANT, Package, TypeDef,
};

/// Frames on the call stack, the entry frame included (Section 28).
pub const MAX_CALL_DEPTH: usize = 16;
/// Assets a package may name in v1: AEY and ALnT.
pub const KNOWN_ASSETS: [u32; 2] = [1, 2];

fn reject(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::VmVerifyFailed, detail)
}

struct Verifier<'a> {
    package: &'a Package,
}

/// The coins registers that hold coins at one point.
type Full = BTreeSet<u8>;

impl Verifier<'_> {
    fn ty(&self, index: u16) -> Option<&TypeDef> {
        self.package.types.get(usize::from(index))
    }

    fn text(&self, index: u16, what: &str) -> Result<(), AletheiaError> {
        self.package
            .text(index)
            .map(|_| ())
            .ok_or_else(|| reject(format!("{what} name {index} is not a text constant")))
    }

    /// Structural type equality (the type table may repeat a type).
    fn same(&self, a: u16, b: u16) -> bool {
        if a == b {
            return true;
        }
        let (Some(x), Some(y)) = (self.ty(a), self.ty(b)) else {
            return false;
        };
        match (x, y) {
            (TypeDef::Array { len: l1, elem: e1 }, TypeDef::Array { len: l2, elem: e2 }) => {
                l1 == l2 && self.same(*e1, *e2)
            }
            (TypeDef::List { max: m1, elem: e1 }, TypeDef::List { max: m2, elem: e2 }) => {
                m1 == m2 && self.same(*e1, *e2)
            }
            (TypeDef::Map { key: k1, value: v1 }, TypeDef::Map { key: k2, value: v2 }) => {
                self.same(*k1, *k2) && self.same(*v1, *v2)
            }
            (TypeDef::Optional { elem: e1 }, TypeDef::Optional { elem: e2 }) => self.same(*e1, *e2),
            (TypeDef::Record { fields: f1, .. }, TypeDef::Record { fields: f2, .. }) => {
                // Records are nominal: equal only if the same definition (same index), so a
                // repeated identical definition elsewhere is still a different type.
                let _ = (f1, f2);
                false
            }
            (TypeDef::Enum { .. }, TypeDef::Enum { .. }) => false,
            (x, y) => x == y,
        }
    }

    /// Whether a type holds coins or a signer anywhere inside it.
    fn holds_coins_or_signer(&self, index: u16) -> bool {
        match self.ty(index) {
            Some(TypeDef::Coins { .. } | TypeDef::Signer) => true,
            Some(
                TypeDef::Array { elem, .. }
                | TypeDef::List { elem, .. }
                | TypeDef::Optional { elem },
            ) => self.holds_coins_or_signer(*elem),
            Some(TypeDef::Map { key, value }) => {
                self.holds_coins_or_signer(*key) || self.holds_coins_or_signer(*value)
            }
            Some(TypeDef::Record { fields, .. }) => {
                fields.iter().any(|(_, ty)| self.holds_coins_or_signer(*ty))
            }
            _ => false,
        }
    }

    fn tables(&self) -> Result<(), AletheiaError> {
        let p = self.package;
        self.text(p.name, "contract")?;
        for (index, ty) in p.types.iter().enumerate() {
            let earlier = |r: u16| usize::from(r) < index;
            let bad = |detail: &str| Err(reject(format!("type {index}: {detail}")));
            match ty {
                TypeDef::Text { max } | TypeDef::BytesMax { max }
                    if *max == 0 || *max > MAX_TEXT_CONSTANT =>
                {
                    return bad("text or byte maximum out of range");
                }
                TypeDef::BytesFixed { len } if *len == 0 || *len > MAX_TEXT_CONSTANT => {
                    return bad("byte length out of range");
                }
                TypeDef::Enum { name, variants } => {
                    self.text(*name, "enumeration")?;
                    if variants.is_empty() {
                        return bad("an enumeration needs at least one value");
                    }
                    for variant in variants {
                        self.text(*variant, "enumeration value")?;
                    }
                }
                TypeDef::Record { name, fields } => {
                    self.text(*name, "record")?;
                    for (field, ty) in fields {
                        self.text(*field, "field")?;
                        if !earlier(*ty) {
                            return bad("a field refers to a later type");
                        }
                    }
                }
                TypeDef::Array { len, elem } | TypeDef::List { max: len, elem } => {
                    if *len == 0 || !earlier(*elem) {
                        return bad("collection size is 0 or its element type is not earlier");
                    }
                }
                TypeDef::Map { key, value } => {
                    if !earlier(*key) || !earlier(*value) {
                        return bad("map types must refer to earlier types");
                    }
                    let key_ok = self.ty(*key).is_some_and(|k| {
                        k.is_ordered()
                            || matches!(
                                k,
                                TypeDef::Address
                                    | TypeDef::Hash
                                    | TypeDef::Enum { .. }
                                    | TypeDef::BytesFixed { .. }
                            )
                    });
                    if !key_ok {
                        return bad("map key type is not a plain value");
                    }
                }
                TypeDef::Optional { elem } if !earlier(*elem) => {
                    return bad("optional element type is not earlier");
                }
                TypeDef::Coins { asset } | TypeDef::Vault { asset }
                    if !KNOWN_ASSETS.contains(asset) =>
                {
                    return bad("unknown asset");
                }
                _ => {}
            }
        }
        // Registers and empty storage slots start as zero values, built before any execution
        // unit is charged: a type whose zero value alone exceeds a call's memory (a huge or
        // nested array) would have every node try to allocate it. Refuse it here.
        let zero_sizes = crate::value::zero_sizes(p);
        if let Some(index) = zero_sizes
            .iter()
            .position(|size| *size > crate::cost::MAX_CALL_MEMORY)
        {
            return Err(reject(format!(
                "type {index}: its zero value exceeds the {} bytes a call may use",
                crate::cost::MAX_CALL_MEMORY
            )));
        }
        for (index, slot) in p.storage.iter().enumerate() {
            self.text(slot.name, "storage")?;
            if self.ty(slot.ty).is_none() || self.holds_coins_or_signer(slot.ty) {
                return Err(reject(format!(
                    "storage slot {index}: missing type, or a type holding coins or a signer"
                )));
            }
        }
        for error in &p.errors {
            self.text(error.name, "error")?;
            self.text(error.message, "error message")?;
        }
        for (index, event) in p.events.iter().enumerate() {
            self.text(event.name, "event")?;
            for (name, ty) in &event.fields {
                self.text(*name, "event field")?;
                let plain = self
                    .ty(*ty)
                    .is_some_and(|t| !matches!(t, TypeDef::Vault { .. } | TypeDef::Map { .. }))
                    && !self.holds_coins_or_signer(*ty);
                if !plain {
                    return Err(reject(format!(
                        "event {index}: a field is not a plain value"
                    )));
                }
            }
        }
        // Function code must tile `code` exactly, in order.
        let mut cursor = 0u32;
        let mut constructors = 0usize;
        for (index, f) in p.functions.iter().enumerate() {
            self.text(f.name, "function")?;
            let bad = |detail: &str| Err(reject(format!("function {index}: {detail}")));
            if f.code_offset != cursor || f.code_len == 0 || f.code_len % 4 != 0 {
                return bad(
                    "code ranges must be non-empty, whole instructions, and tile the code in order",
                );
            }
            cursor = cursor
                .checked_add(f.code_len)
                .ok_or_else(|| reject("code range overflows".to_owned()))?;
            if u32::from(f.params) > MAX_PARAMS || usize::from(f.params) > f.registers.len() {
                return bad("more parameters than allowed or than registers");
            }
            if f.registers.iter().any(|ty| self.ty(*ty).is_none())
                || f.returns.is_some_and(|ty| self.ty(ty).is_none())
            {
                return bad("a register or result type does not exist");
            }
            if f.registers.iter().any(|ty| {
                matches!(
                    self.ty(*ty),
                    Some(TypeDef::Vault { .. } | TypeDef::Map { .. })
                )
            }) {
                return bad("vaults and maps live only in storage, never in registers");
            }
            let frame = f
                .registers
                .iter()
                .map(|ty| zero_sizes.get(usize::from(*ty)).copied().unwrap_or(0))
                .fold(0u64, u64::saturating_add);
            if frame > crate::cost::MAX_CALL_MEMORY {
                return bad("its registers start larger than the memory a call may use");
            }
            let known = FLAG_ENTRY | FLAG_VIEW | FLAG_REENTRANT | FLAG_CONSTRUCTOR;
            if f.flags & !known != 0 {
                return bad("unknown flag bits");
            }
            let all_effects = EFFECT_CHANGES_STORAGE
                | EFFECT_RECEIVES_COINS
                | EFFECT_SENDS_COINS
                | EFFECT_EMITS_EVENTS
                | EFFECT_CALLS_CONTRACTS;
            if f.effects & !all_effects != 0 {
                return bad("unknown effect bits");
            }
            if f.flags & FLAG_VIEW != 0 && f.effects != 0 {
                return bad("a view function declares effects");
            }
            if f.flags & FLAG_CONSTRUCTOR != 0 {
                constructors = constructors.saturating_add(1);
                if f.returns.is_some() {
                    return bad("the constructor returns a value");
                }
            }
            let params = f.registers.get(..usize::from(f.params)).unwrap_or_default();
            if f.flags & (FLAG_ENTRY | FLAG_CONSTRUCTOR) != 0
                && !matches!(
                    params.first().and_then(|t| self.ty(*t)),
                    Some(TypeDef::Signer)
                )
            {
                return bad("an entry function takes the caller's Signer first");
            }
            if params
                .iter()
                .any(|t| self.ty(*t).is_some_and(TypeDef::is_coins))
                && f.effects & EFFECT_RECEIVES_COINS == 0
            {
                return bad("takes coins but does not declare 'receives coins'");
            }
        }
        if usize::try_from(cursor).ok() != Some(p.code.len()) {
            return Err(reject(
                "function code does not cover the whole code section".to_owned(),
            ));
        }
        if constructors > 1 {
            return Err(reject("more than one constructor".to_owned()));
        }
        Ok(())
    }

    fn instructions(&self, f: &FunctionDef) -> Result<Vec<Instr>, AletheiaError> {
        let start = usize::try_from(f.code_offset).unwrap_or(usize::MAX);
        let end = start.saturating_add(usize::try_from(f.code_len).unwrap_or(usize::MAX));
        let code = self
            .package
            .code
            .get(start..end)
            .ok_or_else(|| reject("function code out of range".to_owned()))?;
        code.chunks_exact(4)
            .enumerate()
            .map(|(pc, word)| {
                let word: [u8; 4] = word
                    .try_into()
                    .map_err(|_| reject("partial instruction".to_owned()))?;
                Instr::decode(word).ok_or_else(|| {
                    reject(format!(
                        "instruction {pc}: unknown opcode {:#04x}",
                        word.get(3).copied().unwrap_or(0)
                    ))
                })
            })
            .collect()
    }

    fn verify(&self) -> Result<(), AletheiaError> {
        self.tables()?;
        let mut calls: Vec<BTreeSet<u8>> = Vec::new();
        let mut code = Vec::new();
        for f in &self.package.functions {
            code.push(self.instructions(f)?);
        }
        for (index, (f, instrs)) in self.package.functions.iter().zip(&code).enumerate() {
            let name = self.package.text(f.name).unwrap_or("?").to_owned();
            let checker = FunctionCheck {
                v: self,
                f,
                instrs,
                name: &name,
            };
            calls.push(
                checker
                    .run()
                    .map_err(|e| reject(format!("function {index} '{name}': {}", e.detail())))?,
            );
        }
        self.call_graph(&calls)?;
        Ok(())
    }

    /// No recursion; no chain of calls deeper than the frame limit; callees' effects within
    /// the caller's mask.
    fn call_graph(&self, calls: &[BTreeSet<u8>]) -> Result<(), AletheiaError> {
        let mut depth: BTreeMap<u8, usize> = BTreeMap::new();
        fn visit(
            node: u8,
            calls: &[BTreeSet<u8>],
            stack: &mut Vec<u8>,
            depth: &mut BTreeMap<u8, usize>,
        ) -> Result<usize, AletheiaError> {
            if let Some(d) = depth.get(&node) {
                return Ok(*d);
            }
            if stack.contains(&node) {
                return Err(reject(format!(
                    "function {node} is part of a call cycle (recursion)"
                )));
            }
            stack.push(node);
            let mut deepest = 0usize;
            for callee in calls.get(usize::from(node)).into_iter().flatten() {
                deepest = deepest.max(visit(*callee, calls, stack, depth)?);
            }
            stack.pop();
            let d = deepest.saturating_add(1);
            depth.insert(node, d);
            Ok(d)
        }
        for node in 0..calls.len() {
            let node = u8::try_from(node).map_err(|_| reject("too many functions".to_owned()))?;
            let d = visit(node, calls, &mut Vec::new(), &mut depth)?;
            if d > MAX_CALL_DEPTH {
                return Err(reject(format!(
                    "function {node} can reach a call depth of {d}; the limit is {MAX_CALL_DEPTH}"
                )));
            }
        }
        for (caller, callees) in calls.iter().enumerate() {
            let mask = self.package.functions.get(caller).map_or(0, |f| f.effects);
            for callee in callees {
                let theirs = self
                    .package
                    .functions
                    .get(usize::from(*callee))
                    .map_or(0, |f| f.effects & !EFFECT_RECEIVES_COINS);
                if theirs & !mask != 0 {
                    return Err(reject(format!(
                        "function {caller} calls function {callee}, whose effects it does not declare"
                    )));
                }
            }
        }
        Ok(())
    }
}

struct FunctionCheck<'a> {
    v: &'a Verifier<'a>,
    f: &'a FunctionDef,
    instrs: &'a [Instr],
    name: &'a str,
}

impl FunctionCheck<'_> {
    fn reg(&self, r: u8) -> Result<(u16, &TypeDef), AletheiaError> {
        let ty = self
            .f
            .registers
            .get(usize::from(r))
            .copied()
            .ok_or_else(|| reject(format!("register {r} does not exist")))?;
        let def = self
            .v
            .ty(ty)
            .ok_or_else(|| reject(format!("register {r} has no type")))?;
        Ok((ty, def))
    }

    fn reg_plus(&self, r: u8, k: u8) -> Result<u8, AletheiaError> {
        r.checked_add(k)
            .ok_or_else(|| reject(format!("register {r}+{k} does not exist")))
    }

    fn need(&self, ok: bool, detail: &str) -> Result<(), AletheiaError> {
        if ok {
            Ok(())
        } else {
            Err(reject(detail.to_owned()))
        }
    }

    fn need_effect(&self, bit: u8, what: &str) -> Result<(), AletheiaError> {
        self.need(
            self.f.effects & bit != 0,
            &format!("{what}, but the function does not declare that effect"),
        )
    }

    fn storage(&self, slot: u16) -> Result<(u16, &TypeDef), AletheiaError> {
        let ty = self
            .v
            .package
            .storage
            .get(usize::from(slot))
            .map(|s| s.ty)
            .ok_or_else(|| reject(format!("storage slot {slot} does not exist")))?;
        Ok((
            ty,
            self.v
                .ty(ty)
                .ok_or_else(|| reject("storage type missing".to_owned()))?,
        ))
    }

    fn same_regs(&self, regs: &[u8]) -> Result<u16, AletheiaError> {
        let mut first: Option<u16> = None;
        for r in regs {
            let (ty, _) = self.reg(*r)?;
            match first {
                None => first = Some(ty),
                Some(f) => self.need(self.v.same(f, ty), "operands have different types")?,
            }
        }
        first.ok_or_else(|| reject("no operands".to_owned()))
    }

    fn equality_capable(def: &TypeDef) -> bool {
        def.is_ordered()
            || matches!(
                def,
                TypeDef::Bool
                    | TypeDef::Address
                    | TypeDef::Hash
                    | TypeDef::Enum { .. }
                    | TypeDef::Text { .. }
                    | TypeDef::BytesFixed { .. }
                    | TypeDef::BytesMax { .. }
            )
    }

    /// The register an instruction writes, if any (for the loop-counter rule).
    fn writes(instr: Instr, returns: bool) -> Option<u8> {
        match instr.op {
            Op::Nop
            | Op::Jmp
            | Op::JmpIf
            | Op::JmpIfNot
            | Op::Ret
            | Op::RetV
            | Op::Abort
            | Op::Assert
            | Op::SStore
            | Op::MPut
            | Op::MDel
            | Op::VDeposit
            | Op::VEmpty
            | Op::Transfer
            | Op::Emit => None,
            Op::Call => returns.then_some(instr.c),
            _ => Some(instr.a),
        }
    }

    /// Checks one instruction's operands and effects. Returns the callee of a CALL.
    fn operands(&self, pc: usize, instr: Instr) -> Result<Option<u8>, AletheiaError> {
        let len = self.instrs.len();
        let (a, b, c, bx) = (instr.a, instr.b, instr.c, instr.bx());
        match instr.op {
            Op::Nop => {}
            Op::Mov => {
                let ty = self.same_regs(&[a, b])?;
                self.need(
                    !self.v.ty(ty).is_some_and(TypeDef::is_coins),
                    "coins move with MOVE, never MOV",
                )?;
                self.need(
                    !matches!(self.v.ty(ty), Some(TypeDef::Signer)) || a != b,
                    "invalid signer copy",
                )?;
            }
            Op::LoadK => {
                let (_, def) = self.reg(a)?;
                let constant = self
                    .v
                    .package
                    .constants
                    .get(usize::from(bx))
                    .ok_or_else(|| reject(format!("constant {bx} does not exist")))?;
                let fits = match (constant, def) {
                    (Constant::Int(value), d) => int_fits(d, *value),
                    (Constant::Text(text), TypeDef::Text { max }) => {
                        u32::try_from(text.len()).is_ok_and(|l| l <= *max)
                    }
                    (Constant::Bytes(bytes), TypeDef::BytesFixed { len }) => {
                        u32::try_from(bytes.len()).ok() == Some(*len)
                    }
                    (Constant::Bytes(bytes), TypeDef::BytesMax { max }) => {
                        u32::try_from(bytes.len()).is_ok_and(|l| l <= *max)
                    }
                    (Constant::Bytes(bytes), TypeDef::Address) => bytes.len() == 33,
                    (Constant::Bytes(bytes), TypeDef::Hash) => bytes.len() == 32,
                    _ => false,
                };
                self.need(fits, "the constant does not fit the register's type")?;
            }
            Op::LoadI => {
                let (_, def) = self.reg(a)?;
                let value = u128::from(bx);
                let fits = match def {
                    TypeDef::Bool => value <= 1,
                    TypeDef::Enum { variants, .. } => usize::from(bx) < variants.len(),
                    d => int_fits(d, value),
                };
                self.need(fits, "the immediate does not fit the register's type")?;
            }
            Op::LoadNothing => {
                let (_, def) = self.reg(a)?;
                self.need(
                    matches!(def, TypeDef::Optional { .. }),
                    "LOADNOTHING needs an optional register",
                )?;
            }
            Op::Move => {
                self.need(a != b, "MOVE to itself")?;
                let ty = self.same_regs(&[a, b])?;
                self.need(
                    self.v.ty(ty).is_some_and(TypeDef::is_coins),
                    "MOVE is for coins",
                )?;
            }
            Op::Add | Op::Sub | Op::Mul | Op::Div | Op::Mod => {
                let ty = self.same_regs(&[a, b, c])?;
                self.need(
                    self.v.ty(ty).is_some_and(TypeDef::is_integer),
                    "arithmetic needs whole numbers",
                )?;
            }
            Op::Min | Op::Max => {
                let ty = self.same_regs(&[a, b, c])?;
                self.need(
                    self.v.ty(ty).is_some_and(TypeDef::is_ordered),
                    "MIN and MAX need ordered values",
                )?;
            }
            Op::Neg => {
                let ty = self.same_regs(&[a, b])?;
                self.need(
                    matches!(self.v.ty(ty), Some(TypeDef::I64)),
                    "NEG needs Int64",
                )?;
            }
            Op::MulDiv | Op::MulDivUp => {
                let regs = [a, b, self.reg_plus(b, 1)?, self.reg_plus(b, 2)?];
                let ty = self.same_regs(&regs)?;
                self.need(
                    matches!(self.v.ty(ty), Some(TypeDef::U128)),
                    "MULDIV works on UInt128",
                )?;
            }
            Op::And | Op::Or | Op::Xor => {
                let ty = self.same_regs(&[a, b, c])?;
                self.need(
                    matches!(self.v.ty(ty), Some(TypeDef::Bool)),
                    "logic needs Booleans",
                )?;
            }
            Op::Not => {
                let ty = self.same_regs(&[a, b])?;
                self.need(
                    matches!(self.v.ty(ty), Some(TypeDef::Bool)),
                    "NOT needs Booleans",
                )?;
            }
            Op::Eq | Op::Ne | Op::Lt | Op::Le => {
                self.need(
                    matches!(self.reg(a)?.1, TypeDef::Bool),
                    "a comparison's result is Boolean",
                )?;
                let ty = self.same_regs(&[b, c])?;
                let def = self.v.ty(ty);
                let ok = if matches!(instr.op, Op::Lt | Op::Le) {
                    def.is_some_and(TypeDef::is_ordered)
                } else {
                    def.is_some_and(Self::equality_capable)
                };
                self.need(ok, "these values cannot be compared that way")?;
            }
            Op::Conv => {
                self.need(
                    self.reg(a)?.1.is_ordered() && self.reg(b)?.1.is_ordered(),
                    "CONV converts numbers and chain positions",
                )?;
            }
            Op::Jmp | Op::JmpIf | Op::JmpIfNot => {
                if instr.op != Op::Jmp {
                    self.need(
                        matches!(self.reg(a)?.1, TypeDef::Bool),
                        "a branch tests a Boolean",
                    )?;
                }
                let target = usize::from(bx);
                self.need(
                    target > pc && target < len,
                    "jumps go forward, to an instruction of the same function",
                )?;
            }
            Op::Loop => {
                self.need(
                    matches!(self.reg(a)?.1, TypeDef::U64),
                    "a loop counter is UInt64",
                )?;
                self.need(usize::from(bx) <= pc, "LOOP goes back")?;
            }
            Op::Call => {
                let callee = self
                    .v
                    .package
                    .functions
                    .get(usize::from(b))
                    .ok_or_else(|| reject(format!("function {b} does not exist")))?;
                self.need(
                    callee.flags & FLAG_CONSTRUCTOR == 0,
                    "the constructor cannot be called",
                )?;
                for k in 0..callee.params {
                    let r = self.reg_plus(a, k)?;
                    let (ty, _) = self.reg(r)?;
                    let want = callee
                        .registers
                        .get(usize::from(k))
                        .copied()
                        .unwrap_or(u16::MAX);
                    self.need(
                        self.v.same(ty, want),
                        "an argument's type does not match the parameter",
                    )?;
                }
                if let Some(ret) = callee.returns {
                    let (ty, _) = self.reg(c)?;
                    self.need(
                        self.v.same(ty, ret),
                        "the result register's type does not match",
                    )?;
                }
                return Ok(Some(b));
            }
            Op::Ret => {
                let ret = self.f.returns.ok_or_else(|| {
                    reject("RET in a function without a result; use RETV".to_owned())
                })?;
                let (ty, _) = self.reg(a)?;
                self.need(
                    self.v.same(ty, ret),
                    "the returned register's type does not match the result type",
                )?;
            }
            Op::RetV => self.need(self.f.returns.is_none(), "RETV in a function with a result")?,
            Op::Abort => self.need(
                usize::from(bx) < self.v.package.errors.len(),
                "the error does not exist",
            )?,
            Op::Assert => {
                self.need(
                    matches!(self.reg(a)?.1, TypeDef::Bool),
                    "ASSERT tests a Boolean",
                )?;
                self.need(
                    usize::from(bx) < self.v.package.errors.len(),
                    "the error does not exist",
                )?;
            }
            Op::SLoad | Op::SStore => {
                let (slot_ty, def) = self.storage(bx)?;
                self.need(
                    !matches!(def, TypeDef::Vault { .. } | TypeDef::Map { .. }),
                    "vaults and maps have their own instructions",
                )?;
                let (ty, _) = self.reg(a)?;
                self.need(
                    self.v.same(ty, slot_ty),
                    "the register's type does not match the storage slot",
                )?;
                if instr.op == Op::SStore {
                    self.need_effect(EFFECT_CHANGES_STORAGE, "SSTORE changes storage")?;
                }
            }
            Op::MGet | Op::MPut | Op::MDel | Op::MHas => {
                let (_, def) = self.storage(u16::from(b))?;
                let TypeDef::Map { key, value } = def else {
                    return Err(reject("map instructions need a map slot".to_owned()));
                };
                let (key_ty, _) = self.reg(c)?;
                self.need(
                    self.v.same(key_ty, *key),
                    "the key register's type does not match the map",
                )?;
                match instr.op {
                    Op::MGet => {
                        let (_, out) = self.reg(a)?;
                        self.need(
                            matches!(out, TypeDef::Optional { elem } if self.v.same(*elem, *value)),
                            "MGET gives an optional of the value type",
                        )?;
                    }
                    Op::MPut => {
                        let (ty, _) = self.reg(a)?;
                        self.need(
                            self.v.same(ty, *value),
                            "the value's type does not match the map",
                        )?;
                        self.need_effect(EFFECT_CHANGES_STORAGE, "MPUT changes storage")?;
                    }
                    Op::MDel => self.need_effect(EFFECT_CHANGES_STORAGE, "MDEL changes storage")?,
                    _ => self.need(
                        matches!(self.reg(a)?.1, TypeDef::Bool),
                        "MHAS gives a Boolean",
                    )?,
                }
            }
            Op::New => {
                let (_, def) = self.reg(a)?;
                self.need(
                    !matches!(def, TypeDef::Coins { .. } | TypeDef::Signer),
                    "coins and signers have no zero value",
                )?;
            }
            Op::GetF | Op::SetF => {
                let (record, field, value) = if instr.op == Op::GetF {
                    (b, c, a)
                } else {
                    (a, b, c)
                };
                let (_, def) = self.reg(record)?;
                let TypeDef::Record { fields, .. } = def else {
                    return Err(reject("field access needs a record".to_owned()));
                };
                let field_ty = fields
                    .get(usize::from(field))
                    .map(|(_, t)| *t)
                    .ok_or_else(|| reject("the field does not exist".to_owned()))?;
                let (ty, _) = self.reg(value)?;
                self.need(self.v.same(ty, field_ty), "the field's type does not match")?;
            }
            Op::GetI | Op::SetI => {
                let (collection, index, value) = if instr.op == Op::GetI {
                    (b, c, a)
                } else {
                    (a, b, c)
                };
                let elem = match self.reg(collection)?.1 {
                    TypeDef::Array { elem, .. } | TypeDef::List { elem, .. } => *elem,
                    _ => return Err(reject("indexing needs an array or list".to_owned())),
                };
                self.need(
                    matches!(self.reg(index)?.1, TypeDef::U64),
                    "an index is UInt64",
                )?;
                let (ty, _) = self.reg(value)?;
                self.need(self.v.same(ty, elem), "the element's type does not match")?;
            }
            Op::Len => {
                self.need(matches!(self.reg(a)?.1, TypeDef::U64), "a length is UInt64")?;
                self.need(
                    matches!(
                        self.reg(b)?.1,
                        TypeDef::List { .. }
                            | TypeDef::Array { .. }
                            | TypeDef::Text { .. }
                            | TypeDef::BytesMax { .. }
                            | TypeDef::BytesFixed { .. }
                    ),
                    "LEN needs a list, array, text or bytes",
                )?;
            }
            Op::Push => {
                let TypeDef::List { elem, .. } = self.reg(a)?.1 else {
                    return Err(reject("PUSH needs a list".to_owned()));
                };
                let elem = *elem;
                let (ty, _) = self.reg(b)?;
                self.need(
                    self.v.same(ty, elem),
                    "the item's type does not match the list",
                )?;
            }
            Op::Some | Op::Unwrap => {
                let (optional, inner) = if instr.op == Op::Some { (a, b) } else { (b, a) };
                let TypeDef::Optional { elem } = self.reg(optional)?.1 else {
                    return Err(reject("SOME and UNWRAP work with optionals".to_owned()));
                };
                let elem = *elem;
                let (ty, _) = self.reg(inner)?;
                self.need(
                    self.v.same(ty, elem),
                    "the value's type does not match the optional",
                )?;
            }
            Op::IsSome => {
                self.need(
                    matches!(self.reg(a)?.1, TypeDef::Bool),
                    "ISSOME gives a Boolean",
                )?;
                self.need(
                    matches!(self.reg(b)?.1, TypeDef::Optional { .. }),
                    "ISSOME tests an optional",
                )?;
            }
            Op::VDeposit | Op::VWithdraw | Op::VWithdrawAll => {
                let (_, def) = self.storage(u16::from(b))?;
                let TypeDef::Vault { asset } = def else {
                    return Err(reject("vault instructions need a vault slot".to_owned()));
                };
                let asset = *asset;
                self.need(
                    matches!(self.reg(a)?.1, TypeDef::Coins { asset: x } if *x == asset),
                    "the coins' asset does not match the vault",
                )?;
                if instr.op == Op::VWithdraw {
                    self.need(
                        matches!(self.reg(c)?.1, TypeDef::U128),
                        "an amount is UInt128",
                    )?;
                }
                self.need_effect(
                    EFFECT_CHANGES_STORAGE,
                    "a vault deposit or withdrawal changes storage",
                )?;
            }
            Op::VBalance => {
                self.need(
                    matches!(self.storage(u16::from(b))?.1, TypeDef::Vault { .. }),
                    "VBALANCE reads a vault",
                )?;
                self.need(
                    matches!(self.reg(a)?.1, TypeDef::U128),
                    "a balance is UInt128",
                )?;
            }
            Op::VEmpty => {
                self.need(
                    matches!(self.storage(bx)?.1, TypeDef::Vault { .. }),
                    "VEMPTY sets a vault",
                )?;
                self.need_effect(EFFECT_CHANGES_STORAGE, "VEMPTY changes storage")?;
            }
            Op::CValue => {
                self.need(
                    matches!(self.reg(a)?.1, TypeDef::U128),
                    "a value is UInt128",
                )?;
                self.need(self.reg(b)?.1.is_coins(), "CVALUE reads coins")?;
            }
            Op::CSplit | Op::CJoin => {
                self.need(a != b, "split and join need two different registers")?;
                let ty = self.same_regs(&[a, b])?;
                self.need(
                    self.v.ty(ty).is_some_and(TypeDef::is_coins),
                    "split and join work on coins",
                )?;
                if instr.op == Op::CSplit {
                    self.need(
                        matches!(self.reg(c)?.1, TypeDef::U128),
                        "an amount is UInt128",
                    )?;
                }
            }
            Op::Transfer => {
                self.need(self.reg(a)?.1.is_coins(), "TRANSFER sends coins")?;
                self.need(
                    matches!(self.reg(b)?.1, TypeDef::Address),
                    "TRANSFER sends to an address",
                )?;
                self.need_effect(EFFECT_SENDS_COINS, "TRANSFER sends coins")?;
            }
            Op::SignerAddr => {
                self.need(
                    matches!(self.reg(a)?.1, TypeDef::Address),
                    "SIGNERADDR gives an address",
                )?;
                self.need(
                    matches!(self.reg(b)?.1, TypeDef::Signer),
                    "SIGNERADDR reads a signer",
                )?;
            }
            Op::Emit => {
                let event = self
                    .v
                    .package
                    .events
                    .get(usize::from(b))
                    .ok_or_else(|| reject(format!("event {b} does not exist")))?;
                self.need(
                    usize::from(c) == event.fields.len(),
                    "the field count does not match the event",
                )?;
                for (k, (_, want)) in (0u8..).zip(&event.fields) {
                    let (ty, _) = self.reg(self.reg_plus(a, k)?)?;
                    self.need(
                        self.v.same(ty, *want),
                        "a field's type does not match the event",
                    )?;
                }
                self.need_effect(EFFECT_EMITS_EVENTS, "EMIT emits an event")?;
            }
            Op::Host => {
                let host = HostFn::from_id(bx)
                    .ok_or_else(|| reject(format!("host function {bx} does not exist")))?;
                let result = self.reg(a)?.1;
                let arg = |k: u8| -> Result<&TypeDef, AletheiaError> {
                    Ok(self.reg(self.reg_plus(a, k)?)?.1)
                };
                let ok = match host {
                    HostFn::ChainHeight => matches!(result, TypeDef::Height),
                    HostFn::ChainSlot => matches!(result, TypeDef::Slot),
                    HostFn::ChainEpoch => matches!(result, TypeDef::Epoch),
                    HostFn::ChainProtocolTime => matches!(result, TypeDef::U64),
                    HostFn::ChainTxId => matches!(result, TypeDef::Hash),
                    HostFn::Blake3 => {
                        matches!(result, TypeDef::Hash)
                            && matches!(
                                arg(1)?,
                                TypeDef::Text { .. }
                                    | TypeDef::BytesFixed { .. }
                                    | TypeDef::BytesMax { .. }
                                    | TypeDef::Hash
                            )
                    }
                    HostFn::VerifyEd25519 => {
                        matches!(result, TypeDef::Bool)
                            && matches!(arg(1)?, TypeDef::BytesFixed { len: 32 })
                            && matches!(arg(2)?, TypeDef::Hash)
                            && matches!(arg(3)?, TypeDef::BytesFixed { len: 64 })
                    }
                };
                self.need(
                    ok,
                    "the host function's result or argument types do not match",
                )?;
            }
        }
        Ok(None)
    }

    /// Coins dataflow (see the module docs). Returns an error naming the first violation.
    fn coins(&self) -> Result<(), AletheiaError> {
        let coins: BTreeSet<u8> = (0u8..)
            .zip(&self.f.registers)
            .filter(|(_, ty)| self.v.ty(**ty).is_some_and(TypeDef::is_coins))
            .map(|(r, _)| r)
            .collect();
        let start: Full = coins
            .iter()
            .copied()
            .filter(|r| *r < self.f.params)
            .collect();
        let mut states: Vec<Option<Full>> = vec![None; self.instrs.len()];
        let mut work = vec![(0usize, start)];
        while let Some((pc, state)) = work.pop() {
            let Some(slot) = states.get_mut(pc) else {
                return Err(reject(format!("instruction {pc} does not exist")));
            };
            match slot {
                Some(existing) if *existing == state => continue,
                Some(_) => {
                    return Err(reject(format!(
                        "instruction {pc}: paths arrive holding different coins"
                    )));
                }
                None => *slot = Some(state.clone()),
            }
            let instr = self
                .instrs
                .get(pc)
                .copied()
                .ok_or_else(|| reject("no instruction".to_owned()))?;
            let mut next = state;
            let take = |s: &mut Full, r: u8, what: &str| -> Result<(), AletheiaError> {
                if s.remove(&r) {
                    Ok(())
                } else {
                    Err(reject(format!(
                        "instruction {pc}: {what} register {r}, which holds no coins"
                    )))
                }
            };
            let fill = |s: &mut Full, r: u8| -> Result<(), AletheiaError> {
                if s.insert(r) {
                    Ok(())
                } else {
                    Err(reject(format!(
                        "instruction {pc}: register {r} already holds coins and would lose them"
                    )))
                }
            };
            let read = |s: &Full, r: u8| -> Result<(), AletheiaError> {
                if s.contains(&r) {
                    Ok(())
                } else {
                    Err(reject(format!(
                        "instruction {pc}: register {r} holds no coins to read"
                    )))
                }
            };
            // Any other write to a coins register would overwrite coins.
            let writes = Self::writes(instr, self.call_returns(instr));
            let producing = matches!(
                instr.op,
                Op::Move | Op::VWithdraw | Op::VWithdrawAll | Op::CSplit | Op::Call | Op::CJoin
            );
            if let Some(w) = writes
                && coins.contains(&w)
                && !producing
            {
                return Err(reject(format!(
                    "instruction {pc}: {} writes coins register {w}",
                    instr.op.mnemonic()
                )));
            }
            let mut successors: Vec<usize> = Vec::new();
            let fallthrough = pc.saturating_add(1);
            match instr.op {
                Op::Move => {
                    take(&mut next, instr.b, "MOVE from")?;
                    fill(&mut next, instr.a)?;
                }
                Op::VDeposit | Op::Transfer => take(&mut next, instr.a, instr.op.mnemonic())?,
                Op::CJoin => {
                    read(&next, instr.a)?;
                    take(&mut next, instr.b, "CJOIN from")?;
                }
                Op::VWithdraw | Op::VWithdrawAll => fill(&mut next, instr.a)?,
                Op::CSplit => {
                    read(&next, instr.b)?;
                    fill(&mut next, instr.a)?;
                }
                Op::CValue => read(&next, instr.b)?,
                Op::Call => {
                    if let Some(callee) = self.v.package.functions.get(usize::from(instr.b)) {
                        for k in 0..callee.params {
                            let r = self.reg_plus(instr.a, k)?;
                            if coins.contains(&r) {
                                take(&mut next, r, "CALL passes")?;
                            }
                        }
                        if callee.returns.is_some() && coins.contains(&instr.c) {
                            fill(&mut next, instr.c)?;
                        }
                    }
                }
                Op::Ret => {
                    if coins.contains(&instr.a) {
                        take(&mut next, instr.a, "RET returns")?;
                    }
                    if !next.is_empty() {
                        return Err(reject(format!(
                            "instruction {pc}: returns while registers {next:?} still hold coins"
                        )));
                    }
                    continue;
                }
                Op::RetV => {
                    if !next.is_empty() {
                        return Err(reject(format!(
                            "instruction {pc}: returns while registers {next:?} still hold coins"
                        )));
                    }
                    continue;
                }
                Op::Abort => continue,
                Op::Jmp => {
                    work.push((usize::from(instr.bx()), next));
                    continue;
                }
                Op::JmpIf | Op::JmpIfNot => successors.push(usize::from(instr.bx())),
                Op::Loop => {
                    work.push((usize::from(instr.bx()), next));
                    continue;
                }
                _ => {}
            }
            if fallthrough >= self.instrs.len() {
                return Err(reject(format!(
                    "instruction {pc}: the function can run past its end"
                )));
            }
            successors.push(fallthrough);
            for target in successors {
                work.push((target, next.clone()));
            }
        }
        Ok(())
    }

    fn call_returns(&self, instr: Instr) -> bool {
        instr.op == Op::Call
            && self
                .v
                .package
                .functions
                .get(usize::from(instr.b))
                .is_some_and(|f| f.returns.is_some())
    }

    fn run(&self) -> Result<BTreeSet<u8>, AletheiaError> {
        let _ = self.name;
        let mut callees = BTreeSet::new();
        let mut counters = BTreeSet::new();
        for (pc, instr) in self.instrs.iter().enumerate() {
            let callee = self.operands(pc, *instr).map_err(|e| {
                reject(format!(
                    "instruction {pc} ({}): {}",
                    instr.op.mnemonic(),
                    e.detail()
                ))
            })?;
            callees.extend(callee);
            if instr.op == Op::Loop {
                counters.insert(instr.a);
            }
        }
        // Loop counters are set only from constants (and counted down by LOOP).
        for (pc, instr) in self.instrs.iter().enumerate() {
            if let Some(w) = Self::writes(*instr, self.call_returns(*instr))
                && counters.contains(&w)
                && !matches!(instr.op, Op::LoadI | Op::LoadK | Op::Loop)
            {
                return Err(reject(format!(
                    "instruction {pc} ({}): writes loop counter register {w}; only constants may set a loop bound",
                    instr.op.mnemonic()
                )));
            }
            if counters.contains(&instr.b) && instr.op == Op::Move {
                return Err(reject(format!(
                    "instruction {pc}: moves out of a loop counter"
                )));
            }
        }
        let last = self.instrs.last().map(|i| i.op);
        self.need(
            matches!(last, Some(Op::Ret | Op::RetV | Op::Abort)),
            "the last instruction must be RET, RETV or ABORT",
        )?;
        self.coins()?;
        Ok(callees)
    }
}

/// Whether an integer constant fits a numeric or chain-position register type.
fn int_fits(def: &TypeDef, value: u128) -> bool {
    match def {
        TypeDef::U8 => value <= u128::from(u8::MAX),
        TypeDef::U16 => value <= u128::from(u16::MAX),
        TypeDef::U32 => value <= u128::from(u32::MAX),
        TypeDef::U64 | TypeDef::Height | TypeDef::Slot | TypeDef::Epoch => {
            value <= u128::from(u64::MAX)
        }
        TypeDef::I64 => value <= u128::from(i64::MAX.unsigned_abs()),
        TypeDef::U128 => true,
        _ => false,
    }
}

/// Verifies a decoded package. `Ok` means it is safe to store and run.
pub fn verify(package: &Package) -> Result<(), AletheiaError> {
    Verifier { package }.verify()
}

/// Decodes and verifies package bytes, as deployment does.
pub fn verify_bytes(bytes: &[u8]) -> Result<Package, AletheiaError> {
    let package = Package::from_bytes(bytes)?;
    verify(&package)?;
    Ok(package)
}
