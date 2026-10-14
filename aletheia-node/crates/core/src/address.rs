//! Account and contract addresses (APS-0002, Appendix R.2, ADR-062).
//!
//! An address is 20 bytes: the last 20 bytes of the account hash that `aletheia-crypto` derives
//! from keys or a deployment, as Ethereum takes the last 20 bytes of its key hash. Text form:
//! `alt:` followed by 40 hex digits in EIP-55 mixed case with the network folded into the
//! checksum, 44 characters in total. Nothing in the address says whether it is a key, a
//! multisig or a contract; that is the account's state. Native modules are the exception by
//! construction: 19 zero bytes followed by the module id.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::network::NetworkKind;
use crate::text_id::IdForm;
use crate::types::Hash32;

const ADDRESS_FORM: IdForm = IdForm {
    what: "address",
    prefix: "alt:",
    hrp_suffix: "",
    payload_len: Address::LEN,
    malformed: ErrorCode::AddrMalformed,
    wrong_network: ErrorCode::AddrWrongNetwork,
    non_canonical: ErrorCode::AddrNonCanonical,
};

/// The kind of thing an account hash is derived from. The code is the first byte hashed into
/// the account hash (Section 11), which keeps the derivation domains apart; it is not stored
/// in the address. Type 4 (ML-DSA account) is reserved by APS-0002 and is not accepted until a
/// protocol version activates it.
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
pub struct Address([u8; Address::LEN]);

impl Address {
    /// Address size in bytes, in ACE and in state keys.
    pub const LEN: usize = 20;
    pub const ENCODED_LEN: usize = Address::LEN;
    /// Characters in the text form: `alt:` plus 40 hex digits.
    pub const TEXT_LEN: usize = ADDRESS_FORM.text_len();

    pub const fn from_bytes(bytes: [u8; Address::LEN]) -> Address {
        Address(bytes)
    }

    /// The address of an account hash: its last 20 bytes.
    pub fn from_account_hash(hash: &Hash32) -> Address {
        let mut bytes = [0u8; Address::LEN];
        let tail = hash.as_bytes().iter().skip(32 - Address::LEN);
        for (byte, &source) in bytes.iter_mut().zip(tail) {
            *byte = source;
        }
        Address(bytes)
    }

    /// Native module `module_id`: 19 zero bytes, then the id.
    pub const fn native_module(module_id: u8) -> Address {
        Address([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, module_id,
        ])
    }

    /// True for the native module range. A derived address lands here with probability
    /// 2^-152, so the range is reserved by construction rather than by a registry.
    pub fn is_native_module(&self) -> bool {
        self.0.iter().take(Address::LEN - 1).all(|&byte| byte == 0)
    }

    pub const fn as_bytes(&self) -> &[u8; Address::LEN] {
        &self.0
    }

    pub const fn to_bytes(&self) -> [u8; Address::LEN] {
        self.0
    }

    /// The address as a 32-byte word, left-padded with zeros: the form used for event topics.
    pub fn to_word(&self) -> Hash32 {
        let mut word = [0u8; 32];
        for (byte, &source) in word.iter_mut().skip(32 - Address::LEN).zip(&self.0) {
            *byte = source;
        }
        Hash32::from_bytes(word)
    }

    /// The 44-character text form for `network`. There is no `Display` impl: the checksum
    /// depends on the network, so rendering without one would be a silent mistake.
    pub fn to_text(&self, network: NetworkKind) -> String {
        ADDRESS_FORM.render(network, &self.0)
    }

    /// Parses canonical text for `network`. An address from a different Aletheia network is
    /// `AddrWrongNetwork`; any non-canonical spelling is rejected, never normalized.
    pub fn parse(text: &str, network: NetworkKind) -> Result<Address, AletheiaError> {
        let payload = ADDRESS_FORM.parse(text, network)?;
        <[u8; Address::LEN]>::try_from(payload.as_slice())
            .map(Address)
            .map_err(|_| {
                AletheiaError::new(
                    ErrorCode::AddrMalformed,
                    format!(
                        "address: payload is {} bytes, expected {}",
                        payload.len(),
                        Address::LEN
                    ),
                )
            })
    }
}

impl AceEncode for Address {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.0);
    }

    fn encoded_len_hint(&self) -> usize {
        Address::ENCODED_LEN
    }
}

impl AceDecode for Address {
    fn decode(input: &mut AceReader<'_>) -> Result<Address, AletheiaError> {
        input.array::<{ Address::LEN }>().map(Address)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn sample() -> Address {
        let mut bytes = [0u8; Address::LEN];
        for (index, byte) in bytes.iter_mut().enumerate() {
            *byte = u8::try_from(index)
                .unwrap()
                .wrapping_mul(37)
                .wrapping_add(171);
        }
        Address::from_bytes(bytes)
    }

    fn code_of(text: &str, network: NetworkKind) -> ErrorCode {
        Address::parse(text, network).unwrap_err().code()
    }

    #[test]
    fn text_form_is_alt_prefix_and_40_hex_digits() {
        let text = sample().to_text(NetworkKind::Mainnet);
        assert_eq!(text.len(), 44);
        assert_eq!(Address::TEXT_LEN, 44);
        assert!(text.starts_with("alt:"));
        assert!(text[4..].bytes().all(|c| c.is_ascii_hexdigit()));
        assert!(!text.contains("0x"));
        assert_eq!(Address::parse(&text, NetworkKind::Mainnet), Ok(sample()));
    }

    #[test]
    fn sample_has_mixed_case_so_the_checksum_is_exercised() {
        let text = sample().to_text(NetworkKind::Devnet);
        assert!(text[4..].bytes().any(|c| c.is_ascii_uppercase()));
        assert!(text[4..].bytes().any(|c| c.is_ascii_lowercase()));
    }

    #[test]
    fn address_from_another_network_is_wrong_network() {
        let private = sample().to_text(NetworkKind::PrivateValidation);
        assert_ne!(private, sample().to_text(NetworkKind::Mainnet));
        assert_eq!(
            code_of(&private, NetworkKind::Mainnet),
            ErrorCode::AddrWrongNetwork
        );
    }

    #[test]
    fn single_case_spellings_and_an_uppercase_prefix_are_non_canonical() {
        let text = sample().to_text(NetworkKind::Devnet);
        let lower = format!("alt:{}", text[4..].to_ascii_lowercase());
        let upper = format!("alt:{}", text[4..].to_ascii_uppercase());
        let upper_prefix = format!("ALT:{}", &text[4..]);
        for spelling in [lower, upper, upper_prefix] {
            assert_eq!(
                code_of(&spelling, NetworkKind::Devnet),
                ErrorCode::AddrNonCanonical,
                "{spelling}"
            );
        }
    }

    #[test]
    fn wrong_length_0x_non_hex_and_bad_casing_are_malformed() {
        let text = sample().to_text(NetworkKind::Devnet);
        let with_0x = format!("alt:0x{}", &text[4..]);
        let not_hex = format!("alt:{}g", &text[4..43]);
        for spelling in [&text[..43], with_0x.as_str(), not_hex.as_str()] {
            assert_eq!(
                code_of(spelling, NetworkKind::Devnet),
                ErrorCode::AddrMalformed,
                "{spelling}"
            );
        }
        // Flip the case of one letter: the casing no longer matches any network.
        let position = text[4..]
            .bytes()
            .position(|c| c.is_ascii_alphabetic())
            .unwrap()
            + 4;
        let mut flipped = text.into_bytes();
        flipped[position] ^= 0x20;
        let flipped = String::from_utf8(flipped).unwrap();
        assert_eq!(
            code_of(&flipped, NetworkKind::Devnet),
            ErrorCode::AddrMalformed
        );
    }

    #[test]
    fn derived_address_is_the_last_20_bytes_of_the_account_hash() {
        let mut hash = [0u8; 32];
        for (index, byte) in hash.iter_mut().enumerate() {
            *byte = u8::try_from(index).unwrap();
        }
        let address = Address::from_account_hash(&Hash32::from_bytes(hash));
        assert_eq!(address.as_bytes()[..], hash[12..]);
        assert_eq!(address.to_word().as_bytes()[12..], hash[12..]);
        assert_eq!(address.to_word().as_bytes()[..12], [0u8; 12]);
    }

    #[test]
    fn native_modules_are_19_zero_bytes_and_an_id() {
        let fee_pool = Address::native_module(1);
        assert!(fee_pool.is_native_module());
        assert_eq!(fee_pool.as_bytes()[19], 1);
        assert!(!sample().is_native_module());
    }

    #[test]
    fn ace_is_the_20_raw_bytes() {
        let bytes = sample().to_ace_bytes();
        assert_eq!(bytes, sample().to_bytes());
        assert_eq!(Address::from_ace_bytes(&bytes), Ok(sample()));
        assert!(Address::from_ace_bytes(&bytes[..19]).is_err());
    }

    proptest! {
        #[test]
        fn every_address_round_trips_on_every_network(bytes: [u8; 20], net in 0usize..4) {
            let network = NetworkKind::ALL[net];
            let address = Address::from_bytes(bytes);
            let text = address.to_text(network);
            prop_assert_eq!(text.len(), 44);
            prop_assert_eq!(Address::parse(&text, network), Ok(address));
            prop_assert_eq!(Address::from_ace_bytes(&address.to_ace_bytes()), Ok(address));
        }
    }
}
