//! The block lifecycle state machine (spec Section 19.7).
//!
//! ```text
//! PROPOSED ─validate─▶ VALIDATED ─execute─▶ EXECUTED ─vote─▶ ATTESTED ─QC─▶ QUORUM-CERTIFIED ─2-chain─▶ FINALIZED
//!    └─invalid─▶ REJECTED          └─mismatch─▶ REJECTED                         └─ sibling finalized ─▶ DISCARDED
//! ```
//!
//! Legal transitions are exactly the arrows (plus a QC observed for a block this node did not
//! vote on, which skips ATTESTED, and discarding any block not yet finalized when a sibling
//! is). Anything else is a programming error and fail-stop. FINALIZED is terminal.

use aletheia_core::{AletheiaError, ErrorCode};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum BlockState {
    Proposed,
    Validated,
    Executed,
    Attested,
    QuorumCertified,
    Finalized,
    Rejected,
    Discarded,
}

impl BlockState {
    pub const ALL: [BlockState; 8] = [
        BlockState::Proposed,
        BlockState::Validated,
        BlockState::Executed,
        BlockState::Attested,
        BlockState::QuorumCertified,
        BlockState::Finalized,
        BlockState::Rejected,
        BlockState::Discarded,
    ];

    pub fn allows(self, to: BlockState) -> bool {
        use BlockState::{
            Attested, Discarded, Executed, Finalized, Proposed, QuorumCertified, Rejected,
            Validated,
        };
        matches!(
            (self, to),
            (Proposed, Validated | Rejected | Discarded)
                | (Validated, Executed | Rejected | Discarded)
                | (Executed, Attested | QuorumCertified | Discarded)
                | (Attested, QuorumCertified | Discarded)
                | (QuorumCertified, Finalized | Discarded)
        )
    }

    pub fn transition(self, to: BlockState) -> Result<BlockState, AletheiaError> {
        if self.allows(to) {
            Ok(to)
        } else {
            Err(AletheiaError::new(
                ErrorCode::FinalizeOutOfOrder,
                format!("illegal block transition {self:?} -> {to:?}"),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use BlockState::*;

    #[test]
    fn every_pair_is_legal_exactly_when_the_diagram_has_the_arrow() {
        let legal = [
            (Proposed, Validated),
            (Proposed, Rejected),
            (Proposed, Discarded),
            (Validated, Executed),
            (Validated, Rejected),
            (Validated, Discarded),
            (Executed, Attested),
            (Executed, QuorumCertified),
            (Executed, Discarded),
            (Attested, QuorumCertified),
            (Attested, Discarded),
            (QuorumCertified, Finalized),
            (QuorumCertified, Discarded),
        ];
        for from in BlockState::ALL {
            for to in BlockState::ALL {
                assert_eq!(
                    from.allows(to),
                    legal.contains(&(from, to)),
                    "{from:?} -> {to:?}"
                );
            }
        }
    }

    #[test]
    fn finalized_is_terminal_and_irreversible() {
        for to in BlockState::ALL {
            assert!(Finalized.transition(to).is_err(), "finalized -> {to:?}");
        }
        assert!(Finalized.transition(Discarded).unwrap_err().is_fail_stop());
    }
}
