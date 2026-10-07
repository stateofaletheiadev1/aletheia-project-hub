//! Finality proofs and evidence (spec Sections 14.3, 19.5, 19.8).
//!
//! ```text
//! FinalityProof = block_hash | qc(block) | qc(child) | child_header      (2-chain, Section 14.3)
//! ```
//!
//! Block B is final when C extends it in the very next round and C is certified: `qc(block)`
//! is C's parent QC and `qc(child)` certifies C. A verifier checks both certificates against
//! the epoch's validator set, that C's header names B as parent with `qc(block)` as its parent
//! QC, and that C's round is B's plus one.

use aletheia_core::block::{BlockHeader, Proposal, QuorumCertificate};
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32, NetworkIdentity,
};

use crate::certificate::verify_qc;
use crate::message::Vote;
use crate::validator_set::ValidatorSet;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinalityProof {
    pub block_hash: Hash32,
    pub qc_block: QuorumCertificate,
    pub qc_child: QuorumCertificate,
    pub child_header: BlockHeader,
}

impl FinalityProof {
    pub fn verify(
        &self,
        network: &NetworkIdentity,
        set: &ValidatorSet,
    ) -> Result<(), AletheiaError> {
        let fail = |detail: &str| {
            AletheiaError::new(
                ErrorCode::ProofInvalid,
                format!("finality proof for {}: {detail}", self.block_hash),
            )
        };
        if self.qc_block.block_hash != self.block_hash
            || self.child_header.parent_hash != self.block_hash
        {
            return Err(fail("the child does not extend the block"));
        }
        if self.child_header.parent_qc != self.qc_block {
            return Err(fail("the child's parent QC is not the block's QC"));
        }
        if self.qc_child.block_hash != self.child_header.block_hash(network)
            || self.qc_child.round != self.child_header.slot
        {
            return Err(fail("the child QC does not certify the child"));
        }
        if self.qc_block.round.next().ok() != Some(self.qc_child.round) {
            return Err(fail("the child is not in the round right after the block"));
        }
        verify_qc(network, set, &self.qc_block)?;
        verify_qc(network, set, &self.qc_child)
    }
}

impl AceEncode for FinalityProof {
    fn encode(&self, out: &mut AceWriter) {
        self.block_hash.encode(out);
        self.qc_block.encode(out);
        self.qc_child.encode(out);
        self.child_header.encode(out);
    }
}

impl AceDecode for FinalityProof {
    fn decode(input: &mut AceReader<'_>) -> Result<FinalityProof, AletheiaError> {
        Ok(FinalityProof {
            block_hash: Hash32::decode(input)?,
            qc_block: QuorumCertificate::decode(input)?,
            qc_child: QuorumCertificate::decode(input)?,
            child_header: BlockHeader::decode(input)?,
        })
    }
}

/// Provable misbehaviour (19.8). Equivocations carry both signed messages, so anyone can
/// verify them on-chain; an invalid proposal is recorded locally and the slot times out.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Evidence {
    VoteEquivocation {
        first: Box<Vote>,
        second: Box<Vote>,
    },
    ProposalEquivocation {
        first: Box<Proposal>,
        second: Box<Proposal>,
    },
    InvalidProposal {
        block_hash: Hash32,
        proposer: aletheia_core::ValidatorIndex,
        reason: String,
    },
    /// Two valid QCs for different blocks in one round: more than F validators equivocated.
    ConflictingCertificates {
        first: Box<QuorumCertificate>,
        second: Box<QuorumCertificate>,
    },
}
