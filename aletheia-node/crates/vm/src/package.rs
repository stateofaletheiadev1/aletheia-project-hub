//! The `.arnobc` package (spec Section 27, APS-0014, ADR-046).
//!
//! ```text
//! ArnoPackage = "ARNO" | format_version u16 | arno_version u16 | code_hash Hash32 | body
//! body        = compiler bytes | source_hash Hash32 | name u16
//!             | constants list<Constant> (≤ 4096) | types list<TypeDef> (≤ 4096)
//!             | functions list<FunctionDef> (≤ 256) | storage list<StorageSlot> (≤ 256)
//!             | errors list<ErrorDef> (≤ 256) | events list<EventDef> (≤ 256)
//!             | code bytes (≤ 256 KiB, whole instructions)
//! code_hash   = BLAKE3 in key-derivation mode, context "ALETHEIA/ARNO-CODE/v1", over body
//! ```
//!
//! The code hash does not depend on any network: the same package has the same hash on
//! every chain. Names (contract, functions, fields, errors, events) are indices of text
//! constants. Every number is little-endian ACE; there are no timestamps or paths, so the
//! bytes depend only on the source and the compiler version.

use aletheia_core::{AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32};

pub const MAGIC: [u8; 4] = *b"ARNO";
pub const FORMAT_VERSION: u16 = 1;
pub const MAX_CONSTANTS: u32 = 4096;
pub const MAX_TYPES: u32 = 4096;
pub const MAX_FUNCTIONS: u32 = 256;
pub const MAX_STORAGE: u32 = 256;
pub const MAX_ERRORS: u32 = 256;
pub const MAX_EVENTS: u32 = 256;
pub const MAX_FIELDS: u32 = 256;
pub const MAX_CODE_BYTES: u32 = 256 * 1024;
pub const MAX_REGISTERS: u32 = 255;
pub const MAX_PARAMS: u32 = 32;
pub const MAX_TEXT_CONSTANT: u32 = 16 * 1024;
pub const MAX_COMPILER_ID: u32 = 64;
const CODE_HASH_CONTEXT: &str = "ALETHEIA/ARNO-CODE/v1";

fn malformed(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::VmPackageMalformed, detail)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Constant {
    Int(u128),
    Text(Vec<u8>),
    Bytes(Vec<u8>),
}

impl AceEncode for Constant {
    fn encode(&self, out: &mut AceWriter) {
        match self {
            Constant::Int(value) => {
                out.u8(1);
                out.u128(*value);
            }
            Constant::Text(text) => {
                out.u8(2);
                out.bytes(text);
            }
            Constant::Bytes(bytes) => {
                out.u8(3);
                out.bytes(bytes);
            }
        }
    }
}

impl AceDecode for Constant {
    fn decode(input: &mut AceReader<'_>) -> Result<Constant, AletheiaError> {
        match input.u8()? {
            1 => Ok(Constant::Int(input.u128()?)),
            2 => {
                let text = input.bytes(MAX_TEXT_CONSTANT)?;
                core::str::from_utf8(text)
                    .map_err(|_| malformed("a text constant is not UTF-8".to_owned()))?;
                Ok(Constant::Text(text.to_vec()))
            }
            3 => Ok(Constant::Bytes(input.bytes(MAX_TEXT_CONSTANT)?.to_vec())),
            tag => Err(malformed(format!("constant tag {tag} is not defined"))),
        }
    }
}

/// A type; references to other types point at lower indices, so the table has no cycles.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum TypeDef {
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
    Text { max: u32 },
    BytesFixed { len: u32 },
    BytesMax { max: u32 },
    Enum { name: u16, variants: Vec<u16> },
    Record { name: u16, fields: Vec<(u16, u16)> },
    Array { len: u32, elem: u16 },
    List { max: u32, elem: u16 },
    Map { key: u16, value: u16 },
    Optional { elem: u16 },
    Coins { asset: u32 },
    Vault { asset: u32 },
    Signer,
}

impl TypeDef {
    const fn tag(&self) -> u8 {
        match self {
            TypeDef::Bool => 1,
            TypeDef::U8 => 2,
            TypeDef::U16 => 3,
            TypeDef::U32 => 4,
            TypeDef::U64 => 5,
            TypeDef::U128 => 6,
            TypeDef::I64 => 7,
            TypeDef::Address => 8,
            TypeDef::Hash => 9,
            TypeDef::Height => 10,
            TypeDef::Slot => 11,
            TypeDef::Epoch => 12,
            TypeDef::Text { .. } => 13,
            TypeDef::BytesFixed { .. } => 14,
            TypeDef::BytesMax { .. } => 15,
            TypeDef::Enum { .. } => 16,
            TypeDef::Record { .. } => 17,
            TypeDef::Array { .. } => 18,
            TypeDef::List { .. } => 19,
            TypeDef::Map { .. } => 20,
            TypeDef::Optional { .. } => 21,
            TypeDef::Coins { .. } => 22,
            TypeDef::Vault { .. } => 23,
            TypeDef::Signer => 24,
        }
    }

    pub fn is_integer(&self) -> bool {
        matches!(
            self,
            TypeDef::U8 | TypeDef::U16 | TypeDef::U32 | TypeDef::U64 | TypeDef::U128 | TypeDef::I64
        )
    }

    /// Integers and chain positions.
    pub fn is_ordered(&self) -> bool {
        self.is_integer() || matches!(self, TypeDef::Height | TypeDef::Slot | TypeDef::Epoch)
    }

    pub fn is_coins(&self) -> bool {
        matches!(self, TypeDef::Coins { .. })
    }
}

impl AceEncode for TypeDef {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.tag());
        match self {
            TypeDef::Text { max } | TypeDef::BytesMax { max } => out.u32(*max),
            TypeDef::BytesFixed { len } => out.u32(*len),
            TypeDef::Enum { name, variants } => {
                out.u16(*name);
                out.u32(u32::try_from(variants.len()).unwrap_or(u32::MAX));
                for variant in variants {
                    out.u16(*variant);
                }
            }
            TypeDef::Record { name, fields } => {
                out.u16(*name);
                out.u32(u32::try_from(fields.len()).unwrap_or(u32::MAX));
                for (field, ty) in fields {
                    out.u16(*field);
                    out.u16(*ty);
                }
            }
            TypeDef::Array { len, elem } => {
                out.u32(*len);
                out.u16(*elem);
            }
            TypeDef::List { max, elem } => {
                out.u32(*max);
                out.u16(*elem);
            }
            TypeDef::Map { key, value } => {
                out.u16(*key);
                out.u16(*value);
            }
            TypeDef::Optional { elem } => out.u16(*elem),
            TypeDef::Coins { asset } | TypeDef::Vault { asset } => out.u32(*asset),
            _ => {}
        }
    }
}

fn count(input: &mut AceReader<'_>, max: u32, what: &str) -> Result<u32, AletheiaError> {
    let n = input.u32()?;
    if n > max {
        return Err(malformed(format!("{n} {what} exceed {max}")));
    }
    Ok(n)
}

impl AceDecode for TypeDef {
    fn decode(input: &mut AceReader<'_>) -> Result<TypeDef, AletheiaError> {
        Ok(match input.u8()? {
            1 => TypeDef::Bool,
            2 => TypeDef::U8,
            3 => TypeDef::U16,
            4 => TypeDef::U32,
            5 => TypeDef::U64,
            6 => TypeDef::U128,
            7 => TypeDef::I64,
            8 => TypeDef::Address,
            9 => TypeDef::Hash,
            10 => TypeDef::Height,
            11 => TypeDef::Slot,
            12 => TypeDef::Epoch,
            13 => TypeDef::Text { max: input.u32()? },
            14 => TypeDef::BytesFixed { len: input.u32()? },
            15 => TypeDef::BytesMax { max: input.u32()? },
            16 => {
                let name = input.u16()?;
                let n = count(input, MAX_FIELDS, "enumeration values")?;
                let variants = (0..n).map(|_| input.u16()).collect::<Result<_, _>>()?;
                TypeDef::Enum { name, variants }
            }
            17 => {
                let name = input.u16()?;
                let n = count(input, MAX_FIELDS, "record fields")?;
                let fields = (0..n)
                    .map(|_| Ok((input.u16()?, input.u16()?)))
                    .collect::<Result<_, AletheiaError>>()?;
                TypeDef::Record { name, fields }
            }
            18 => TypeDef::Array {
                len: input.u32()?,
                elem: input.u16()?,
            },
            19 => TypeDef::List {
                max: input.u32()?,
                elem: input.u16()?,
            },
            20 => TypeDef::Map {
                key: input.u16()?,
                value: input.u16()?,
            },
            21 => TypeDef::Optional { elem: input.u16()? },
            22 => TypeDef::Coins {
                asset: input.u32()?,
            },
            23 => TypeDef::Vault {
                asset: input.u32()?,
            },
            24 => TypeDef::Signer,
            tag => return Err(malformed(format!("type tag {tag} is not defined"))),
        })
    }
}

/// Function flags.
pub const FLAG_ENTRY: u8 = 1;
pub const FLAG_VIEW: u8 = 2;
pub const FLAG_REENTRANT: u8 = 4;
pub const FLAG_CONSTRUCTOR: u8 = 8;

/// Effects mask bits (the same as the source effects list).
pub const EFFECT_CHANGES_STORAGE: u8 = 1;
pub const EFFECT_RECEIVES_COINS: u8 = 2;
pub const EFFECT_SENDS_COINS: u8 = 4;
pub const EFFECT_EMITS_EVENTS: u8 = 8;
pub const EFFECT_CALLS_CONTRACTS: u8 = 16;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FunctionDef {
    pub name: u16,
    pub params: u8,
    pub returns: Option<u16>,
    pub flags: u8,
    pub effects: u8,
    /// The type of every register; the first `params` hold the arguments.
    pub registers: Vec<u16>,
    /// Byte offset and length in `code`, whole instructions.
    pub code_offset: u32,
    pub code_len: u32,
}

impl AceEncode for FunctionDef {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.name);
        out.u8(self.params);
        match self.returns {
            Some(ty) => {
                out.u8(1);
                out.u16(ty);
            }
            None => out.u8(0),
        }
        out.u8(self.flags);
        out.u8(self.effects);
        out.u32(u32::try_from(self.registers.len()).unwrap_or(u32::MAX));
        for ty in &self.registers {
            out.u16(*ty);
        }
        out.u32(self.code_offset);
        out.u32(self.code_len);
    }
}

impl AceDecode for FunctionDef {
    fn decode(input: &mut AceReader<'_>) -> Result<FunctionDef, AletheiaError> {
        let name = input.u16()?;
        let params = input.u8()?;
        let returns = match input.u8()? {
            0 => None,
            1 => Some(input.u16()?),
            other => return Err(malformed(format!("result marker {other} is not 0 or 1"))),
        };
        let flags = input.u8()?;
        let effects = input.u8()?;
        let n = count(input, MAX_REGISTERS, "registers")?;
        let registers = (0..n).map(|_| input.u16()).collect::<Result<_, _>>()?;
        Ok(FunctionDef {
            name,
            params,
            returns,
            flags,
            effects,
            registers,
            code_offset: input.u32()?,
            code_len: input.u32()?,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StorageSlot {
    pub name: u16,
    pub ty: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ErrorDef {
    pub name: u16,
    pub message: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventDef {
    pub name: u16,
    pub fields: Vec<(u16, u16)>,
}

impl AceEncode for StorageSlot {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.name);
        out.u16(self.ty);
    }
}

impl AceDecode for StorageSlot {
    fn decode(input: &mut AceReader<'_>) -> Result<StorageSlot, AletheiaError> {
        Ok(StorageSlot {
            name: input.u16()?,
            ty: input.u16()?,
        })
    }
}

impl AceEncode for ErrorDef {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.name);
        out.u16(self.message);
    }
}

impl AceDecode for ErrorDef {
    fn decode(input: &mut AceReader<'_>) -> Result<ErrorDef, AletheiaError> {
        Ok(ErrorDef {
            name: input.u16()?,
            message: input.u16()?,
        })
    }
}

impl AceEncode for EventDef {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.name);
        out.u32(u32::try_from(self.fields.len()).unwrap_or(u32::MAX));
        for (name, ty) in &self.fields {
            out.u16(*name);
            out.u16(*ty);
        }
    }
}

impl AceDecode for EventDef {
    fn decode(input: &mut AceReader<'_>) -> Result<EventDef, AletheiaError> {
        let name = input.u16()?;
        let n = count(input, MAX_FIELDS, "event fields")?;
        let fields = (0..n)
            .map(|_| Ok((input.u16()?, input.u16()?)))
            .collect::<Result<_, AletheiaError>>()?;
        Ok(EventDef { name, fields })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Package {
    /// `(major << 8) | minor` of the Arno language version.
    pub arno_version: u16,
    pub compiler: String,
    pub source_hash: Hash32,
    pub name: u16,
    pub constants: Vec<Constant>,
    pub types: Vec<TypeDef>,
    pub functions: Vec<FunctionDef>,
    pub storage: Vec<StorageSlot>,
    pub errors: Vec<ErrorDef>,
    pub events: Vec<EventDef>,
    pub code: Vec<u8>,
}

impl Package {
    fn body(&self) -> Vec<u8> {
        let mut out = AceWriter::new();
        out.bytes(self.compiler.as_bytes());
        self.source_hash.encode(&mut out);
        out.u16(self.name);
        out.list(&self.constants);
        out.list(&self.types);
        out.list(&self.functions);
        out.list(&self.storage);
        out.list(&self.errors);
        out.list(&self.events);
        out.bytes(&self.code);
        out.into_bytes()
    }

    /// BLAKE3 key-derivation mode with a fixed context: network-independent.
    pub fn code_hash(&self) -> Hash32 {
        let mut hasher = blake3::Hasher::new_derive_key(CODE_HASH_CONTEXT);
        hasher.update(&self.body());
        Hash32::from_bytes(*hasher.finalize().as_bytes())
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let body = self.body();
        let mut out = AceWriter::new();
        out.fixed(&MAGIC);
        out.u16(FORMAT_VERSION);
        out.u16(self.arno_version);
        self.code_hash().encode(&mut out);
        out.fixed(&body);
        out.into_bytes()
    }

    /// Decodes and checks the framing (magic, version, bounds, code hash). Whether the code
    /// is safe to run is the verifier's question.
    pub fn from_bytes(bytes: &[u8]) -> Result<Package, AletheiaError> {
        let mut input = AceReader::new(bytes);
        if input.array::<4>()? != MAGIC {
            return Err(malformed(
                "not an Arno package (magic is not ARNO)".to_owned(),
            ));
        }
        let format = input.u16()?;
        if format != FORMAT_VERSION {
            return Err(malformed(format!(
                "package format {format} is not supported (this VM reads format {FORMAT_VERSION})"
            )));
        }
        let arno_version = input.u16()?;
        let code_hash = Hash32::decode(&mut input)?;
        let compiler = input.bytes(MAX_COMPILER_ID)?;
        let compiler = core::str::from_utf8(compiler)
            .map_err(|_| malformed("the compiler id is not UTF-8".to_owned()))?
            .to_owned();
        let package = Package {
            arno_version,
            compiler,
            source_hash: Hash32::decode(&mut input)?,
            name: input.u16()?,
            constants: input.list(MAX_CONSTANTS)?,
            types: input.list(MAX_TYPES)?,
            functions: input.list(MAX_FUNCTIONS)?,
            storage: input.list(MAX_STORAGE)?,
            errors: input.list(MAX_ERRORS)?,
            events: input.list(MAX_EVENTS)?,
            code: input.bytes(MAX_CODE_BYTES)?.to_vec(),
        };
        input.finish()?;
        if package.code_hash() != code_hash {
            return Err(malformed(
                "the code hash does not match the package contents".to_owned(),
            ));
        }
        Ok(package)
    }

    /// The text of constant `index`, if it is text.
    pub fn text(&self, index: u16) -> Option<&str> {
        match self.constants.get(usize::from(index))? {
            Constant::Text(bytes) => core::str::from_utf8(bytes).ok(),
            _ => None,
        }
    }
}
