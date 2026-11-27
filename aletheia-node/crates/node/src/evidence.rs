//! Equivocation evidence the engine detects, kept for submission (ADR-075).
//!
//! The engine reports misbehaviour as it sees it (Section 19.8). Equivocations, two conflicting
//! messages one validator signed, are provable on chain: each is written once to
//! `<data_dir>/evidence/` as `ALEVID01 | ACE(Equivocation)` and the operator is told how to
//! submit it (`aletheia-cli validator submit-evidence --file`); a node holds no account to pay
//! the fee itself. Invalid proposals and conflicting certificates are reported only: the first
//! is not provable from signatures, the second carries aggregated signatures that do not single
//! out who signed twice. At most [`MAX_EVIDENCE_FILES`] files are kept.

use std::path::{Path, PathBuf};

use aletheia_consensus::Evidence;
use aletheia_core::validator::Equivocation;
use aletheia_core::{AletheiaError, ErrorCode};

use crate::consensus::operator_note;

/// Files kept at most; a validator equivocating without end cannot fill the disk.
pub const MAX_EVIDENCE_FILES: usize = 256;

/// The on-chain form of an equivocation the engine saw; `None` for evidence that is not
/// provable from individual signatures.
pub fn equivocation(evidence: &Evidence) -> Option<Equivocation> {
    match evidence {
        Evidence::VoteEquivocation { first, second } => Some(Equivocation::Votes {
            epoch: first.epoch,
            round: first.round,
            voter: first.voter.get(),
            first: Box::new((first.block_hash, first.signature)),
            second: Box::new((second.block_hash, second.signature)),
        }),
        Evidence::ProposalEquivocation { first, second } => Some(Equivocation::Proposals {
            first: Box::new((first.block.header.clone(), first.proposer_signature)),
            second: Box::new((second.block.header.clone(), second.proposer_signature)),
        }),
        Evidence::InvalidProposal { .. } | Evidence::ConflictingCertificates { .. } => None,
    }
}

fn file_name(equivocation: &Equivocation) -> String {
    match equivocation {
        Equivocation::Votes {
            epoch,
            round,
            voter,
            ..
        } => format!("votes-epoch{}-round{}-validator{voter}.ace", epoch, round),
        Equivocation::Proposals { first, .. } => format!(
            "proposals-epoch{}-slot{}-validator{}.ace",
            first.0.epoch, first.0.slot, first.0.proposer
        ),
    }
}

/// Reads an evidence file written by [`record`].
pub fn read(path: &Path) -> Result<Equivocation, AletheiaError> {
    let bytes = std::fs::read(path).map_err(|e| {
        AletheiaError::new(ErrorCode::StoIo, format!("read {}: {e}", path.display()))
    })?;
    Equivocation::from_file_bytes(&bytes)
        .map_err(|e| AletheiaError::new(e.code(), format!("{}: {}", path.display(), e.detail())))
}

/// Keeps what the engine reported: equivocations as files, everything as a log line.
pub(crate) fn record(dir: &Path, evidence: &Evidence) {
    let Some(equivocation) = equivocation(evidence) else {
        operator_note(&format!(
            "warn consensus misbehaviour seen (not provable on chain): {}",
            describe(evidence)
        ));
        return;
    };
    match write(dir, &equivocation) {
        Ok(Some(path)) => operator_note(&format!(
            "warn equivocation: {}; evidence saved at {} - submit it with aletheia-cli validator submit-evidence --file {}",
            describe(evidence),
            path.display(),
            path.display()
        )),
        Ok(None) => {}
        Err(error) => operator_note(&format!(
            "warn equivocation: {}; the evidence could not be saved: {}",
            describe(evidence),
            error.detail()
        )),
    }
}

fn describe(evidence: &Evidence) -> String {
    match evidence {
        Evidence::VoteEquivocation { first, .. } => format!(
            "validator {} voted twice in round {} of epoch {}",
            first.voter, first.round, first.epoch
        ),
        Evidence::ProposalEquivocation { first, .. } => format!(
            "validator {} proposed twice in slot {} of epoch {}",
            first.block.header.proposer, first.block.header.slot, first.block.header.epoch
        ),
        Evidence::InvalidProposal {
            proposer, reason, ..
        } => format!("validator {proposer} proposed an invalid block: {reason}"),
        Evidence::ConflictingCertificates { first, .. } => format!(
            "two certificates for different blocks in round {}: more than a third of the set equivocated",
            first.round
        ),
    }
}

/// Writes the file once; `None` when it is already there or the directory is full.
fn write(dir: &Path, equivocation: &Equivocation) -> Result<Option<PathBuf>, AletheiaError> {
    let io = |e: std::io::Error| {
        AletheiaError::new(
            ErrorCode::StoIo,
            format!("evidence directory {}: {e}", dir.display()),
        )
    };
    std::fs::create_dir_all(dir).map_err(io)?;
    let path = dir.join(file_name(equivocation));
    if path.exists() {
        return Ok(None);
    }
    let held = std::fs::read_dir(dir).map_err(io)?.count();
    if held >= MAX_EVIDENCE_FILES {
        return Ok(None);
    }
    let bytes = equivocation.to_file_bytes();
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, &bytes).map_err(io)?;
    std::fs::rename(&tmp, &path).map_err(io)?;
    Ok(Some(path))
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used)]

    use super::*;
    use aletheia_consensus::message::Vote;
    use aletheia_core::{Epoch, Hash32, Slot, ValidatorIndex};

    fn vote(hash: u8) -> Vote {
        Vote {
            round: Slot::new(40),
            block_hash: Hash32::from_bytes([hash; 32]),
            epoch: Epoch::new(1),
            voter: ValidatorIndex::new(2),
            signature: [hash; 96],
        }
    }

    #[test]
    fn a_vote_equivocation_is_saved_once_and_reads_back() {
        let dir = std::env::temp_dir().join(format!("aletheia-evidence-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let evidence = Evidence::VoteEquivocation {
            first: Box::new(vote(1)),
            second: Box::new(vote(2)),
        };
        let expected = equivocation(&evidence).unwrap();
        let path = write(&dir, &expected).unwrap().unwrap();
        assert!(write(&dir, &expected).unwrap().is_none(), "written once");
        assert_eq!(read(&path).unwrap(), expected);
        assert!(
            equivocation(&Evidence::InvalidProposal {
                block_hash: Hash32::ZERO,
                proposer: ValidatorIndex::new(0),
                reason: String::new(),
            })
            .is_none()
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
