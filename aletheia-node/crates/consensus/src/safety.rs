//! The safety core (spec Section 19.5, Appendix R.11).
//!
//! ```text
//! SafetyData { epoch, last_voted_round, preferred_round, highest_qc_round, last_timeout_round }
//! vote for B in round r iff
//!   V1 B validates and re-execution reproduces its roots          (checked by the caller)
//!   V2 r > last_voted_round
//!   V3 r > last_timeout_round
//!   V4 B.parent_qc.round + 1 == r
//!      or B.timeout_cert.round + 1 == r and B.parent_qc.round >= max(TC.high_qc_rounds)
//!   V5 B.parent_qc.round >= preferred_round
//! lock update on a QC for P: preferred_round = max(preferred_round, P.parent_qc.round)
//! ```
//!
//! Every decision that changes `SafetyData` returns the new value; the caller makes it durable
//! (consensus WAL, synced) **before** sending the vote or timeout it authorizes. A restored
//! node merges WAL and signer state by taking the maximum of each round, never lowering one.

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, Epoch, ErrorCode, Slot,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SafetyData {
    pub epoch: Epoch,
    pub last_voted_round: Slot,
    pub preferred_round: Slot,
    pub highest_qc_round: Slot,
    pub last_timeout_round: Slot,
}

impl SafetyData {
    pub fn genesis(epoch: Epoch) -> SafetyData {
        SafetyData {
            epoch,
            last_voted_round: Slot::new(0),
            preferred_round: Slot::new(0),
            highest_qc_round: Slot::new(0),
            last_timeout_round: Slot::new(0),
        }
    }

    /// Recovery (Section 24.3 step 8): field-wise maximum, so restoring an older copy can never
    /// re-open a round this validator already voted or timed out in.
    pub fn max_merge(&self, other: &SafetyData) -> SafetyData {
        SafetyData {
            epoch: self.epoch.max(other.epoch),
            last_voted_round: self.last_voted_round.max(other.last_voted_round),
            preferred_round: self.preferred_round.max(other.preferred_round),
            highest_qc_round: self.highest_qc_round.max(other.highest_qc_round),
            last_timeout_round: self.last_timeout_round.max(other.last_timeout_round),
        }
    }
}

/// Why a vote was refused. Not errors: refusing is the rule working.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VoteRefusal {
    /// V2: already voted in this round or a later one.
    AlreadyVoted { last_voted_round: Slot },
    /// V3: already timed out in this round or a later one.
    TimedOut { last_timeout_round: Slot },
    /// V4: the proposal neither extends the previous round's QC nor is justified by a TC.
    NotJustified,
    /// V5: the parent QC is older than the locked (preferred) round.
    BelowLock { preferred_round: Slot },
}

/// The proposal facts the voting rule looks at.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProposalFacts {
    pub round: Slot,
    pub parent_qc_round: Slot,
    /// `(tc.round, max(tc.high_qc_rounds))` when the header carries a timeout certificate.
    pub timeout_cert: Option<(Slot, Slot)>,
}

/// One validator's safety rules. Owned by the consensus thread alone.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SafetyRules {
    data: SafetyData,
}

fn next(round: Slot) -> Option<Slot> {
    round.next().ok()
}

impl SafetyRules {
    pub fn new(data: SafetyData) -> SafetyRules {
        SafetyRules { data }
    }

    pub fn data(&self) -> SafetyData {
        self.data
    }

    /// V2-V5. On success returns the safety data to persist before the vote is sent.
    pub fn vote(&mut self, proposal: ProposalFacts) -> Result<SafetyData, VoteRefusal> {
        let r = proposal.round;
        if r <= self.data.last_voted_round {
            return Err(VoteRefusal::AlreadyVoted {
                last_voted_round: self.data.last_voted_round,
            });
        }
        if r <= self.data.last_timeout_round {
            return Err(VoteRefusal::TimedOut {
                last_timeout_round: self.data.last_timeout_round,
            });
        }
        let extends_qc = next(proposal.parent_qc_round) == Some(r);
        let justified_by_tc = proposal
            .timeout_cert
            .is_some_and(|(tc_round, max_high_qc)| {
                next(tc_round) == Some(r) && proposal.parent_qc_round >= max_high_qc
            });
        if !(extends_qc || justified_by_tc) {
            return Err(VoteRefusal::NotJustified);
        }
        if proposal.parent_qc_round < self.data.preferred_round {
            return Err(VoteRefusal::BelowLock {
                preferred_round: self.data.preferred_round,
            });
        }
        self.data.last_voted_round = r;
        Ok(self.data)
    }

    /// Lock update on observing a valid QC for a block whose own parent QC has round
    /// `certified_parent_qc_round`. Returns the new data when anything changed.
    pub fn observe_qc(
        &mut self,
        qc_round: Slot,
        certified_parent_qc_round: Slot,
    ) -> Option<SafetyData> {
        let before = self.data;
        self.data.preferred_round = self.data.preferred_round.max(certified_parent_qc_round);
        self.data.highest_qc_round = self.data.highest_qc_round.max(qc_round);
        (self.data != before).then_some(self.data)
    }

    /// Signs a timeout for `round`: afterwards this validator never votes in it (V3). Refused
    /// for rounds at or below one already timed out, so a timeout is never signed twice.
    pub fn timeout(&mut self, round: Slot) -> Result<SafetyData, AletheiaError> {
        if round <= self.data.last_timeout_round {
            return Err(AletheiaError::new(
                ErrorCode::SigInvalid,
                format!(
                    "already timed out in round {} (asked for {round})",
                    self.data.last_timeout_round
                ),
            ));
        }
        self.data.last_timeout_round = round;
        Ok(self.data)
    }
}

impl AceEncode for SafetyData {
    fn encode(&self, out: &mut AceWriter) {
        self.epoch.encode(out);
        self.last_voted_round.encode(out);
        self.preferred_round.encode(out);
        self.highest_qc_round.encode(out);
        self.last_timeout_round.encode(out);
    }
}

impl AceDecode for SafetyData {
    fn decode(input: &mut AceReader<'_>) -> Result<SafetyData, AletheiaError> {
        Ok(SafetyData {
            epoch: Epoch::decode(input)?,
            last_voted_round: Slot::decode(input)?,
            preferred_round: Slot::decode(input)?,
            highest_qc_round: Slot::decode(input)?,
            last_timeout_round: Slot::decode(input)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rules() -> SafetyRules {
        SafetyRules::new(SafetyData::genesis(Epoch::new(0)))
    }

    fn facts(round: u64, parent_qc_round: u64, tc: Option<(u64, u64)>) -> ProposalFacts {
        ProposalFacts {
            round: Slot::new(round),
            parent_qc_round: Slot::new(parent_qc_round),
            timeout_cert: tc.map(|(r, h)| (Slot::new(r), Slot::new(h))),
        }
    }

    #[test]
    fn votes_for_a_proposal_extending_the_previous_rounds_qc() {
        let mut safety = rules();
        let data = safety.vote(facts(1, 0, None)).unwrap();
        assert_eq!(data.last_voted_round, Slot::new(1));
    }

    #[test]
    fn rejects_a_second_vote_in_the_same_or_an_earlier_round() {
        let mut safety = rules();
        safety.vote(facts(3, 2, None)).unwrap();
        assert_eq!(
            safety.vote(facts(3, 2, None)),
            Err(VoteRefusal::AlreadyVoted {
                last_voted_round: Slot::new(3)
            })
        );
        assert!(safety.vote(facts(2, 1, None)).is_err());
    }

    #[test]
    fn never_votes_in_a_round_it_timed_out_in() {
        let mut safety = rules();
        safety.timeout(Slot::new(4)).unwrap();
        assert_eq!(
            safety.vote(facts(4, 3, None)),
            Err(VoteRefusal::TimedOut {
                last_timeout_round: Slot::new(4)
            })
        );
    }

    #[test]
    fn rejects_a_proposal_that_skips_rounds_without_a_timeout_certificate() {
        let mut safety = rules();
        assert_eq!(
            safety.vote(facts(5, 3, None)),
            Err(VoteRefusal::NotJustified)
        );
    }

    #[test]
    fn accepts_a_skip_justified_by_a_tc_whose_high_qcs_the_parent_covers() {
        let mut safety = rules();
        assert!(safety.vote(facts(5, 3, Some((4, 3)))).is_ok());
    }

    #[test]
    fn rejects_a_tc_justified_proposal_whose_parent_is_older_than_a_reported_high_qc() {
        // The TC says some validator holds a QC for round 3; extending round 2 could fork it.
        let mut safety = rules();
        assert_eq!(
            safety.vote(facts(5, 2, Some((4, 3)))),
            Err(VoteRefusal::NotJustified)
        );
    }

    #[test]
    fn rejects_a_tc_for_a_different_round() {
        let mut safety = rules();
        assert_eq!(
            safety.vote(facts(6, 3, Some((4, 3)))),
            Err(VoteRefusal::NotJustified)
        );
    }

    #[test]
    fn rejects_a_parent_below_the_locked_round() {
        let mut safety = rules();
        safety.observe_qc(Slot::new(7), Slot::new(6));
        assert_eq!(
            safety.vote(facts(9, 5, Some((8, 5)))),
            Err(VoteRefusal::BelowLock {
                preferred_round: Slot::new(6)
            })
        );
    }

    #[test]
    fn the_lock_only_moves_forward() {
        let mut safety = rules();
        safety.observe_qc(Slot::new(7), Slot::new(6));
        assert_eq!(
            safety.observe_qc(Slot::new(5), Slot::new(4)),
            None,
            "an older QC changes nothing"
        );
        assert_eq!(safety.data().preferred_round, Slot::new(6));
        assert_eq!(safety.data().highest_qc_round, Slot::new(7));
    }

    #[test]
    fn a_timeout_is_signed_at_most_once_per_round() {
        let mut safety = rules();
        safety.timeout(Slot::new(2)).unwrap();
        assert!(safety.timeout(Slot::new(2)).is_err());
        assert!(safety.timeout(Slot::new(1)).is_err());
        assert!(safety.timeout(Slot::new(3)).is_ok());
    }

    #[test]
    fn recovery_merges_by_maximum_and_never_lowers_a_round() {
        let wal = SafetyData {
            last_voted_round: Slot::new(10),
            last_timeout_round: Slot::new(3),
            ..SafetyData::genesis(Epoch::new(1))
        };
        let signer = SafetyData {
            last_voted_round: Slot::new(8),
            last_timeout_round: Slot::new(9),
            ..SafetyData::genesis(Epoch::new(1))
        };
        let merged = wal.max_merge(&signer);
        assert_eq!(
            (merged.last_voted_round, merged.last_timeout_round),
            (Slot::new(10), Slot::new(9))
        );
        let restored = SafetyData::from_ace_bytes(&merged.to_ace_bytes()).unwrap();
        assert_eq!(restored, merged);
    }
}
