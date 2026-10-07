//! Semantic types (spec Section 25.5).

/// A native asset a `Coins` or `Vault` holds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Asset {
    Aey,
    Alnt,
}

impl Asset {
    pub const fn name(self) -> &'static str {
        match self {
            Asset::Aey => "AEY",
            Asset::Alnt => "ALnT",
        }
    }

    /// The protocol `AssetId`.
    pub const fn id(self) -> u32 {
        match self {
            Asset::Aey => 1,
            Asset::Alnt => 2,
        }
    }

    pub fn from_name(name: &str) -> Option<Asset> {
        if name.eq_ignore_ascii_case("AEY") {
            Some(Asset::Aey)
        } else if name.eq_ignore_ascii_case("ALnT") {
            Some(Asset::Alnt)
        } else {
            None
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Ty {
    Bool,
    U8,
    U16,
    U32,
    U64,
    U128,
    I64,
    Address,
    Hash,
    Height,
    Slot,
    Epoch,
    Text(u32),
    BytesFixed(u32),
    BytesMax(u32),
    /// Index into the program's enums.
    Enum(u16),
    /// Index into the program's records.
    Record(u16),
    Array {
        len: u32,
        elem: Box<Ty>,
    },
    List {
        max: u32,
        elem: Box<Ty>,
    },
    Map {
        key: Box<Ty>,
        value: Box<Ty>,
    },
    Optional(Box<Ty>),
    Coins(Asset),
    Vault(Asset),
    Signer,
    /// What a procedure call produces: no value.
    Unit,
    /// The result of an expression that already produced an error; never reported again.
    Error,
}

impl Ty {
    pub fn is_integer(&self) -> bool {
        matches!(
            self,
            Ty::U8 | Ty::U16 | Ty::U32 | Ty::U64 | Ty::U128 | Ty::I64
        )
    }

    /// Integers and chain positions (ordered, comparable with < and >).
    pub fn is_ordered(&self) -> bool {
        self.is_integer() || matches!(self, Ty::Height | Ty::Slot | Ty::Epoch)
    }

    /// Values that must be moved exactly once.
    pub fn is_linear(&self) -> bool {
        matches!(self, Ty::Coins(_))
    }

    /// Types that may not live in storage.
    pub fn contains_coins_or_signer(&self) -> bool {
        match self {
            Ty::Coins(_) | Ty::Signer => true,
            Ty::Array { elem, .. } | Ty::List { elem, .. } | Ty::Optional(elem) => {
                elem.contains_coins_or_signer()
            }
            Ty::Map { key, value } => {
                key.contains_coins_or_signer() || value.contains_coins_or_signer()
            }
            _ => false,
        }
    }

    /// Whether `value` fits in this integer type.
    pub fn fits(&self, value: u128) -> bool {
        match self {
            Ty::U8 => value <= u128::from(u8::MAX),
            Ty::U16 => value <= u128::from(u16::MAX),
            Ty::U32 => value <= u128::from(u32::MAX),
            Ty::U64 | Ty::Height | Ty::Slot | Ty::Epoch => value <= u128::from(u64::MAX),
            Ty::I64 => value <= u128::from(i64::MAX.unsigned_abs()),
            Ty::U128 => true,
            _ => false,
        }
    }
}

/// Names for messages, which need the program's enum and record names.
pub trait TypeNames {
    fn enum_name(&self, id: u16) -> &str;
    fn record_name(&self, id: u16) -> &str;

    fn describe(&self, ty: &Ty) -> String {
        match ty {
            Ty::Bool => "Boolean".to_owned(),
            Ty::U8 => "UInt8".to_owned(),
            Ty::U16 => "UInt16".to_owned(),
            Ty::U32 => "UInt32".to_owned(),
            Ty::U64 => "UInt64".to_owned(),
            Ty::U128 => "UInt128".to_owned(),
            Ty::I64 => "Int64".to_owned(),
            Ty::Address => "Address".to_owned(),
            Ty::Hash => "Hash".to_owned(),
            Ty::Height => "Height".to_owned(),
            Ty::Slot => "Slot".to_owned(),
            Ty::Epoch => "Epoch".to_owned(),
            Ty::Text(max) => format!("Text max {max}"),
            Ty::BytesFixed(n) => format!("Bytes[{n}]"),
            Ty::BytesMax(n) => format!("Bytes max {n}"),
            Ty::Enum(id) => self.enum_name(*id).to_owned(),
            Ty::Record(id) => self.record_name(*id).to_owned(),
            Ty::Array { len, elem } => format!("array[1..{len}] of {}", self.describe(elem)),
            Ty::List { max, elem } => format!("List of {} max {max}", self.describe(elem)),
            Ty::Map { key, value } => {
                format!("Map of {} to {}", self.describe(key), self.describe(value))
            }
            Ty::Optional(elem) => format!("Optional of {}", self.describe(elem)),
            Ty::Coins(asset) => format!("Coins of {}", asset.name()),
            Ty::Vault(asset) => format!("Vault of {}", asset.name()),
            Ty::Signer => "Signer".to_owned(),
            Ty::Unit => "no value".to_owned(),
            Ty::Error => "an invalid value".to_owned(),
        }
    }
}
