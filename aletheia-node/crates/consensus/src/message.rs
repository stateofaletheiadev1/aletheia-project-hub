//! Consensus messages (spec Sections 14.3, 19.3, 19.5). Every signature covers a domain digest
//! bound to the network, the round and the epoch, so no message can be replayed into another
//! network, round or epoch.
//!
//! ```text
//! Vote     = round u64 | block_hash Hash32 | epoch u64 | voter u16 | signature [96]
//!            signs H_domain("ALETHEIA/VOTE/v1", ace(round, block_hash, epoch))
//! Timeout  = round u64 | epoch u64 | high_qc QuorumCertificate | voter u16 | signature [96]
//!            signs H_domain("ALETHEIA/TIMEOUT/v1", ace(round, epoch, high_qc.round))
//! Proposal = core::block::Proposal, proposer signs H_domain("ALETHEIA/PROPOSAL/v1", block_hash)
//! ```

use aletheia_core::block::{BLS_SIGNATURE_LEN, Proposal, QuorumCertificate, TimeoutCertificate};
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, Epoch, ErrorCode, Hash32,
    NetworkIdentity, Slot, ValidatorIndex,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Vote {
    pub round: Slot,
    pub block_hash: Hash32,
    pub epoch: Epoch,
    pub voter: ValidatorIndex,
    pub signature: [u8; BLS_SIGNATURE_LEN],
}

impl Vote {
    pub fn digest(&self, network: &NetworkIdentity) -> Hash32 {
        QuorumCertificate::vote_digest(network, self.round, &self.block_hash, self.epoch)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Timeout {
    pub round: Slot,
    pub epoch: Epoch,
    /// The highest QC the voter holds: lets the next leader extend the highest certified block.
    pub high_qc: QuorumCertificate,
    pub voter: ValidatorIndex,
    pub signature: [u8; BLS_SIGNATURE_LEN],
}

impl Timeout {
    pub fn digest(&self, network: &NetworkIdentity) -> Hash32 {
        TimeoutCertificate::timeout_digest(network, self.round, self.epoch, self.high_qc.round)
    }
}

/// What travels on the consensus channel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConsensusMessage {
    Proposal(Box<Proposal>),
    Vote(Vote),
    Timeout(Box<Timeout>),
    /// A freshly formed certificate, relayed so peers that missed votes can advance.
    QuorumCertificate(Box<QuorumCertificate>),
    TimeoutCertificate(Box<TimeoutCertificate>),
}

impl ConsensusMessage {
    /// `msg_type` on the consensus channel.
    pub const fn msg_type(&self) -> u16 {
        match self {
            ConsensusMessage::Proposal(_) => 1,
            ConsensusMessage::Vote(_) => 2,
            ConsensusMessage::Timeout(_) => 3,
            ConsensusMessage::QuorumCertificate(_) => 4,
            ConsensusMessage::TimeoutCertificate(_) => 5,
        }
    }

    pub fn round(&self) -> Slot {
        match self {
            ConsensusMessage::Proposal(proposal) => proposal.block.header.slot,
            ConsensusMessage::Vote(vote) => vote.round,
            ConsensusMessage::Timeout(timeout) => timeout.round,
            ConsensusMessage::QuorumCertificate(qc) => qc.round,
            ConsensusMessage::TimeoutCertificate(tc) => tc.round,
        }
    }

    pub fn encode_payload(&self) -> Vec<u8> {
        match self {
            ConsensusMessage::Proposal(proposal) => proposal.to_ace_bytes(),
            ConsensusMessage::Vote(vote) => vote.to_ace_bytes(),
            ConsensusMessage::Timeout(timeout) => timeout.to_ace_bytes(),
            ConsensusMessage::QuorumCertificate(qc) => qc.to_ace_bytes(),
            ConsensusMessage::TimeoutCertificate(tc) => tc.to_ace_bytes(),
        }
    }

    pub fn decode(msg_type: u16, payload: &[u8]) -> Result<ConsensusMessage, AletheiaError> {
        Ok(match msg_type {
            1 => ConsensusMessage::Proposal(Box::new(Proposal::from_ace_bytes(payload)?)),
            2 => ConsensusMessage::Vote(Vote::from_ace_bytes(payload)?),
            3 => ConsensusMessage::Timeout(Box::new(Timeout::from_ace_bytes(payload)?)),
            4 => ConsensusMessage::QuorumCertificate(Box::new(QuorumCertificate::from_ace_bytes(
                payload,
            )?)),
            5 => ConsensusMessage::TimeoutCertificate(Box::new(
                TimeoutCertificate::from_ace_bytes(payload)?,
            )),
            other => {
                return Err(AletheiaError::new(
                    ErrorCode::P2pMalformedMessage,
                    format!("consensus message type {other} is not defined"),
                ));
            }
        })
    }
}

impl AceEncode for Vote {
    fn encode(&self, out: &mut AceWriter) {
        self.round.encode(out);
        self.block_hash.encode(out);
        self.epoch.encode(out);
        self.voter.encode(out);
        out.fixed(&self.signature);
    }
}

impl AceDecode for Vote {
    fn decode(input: &mut AceReader<'_>) -> Result<Vote, AletheiaError> {
        Ok(Vote {
            round: Slot::decode(input)?,
            block_hash: Hash32::decode(input)?,
            epoch: Epoch::decode(input)?,
            voter: ValidatorIndex::decode(input)?,
            signature: input.array()?,
        })
    }
}

impl AceEncode for Timeout {
    fn encode(&self, out: &mut AceWriter) {
        self.round.encode(out);
        self.epoch.encode(out);
        self.high_qc.encode(out);
        self.voter.encode(out);
        out.fixed(&self.signature);
    }
}

impl AceDecode for Timeout {
    fn decode(input: &mut AceReader<'_>) -> Result<Timeout, AletheiaError> {
        Ok(Timeout {
            round: Slot::decode(input)?,
            epoch: Epoch::decode(input)?,
            high_qc: QuorumCertificate::decode(input)?,
            voter: ValidatorIndex::decode(input)?,
            signature: input.array()?,
        })
    }
}
