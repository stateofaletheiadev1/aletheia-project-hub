//! Bech32m checksum and 5-bit regrouping (BIP-350), as used by Aletheia text identifiers.
//!
//! Aletheia text identifiers differ from ordinary Bech32m strings in one way: the HRP and the
//! `1` separator are not displayed. The HRP is implied by the network and only enters the
//! checksum, which is what makes an identifier from one network fail on another. Everything
//! else - charset, generator, constant - is BIP-350 unchanged, and the tests check the encoder
//! against an independent implementation.
//!
//! This is a checksum, not cryptography; it is implemented here rather than wrapped because
//! the HRP-less presentation is protocol and must be visible in source.

/// Bech32 data charset; index = 5-bit value.
pub(crate) const CHARSET: &[u8; 32] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";

const BECH32M_CONST: u32 = 0x2bc8_30a3;
const GENERATOR: [u32; 5] = [
    0x3b6a_57b2,
    0x2650_8e6d,
    0x1ea1_19fa,
    0x3d42_33dd,
    0x2a14_62b3,
];

pub(crate) const CHECKSUM_LEN: usize = 6;

fn polymod(values: impl IntoIterator<Item = u8>) -> u32 {
    let mut checksum: u32 = 1;
    for value in values {
        let top = checksum >> 25;
        checksum = ((checksum & 0x01ff_ffff) << 5) ^ u32::from(value);
        for (bit, generator) in GENERATOR.iter().enumerate() {
            if (top >> bit) & 1 == 1 {
                checksum ^= generator;
            }
        }
    }
    checksum
}

/// BIP-173 HRP expansion: high bits of each character, a zero, then the low bits.
fn expand_hrp(hrp: &str) -> impl Iterator<Item = u8> + '_ {
    let high = hrp.bytes().map(|c| c >> 5);
    let low = hrp.bytes().map(|c| c & 0x1f);
    high.chain(core::iter::once(0)).chain(low)
}

/// The six checksum symbols for `data` (5-bit values) under `hrp`.
#[expect(
    clippy::arithmetic_side_effects,
    reason = "shift amounts are 0..=25, constant per index"
)]
pub(crate) fn checksum(hrp: &str, data: &[u8]) -> [u8; CHECKSUM_LEN] {
    let residue = polymod(
        expand_hrp(hrp)
            .chain(data.iter().copied())
            .chain([0u8; CHECKSUM_LEN]),
    ) ^ BECH32M_CONST;
    let mut symbols = [0u8; CHECKSUM_LEN];
    for (index, symbol) in symbols.iter_mut().enumerate() {
        let shift = 5 * (CHECKSUM_LEN - 1 - index);
        *symbol = u8::try_from((residue >> shift) & 0x1f).unwrap_or(0);
    }
    symbols
}

/// True when `data_with_checksum` (5-bit values) carries a valid Bech32m checksum for `hrp`.
pub(crate) fn verify(hrp: &str, data_with_checksum: &[u8]) -> bool {
    polymod(expand_hrp(hrp).chain(data_with_checksum.iter().copied())) == BECH32M_CONST
}

/// Regroups bytes into 5-bit values, zero-padding the final group.
#[expect(
    clippy::arithmetic_side_effects,
    reason = "bit accumulator bounded below 13 bits"
)]
pub(crate) fn bytes_to_fives(bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(bytes.len().saturating_mul(8).div_ceil(5));
    let mut accumulator: u32 = 0;
    let mut bits: u32 = 0;
    for &byte in bytes {
        accumulator = ((accumulator << 8) | u32::from(byte)) & 0x1fff;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(u8::try_from((accumulator >> bits) & 0x1f).unwrap_or(0));
        }
    }
    if bits > 0 {
        out.push(u8::try_from((accumulator << (5 - bits)) & 0x1f).unwrap_or(0));
    }
    out
}

/// Why 5-bit data could not be regrouped into bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RegroupError {
    /// A value above 31.
    ValueOutOfRange,
    /// More than four padding bits, or padding bits that are not zero.
    NonCanonicalPadding,
}

/// Regroups 5-bit values into bytes. Padding must be fewer than 5 bits and all zero, so every
/// byte string has exactly one 5-bit encoding.
#[expect(
    clippy::arithmetic_side_effects,
    reason = "bit accumulator bounded below 13 bits"
)]
pub(crate) fn fives_to_bytes(fives: &[u8]) -> Result<Vec<u8>, RegroupError> {
    let mut out = Vec::with_capacity(fives.len().saturating_mul(5) / 8);
    let mut accumulator: u32 = 0;
    let mut bits: u32 = 0;
    for &value in fives {
        if value > 31 {
            return Err(RegroupError::ValueOutOfRange);
        }
        accumulator = ((accumulator << 5) | u32::from(value)) & 0x1fff;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push(u8::try_from((accumulator >> bits) & 0xff).unwrap_or(0));
        }
    }
    if bits >= 5 || (accumulator << (8 - bits)) & 0xff != 0 {
        return Err(RegroupError::NonCanonicalPadding);
    }
    Ok(out)
}

/// The 5-bit value of a lowercase charset character.
pub(crate) fn value_of(character: u8) -> Option<u8> {
    CHARSET
        .iter()
        .position(|&c| c == character)
        .and_then(|index| u8::try_from(index).ok())
}

/// The charset character for a 5-bit value.
pub(crate) fn character_of(value: u8) -> char {
    CHARSET
        .get(usize::from(value))
        .map_or('?', |&c| char::from(c))
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    /// Our checksum over `hrp` for `payload`, rendered as a standard `hrp1data` Bech32m string.
    fn standard_string(hrp: &str, payload: &[u8]) -> String {
        let data = bytes_to_fives(payload);
        let check = checksum(hrp, &data);
        let mut text = format!("{hrp}1");
        text.extend(data.iter().chain(check.iter()).map(|&v| character_of(v)));
        text
    }

    #[test]
    fn bip350_valid_vectors_verify() {
        for vector in [
            "a1lqfn3a",
            "abcdef1l7aum6echk45nj3s0wdvt2fg8x9yrzpqzd3ryx",
            "split1checkupstagehandshakeupstreamerranterredcaperredlc445v",
            "?1v759aa",
        ] {
            let separator = vector.rfind('1').unwrap();
            let hrp = &vector[..separator];
            let data: Vec<u8> = vector[separator + 1..]
                .bytes()
                .map(|c| value_of(c).unwrap())
                .collect();
            assert!(verify(hrp, &data), "{vector}");
        }
    }

    #[test]
    fn bech32_original_constant_does_not_verify() {
        // "a12uel5l" is a valid *Bech32* (BIP-173) string, so it must fail Bech32m.
        let data: Vec<u8> = "2uel5l".bytes().map(|c| value_of(c).unwrap()).collect();
        assert!(!verify("a", &data));
    }

    #[test]
    fn padding_must_be_zero_and_short() {
        // A single value is 5 bits: no whole byte, and more padding than a canonical encoding has.
        assert_eq!(
            fives_to_bytes(&[0b00001]),
            Err(RegroupError::NonCanonicalPadding)
        );
        // Two values = 10 bits = one byte + 2 padding bits; padding bits must be zero.
        assert_eq!(
            fives_to_bytes(&[0, 0b00001]),
            Err(RegroupError::NonCanonicalPadding)
        );
        assert_eq!(fives_to_bytes(&[0, 0]), Ok(vec![0]));
        assert_eq!(fives_to_bytes(&[32]), Err(RegroupError::ValueOutOfRange));
    }

    proptest! {
        #[test]
        fn matches_the_reference_bech32m_encoder(
            payload in proptest::collection::vec(any::<u8>(), 0..40),
            hrp in proptest::sample::select(vec!["al", "alt", "ald", "alr", "altt", "alb"]),
        ) {
            let reference = bech32::encode::<bech32::Bech32m>(bech32::Hrp::parse(hrp).unwrap(), &payload).unwrap();
            prop_assert_eq!(standard_string(hrp, &payload), reference);
        }

        #[test]
        fn regrouping_round_trips(payload in proptest::collection::vec(any::<u8>(), 0..64)) {
            prop_assert_eq!(fives_to_bytes(&bytes_to_fives(&payload)), Ok(payload));
        }
    }
}
