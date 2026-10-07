//! Transaction and block identifiers (Sections 12 and 12.1, ADR-011).
//!
//! `tx_id = H_domain("ALETHEIA/TXID/v1", ace(TransactionBody))` excludes the authorization, so
//! re-signing the same intent cannot produce a different ID. `block_id` is the block hash.
//! Both render as a 4-character prefix plus 52 data and 6 checksum characters, 62 in total,
//! with the checksum HRP being the network HRP plus `t` or `b`.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::network::NetworkKind;
use crate::text_id::IdForm;
use crate::types::Hash32;

macro_rules! identifier {
    ($(#[$doc:meta])* $name:ident, $form:ident, $what:literal, $prefix:literal, $suffix:literal) => {
        const $form: IdForm = IdForm {
            what: $what,
            prefix: $prefix,
            hrp_suffix: $suffix,
            malformed: ErrorCode::IdMalformed,
            wrong_network: ErrorCode::IdWrongNetwork,
            non_canonical: ErrorCode::IdNonCanonical,
        };

        $(#[$doc])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub struct $name(Hash32);

        impl $name {
            pub const fn from_hash(hash: Hash32) -> $name {
                $name(hash)
            }

            pub const fn hash(&self) -> Hash32 {
                self.0
            }

            /// The 62-character text form for `network`.
            pub fn to_text(&self, network: NetworkKind) -> String {
                $form.render(network, self.0.as_bytes())
            }

            pub fn parse(text: &str, network: NetworkKind) -> Result<$name, AletheiaError> {
                let payload = $form.parse(text, network)?;
                let bytes = <[u8; 32]>::try_from(payload.as_slice()).map_err(|_| {
                    AletheiaError::new(
                        ErrorCode::IdMalformed,
                        format!(concat!($what, ": payload is {} bytes, expected 32"), payload.len()),
                    )
                })?;
                Ok($name(Hash32::from_bytes(bytes)))
            }
        }

        impl AceEncode for $name {
            fn encode(&self, out: &mut AceWriter) {
                self.0.encode(out);
            }

            fn encoded_len_hint(&self) -> usize {
                32
            }
        }

        impl AceDecode for $name {
            fn decode(input: &mut AceReader<'_>) -> Result<$name, AletheiaError> {
                Hash32::decode(input).map($name)
            }
        }
    };
}

identifier!(
    /// Transaction identifier, `AL:T…`.
    TxId, TX_ID_FORM, "transaction id", "AL:T", "t"
);
identifier!(
    /// Block identifier, `AL:B…`; the 32-byte block hash.
    BlockId, BLOCK_ID_FORM, "block id", "AL:B", "b"
);

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn transaction_and_block_ids_are_62_characters() {
        let hash = Hash32::from_bytes([7u8; 32]);
        let tx = TxId::from_hash(hash).to_text(NetworkKind::Mainnet);
        let block = BlockId::from_hash(hash).to_text(NetworkKind::Mainnet);
        assert_eq!((tx.len(), block.len()), (62, 62));
        assert!(tx.starts_with("AL:T") && block.starts_with("AL:B"));
    }

    #[test]
    fn a_tx_id_is_not_a_block_id_for_the_same_hash() {
        // Different HRP suffixes give different checksums, so the two cannot be confused even
        // if someone edits the prefix letter.
        let hash = Hash32::from_bytes([9u8; 32]);
        let tx = TxId::from_hash(hash).to_text(NetworkKind::Devnet);
        let relabelled = format!("AL:B{}", &tx[4..]);
        assert_eq!(
            BlockId::parse(&relabelled, NetworkKind::Devnet)
                .unwrap_err()
                .code(),
            ErrorCode::IdMalformed
        );
    }

    #[test]
    fn ids_from_another_network_are_wrong_network() {
        let id = BlockId::from_hash(Hash32::from_bytes([1u8; 32]));
        let text = id.to_text(NetworkKind::PrivateValidation);
        assert_eq!(
            BlockId::parse(&text, NetworkKind::Mainnet)
                .unwrap_err()
                .code(),
            ErrorCode::IdWrongNetwork
        );
    }

    proptest! {
        #[test]
        fn ids_round_trip(hash: [u8; 32], net in 0usize..4) {
            let network = NetworkKind::ALL[net];
            let tx = TxId::from_hash(Hash32::from_bytes(hash));
            let block = BlockId::from_hash(Hash32::from_bytes(hash));
            prop_assert_eq!(TxId::parse(&tx.to_text(network), network), Ok(tx));
            prop_assert_eq!(BlockId::parse(&block.to_text(network), network), Ok(block));
        }
    }
}
