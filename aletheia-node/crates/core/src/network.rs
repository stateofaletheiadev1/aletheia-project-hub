//! Network and chain identity, and domain-separated hashing (APS-0001, Appendix R.1).
//!
//! Every protocol hash and signed digest is
//!
//! ```text
//! H_domain(tag, msg) = BLAKE3( u8(len(tag)) || tag || u32_le(chain_id) || u8(network_kind) || msg )
//! ```
//!
//! Because `chain_id` and `network_kind` sit inside every digest, a signature made for one
//! network is invalid on every other: cross-network replay is structurally impossible.
//!
//! Domain hashing lives in `core` rather than `crypto` because the tag registry and the
//! identity fields are protocol definitions (ADR-037).

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::types::Hash32;

/// Chain identifier, fixed at genesis. Distinct per network instance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ChainId(u32);

impl ChainId {
    pub const fn new(value: u32) -> ChainId {
        ChainId(value)
    }

    pub const fn get(self) -> u32 {
        self.0
    }
}

impl core::fmt::Display for ChainId {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        self.0.fmt(f)
    }
}

impl AceEncode for ChainId {
    fn encode(&self, out: &mut AceWriter) {
        out.u32(self.0);
    }

    fn encoded_len_hint(&self) -> usize {
        4
    }
}

impl AceDecode for ChainId {
    fn decode(input: &mut AceReader<'_>) -> Result<ChainId, AletheiaError> {
        input.u32().map(ChainId)
    }
}

/// The kind of network. The byte value and the checksum HRP are protocol (Section 10).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum NetworkKind {
    Mainnet,
    PrivateValidation,
    Devnet,
    Regtest,
}

impl NetworkKind {
    pub const ALL: [NetworkKind; 4] = [
        NetworkKind::Mainnet,
        NetworkKind::PrivateValidation,
        NetworkKind::Devnet,
        NetworkKind::Regtest,
    ];

    pub const fn code(self) -> u8 {
        match self {
            NetworkKind::Mainnet => 1,
            NetworkKind::PrivateValidation => 2,
            NetworkKind::Devnet => 3,
            NetworkKind::Regtest => 4,
        }
    }

    pub fn from_code(code: u8) -> Result<NetworkKind, AletheiaError> {
        match code {
            1 => Ok(NetworkKind::Mainnet),
            2 => Ok(NetworkKind::PrivateValidation),
            3 => Ok(NetworkKind::Devnet),
            4 => Ok(NetworkKind::Regtest),
            other => Err(AletheiaError::new(
                ErrorCode::NetworkKindUnknown,
                format!("network kind {other} is not registered (expected 1-4)"),
            )),
        }
    }

    /// Bech32m human-readable part for addresses on this network. It is never displayed;
    /// it only seeds the checksum, so text copied from one network fails on another.
    pub const fn address_hrp(self) -> &'static str {
        match self {
            NetworkKind::Mainnet => "al",
            NetworkKind::PrivateValidation => "alt",
            NetworkKind::Devnet => "ald",
            NetworkKind::Regtest => "alr",
        }
    }

    /// Development plaintext keys are permitted only on these networks (Section 19.2).
    pub const fn allows_development_keys(self) -> bool {
        matches!(self, NetworkKind::Devnet | NetworkKind::Regtest)
    }
}

impl core::fmt::Display for NetworkKind {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str(match self {
            NetworkKind::Mainnet => "mainnet",
            NetworkKind::PrivateValidation => "private-validation",
            NetworkKind::Devnet => "devnet",
            NetworkKind::Regtest => "regtest",
        })
    }
}

impl AceEncode for NetworkKind {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.code());
    }

    fn encoded_len_hint(&self) -> usize {
        1
    }
}

impl AceDecode for NetworkKind {
    fn decode(input: &mut AceReader<'_>) -> Result<NetworkKind, AletheiaError> {
        let offset = input.position();
        let code = input.u8()?;
        // Inside an ACE value an unknown tag is a decode error (APS-0041 rule 5); the
        // network-specific code is kept in the detail for diagnosis.
        NetworkKind::from_code(code).map_err(|error| {
            AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!("at offset {offset}: {}", error.detail()),
            )
        })
    }
}

/// Registered domain tags (Section 10). Extending this list requires an APS-0001 update.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum DomainTag {
    TxId,
    TxWitness,
    TxSignature,
    Block,
    Vote,
    Timeout,
    Proposal,
    BlsProofOfPossession,
    Address,
    StateKey,
    JmtLeaf,
    JmtNode,
    MerkleLeaf,
    MerkleNode,
    Order,
    MintAuthorization,
    Genesis,
    BlockId,
    BridgeMessage,
    BridgeAttestation,
    Receipt,
    Event,
    WriteSet,
    P2pHandshake,
    ValidatorSet,
    ReserveAttestation,
    Redemption,
    ParcelTransfer,
    GovernanceProposal,
    PaymentDedup,
    PaymentRequest,
    Mandate,
    ScheduledPayment,
    StandingAuthorization,
    BridgeControl,
}

impl DomainTag {
    pub const ALL: [DomainTag; 35] = [
        DomainTag::TxId,
        DomainTag::TxWitness,
        DomainTag::TxSignature,
        DomainTag::Block,
        DomainTag::Vote,
        DomainTag::Timeout,
        DomainTag::Proposal,
        DomainTag::BlsProofOfPossession,
        DomainTag::Address,
        DomainTag::StateKey,
        DomainTag::JmtLeaf,
        DomainTag::JmtNode,
        DomainTag::MerkleLeaf,
        DomainTag::MerkleNode,
        DomainTag::Order,
        DomainTag::MintAuthorization,
        DomainTag::Genesis,
        DomainTag::BlockId,
        DomainTag::BridgeMessage,
        DomainTag::BridgeAttestation,
        DomainTag::Receipt,
        DomainTag::Event,
        DomainTag::WriteSet,
        DomainTag::P2pHandshake,
        DomainTag::ValidatorSet,
        DomainTag::ReserveAttestation,
        DomainTag::Redemption,
        DomainTag::ParcelTransfer,
        DomainTag::GovernanceProposal,
        DomainTag::PaymentDedup,
        DomainTag::PaymentRequest,
        DomainTag::Mandate,
        DomainTag::ScheduledPayment,
        DomainTag::StandingAuthorization,
        DomainTag::BridgeControl,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            DomainTag::TxId => "ALETHEIA/TXID/v1",
            DomainTag::TxWitness => "ALETHEIA/TXWIT/v1",
            DomainTag::TxSignature => "ALETHEIA/TXSIG/v1",
            DomainTag::Block => "ALETHEIA/BLOCK/v1",
            DomainTag::Vote => "ALETHEIA/VOTE/v1",
            DomainTag::Timeout => "ALETHEIA/TIMEOUT/v1",
            DomainTag::Proposal => "ALETHEIA/PROPOSAL/v1",
            DomainTag::BlsProofOfPossession => "ALETHEIA/BLS-POP/v1",
            DomainTag::Address => "ALETHEIA/ADDR/v1",
            DomainTag::StateKey => "ALETHEIA/STATEKEY/v1",
            DomainTag::JmtLeaf => "ALETHEIA/JMT-LEAF/v1",
            DomainTag::JmtNode => "ALETHEIA/JMT-NODE/v1",
            DomainTag::MerkleLeaf => "ALETHEIA/MERKLE-LEAF/v1",
            DomainTag::MerkleNode => "ALETHEIA/MERKLE-NODE/v1",
            DomainTag::Order => "ALETHEIA/ORDER/v1",
            DomainTag::MintAuthorization => "ALETHEIA/MINTAUTH/v1",
            DomainTag::Genesis => "ALETHEIA/GENESIS/v1",
            DomainTag::BlockId => "ALETHEIA/BLOCKID/v1",
            DomainTag::BridgeMessage => "ALETHEIA/BRIDGE-MSG/v1",
            DomainTag::BridgeAttestation => "ALETHEIA/BRIDGE-ATTEST/v1",
            // Added in implementation (ERRATA E-17): Section 38 hashes receipts with an unnamed tag.
            DomainTag::Receipt => "ALETHEIA/RECEIPT/v1",
            DomainTag::Event => "ALETHEIA/EVENT/v1",
            DomainTag::WriteSet => "ALETHEIA/WRITESET/v1",
            // ERRATA E-19: the signed P2P handshake of Section 36 needs its own domain.
            DomainTag::P2pHandshake => "ALETHEIA/P2P-HANDSHAKE/v1",
            // ERRATA E-20: headers commit to validator_set_hash; the hash needs a domain.
            DomainTag::ValidatorSet => "ALETHEIA/VALSET/v1",
            DomainTag::ReserveAttestation => "ALETHEIA/RESERVE-ATTEST/v1",
            DomainTag::Redemption => "ALETHEIA/REDEEM/v1",
            DomainTag::ParcelTransfer => "ALETHEIA/PARCEL-TRANSFER/v1",
            DomainTag::GovernanceProposal => "ALETHEIA/GOV-PROPOSAL/v1",
            DomainTag::PaymentDedup => "ALETHEIA/PAYDEDUP/v1",
            DomainTag::PaymentRequest => "ALETHEIA/APN-REQUEST/v1",
            DomainTag::Mandate => "ALETHEIA/APN-MANDATE/v1",
            DomainTag::ScheduledPayment => "ALETHEIA/APN-SCHEDULE/v1",
            DomainTag::StandingAuthorization => "ALETHEIA/APN-STANDING/v1",
            DomainTag::BridgeControl => "ALETHEIA/BRIDGE-CONTROL/v1",
        }
    }

    /// The `u8(len(tag))` prefix byte. Every registered tag is far below 255 bytes
    /// (`tags_fit_in_one_length_byte` checks the whole registry), so the fallback is dead.
    fn length_byte(self) -> u8 {
        u8::try_from(self.as_str().len()).unwrap_or(u8::MAX)
    }
}

/// The fields that bind a hash or signature to one network instance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct NetworkIdentity {
    chain_id: ChainId,
    network_kind: NetworkKind,
    genesis_id: Hash32,
}

impl NetworkIdentity {
    pub const fn new(
        chain_id: ChainId,
        network_kind: NetworkKind,
        genesis_id: Hash32,
    ) -> NetworkIdentity {
        NetworkIdentity {
            chain_id,
            network_kind,
            genesis_id,
        }
    }

    pub const fn chain_id(&self) -> ChainId {
        self.chain_id
    }

    pub const fn network_kind(&self) -> NetworkKind {
        self.network_kind
    }

    /// BLAKE3 of the canonical genesis configuration (APS-0035). Not part of `H_domain`; it
    /// is checked at handshake and when opening a data directory.
    pub const fn genesis_id(&self) -> Hash32 {
        self.genesis_id
    }

    /// `H_domain(tag, message)` for this network.
    pub fn domain_hash(&self, tag: DomainTag, message: &[u8]) -> Hash32 {
        let mut hasher = self.domain_hasher(tag);
        hasher.update(message);
        hasher.finalize()
    }

    /// Incremental form of [`NetworkIdentity::domain_hash`], for messages assembled from parts.
    pub fn domain_hasher(&self, tag: DomainTag) -> DomainHasher {
        let mut inner = blake3::Hasher::new();
        inner.update(&[tag.length_byte()]);
        inner.update(tag.as_str().as_bytes());
        inner.update(&self.chain_id.get().to_le_bytes());
        inner.update(&[self.network_kind.code()]);
        DomainHasher { inner }
    }
}

/// A BLAKE3 hasher already primed with a domain prefix.
#[derive(Debug, Clone)]
pub struct DomainHasher {
    inner: blake3::Hasher,
}

impl DomainHasher {
    pub fn update(&mut self, bytes: &[u8]) -> &mut DomainHasher {
        self.inner.update(bytes);
        self
    }

    pub fn finalize(&self) -> Hash32 {
        Hash32::from_bytes(*self.inner.finalize().as_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    fn devnet() -> NetworkIdentity {
        NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
    }

    #[test]
    fn domain_hash_matches_the_normative_formula() {
        let tag = "ALETHEIA/TXID/v1";
        let mut preimage = vec![u8::try_from(tag.len()).unwrap()];
        preimage.extend_from_slice(tag.as_bytes());
        preimage.extend_from_slice(&7771u32.to_le_bytes());
        preimage.push(3);
        preimage.extend_from_slice(b"body");
        let expected = Hash32::from_bytes(*blake3::hash(&preimage).as_bytes());
        assert_eq!(devnet().domain_hash(DomainTag::TxId, b"body"), expected);
    }

    #[test]
    fn same_message_differs_across_networks_and_tags() {
        let mainnet = NetworkIdentity::new(ChainId::new(7771), NetworkKind::Mainnet, Hash32::ZERO);
        let other_chain =
            NetworkIdentity::new(ChainId::new(7772), NetworkKind::Devnet, Hash32::ZERO);
        let base = devnet().domain_hash(DomainTag::TxId, b"m");
        assert_ne!(base, mainnet.domain_hash(DomainTag::TxId, b"m"));
        assert_ne!(base, other_chain.domain_hash(DomainTag::TxId, b"m"));
        assert_ne!(base, devnet().domain_hash(DomainTag::TxSignature, b"m"));
    }

    #[test]
    fn incremental_hashing_equals_one_shot() {
        let mut hasher = devnet().domain_hasher(DomainTag::Block);
        hasher.update(b"head").update(b"er");
        assert_eq!(
            hasher.finalize(),
            devnet().domain_hash(DomainTag::Block, b"header")
        );
    }

    #[test]
    fn tags_are_unique_and_versioned() {
        let tags: BTreeSet<&str> = DomainTag::ALL.iter().map(|t| t.as_str()).collect();
        assert_eq!(tags.len(), DomainTag::ALL.len());
        assert!(
            tags.iter()
                .all(|t| t.starts_with("ALETHEIA/") && t.ends_with("/v1"))
        );
    }

    #[test]
    fn tags_fit_in_one_length_byte() {
        assert!(DomainTag::ALL.iter().all(|tag| tag.as_str().len() < 255));
    }

    #[test]
    fn network_kind_codes_and_hrps_follow_section_10() {
        let table: Vec<(u8, &str)> = NetworkKind::ALL
            .iter()
            .map(|k| (k.code(), k.address_hrp()))
            .collect();
        assert_eq!(table, [(1, "al"), (2, "alt"), (3, "ald"), (4, "alr")]);
        for kind in NetworkKind::ALL {
            assert_eq!(NetworkKind::from_code(kind.code()), Ok(kind));
        }
        assert_eq!(
            NetworkKind::from_code(0).unwrap_err().code(),
            ErrorCode::NetworkKindUnknown
        );
        assert_eq!(
            NetworkKind::from_ace_bytes(&[5]).unwrap_err().code(),
            ErrorCode::DecodeNonCanonical
        );
    }

    #[test]
    fn only_devnet_and_regtest_allow_development_keys() {
        let allowed: Vec<NetworkKind> = NetworkKind::ALL
            .into_iter()
            .filter(|k| k.allows_development_keys())
            .collect();
        assert_eq!(allowed, [NetworkKind::Devnet, NetworkKind::Regtest]);
    }
}
