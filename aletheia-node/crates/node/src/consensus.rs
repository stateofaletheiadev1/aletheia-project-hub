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
    ConsensusSigner, Engine, FinalizedTip, SafetyData, ValidatorInfo, ValidatorSet,
};
use aletheia_core::block::{Proposal, QuorumCertificate, TimeoutCertificate};
use aletheia_core::{AletheiaError, Epoch, ErrorCode, Hash32, NetworkIdentity, Slot};
use aletheia_crypto::bls::{BlsPublicKey, BlsSignature};
use aletheia_execution::model::ValidatorRecord;
use aletheia_signer::LocalSigner;
use tokio::time::Instant;

/// The node's signer. Shared so the engine can be rebuilt (after block sync moves the
/// finalized tip) without giving up the signer and its high-water marks.
#[derive(Clone)]
pub(crate) enum NodeSigner {
    Validator(Arc<Mutex<LocalSigner>>),
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
        sign: impl FnOnce(&mut LocalSigner) -> Result<T, AletheiaError>,
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

    /// The signer's high-water marks as safety data rounds, for the start-up max-merge.
    pub(crate) fn floor(&self, epoch: Epoch) -> SafetyData {
        let mut floor = SafetyData::genesis(epoch);
        if let NodeSigner::Validator(signer) = self
            && let Ok(guard) = signer.lock()
        {
            let state = guard.state();
            if let Some(vote) = state.vote {
                floor.last_voted_round = vote.round;
            }
            if let Some(timeout) = state.timeout {
                floor.last_timeout_round = timeout.round;
            }
        }
        floor
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
    /// Proposals above the finalized tip that this node holds, served to peers that fetch them.
    pub(crate) known: BTreeMap<Hash32, Proposal>,
    pub(crate) timer: Option<(Slot, Instant)>,
    pub(crate) pending_build: Option<PendingBuild>,
    pub(crate) slot_duration: Duration,
    /// Misbehaviour seen (Section 19.8); on-chain submission arrives with slashing.
    pub(crate) evidence_seen: u64,
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
    pub(crate) fn new(
        network: NetworkIdentity,
        set: ValidatorSet,
        signer: NodeSigner,
        me: Option<aletheia_core::ValidatorIndex>,
        safety: SafetyData,
        finalized: FinalizedTip,
        slot_duration: Duration,
    ) -> ConsensusDriver {
        let engine = Self::engine(&network, &set, &signer, me, safety, finalized);
        ConsensusDriver {
            engine,
            network,
            set,
            signer,
            me,
            known: BTreeMap::new(),
            timer: None,
            pending_build: None,
            slot_duration,
            evidence_seen: 0,
        }
    }

    fn engine(
        network: &NetworkIdentity,
        set: &ValidatorSet,
        signer: &NodeSigner,
        me: Option<aletheia_core::ValidatorIndex>,
        safety: SafetyData,
        finalized: FinalizedTip,
    ) -> Engine<NodeSigner> {
        // Epoch 0 only until epoch transitions arrive: the seed is genesis_id (ERRATA E-22).
        let schedule = LeaderSchedule::new(
            set.epoch(),
            &seed(network, set.epoch(), &network.genesis_id()),
            set.len(),
        );
        Engine::new(
            *network,
            set.clone(),
            schedule,
            me,
            signer.clone(),
            safety,
            finalized,
        )
    }

    /// Block sync moved the finalized tip past the engine: start a fresh engine there,
    /// keeping the safety data (it only ever grows) and the signer.
    pub(crate) fn reset(&mut self, finalized: FinalizedTip) {
        let safety = self.engine.safety();
        self.engine = Self::engine(
            &self.network,
            &self.set,
            &self.signer,
            self.me,
            safety,
            finalized,
        );
        self.known
            .retain(|_, proposal| proposal.block.header.height > finalized.height);
        self.timer = None;
        self.pending_build = None;
    }
}
