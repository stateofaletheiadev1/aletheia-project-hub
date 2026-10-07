//! An epoch's active validator set (spec Section 19.1).
//!
//! v0.1 validators have equal weight. `N` members tolerate `F = ⌊(N − 1) / 3⌋` Byzantine ones
//! and a quorum is `Q = N − F` (ERRATA E-21): any two quorums share at least `F + 1`
//! validators, so at least one honest one, which is what makes two conflicting certificates
//! for the same round impossible without more than `F` faults.

use aletheia_core::block::MAX_VALIDATORS;
use aletheia_core::{
    AceEncode, AceWriter, AletheiaError, DomainTag, Epoch, ErrorCode, Hash32, NetworkIdentity,
    ValidatorIndex,
};
use aletheia_crypto::ProvenBlsPublicKey;

/// One member, at the position given by its validator index.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatorInfo {
    /// Proof of possession verified at registration; only such keys can be aggregated.
    pub consensus_key: ProvenBlsPublicKey,
    /// Ed25519 P2P identity, pinned in the handshake.
    pub node_key: [u8; 32],
    /// 1 in v0.1; reserved for stake weighting.
    pub voting_power: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatorSet {
    epoch: Epoch,
    members: Vec<ValidatorInfo>,
}

impl ValidatorSet {
    pub fn new(epoch: Epoch, members: Vec<ValidatorInfo>) -> Result<ValidatorSet, AletheiaError> {
        if members.is_empty() || members.len() > usize::from(MAX_VALIDATORS) {
            return Err(AletheiaError::new(
                ErrorCode::DecodeLengthExceeded,
                format!(
                    "a validator set has 1..={MAX_VALIDATORS} members, got {}",
                    members.len()
                ),
            ));
        }
        Ok(ValidatorSet { epoch, members })
    }

    pub fn epoch(&self) -> Epoch {
        self.epoch
    }

    /// `N`.
    pub fn len(&self) -> u16 {
        u16::try_from(self.members.len()).unwrap_or(MAX_VALIDATORS)
    }

    pub fn is_empty(&self) -> bool {
        self.members.is_empty()
    }

    /// `F = ⌊(N − 1) / 3⌋`.
    pub fn max_faulty(&self) -> u16 {
        self.len().saturating_sub(1) / 3
    }

    /// `Q = N − F`.
    pub fn quorum(&self) -> u16 {
        self.len().saturating_sub(self.max_faulty())
    }

    pub fn member(&self, index: ValidatorIndex) -> Option<&ValidatorInfo> {
        self.members.get(usize::from(index.get()))
    }

    pub fn members(&self) -> &[ValidatorInfo] {
        &self.members
    }

    /// The index of the validator with this node key, if it is a member.
    pub fn index_of(&self, node_key: &[u8; 32]) -> Option<ValidatorIndex> {
        self.members
            .iter()
            .position(|member| &member.node_key == node_key)
            .and_then(|position| u16::try_from(position).ok())
            .map(ValidatorIndex::new)
    }

    /// `validator_set_hash` (ERRATA E-20).
    pub fn hash(&self, network: &NetworkIdentity) -> Hash32 {
        let mut out = AceWriter::new();
        self.epoch.encode(&mut out);
        out.u32(u32::try_from(self.members.len()).unwrap_or(u32::MAX));
        for member in &self.members {
            out.fixed(&member.consensus_key.to_bytes());
            out.fixed(&member.node_key);
            out.u64(member.voting_power);
        }
        network.domain_hash(DomainTag::ValidatorSet, out.as_bytes())
    }
}
