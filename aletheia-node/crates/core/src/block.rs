//! Block wire format (APS-0004, Section 14) and the certificates it carries (APS-0009).
//!
//! The header carries the *parent's* quorum certificate; a block's own QC appears in its
//! child and in the stored finality proof. Execution results are not transmitted: validators
//! recompute them and compare the committed roots.
//!
//! BLS points are held here as raw bytes. Decoding checks only lengths; subgroup and
//! signature checks are made by `aletheia-crypto` when a certificate is verified, so a header
//! can be hashed and stored without the crypto crate.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::ids::BlockId;
use crate::network::{ChainId, DomainTag, NetworkIdentity};
use crate::tx::SignedTransaction;
use crate::types::{Epoch, Hash32, Height, ProtocolVersion, Slot, ValidatorIndex};

/// Upper bound on an epoch's validator set (ADR-045). It bounds signer bitmaps and the
/// consensus inbox (Section 46.1).
pub const MAX_VALIDATORS: u16 = 1024;
pub const BLS_SIGNATURE_LEN: usize = 96;
/// Header extensions are empty in v0.1; the decoder bound leaves room for later versions,
/// which activate specific ids (Section 44.3 rule 4).
pub const MAX_HEADER_EXTENSIONS: u32 = 16;
pub const MAX_EXTENSION_BYTES: u32 = 1024;
/// Decoder bound on transactions per block. The protocol limit (`MAX_BLOCK_TXS`, 20,000 on
/// devnet) is a rule-set parameter checked after decoding.
pub const MAX_BLOCK_TXS_DECODE: u32 = 65_535;

/// Which validators of an epoch's ordered set signed. Bit `i` (LSB-first within each byte)
/// is validator index `i`.
///
/// Canonical encoding: `u16 len` then `ceil(len / 8)` bytes, with every bit at or beyond
/// `len` zero. Any other bytes for the same set are rejected, so a set has one encoding.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SignerBitmap {
    len: u16,
    bytes: Vec<u8>,
}

impl SignerBitmap {
    /// An empty bitmap over `len` validators.
    pub fn new(len: u16) -> Result<SignerBitmap, AletheiaError> {
        if len > MAX_VALIDATORS {
            return Err(AletheiaError::new(
                ErrorCode::DecodeLengthExceeded,
                format!("signer bitmap over {len} validators exceeds {MAX_VALIDATORS}"),
            ));
        }
        Ok(SignerBitmap {
            len,
            bytes: vec![0; usize::from(len).div_ceil(8)],
        })
    }

    pub fn len(&self) -> u16 {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub fn set(&mut self, index: ValidatorIndex) -> Result<(), AletheiaError> {
        let (byte, mask) = self.locate(index)?;
        if let Some(slot) = self.bytes.get_mut(byte) {
            *slot |= mask;
        }
        Ok(())
    }

    pub fn contains(&self, index: ValidatorIndex) -> bool {
        self.locate(index)
            .ok()
            .and_then(|(byte, mask)| self.bytes.get(byte).map(|b| b & mask != 0))
            .unwrap_or(false)
    }

    /// Number of signers. At most `MAX_VALIDATORS`, so it fits in `u16`.
    pub fn count(&self) -> u16 {
        let ones: u32 = self.bytes.iter().map(|b| b.count_ones()).sum();
        u16::try_from(ones).unwrap_or(u16::MAX)
    }

    /// Signer indices in ascending order.
    pub fn signers(&self) -> impl Iterator<Item = ValidatorIndex> + '_ {
        (0..self.len)
            .map(ValidatorIndex::new)
            .filter(|&index| self.contains(index))
    }

    fn locate(&self, index: ValidatorIndex) -> Result<(usize, u8), AletheiaError> {
        if index.get() >= self.len {
            return Err(AletheiaError::new(
                ErrorCode::DecodeLengthExceeded,
                format!("validator index {index} outside a set of {}", self.len),
            ));
        }
        let position = usize::from(index.get());
        Ok((position / 8, 1u8 << (position % 8)))
    }
}

impl AceEncode for SignerBitmap {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.len);
        out.fixed(&self.bytes);
    }
}

impl AceDecode for SignerBitmap {
    fn decode(input: &mut AceReader<'_>) -> Result<SignerBitmap, AletheiaError> {
        let offset = input.position();
        let len = input.u16()?;
        let mut bitmap = SignerBitmap::new(len)?;
        for byte in bitmap.bytes.iter_mut() {
            *byte = input.u8()?;
        }
        let used_bits = len % 8;
        if used_bits != 0
            && let Some(&last) = bitmap.bytes.last()
            && last >> used_bits != 0
        {
            return Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!(
                    "signer bitmap at offset {offset} has bits set beyond its {len} validators"
                ),
            ));
        }
        Ok(bitmap)
    }
}

/// Aggregate BLS signature by at least a quorum on `(round, block_hash, epoch)` (§19.3).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct QuorumCertificate {
    pub round: Slot,
    pub block_hash: Hash32,
    pub epoch: Epoch,
    pub signers: SignerBitmap,
    pub aggregate_signature: [u8; BLS_SIGNATURE_LEN],
}

impl QuorumCertificate {
    /// The certificate a genesis header carries as `parent_qc`: round 0, zero hash, epoch 0,
    /// no signers, zero signature bytes. It is never verified; header validation accepts it
    /// only at height 0.
    pub fn genesis() -> QuorumCertificate {
        QuorumCertificate {
            round: Slot::new(0),
            block_hash: Hash32::ZERO,
            epoch: Epoch::new(0),
            signers: SignerBitmap {
                len: 0,
                bytes: Vec::new(),
            },
            aggregate_signature: [0; BLS_SIGNATURE_LEN],
        }
    }

    pub fn is_genesis(&self) -> bool {
        *self == QuorumCertificate::genesis()
    }

    /// `H_domain("ALETHEIA/VOTE/v1", ace(round, block_hash, epoch))`: what every vote signs.
    pub fn vote_digest(
        network: &NetworkIdentity,
        round: Slot,
        block_hash: &Hash32,
        epoch: Epoch,
    ) -> Hash32 {
        let mut message = AceWriter::with_capacity(48);
        round.encode(&mut message);
        block_hash.encode(&mut message);
        epoch.encode(&mut message);
        network.domain_hash(DomainTag::Vote, message.as_bytes())
    }
}

impl AceEncode for QuorumCertificate {
    fn encode(&self, out: &mut AceWriter) {
        self.round.encode(out);
        self.block_hash.encode(out);
        self.epoch.encode(out);
        self.signers.encode(out);
        out.fixed(&self.aggregate_signature);
    }
}

impl AceDecode for QuorumCertificate {
    fn decode(input: &mut AceReader<'_>) -> Result<QuorumCertificate, AletheiaError> {
        Ok(QuorumCertificate {
            round: Slot::decode(input)?,
            block_hash: Hash32::decode(input)?,
            epoch: Epoch::decode(input)?,
            signers: SignerBitmap::decode(input)?,
            aggregate_signature: input.array()?,
        })
    }
}

/// Proof that a quorum timed out in `round` (§19.5). Each signer signed
/// `Timeout{round, highest_qc_round}`; `high_qc_rounds[k]` belongs to the k-th set bit of
/// `signers` in ascending index order (ERRATA E-11).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TimeoutCertificate {
    pub round: Slot,
    pub epoch: Epoch,
    pub signers: SignerBitmap,
    pub high_qc_rounds: Vec<Slot>,
    pub aggregate_signature: [u8; BLS_SIGNATURE_LEN],
}

impl TimeoutCertificate {
    /// The largest `highest_qc_round` reported, used by voting rule V4.
    pub fn max_high_qc_round(&self) -> Option<Slot> {
        self.high_qc_rounds.iter().copied().max()
    }

    /// `H_domain("ALETHEIA/TIMEOUT/v1", ace(round, epoch, highest_qc_round))`.
    pub fn timeout_digest(
        network: &NetworkIdentity,
        round: Slot,
        epoch: Epoch,
        highest_qc_round: Slot,
    ) -> Hash32 {
        let mut message = AceWriter::with_capacity(24);
        round.encode(&mut message);
        epoch.encode(&mut message);
        highest_qc_round.encode(&mut message);
        network.domain_hash(DomainTag::Timeout, message.as_bytes())
    }
}

impl AceEncode for TimeoutCertificate {
    fn encode(&self, out: &mut AceWriter) {
        self.round.encode(out);
        self.epoch.encode(out);
        self.signers.encode(out);
        out.list(&self.high_qc_rounds);
        out.fixed(&self.aggregate_signature);
    }
}

impl AceDecode for TimeoutCertificate {
    fn decode(input: &mut AceReader<'_>) -> Result<TimeoutCertificate, AletheiaError> {
        let round = Slot::decode(input)?;
        let epoch = Epoch::decode(input)?;
        let signers = SignerBitmap::decode(input)?;
        let offset = input.position();
        let high_qc_rounds: Vec<Slot> = input.list(u32::from(MAX_VALIDATORS))?;
        if high_qc_rounds.len() != usize::from(signers.count()) {
            return Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!(
                    "timeout certificate at offset {offset} has {} high-QC rounds for {} signers",
                    high_qc_rounds.len(),
                    signers.count()
                ),
            ));
        }
        Ok(TimeoutCertificate {
            round,
            epoch,
            signers,
            high_qc_rounds,
            aggregate_signature: input.array()?,
        })
    }
}

/// A sorted header extension (§14.1). None are active in protocol version 1.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ExtensionField {
    pub id: u16,
    pub value: Vec<u8>,
}

impl AceEncode for ExtensionField {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.id);
        out.bytes(&self.value);
    }
}

impl AceDecode for ExtensionField {
    fn decode(input: &mut AceReader<'_>) -> Result<ExtensionField, AletheiaError> {
        Ok(ExtensionField {
            id: input.u16()?,
            value: input.bytes(MAX_EXTENSION_BYTES)?.to_vec(),
        })
    }
}

/// The hash-committed block header (§14.1). Field order is protocol.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockHeader {
    pub version: ProtocolVersion,
    pub chain_id: ChainId,
    pub height: Height,
    pub epoch: Epoch,
    pub slot: Slot,
    /// MUST equal `genesis_time_ms + slot × slot_duration_ms(version)`.
    pub protocol_time_ms: u64,
    /// MUST equal `leader(epoch, slot)`.
    pub proposer: ValidatorIndex,
    pub parent_hash: Hash32,
    pub parent_qc: QuorumCertificate,
    /// Present when slot − 1 timed out.
    pub timeout_cert: Option<TimeoutCertificate>,
    pub tx_root: Hash32,
    pub receipt_root: Hash32,
    pub state_root: Hash32,
    pub event_root: Hash32,
    pub validator_set_hash: Hash32,
    pub next_validator_set_hash: Hash32,
    pub monetary_root: Hash32,
    pub eu_used: u64,
    pub tx_count: u32,
    /// Strictly ascending by `id`.
    pub extensions: Vec<ExtensionField>,
}

impl BlockHeader {
    /// `H_domain("ALETHEIA/BLOCK/v1", ace(header))`.
    pub fn block_hash(&self, network: &NetworkIdentity) -> Hash32 {
        network.domain_hash(DomainTag::Block, &self.to_ace_bytes())
    }

    pub fn block_id(&self, network: &NetworkIdentity) -> BlockId {
        BlockId::from_hash(self.block_hash(network))
    }
}

impl AceEncode for BlockHeader {
    fn encode(&self, out: &mut AceWriter) {
        self.version.encode(out);
        self.chain_id.encode(out);
        self.height.encode(out);
        self.epoch.encode(out);
        self.slot.encode(out);
        out.u64(self.protocol_time_ms);
        self.proposer.encode(out);
        self.parent_hash.encode(out);
        self.parent_qc.encode(out);
        out.option(self.timeout_cert.as_ref());
        for root in [
            &self.tx_root,
            &self.receipt_root,
            &self.state_root,
            &self.event_root,
            &self.validator_set_hash,
            &self.next_validator_set_hash,
            &self.monetary_root,
        ] {
            root.encode(out);
        }
        out.u64(self.eu_used);
        out.u32(self.tx_count);
        out.list(&self.extensions);
    }

    fn encoded_len_hint(&self) -> usize {
        512
    }
}

impl AceDecode for BlockHeader {
    fn decode(input: &mut AceReader<'_>) -> Result<BlockHeader, AletheiaError> {
        Ok(BlockHeader {
            version: ProtocolVersion::decode(input)?,
            chain_id: ChainId::decode(input)?,
            height: Height::decode(input)?,
            epoch: Epoch::decode(input)?,
            slot: Slot::decode(input)?,
            protocol_time_ms: input.u64()?,
            proposer: ValidatorIndex::decode(input)?,
            parent_hash: Hash32::decode(input)?,
            parent_qc: QuorumCertificate::decode(input)?,
            timeout_cert: input.option()?,
            tx_root: Hash32::decode(input)?,
            receipt_root: Hash32::decode(input)?,
            state_root: Hash32::decode(input)?,
            event_root: Hash32::decode(input)?,
            validator_set_hash: Hash32::decode(input)?,
            next_validator_set_hash: Hash32::decode(input)?,
            monetary_root: Hash32::decode(input)?,
            eu_used: input.u64()?,
            tx_count: input.u32()?,
            extensions: input.sorted_list(MAX_HEADER_EXTENSIONS)?,
        })
    }
}

/// Transactions in canonical order (Section 22).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockBody {
    pub transactions: Vec<SignedTransaction>,
}

impl AceEncode for BlockBody {
    fn encode(&self, out: &mut AceWriter) {
        out.list(&self.transactions);
    }
}

impl AceDecode for BlockBody {
    fn decode(input: &mut AceReader<'_>) -> Result<BlockBody, AletheiaError> {
        input
            .list(MAX_BLOCK_TXS_DECODE)
            .map(|transactions| BlockBody { transactions })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Block {
    pub header: BlockHeader,
    pub body: BlockBody,
}

impl AceEncode for Block {
    fn encode(&self, out: &mut AceWriter) {
        self.header.encode(out);
        self.body.encode(out);
    }
}

impl AceDecode for Block {
    fn decode(input: &mut AceReader<'_>) -> Result<Block, AletheiaError> {
        Ok(Block {
            header: BlockHeader::decode(input)?,
            body: BlockBody::decode(input)?,
        })
    }
}

/// A proposed block with the proposer's signature over
/// `H_domain("ALETHEIA/PROPOSAL/v1", block_hash)` (§14.3). This is what the archive stores.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Proposal {
    pub block: Block,
    pub proposer_signature: [u8; BLS_SIGNATURE_LEN],
}

impl Proposal {
    /// The digest the proposer signs.
    pub fn signing_digest(network: &NetworkIdentity, block_hash: &Hash32) -> Hash32 {
        network.domain_hash(DomainTag::Proposal, block_hash.as_bytes())
    }
}

impl AceEncode for Proposal {
    fn encode(&self, out: &mut AceWriter) {
        self.block.encode(out);
        out.fixed(&self.proposer_signature);
    }
}

impl AceDecode for Proposal {
    fn decode(input: &mut AceReader<'_>) -> Result<Proposal, AletheiaError> {
        Ok(Proposal {
            block: Block::decode(input)?,
            proposer_signature: input.array()?,
        })
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::network::NetworkKind;
    use proptest::prelude::*;

    pub(crate) fn header() -> BlockHeader {
        BlockHeader {
            version: ProtocolVersion::new(1),
            chain_id: ChainId::new(7771),
            height: Height::new(1),
            epoch: Epoch::new(0),
            slot: Slot::new(1),
            protocol_time_ms: 1_791_331_200_500,
            proposer: ValidatorIndex::new(2),
            parent_hash: Hash32::from_bytes([1; 32]),
            parent_qc: QuorumCertificate::genesis(),
            timeout_cert: None,
            tx_root: Hash32::from_bytes([2; 32]),
            receipt_root: Hash32::from_bytes([3; 32]),
            state_root: Hash32::from_bytes([4; 32]),
            event_root: Hash32::from_bytes([5; 32]),
            validator_set_hash: Hash32::from_bytes([6; 32]),
            next_validator_set_hash: Hash32::from_bytes([6; 32]),
            monetary_root: Hash32::from_bytes([7; 32]),
            eu_used: 0,
            tx_count: 0,
            extensions: Vec::new(),
        }
    }

    fn network() -> NetworkIdentity {
        NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
    }

    #[test]
    fn bitmap_tracks_signers_and_rejects_stray_bits() {
        let mut bitmap = SignerBitmap::new(10).unwrap();
        for index in [0, 3, 9] {
            bitmap.set(ValidatorIndex::new(index)).unwrap();
        }
        assert_eq!(bitmap.count(), 3);
        assert_eq!(
            bitmap
                .signers()
                .map(ValidatorIndex::get)
                .collect::<Vec<_>>(),
            [0, 3, 9]
        );
        assert!(bitmap.set(ValidatorIndex::new(10)).is_err());
        assert_eq!(
            SignerBitmap::from_ace_bytes(&bitmap.to_ace_bytes()),
            Ok(bitmap.clone())
        );

        let mut bytes = bitmap.to_ace_bytes();
        *bytes.last_mut().unwrap() |= 0b0000_0100; // bit 10, beyond len
        assert_eq!(
            SignerBitmap::from_ace_bytes(&bytes).unwrap_err().code(),
            ErrorCode::DecodeNonCanonical
        );
    }

    #[test]
    fn bitmap_larger_than_the_validator_cap_is_refused() {
        let bytes = (MAX_VALIDATORS + 1).to_le_bytes();
        assert_eq!(
            SignerBitmap::from_ace_bytes(&bytes).unwrap_err().code(),
            ErrorCode::DecodeLengthExceeded
        );
    }

    #[test]
    fn timeout_certificate_needs_one_high_qc_round_per_signer() {
        let mut signers = SignerBitmap::new(4).unwrap();
        signers.set(ValidatorIndex::new(1)).unwrap();
        signers.set(ValidatorIndex::new(2)).unwrap();
        let mut tc = TimeoutCertificate {
            round: Slot::new(9),
            epoch: Epoch::new(1),
            signers,
            high_qc_rounds: vec![Slot::new(7), Slot::new(8)],
            aggregate_signature: [0; BLS_SIGNATURE_LEN],
        };
        assert_eq!(
            TimeoutCertificate::from_ace_bytes(&tc.to_ace_bytes()),
            Ok(tc.clone())
        );
        assert_eq!(tc.max_high_qc_round(), Some(Slot::new(8)));
        tc.high_qc_rounds.pop();
        assert_eq!(
            TimeoutCertificate::from_ace_bytes(&tc.to_ace_bytes())
                .unwrap_err()
                .code(),
            ErrorCode::DecodeNonCanonical
        );
    }

    #[test]
    fn header_hash_commits_to_every_field() {
        let base = header();
        let hash = base.block_hash(&network());
        let mut changed = base.clone();
        changed.eu_used = 1;
        assert_ne!(changed.block_hash(&network()), hash);
        let mut changed = base;
        changed.timeout_cert = Some(TimeoutCertificate {
            round: Slot::new(0),
            epoch: Epoch::new(0),
            signers: SignerBitmap::new(0).unwrap(),
            high_qc_rounds: vec![],
            aggregate_signature: [0; BLS_SIGNATURE_LEN],
        });
        assert_ne!(changed.block_hash(&network()), hash);
    }

    #[test]
    fn header_and_block_round_trip() {
        let block = Block {
            header: header(),
            body: BlockBody {
                transactions: vec![crate::tx::tests::signed(crate::tx::tests::transfer_body())],
            },
        };
        assert_eq!(Block::from_ace_bytes(&block.to_ace_bytes()), Ok(block));
    }

    #[test]
    fn unsorted_extensions_do_not_decode() {
        let mut h = header();
        h.extensions = vec![
            ExtensionField {
                id: 2,
                value: vec![],
            },
            ExtensionField {
                id: 1,
                value: vec![],
            },
        ];
        assert_eq!(
            BlockHeader::from_ace_bytes(&h.to_ace_bytes())
                .unwrap_err()
                .code(),
            ErrorCode::DecodeNonCanonical
        );
    }

    #[test]
    fn vote_digest_binds_round_block_and_epoch() {
        let n = network();
        let block = Hash32::from_bytes([1; 32]);
        let base = QuorumCertificate::vote_digest(&n, Slot::new(5), &block, Epoch::new(1));
        assert_ne!(
            base,
            QuorumCertificate::vote_digest(&n, Slot::new(6), &block, Epoch::new(1))
        );
        assert_ne!(
            base,
            QuorumCertificate::vote_digest(&n, Slot::new(5), &Hash32::ZERO, Epoch::new(1))
        );
        assert_ne!(
            base,
            QuorumCertificate::vote_digest(&n, Slot::new(5), &block, Epoch::new(2))
        );
    }

    proptest! {
        #[test]
        fn header_bytes_that_decode_re_encode_identically(flip in 0usize..400, value: u8) {
            let mut bytes = header().to_ace_bytes();
            if let Some(byte) = bytes.get_mut(flip) {
                *byte = value;
            }
            if let Ok(decoded) = BlockHeader::from_ace_bytes(&bytes) {
                prop_assert_eq!(decoded.to_ace_bytes(), bytes);
            }
        }
    }
}
