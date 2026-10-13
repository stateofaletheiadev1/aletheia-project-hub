//! Runtime values (spec Section 28) and their canonical encoding.
//!
//! Every register holds one value of its declared type. Registers start at their type's zero
//! value; a coins register starts (and is left, once moved) [`Value::Empty`]. Storage slots,
//! map keys and event fields are stored in a canonical ACE encoding fixed by the type, so
//! every validator writes the same bytes.

use aletheia_core::{AceReader, AceWriter, AletheiaError};

use crate::package::{Package, TypeDef};
use crate::trap::Trap;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Value {
    Bool(bool),
    U8(u8),
    U16(u16),
    U32(u32),
    U64(u64),
    U128(u128),
    I64(i64),
    Address([u8; 33]),
    Hash([u8; 32]),
    Height(u64),
    Slot(u64),
    Epoch(u64),
    Text(Vec<u8>),
    Bytes(Vec<u8>),
    Enum(u16),
    Record(Vec<Value>),
    Array(Vec<Value>),
    List(Vec<Value>),
    Optional(Option<Box<Value>>),
    Coins {
        asset: u32,
        amount: u128,
    },
    Signer([u8; 33]),
    /// A coins register with nothing in it.
    Empty,
}

impl Value {
    /// Bytes this value accounts for in the memory limits and memory-growth EU.
    pub fn size(&self) -> u64 {
        let nested = |items: &[Value]| {
            items
                .iter()
                .map(Value::size)
                .fold(8u64, u64::saturating_add)
        };
        match self {
            Value::Text(bytes) | Value::Bytes(bytes) => u64::try_from(bytes.len())
                .unwrap_or(u64::MAX)
                .saturating_add(8),
            Value::Record(items) | Value::Array(items) | Value::List(items) => nested(items),
            Value::Optional(Some(inner)) => inner.size().saturating_add(8),
            Value::Address(_) | Value::Signer(_) => 33,
            Value::Hash(_) => 32,
            Value::U128(_) | Value::Coins { .. } => 16,
            _ => 8,
        }
    }

    /// The integer inside an integer or chain-position value, widened (I64 as signed).
    pub fn as_wide(&self) -> Option<i128> {
        Some(match self {
            Value::U8(v) => i128::from(*v),
            Value::U16(v) => i128::from(*v),
            Value::U32(v) => i128::from(*v),
            Value::U64(v) | Value::Height(v) | Value::Slot(v) | Value::Epoch(v) => i128::from(*v),
            Value::I64(v) => i128::from(*v),
            Value::U128(v) => i128::try_from(*v).ok()?,
            _ => return None,
        })
    }
}

/// Builds an integer or chain-position value of `ty` from a wide integer; `None` if it does
/// not fit.
pub fn from_wide(ty: &TypeDef, value: i128) -> Option<Value> {
    Some(match ty {
        TypeDef::U8 => Value::U8(u8::try_from(value).ok()?),
        TypeDef::U16 => Value::U16(u16::try_from(value).ok()?),
        TypeDef::U32 => Value::U32(u32::try_from(value).ok()?),
        TypeDef::U64 => Value::U64(u64::try_from(value).ok()?),
        TypeDef::U128 => Value::U128(u128::try_from(value).ok()?),
        TypeDef::I64 => Value::I64(i64::try_from(value).ok()?),
        TypeDef::Height => Value::Height(u64::try_from(value).ok()?),
        TypeDef::Slot => Value::Slot(u64::try_from(value).ok()?),
        TypeDef::Epoch => Value::Epoch(u64::try_from(value).ok()?),
        _ => return None,
    })
}

fn type_of(package: &Package, index: u16) -> Result<&TypeDef, Trap> {
    package
        .types
        .get(usize::from(index))
        .ok_or(Trap::Internal("type index out of range"))
}

/// The [`Value::size`] of every type's zero value, by type index, without building any of
/// them. Types refer only to earlier types (the verifier checks this), so one pass in index
/// order suffices and the work is linear in the table however deeply types nest. A forward
/// reference, or a map or vault (which have no register value), counts as 0 here; the
/// verifier refuses the former. Saturates rather than overflowing.
pub fn zero_sizes(package: &Package) -> Vec<u64> {
    let mut sizes: Vec<u64> = Vec::with_capacity(package.types.len());
    for ty in &package.types {
        let earlier = |index: &u16| sizes.get(usize::from(*index)).copied().unwrap_or(0);
        let size = match ty {
            TypeDef::U128 => 16,
            TypeDef::Address => 33,
            TypeDef::Hash => 32,
            TypeDef::BytesFixed { len } => u64::from(*len).saturating_add(8),
            TypeDef::Record { fields, .. } => fields
                .iter()
                .map(|(_, ty)| earlier(ty))
                .fold(8u64, u64::saturating_add),
            TypeDef::Array { len, elem } => u64::from(*len)
                .saturating_mul(earlier(elem))
                .saturating_add(8),
            TypeDef::Map { .. } | TypeDef::Vault { .. } => 0,
            _ => 8,
        };
        sizes.push(size);
    }
    sizes
}

/// The zero value of a type (Section 28: registers start zeroed).
pub fn zero(package: &Package, index: u16) -> Result<Value, Trap> {
    Ok(match type_of(package, index)? {
        TypeDef::Bool => Value::Bool(false),
        TypeDef::U8 => Value::U8(0),
        TypeDef::U16 => Value::U16(0),
        TypeDef::U32 => Value::U32(0),
        TypeDef::U64 => Value::U64(0),
        TypeDef::U128 => Value::U128(0),
        TypeDef::I64 => Value::I64(0),
        TypeDef::Address => Value::Address([0; 33]),
        TypeDef::Hash => Value::Hash([0; 32]),
        TypeDef::Height => Value::Height(0),
        TypeDef::Slot => Value::Slot(0),
        TypeDef::Epoch => Value::Epoch(0),
        TypeDef::Text { .. } => Value::Text(Vec::new()),
        TypeDef::BytesFixed { len } => Value::Bytes(vec![
            0;
            usize::try_from(*len)
                .map_err(|_| Trap::MemoryLimit)?
        ]),
        TypeDef::BytesMax { .. } => Value::Bytes(Vec::new()),
        TypeDef::Enum { .. } => Value::Enum(0),
        TypeDef::Record { fields, .. } => Value::Record(
            fields
                .iter()
                .map(|(_, ty)| zero(package, *ty))
                .collect::<Result<_, _>>()?,
        ),
        TypeDef::Array { len, elem } => {
            let len = usize::try_from(*len).map_err(|_| Trap::MemoryLimit)?;
            let item = zero(package, *elem)?;
            Value::Array(vec![item; len])
        }
        TypeDef::List { .. } => Value::List(Vec::new()),
        TypeDef::Optional { .. } => Value::Optional(None),
        TypeDef::Coins { .. } | TypeDef::Signer => Value::Empty,
        TypeDef::Map { .. } | TypeDef::Vault { .. } => {
            return Err(Trap::Internal("maps and vaults have no register value"));
        }
    })
}

/// Canonical encoding of a value of type `index`.
pub fn encode(
    package: &Package,
    index: u16,
    value: &Value,
    out: &mut AceWriter,
) -> Result<(), Trap> {
    let ty = type_of(package, index)?;
    match (ty, value) {
        (TypeDef::Bool, Value::Bool(v)) => out.bool(*v),
        (TypeDef::U8, Value::U8(v)) => out.u8(*v),
        (TypeDef::U16, Value::U16(v)) => out.u16(*v),
        (TypeDef::U32, Value::U32(v)) => out.u32(*v),
        (TypeDef::U64, Value::U64(v))
        | (TypeDef::Height, Value::Height(v))
        | (TypeDef::Slot, Value::Slot(v))
        | (TypeDef::Epoch, Value::Epoch(v)) => out.u64(*v),
        (TypeDef::U128, Value::U128(v)) => out.u128(*v),
        (TypeDef::I64, Value::I64(v)) => out.fixed(&v.to_le_bytes()),
        (TypeDef::Address, Value::Address(v)) => out.fixed(v),
        (TypeDef::Hash, Value::Hash(v)) => out.fixed(v),
        (TypeDef::Text { .. } | TypeDef::BytesMax { .. }, Value::Text(v) | Value::Bytes(v)) => {
            out.bytes(v)
        }
        (TypeDef::BytesFixed { .. }, Value::Bytes(v)) => out.fixed(v),
        (TypeDef::Enum { .. }, Value::Enum(v)) => out.u16(*v),
        (TypeDef::Record { fields, .. }, Value::Record(items)) => {
            for ((_, field_ty), item) in fields.iter().zip(items) {
                encode(package, *field_ty, item, out)?;
            }
        }
        (TypeDef::Array { elem, .. }, Value::Array(items)) => {
            for item in items {
                encode(package, *elem, item, out)?;
            }
        }
        (TypeDef::List { elem, .. }, Value::List(items)) => {
            out.u32(u32::try_from(items.len()).map_err(|_| Trap::MemoryLimit)?);
            for item in items {
                encode(package, *elem, item, out)?;
            }
        }
        (TypeDef::Optional { elem }, Value::Optional(inner)) => match inner {
            None => out.u8(0),
            Some(inner) => {
                out.u8(1);
                encode(package, *elem, inner, out)?;
            }
        },
        _ => return Err(Trap::Internal("a value does not match its type")),
    }
    Ok(())
}

pub fn to_bytes(package: &Package, index: u16, value: &Value) -> Result<Vec<u8>, Trap> {
    let mut out = AceWriter::new();
    encode(package, index, value, &mut out)?;
    Ok(out.into_bytes())
}

fn corrupt(_: AletheiaError) -> Trap {
    Trap::Internal("stored contract value does not decode")
}

/// Decodes a value of type `index`.
pub fn decode(package: &Package, index: u16, input: &mut AceReader<'_>) -> Result<Value, Trap> {
    let ty = type_of(package, index)?;
    Ok(match ty {
        TypeDef::Bool => Value::Bool(input.bool().map_err(corrupt)?),
        TypeDef::U8 => Value::U8(input.u8().map_err(corrupt)?),
        TypeDef::U16 => Value::U16(input.u16().map_err(corrupt)?),
        TypeDef::U32 => Value::U32(input.u32().map_err(corrupt)?),
        TypeDef::U64 => Value::U64(input.u64().map_err(corrupt)?),
        TypeDef::Height => Value::Height(input.u64().map_err(corrupt)?),
        TypeDef::Slot => Value::Slot(input.u64().map_err(corrupt)?),
        TypeDef::Epoch => Value::Epoch(input.u64().map_err(corrupt)?),
        TypeDef::U128 => Value::U128(input.u128().map_err(corrupt)?),
        TypeDef::I64 => Value::I64(i64::from_le_bytes(input.array().map_err(corrupt)?)),
        TypeDef::Address => Value::Address(input.array().map_err(corrupt)?),
        TypeDef::Hash => Value::Hash(input.array().map_err(corrupt)?),
        TypeDef::Text { max } => Value::Text(input.bytes(*max).map_err(corrupt)?.to_vec()),
        TypeDef::BytesMax { max } => Value::Bytes(input.bytes(*max).map_err(corrupt)?.to_vec()),
        TypeDef::BytesFixed { len } => {
            let len = usize::try_from(*len).map_err(|_| Trap::MemoryLimit)?;
            let mut bytes = Vec::with_capacity(len);
            for _ in 0..len {
                bytes.push(input.u8().map_err(corrupt)?);
            }
            Value::Bytes(bytes)
        }
        TypeDef::Enum { .. } => Value::Enum(input.u16().map_err(corrupt)?),
        TypeDef::Record { fields, .. } => Value::Record(
            fields
                .iter()
                .map(|(_, field_ty)| decode(package, *field_ty, input))
                .collect::<Result<_, _>>()?,
        ),
        TypeDef::Array { len, elem } => Value::Array(
            (0..*len)
                .map(|_| decode(package, *elem, input))
                .collect::<Result<_, _>>()?,
        ),
        TypeDef::List { max, elem } => {
            let n = input.u32().map_err(corrupt)?;
            if n > *max {
                return Err(Trap::Internal("stored list is longer than its maximum"));
            }
            Value::List(
                (0..n)
                    .map(|_| decode(package, *elem, input))
                    .collect::<Result<_, _>>()?,
            )
        }
        TypeDef::Optional { elem } => match input.u8().map_err(corrupt)? {
            0 => Value::Optional(None),
            1 => Value::Optional(Some(Box::new(decode(package, *elem, input)?))),
            _ => return Err(Trap::Internal("stored optional marker is invalid")),
        },
        TypeDef::Coins { .. } | TypeDef::Vault { .. } | TypeDef::Map { .. } | TypeDef::Signer => {
            return Err(Trap::Internal("this type is never stored as a value"));
        }
    })
}

pub fn from_bytes(package: &Package, index: u16, bytes: &[u8]) -> Result<Value, Trap> {
    let mut input = AceReader::new(bytes);
    let value = decode(package, index, &mut input)?;
    input.finish().map_err(corrupt)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use aletheia_core::Hash32;

    #[test]
    fn zero_sizes_match_the_size_of_the_zero_values_they_describe() {
        let package = Package {
            arno_version: 1,
            compiler: String::new(),
            source_hash: Hash32::ZERO,
            name: 0,
            constants: Vec::new(),
            types: vec![
                TypeDef::Bool,
                TypeDef::U128,
                TypeDef::Address,
                TypeDef::Hash,
                TypeDef::Text { max: 10 },
                TypeDef::BytesFixed { len: 7 },
                TypeDef::BytesMax { max: 9 },
                TypeDef::Record {
                    name: 0,
                    fields: vec![(0, 0), (0, 1), (0, 2), (0, 5)],
                },
                TypeDef::Array { len: 3, elem: 7 },
                TypeDef::List { max: 4, elem: 1 },
                TypeDef::Optional { elem: 8 },
                TypeDef::Coins { asset: 1 },
                TypeDef::Signer,
                TypeDef::Array { len: 2, elem: 8 },
            ],
            functions: Vec::new(),
            storage: Vec::new(),
            errors: Vec::new(),
            events: Vec::new(),
            code: Vec::new(),
        };
        let sizes = zero_sizes(&package);
        for (index, size) in sizes.iter().enumerate() {
            let ty = u16::try_from(index).unwrap();
            assert_eq!(*size, zero(&package, ty).unwrap().size(), "type {index}");
        }
    }
}
