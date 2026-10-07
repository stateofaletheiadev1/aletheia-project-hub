//! Account and contract addresses (APS-0002, Appendix R.2).
//!
//! Binary payload: 33 bytes, `address_type` then a 32-byte `account_hash`. Text form: `AL:`
//! followed by 53 data and 6 checksum characters, 62 in total. Derivation of `account_hash`
//! from keys lives with the key types in `aletheia-crypto`; this module owns the format.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::network::NetworkKind;
use crate::text_id::IdForm;
use crate::types::Hash32;

const ADDRESS_FORM: IdForm = IdForm {
    what: "address",
    prefix: "AL:",
    hrp_suffix: "",
    malformed: ErrorCode::AddrMalformed,
    wrong_network: ErrorCode::AddrWrongNetwork,
    non_canonical: ErrorCode::AddrNonCanonical,
};

/// What controls an address. Type 4 (ML-DSA account) is reserved by APS-0002 and is not
/// accepted until a protocol version activates it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum AddressType {
    Ed25519Account,
    MultisigAccount,
    Contract,
    NativeModule,
}

impl AddressType {
    pub const fn code(self) -> u8 {
        match self {
            AddressType::Ed25519Account => 0,
            AddressType::MultisigAccount => 1,
            AddressType::Contract => 2,
            AddressType::NativeModule => 3,
        }
    }

    pub const fn from_code(code: u8) -> Option<AddressType> {
        match code {
            0 => Some(AddressType::Ed25519Account),
            1 => Some(AddressType::MultisigAccount),
            2 => Some(AddressType::Contract),
            3 => Some(AddressType::NativeModule),
            _ => None,
        }
    }
}

/// A canonical Aletheia address.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Address {
    address_type: AddressType,
    account_hash: Hash32,
}

impl Address {
    pub const ENCODED_LEN: usize = 33;

    pub const fn new(address_type: AddressType, account_hash: Hash32) -> Address {
        Address {
            address_type,
            account_hash,
        }
    }

    pub const fn address_type(&self) -> AddressType {
        self.address_type
    }

    pub const fn account_hash(&self) -> Hash32 {
        self.account_hash
    }

    pub fn to_bytes(&self) -> [u8; Address::ENCODED_LEN] {
        let mut bytes = [0u8; Address::ENCODED_LEN];
        let (type_byte, hash) = bytes.split_at_mut(1);
        type_byte.copy_from_slice(&[self.address_type.code()]);
        hash.copy_from_slice(self.account_hash.as_bytes());
        bytes
    }

    /// The 62-character text form for `network`. There is no `Display` impl: the checksum
    /// depends on the network, so rendering without one would be a silent mistake.
    pub fn to_text(&self, network: NetworkKind) -> String {
        ADDRESS_FORM.render(network, &self.to_bytes())
    }

    /// Parses canonical text for `network`. An address from a different Aletheia network is
    /// `AddrWrongNetwork`; any non-canonical spelling is rejected, never normalized.
    pub fn parse(text: &str, network: NetworkKind) -> Result<Address, AletheiaError> {
        let payload = ADDRESS_FORM.parse(text, network)?;
        let (&type_code, hash) = payload.split_first().ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::AddrMalformed,
                "address: empty payload".to_owned(),
            )
        })?;
        let address_type = AddressType::from_code(type_code).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::AddrMalformed,
                format!("address: address type {type_code} is not active"),
            )
        })?;
        let hash = <[u8; 32]>::try_from(hash).map_err(|_| {
            AletheiaError::new(
                ErrorCode::AddrMalformed,
                format!("address: payload is {} bytes, expected 33", payload.len()),
            )
        })?;
        Ok(Address::new(address_type, Hash32::from_bytes(hash)))
    }
}

impl AceEncode for Address {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.address_type.code());
        self.account_hash.encode(out);
    }

    fn encoded_len_hint(&self) -> usize {
        Address::ENCODED_LEN
    }
}

impl AceDecode for Address {
    fn decode(input: &mut AceReader<'_>) -> Result<Address, AletheiaError> {
        let offset = input.position();
        let type_code = input.u8()?;
        let address_type = AddressType::from_code(type_code).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!("address type {type_code} at offset {offset} is not active"),
            )
        })?;
        Ok(Address::new(address_type, Hash32::decode(input)?))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn sample() -> Address {
        let mut hash = [0u8; 32];
        for (index, byte) in hash.iter_mut().enumerate() {
            *byte = u8::try_from(index).unwrap().wrapping_mul(37);
        }
        Address::new(AddressType::Ed25519Account, Hash32::from_bytes(hash))
    }

    fn code_of(text: &str, network: NetworkKind) -> ErrorCode {
        Address::parse(text, network).unwrap_err().code()
    }

    #[test]
    fn text_form_is_62_characters_with_uppercase_prefix_and_lowercase_data() {
        let text = sample().to_text(NetworkKind::Mainnet);
        assert_eq!(text.len(), 62);
        assert!(text.starts_with("AL:"));
        assert!(
            text[3..]
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        );
        assert_eq!(Address::parse(&text, NetworkKind::Mainnet), Ok(sample()));
    }

    #[test]
    fn address_from_another_network_is_wrong_network() {
        let private = sample().to_text(NetworkKind::PrivateValidation);
        assert_eq!(
            code_of(&private, NetworkKind::Mainnet),
            ErrorCode::AddrWrongNetwork
        );
        assert_ne!(private, sample().to_text(NetworkKind::Mainnet));
    }

    #[test]
    fn case_variants_are_non_canonical() {
        let text = sample().to_text(NetworkKind::Devnet);
        let upper_data = format!("AL:{}", text[3..].to_uppercase());
        let lower_prefix = format!("al:{}", &text[3..]);
        assert_eq!(
            code_of(&upper_data, NetworkKind::Devnet),
            ErrorCode::AddrNonCanonical
        );
        assert_eq!(
            code_of(&lower_prefix, NetworkKind::Devnet),
            ErrorCode::AddrNonCanonical
        );
    }

    #[test]
    fn wrong_length_whitespace_and_bad_checksum_are_malformed() {
        let text = sample().to_text(NetworkKind::Devnet);
        assert_eq!(
            code_of(&text[..61], NetworkKind::Devnet),
            ErrorCode::AddrMalformed
        );
        assert_eq!(
            code_of(&format!(" {}", &text[1..]), NetworkKind::Devnet),
            ErrorCode::AddrMalformed
        );
        let mut flipped = text.into_bytes();
        flipped[10] = if flipped[10] == b'q' { b'p' } else { b'q' };
        let flipped = String::from_utf8(flipped).unwrap();
        assert_eq!(
            code_of(&flipped, NetworkKind::Devnet),
            ErrorCode::AddrMalformed
        );
    }

    #[test]
    fn non_zero_padding_bit_is_non_canonical() {
        // 33 bytes use 265 bits of 53 symbols; the last symbol carries one padding bit.
        // Set it, recompute a valid checksum, and the address must still be refused.
        let text = sample().to_text(NetworkKind::Devnet);
        let mut values: Vec<u8> = text[3..56]
            .bytes()
            .map(|c| crate::bech32m::value_of(c).unwrap())
            .collect();
        values[52] |= 1;
        let check = crate::bech32m::checksum("ald", &values);
        let forged: String = "AL:"
            .chars()
            .chain(
                values
                    .iter()
                    .chain(check.iter())
                    .map(|&v| crate::bech32m::character_of(v)),
            )
            .collect();
        assert_eq!(
            code_of(&forged, NetworkKind::Devnet),
            ErrorCode::AddrNonCanonical
        );
    }

    #[test]
    fn reserved_and_unknown_types_are_refused() {
        let mut bytes = sample().to_bytes();
        bytes[0] = 4;
        let text = ADDRESS_FORM.render(NetworkKind::Mainnet, &bytes);
        assert_eq!(
            code_of(&text, NetworkKind::Mainnet),
            ErrorCode::AddrMalformed
        );
        assert_eq!(
            Address::from_ace_bytes(&bytes).unwrap_err().code(),
            ErrorCode::DecodeNonCanonical
        );
    }

    proptest! {
        #[test]
        fn every_address_round_trips_on_every_network(type_code in 0u8..4, hash: [u8; 32], net in 0usize..4) {
            let network = NetworkKind::ALL[net];
            let address = Address::new(AddressType::from_code(type_code).unwrap(), Hash32::from_bytes(hash));
            let text = address.to_text(network);
            prop_assert_eq!(text.len(), 62);
            prop_assert_eq!(Address::parse(&text, network), Ok(address));
            prop_assert_eq!(Address::from_ace_bytes(&address.to_ace_bytes()), Ok(address));
        }
    }
}
