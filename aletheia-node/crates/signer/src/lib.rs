//! Consensus signing with persistent double-sign protection (spec Section 19.2, APS-0043,
//! Appendix R.10).
//!
//! The signer is the last line of defence against slashing-grade equivocation. It keeps, per
//! consensus key and message class, the highest round it signed and the digest it signed in
//! that round, and refuses anything that could equivocate - even if the node above it is
//! compromised or was restored from an old backup:
//!
//! - a round below the class's high-water mark is refused;
//! - the same round with a different digest is refused (that is an equivocation);
//! - the identical request is signed again (BLS is deterministic, so this re-issues the same
//!   signature and cannot equivocate).
//!
//! The new high-water mark is written and fsynced **before** the signature is returned. A crash
//! between the two leaves a mark for a signature that never left the process, which is safe.
//!
//! `LocalSigner` holds a software key and is for devnet, regtest and the signer daemon's
//! software backend. Production keys live in an HSM behind the `aletheia-signer` daemon; that
//! backend also refuses to start when its state file is older than the HSM's monotonic
//! counter, which needs the HSM and arrives with it.

use std::fs::File;
use std::path::{Path, PathBuf};

use aletheia_consensus::ConsensusSigner;
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32, Slot,
};
use aletheia_crypto::BlsSecretKey;
use aletheia_storage::fsutil;

const STATE_MAGIC: &[u8; 8] = b"ALSIGN01";

/// The last `(round, digest)` signed in one message class.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Mark {
    pub round: Slot,
    pub digest: Hash32,
}

/// High-water marks per message class.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SignerState {
    pub proposal: Option<Mark>,
    pub vote: Option<Mark>,
    pub timeout: Option<Mark>,
}

impl AceEncode for Mark {
    fn encode(&self, out: &mut AceWriter) {
        self.round.encode(out);
        self.digest.encode(out);
    }
}

impl AceDecode for Mark {
    fn decode(input: &mut AceReader<'_>) -> Result<Mark, AletheiaError> {
        Ok(Mark {
            round: Slot::decode(input)?,
            digest: Hash32::decode(input)?,
        })
    }
}

impl AceEncode for SignerState {
    fn encode(&self, out: &mut AceWriter) {
        out.option(self.proposal.as_ref());
        out.option(self.vote.as_ref());
        out.option(self.timeout.as_ref());
    }
}

impl AceDecode for SignerState {
    fn decode(input: &mut AceReader<'_>) -> Result<SignerState, AletheiaError> {
        Ok(SignerState {
            proposal: input.option()?,
            vote: input.option()?,
            timeout: input.option()?,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Class {
    Proposal,
    Vote,
    Timeout,
}

fn refused(class: Class, detail: String) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::SigInvalid,
        format!("signer refused {class:?}: {detail}"),
    )
}

/// Checks a request against a class's mark; `Ok(true)` means it is new and the mark moves.
fn admit(
    class: Class,
    mark: Option<Mark>,
    round: Slot,
    digest: &Hash32,
) -> Result<bool, AletheiaError> {
    match mark {
        None => Ok(true),
        Some(last) if round > last.round => Ok(true),
        Some(last) if round == last.round && *digest == last.digest => Ok(false),
        Some(last) if round == last.round => Err(refused(
            class,
            format!("already signed a different message for round {round}"),
        )),
        Some(last) => Err(refused(
            class,
            format!("round {round} is below the high-water mark {}", last.round),
        )),
    }
}

#[allow(missing_debug_implementations, reason = "holds secret key material")]
pub struct LocalSigner {
    key: BlsSecretKey,
    state_path: PathBuf,
    state: SignerState,
    /// Held for the signer's lifetime: two processes signing with one state file could each
    /// pass the check and equivocate together.
    _lock: File,
}

impl LocalSigner {
    /// Opens (or creates) the state in `dir` and takes its lock.
    pub fn open(key: BlsSecretKey, dir: &Path) -> Result<LocalSigner, AletheiaError> {
        fsutil::create_dir_all(dir)?;
        let lock = fsutil::lock_exclusive(&dir.join("signer.lock"))?;
        let state_path = dir.join("signer-state.ace");
        let state = if state_path.exists() {
            let bytes = fsutil::read_checksummed(&state_path, STATE_MAGIC)?;
            SignerState::from_ace_bytes(&bytes).map_err(|e| {
                AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    format!("signer state: {}", e.detail()),
                )
            })?
        } else {
            SignerState::default()
        };
        Ok(LocalSigner {
            key,
            state_path,
            state,
            _lock: lock,
        })
    }

    pub fn state(&self) -> SignerState {
        self.state
    }

    fn sign(
        &mut self,
        class: Class,
        round: Slot,
        digest: &Hash32,
    ) -> Result<[u8; 96], AletheiaError> {
        let mark = match class {
            Class::Proposal => self.state.proposal,
            Class::Vote => self.state.vote,
            Class::Timeout => self.state.timeout,
        };
        if admit(class, mark, round, digest)? {
            let mut next = self.state;
            let new = Some(Mark {
                round,
                digest: *digest,
            });
            match class {
                Class::Proposal => next.proposal = new,
                Class::Vote => next.vote = new,
                Class::Timeout => next.timeout = new,
            }
            // Durable before the signature exists outside this function.
            fsutil::write_checksummed_atomically(
                &self.state_path,
                STATE_MAGIC,
                &next.to_ace_bytes(),
            )?;
            self.state = next;
        }
        Ok(self.key.sign(digest).to_bytes())
    }
}

impl ConsensusSigner for LocalSigner {
    fn sign_proposal(&mut self, round: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        self.sign(Class::Proposal, round, digest)
    }

    fn sign_vote(
        &mut self,
        round: Slot,
        _block_hash: &Hash32,
        digest: &Hash32,
    ) -> Result<[u8; 96], AletheiaError> {
        // The digest commits to the block hash, round and epoch, so it alone decides conflicts.
        self.sign(Class::Vote, round, digest)
    }

    fn sign_timeout(&mut self, round: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        self.sign(Class::Timeout, round, digest)
    }
}
