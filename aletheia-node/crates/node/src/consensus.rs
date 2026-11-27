//! DSP in the node (spec Sections 19, 46A): the engine, its signer and its timers.
//!
//! The engine is pure; the sync service, which owns the network and the mempool, feeds it and
//! carries out its outputs in order (see `SyncService::drive`). This module holds what that
//! takes: the engine, the round timer, the leader's paced build, and the proposals this node
//! can serve to peers that fetch them.
//!
//! Pacing (Section 19.4): a slot is a round, and rounds advance as fast as certificates form.
//! The node's pacing layer, outside consensus semantics, has the leader wait one
//! `slot_duration_ms` after entering its round before building, so an idle network does not
//! produce blocks as fast as messages travel. Safety never depends on this timing.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use aletheia_consensus::schedule::{LeaderSchedule, seed};
use aletheia_consensus::{
    ConsensusMessage, ConsensusSigner, Engine, FinalizedTip, SafetyData, ValidatorInfo,
    ValidatorSet, certificate,
};
use aletheia_core::block::{Proposal, QuorumCertificate, TimeoutCertificate};
use aletheia_core::{AletheiaError, Epoch, ErrorCode, Hash32, NetworkIdentity, Slot};
use aletheia_crypto::bls::{BlsPublicKey, BlsSignature};
use aletheia_execution::model::ValidatorRecord;
use aletheia_signer::Backend;

use crate::ledger::EngineEpoch;
use tokio::time::Instant;

/// The node's signer. Shared so the engine can be rebuilt (after block sync moves the
/// finalized tip) without giving up the signer and its high-water marks.
#[derive(Clone)]
pub(crate) enum NodeSigner {
    Validator(Arc<Mutex<Backend>>),
    /// A node outside the validator set; the engine never asks it to sign.
    Observer,
}

impl core::fmt::Debug for NodeSigner {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str(match self {
            NodeSigner::Validator(_) => "NodeSigner::Validator",
            NodeSigner::Observer => "NodeSigner::Observer",
        })
    }
}

fn signer_error(detail: &str) -> AletheiaError {
    AletheiaError::new(ErrorCode::SigInvalid, detail.to_owned())
}

impl NodeSigner {
    fn with<T>(
        &self,
        sign: impl FnOnce(&mut Backend) -> Result<T, AletheiaError>,
    ) -> Result<T, AletheiaError> {
        match self {
            NodeSigner::Validator(signer) => {
                let mut guard = signer
                    .lock()
                    .map_err(|_| signer_error("the signer lock is poisoned"))?;
                sign(&mut guard)
            }
            NodeSigner::Observer => Err(signer_error("an observer node does not sign")),
        }
    }

    /// The consensus public key, for a node that holds one.
    pub(crate) fn public_key(&self) -> Option<[u8; 48]> {
        match self {
            NodeSigner::Validator(signer) => signer.lock().ok().map(|guard| guard.public_key()),
            NodeSigner::Observer => None,
        }
    }

    /// The round of the last proposal the signer signed, if any.
    pub(crate) fn proposal_round(&self) -> Option<Slot> {
        match self {
            NodeSigner::Validator(_) => self
                .with(Backend::state)
                .ok()
                .and_then(|state| state.proposal.map(|mark| mark.round)),
            NodeSigner::Observer => None,
        }
    }

    /// The signer's high-water marks as safety data rounds, for the start-up max-merge. A
    /// remote signer that cannot be asked stops start-up: the floor must not be guessed.
    pub(crate) fn floor(&self, epoch: Epoch) -> Result<SafetyData, AletheiaError> {
        let mut floor = SafetyData::genesis(epoch);
        if let NodeSigner::Validator(_) = self {
            let state = self.with(Backend::state)?;
            if let Some(vote) = state.vote {
                floor.last_voted_round = vote.round;
            }
            if let Some(timeout) = state.timeout {
                floor.last_timeout_round = timeout.round;
            }
        }
        Ok(floor)
    }
}

impl ConsensusSigner for NodeSigner {
    fn sign_proposal(&mut self, round: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        self.with(|signer| signer.sign_proposal(round, digest))
    }

    fn sign_vote(
        &mut self,
        round: Slot,
        block_hash: &Hash32,
        digest: &Hash32,
    ) -> Result<[u8; 96], AletheiaError> {
        self.with(|signer| signer.sign_vote(round, block_hash, digest))
    }

    fn sign_timeout(&mut self, round: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        self.with(|signer| signer.sign_timeout(round, digest))
    }
}

/// The epoch's validator set from its state records. Every key's proof of possession is
/// verified again here: only proven keys may be aggregated.
pub(crate) fn validator_set(
    network: &NetworkIdentity,
    epoch: Epoch,
    records: &[ValidatorRecord],
) -> Result<ValidatorSet, AletheiaError> {
    let members = records
        .iter()
        .map(|record| {
            let proof = BlsSignature::from_bytes(&record.proof_of_possession)?;
            Ok(ValidatorInfo {
                consensus_key: BlsPublicKey::from_bytes(&record.consensus_key)?
                    .prove_possession(network, &proof)?,
                node_key: record.node_key,
                voting_power: record.voting_power,
            })
        })
        .collect::<Result<Vec<_>, AletheiaError>>()?;
    ValidatorSet::new(epoch, members)
}

/// A leader's build waiting for its pacing delay.
#[derive(Debug, Clone)]
pub(crate) struct PendingBuild {
    pub(crate) at: Instant,
    pub(crate) round: Slot,
    pub(crate) parent_qc: QuorumCertificate,
    pub(crate) timeout_cert: Option<TimeoutCertificate>,
}

pub(crate) struct ConsensusDriver {
    pub(crate) engine: Engine<NodeSigner>,
    pub(crate) network: NetworkIdentity,
    pub(crate) set: ValidatorSet,
    signer: NodeSigner,
    pub(crate) me: Option<aletheia_core::ValidatorIndex>,
    /// This node's P2P identity: its place in each epoch's set, if any.
    node_key: [u8; 32],
    /// The finalized hash the current epoch's leader schedule is seeded with (ADR-069).
    seed_hash: Hash32,
    /// Proposals above the finalized tip that this node holds, served to peers that fetch them.
    pub(crate) known: BTreeMap<Hash32, Proposal>,
    pub(crate) timer: Option<(Slot, Instant)>,
    pub(crate) pending_build: Option<PendingBuild>,
    pub(crate) slot_duration: Duration,
    /// Misbehaviour seen (Section 19.8); on-chain submission arrives with slashing.
    pub(crate) evidence_seen: u64,
    /// Consensus messages already seen or sent, so each is relayed at most once (ADR-070).
    relayed: Relayed,
}

/// Most consensus message digests remembered for relay deduplication (ADR-070).
pub(crate) const RELAY_MEMORY: usize = 16_384;

/// A bounded memory of consensus messages, by a digest keyed per process (a collision can at
/// worst suppress one relay; it never affects what the engine accepts).
#[derive(Debug)]
pub(crate) struct Relayed {
    keys: std::hash::RandomState,
    seen: std::collections::HashSet<u64>,
    order: std::collections::VecDeque<u64>,
}

impl Default for Relayed {
    fn default() -> Self {
        Relayed {
            keys: std::hash::RandomState::new(),
            seen: std::collections::HashSet::new(),
            order: std::collections::VecDeque::new(),
        }
    }
}

impl Relayed {
    fn digest(&self, msg_type: u16, payload: &[u8]) -> u64 {
        use std::hash::BuildHasher;
        self.keys.hash_one((msg_type, payload))
    }

    /// Records the message; true when it had not been seen before.
    pub(crate) fn first_sight(&mut self, msg_type: u16, payload: &[u8]) -> bool {
        let digest = self.digest(msg_type, payload);
        if !self.seen.insert(digest) {
            return false;
        }
        self.order.push_back(digest);
        while self.order.len() > RELAY_MEMORY {
            if let Some(old) = self.order.pop_front() {
                self.seen.remove(&old);
            }
        }
        true
    }
}

impl core::fmt::Debug for ConsensusDriver {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("ConsensusDriver")
            .field("engine", &self.engine)
            .field("known", &self.known.len())
            .finish_non_exhaustive()
    }
}

impl ConsensusDriver {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn new(
        network: NetworkIdentity,
        set: ValidatorSet,
        signer: NodeSigner,
        node_key: [u8; 32],
        seed_hash: Hash32,
        safety: SafetyData,
        finalized: FinalizedTip,
        slot_duration: Duration,
    ) -> ConsensusDriver {
        let me = member_index(&set, &signer, &node_key);
        let engine = Self::engine(&network, &set, &signer, me, seed_hash, safety, finalized);
        ConsensusDriver {
            engine,
            network,
            set,
            signer,
            me,
            node_key,
            seed_hash,
            known: BTreeMap::new(),
            timer: None,
            pending_build: None,
            slot_duration,
            evidence_seen: 0,
            relayed: Relayed::default(),
        }
    }

    /// Records a consensus message this node is about to broadcast, so it is not relayed back.
    pub(crate) fn sent(&mut self, msg_type: u16, payload: &[u8]) {
        self.relayed.first_sight(msg_type, payload);
    }

    /// Whether a message received from a peer is passed on (ADR-070): new to this node, and
    /// valid for the current epoch's set, so the network never amplifies garbage.
    pub(crate) fn relay(
        &mut self,
        msg_type: u16,
        payload: &[u8],
        message: &ConsensusMessage,
    ) -> bool {
        if !self.relayed.first_sight(msg_type, payload) {
            return false;
        }
        let network = &self.network;
        let set = &self.set;
        match message {
            ConsensusMessage::Vote(vote) => certificate::verify_vote(network, set, vote).is_ok(),
            ConsensusMessage::Timeout(timeout) => {
                certificate::verify_timeout(network, set, timeout).is_ok()
            }
            ConsensusMessage::QuorumCertificate(qc) => {
                !qc.signers.is_empty() && certificate::verify_qc(network, set, qc).is_ok()
            }
            ConsensusMessage::TimeoutCertificate(tc) => {
                certificate::verify_tc(network, set, tc).is_ok()
            }
            ConsensusMessage::Proposal(proposal) => {
                let header = &proposal.block.header;
                header.epoch == set.epoch()
                    && header.proposer == self.engine.leader(header.slot)
                    && set.member(header.proposer).is_some_and(|member| {
                        BlsSignature::from_bytes(&proposal.proposer_signature).is_ok_and(
                            |signature| {
                                member
                                    .consensus_key
                                    .verify(
                                        &Proposal::signing_digest(
                                            network,
                                            &header.block_hash(network),
                                        ),
                                        &signature,
                                    )
                                    .is_ok()
                            },
                        )
                    })
            }
        }
    }

    /// The node keys of the current epoch's validators, for the network's validator mesh.
    pub(crate) fn validator_keys(&self) -> Vec<[u8; 32]> {
        self.set
            .members()
            .iter()
            .map(|member| member.node_key)
            .collect()
    }

    fn engine(
        network: &NetworkIdentity,
        set: &ValidatorSet,
        signer: &NodeSigner,
        me: Option<aletheia_core::ValidatorIndex>,
        seed_hash: Hash32,
        safety: SafetyData,
        finalized: FinalizedTip,
    ) -> Engine<NodeSigner> {
        // Epoch 0 seeds from genesis_id (ERRATA E-22); later epochs from the block that closed
        // the one before (ADR-069).
        let schedule = LeaderSchedule::new(
            set.epoch(),
            &seed(network, set.epoch(), &seed_hash),
            set.len(),
        );
        let mut engine = Engine::new(
            *network,
            set.clone(),
            schedule,
            me,
            signer.clone(),
            safety,
            finalized,
        );
        // A proposal signed before a restart may never have been finalized; never build a
        // different one for that round.
        if let Some(round) = signer.proposal_round() {
            engine.already_proposed(round);
        }
        engine
    }

    /// Starts a fresh engine at the finalized tip: after block sync moved the tip past the
    /// engine, or when the tip closed the epoch and the next one begins (ADR-069). Keeps the
    /// safety data (it only ever grows) and the signer; this node's place in the set is found
    /// again, so a node joins or leaves the validators with the set.
    pub(crate) fn restart(&mut self, at: &EngineEpoch) -> Result<(), AletheiaError> {
        let records = at.records.as_deref().ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::StoCorrupt,
                format!("validator epoch {} has no recorded set", at.epoch),
            )
        })?;
        let set = validator_set(&self.network, at.epoch, records)?;
        let me = member_index(&set, &self.signer, &self.node_key);
        if me != self.me || set.epoch() != self.set.epoch() {
            operator_note(&format!(
                "info validator epoch {} with {} validators; this node {}",
                set.epoch(),
                set.len(),
                match me {
                    Some(index) => format!("is validator {index}"),
                    None => "follows as an observer".to_owned(),
                }
            ));
        }
        let safety = self.engine.safety();
        self.engine = Self::engine(
            &self.network,
            &set,
            &self.signer,
            me,
            at.seed_hash,
            safety,
            at.root,
        );
        self.set = set;
        self.me = me;
        self.seed_hash = at.seed_hash;
        self.known
            .retain(|_, proposal| proposal.block.header.height > at.root.height);
        self.timer = None;
        self.pending_build = None;
        Ok(())
    }
}

/// A line for the operator. Until the binary log backend exists (Section 45) stderr lines
/// stand in for it, as they do in the daemon; an epoch change or a node moving between
/// validator and observer is something the operator must see.
#[allow(clippy::print_stderr)]
pub(crate) fn operator_note(line: &str) {
    eprintln!("aletheiad {line}");
}

/// This node's index in `set` when it is a member and holds the member's consensus key. A
/// member without the key, or with a different one, follows as an observer: signing with the
/// wrong key would only produce votes nobody counts.
pub(crate) fn member_index(
    set: &ValidatorSet,
    signer: &NodeSigner,
    node_key: &[u8; 32],
) -> Option<aletheia_core::ValidatorIndex> {
    let index = set.index_of(node_key)?;
    let registered = set.member(index)?.consensus_key.to_bytes();
    match signer.public_key() {
        Some(key) if key == registered => Some(index),
        Some(_) => {
            operator_note(&format!(
                "warn node key is validator {index}, but the consensus key differs from the registered one; following as an observer"
            ));
            None
        }
        None => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_message_is_relayed_once_and_the_memory_is_bounded() {
        let mut relayed = Relayed::default();
        assert!(relayed.first_sight(2, b"vote"));
        assert!(
            !relayed.first_sight(2, b"vote"),
            "seen once, never relayed again"
        );
        assert!(
            relayed.first_sight(3, b"vote"),
            "the type is part of the identity"
        );
        for i in 0..(RELAY_MEMORY + 10) {
            relayed.first_sight(2, &i.to_le_bytes());
        }
        assert!(relayed.seen.len() <= RELAY_MEMORY);
        assert!(
            relayed.first_sight(2, b"vote"),
            "forgotten after the memory turned over"
        );
    }
}
