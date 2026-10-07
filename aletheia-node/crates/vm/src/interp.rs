//! The interpreter (spec Section 28) [CONSENSUS-CRITICAL].
//!
//! Interpreter only, no JIT. It runs a package the verifier accepted; anything the verifier
//! rules out that shows up anyway is [`Trap::Internal`] (fail-stop), never undefined
//! behaviour. Every host interaction goes through [`Host`], so state authority stays with
//! the node: the interpreter only computes.
//!
//! Metering is checked before each metered action, so execution stops at exactly
//! `eu_used == eu_limit`. Memory is counted per allocation (a deterministic running total,
//! never decreased): at most 4 MiB per call and 32 MiB per transaction, 3 EU per 32 bytes.

use aletheia_core::AceWriter;
use aletheia_monetary::{Rounding, mul_div};

use crate::cost;
use crate::opcode::{HostFn, Instr, Op};
use crate::package::{Constant, Package, TypeDef};
use crate::trap::Trap;
use crate::value::{self, Value, from_wide, zero};

/// Read-only facts about the block and transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ChainInfo {
    pub height: u64,
    pub slot: u64,
    pub epoch: u64,
    pub protocol_time_ms: u64,
    pub tx_id: [u8; 32],
}

/// The node's side of a contract call: storage, coins and events of the called contract.
pub trait Host {
    fn chain(&self) -> ChainInfo;
    /// Whether storage `slot` (and map `key`; empty for plain slots and vaults) has a value.
    fn storage_contains(&mut self, slot: u16, key: &[u8]) -> Result<bool, Trap>;
    fn storage_read(&mut self, slot: u16, key: &[u8]) -> Result<Option<Vec<u8>>, Trap>;
    /// `None` removes the key.
    fn storage_write(&mut self, slot: u16, key: &[u8], value: Option<&[u8]>) -> Result<(), Trap>;
    /// Moves `amount` of `asset` from the contract's account to `to`.
    fn transfer(&mut self, asset: u32, amount: u128, to: &[u8; 33]) -> Result<(), Trap>;
    fn emit(&mut self, event: u16, data: Vec<u8>) -> Result<(), Trap>;
    fn verify_ed25519(&self, key: &[u8; 32], digest: &[u8; 32], signature: &[u8; 64]) -> bool;

    /// An executor is about to (re)run the call: everything until `commit_attempt` or
    /// `abandon_attempt` belongs to this attempt.
    fn begin_attempt(&mut self) {}
    /// The attempt finished; keep its effects.
    fn commit_attempt(&mut self) {}
    /// The executor failed mid-call: undo everything the attempt did, so a retry starts clean.
    fn abandon_attempt(&mut self) {}
}

/// How a successful call ended.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Outcome {
    pub returned: Option<Value>,
    pub eu_used: u64,
}

/// How a failed call ended, and the EU it used.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Failure {
    pub trap: Trap,
    pub eu_used: u64,
}

struct Machine<'a, H: Host + ?Sized> {
    package: &'a Package,
    code: Vec<Vec<Instr>>,
    host: &'a mut H,
    eu_used: u64,
    eu_limit: u64,
    tx_memory: u64,
}

struct Frame {
    regs: Vec<Value>,
    types: Vec<u16>,
    memory: u64,
}

fn internal(what: &'static str) -> Trap {
    Trap::Internal(what)
}

impl<H: Host + ?Sized> Machine<'_, H> {
    fn charge(&mut self, cost: u64) -> Result<(), Trap> {
        let total = self.eu_used.saturating_add(cost);
        if total > self.eu_limit {
            self.eu_used = self.eu_limit;
            return Err(Trap::OutOfEu);
        }
        self.eu_used = total;
        Ok(())
    }

    /// Accounts for `bytes` of new memory in this frame and transaction.
    fn allocate(&mut self, frame: &mut Frame, bytes: u64) -> Result<(), Trap> {
        self.charge(cost::per_unit(bytes, 32, cost::MEMORY_PER_32_BYTES))?;
        frame.memory = frame.memory.saturating_add(bytes);
        self.tx_memory = self.tx_memory.saturating_add(bytes);
        if frame.memory > cost::MAX_CALL_MEMORY || self.tx_memory > cost::MAX_TX_MEMORY {
            return Err(Trap::MemoryLimit);
        }
        Ok(())
    }

    fn ty(&self, index: u16) -> Result<&TypeDef, Trap> {
        self.package
            .types
            .get(usize::from(index))
            .ok_or(internal("type out of range"))
    }

    fn storage_ty(&self, slot: u16) -> Result<u16, Trap> {
        self.package
            .storage
            .get(usize::from(slot))
            .map(|s| s.ty)
            .ok_or(internal("storage slot out of range"))
    }

    fn read_storage(&mut self, slot: u16, key: &[u8]) -> Result<Option<Vec<u8>>, Trap> {
        self.charge(cost::STORAGE_READ)?;
        let value = self.host.storage_read(slot, key)?;
        let len = value.as_ref().map_or(0, Vec::len);
        self.charge(
            u64::try_from(len)
                .unwrap_or(u64::MAX)
                .saturating_mul(cost::STORAGE_READ_BYTE),
        )?;
        Ok(value)
    }

    fn write_storage(&mut self, slot: u16, key: &[u8], value: Option<&[u8]>) -> Result<(), Trap> {
        match value {
            Some(bytes) => {
                let existed = self.host.storage_contains(slot, key)?;
                let base = if existed {
                    cost::STORAGE_WRITE_EXISTING
                } else {
                    cost::STORAGE_WRITE_NEW
                };
                let len = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
                self.charge(base.saturating_add(len.saturating_mul(cost::STORAGE_WRITE_BYTE)))?;
            }
            None => self.charge(cost::STORAGE_DELETE)?,
        }
        self.host.storage_write(slot, key, value)
    }

    fn vault_balance(&mut self, slot: u16) -> Result<u128, Trap> {
        match self.read_storage(slot, &[])? {
            None => Ok(0),
            Some(bytes) => {
                let array: [u8; 16] = bytes
                    .try_into()
                    .map_err(|_| internal("vault balance is not 16 bytes"))?;
                Ok(u128::from_le_bytes(array))
            }
        }
    }

    fn set_vault(&mut self, slot: u16, amount: u128) -> Result<(), Trap> {
        self.write_storage(slot, &[], Some(&amount.to_le_bytes()))
    }

    fn get<'f>(&self, frame: &'f Frame, r: u8) -> Result<&'f Value, Trap> {
        frame
            .regs
            .get(usize::from(r))
            .ok_or(internal("register out of range"))
    }

    fn reg_ty(&self, frame: &Frame, r: u8) -> Result<u16, Trap> {
        frame
            .types
            .get(usize::from(r))
            .copied()
            .ok_or(internal("register out of range"))
    }

    fn set(&mut self, frame: &mut Frame, r: u8, value: Value) -> Result<(), Trap> {
        let size = value.size();
        if size > 16 {
            self.allocate(frame, size)?;
        }
        let slot = frame
            .regs
            .get_mut(usize::from(r))
            .ok_or(internal("register out of range"))?;
        *slot = value;
        Ok(())
    }

    fn take(&self, frame: &mut Frame, r: u8) -> Result<Value, Trap> {
        let slot = frame
            .regs
            .get_mut(usize::from(r))
            .ok_or(internal("register out of range"))?;
        Ok(core::mem::replace(slot, Value::Empty))
    }

    fn arith(&mut self, op: Op, ty: &TypeDef, a: &Value, b: &Value) -> Result<Value, Trap> {
        if let (Value::U128(x), Value::U128(y)) = (a, b) {
            if matches!(op, Op::Mul | Op::Div | Op::Mod) {
                self.charge(cost::WIDE_MUL_DIV)?;
            }
            let result = match op {
                Op::Add => x.checked_add(*y).ok_or(Trap::Overflow)?,
                Op::Sub => x.checked_sub(*y).ok_or(Trap::Overflow)?,
                Op::Mul => x.checked_mul(*y).ok_or(Trap::Overflow)?,
                Op::Div => x.checked_div(*y).ok_or(Trap::DivisionByZero)?,
                Op::Mod => x.checked_rem(*y).ok_or(Trap::DivisionByZero)?,
                Op::Min => *x.min(y),
                Op::Max => *x.max(y),
                _ => return Err(internal("not an arithmetic opcode")),
            };
            return Ok(Value::U128(result));
        }
        let (x, y) = (
            a.as_wide().ok_or(internal("operand is not an integer"))?,
            b.as_wide().ok_or(internal("operand is not an integer"))?,
        );
        let result = match op {
            Op::Add => x.checked_add(y).ok_or(Trap::Overflow)?,
            Op::Sub => x.checked_sub(y).ok_or(Trap::Overflow)?,
            Op::Mul => x.checked_mul(y).ok_or(Trap::Overflow)?,
            // Toward zero, and the remainder takes the dividend's sign.
            Op::Div => {
                if y == 0 {
                    return Err(Trap::DivisionByZero);
                }
                x.checked_div(y).ok_or(Trap::Overflow)?
            }
            Op::Mod => {
                if y == 0 {
                    return Err(Trap::DivisionByZero);
                }
                x.checked_rem(y).ok_or(Trap::Overflow)?
            }
            Op::Min => x.min(y),
            Op::Max => x.max(y),
            _ => return Err(internal("not an arithmetic opcode")),
        };
        from_wide(ty, result).ok_or(Trap::Overflow)
    }

    fn ordered(a: &Value, b: &Value) -> Result<core::cmp::Ordering, Trap> {
        match (a, b) {
            (Value::U128(x), Value::U128(y)) => Ok(x.cmp(y)),
            _ => Ok(a
                .as_wide()
                .ok_or(internal("not ordered"))?
                .cmp(&b.as_wide().ok_or(internal("not ordered"))?)),
        }
    }

    fn call(&mut self, index: u8, args: Vec<Value>, depth: usize) -> Result<Option<Value>, Trap> {
        if depth >= crate::verifier::MAX_CALL_DEPTH {
            return Err(internal("call depth beyond the verified limit"));
        }
        let package = self.package;
        let f = package
            .functions
            .get(usize::from(index))
            .ok_or(internal("function out of range"))?;
        let mut frame = Frame {
            regs: Vec::with_capacity(f.registers.len()),
            types: f.registers.clone(),
            memory: 0,
        };
        let mut args = args.into_iter();
        for (r, ty) in f.registers.iter().enumerate() {
            let value = if r < usize::from(f.params) {
                args.next().ok_or(internal("missing argument"))?
            } else {
                zero(package, *ty)?
            };
            frame.memory = frame.memory.saturating_add(value.size());
            frame.regs.push(value);
        }
        self.allocate(&mut frame, 0)?;
        let mut pc = 0usize;
        loop {
            let instr = self
                .code
                .get(usize::from(index))
                .and_then(|c| c.get(pc))
                .copied()
                .ok_or(internal("ran past the end of a function"))?;
            self.charge(cost::BASE)?;
            pc = pc.saturating_add(1);
            if let Some(result) = self.step(&mut frame, instr, &mut pc, depth)? {
                return Ok(result);
            }
        }
    }

    /// Executes one instruction. `Some` ends the frame with that result.
    #[allow(
        clippy::too_many_lines,
        reason = "one arm per opcode reads best as one table"
    )]
    fn step(
        &mut self,
        frame: &mut Frame,
        i: Instr,
        pc: &mut usize,
        depth: usize,
    ) -> Result<Option<Option<Value>>, Trap> {
        let package = self.package;
        let (a, b, c, bx) = (i.a, i.b, i.c, i.bx());
        match i.op {
            Op::Nop => {}
            Op::Mov => {
                let v = self.get(frame, b)?.clone();
                self.set(frame, a, v)?;
            }
            Op::LoadK => {
                let ty = self.reg_ty(frame, a)?;
                let value = match (package.constants.get(usize::from(bx)), self.ty(ty)?) {
                    (Some(Constant::Int(v)), def) => from_wide(
                        def,
                        i128::try_from(*v).map_err(|_| internal("constant too large"))?,
                    )
                    .or_else(|| matches!(def, TypeDef::U128).then_some(Value::U128(*v)))
                    .ok_or(internal("constant does not fit"))?,
                    (Some(Constant::Text(t)), TypeDef::Text { .. }) => Value::Text(t.clone()),
                    (Some(Constant::Bytes(bytes)), TypeDef::Address) => Value::Address(
                        bytes
                            .as_slice()
                            .try_into()
                            .map_err(|_| internal("address length"))?,
                    ),
                    (Some(Constant::Bytes(bytes)), TypeDef::Hash) => Value::Hash(
                        bytes
                            .as_slice()
                            .try_into()
                            .map_err(|_| internal("hash length"))?,
                    ),
                    (Some(Constant::Bytes(bytes)), _) => Value::Bytes(bytes.clone()),
                    _ => return Err(internal("constant does not fit its register")),
                };
                self.set(frame, a, value)?;
            }
            Op::LoadI => {
                let ty = self.reg_ty(frame, a)?;
                let value = match self.ty(ty)? {
                    TypeDef::Bool => Value::Bool(bx != 0),
                    TypeDef::Enum { .. } => Value::Enum(bx),
                    def => {
                        from_wide(def, i128::from(bx)).ok_or(internal("immediate does not fit"))?
                    }
                };
                self.set(frame, a, value)?;
            }
            Op::LoadNothing => self.set(frame, a, Value::Optional(None))?,
            Op::Move => {
                let v = self.take(frame, b)?;
                self.set(frame, a, v)?;
            }
            Op::Add | Op::Sub | Op::Mul | Op::Div | Op::Mod | Op::Min | Op::Max => {
                let ty = self.ty(self.reg_ty(frame, a)?)?.clone();
                let (x, y) = (self.get(frame, b)?.clone(), self.get(frame, c)?.clone());
                let v = self.arith(i.op, &ty, &x, &y)?;
                self.set(frame, a, v)?;
            }
            Op::Neg => {
                let Value::I64(x) = self.get(frame, b)? else {
                    return Err(internal("NEG needs Int64"));
                };
                let v = x.checked_neg().ok_or(Trap::Overflow)?;
                self.set(frame, a, Value::I64(v))?;
            }
            Op::MulDiv | Op::MulDivUp => {
                self.charge(cost::WIDE_MUL_DIV)?;
                let read = |k: u8| -> Result<u128, Trap> {
                    match self.get(frame, b.checked_add(k).ok_or(internal("register"))?)? {
                        Value::U128(v) => Ok(*v),
                        _ => Err(internal("MULDIV needs UInt128")),
                    }
                };
                let (x, y, z) = (read(0)?, read(1)?, read(2)?);
                let rounding = if i.op == Op::MulDivUp {
                    Rounding::Ceil
                } else {
                    Rounding::Floor
                };
                let v = mul_div(x, y, z, rounding).map_err(|e| {
                    if e.code() == aletheia_core::ErrorCode::ArithmeticDivisionByZero {
                        Trap::DivisionByZero
                    } else {
                        Trap::Overflow
                    }
                })?;
                self.set(frame, a, Value::U128(v))?;
            }
            Op::And | Op::Or | Op::Xor => {
                let (Value::Bool(x), Value::Bool(y)) = (self.get(frame, b)?, self.get(frame, c)?)
                else {
                    return Err(internal("logic needs Booleans"));
                };
                let v = match i.op {
                    Op::And => *x && *y,
                    Op::Or => *x || *y,
                    _ => *x != *y,
                };
                self.set(frame, a, Value::Bool(v))?;
            }
            Op::Not => {
                let Value::Bool(x) = self.get(frame, b)? else {
                    return Err(internal("NOT needs a Boolean"));
                };
                let v = !*x;
                self.set(frame, a, Value::Bool(v))?;
            }
            Op::Eq | Op::Ne => {
                let equal = self.get(frame, b)? == self.get(frame, c)?;
                self.set(frame, a, Value::Bool(equal == (i.op == Op::Eq)))?;
            }
            Op::Lt | Op::Le => {
                let ordering = Self::ordered(self.get(frame, b)?, self.get(frame, c)?)?;
                let v = if i.op == Op::Lt {
                    ordering.is_lt()
                } else {
                    ordering.is_le()
                };
                self.set(frame, a, Value::Bool(v))?;
            }
            Op::Conv => {
                let ty = self.ty(self.reg_ty(frame, a)?)?.clone();
                let source = self.get(frame, b)?.clone();
                let v = match (&source, &ty) {
                    (Value::U128(x), TypeDef::U128) => Value::U128(*x),
                    _ => {
                        let wide = source.as_wide().ok_or(Trap::ConversionOutOfRange)?;
                        from_wide(&ty, wide).ok_or(Trap::ConversionOutOfRange)?
                    }
                };
                self.set(frame, a, v)?;
            }
            Op::Jmp => *pc = usize::from(bx),
            Op::JmpIf | Op::JmpIfNot => {
                let Value::Bool(test) = self.get(frame, a)? else {
                    return Err(internal("branch needs a Boolean"));
                };
                if *test == (i.op == Op::JmpIf) {
                    *pc = usize::from(bx);
                }
            }
            Op::Loop => {
                let Value::U64(left) = self.get(frame, a)? else {
                    return Err(internal("loop counter is not UInt64"));
                };
                let left = left.checked_sub(1).ok_or(Trap::LoopBoundExceeded)?;
                self.set(frame, a, Value::U64(left))?;
                *pc = usize::from(bx);
            }
            Op::Call => {
                self.charge(cost::NESTED_CALL)?;
                let callee = package
                    .functions
                    .get(usize::from(b))
                    .ok_or(internal("function out of range"))?;
                let mut args = Vec::with_capacity(usize::from(callee.params));
                for k in 0..callee.params {
                    let r = a.checked_add(k).ok_or(internal("register"))?;
                    let ty = self.reg_ty(frame, r)?;
                    let arg = if self.ty(ty)?.is_coins() {
                        self.take(frame, r)?
                    } else {
                        self.get(frame, r)?.clone()
                    };
                    args.push(arg);
                }
                let result = self.call(b, args, depth.saturating_add(1))?;
                if let Some(value) = result {
                    self.set(frame, c, value)?;
                }
            }
            Op::Ret => {
                let ty = self.reg_ty(frame, a)?;
                let v = if self.ty(ty)?.is_coins() {
                    self.take(frame, a)?
                } else {
                    self.get(frame, a)?.clone()
                };
                return Ok(Some(Some(v)));
            }
            Op::RetV => return Ok(Some(None)),
            Op::Abort => return Err(Trap::Abort(bx)),
            Op::Assert => {
                if self.get(frame, a)? != &Value::Bool(true) {
                    return Err(Trap::Abort(bx));
                }
            }
            Op::SLoad => {
                let ty = self.storage_ty(bx)?;
                let v = match self.read_storage(bx, &[])? {
                    Some(bytes) => value::from_bytes(package, ty, &bytes)?,
                    None => zero(package, ty)?,
                };
                self.set(frame, a, v)?;
            }
            Op::SStore => {
                let ty = self.storage_ty(bx)?;
                let bytes = value::to_bytes(package, ty, self.get(frame, a)?)?;
                self.write_storage(bx, &[], Some(&bytes))?;
            }
            Op::MGet | Op::MPut | Op::MDel | Op::MHas => {
                let slot = u16::from(b);
                let TypeDef::Map {
                    key,
                    value: value_ty,
                } = self.ty(self.storage_ty(slot)?)?.clone()
                else {
                    return Err(internal("not a map slot"));
                };
                let key_bytes = value::to_bytes(package, key, self.get(frame, c)?)?;
                match i.op {
                    Op::MGet => {
                        let v = match self.read_storage(slot, &key_bytes)? {
                            Some(bytes) => Value::Optional(Some(Box::new(value::from_bytes(
                                package, value_ty, &bytes,
                            )?))),
                            None => Value::Optional(None),
                        };
                        self.set(frame, a, v)?;
                    }
                    Op::MHas => {
                        self.charge(cost::STORAGE_READ)?;
                        let present = self.host.storage_contains(slot, &key_bytes)?;
                        self.set(frame, a, Value::Bool(present))?;
                    }
                    Op::MPut => {
                        let bytes = value::to_bytes(package, value_ty, self.get(frame, a)?)?;
                        self.write_storage(slot, &key_bytes, Some(&bytes))?;
                    }
                    _ => self.write_storage(slot, &key_bytes, None)?,
                }
            }
            Op::New => {
                let ty = self.reg_ty(frame, a)?;
                let v = zero(package, ty)?;
                self.set(frame, a, v)?;
            }
            Op::GetF => {
                let Value::Record(fields) = self.get(frame, b)? else {
                    return Err(internal("GETF needs a record"));
                };
                let v = fields
                    .get(usize::from(c))
                    .cloned()
                    .ok_or(internal("field out of range"))?;
                self.set(frame, a, v)?;
            }
            Op::SetF => {
                let v = self.get(frame, c)?.clone();
                let Some(Value::Record(fields)) = frame.regs.get_mut(usize::from(a)) else {
                    return Err(internal("SETF needs a record"));
                };
                let slot = fields
                    .get_mut(usize::from(b))
                    .ok_or(internal("field out of range"))?;
                *slot = v;
            }
            Op::GetI => {
                let Value::U64(index) = self.get(frame, c)? else {
                    return Err(internal("index is not UInt64"));
                };
                let position = usize::try_from(index.checked_sub(1).ok_or(Trap::IndexOutOfRange)?)
                    .map_err(|_| Trap::IndexOutOfRange)?;
                let (Value::Array(items) | Value::List(items)) = self.get(frame, b)? else {
                    return Err(internal("GETI needs an array or list"));
                };
                let v = items.get(position).cloned().ok_or(Trap::IndexOutOfRange)?;
                self.set(frame, a, v)?;
            }
            Op::SetI => {
                let Value::U64(index) = self.get(frame, b)? else {
                    return Err(internal("index is not UInt64"));
                };
                let position = usize::try_from(index.checked_sub(1).ok_or(Trap::IndexOutOfRange)?)
                    .map_err(|_| Trap::IndexOutOfRange)?;
                let v = self.get(frame, c)?.clone();
                let Some(Value::Array(items) | Value::List(items)) =
                    frame.regs.get_mut(usize::from(a))
                else {
                    return Err(internal("SETI needs an array or list"));
                };
                let slot = items.get_mut(position).ok_or(Trap::IndexOutOfRange)?;
                *slot = v;
            }
            Op::Len => {
                let len = match self.get(frame, b)? {
                    Value::Array(items) | Value::List(items) => items.len(),
                    Value::Text(bytes) | Value::Bytes(bytes) => bytes.len(),
                    _ => return Err(internal("LEN needs a collection")),
                };
                self.set(
                    frame,
                    a,
                    Value::U64(u64::try_from(len).map_err(|_| internal("length"))?),
                )?;
            }
            Op::Push => {
                let ty = self.reg_ty(frame, a)?;
                let TypeDef::List { max, .. } = self.ty(ty)? else {
                    return Err(internal("PUSH needs a list"));
                };
                let max = usize::try_from(*max).unwrap_or(usize::MAX);
                let item = self.get(frame, b)?.clone();
                self.allocate(frame, item.size())?;
                let Some(Value::List(items)) = frame.regs.get_mut(usize::from(a)) else {
                    return Err(internal("PUSH needs a list"));
                };
                if items.len() >= max {
                    return Err(Trap::ListFull);
                }
                items.push(item);
            }
            Op::Some => {
                let v = self.get(frame, b)?.clone();
                self.set(frame, a, Value::Optional(Some(Box::new(v))))?;
            }
            Op::IsSome => {
                let Value::Optional(inner) = self.get(frame, b)? else {
                    return Err(internal("ISSOME needs an optional"));
                };
                let v = inner.is_some();
                self.set(frame, a, Value::Bool(v))?;
            }
            Op::Unwrap => {
                let Value::Optional(inner) = self.get(frame, b)? else {
                    return Err(internal("UNWRAP needs an optional"));
                };
                let v = inner.as_deref().cloned().ok_or(Trap::NothingToUnwrap)?;
                self.set(frame, a, v)?;
            }
            Op::VDeposit => {
                let slot = u16::from(b);
                let Value::Coins { amount, .. } = self.take(frame, a)? else {
                    return Err(internal("VDEPOSIT needs coins"));
                };
                let balance = self.vault_balance(slot)?;
                self.set_vault(slot, balance.checked_add(amount).ok_or(Trap::Overflow)?)?;
            }
            Op::VWithdraw | Op::VWithdrawAll => {
                let slot = u16::from(b);
                let TypeDef::Vault { asset } = *self.ty(self.storage_ty(slot)?)? else {
                    return Err(internal("not a vault slot"));
                };
                let balance = self.vault_balance(slot)?;
                let amount = if i.op == Op::VWithdrawAll {
                    balance
                } else {
                    match self.get(frame, c)? {
                        Value::U128(v) => *v,
                        _ => return Err(internal("amount is not UInt128")),
                    }
                };
                let left = balance.checked_sub(amount).ok_or(Trap::InsufficientVault)?;
                self.set_vault(slot, left)?;
                self.set(frame, a, Value::Coins { asset, amount })?;
            }
            Op::VBalance => {
                let balance = self.vault_balance(u16::from(b))?;
                self.set(frame, a, Value::U128(balance))?;
            }
            Op::VEmpty => self.set_vault(bx, 0)?,
            Op::CValue => {
                let Value::Coins { amount, .. } = self.get(frame, b)? else {
                    return Err(internal("CVALUE needs coins"));
                };
                let v = *amount;
                self.set(frame, a, Value::U128(v))?;
            }
            Op::CSplit => {
                let Value::U128(part) = *self.get(frame, c)? else {
                    return Err(internal("amount is not UInt128"));
                };
                let Some(Value::Coins { asset, amount }) = frame.regs.get_mut(usize::from(b))
                else {
                    return Err(internal("CSPLIT needs coins"));
                };
                *amount = amount.checked_sub(part).ok_or(Trap::InsufficientCoins)?;
                let asset = *asset;
                self.set(
                    frame,
                    a,
                    Value::Coins {
                        asset,
                        amount: part,
                    },
                )?;
            }
            Op::CJoin => {
                let Value::Coins { amount: other, .. } = self.take(frame, b)? else {
                    return Err(internal("CJOIN needs coins"));
                };
                let Some(Value::Coins { amount, .. }) = frame.regs.get_mut(usize::from(a)) else {
                    return Err(internal("CJOIN needs coins"));
                };
                *amount = amount.checked_add(other).ok_or(Trap::Overflow)?;
            }
            Op::Transfer => {
                self.charge(cost::TRANSFER)?;
                let Value::Address(to) = *self.get(frame, b)? else {
                    return Err(internal("TRANSFER needs an address"));
                };
                let Value::Coins { asset, amount } = self.take(frame, a)? else {
                    return Err(internal("TRANSFER needs coins"));
                };
                self.host.transfer(asset, amount, &to)?;
            }
            Op::SignerAddr => {
                let Value::Signer(address) = *self.get(frame, b)? else {
                    return Err(internal("SIGNERADDR needs a signer"));
                };
                self.set(frame, a, Value::Address(address))?;
            }
            Op::Emit => {
                let event = package
                    .events
                    .get(usize::from(b))
                    .ok_or(internal("event out of range"))?;
                let mut out = AceWriter::new();
                for (k, (_, ty)) in (0u8..).zip(&event.fields) {
                    let r = a.checked_add(k).ok_or(internal("register"))?;
                    value::encode(package, *ty, self.get(frame, r)?, &mut out)?;
                }
                let data = out.into_bytes();
                let len = u64::try_from(data.len()).unwrap_or(u64::MAX);
                self.charge(cost::EVENT.saturating_add(len.saturating_mul(cost::EVENT_BYTE)))?;
                self.host.emit(u16::from(b), data)?;
            }
            Op::Host => {
                let host = HostFn::from_id(bx).ok_or(internal("unknown host function"))?;
                let arg = |k: u8| -> Result<&Value, Trap> {
                    self.get(frame, a.checked_add(k).ok_or(internal("register"))?)
                };
                let chain = self.host.chain();
                let v = match host {
                    HostFn::ChainHeight => Value::Height(chain.height),
                    HostFn::ChainSlot => Value::Slot(chain.slot),
                    HostFn::ChainEpoch => Value::Epoch(chain.epoch),
                    HostFn::ChainProtocolTime => Value::U64(chain.protocol_time_ms),
                    HostFn::ChainTxId => Value::Hash(chain.tx_id),
                    HostFn::Blake3 => {
                        let bytes = match arg(1)? {
                            Value::Text(b) | Value::Bytes(b) => b.clone(),
                            Value::Hash(h) => h.to_vec(),
                            _ => return Err(internal("BLAKE3 needs bytes")),
                        };
                        let len = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
                        self.charge(cost::BLAKE3.saturating_add(cost::per_unit(
                            len,
                            64,
                            cost::BLAKE3_PER_64_BYTES,
                        )))?;
                        Value::Hash(*blake3::hash(&bytes).as_bytes())
                    }
                    HostFn::VerifyEd25519 => {
                        let (Value::Bytes(key), Value::Hash(digest), Value::Bytes(signature)) =
                            (arg(1)?, arg(2)?, arg(3)?)
                        else {
                            return Err(internal("VerifyEd25519 argument types"));
                        };
                        let key: [u8; 32] = key
                            .as_slice()
                            .try_into()
                            .map_err(|_| internal("key length"))?;
                        let signature: [u8; 64] = signature
                            .as_slice()
                            .try_into()
                            .map_err(|_| internal("signature length"))?;
                        let digest = *digest;
                        self.charge(cost::ED25519_VERIFY)?;
                        Value::Bool(self.host.verify_ed25519(&key, &digest, &signature))
                    }
                };
                self.set(frame, a, v)?;
            }
        }
        Ok(None)
    }
}

/// Runs function `function` of a verified package with `args` (in parameter order).
pub fn run<H: Host + ?Sized>(
    package: &Package,
    function: u8,
    args: Vec<Value>,
    host: &mut H,
    eu_limit: u64,
) -> Result<Outcome, Failure> {
    let mut code = Vec::with_capacity(package.functions.len());
    for f in &package.functions {
        let start = usize::try_from(f.code_offset).unwrap_or(usize::MAX);
        let end = start.saturating_add(usize::try_from(f.code_len).unwrap_or(0));
        let instrs: Option<Vec<Instr>> = package.code.get(start..end).and_then(|bytes| {
            bytes
                .chunks_exact(4)
                .map(|w| w.try_into().ok().and_then(Instr::decode))
                .collect()
        });
        match instrs {
            Some(instrs) => code.push(instrs),
            None => {
                return Err(Failure {
                    trap: internal("the package was not verified"),
                    eu_used: 0,
                });
            }
        }
    }
    let mut machine = Machine {
        package,
        code,
        host,
        eu_used: 0,
        eu_limit,
        tx_memory: 0,
    };
    match machine.call(function, args, 0) {
        Ok(returned) => Ok(Outcome {
            returned,
            eu_used: machine.eu_used,
        }),
        Err(trap) => Err(Failure {
            trap,
            eu_used: machine.eu_used,
        }),
    }
}
