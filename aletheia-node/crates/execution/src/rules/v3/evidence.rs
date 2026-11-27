//! Equivocation evidence, protocol version 3 (spec Sections 19.8, 34; ADR-075).
//!
//! `SubmitEvidence` (type 69), from any account, carries two conflicting messages one
//! validator signed: two votes in one round for different blocks, or two proposals for one
//! slot. Both signatures are verified against the set of the epoch they were signed in, which
//! state keeps for every epoch, so evidence from an earlier epoch still proves out after a key
//! rotation. A proven equivocation is recorded once and the validator is suspended exactly as
//! the Council's `SuspendValidator` would (it leaves the set when this block closes the epoch
//! and keeps its bond; slashing stays disabled, Section 34). The last member is never removed:
//! the evidence is then recorded and reported, and the chain keeps running.

use aletheia_core::block::{BLS_SIGNATURE_LEN, BlockHeader, Proposal, QuorumCertificate};
use aletheia_core::registry::GovAction;
use aletheia_core::validator::Equivocation;
use aletheia_core::{AceEncode, AceWriter, AletheiaError, ErrorCode, Hash32};
use aletheia_crypto::bls::{BlsPublicKey, BlsSignature};
use aletheia_state::{Namespace, StateKey, StateOverlay};

use crate::context::{BlockContext, Meter, OutOfEu};
use crate::model::{Records, ValidatorRecord};
use crate::receipt::Event;
use crate::rules::v1::limits::{REGISTRY_EU, SIGNATURE_EU};
use crate::rules::v2::validators::{current_set, emit, fail, in_current_set};
use crate::validator_model::Validators;

const KIND_VOTES: u8 = 1;
const KIND_PROPOSALS: u8 = 2;

fn invalid(detail: impl Into<String>) -> AletheiaError {
    fail(ErrorCode::ValEvidenceInvalid, detail)
}

/// What a proven equivocation is about.
struct Proven {
    member: ValidatorRecord,
    epoch: u64,
    round: u64,
    kind: u8,
}

fn signed_by(
    member: &ValidatorRecord,
    digest: &Hash32,
    signature: &[u8; BLS_SIGNATURE_LEN],
) -> Result<(), AletheiaError> {
    let key = BlsPublicKey::from_bytes(&member.consensus_key)
        .map_err(|e| invalid(format!("the set's key does not decode: {}", e.detail())))?;
    let signature = BlsSignature::from_bytes(signature)
        .map_err(|e| invalid(format!("a signature does not decode: {}", e.detail())))?;
    key.verify(digest, &signature)
        .map_err(|_| invalid("a signature does not verify against the validator's key"))
}

fn member_of(
    records: &Records,
    overlay: &StateOverlay<'_>,
    epoch: u64,
    index: u16,
) -> Result<ValidatorRecord, AletheiaError> {
    let set = Validators::new(records)
        .set(overlay, epoch)?
        .ok_or_else(|| invalid(format!("no validator set is recorded for epoch {epoch}")))?;
    set.get(usize::from(index))
        .copied()
        .ok_or_else(|| invalid(format!("epoch {epoch} has no validator {index}")))
}

/// Verifies the evidence; it proves nothing unless both messages conflict and both
/// signatures are the same member's.
fn prove(
    records: &Records,
    overlay: &StateOverlay<'_>,
    evidence: &Equivocation,
) -> Result<Proven, AletheiaError> {
    let network = records.network();
    match evidence {
        Equivocation::Votes {
            epoch,
            round,
            voter,
            first,
            second,
        } => {
            if first.0 == second.0 {
                return Err(invalid("both votes are for the same block"));
            }
            let member = member_of(records, overlay, epoch.get(), *voter)?;
            for side in [first, second] {
                let digest = QuorumCertificate::vote_digest(network, *round, &side.0, *epoch);
                signed_by(&member, &digest, &side.1)?;
            }
            Ok(Proven {
                member,
                epoch: epoch.get(),
                round: round.get(),
                kind: KIND_VOTES,
            })
        }
        Equivocation::Proposals { first, second } => {
            let (a, a_signature): &(BlockHeader, [u8; BLS_SIGNATURE_LEN]) = first;
            let (b, b_signature) = second.as_ref();
            if a.chain_id != network.chain_id() || b.chain_id != network.chain_id() {
                return Err(invalid("a proposal belongs to another chain"));
            }
            if a.epoch != b.epoch || a.slot != b.slot || a.proposer != b.proposer {
                return Err(invalid(
                    "the proposals are not for the same epoch, slot and proposer",
                ));
            }
            let (a_hash, b_hash) = (a.block_hash(network), b.block_hash(network));
            if a_hash == b_hash {
                return Err(invalid("both proposals are the same block"));
            }
            let member = member_of(records, overlay, a.epoch.get(), a.proposer.get())?;
            signed_by(
                &member,
                &Proposal::signing_digest(network, &a_hash),
                a_signature,
            )?;
            signed_by(
                &member,
                &Proposal::signing_digest(network, &b_hash),
                b_signature,
            )?;
            Ok(Proven {
                member,
                epoch: a.epoch.get(),
                round: a.slot.get(),
                kind: KIND_PROPOSALS,
            })
        }
    }
}

/// Where a recorded equivocation is marked, so the same one is never counted twice.
fn record_key(records: &Records, proven: &Proven) -> StateKey {
    let mut id = AceWriter::new();
    id.fixed(b"evidence");
    id.fixed(&proven.member.node_key);
    id.u64(proven.epoch);
    id.u64(proven.round);
    id.u8(proven.kind);
    let id = Hash32::from_bytes(*blake3::hash(id.as_bytes()).as_bytes());
    StateKey::derive(records.network(), Namespace::ValidatorRegistry, &id)
}

/// `SubmitEvidence` (type 69).
pub(crate) fn apply(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    evidence: &Equivocation,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Result<Result<(), OutOfEu>, AletheiaError> {
    let units = REGISTRY_EU.saturating_add(SIGNATURE_EU.saturating_mul(2));
    if meter.charge(units).is_err() {
        return Ok(Err(OutOfEu));
    }
    let proven = prove(records, overlay, evidence)?;
    let key = record_key(records, &proven);
    if overlay.get(&key)?.is_some() {
        return Err(fail(
            ErrorCode::ValEvidenceKnown,
            "this equivocation has already been recorded",
        ));
    }
    overlay.put(key, ctx.slot.get().to_ace_bytes());

    let node_key = proven.member.node_key;
    let validators = Validators::new(records);
    let state = validators.epoch_state(overlay)?;
    let in_set = in_current_set(records, overlay, &state, &node_key)?.is_some()
        && !state.leaving.contains(&node_key);
    let joining = state.joining.contains(&node_key);
    // The set after this block, without the equivocator: never empty (Section 19.8 keeps the
    // chain live; the evidence stands on record).
    let remaining = current_set(records, overlay, &state)?
        .iter()
        .filter(|m| !state.leaving.contains(&m.node_key) && m.node_key != node_key)
        .count()
        .saturating_add(state.joining.iter().filter(|k| **k != node_key).count());
    let suspended = (in_set || joining) && remaining > 0;
    if suspended {
        crate::rules::v2::validators::govern(
            records,
            overlay,
            &GovAction::SuspendValidator { node_key },
            events,
        )?;
    }
    let mut data = AceWriter::new();
    data.u64(proven.epoch);
    data.u64(proven.round);
    data.u8(proven.kind);
    data.bool(suspended);
    emit(
        events,
        "aletheia.validator.equivocation.v1",
        &node_key,
        data.into_bytes(),
    );
    Ok(Ok(()))
}
