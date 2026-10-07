//! Aletheia Canonical Encoding (APS-0041, ADR-005).
//!
//! Every consensus object has exactly one valid byte representation:
//! fixed-width little-endian integers, no varints, `u32` length prefixes with a per-type
//! maximum, `u8` booleans and presence tags, strictly ascending sorted lists in place of maps,
//! and no trailing bytes. Types implement [`AceEncode`] and [`AceDecode`] by hand so the byte
//! layout is visible in the source.

use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;

/// Canonical encoding. Implemented by hand for every consensus type: the byte layout is
/// protocol, so it must be visible in the source, not derived by a macro.
pub trait AceEncode {
    fn encode(&self, out: &mut AceWriter);

    fn to_ace_bytes(&self) -> Vec<u8> {
        let mut out = AceWriter::with_capacity(self.encoded_len_hint());
        self.encode(&mut out);
        out.into_bytes()
    }

    fn encoded_len_hint(&self) -> usize {
        64
    }
}

pub trait AceDecode: Sized {
    fn decode(input: &mut AceReader<'_>) -> Result<Self, AletheiaError>;

    /// Decodes a complete value. Trailing bytes are an error (rule 9), never ignored.
    fn from_ace_bytes(bytes: &[u8]) -> Result<Self, AletheiaError> {
        let mut reader = AceReader::new(bytes);
        let value = Self::decode(&mut reader)?;
        reader.finish()?;
        Ok(value)
    }
}

/// Append-only output buffer for canonical encoding.
///
/// Writing never fails: every variable-length value reaching the writer has already been
/// bounded by its type's constructor (e.g. a memo is at most 256 bytes), so a length that does
/// not fit in `u32` cannot occur for a well-formed value.
#[derive(Debug, Default)]
pub struct AceWriter {
    bytes: Vec<u8>,
}

impl AceWriter {
    pub fn new() -> AceWriter {
        AceWriter { bytes: Vec::new() }
    }

    pub fn with_capacity(capacity: usize) -> AceWriter {
        AceWriter {
            bytes: Vec::with_capacity(capacity),
        }
    }

    pub fn into_bytes(self) -> Vec<u8> {
        self.bytes
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes
    }

    pub fn u8(&mut self, value: u8) {
        self.bytes.push(value);
    }

    pub fn u16(&mut self, value: u16) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    pub fn u32(&mut self, value: u32) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    pub fn u64(&mut self, value: u64) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    pub fn u128(&mut self, value: u128) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    pub fn bool(&mut self, value: bool) {
        self.bytes.push(u8::from(value));
    }

    /// Fixed-size byte array: raw bytes, no prefix (rule 3).
    pub fn fixed(&mut self, value: &[u8]) {
        self.bytes.extend_from_slice(value);
    }

    /// Variable-length byte string: `u32` length, then the bytes (rule 4).
    pub fn bytes(&mut self, value: &[u8]) {
        self.length_prefix(value.len());
        self.bytes.extend_from_slice(value);
    }

    /// Length-prefixed list (rule 4). For lists standing in for maps, the caller must pass the
    /// elements already sorted strictly ascending; [`AceReader::sorted_list`] rejects anything
    /// else, so an unsorted encode is caught by the round-trip tests of the owning type.
    pub fn list<T: AceEncode>(&mut self, items: &[T]) {
        self.length_prefix(items.len());
        for item in items {
            item.encode(self);
        }
    }

    /// Optional value: `u8` presence tag, then the value (rule 6).
    pub fn option<T: AceEncode>(&mut self, value: Option<&T>) {
        match value {
            None => self.u8(0),
            Some(inner) => {
                self.u8(1);
                inner.encode(self);
            }
        }
    }

    fn length_prefix(&mut self, len: usize) {
        debug_assert!(
            u32::try_from(len).is_ok(),
            "ACE length {len} exceeds u32; type bound missing"
        );
        self.u32(u32::try_from(len).unwrap_or(u32::MAX));
    }
}

/// Bounds-checked cursor over untrusted input.
#[derive(Debug)]
pub struct AceReader<'a> {
    bytes: &'a [u8],
    position: usize,
}

impl<'a> AceReader<'a> {
    pub fn new(bytes: &'a [u8]) -> AceReader<'a> {
        AceReader { bytes, position: 0 }
    }

    pub fn position(&self) -> usize {
        self.position
    }

    pub fn remaining(&self) -> usize {
        self.bytes.len().saturating_sub(self.position)
    }

    pub fn u8(&mut self) -> Result<u8, AletheiaError> {
        Ok(u8::from_le_bytes(self.array::<1>()?))
    }

    pub fn u16(&mut self) -> Result<u16, AletheiaError> {
        Ok(u16::from_le_bytes(self.array::<2>()?))
    }

    pub fn u32(&mut self) -> Result<u32, AletheiaError> {
        Ok(u32::from_le_bytes(self.array::<4>()?))
    }

    pub fn u64(&mut self) -> Result<u64, AletheiaError> {
        Ok(u64::from_le_bytes(self.array::<8>()?))
    }

    pub fn u128(&mut self) -> Result<u128, AletheiaError> {
        Ok(u128::from_le_bytes(self.array::<16>()?))
    }

    pub fn bool(&mut self) -> Result<bool, AletheiaError> {
        let offset = self.position;
        match self.u8()? {
            0 => Ok(false),
            1 => Ok(true),
            other => Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!("bool byte {other} at offset {offset}"),
            )),
        }
    }

    /// Fixed-size byte array (rule 3).
    pub fn array<const N: usize>(&mut self) -> Result<[u8; N], AletheiaError> {
        let raw = self.take(N)?;
        let mut out = [0u8; N];
        out.copy_from_slice(raw);
        Ok(out)
    }

    /// Variable-length byte string with a per-type maximum (rule 4).
    pub fn bytes(&mut self, max_len: u32) -> Result<&'a [u8], AletheiaError> {
        let len = self.length_prefix(max_len, "byte string")?;
        self.take(len)
    }

    /// Length-prefixed list with a per-type maximum (rule 4).
    pub fn list<T: AceDecode>(&mut self, max_len: u32) -> Result<Vec<T>, AletheiaError> {
        let len = self.length_prefix(max_len, "list")?;
        // Capacity is bounded by the remaining input as well as `max_len`, so a forged length
        // prefix cannot make us allocate more than the message could possibly contain.
        let mut items = Vec::with_capacity(len.min(self.remaining()));
        for _ in 0..len {
            items.push(T::decode(self)?);
        }
        Ok(items)
    }

    /// A list standing in for a map (rule 8): elements must be strictly ascending, so
    /// duplicates and disorder both decode as non-canonical.
    pub fn sorted_list<T: AceDecode + Ord>(
        &mut self,
        max_len: u32,
    ) -> Result<Vec<T>, AletheiaError> {
        let start = self.position;
        let items: Vec<T> = self.list(max_len)?;
        if let Some(index) = items
            .windows(2)
            .position(|pair| !matches!(pair, [a, b] if a < b))
        {
            return Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!(
                    "sorted list at offset {start}: element {} is not strictly greater than element {index}",
                    index.saturating_add(1)
                ),
            ));
        }
        Ok(items)
    }

    /// Optional value with a `u8` presence tag (rule 6).
    pub fn option<T: AceDecode>(&mut self) -> Result<Option<T>, AletheiaError> {
        let offset = self.position;
        match self.u8()? {
            0 => Ok(None),
            1 => Ok(Some(T::decode(self)?)),
            other => Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!("option presence tag {other} at offset {offset}"),
            )),
        }
    }

    pub fn finish(self) -> Result<(), AletheiaError> {
        if self.position == self.bytes.len() {
            return Ok(());
        }
        Err(AletheiaError::new(
            ErrorCode::DecodeTrailingBytes,
            format!(
                "{} trailing bytes after offset {}",
                self.remaining(),
                self.position
            ),
        ))
    }

    fn length_prefix(&mut self, max_len: u32, what: &str) -> Result<usize, AletheiaError> {
        let offset = self.position;
        let len = self.u32()?;
        if len > max_len {
            return Err(AletheiaError::new(
                ErrorCode::DecodeLengthExceeded,
                format!("{what} of {len} at offset {offset} exceeds maximum {max_len}"),
            ));
        }
        usize::try_from(len).map_err(|_| {
            AletheiaError::new(
                ErrorCode::DecodeLengthExceeded,
                format!("{what} of {len} does not fit this platform's address space"),
            )
        })
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], AletheiaError> {
        let start = self.position;
        let slice = start
            .checked_add(n)
            .and_then(|end| self.bytes.get(start..end))
            .ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::DecodeLengthExceeded,
                    format!(
                        "need {n} bytes at offset {start}, have {}",
                        self.remaining()
                    ),
                )
            })?;
        self.position = start.saturating_add(n);
        Ok(slice)
    }
}

macro_rules! ace_integer {
    ($($ty:ident),+) => {$(
        impl AceEncode for $ty {
            fn encode(&self, out: &mut AceWriter) {
                out.$ty(*self);
            }

            fn encoded_len_hint(&self) -> usize {
                core::mem::size_of::<$ty>()
            }
        }

        impl AceDecode for $ty {
            fn decode(input: &mut AceReader<'_>) -> Result<$ty, AletheiaError> {
                input.$ty()
            }
        }
    )+};
}

ace_integer!(u8, u16, u32, u64, u128);

impl AceEncode for bool {
    fn encode(&self, out: &mut AceWriter) {
        out.bool(*self);
    }

    fn encoded_len_hint(&self) -> usize {
        1
    }
}

impl AceDecode for bool {
    fn decode(input: &mut AceReader<'_>) -> Result<bool, AletheiaError> {
        input.bool()
    }
}

impl<const N: usize> AceEncode for [u8; N] {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(self);
    }

    fn encoded_len_hint(&self) -> usize {
        N
    }
}

impl<const N: usize> AceDecode for [u8; N] {
    fn decode(input: &mut AceReader<'_>) -> Result<[u8; N], AletheiaError> {
        input.array::<N>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn integers_are_fixed_width_little_endian() {
        assert_eq!(0x0102u16.to_ace_bytes(), [0x02, 0x01]);
        assert_eq!(1u32.to_ace_bytes(), [1, 0, 0, 0]);
        assert_eq!(u64::MAX.to_ace_bytes(), [0xff; 8]);
        assert_eq!(1u128.to_ace_bytes().len(), 16);
    }

    #[test]
    fn bool_other_than_zero_or_one_is_non_canonical() {
        assert_eq!(bool::from_ace_bytes(&[1]), Ok(true));
        let error = bool::from_ace_bytes(&[2]).unwrap_err();
        assert_eq!(error.code(), ErrorCode::DecodeNonCanonical);
    }

    #[test]
    fn trailing_bytes_are_rejected() {
        let error = u16::from_ace_bytes(&[1, 0, 0]).unwrap_err();
        assert_eq!(error.code(), ErrorCode::DecodeTrailingBytes);
    }

    #[test]
    fn short_input_is_rejected() {
        let error = u64::from_ace_bytes(&[1, 2, 3]).unwrap_err();
        assert_eq!(error.code(), ErrorCode::DecodeLengthExceeded);
    }

    #[test]
    fn list_length_above_maximum_is_rejected_before_reading_elements() {
        let mut writer = AceWriter::new();
        writer.list(&[1u8, 2, 3]);
        let bytes = writer.into_bytes();
        let mut reader = AceReader::new(&bytes);
        let error = reader.list::<u8>(2).unwrap_err();
        assert_eq!(error.code(), ErrorCode::DecodeLengthExceeded);
    }

    #[test]
    fn forged_list_length_does_not_over_allocate() {
        // Claims u32::MAX elements but carries none; must fail on the first element, cheaply.
        let bytes = u32::MAX.to_le_bytes();
        let mut reader = AceReader::new(&bytes);
        let error = reader.list::<u64>(u32::MAX).unwrap_err();
        assert_eq!(error.code(), ErrorCode::DecodeLengthExceeded);
    }

    #[test]
    fn sorted_list_rejects_duplicates_and_disorder() {
        for bad in [[1u16, 1], [2, 1]] {
            let mut writer = AceWriter::new();
            writer.list(&bad);
            let bytes = writer.into_bytes();
            let error = AceReader::new(&bytes).sorted_list::<u16>(8).unwrap_err();
            assert_eq!(error.code(), ErrorCode::DecodeNonCanonical, "{bad:?}");
        }
    }

    #[test]
    fn option_presence_tag_must_be_zero_or_one() {
        let mut reader = AceReader::new(&[2, 0]);
        assert_eq!(
            reader.option::<u8>().unwrap_err().code(),
            ErrorCode::DecodeNonCanonical
        );
        let mut reader = AceReader::new(&[1, 9]);
        assert_eq!(reader.option::<u8>(), Ok(Some(9)));
    }

    proptest! {
        #[test]
        fn integers_round_trip(a: u8, b: u16, c: u32, d: u64, e: u128) {
            prop_assert_eq!(u8::from_ace_bytes(&a.to_ace_bytes()), Ok(a));
            prop_assert_eq!(u16::from_ace_bytes(&b.to_ace_bytes()), Ok(b));
            prop_assert_eq!(u32::from_ace_bytes(&c.to_ace_bytes()), Ok(c));
            prop_assert_eq!(u64::from_ace_bytes(&d.to_ace_bytes()), Ok(d));
            prop_assert_eq!(u128::from_ace_bytes(&e.to_ace_bytes()), Ok(e));
        }

        #[test]
        fn accepted_lists_re_encode_to_the_same_bytes(bytes in proptest::collection::vec(any::<u8>(), 0..64)) {
            // Rule 10: encode(decode(b)) == b for every accepted b.
            let mut reader = AceReader::new(&bytes);
            if let Ok(items) = reader.list::<u16>(16)
                && reader.finish().is_ok()
            {
                let mut writer = AceWriter::new();
                writer.list(&items);
                prop_assert_eq!(writer.into_bytes(), bytes);
            }
        }

        #[test]
        fn byte_strings_round_trip(payload in proptest::collection::vec(any::<u8>(), 0..300)) {
            let mut writer = AceWriter::new();
            writer.bytes(&payload);
            let encoded = writer.into_bytes();
            let mut reader = AceReader::new(&encoded);
            prop_assert_eq!(reader.bytes(300).map(<[u8]>::to_vec), Ok(payload));
            prop_assert!(reader.finish().is_ok());
        }
    }
}
