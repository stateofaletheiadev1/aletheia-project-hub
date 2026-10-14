//! Shared parsing and rendering for `alt:`, `alt:T` and `alt:B` identifiers (APS-0002,
//! APS-0048, ADR-062).
//!
//! Each form is a fixed ASCII prefix followed by the payload in base16. Letters in the hex are
//! upper- or lowercase by the EIP-55 rule, computed over the network tag and the lowercase hex
//! (the EIP-1191 way of folding a network into the checksum), so a devnet identifier does not
//! verify on mainnet and a transaction ID does not verify as a block ID. Only one spelling of
//! each identifier is canonical; every other spelling is refused, never normalized.

use sha3::{Digest, Keccak256};

use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::network::NetworkKind;

/// Which identifier family is being parsed: its prefix, checksum tag and error codes.
#[derive(Debug, Clone, Copy)]
pub(crate) struct IdForm {
    pub(crate) what: &'static str,
    pub(crate) prefix: &'static str,
    /// Appended to the network HRP to form the checksum tag: "" for addresses, "t" for
    /// transactions, "b" for blocks.
    pub(crate) hrp_suffix: &'static str,
    /// Payload size; the text carries twice as many hex digits.
    pub(crate) payload_len: usize,
    pub(crate) malformed: ErrorCode,
    pub(crate) wrong_network: ErrorCode,
    pub(crate) non_canonical: ErrorCode,
}

impl IdForm {
    pub(crate) const fn text_len(&self) -> usize {
        self.prefix
            .len()
            .saturating_add(self.payload_len.saturating_mul(2))
    }

    /// The checksum tag hashed in front of the hex, for example `ald:` or `alt:`.
    fn tag(&self, network: NetworkKind) -> String {
        format!("{}{}:", network.address_hrp(), self.hrp_suffix)
    }

    fn error(&self, code: ErrorCode, reason: String) -> AletheiaError {
        AletheiaError::new(code, format!("{}: {reason}", self.what))
    }

    pub(crate) fn render(&self, network: NetworkKind, payload: &[u8]) -> String {
        debug_assert_eq!(payload.len(), self.payload_len);
        let mut text = String::with_capacity(self.text_len());
        text.push_str(self.prefix);
        text.push_str(&checksum_case(&self.tag(network), &lower_hex(payload)));
        text
    }

    /// Returns the payload bytes of a canonical identifier for `network`.
    pub(crate) fn parse(&self, text: &str, network: NetworkKind) -> Result<Vec<u8>, AletheiaError> {
        let raw = text.as_bytes();
        if raw.len() != self.text_len() {
            return Err(self.error(
                self.malformed,
                format!(
                    "length {} (canonical length is {})",
                    raw.len(),
                    self.text_len()
                ),
            ));
        }
        let (prefix, body) = raw.split_at(self.prefix.len());
        if prefix != self.prefix.as_bytes() {
            let code = if prefix.eq_ignore_ascii_case(self.prefix.as_bytes()) {
                self.non_canonical
            } else {
                self.malformed
            };
            return Err(self.error(code, format!("does not start with '{}'", self.prefix)));
        }

        let mut values = Vec::with_capacity(body.len());
        for (index, &character) in body.iter().enumerate() {
            let value = hex_value(character).ok_or_else(|| {
                self.error(
                    self.malformed,
                    format!(
                        "byte {character} at position {} is not a hex digit",
                        index.saturating_add(self.prefix.len())
                    ),
                )
            })?;
            values.push(value);
        }
        let payload: Vec<u8> = values
            .chunks_exact(2)
            .map(|pair| match pair {
                [high, low] => high.wrapping_shl(4) | low,
                _ => 0,
            })
            .collect();

        // `body` is all hex digits, so it is ASCII and these conversions cannot fail.
        let body = std::str::from_utf8(body).unwrap_or_default();
        let lower = body.to_ascii_lowercase();
        if body == checksum_case(&self.tag(network), &lower) {
            return Ok(payload);
        }
        if let Some(kind) = NetworkKind::ALL
            .into_iter()
            .find(|&kind| kind != network && body == checksum_case(&self.tag(kind), &lower))
        {
            return Err(self.error(
                self.wrong_network,
                format!("checksum is valid for {kind}, not {network}"),
            ));
        }
        if body == lower || body == body.to_ascii_uppercase() {
            return Err(self.error(
                self.non_canonical,
                "hex has no checksum casing; use the mixed-case form".to_owned(),
            ));
        }
        Err(self.error(self.malformed, "checksum casing does not verify".to_owned()))
    }
}

fn lower_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .flat_map(|&byte| nibbles(byte))
        .filter_map(|nibble| char::from_digit(u32::from(nibble), 16))
        .collect()
}

/// High nibble first.
fn nibbles(byte: u8) -> [u8; 2] {
    [byte.wrapping_shr(4), byte & 0x0f]
}

/// A hex digit of either case; `None` for anything else, including `x`.
fn hex_value(character: u8) -> Option<u8> {
    char::from(character)
        .to_digit(16)
        .and_then(|value| u8::try_from(value).ok())
}

/// EIP-55 casing of `lower_hex`: the letter at position `i` is uppercase when nibble `i` of
/// Keccak-256(`tag` ‖ `lower_hex`) is 8 or more. With an empty tag this is EIP-55 exactly.
/// Keccak-256 yields 64 nibbles, enough for the longest identifier (64 hex digits).
fn checksum_case(tag: &str, lower_hex: &str) -> String {
    let digest = Keccak256::new()
        .chain_update(tag.as_bytes())
        .chain_update(lower_hex.as_bytes())
        .finalize();
    lower_hex
        .bytes()
        .zip(digest.iter().flat_map(|&byte| nibbles(byte)))
        .map(|(character, nibble)| {
            if character.is_ascii_alphabetic() && nibble >= 8 {
                char::from(character.to_ascii_uppercase())
            } else {
                char::from(character)
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The test vectors published in EIP-55 itself, all four groups.
    const EIP55_VECTORS: [&str; 8] = [
        "52908400098527886E0F7030069857D2E4169EE7",
        "8617E340B3D01FA5F11F306F4090FD50E238070D",
        "de709f2102306220921060314715629080e2fb77",
        "27b1fdb04752bbc536007a920d24acb045561c26",
        "5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
        "fB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
        "dbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
        "D1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
    ];

    #[test]
    fn empty_tag_reproduces_eip55() {
        for vector in EIP55_VECTORS {
            assert_eq!(
                checksum_case("", &vector.to_ascii_lowercase()),
                vector,
                "EIP-55 vector {vector}"
            );
        }
    }

    #[test]
    fn network_tag_changes_the_casing() {
        let lower = EIP55_VECTORS[4].to_ascii_lowercase();
        assert_ne!(checksum_case("al:", &lower), checksum_case("ald:", &lower));
        assert_ne!(checksum_case("al:", &lower), checksum_case("alt:", &lower));
    }

    #[test]
    fn hex_round_trips() {
        let bytes: Vec<u8> = (0u8..=255).collect();
        let text = lower_hex(&bytes);
        let back: Vec<u8> = text
            .as_bytes()
            .chunks_exact(2)
            .map(|p| (hex_value(p[0]).unwrap() << 4) | hex_value(p[1]).unwrap())
            .collect();
        assert_eq!(back, bytes);
    }
}
