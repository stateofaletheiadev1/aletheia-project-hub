//! Transaction wire format (APS-0003, Section 13).
//!
//! ```text
//! SignedTransaction = TransactionBody || Authorization
//! TransactionBody   = version u16 | chain_id u32 | network_kind u8 | tx_type u16 | sender Address
//!                   | nonce u64 | fee_asset u32 | max_fee u128 | eu_limit u64
//!                   | valid_from_slot u64 | expiry_slot u64 | memo bytes<=256 | payload
//! ```
//!
//! `tx_type` is the payload's tag: it is written once, in the body, and selects how the
//! payload bytes that follow are decoded. A type this binary has no layout for does not
//! decode. Whether a known type is *active* is a protocol-version question answered by the
//! execution rules (Section 44.3), not here.
//!
//! The authorization carries the public keys it signs with (ERRATA E-10). That lets
//! signatures be checked without state; binding the keys to the sender's account is a
//! stateful check made at admission and execution.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::address::Address;
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::ids::TxId;
use crate::network::{ChainId, DomainTag, NetworkIdentity, NetworkKind};
use crate::types::{AssetId, Hash32, Slot};

/// Transaction body structure version. A changed body is a new version, never appended
/// fields (Section 44.3 rule 4).
pub const TX_BODY_VERSION_1: u16 = 1;

pub const MAX_MEMO_BYTES: u32 = 256;
pub const MAX_BATCH_LEGS: u32 = 256;
pub const MAX_AUTH_KEYS: u32 = 16;
pub const MAX_AUTH_SIGNATURES: u32 = 16;
/// Largest key encoding any algorithm in ADR-039 uses (BLS is 48; Ed25519 32). ML-DSA, when
/// activated, comes with a new body or authorization version and its own bound.
pub const MAX_PUBLIC_KEY_BYTES: u32 = 48;
/// Largest signature encoding any algorithm in ADR-039 uses (BLS is 96; Ed25519 64).
pub const MAX_SIGNATURE_BYTES: u32 = 96;

/// Transaction type tag (Section 13 table). Decimal values are protocol.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct TxType(u16);

impl TxType {
    pub const TRANSFER: TxType = TxType(1);
    pub const BATCH_TRANSFER: TxType = TxType(2);
    pub const MINT: TxType = TxType(16);
    pub const BURN: TxType = TxType(17);
    pub const LOCK: TxType = TxType(18);
    pub const UNLOCK: TxType = TxType(19);
    pub const REDEEM: TxType = TxType(20);
    pub const RESERVE_ATTESTATION: TxType = TxType(96);
    pub const CONTRACT_DEPLOY: TxType = TxType(32);
    pub const CONTRACT_CALL: TxType = TxType(33);
    /// Test-only (feature `test-protocol-v2`): the type protocol version 2 adds in the
    /// continuity tests. Far from every real tag so it can never collide with one.
    #[cfg(feature = "test-protocol-v2")]
    pub const TEST_REMARK: TxType = TxType(65_000);

    pub const fn new(value: u16) -> TxType {
        TxType(value)
    }

    pub const fn get(self) -> u16 {
        self.0
    }
}

impl core::fmt::Display for TxType {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        self.0.fmt(f)
    }
}

/// One movement of a native asset to a recipient. Also a leg of `BatchTransfer`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransferLeg {
    pub recipient: Address,
    pub asset: AssetId,
    /// Base units of `asset`.
    pub amount: u128,
}

impl AceEncode for TransferLeg {
    fn encode(&self, out: &mut AceWriter) {
        self.recipient.encode(out);
        self.asset.encode(out);
        out.u128(self.amount);
    }

    fn encoded_len_hint(&self) -> usize {
        Address::ENCODED_LEN + 4 + 16
    }
}

impl AceDecode for TransferLeg {
    fn decode(input: &mut AceReader<'_>) -> Result<TransferLeg, AletheiaError> {
        Ok(TransferLeg {
            recipient: Address::decode(input)?,
            asset: AssetId::decode(input)?,
            amount: input.u128()?,
        })
    }
}

/// Type-specific content. The variant always agrees with the body's `tx_type`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Payload {
    Transfer(TransferLeg),
    /// 1 to 256 legs, applied in order, all or nothing.
    BatchTransfer(Vec<TransferLeg>),
    Mint(Box<crate::monetary::MintAuthorization>),
    Burn(crate::monetary::AssetAmount),
    Lock(crate::monetary::AssetAmount),
    Unlock(crate::monetary::AssetAmount),
    Redeem(Box<crate::monetary::Redemption>),
    ReserveAttestation(Box<crate::monetary::ReserveAttestation>),
    ContractDeploy(Box<crate::monetary::ContractDeploy>),
    ContractCall(Box<crate::monetary::ContractCall>),
    /// Test-only opaque note, at most 256 bytes (feature `test-protocol-v2`).
    #[cfg(feature = "test-protocol-v2")]
    TestRemark(Vec<u8>),
}

impl Payload {
    pub fn tx_type(&self) -> TxType {
        match self {
            Payload::Transfer(_) => TxType::TRANSFER,
            Payload::BatchTransfer(_) => TxType::BATCH_TRANSFER,
            Payload::Mint(_) => TxType::MINT,
            Payload::Burn(_) => TxType::BURN,
            Payload::Lock(_) => TxType::LOCK,
            Payload::Unlock(_) => TxType::UNLOCK,
            Payload::Redeem(_) => TxType::REDEEM,
            Payload::ReserveAttestation(_) => TxType::RESERVE_ATTESTATION,
            Payload::ContractDeploy(_) => TxType::CONTRACT_DEPLOY,
            Payload::ContractCall(_) => TxType::CONTRACT_CALL,
            #[cfg(feature = "test-protocol-v2")]
            Payload::TestRemark(_) => TxType::TEST_REMARK,
        }
    }

    /// Payload bytes only; the tag is the body's `tx_type`.
    fn encode_content(&self, out: &mut AceWriter) {
        match self {
            Payload::Transfer(leg) => leg.encode(out),
            Payload::BatchTransfer(legs) => out.list(legs),
            Payload::Mint(authorization) => authorization.encode(out),
            Payload::Burn(amount) | Payload::Lock(amount) | Payload::Unlock(amount) => {
                amount.encode(out)
            }
            Payload::Redeem(redemption) => redemption.encode(out),
            Payload::ReserveAttestation(attestation) => attestation.encode(out),
            Payload::ContractDeploy(deploy) => deploy.encode(out),
            Payload::ContractCall(call) => call.encode(out),
            #[cfg(feature = "test-protocol-v2")]
            Payload::TestRemark(note) => out.bytes(note),
        }
    }

    fn decode_content(
        tx_type: TxType,
        offset: usize,
        input: &mut AceReader<'_>,
    ) -> Result<Payload, AletheiaError> {
        match tx_type {
            TxType::TRANSFER => TransferLeg::decode(input).map(Payload::Transfer),
            TxType::BATCH_TRANSFER => input.list(MAX_BATCH_LEGS).map(Payload::BatchTransfer),
            TxType::MINT => crate::monetary::MintAuthorization::decode(input)
                .map(|authorization| Payload::Mint(Box::new(authorization))),
            TxType::BURN => crate::monetary::AssetAmount::decode(input).map(Payload::Burn),
            TxType::LOCK => crate::monetary::AssetAmount::decode(input).map(Payload::Lock),
            TxType::UNLOCK => crate::monetary::AssetAmount::decode(input).map(Payload::Unlock),
            TxType::REDEEM => crate::monetary::Redemption::decode(input)
                .map(|redemption| Payload::Redeem(Box::new(redemption))),
            TxType::RESERVE_ATTESTATION => crate::monetary::ReserveAttestation::decode(input)
                .map(|attestation| Payload::ReserveAttestation(Box::new(attestation))),
            TxType::CONTRACT_DEPLOY => crate::monetary::ContractDeploy::decode(input)
                .map(|deploy| Payload::ContractDeploy(Box::new(deploy))),
            TxType::CONTRACT_CALL => crate::monetary::ContractCall::decode(input)
                .map(|call| Payload::ContractCall(Box::new(call))),
            #[cfg(feature = "test-protocol-v2")]
            TxType::TEST_REMARK => input
                .bytes(MAX_MEMO_BYTES)
                .map(|note| Payload::TestRemark(note.to_vec())),
            other => Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!(
                    "transaction type {other} at offset {offset} has no payload layout in this binary"
                ),
            )),
        }
    }
}

/// Fee terms (APS-0042).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Fee {
    pub fee_asset: AssetId,
    /// Base units of `fee_asset`.
    pub max_fee: u128,
    pub eu_limit: u64,
}

/// What the sender asked for. Its ACE bytes define the transaction ID and signing digest.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransactionBody {
    pub version: u16,
    pub chain_id: ChainId,
    pub network_kind: NetworkKind,
    pub sender: Address,
    pub nonce: u64,
    pub fee: Fee,
    pub valid_from_slot: Slot,
    pub expiry_slot: Slot,
    /// Opaque, at most 256 bytes, no protocol semantics.
    pub memo: Vec<u8>,
    pub payload: Payload,
}

impl TransactionBody {
    pub fn tx_type(&self) -> TxType {
        self.payload.tx_type()
    }

    /// `H_domain("ALETHEIA/TXID/v1", ace(body))`. Signatures are excluded (ADR-011).
    pub fn tx_id(&self, network: &NetworkIdentity) -> TxId {
        TxId::from_hash(network.domain_hash(DomainTag::TxId, &self.to_ace_bytes()))
    }

    /// `H_domain("ALETHEIA/TXSIG/v1", ace(body))`: the 32 bytes every signer signs.
    pub fn signing_digest(&self, network: &NetworkIdentity) -> Hash32 {
        network.domain_hash(DomainTag::TxSignature, &self.to_ace_bytes())
    }
}

impl AceEncode for TransactionBody {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.version);
        self.chain_id.encode(out);
        self.network_kind.encode(out);
        out.u16(self.tx_type().get());
        self.sender.encode(out);
        out.u64(self.nonce);
        self.fee.fee_asset.encode(out);
        out.u128(self.fee.max_fee);
        out.u64(self.fee.eu_limit);
        self.valid_from_slot.encode(out);
        self.expiry_slot.encode(out);
        out.bytes(&self.memo);
        self.payload.encode_content(out);
    }

    fn encoded_len_hint(&self) -> usize {
        160usize.saturating_add(self.memo.len())
    }
}

impl AceDecode for TransactionBody {
    fn decode(input: &mut AceReader<'_>) -> Result<TransactionBody, AletheiaError> {
        let version = input.u16()?;
        let chain_id = ChainId::decode(input)?;
        let network_kind = NetworkKind::decode(input)?;
        let type_offset = input.position();
        let tx_type = TxType(input.u16()?);
        let sender = Address::decode(input)?;
        let nonce = input.u64()?;
        let fee = Fee {
            fee_asset: AssetId::decode(input)?,
            max_fee: input.u128()?,
            eu_limit: input.u64()?,
        };
        let valid_from_slot = Slot::decode(input)?;
        let expiry_slot = Slot::decode(input)?;
        let memo = input.bytes(MAX_MEMO_BYTES)?.to_vec();
        let payload = Payload::decode_content(tx_type, type_offset, input)?;
        Ok(TransactionBody {
            version,
            chain_id,
            network_kind,
            sender,
            nonce,
            fee,
            valid_from_slot,
            expiry_slot,
            memo,
            payload,
        })
    }
}

/// How the sender authorizes (ADR-044). Zero is never valid.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum AuthScheme {
    /// One Ed25519 key; address type 0.
    Ed25519,
    /// `threshold` of up to 16 Ed25519 keys; address type 1.
    MultiEd25519,
}

impl AuthScheme {
    /// Reserved for ML-DSA accounts; not decodable until a protocol version activates it.
    pub const RESERVED_ML_DSA: u8 = 3;

    pub const fn code(self) -> u8 {
        match self {
            AuthScheme::Ed25519 => 1,
            AuthScheme::MultiEd25519 => 2,
        }
    }
}

impl AceEncode for AuthScheme {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.code());
    }
}

impl AceDecode for AuthScheme {
    fn decode(input: &mut AceReader<'_>) -> Result<AuthScheme, AletheiaError> {
        let offset = input.position();
        match input.u8()? {
            1 => Ok(AuthScheme::Ed25519),
            2 => Ok(AuthScheme::MultiEd25519),
            other => Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!("authorization scheme {other} at offset {offset} is not active"),
            )),
        }
    }
}

/// A public key tagged with its algorithm (ADR-039). Ordered by `(alg_id, key)`, which is the
/// canonical order inside an authorization and in multisig address derivation.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct PublicKeyEntry {
    pub alg_id: u8,
    pub key: Vec<u8>,
}

impl AceEncode for PublicKeyEntry {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.alg_id);
        out.bytes(&self.key);
    }
}

impl AceDecode for PublicKeyEntry {
    fn decode(input: &mut AceReader<'_>) -> Result<PublicKeyEntry, AletheiaError> {
        Ok(PublicKeyEntry {
            alg_id: input.u8()?,
            key: input.bytes(MAX_PUBLIC_KEY_BYTES)?.to_vec(),
        })
    }
}

/// One signature, by the key at `signer_index` in the authorization's key list.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SignatureEntry {
    pub signer_index: u8,
    pub alg_id: u8,
    pub signature: Vec<u8>,
}

impl AceEncode for SignatureEntry {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.signer_index);
        out.u8(self.alg_id);
        out.bytes(&self.signature);
    }
}

impl AceDecode for SignatureEntry {
    fn decode(input: &mut AceReader<'_>) -> Result<SignatureEntry, AletheiaError> {
        Ok(SignatureEntry {
            signer_index: input.u8()?,
            alg_id: input.u8()?,
            signature: input.bytes(MAX_SIGNATURE_BYTES)?.to_vec(),
        })
    }
}

/// Signatures over the body's signing digest, with the keys that made them.
///
/// Canonical form: keys strictly ascending, signatures strictly ascending by `signer_index`
/// (so no key signs twice). Both are enforced by the decoder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Authorization {
    pub scheme: AuthScheme,
    pub threshold: u8,
    pub public_keys: Vec<PublicKeyEntry>,
    pub signatures: Vec<SignatureEntry>,
}

impl AceEncode for Authorization {
    fn encode(&self, out: &mut AceWriter) {
        self.scheme.encode(out);
        out.u8(self.threshold);
        out.list(&self.public_keys);
        out.list(&self.signatures);
    }
}

impl AceDecode for Authorization {
    fn decode(input: &mut AceReader<'_>) -> Result<Authorization, AletheiaError> {
        let scheme = AuthScheme::decode(input)?;
        let threshold = input.u8()?;
        let public_keys = input.sorted_list(MAX_AUTH_KEYS)?;
        let signatures: Vec<SignatureEntry> = input.list(MAX_AUTH_SIGNATURES)?;
        if signatures
            .windows(2)
            .any(|pair| matches!(pair, [a, b] if a.signer_index >= b.signer_index))
        {
            return Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                "authorization signatures are not strictly ascending by signer index".to_owned(),
            ));
        }
        Ok(Authorization {
            scheme,
            threshold,
            public_keys,
            signatures,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignedTransaction {
    pub body: TransactionBody,
    pub authorization: Authorization,
}

impl SignedTransaction {
    /// `H_domain("ALETHEIA/TXWIT/v1", ace(signed))`: commits the full signed bytes into
    /// `tx_root`.
    pub fn witness_hash(&self, network: &NetworkIdentity) -> Hash32 {
        network.domain_hash(DomainTag::TxWitness, &self.to_ace_bytes())
    }
}

impl AceEncode for SignedTransaction {
    fn encode(&self, out: &mut AceWriter) {
        self.body.encode(out);
        self.authorization.encode(out);
    }

    fn encoded_len_hint(&self) -> usize {
        self.body.encoded_len_hint().saturating_add(128)
    }
}

impl AceDecode for SignedTransaction {
    fn decode(input: &mut AceReader<'_>) -> Result<SignedTransaction, AletheiaError> {
        Ok(SignedTransaction {
            body: TransactionBody::decode(input)?,
            authorization: Authorization::decode(input)?,
        })
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::address::AddressType;
    use proptest::prelude::*;

    pub(crate) fn address(seed: u8, address_type: AddressType) -> Address {
        Address::new(address_type, Hash32::from_bytes([seed; 32]))
    }

    pub(crate) fn transfer_body() -> TransactionBody {
        TransactionBody {
            version: TX_BODY_VERSION_1,
            chain_id: ChainId::new(7771),
            network_kind: NetworkKind::Devnet,
            sender: address(1, AddressType::Ed25519Account),
            nonce: 42,
            fee: Fee {
                fee_asset: AssetId::AEY,
                max_fee: 2_100_000_000_000_000,
                eu_limit: 5_000,
            },
            valid_from_slot: Slot::new(100),
            expiry_slot: Slot::new(200),
            memo: b"invoice 2026-118".to_vec(),
            payload: Payload::Transfer(TransferLeg {
                recipient: address(2, AddressType::Ed25519Account),
                asset: AssetId::AEY,
                amount: 125_000_000_000_000_000_000,
            }),
        }
    }

    pub(crate) fn signed(body: TransactionBody) -> SignedTransaction {
        SignedTransaction {
            body,
            authorization: Authorization {
                scheme: AuthScheme::Ed25519,
                threshold: 1,
                public_keys: vec![PublicKeyEntry {
                    alg_id: 1,
                    key: vec![7; 32],
                }],
                signatures: vec![SignatureEntry {
                    signer_index: 0,
                    alg_id: 1,
                    signature: vec![9; 64],
                }],
            },
        }
    }

    fn network() -> NetworkIdentity {
        NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
    }

    #[test]
    fn body_layout_matches_section_13_field_order() {
        let bytes = transfer_body().to_ace_bytes();
        assert_eq!(&bytes[0..2], &[1, 0], "version");
        assert_eq!(&bytes[2..6], &7771u32.to_le_bytes(), "chain_id");
        assert_eq!(bytes[6], 3, "network_kind");
        assert_eq!(&bytes[7..9], &[1, 0], "tx_type");
        assert_eq!(bytes[9], 0, "sender address type");
        assert_eq!(&bytes[42..50], &42u64.to_le_bytes(), "nonce");
    }

    #[test]
    fn tx_id_ignores_signatures_but_witness_hash_does_not() {
        let a = signed(transfer_body());
        let mut b = a.clone();
        b.authorization.signatures[0].signature = vec![8; 64];
        assert_eq!(a.body.tx_id(&network()), b.body.tx_id(&network()));
        assert_ne!(a.witness_hash(&network()), b.witness_hash(&network()));
    }

    #[test]
    fn tx_id_and_signing_digest_use_different_domains() {
        let body = transfer_body();
        assert_ne!(
            body.tx_id(&network()).hash(),
            body.signing_digest(&network())
        );
    }

    #[test]
    fn unknown_transaction_type_does_not_decode() {
        let mut bytes = transfer_body().to_ace_bytes();
        bytes[7..9].copy_from_slice(&999u16.to_le_bytes());
        let error = TransactionBody::from_ace_bytes(&bytes).unwrap_err();
        assert_eq!(error.code(), ErrorCode::DecodeNonCanonical);
    }

    #[test]
    fn memo_over_256_bytes_does_not_decode() {
        let mut body = transfer_body();
        body.memo = vec![0; 257];
        let error = TransactionBody::from_ace_bytes(&body.to_ace_bytes()).unwrap_err();
        assert_eq!(error.code(), ErrorCode::DecodeLengthExceeded);
    }

    #[test]
    fn duplicate_signer_index_does_not_decode() {
        let mut tx = signed(transfer_body());
        let entry = tx.authorization.signatures[0].clone();
        tx.authorization.signatures.push(entry);
        let error = SignedTransaction::from_ace_bytes(&tx.to_ace_bytes()).unwrap_err();
        assert_eq!(error.code(), ErrorCode::DecodeNonCanonical);
    }

    #[test]
    fn unsorted_keys_do_not_decode() {
        let mut tx = signed(transfer_body());
        tx.authorization.public_keys.insert(
            0,
            PublicKeyEntry {
                alg_id: 1,
                key: vec![8; 32],
            },
        );
        let error = SignedTransaction::from_ace_bytes(&tx.to_ace_bytes()).unwrap_err();
        assert_eq!(error.code(), ErrorCode::DecodeNonCanonical);
    }

    #[test]
    fn zero_scheme_does_not_decode() {
        let tx = signed(transfer_body());
        let mut bytes = tx.to_ace_bytes();
        let scheme_offset = tx.body.to_ace_bytes().len();
        bytes[scheme_offset] = 0;
        assert_eq!(
            SignedTransaction::from_ace_bytes(&bytes)
                .unwrap_err()
                .code(),
            ErrorCode::DecodeNonCanonical
        );
    }

    proptest! {
        #[test]
        fn batch_transfers_round_trip(amounts in proptest::collection::vec(any::<u128>(), 1..20), nonce: u64) {
            let mut body = transfer_body();
            body.nonce = nonce;
            body.payload = Payload::BatchTransfer(
                amounts.iter().map(|&amount| TransferLeg { recipient: address(3, AddressType::Contract), asset: AssetId::ALNT, amount }).collect(),
            );
            let tx = signed(body);
            prop_assert_eq!(SignedTransaction::from_ace_bytes(&tx.to_ace_bytes()), Ok(tx));
        }

        #[test]
        fn accepted_bytes_re_encode_identically(flip in 0usize..200, value: u8) {
            let mut bytes = signed(transfer_body()).to_ace_bytes();
            if let Some(byte) = bytes.get_mut(flip) {
                *byte = value;
            }
            if let Ok(decoded) = SignedTransaction::from_ace_bytes(&bytes) {
                prop_assert_eq!(decoded.to_ace_bytes(), bytes);
            }
        }
    }
}
