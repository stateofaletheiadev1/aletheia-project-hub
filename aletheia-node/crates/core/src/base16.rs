//! Text encoding of binary values (APS-0048, ADR-021, Appendix R.3).
//!
//! One canonical form only: lowercase base16, no prefix, even length. Parsers check, in order:
//!
//! 1. a leading `0x` / `0X` is rejected (`EncPrefixedHexRejected`), never stripped;
//! 2. every character is a base16 digit; uppercase `A`-`F` is `EncUppercaseHex`, anything
//!    else is `EncInvalidCharacter`;
//! 3. the length is even (`EncOddLength`);
//! 4. for fixed-size types, the length is exact (`EncWrongLength`).
//!
//! The order matters for error reporting only; every rejected input is rejected regardless.

use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;

const DIGITS: &[u8; 16] = b"0123456789abcdef";

pub fn encode(bytes: &[u8]) -> String {
    let mut text = String::with_capacity(bytes.len().saturating_mul(2));
    for &byte in bytes {
        text.push(digit(byte >> 4));
        text.push(digit(byte & 0x0f));
    }
    text
}

pub fn decode(text: &str) -> Result<Vec<u8>, AletheiaError> {
    let raw = text.as_bytes();
    if raw.starts_with(b"0x") || raw.starts_with(b"0X") {
        return Err(AletheiaError::new(
            ErrorCode::EncPrefixedHexRejected,
            "base16 text starts with a 0x prefix; Aletheia base16 is unprefixed".to_owned(),
        ));
    }
    let mut nibbles = Vec::with_capacity(raw.len());
    for (offset, &character) in raw.iter().enumerate() {
        nibbles.push(nibble(character, offset)?);
    }
    if nibbles.len() % 2 != 0 {
        return Err(AletheiaError::new(
            ErrorCode::EncOddLength,
            format!(
                "base16 text has {} digits; an even count is required",
                nibbles.len()
            ),
        ));
    }
    Ok(nibbles
        .chunks_exact(2)
        .filter_map(|pair| match pair {
            [high, low] => Some((high << 4) | low),
            _ => None,
        })
        .collect())
}

pub fn decode_fixed<const N: usize>(text: &str) -> Result<[u8; N], AletheiaError> {
    let bytes = decode(text)?;
    <[u8; N]>::try_from(bytes.as_slice()).map_err(|_| {
        AletheiaError::new(
            ErrorCode::EncWrongLength,
            format!(
                "base16 text encodes {} bytes; exactly {N} are required",
                bytes.len()
            ),
        )
    })
}

fn digit(value: u8) -> char {
    DIGITS
        .get(usize::from(value))
        .map_or('0', |&d| char::from(d))
}

fn nibble(character: u8, offset: usize) -> Result<u8, AletheiaError> {
    match character {
        b'0'..=b'9' => Ok(character.wrapping_sub(b'0')),
        b'a'..=b'f' => Ok(character.wrapping_sub(b'a').wrapping_add(10)),
        b'A'..=b'F' => Err(AletheiaError::new(
            ErrorCode::EncUppercaseHex,
            format!(
                "uppercase base16 digit '{}' at offset {offset}",
                char::from(character)
            ),
        )),
        _ => Err(AletheiaError::new(
            ErrorCode::EncInvalidCharacter,
            format!("byte {character} at offset {offset} is not a base16 digit"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn code_of(text: &str) -> ErrorCode {
        decode(text).unwrap_err().code()
    }

    #[test]
    fn encodes_lowercase_without_prefix() {
        assert_eq!(encode(&[0x00, 0x9f, 0xab, 0xff]), "009fabff");
        assert_eq!(encode(&[]), "");
    }

    #[test]
    fn prefixed_input_is_rejected_not_stripped() {
        assert_eq!(code_of("0x00"), ErrorCode::EncPrefixedHexRejected);
        assert_eq!(code_of("0X00"), ErrorCode::EncPrefixedHexRejected);
    }

    #[test]
    fn uppercase_odd_length_and_stray_characters_are_rejected() {
        assert_eq!(code_of("AB"), ErrorCode::EncUppercaseHex);
        assert_eq!(code_of("aBcd"), ErrorCode::EncUppercaseHex);
        assert_eq!(code_of("abc"), ErrorCode::EncOddLength);
        assert_eq!(code_of("ab cd"), ErrorCode::EncInvalidCharacter);
        assert_eq!(code_of("zz"), ErrorCode::EncInvalidCharacter);
    }

    #[test]
    fn fixed_length_is_exact() {
        assert_eq!(decode_fixed::<2>("abcd"), Ok([0xab, 0xcd]));
        assert_eq!(
            decode_fixed::<2>("ab").unwrap_err().code(),
            ErrorCode::EncWrongLength
        );
        assert_eq!(
            decode_fixed::<2>("abcdef").unwrap_err().code(),
            ErrorCode::EncWrongLength
        );
    }

    proptest! {
        #[test]
        fn round_trips(bytes in proptest::collection::vec(any::<u8>(), 0..128)) {
            prop_assert_eq!(decode(&encode(&bytes)), Ok(bytes));
        }

        #[test]
        fn accepted_text_is_canonical(text in "[0-9a-fA-Fx ]{0,16}") {
            if let Ok(bytes) = decode(&text) {
                prop_assert_eq!(encode(&bytes), text);
            }
        }
    }
}
