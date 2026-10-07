//! The chain thread: the one OS thread that owns the ledger (spec Section 46A.1).
//!
//! Execution, finalization and every read of finalized data happen here, in request order.
//! Async tasks never touch the ledger; they send a [`ChainRequest`] over a bounded queue and
//! await the reply. A fail-stop error ends the thread, and the node with it.

use std::collections::BTreeMap;
use std::thread::JoinHandle;

use aletheia_core::block::Proposal;
use aletheia_core::{Address, AletheiaError, ErrorCode, Height, Slot};
use aletheia_execution::VerifiedTransaction;
use aletheia_storage::KvStore;
use aletheia_storage::datadir::LastFinalized;
use tokio::sync::{mpsc, oneshot};

use crate::channels::{BLOCK_RESPONSE_BYTES, CHAIN_REQUEST_QUEUE};
use crate::ledger::Ledger;

type Reply<T> = oneshot::Sender<Result<T, AletheiaError>>;

pub(crate) enum ChainRequest {
    Admit {
        bytes: Vec<u8>,
        reply: Reply<VerifiedTransaction>,
    },
    ReadBlocks {
        from: Height,
        count: u16,
        reply: Reply<Vec<Proposal>>,
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

    pub(crate) async fn read_blocks(
        &self,
        from: Height,
        count: u16,
    ) -> Result<Vec<Proposal>, AletheiaError> {
        self.call(|reply| ChainRequest::ReadBlocks { from, count, reply })
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
            let mut blocks = Vec::new();
            let mut bytes = 0usize;
            let mut height = from;
            for _ in 0..count {
                match ledger.read_block(height) {
                    Ok(Some(block)) => {
                        bytes = bytes
                            .saturating_add(aletheia_core::AceEncode::to_ace_bytes(&block).len());
                        if bytes > BLOCK_RESPONSE_BYTES && !blocks.is_empty() {
                            break;
                        }
                        blocks.push(block);
                    }
                    Ok(None) => break,
                    Err(error) => return answer(reply, Err(error)),
                }
                height = match height.next() {
                    Ok(next) => next,
                    Err(_) => break,
                };
            }
            answer(reply, Ok(blocks))
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
