//! The chain thread: the one OS thread that owns the ledger (spec Section 46A.1).
//!
//! Execution, finalization and every read of finalized data happen here, in request order.
//! Async tasks never touch the ledger; they send a [`ChainRequest`] over a bounded queue and
//! await the reply. A fail-stop error ends the thread, and the node with it.

use std::collections::BTreeMap;
use std::thread::JoinHandle;

use aletheia_consensus::{FinalityProof, SafetyData};
use aletheia_core::block::Proposal;
use aletheia_core::{Address, AletheiaError, ErrorCode, Height, Slot};
use aletheia_execution::VerifiedTransaction;
use aletheia_storage::KvStore;
use aletheia_storage::datadir::LastFinalized;
use tokio::sync::{mpsc, oneshot};

use crate::channels::{BLOCK_RESPONSE_BYTES, CHAIN_REQUEST_QUEUE};
use crate::ledger::{BuildParams, Ledger};

type Reply<T> = oneshot::Sender<Result<T, AletheiaError>>;

pub(crate) enum ChainRequest {
    Admit {
        bytes: Vec<u8>,
        reply: Reply<VerifiedTransaction>,
    },
    ReadBlocks {
        from: Height,
        count: u16,
        reply: Reply<(Vec<Proposal>, Option<FinalityProof>)>,
    },
    ReadBlockByHash {
        hash: aletheia_core::Hash32,
        reply: Reply<Option<Proposal>>,
    },
    ApplyProven {
        blocks: Vec<Proposal>,
        proof: Box<FinalityProof>,
        reply: Reply<LastFinalized>,
    },
    ExecuteSpeculative {
        proposal: Box<Proposal>,
        reply: Reply<()>,
    },
    Build {
        candidates: Vec<VerifiedTransaction>,
        params: Box<BuildParams>,
        reply: Reply<Proposal>,
    },
    FinalizeSpeculative {
        hash: aletheia_core::Hash32,
        proof: Option<Box<FinalityProof>>,
        reply: Reply<LastFinalized>,
    },
    PersistSafety {
        safety: SafetyData,
        reply: Reply<()>,
    },
    Apply {
        proposal: Box<Proposal>,
        reply: Reply<LastFinalized>,
    },
    Propose {
        candidates: Vec<VerifiedTransaction>,
        slot: Slot,
        reply: Reply<(Proposal, LastFinalized)>,
    },
    NextNonces {
        senders: Vec<Address>,
        reply: Reply<BTreeMap<Address, u64>>,
    },
}

/// The async side's handle to the chain thread.
#[derive(Debug, Clone)]
pub(crate) struct ChainHandle {
    requests: mpsc::Sender<ChainRequest>,
}

fn stopped() -> AletheiaError {
    AletheiaError::new(ErrorCode::StoIo, "the chain thread has stopped".to_owned())
}

impl ChainHandle {
    async fn call<T>(
        &self,
        make: impl FnOnce(Reply<T>) -> ChainRequest,
    ) -> Result<T, AletheiaError> {
        let (reply, response) = oneshot::channel();
        self.requests
            .send(make(reply))
            .await
            .map_err(|_| stopped())?;
        response.await.map_err(|_| stopped())?
    }

    pub(crate) async fn admit(&self, bytes: Vec<u8>) -> Result<VerifiedTransaction, AletheiaError> {
        self.call(|reply| ChainRequest::Admit { bytes, reply })
            .await
    }

    /// Finalized blocks from `from`. Under consensus the run is cut or extended (within the
    /// response limits) to end at a block with a stored finality proof, which comes with it.
    pub(crate) async fn read_blocks(
        &self,
        from: Height,
        count: u16,
    ) -> Result<(Vec<Proposal>, Option<FinalityProof>), AletheiaError> {
        self.call(|reply| ChainRequest::ReadBlocks { from, count, reply })
            .await
    }

    pub(crate) async fn read_block_by_hash(
        &self,
        hash: aletheia_core::Hash32,
    ) -> Result<Option<Proposal>, AletheiaError> {
        self.call(|reply| ChainRequest::ReadBlockByHash { hash, reply })
            .await
    }

    /// Block sync under consensus: blocks already checked to chain from the tip to `proof`.
    pub(crate) async fn apply_proven(
        &self,
        blocks: Vec<Proposal>,
        proof: FinalityProof,
    ) -> Result<LastFinalized, AletheiaError> {
        self.call(|reply| ChainRequest::ApplyProven {
            blocks,
            proof: Box::new(proof),
            reply,
        })
        .await
    }

    pub(crate) async fn execute_speculative(
        &self,
        proposal: Proposal,
    ) -> Result<(), AletheiaError> {
        self.call(|reply| ChainRequest::ExecuteSpeculative {
            proposal: Box::new(proposal),
            reply,
        })
        .await
    }

    pub(crate) async fn build(
        &self,
        candidates: Vec<VerifiedTransaction>,
        params: BuildParams,
    ) -> Result<Proposal, AletheiaError> {
        self.call(|reply| ChainRequest::Build {
            candidates,
            params: Box::new(params),
            reply,
        })
        .await
    }

    pub(crate) async fn finalize_speculative(
        &self,
        hash: aletheia_core::Hash32,
        proof: Option<FinalityProof>,
    ) -> Result<LastFinalized, AletheiaError> {
        self.call(|reply| ChainRequest::FinalizeSpeculative {
            hash,
            proof: proof.map(Box::new),
            reply,
        })
        .await
    }

    pub(crate) async fn persist_safety(&self, safety: SafetyData) -> Result<(), AletheiaError> {
        self.call(|reply| ChainRequest::PersistSafety { safety, reply })
            .await
    }

    pub(crate) async fn apply(&self, proposal: Proposal) -> Result<LastFinalized, AletheiaError> {
        self.call(|reply| ChainRequest::Apply {
            proposal: Box::new(proposal),
            reply,
        })
        .await
    }

    pub(crate) async fn propose(
        &self,
        candidates: Vec<VerifiedTransaction>,
        slot: Slot,
    ) -> Result<(Proposal, LastFinalized), AletheiaError> {
        self.call(|reply| ChainRequest::Propose {
            candidates,
            slot,
            reply,
        })
        .await
    }

    pub(crate) async fn next_nonces(
        &self,
        senders: Vec<Address>,
    ) -> Result<BTreeMap<Address, u64>, AletheiaError> {
        self.call(|reply| ChainRequest::NextNonces { senders, reply })
            .await
    }
}

/// Starts the chain thread. It runs until every handle is dropped, then shuts the ledger down
/// cleanly (checkpoint at the tip, Section 46A.3 steps 3-5).
pub(crate) fn spawn<S: KvStore + 'static>(
    ledger: Ledger<S>,
) -> Result<(ChainHandle, JoinHandle<Result<(), AletheiaError>>), AletheiaError> {
    let (requests, mut inbox) = mpsc::channel(CHAIN_REQUEST_QUEUE);
    let thread = std::thread::Builder::new()
        .name("chain".to_owned())
        .spawn(move || {
            let mut ledger = ledger;
            while let Some(request) = inbox.blocking_recv() {
                // A fail-stop error ends the thread: it is never answered and carried on from.
                serve(&mut ledger, request)?;
            }
            ledger.shutdown()
        })
        .map_err(|e| AletheiaError::new(ErrorCode::StoIo, format!("start chain thread: {e}")))?;
    Ok((ChainHandle { requests }, thread))
}

/// Serves one request. Ordinary errors go back to the caller; fail-stop errors are returned
/// to the thread loop, which stops.
fn serve<S: KvStore>(ledger: &mut Ledger<S>, request: ChainRequest) -> Result<(), AletheiaError> {
    fn answer<T>(reply: Reply<T>, result: Result<T, AletheiaError>) -> Result<(), AletheiaError> {
        match result {
            Err(error) if error.is_fail_stop() => {
                let _ = reply.send(Err(error.clone()));
                Err(error)
            }
            other => {
                let _ = reply.send(other);
                Ok(())
            }
        }
    }
    match request {
        ChainRequest::Admit { bytes, reply } => {
            answer(reply, ledger.admit(&bytes).map(|(verified, _)| verified))
        }
        ChainRequest::ReadBlocks { from, count, reply } => {
            answer(reply, read_blocks(ledger, from, count))
        }
        ChainRequest::ReadBlockByHash { hash, reply } => {
            answer(reply, ledger.read_block_by_hash(&hash))
        }
        ChainRequest::ApplyProven {
            blocks,
            proof,
            reply,
        } => {
            let last = blocks.len().saturating_sub(1);
            let result = blocks
                .iter()
                .enumerate()
                .try_for_each(|(index, block)| {
                    let proof = (index == last).then_some(&*proof);
                    ledger.apply_with_proof(block, proof).map(|_| ())
                })
                .map(|()| ledger.tip());
            answer(reply, result)
        }
        ChainRequest::ExecuteSpeculative { proposal, reply } => {
            answer(reply, ledger.execute_speculative(&proposal))
        }
        ChainRequest::Build {
            candidates,
            params,
            reply,
        } => answer(reply, ledger.build(candidates, *params)),
        ChainRequest::FinalizeSpeculative { hash, proof, reply } => {
            let result = ledger
                .finalize_speculative(&hash, proof.as_deref())
                .map(|()| ledger.tip());
            answer(reply, result)
        }
        ChainRequest::PersistSafety { safety, reply } => {
            answer(reply, ledger.persist_safety(&safety))
        }
        ChainRequest::Apply { proposal, reply } => {
            answer(reply, ledger.apply(&proposal).map(|_| ledger.tip()))
        }
        ChainRequest::Propose {
            candidates,
            slot,
            reply,
        } => {
            let result = ledger
                .propose(candidates, slot)
                .and_then(|(proposal, executed)| {
                    ledger.finalize(&proposal, &executed)?;
                    Ok((proposal, ledger.tip()))
                });
            answer(reply, result)
        }
        ChainRequest::NextNonces { senders, reply } => {
            let result = senders
                .into_iter()
                .map(|sender| ledger.next_nonce(&sender).map(|n| (sender, n)))
                .collect();
            answer(reply, result)
        }
    }
}

/// Reads `count` finalized blocks from `from`, within [`BLOCK_RESPONSE_BYTES`]. When finality
/// proofs exist (consensus), the run is trimmed back to the last block that has one, or
/// extended up to the request maximum until one is found, and that proof is returned.
fn read_blocks<S: KvStore>(
    ledger: &Ledger<S>,
    from: Height,
    count: u16,
) -> Result<(Vec<Proposal>, Option<FinalityProof>), AletheiaError> {
    let wanted = usize::from(count);
    let limit = usize::from(aletheia_p2p::message::MAX_BLOCKS_PER_REQUEST);
    let mut blocks = Vec::new();
    let mut bytes = 0usize;
    let mut height = from;
    let mut proven: Option<(usize, FinalityProof)> = None;
    while blocks.len() < limit {
        let Some(block) = ledger.read_block(height)? else {
            break;
        };
        bytes = bytes.saturating_add(aletheia_core::AceEncode::to_ace_bytes(&block).len());
        if bytes > BLOCK_RESPONSE_BYTES && !blocks.is_empty() {
            break;
        }
        blocks.push(block);
        if let Some(proof) = ledger.finality_proof(height)? {
            proven = Some((blocks.len(), proof));
        }
        // Past what was asked for, keep going only while no proof has been found.
        if blocks.len() >= wanted && proven.is_some() {
            break;
        }
        height = match height.next() {
            Ok(next) => next,
            Err(_) => break,
        };
    }
    match proven {
        Some((len, proof)) => {
            blocks.truncate(len);
            Ok((blocks, Some(proof)))
        }
        None => {
            blocks.truncate(wanted);
            Ok((blocks, None))
        }
    }
}
