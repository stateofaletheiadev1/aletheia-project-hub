//! Fuzz-target bodies for every parser at a trust boundary (spec Sections 3 work loop, 61).
//!
//! Each target asserts the property that matters for that parser: anything accepted is
//! canonical, so it re-encodes to exactly the input (APS-0041 rule 10, APS-0048, APS-0002).
//! A crash, hang or failed assertion is a finding.

use aletheia_core::{
    AceDecode, AceEncode, Address, BlockHeader, BlockId, ChainId, Hash32, NetworkIdentity,
    NetworkKind, SignedTransaction, TxId, base16,
};
use aletheia_execution::{Rules, StatelessValidator};

fn devnet() -> NetworkIdentity {
    NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
}

pub fn ace_signed_transaction(data: &[u8]) {
    if let Ok(transaction) = SignedTransaction::from_ace_bytes(data) {
        assert_eq!(
            transaction.to_ace_bytes(),
            data,
            "accepted transaction bytes are not canonical"
        );
    }
}

pub fn ace_block_header(data: &[u8]) {
    if let Ok(header) = BlockHeader::from_ace_bytes(data) {
        assert_eq!(
            header.to_ace_bytes(),
            data,
            "accepted header bytes are not canonical"
        );
    }
}

pub fn text_identifiers(data: &[u8]) {
    let Ok(text) = core::str::from_utf8(data) else {
        return;
    };
    for network in NetworkKind::ALL {
        if let Ok(address) = Address::parse(text, network) {
            assert_eq!(
                address.to_text(network),
                text,
                "accepted address is not canonical"
            );
        }
        if let Ok(id) = TxId::parse(text, network) {
            assert_eq!(
                id.to_text(network),
                text,
                "accepted transaction id is not canonical"
            );
        }
        if let Ok(id) = BlockId::parse(text, network) {
            assert_eq!(
                id.to_text(network),
                text,
                "accepted block id is not canonical"
            );
        }
    }
}

pub fn base16_text(data: &[u8]) {
    let Ok(text) = core::str::from_utf8(data) else {
        return;
    };
    if let Ok(bytes) = base16::decode(text) {
        assert_eq!(
            base16::encode(&bytes),
            text,
            "accepted base16 is not canonical"
        );
    }
}

pub fn stateless_validation(data: &[u8]) {
    if let Ok(verified) = StatelessValidator::new(devnet(), Rules::V1).validate(data) {
        assert_eq!(verified.encoded_len(), data.len());
        assert_eq!(
            verified.transaction().to_ace_bytes(),
            data,
            "validated bytes are not canonical"
        );
    }
}
