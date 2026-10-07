//! Strong types for protocol quantities (spec Section 3.2).
//!
//! Every protocol quantity is its own type. Arithmetic is explicit and checked; there is no
//! `impl Add` that could silently wrap, and no `From<u64>` that would let a Slot become a
//! Height. A function taking `(Height, Slot)` does not compile when called with `(Slot, Height)`.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::base16;
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;

macro_rules! counter_type {
    ($(#[$doc:meta])* $name:ident($inner:ident), $what:literal) => {
        $(#[$doc])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub struct $name($inner);

        impl $name {
            pub const fn new(value: $inner) -> $name {
                $name(value)
            }

            pub const fn get(self) -> $inner {
                self.0
            }

            /// The successor. Overflow is unreachable in practice, but it is still an error
            /// rather than a wrap, because "unreachable" is not a proof.
            pub fn next(self) -> Result<$name, AletheiaError> {
                self.0.checked_add(1).map($name).ok_or_else(|| {
                    AletheiaError::new(
                        ErrorCode::ArithmeticOverflow,
                        format!(concat!($what, " {} has no successor"), self.0),
                    )
                })
            }
        }

        impl core::fmt::Display for $name {
            fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
                self.0.fmt(f)
            }
        }

        impl AceEncode for $name {
            fn encode(&self, out: &mut AceWriter) {
                self.0.encode(out);
            }

            fn encoded_len_hint(&self) -> usize {
                core::mem::size_of::<$inner>()
            }
        }

        impl AceDecode for $name {
            fn decode(input: &mut AceReader<'_>) -> Result<$name, AletheiaError> {
                $inner::decode(input).map($name)
            }
        }
    };
}

counter_type!(
    /// Block height. Genesis is height 0.
    Height(u64),
    "height"
);
counter_type!(
    /// DSP chrono-slot; equal to the consensus round (ADR-008).
    Slot(u64),
    "slot"
);
counter_type!(
    /// Validator-set epoch.
    Epoch(u64),
    "epoch"
);
counter_type!(
    /// Protocol version selecting the frozen rule set (Section 44.3). `u16` everywhere it is
    /// encoded; see docs/spec/ERRATA.md E-2 for the one table that said `u32`.
    ProtocolVersion(u16),
    "protocol version"
);
counter_type!(
    /// Index of a validator within an epoch's ordered validator set.
    ValidatorIndex(u16),
    "validator index"
);

impl Height {
    pub const GENESIS: Height = Height(0);
}

/// Native asset identifier (APS-0017).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct AssetId(u32);

impl AssetId {
    /// The Aletheian Guilder (Section 18.3).
    pub const AEY: AssetId = AssetId(1);
    /// Aletheia Talent, the network utility and staking asset (Section 18.3).
    pub const ALNT: AssetId = AssetId(2);

    pub const fn new(value: u32) -> AssetId {
        AssetId(value)
    }

    pub const fn get(self) -> u32 {
        self.0
    }
}

impl core::fmt::Display for AssetId {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        self.0.fmt(f)
    }
}

impl AceEncode for AssetId {
    fn encode(&self, out: &mut AceWriter) {
        out.u32(self.0);
    }

    fn encoded_len_hint(&self) -> usize {
        4
    }
}

impl AceDecode for AssetId {
    fn decode(input: &mut AceReader<'_>) -> Result<AssetId, AletheiaError> {
        input.u32().map(AssetId)
    }
}

/// Compile-time marker binding an [`Amount`] to one asset, so amounts of different assets
/// cannot be added, compared or passed in each other's place.
pub trait AssetTag: Copy + Eq + Ord + core::fmt::Debug {
    const ASSET_ID: AssetId;
    const DECIMALS: u8;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct AeyTag;

impl AssetTag for AeyTag {
    const ASSET_ID: AssetId = AssetId::AEY;
    const DECIMALS: u8 = 18;
}

/// ALnT base unit is the Mite: 1 ALnT = 1,000 Mites (ADR-015).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct AlntTag;

impl AssetTag for AlntTag {
    const ASSET_ID: AssetId = AssetId::ALNT;
    const DECIMALS: u8 = 3;
}

/// Amount of one asset in base units. Never a float, never mixed across assets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Amount<A: AssetTag> {
    units: u128,
    asset: core::marker::PhantomData<A>,
}

pub type AeyAmount = Amount<AeyTag>;
pub type AlntAmount = Amount<AlntTag>;

impl<A: AssetTag> Amount<A> {
    pub const ZERO: Amount<A> = Amount {
        units: 0,
        asset: core::marker::PhantomData,
    };

    pub const fn from_units(units: u128) -> Amount<A> {
        Amount {
            units,
            asset: core::marker::PhantomData,
        }
    }

    pub const fn units(self) -> u128 {
        self.units
    }

    pub fn checked_add(self, other: Amount<A>) -> Result<Amount<A>, AletheiaError> {
        self.units
            .checked_add(other.units)
            .map(Amount::from_units)
            .ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::ArithmeticOverflow,
                    format!(
                        "{} + {} overflows u128 (asset {})",
                        self.units,
                        other.units,
                        A::ASSET_ID
                    ),
                )
            })
    }

    pub fn checked_sub(self, other: Amount<A>) -> Result<Amount<A>, AletheiaError> {
        self.units
            .checked_sub(other.units)
            .map(Amount::from_units)
            .ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::InsufficientBalance,
                    format!(
                        "{} − {} is negative (asset {})",
                        self.units,
                        other.units,
                        A::ASSET_ID
                    ),
                )
            })
    }
}

impl<A: AssetTag> AceEncode for Amount<A> {
    fn encode(&self, out: &mut AceWriter) {
        out.u128(self.units);
    }

    fn encoded_len_hint(&self) -> usize {
        16
    }
}

impl<A: AssetTag> AceDecode for Amount<A> {
    fn decode(input: &mut AceReader<'_>) -> Result<Amount<A>, AletheiaError> {
        input.u128().map(Amount::from_units)
    }
}

/// A 32-byte digest. Text form is 64 lowercase base16 digits with no prefix (APS-0048).
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Hash32([u8; 32]);

impl Hash32 {
    pub const ZERO: Hash32 = Hash32([0u8; 32]);

    pub const fn from_bytes(bytes: [u8; 32]) -> Hash32 {
        Hash32(bytes)
    }

    pub const fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    pub const fn into_bytes(self) -> [u8; 32] {
        self.0
    }

    /// Parses the canonical text form; rejects `0x`, uppercase and wrong lengths.
    pub fn parse(text: &str) -> Result<Hash32, AletheiaError> {
        base16::decode_fixed::<32>(text).map(Hash32)
    }
}

impl core::fmt::Display for Hash32 {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str(&base16::encode(&self.0))
    }
}

impl core::fmt::Debug for Hash32 {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "Hash32({self})")
    }
}

impl AceEncode for Hash32 {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.0);
    }

    fn encoded_len_hint(&self) -> usize {
        32
    }
}

impl AceDecode for Hash32 {
    fn decode(input: &mut AceReader<'_>) -> Result<Hash32, AletheiaError> {
        input.array::<32>().map(Hash32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn height_next_errors_instead_of_wrapping() {
        assert_eq!(Height::new(7).next(), Ok(Height::new(8)));
        let error = Height::new(u64::MAX).next().unwrap_err();
        assert_eq!(error.code(), ErrorCode::ArithmeticOverflow);
    }

    #[test]
    fn amount_subtraction_below_zero_is_insufficient_balance() {
        let five = AeyAmount::from_units(5);
        let six = AeyAmount::from_units(6);
        assert_eq!(six.checked_sub(five), Ok(AeyAmount::from_units(1)));
        assert_eq!(
            five.checked_sub(six).unwrap_err().code(),
            ErrorCode::InsufficientBalance
        );
    }

    #[test]
    fn amount_addition_overflow_is_reported() {
        let max = AlntAmount::from_units(u128::MAX);
        let error = max.checked_add(AlntAmount::from_units(1)).unwrap_err();
        assert_eq!(error.code(), ErrorCode::ArithmeticOverflow);
    }

    #[test]
    fn asset_tags_match_the_asset_table() {
        assert_eq!((AeyTag::ASSET_ID, AeyTag::DECIMALS), (AssetId::AEY, 18));
        assert_eq!((AlntTag::ASSET_ID, AlntTag::DECIMALS), (AssetId::ALNT, 3));
    }

    #[test]
    fn hash_text_form_is_unprefixed_lowercase() {
        let mut bytes = [0u8; 32];
        bytes[0] = 0xab;
        bytes[31] = 0x01;
        let hash = Hash32::from_bytes(bytes);
        let text = hash.to_string();
        assert_eq!(text.len(), 64);
        assert!(text.starts_with("ab00"));
        assert!(text.ends_with("01"));
        assert_eq!(Hash32::parse(&text), Ok(hash));
        assert_eq!(
            Hash32::parse(&text.to_uppercase()).unwrap_err().code(),
            ErrorCode::EncUppercaseHex
        );
    }

    #[test]
    fn strong_types_round_trip_through_ace() {
        assert_eq!(
            Slot::from_ace_bytes(&Slot::new(9).to_ace_bytes()),
            Ok(Slot::new(9))
        );
        assert_eq!(ProtocolVersion::new(3).to_ace_bytes(), [3, 0]);
        assert_eq!(AssetId::AEY.to_ace_bytes(), [1, 0, 0, 0]);
    }
}
