//! The DSP engine: one validator's (or observer's) consensus state machine (spec Section 19).
//!
//! It is pure. The caller feeds [`Input`]s and must carry out the returned [`Output`]s **in
//! order**: a `PersistSafety` always precedes the vote or timeout it authorizes, so writing it
//! durably before sending what follows meets the Section 24.2 rule by construction.
//!
//! Block flow: a proposal is checked (epoch, leader, signature, certificates, known parent),
//! then handed out for execution; when the caller reports it executed and valid, the safety
//! rules decide on a vote. Votes and timeouts are broadcast to everyone, so every node forms
//! certificates itself and none depends on one leader collecting them. A QC certifies its
//! block, moves the lock and the round, and finalizes by the 2-chain rule: B is final when a
//! QC exists for C with `C.parent == B` and `C.round == B.round + 1`; B's uncommitted
//! ancestors are final with it.

use std::collections::BTreeMap;

use aletheia_core::block::{Proposal, QuorumCertificate, TimeoutCertificate};
use aletheia_core::{
    AletheiaError, ErrorCode, Hash32, Height, NetworkIdentity, Slot, ValidatorIndex,
};
use aletheia_crypto::bls::BlsSignature;

use crate::certificate::{
    TimeoutCollector, VoteCollector, verify_qc, verify_tc, verify_timeout, verify_vote,
};
use crate::finality::{Evidence, FinalityProof};
use crate::lifecycle::BlockState;
use crate::message::{ConsensusMessage, Timeout, Vote};
use crate::pacemaker::Pacemaker;
use crate::safety::{ProposalFacts, SafetyData, SafetyRules};
use crate::schedule::LeaderSchedule;
use crate::validator_set::ValidatorSet;

/// Proposals whose parent has not arrived yet, held at most this many (bounded memory).
pub const MAX_ORPHANS: usize = 64;

/// Signs consensus messages. A real seam: the node's software key on devnet, the remote
/// signer with HSM and high-water marks in production (Section 19.2).
pub trait ConsensusSigner {
    fn sign_proposal(&mut self, round: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError>;
    fn sign_vote(
        &mut self,
        round: Slot,
        block_hash: &Hash32,
        digest: &Hash32,
    ) -> Result<[u8; 96], AletheiaError>;
    fn sign_timeout(&mut self, round: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Input {
    /// Start in the current round (arms the timer; the leader asks for a block).
    Start,
    Message(ConsensusMessage),
    /// The caller executed a proposal handed out with [`Output::Execute`].
    Executed {
        block_hash: Hash32,
        valid: bool,
        reason: String,
    },
    /// The round timer armed with [`Output::ArmTimer`] expired.
    RoundTimer(Slot),
    /// The block the caller built for [`Output::BuildProposal`], unsigned.
    Built(Box<Proposal>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Output {
    /// Make durable before carrying out any later output.
    PersistSafety(SafetyData),
    Broadcast(ConsensusMessage),
    /// Execute against the parent's (possibly speculative) state; answer with `Executed`.
    Execute(Box<Proposal>),
    /// This node leads `round`: build a block extending `parent_qc.block_hash`.
    BuildProposal {
        round: Slot,
        parent_qc: Box<QuorumCertificate>,
        timeout_cert: Option<Box<TimeoutCertificate>>,
    },
    ArmTimer {
        round: Slot,
        after_ms: u64,
    },
    /// Blocks now final, in height order; the proof is for the last.
    Finalize {
        blocks: Vec<Proposal>,
        proof: Box<FinalityProof>,
    },
    /// This node needs a block it does not hold (an unknown parent, or a certified block it
    /// never received). Answer by delivering the proposal as an ordinary message.
    FetchBlock {
        block_hash: Hash32,
    },
    Evidence(Box<Evidence>),
}

#[derive(Debug, Clone)]
struct Pending {
    proposal: Proposal,
    state: BlockState,
    height: Height,
}

/// The last finalized block, from which every pending block descends.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FinalizedTip {
    pub hash: Hash32,
    pub height: Height,
    pub round: Slot,
}

pub struct Engine<S: ConsensusSigner> {
    network: NetworkIdentity,
    set: ValidatorSet,
    schedule: LeaderSchedule,
    me: Option<ValidatorIndex>,
    signer: S,
    safety: SafetyRules,
    pacemaker: Pacemaker,
    finalized: FinalizedTip,
    blocks: BTreeMap<Hash32, Pending>,
    orphans: BTreeMap<Hash32, Vec<Proposal>>,
    certified: BTreeMap<Hash32, QuorumCertificate>,
    high_qc: QuorumCertificate,
    last_tc: Option<TimeoutCertificate>,
    votes: VoteCollector,
    timeouts: TimeoutCollector,
    seen_votes: BTreeMap<(Slot, ValidatorIndex), Vote>,
    seen_proposals: BTreeMap<(Slot, ValidatorIndex), Proposal>,
    /// (round, proposer) pairs already reported as equivocating, so evidence is emitted once.
    evidenced: std::collections::BTreeSet<(Slot, ValidatorIndex)>,
    proposed_in: Option<Slot>,
    /// Our timeout for the current round, re-broadcast each time the timer fires again so a
    /// lost message cannot stall the round.
    own_timeout: Option<Timeout>,
}

impl<S: ConsensusSigner> core::fmt::Debug for Engine<S> {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Engine")
            .field("me", &self.me)
            .field("round", &self.pacemaker.round())
            .field("finalized", &self.finalized)
            .field("pending", &self.blocks.len())
            .finish_non_exhaustive()
    }
}

fn rejected(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::SigInvalid, detail)
}

fn root_qc(finalized: &FinalizedTip, set: &ValidatorSet) -> QuorumCertificate {
    let mut qc = QuorumCertificate::genesis();
    qc.block_hash = finalized.hash;
    qc.round = finalized.round;
    qc.epoch = set.epoch();
    qc
}

impl<S: ConsensusSigner> Engine<S> {
    /// An engine resuming from `finalized` with restored safety data. `me` is `None` for a
    /// non-validating node, which follows certificates but never signs.
    pub fn new(
        network: NetworkIdentity,
        set: ValidatorSet,
        schedule: LeaderSchedule,
        me: Option<ValidatorIndex>,
        signer: S,
        safety: SafetyData,
        finalized: FinalizedTip,
    ) -> Engine<S> {
        let start = finalized
            .round
            .max(safety.last_voted_round)
            .max(safety.last_timeout_round);
        let high_qc = root_qc(&finalized, &set);
        Engine {
            network,
            set,
            schedule,
            me,
            signer,
            safety: SafetyRules::new(safety),
            pacemaker: Pacemaker::new(start.next().unwrap_or(start)),
            finalized,
            blocks: BTreeMap::new(),
            orphans: BTreeMap::new(),
            certified: BTreeMap::new(),
            high_qc,
            last_tc: None,
            votes: VoteCollector::default(),
            timeouts: TimeoutCollector::default(),
            seen_votes: BTreeMap::new(),
            seen_proposals: BTreeMap::new(),
            evidenced: std::collections::BTreeSet::new(),
            proposed_in: None,
            own_timeout: None,
        }
    }

    pub fn round(&self) -> Slot {
        self.pacemaker.round()
    }

    pub fn finalized(&self) -> FinalizedTip {
        self.finalized
    }

    pub fn safety(&self) -> SafetyData {
        self.safety.data()
    }

    pub fn leader(&self, round: Slot) -> ValidatorIndex {
        self.schedule.leader(round)
    }

    /// Handles one input. `Err` is returned only for fail-stop conditions; invalid messages
    /// from peers are dropped (and evidenced where provable), never errors.
    pub fn handle(&mut self, input: Input) -> Result<Vec<Output>, AletheiaError> {
        let mut out = Vec::new();
        match input {
            Input::Start => self.enter_round(&mut out),
            Input::Message(message) => self.on_message(message, &mut out)?,
            Input::Executed {
                block_hash,
                valid,
                reason,
            } => self.on_executed(block_hash, valid, reason, &mut out)?,
            Input::RoundTimer(round) => self.on_timer(round, &mut out)?,
            Input::Built(proposal) => self.on_built(*proposal, &mut out)?,
        }
        Ok(out)
    }

    fn on_message(
        &mut self,
        message: ConsensusMessage,
        out: &mut Vec<Output>,
    ) -> Result<(), AletheiaError> {
        match message {
            ConsensusMessage::Proposal(proposal) => self.on_proposal(*proposal, out),
            ConsensusMessage::Vote(vote) => self.on_vote(vote, out),
            ConsensusMessage::Timeout(timeout) => self.on_timeout(*timeout, out),
            ConsensusMessage::QuorumCertificate(qc) => {
                if self.check_qc(&qc).is_ok() {
                    self.on_qc(*qc, out)?;
                }
                Ok(())
            }
            ConsensusMessage::TimeoutCertificate(tc) => {
                if verify_tc(&self.network, &self.set, &tc).is_ok() {
                    self.on_tc(*tc, out);
                }
                Ok(())
            }
        }
    }

    /// A QC is either a verified quorum or the unsigned root QC, which certifies exactly the
    /// finalized tip this engine started from (genesis on a new chain).
    fn check_qc(&self, qc: &QuorumCertificate) -> Result<(), AletheiaError> {
        // A certificate identical to one already verified needs no second pairing check; every
        // node relays the QCs it forms, so this saves N - 1 verifications per round.
        if self.certified.get(&qc.block_hash) == Some(qc) || self.high_qc == *qc {
            return Ok(());
        }
        if qc.signers.is_empty() {
            return if qc.block_hash == self.finalized.hash && qc.round == self.finalized.round {
                Ok(())
            } else {
                Err(rejected(
                    "an unsigned QC certifies only the finalized root".to_owned(),
                ))
            };
        }
        verify_qc(&self.network, &self.set, qc)
    }

    /// The unsigned QC certifying the finalized tip: the parent QC of the first block on it.
    pub fn root_qc(&self) -> QuorumCertificate {
        root_qc(&self.finalized, &self.set)
    }

    fn parent_height(&self, parent: &Hash32) -> Option<Height> {
        if *parent == self.finalized.hash {
            Some(self.finalized.height)
        } else {
            self.blocks.get(parent).map(|p| p.height)
        }
    }

    fn on_proposal(
        &mut self,
        proposal: Proposal,
        out: &mut Vec<Output>,
    ) -> Result<(), AletheiaError> {
        let header = &proposal.block.header;
        let hash = header.block_hash(&self.network);
        if self.blocks.contains_key(&hash) || header.slot <= self.finalized.round {
            return Ok(());
        }
        // Checks a peer cannot pass by sending garbage; any failure drops the message.
        if header.epoch != self.set.epoch() || header.proposer != self.schedule.leader(header.slot)
        {
            return Ok(());
        }
        let Some(member) = self.set.member(header.proposer) else {
            return Ok(());
        };
        let Ok(signature) = BlsSignature::from_bytes(&proposal.proposer_signature) else {
            return Ok(());
        };
        if member
            .consensus_key
            .verify(&Proposal::signing_digest(&self.network, &hash), &signature)
            .is_err()
        {
            return Ok(());
        }
        if self.check_qc(&header.parent_qc).is_err()
            || header.parent_qc.block_hash != header.parent_hash
        {
            return Ok(());
        }
        if let Some(tc) = &header.timeout_cert
            && (verify_tc(&self.network, &self.set, tc).is_err()
                || tc.round.next().ok() != Some(header.slot))
        {
            return Ok(());
        }

        // Two validly signed proposals from one leader in one round: provable equivocation.
        // A second, different, validly signed proposal from one leader in one round is evidence
        // against that leader - recorded once. It is not a reason to refuse the block: the
        // majority may have certified it, and refusing it would cut this node off from every
        // descendant. Holding both twins is safe because V2 never lets us vote twice in a round.
        // (An orphan replayed when its parent arrives is the same proposal, not a twin.)
        match self.seen_proposals.get(&(header.slot, header.proposer)) {
            Some(first) if first.block.header.block_hash(&self.network) != hash => {
                if self.evidenced.insert((header.slot, header.proposer)) {
                    out.push(Output::Evidence(Box::new(Evidence::ProposalEquivocation {
                        first: Box::new(first.clone()),
                        second: Box::new(proposal.clone()),
                    })));
                }
            }
            Some(_) => {}
            None => {
                self.seen_proposals
                    .insert((header.slot, header.proposer), proposal.clone());
            }
        }

        // The certificates a proposal carries are progress in their own right, even before its
        // parent is here: they move the round forward and certify blocks we may yet fetch.
        let parent_qc = header.parent_qc.clone();
        let timeout_cert = header.timeout_cert.clone();
        let height = header.height;
        if !parent_qc.signers.is_empty() {
            self.on_qc(parent_qc, out)?;
        }
        if let Some(tc) = timeout_cert {
            self.on_tc(tc, out);
        }

        let Some(parent_height) = self.parent_height(&header.parent_hash) else {
            let parent = proposal.block.header.parent_hash;
            let held: usize = self.orphans.values().map(Vec::len).sum();
            if held < MAX_ORPHANS
                && !self
                    .orphans
                    .get(&parent)
                    .is_some_and(|waiting| waiting.iter().any(|p| p == &proposal))
            {
                self.orphans.entry(parent).or_default().push(proposal);
            }
            out.push(Output::FetchBlock { block_hash: parent });
            return Ok(());
        };
        if parent_height.next().ok() != Some(height) {
            out.push(Output::Evidence(Box::new(Evidence::InvalidProposal {
                block_hash: hash,
                proposer: header.proposer,
                reason: "height is not parent + 1".to_owned(),
            })));
            return Ok(());
        }
        self.blocks.insert(
            hash,
            Pending {
                proposal: proposal.clone(),
                state: BlockState::Validated,
                height,
            },
        );
        out.push(Output::Execute(Box::new(proposal)));
        if let Some(children) = self.orphans.remove(&hash) {
            for child in children {
                self.on_proposal(child, out)?;
            }
        }
        Ok(())
    }

    fn on_executed(
        &mut self,
        hash: Hash32,
        valid: bool,
        reason: String,
        out: &mut Vec<Output>,
    ) -> Result<(), AletheiaError> {
        let Some(pending) = self.blocks.get_mut(&hash) else {
            return Ok(());
        };
        if pending.state != BlockState::Validated {
            return Ok(());
        }
        let header = pending.proposal.block.header.clone();
        if !valid {
            pending.state = pending.state.transition(BlockState::Rejected)?;
            out.push(Output::Evidence(Box::new(Evidence::InvalidProposal {
                block_hash: hash,
                proposer: header.proposer,
                reason,
            })));
            return Ok(());
        }
        pending.state = pending.state.transition(BlockState::Executed)?;
        if let Some(qc) = self.certified.get(&hash).cloned()
            && let Some(entry) = self.blocks.get_mut(&hash)
        {
            entry.state = entry.state.transition(BlockState::QuorumCertified)?;
            let parent_qc_round = entry.proposal.block.header.parent_qc.round;
            if let Some(safety) = self.safety.observe_qc(qc.round, parent_qc_round) {
                out.push(Output::PersistSafety(safety));
            }
        }
        // Commits that waited for this block to be executed can proceed now.
        self.retry_commits(out)?;
        let Some(me) = self.me else { return Ok(()) };
        if header.slot != self.pacemaker.round() {
            return Ok(());
        }
        let facts = ProposalFacts {
            round: header.slot,
            parent_qc_round: header.parent_qc.round,
            timeout_cert: header
                .timeout_cert
                .as_ref()
                .map(|tc| (tc.round, tc.max_high_qc_round().unwrap_or(Slot::new(0)))),
        };
        let Ok(safety) = self.safety.vote(facts) else {
            return Ok(());
        };
        out.push(Output::PersistSafety(safety));
        let digest =
            QuorumCertificate::vote_digest(&self.network, header.slot, &hash, header.epoch);
        let signature = self.signer.sign_vote(header.slot, &hash, &digest)?;
        if let Some(pending) = self.blocks.get_mut(&hash) {
            pending.state = pending.state.transition(BlockState::Attested)?;
        }
        let vote = Vote {
            round: header.slot,
            block_hash: hash,
            epoch: header.epoch,
            voter: me,
            signature,
        };
        out.push(Output::Broadcast(ConsensusMessage::Vote(vote.clone())));
        self.count_vote(vote, out)
    }

    fn on_vote(&mut self, vote: Vote, out: &mut Vec<Output>) -> Result<(), AletheiaError> {
        if vote.round <= self.finalized.round
            || verify_vote(&self.network, &self.set, &vote).is_err()
        {
            return Ok(());
        }
        self.count_vote(vote, out)
    }

    fn count_vote(&mut self, vote: Vote, out: &mut Vec<Output>) -> Result<(), AletheiaError> {
        match self.seen_votes.get(&(vote.round, vote.voter)) {
            Some(first) if first.block_hash != vote.block_hash => {
                out.push(Output::Evidence(Box::new(Evidence::VoteEquivocation {
                    first: Box::new(first.clone()),
                    second: Box::new(vote),
                })));
                return Ok(());
            }
            Some(_) => return Ok(()),
            None => {
                self.seen_votes
                    .insert((vote.round, vote.voter), vote.clone());
            }
        }
        if let Some(qc) = self.votes.add(&self.set, &vote)? {
            out.push(Output::Broadcast(ConsensusMessage::QuorumCertificate(
                Box::new(qc.clone()),
            )));
            self.on_qc(qc, out)?;
        }
        Ok(())
    }

    fn on_timeout(&mut self, timeout: Timeout, out: &mut Vec<Output>) -> Result<(), AletheiaError> {
        if timeout.round <= self.finalized.round
            || verify_timeout(&self.network, &self.set, &timeout).is_err()
            || self.check_qc(&timeout.high_qc).is_err()
        {
            return Ok(());
        }
        self.count_timeout(timeout, out)
    }

    fn count_timeout(
        &mut self,
        timeout: Timeout,
        out: &mut Vec<Output>,
    ) -> Result<(), AletheiaError> {
        if !timeout.high_qc.signers.is_empty() {
            self.on_qc(timeout.high_qc.clone(), out)?;
        }
        if let Some((tc, _highest)) = self.timeouts.add(&self.set, &timeout)? {
            out.push(Output::Broadcast(ConsensusMessage::TimeoutCertificate(
                Box::new(tc.clone()),
            )));
            self.on_tc(tc, out);
        }
        Ok(())
    }

    fn on_qc(&mut self, qc: QuorumCertificate, out: &mut Vec<Output>) -> Result<(), AletheiaError> {
        if qc.round <= self.finalized.round && qc.block_hash != self.finalized.hash {
            return Ok(());
        }
        if let Some(existing) = self
            .certified
            .values()
            .find(|c| c.round == qc.round && c.block_hash != qc.block_hash)
        {
            // Only possible with more than F equivocators: preserve the evidence, finalize neither.
            out.push(Output::Evidence(Box::new(
                Evidence::ConflictingCertificates {
                    first: Box::new(existing.clone()),
                    second: Box::new(qc),
                },
            )));
            return Ok(());
        }
        let newly = self.certified.insert(qc.block_hash, qc.clone()).is_none();
        if newly
            && !self.blocks.contains_key(&qc.block_hash)
            && qc.block_hash != self.finalized.hash
        {
            out.push(Output::FetchBlock {
                block_hash: qc.block_hash,
            });
        }
        if qc.round > self.high_qc.round {
            self.high_qc = qc.clone();
        }
        if let Some(pending) = self.blocks.get(&qc.block_hash).cloned() {
            if matches!(pending.state, BlockState::Executed | BlockState::Attested)
                && let Some(entry) = self.blocks.get_mut(&qc.block_hash)
            {
                entry.state = entry.state.transition(BlockState::QuorumCertified)?;
            }
            if let Some(safety) = self
                .safety
                .observe_qc(qc.round, pending.proposal.block.header.parent_qc.round)
            {
                out.push(Output::PersistSafety(safety));
            }
            if newly {
                self.try_commit(&qc, &pending, out)?;
            }
        }
        if self.pacemaker.advance(qc.round, false).is_some() {
            self.last_tc = None;
            self.enter_round(out);
        }
        Ok(())
    }

    /// The 2-chain rule, for a QC on block C.
    fn try_commit(
        &mut self,
        qc_child: &QuorumCertificate,
        child: &Pending,
        out: &mut Vec<Output>,
    ) -> Result<(), AletheiaError> {
        let child_header = &child.proposal.block.header;
        let parent_hash = child_header.parent_hash;
        let Some(parent) = self.blocks.get(&parent_hash) else {
            return Ok(());
        };
        if parent.proposal.block.header.slot.next().ok() != Some(child_header.slot) {
            return Ok(());
        }
        if !matches!(parent.state, BlockState::QuorumCertified)
            || parent.height <= self.finalized.height
        {
            return Ok(());
        }
        // Collect the parent and its uncommitted ancestors, oldest first.
        let mut chain = Vec::new();
        let mut cursor = parent_hash;
        while cursor != self.finalized.hash {
            let Some(block) = self.blocks.get(&cursor) else {
                return Err(AletheiaError::new(
                    ErrorCode::FinalizeParentMismatch,
                    format!("block {cursor} to finalize does not descend from the finalized tip"),
                ));
            };
            chain.push((cursor, block.clone()));
            cursor = block.proposal.block.header.parent_hash;
        }
        chain.reverse();
        // A node never commits state it did not compute: every block to finalize must have been
        // executed here. If one is still executing, the commit is retried when it finishes.
        let all_executed = chain.iter().all(|(_, block)| {
            matches!(
                block.state,
                BlockState::Executed | BlockState::Attested | BlockState::QuorumCertified
            )
        });
        if !all_executed {
            return Ok(());
        }
        let proof = FinalityProof {
            block_hash: parent_hash,
            qc_block: child_header.parent_qc.clone(),
            qc_child: qc_child.clone(),
            child_header: child_header.clone(),
        };
        let mut blocks = Vec::with_capacity(chain.len());
        for (hash, block) in &chain {
            if let Some(entry) = self.blocks.get_mut(hash) {
                // An ancestor of a certified block is certified by its child's parent QC.
                if entry.state != BlockState::QuorumCertified {
                    entry.state = entry.state.transition(BlockState::QuorumCertified)?;
                }
                entry.state = entry.state.transition(BlockState::Finalized)?;
            }
            blocks.push(block.proposal.clone());
        }
        let last = chain.last().map(|(hash, block)| FinalizedTip {
            hash: *hash,
            height: block.height,
            round: block.proposal.block.header.slot,
        });
        if let Some(tip) = last {
            self.finalized = tip;
            self.prune();
        }
        out.push(Output::Finalize {
            blocks,
            proof: Box::new(proof),
        });
        Ok(())
    }

    /// Drops finalized blocks and every branch that no longer descends from the finalized tip.
    fn prune(&mut self) {
        let tip = self.finalized.hash;
        let round = self.finalized.round;
        let mut keep: BTreeMap<Hash32, Pending> = BTreeMap::new();
        let mut frontier = vec![tip];
        while let Some(parent) = frontier.pop() {
            for (hash, block) in &self.blocks {
                if block.proposal.block.header.parent_hash == parent && !keep.contains_key(hash) {
                    keep.insert(*hash, block.clone());
                    frontier.push(*hash);
                }
            }
        }
        self.blocks = keep;
        self.certified
            .retain(|hash, qc| qc.round > round || *hash == tip);
        self.seen_votes.retain(|(r, _), _| *r > round);
        self.seen_proposals.retain(|(r, _), _| *r > round);
        self.evidenced.retain(|(r, _)| *r > round);
        self.orphans
            .retain(|_, waiting| waiting.iter().any(|p| p.block.header.slot > round));
        let next = round.next().unwrap_or(round);
        self.votes.prune_below(next);
        self.timeouts.prune_below(next);
    }

    /// Re-runs the commit rule for every certified block, lowest round first. Cheap: the maps
    /// hold only blocks above the finalized tip.
    fn retry_commits(&mut self, out: &mut Vec<Output>) -> Result<(), AletheiaError> {
        let mut certified: Vec<QuorumCertificate> = self.certified.values().cloned().collect();
        certified.sort_by_key(|qc| qc.round);
        for qc in certified {
            if let Some(child) = self.blocks.get(&qc.block_hash).cloned() {
                self.try_commit(&qc, &child, out)?;
            }
        }
        Ok(())
    }

    fn on_tc(&mut self, tc: TimeoutCertificate, out: &mut Vec<Output>) {
        if self.pacemaker.advance(tc.round, true).is_some() {
            self.last_tc = Some(tc);
            self.enter_round(out);
        }
    }

    fn on_timer(&mut self, round: Slot, out: &mut Vec<Output>) -> Result<(), AletheiaError> {
        if round != self.pacemaker.round() {
            return Ok(());
        }
        // Fetches whose answers were lost are asked again on every timer tick.
        let missing: std::collections::BTreeSet<Hash32> =
            self.orphans
                .keys()
                .copied()
                .chain(
                    self.certified.keys().copied().filter(|hash| {
                        !self.blocks.contains_key(hash) && *hash != self.finalized.hash
                    }),
                )
                .collect();
        for block_hash in missing {
            out.push(Output::FetchBlock { block_hash });
        }
        let Some(me) = self.me else { return Ok(()) };
        let Ok(safety) = self.safety.timeout(round) else {
            if let Some(timeout) = self.own_timeout.clone().filter(|t| t.round == round) {
                out.push(Output::Broadcast(ConsensusMessage::Timeout(Box::new(
                    timeout,
                ))));
                out.push(Output::ArmTimer {
                    round,
                    after_ms: self.pacemaker.timeout_ms(),
                });
            }
            return Ok(());
        };
        out.push(Output::PersistSafety(safety));
        let digest = TimeoutCertificate::timeout_digest(
            &self.network,
            round,
            self.set.epoch(),
            self.high_qc.round,
        );
        let signature = self.signer.sign_timeout(round, &digest)?;
        let timeout = Timeout {
            round,
            epoch: self.set.epoch(),
            high_qc: self.high_qc.clone(),
            voter: me,
            signature,
        };
        self.own_timeout = Some(timeout.clone());
        out.push(Output::Broadcast(ConsensusMessage::Timeout(Box::new(
            timeout.clone(),
        ))));
        // Re-arm so a stalled round keeps retrying with back-off until a TC forms.
        out.push(Output::ArmTimer {
            round,
            after_ms: self.pacemaker.timeout_ms(),
        });
        self.count_timeout(timeout, out)
    }

    fn enter_round(&mut self, out: &mut Vec<Output>) {
        let round = self.pacemaker.round();
        out.push(Output::ArmTimer {
            round,
            after_ms: self.pacemaker.timeout_ms(),
        });
        if self.me.is_some()
            && self.me == Some(self.schedule.leader(round))
            && self.proposed_in != Some(round)
        {
            // The leader extends the highest certified block, which it must hold to build on.
            let holds_parent = self.high_qc.block_hash == self.finalized.hash
                || self.blocks.contains_key(&self.high_qc.block_hash);
            if holds_parent {
                let timeout_cert = self
                    .last_tc
                    .as_ref()
                    .filter(|tc| tc.round.next().ok() == Some(round))
                    .cloned()
                    .map(Box::new);
                out.push(Output::BuildProposal {
                    round,
                    parent_qc: Box::new(self.high_qc.clone()),
                    timeout_cert,
                });
            }
        }
    }

    fn on_built(
        &mut self,
        mut proposal: Proposal,
        out: &mut Vec<Output>,
    ) -> Result<(), AletheiaError> {
        let round = proposal.block.header.slot;
        if round != self.pacemaker.round()
            || self.proposed_in == Some(round)
            || self.me != Some(self.schedule.leader(round))
        {
            return Ok(());
        }
        self.proposed_in = Some(round);
        let hash = proposal.block.header.block_hash(&self.network);
        proposal.proposer_signature = self
            .signer
            .sign_proposal(round, &Proposal::signing_digest(&self.network, &hash))?;
        out.push(Output::Broadcast(ConsensusMessage::Proposal(Box::new(
            proposal.clone(),
        ))));
        self.on_proposal(proposal, out)
    }
}
