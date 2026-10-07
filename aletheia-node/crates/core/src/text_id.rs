//! Shared parsing and rendering for `AL:`, `AL:T` and `AL:B` identifiers (APS-0002, APS-0048).
//!
//! All three forms are a fixed ASCII prefix followed by lowercase Bech32m data and checksum,
//! with the network HRP folded into the checksum but not displayed. Every canonical identifier
//! is exactly 62 characters.

use crate::bech32m::{self, CHECKSUM_LEN, RegroupError};
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::network::NetworkKind;

pub(crate) const TEXT_LEN: usize = 62;

/// Which identifier family is being parsed: its prefix, HRP suffix and error codes.
#[derive(Debug, Clone, Copy)]
pub(crate) struct IdForm {
    pub(crate) what: &'static str,
    pub(crate) prefix: &'static str,
    /// Appended to the network HRP: "" for addresses, "t" for transactions, "b" for blocks.
    pub(crate) hrp_suffix: &'static str,
    pub(crate) malformed: ErrorCode,
    pub(crate) wrong_network: ErrorCode,
    pub(crate) non_canonical: ErrorCode,
}

impl IdForm {
    fn hrp(&self, network: NetworkKind) -> String {
        format!("{}{}", network.address_hrp(), self.hrp_suffix)
    }

    fn error(&self, code: ErrorCode, reason: String) -> AletheiaError {
        AletheiaError::new(code, format!("{}: {reason}", self.what))
    }

    pub(crate) fn render(&self, network: NetworkKind, payload: &[u8]) -> String {
        let data = bech32m::bytes_to_fives(payload);
        let check = bech32m::checksum(&self.hrp(network), &data);
        let mut text = String::with_capacity(TEXT_LEN);
        text.push_str(self.prefix);
        text.extend(
            data.iter()
                .chain(check.iter())
                .map(|&value| bech32m::character_of(value)),
        );
        text
    }

    /// Returns the payload bytes of a canonical identifier for `network`.
    pub(crate) fn parse(&self, text: &str, network: NetworkKind) -> Result<Vec<u8>, AletheiaError> {
        let raw = text.as_bytes();
        if raw.len() != TEXT_LEN {
            return Err(self.error(
                self.malformed,
                format!("length {} (canonical length is {TEXT_LEN})", raw.len()),
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
        let mut has_uppercase = false;
        for (index, &character) in body.iter().enumerate() {
            let lowered = character.to_ascii_lowercase();
            has_uppercase |= lowered != character;
            let value = bech32m::value_of(lowered).ok_or_else(|| {
                self.error(
                    self.malformed,
                    format!(
                        "byte {character} at position {} is not a Bech32 character",
                        index.saturating_add(self.prefix.len())
                    ),
                )
            })?;
            values.push(value);
        }
        if has_uppercase {
            return Err(self.error(
                self.non_canonical,
                "contains uppercase data characters".to_owned(),
            ));
        }

        if !bech32m::verify(&self.hrp(network), &values) {
            let other = NetworkKind::ALL
                .into_iter()
                .find(|&kind| kind != network && bech32m::verify(&self.hrp(kind), &values));
            return Err(match other {
                Some(kind) => self.error(
                    self.wrong_network,
                    format!("checksum is valid for {kind}, not {network}"),
                ),
                None => self.error(self.malformed, "checksum does not verify".to_owned()),
            });
        }

        let data = values
            .get(..values.len().saturating_sub(CHECKSUM_LEN))
            .unwrap_or_default();
        bech32m::fives_to_bytes(data).map_err(|error| match error {
            RegroupError::NonCanonicalPadding => {
                self.error(self.non_canonical, "padding bits are not zero".to_owned())
            }
            RegroupError::ValueOutOfRange => {
                self.error(self.malformed, "data value out of range".to_owned())
            }
        })
    }
}
