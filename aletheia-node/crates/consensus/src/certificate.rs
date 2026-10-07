//! Quorum and timeout certificates: verification and assembly (spec Sections 19.3, 19.5).
//!
//! QC check, in order: epoch is the set's epoch; the bitmap covers exactly `N` validators; at
//! least `Q` bits are set; the aggregate of those validators' keys verifies over the vote
//! digest. A TC is checked the same way, except each signer signed its own
//! `(round, epoch, highest_qc_round)` digest.
//!
//! Collectors verify every individual signature before it counts (19.3: "verify each vote
//! before inclusion") and de-duplicate by validator index, so a certificate is never built
//! from a forged or repeated vote.

use std::collections::BTreeMap;

use aletheia_core::block::{QuorumCertificate, SignerBitmap, TimeoutCertificate};
use aletheia_core::{
    AletheiaError, Epoch, ErrorCode, Hash32, NetworkIdentity, Slot, ValidatorIndex,
};
use aletheia_crypto::bls::{self, BlsSignature};

use crate::message::{Timeout, Vote};
use crate::validator_set::ValidatorSet;

fn invalid(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::SigInvalid, detail)
}

fn check_signers(
    set: &ValidatorSet,
    epoch: Epoch,
    signers: &SignerBitmap,
    what: &str,
) -> Result<Vec<ValidatorIndex>, AletheiaError> {
    if epoch != set.epoch() {
        return Err(invalid(format!(
            "{what} is for epoch {epoch}, the validator set is for epoch {}",
            set.epoch()
        )));
    }
    if signers.len() != set.len() {
        return Err(invalid(format!(
            "{what} bitmap covers {} validators, the set has {}",
            signers.len(),
            set.len()
        )));
    }
    if signers.count() < set.quorum() {
        return Err(invalid(format!(
            "{what} has {} signers, quorum is {}",
            signers.count(),
            set.quorum()
        )));
    }
    Ok(signers.signers().collect())
}

pub fn verify_qc(
    network: &NetworkIdentity,
    set: &ValidatorSet,
    qc: &QuorumCertificate,
) -> Result<(), AletheiaError> {
    let indices = check_signers(set, qc.epoch, &qc.signers, "QC")?;
    let keys: Vec<_> = indices
        .iter()
        .filter_map(|&i| set.member(i))
        .map(|m| &m.consensus_key)
        .collect();
    let signature = BlsSignature::from_bytes(&qc.aggregate_signature)?;
    bls::verify_aggregate(
        &keys,
        &QuorumCertificate::vote_digest(network, qc.round, &qc.block_hash, qc.epoch),
        &signature,
    )
}

pub fn verify_tc(
    network: &NetworkIdentity,
    set: &ValidatorSet,
    tc: &TimeoutCertificate,
) -> Result<(), AletheiaError> {
    let indices = check_signers(set, tc.epoch, &tc.signers, "TC")?;
    let keys: Vec<_> = indices
        .iter()
        .filter_map(|&i| set.member(i))
        .map(|m| &m.consensus_key)
        .collect();
    let digests: Vec<Hash32> = tc
        .high_qc_rounds
        .iter()
        .map(|&high| TimeoutCertificate::timeout_digest(network, tc.round, tc.epoch, high))
        .collect();
    let signature = BlsSignature::from_bytes(&tc.aggregate_signature)?;
    bls::verify_aggregate_distinct(&keys, &digests, &signature)
}

/// Verifies one vote's signature against the set.
pub fn verify_vote(
    network: &NetworkIdentity,
    set: &ValidatorSet,
    vote: &Vote,
) -> Result<(), AletheiaError> {
    let member = set
        .member(vote.voter)
        .ok_or_else(|| invalid(format!("vote from unknown validator {}", vote.voter)))?;
    if vote.epoch != set.epoch() {
        return Err(invalid(format!(
            "vote for epoch {} in epoch {}",
            vote.epoch,
            set.epoch()
        )));
    }
    member.consensus_key.verify(
        &vote.digest(network),
        &BlsSignature::from_bytes(&vote.signature)?,
    )
}

/// Verifies one timeout's signature against the set (its embedded high QC is checked by the
/// caller, which knows whether it is the genesis QC).
pub fn verify_timeout(
    network: &NetworkIdentity,
    set: &ValidatorSet,
    timeout: &Timeout,
) -> Result<(), AletheiaError> {
    let member = set
        .member(timeout.voter)
        .ok_or_else(|| invalid(format!("timeout from unknown validator {}", timeout.voter)))?;
    if timeout.epoch != set.epoch() {
        return Err(invalid(format!(
            "timeout for epoch {} in epoch {}",
            timeout.epoch,
            set.epoch()
        )));
    }
    member.consensus_key.verify(
        &timeout.digest(network),
        &BlsSignature::from_bytes(&timeout.signature)?,
    )
}

/// Collects verified votes for one `(round, block_hash)` and produces the QC at quorum.
#[derive(Debug, Default)]
pub struct VoteCollector {
    votes: BTreeMap<(Slot, Hash32), BTreeMap<ValidatorIndex, [u8; 96]>>,
}

impl VoteCollector {
    /// Adds an already-verified vote; returns the QC the first time the quorum is reached.
    pub fn add(
        &mut self,
        set: &ValidatorSet,
        vote: &Vote,
    ) -> Result<Option<QuorumCertificate>, AletheiaError> {
        let entry = self.votes.entry((vote.round, vote.block_hash)).or_default();
        if entry.insert(vote.voter, vote.signature).is_some()
            || entry.len() != usize::from(set.quorum())
        {
            return Ok(None);
        }
        let mut signers = SignerBitmap::new(set.len())?;
        let mut signatures = Vec::with_capacity(entry.len());
        for (index, signature) in entry.iter() {
            signers.set(*index)?;
            signatures.push(BlsSignature::from_bytes(signature)?);
        }
        let aggregate = bls::aggregate_signatures(&signatures.iter().collect::<Vec<_>>())?;
        Ok(Some(QuorumCertificate {
            round: vote.round,
            block_hash: vote.block_hash,
            epoch: vote.epoch,
            signers,
            aggregate_signature: aggregate.to_bytes(),
        }))
    }

    /// Forgets rounds below `round` (bounded memory, Section 46).
    pub fn prune_below(&mut self, round: Slot) {
        self.votes.retain(|(r, _), _| *r >= round);
    }
}

/// Collects verified timeouts for one round and produces the TC at quorum, together with the
/// highest QC any signer reported.
#[derive(Debug, Default)]
pub struct TimeoutCollector {
    rounds: BTreeMap<Slot, BTreeMap<ValidatorIndex, (Slot, [u8; 96])>>,
    highest: BTreeMap<Slot, QuorumCertificate>,
}

impl TimeoutCollector {
    pub fn add(
        &mut self,
        set: &ValidatorSet,
        timeout: &Timeout,
    ) -> Result<Option<(TimeoutCertificate, QuorumCertificate)>, AletheiaError> {
        let highest = self
            .highest
            .entry(timeout.round)
            .or_insert_with(|| timeout.high_qc.clone());
        if timeout.high_qc.round > highest.round {
            *highest = timeout.high_qc.clone();
        }
        let entry = self.rounds.entry(timeout.round).or_default();
        if entry
            .insert(timeout.voter, (timeout.high_qc.round, timeout.signature))
            .is_some()
            || entry.len() != usize::from(set.quorum())
        {
            return Ok(None);
        }
        let mut signers = SignerBitmap::new(set.len())?;
        let mut high_qc_rounds = Vec::with_capacity(entry.len());
        let mut signatures = Vec::with_capacity(entry.len());
        // BTreeMap iteration is ascending by index, which is the order the TC lists rounds in.
        for (index, (high, signature)) in entry.iter() {
            signers.set(*index)?;
            high_qc_rounds.push(*high);
            signatures.push(BlsSignature::from_bytes(signature)?);
        }
        let aggregate = bls::aggregate_signatures(&signatures.iter().collect::<Vec<_>>())?;
        let tc = TimeoutCertificate {
            round: timeout.round,
            epoch: timeout.epoch,
            signers,
            high_qc_rounds,
            aggregate_signature: aggregate.to_bytes(),
        };
        Ok(Some((tc, highest.clone())))
    }

    pub fn prune_below(&mut self, round: Slot) {
        self.rounds.retain(|r, _| *r >= round);
        self.highest.retain(|r, _| *r >= round);
    }
}
