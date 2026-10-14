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

/// P2P frames and messages from an untrusted peer (spec Section 61: Node -> P2P peers).
pub fn p2p_frames(data: &[u8]) {
    let mut decoder = aletheia_p2p::FrameDecoder::new();
    decoder.push(data);
    while let Ok(Some(frame)) = decoder.next_frame() {
        if let Ok(message) = aletheia_p2p::Message::from_frame(&frame) {
            let again = message.to_frame(frame.request_id);
            assert_eq!(
                again.payload, frame.payload,
                "accepted message is not canonical"
            );
            assert_eq!(
                (again.channel, again.msg_type),
                (frame.channel, frame.msg_type)
            );
        }
    }
    assert!(decoder.buffered() <= data.len());
}

/// Consensus messages from an untrusted peer (spec Section 61: Node -> P2P peers). The p2p
/// layer passes these bytes through undecoded; anything the consensus decoder accepts is
/// canonical and keeps its message type.
pub fn consensus_message(data: &[u8]) {
    let Some((&selector, payload)) = data.split_first() else {
        return;
    };
    let msg_type = u16::from(selector & 0x07);
    if let Ok(message) = aletheia_consensus::ConsensusMessage::decode(msg_type, payload) {
        assert_eq!(message.msg_type(), msg_type, "decoded message changed type");
        assert_eq!(
            message.encode_payload(),
            payload,
            "accepted consensus message is not canonical"
        );
    }
}

/// Finality proofs, carried in sync responses from untrusted peers.
pub fn finality_proof(data: &[u8]) {
    if let Ok(proof) = aletheia_consensus::FinalityProof::from_ace_bytes(data) {
        assert_eq!(
            proof.to_ace_bytes(),
            data,
            "accepted finality proof is not canonical"
        );
    }
}

/// The handshake hello, decoded before the peer is authenticated.
pub fn p2p_hello(data: &[u8]) {
    if let Ok(hello) = aletheia_p2p::handshake::Hello::from_ace_bytes(data) {
        assert_eq!(
            hello.to_ace_bytes(),
            data,
            "accepted hello is not canonical"
        );
    }
}

/// ISO 20022 messages from external rails (spec Section 40C.4, layer 1). The reader must
/// reject or accept within its byte, depth and element bounds, and give the same tree twice.
pub fn rails_xml(data: &[u8]) {
    let first = aletheia_rails::iso::xml::parse(data);
    let second = aletheia_rails::iso::xml::parse(data);
    assert_eq!(
        first.is_ok(),
        second.is_ok(),
        "parsing the same bytes twice disagreed"
    );
    if let (Ok(a), Ok(b)) = (first, second) {
        assert_eq!(a, b, "parsing the same bytes twice gave different trees");
    }
}

/// camt statements: the low bits of the first byte pick the currency exponent (0 to 15), the
/// rest is the document.
pub fn rails_camt(data: &[u8]) {
    let Some((&exponent, document)) = data.split_first() else {
        return;
    };
    let _ = aletheia_rails::iso::camt::parse_statement(document, u32::from(exponent & 0x0f));
}

/// The Arno compiler: whatever it accepts, the VM's verifier accepts too, and compiling the
/// same text twice gives the same bytes (Section 26 reproducibility).
pub fn arno_compile(data: &[u8]) {
    let Ok(text) = core::str::from_utf8(data) else {
        return;
    };
    let file = aletheia_arno::SourceFile::new("fuzz.arno", text);
    if let Ok(bytes) = aletheia_arno::compile(&file) {
        assert!(
            aletheia_vm::verify_bytes(&bytes).is_ok(),
            "the compiler produced a package the verifier refuses"
        );
        assert_eq!(
            aletheia_arno::compile(&file).ok(),
            Some(bytes),
            "compiling the same source twice gave different bytes"
        );
    }
}

/// The package decoder and verifier: anything accepted is canonical.
pub fn arnobc_verify(data: &[u8]) {
    if let Ok(package) = aletheia_vm::verify_bytes(data) {
        assert_eq!(
            package.to_bytes(),
            data,
            "accepted package bytes are not canonical"
        );
    }
}

/// The interpreter: compiled contracts' parameterless routines either return or stop with a
/// named trap, never an internal error, and two runs agree.
pub fn vm_run(data: &[u8]) {
    let Ok(text) = core::str::from_utf8(data) else {
        return;
    };
    let Ok(bytes) = aletheia_arno::compile(&aletheia_arno::SourceFile::new("fuzz.arno", text))
    else {
        return;
    };
    let Ok(package) = aletheia_vm::Package::from_bytes(&bytes) else {
        return;
    };
    for (index, function) in package.functions.iter().enumerate() {
        let Ok(index) = u8::try_from(index) else {
            return;
        };
        if function.params != 0 {
            continue;
        }
        let mut first = NullHost::default();
        let mut second = NullHost::default();
        let a = aletheia_vm::run(&package, index, Vec::new(), &mut first, 1_000_000);
        let b = aletheia_vm::run(&package, index, Vec::new(), &mut second, 1_000_000);
        if let Err(failure) = &a {
            assert!(
                !matches!(failure.trap, aletheia_vm::Trap::Internal(_)),
                "internal VM error: {failure:?}"
            );
        }
        assert_eq!(a, b, "two runs of the same call differ");
    }
}

/// A host with in-memory storage that accepts every transfer and event.
#[derive(Debug, Default)]
struct NullHost {
    storage: std::collections::BTreeMap<(u16, Vec<u8>), Vec<u8>>,
}

impl aletheia_vm::Host for NullHost {
    fn chain(&self) -> aletheia_vm::ChainInfo {
        aletheia_vm::ChainInfo {
            height: 1,
            slot: 1,
            epoch: 0,
            protocol_time_ms: 0,
            tx_id: [0; 32],
        }
    }
    fn storage_contains(&mut self, slot: u16, key: &[u8]) -> Result<bool, aletheia_vm::Trap> {
        Ok(self.storage.contains_key(&(slot, key.to_vec())))
    }
    fn storage_read(
        &mut self,
        slot: u16,
        key: &[u8],
    ) -> Result<Option<Vec<u8>>, aletheia_vm::Trap> {
        Ok(self.storage.get(&(slot, key.to_vec())).cloned())
    }
    fn storage_write(
        &mut self,
        slot: u16,
        key: &[u8],
        value: Option<&[u8]>,
    ) -> Result<(), aletheia_vm::Trap> {
        match value {
            Some(v) => self.storage.insert((slot, key.to_vec()), v.to_vec()),
            None => self.storage.remove(&(slot, key.to_vec())),
        };
        Ok(())
    }
    fn transfer(&mut self, _: u32, _: u128, _: &[u8; 20]) -> Result<(), aletheia_vm::Trap> {
        Ok(())
    }
    fn emit(&mut self, _: u16, _: Vec<u8>) -> Result<(), aletheia_vm::Trap> {
        Ok(())
    }
    fn verify_ed25519(&self, _: &[u8; 32], _: &[u8; 32], _: &[u8; 64]) -> bool {
        false
    }
}
