//! Block propagation, block sync, transaction gossip and the consensus driver (spec Sections
//! 19, 21, 36).
//!
//! One task owns the mempool, what it knows of each peer's tip and, on a chain with
//! validators, the DSP engine. It reacts to network events, local submissions and timers:
//!
//! - a peer ahead of us is asked for the next blocks (`GetBlocks`, at most 64 per request,
//!   one request in flight); each block is re-executed and finalized by the chain thread.
//!   Under consensus a response must end in a finality proof that verifies against the
//!   validator set and that the blocks chain to, and sync is used only to catch up from more
//!   than [`SYNC_LAG_BLOCKS`] behind; closer than that, consensus finalizes the blocks itself;
//! - every new tip, ours or synced, is announced with `NewBlock`;
//! - transactions are gossiped by id (`TxAnnounce`); peers pull the bodies they lack
//!   (`GetTxs`), which limits amplification;
//! - consensus messages go to the engine, and its outputs are carried out in order
//!   ([`SyncService::drive`]): safety data is durable before the vote or timeout it authorizes
//!   is sent, proposals are executed speculatively, finalized runs are committed with their
//!   proof, and missing blocks are fetched with `GetProposal`;
//! - on devnet and regtest without validators only, an optional producer proposes a block
//!   each interval.
//!
//! A block that fails re-execution stops the sync from that peer: the block is refused,
//! never applied, and another peer is asked.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::time::Duration;

use aletheia_consensus::{ConsensusMessage, FinalityProof, FinalizedTip, Input, Output};
use aletheia_core::block::Proposal;
use aletheia_core::{
    AceDecode, AceEncode, AletheiaError, ErrorCode, Hash32, Height, SignedTransaction, Slot,
};
use aletheia_p2p::message::MAX_BLOCKS_PER_REQUEST;
use aletheia_p2p::{Message, NetworkCommand, NetworkEvent, NetworkHandle, PeerId};
use aletheia_storage::datadir::LastFinalized;
use tokio::sync::{mpsc, oneshot, watch};
use tokio::time::Instant;

use crate::chain::ChainHandle;
use crate::channels::{PROPOSAL_CANDIDATES, TX_RESPONSE_BYTES};
use crate::consensus::{ConsensusDriver, PendingBuild};
use crate::ledger::BuildParams;
use crate::mempool::{Admitted, Mempool};

/// Under consensus, block sync starts only when a peer is this far ahead. Closer than that,
/// the blocks are in flight through consensus and will be finalized there.
pub(crate) const SYNC_LAG_BLOCKS: u64 = 8;

/// A transaction submitted locally, with where to report the admission result.
pub(crate) struct Submission {
    pub(crate) transaction: SignedTransaction,
    pub(crate) reply: oneshot::Sender<Result<Hash32, AletheiaError>>,
}

pub(crate) struct SyncService {
    pub(crate) chain: ChainHandle,
    pub(crate) network: NetworkHandle,
    pub(crate) submissions: mpsc::Receiver<Submission>,
    pub(crate) tip: watch::Sender<LastFinalized>,
    pub(crate) produce_every: Option<Duration>,
    pub(crate) mempool: Mempool,
    pub(crate) peer_tips: BTreeMap<PeerId, Height>,
    /// The peer we are currently syncing blocks from.
    pub(crate) in_flight: Option<PeerId>,
    /// Present on a chain with validators.
    pub(crate) consensus: Option<ConsensusDriver>,
}

/// Whether an error from executing or building must stop the node: fail-stop errors, and the
/// clean halt before a protocol version this binary does not support.
fn must_stop(error: &AletheiaError) -> bool {
    error.is_fail_stop() || error.code() == ErrorCode::ProtocolUpgradeRequired
}

/// `now + after`, saturating at a day out (a deadline that far away never matters).
fn deadline(after: Duration) -> Instant {
    let now = Instant::now();
    now.checked_add(after)
        .or_else(|| now.checked_add(Duration::from_secs(86_400)))
        .unwrap_or(now)
}

async fn sleep_until_or_never(deadline: Option<Instant>) {
    match deadline {
        Some(at) => tokio::time::sleep_until(at).await,
        None => std::future::pending::<()>().await,
    }
}

impl SyncService {
    fn our_height(&self) -> Height {
        self.tip.borrow().height
    }

    async fn send(&self, command: NetworkCommand) {
        let _ = self.network.commands.send(command).await;
    }

    pub(crate) async fn run(mut self) -> Result<(), AletheiaError> {
        let mut producer = self.produce_every.map(tokio::time::interval);
        if self.consensus.is_some() {
            self.drive(Input::Start).await?;
        }
        loop {
            let tick = async {
                match producer.as_mut() {
                    Some(interval) => {
                        interval.tick().await;
                    }
                    None => std::future::pending::<()>().await,
                }
            };
            let timer = self.consensus.as_ref().and_then(|c| c.timer);
            let build_at = self
                .consensus
                .as_ref()
                .and_then(|c| c.pending_build.as_ref().map(|b| b.at));
            tokio::select! {
                event = self.network.events.recv() => match event {
                    Some(event) => self.on_network(event).await?,
                    None => return Ok(()),
                },
                Some(submission) = self.submissions.recv() => {
                    let result = self.admit(submission.transaction).await;
                    let _ = submission.reply.send(result);
                }
                () = tick => self.produce().await?,
                () = sleep_until_or_never(timer.map(|(_, at)| at)) => {
                    if let Some(driver) = self.consensus.as_mut() {
                        driver.timer = None;
                    }
                    if let Some((round, _)) = timer {
                        self.drive(Input::RoundTimer(round)).await?;
                    }
                }
                () = sleep_until_or_never(build_at) => self.build().await?,
            }
        }
    }

    async fn on_network(&mut self, event: NetworkEvent) -> Result<(), AletheiaError> {
        match event {
            NetworkEvent::Connected {
                peer, tip_height, ..
            } => {
                self.peer_tips.insert(peer, tip_height);
                self.request_more().await;
            }
            NetworkEvent::Disconnected { peer, .. } => {
                self.peer_tips.remove(&peer);
                if self.in_flight == Some(peer) {
                    self.in_flight = None;
                    self.request_more().await;
                }
            }
            NetworkEvent::Message { peer, message } => self.on_message(peer, message).await?,
        }
        Ok(())
    }

    async fn on_message(&mut self, peer: PeerId, message: Message) -> Result<(), AletheiaError> {
        match message {
            Message::Status { tip_height, .. }
            | Message::NewBlock {
                height: tip_height, ..
            } => {
                let known = self.peer_tips.entry(peer).or_insert(tip_height);
                *known = (*known).max(tip_height);
                self.request_more().await;
            }
            Message::GetBlocks { from, count } => {
                let (blocks, proof) = self.chain.read_blocks(from, count).await?;
                if !blocks.is_empty() {
                    self.send(NetworkCommand::Send {
                        peer,
                        message: Message::Blocks {
                            blocks,
                            finality_proof: proof.map(|p| p.to_ace_bytes()).unwrap_or_default(),
                        },
                    })
                    .await;
                }
            }
            Message::Blocks {
                blocks,
                finality_proof,
            } => self.on_blocks(peer, blocks, &finality_proof).await?,
            Message::GetProposal { block_hash } => self.serve_proposal(peer, block_hash).await?,
            Message::Consensus { msg_type, payload } => {
                if self.consensus.is_some() {
                    // Undecodable or invalid messages are dropped; the engine verifies the rest.
                    if let Ok(message) = ConsensusMessage::decode(msg_type, &payload) {
                        self.drive(Input::Message(message)).await?;
                    }
                }
            }
            Message::TxAnnounce(ids) => {
                let missing: Vec<Hash32> = ids
                    .into_iter()
                    .filter(|id| !self.mempool.contains(id))
                    .collect();
                if !missing.is_empty() {
                    self.send(NetworkCommand::Send {
                        peer,
                        message: Message::GetTxs(missing),
                    })
                    .await;
                }
            }
            Message::GetTxs(ids) => {
                let bodies = self.mempool.bodies(&ids, TX_RESPONSE_BYTES);
                if !bodies.is_empty() {
                    self.send(NetworkCommand::Send {
                        peer,
                        message: Message::Txs(bodies),
                    })
                    .await;
                }
            }
            Message::Txs(transactions) => {
                for transaction in transactions {
                    // A peer's invalid transaction is dropped; feeding admission failures back
                    // into peer scoring is left to the peer-scoring work.
                    let _ = self.admit(transaction).await;
                }
            }
            Message::Ping { nonce } => {
                self.send(NetworkCommand::Send {
                    peer,
                    message: Message::Pong { nonce },
                })
                .await
            }
            Message::Pong { .. } => {}
        }
        Ok(())
    }

    /// Answers a fetch: a proposal consensus holds, or a finalized block from the archive.
    async fn serve_proposal(&self, peer: PeerId, hash: Hash32) -> Result<(), AletheiaError> {
        let held = self
            .consensus
            .as_ref()
            .and_then(|c| c.known.get(&hash).cloned());
        let proposal = match held {
            Some(proposal) => Some(proposal),
            None => self.chain.read_block_by_hash(hash).await?,
        };
        if let Some(proposal) = proposal {
            let message = ConsensusMessage::Proposal(Box::new(proposal));
            self.send(NetworkCommand::Send {
                peer,
                message: Message::Consensus {
                    msg_type: message.msg_type(),
                    payload: message.encode_payload(),
                },
            })
            .await;
        }
        Ok(())
    }

    /// Asks the most advanced peer for the next blocks, if one is ahead (by more than
    /// [`SYNC_LAG_BLOCKS`] under consensus) and nothing is in flight.
    async fn request_more(&mut self) {
        if self.in_flight.is_some() {
            return;
        }
        let ours = self.our_height();
        let Some((&peer, &theirs)) = self.peer_tips.iter().max_by_key(|(_, height)| **height)
        else {
            return;
        };
        let lag = if self.consensus.is_some() {
            SYNC_LAG_BLOCKS
        } else {
            0
        };
        let behind = theirs.get().saturating_sub(ours.get());
        if behind <= lag {
            return;
        }
        let Ok(from) = ours.next() else { return };
        let count = u16::try_from(behind.min(u64::from(MAX_BLOCKS_PER_REQUEST)))
            .unwrap_or(MAX_BLOCKS_PER_REQUEST);
        self.in_flight = Some(peer);
        self.send(NetworkCommand::Send {
            peer,
            message: Message::GetBlocks { from, count },
        })
        .await;
    }

    async fn on_blocks(
        &mut self,
        peer: PeerId,
        blocks: Vec<Proposal>,
        finality_proof: &[u8],
    ) -> Result<(), AletheiaError> {
        if self.in_flight == Some(peer) {
            self.in_flight = None;
        }
        let ours = self.our_height();
        let blocks: Vec<Proposal> = blocks
            .into_iter()
            .filter(|block| block.block.header.height > ours)
            .collect();
        if blocks.is_empty() {
            self.request_more().await;
            return Ok(());
        }
        if self.consensus.is_some() {
            return self.on_proven_blocks(peer, blocks, finality_proof).await;
        }
        for block in blocks {
            match self.chain.apply(block.clone()).await {
                Ok(tip) => self.finalized(tip, &block).await?,
                Err(error) if error.is_fail_stop() => return Err(error),
                Err(_) => {
                    // Refuse the rest of this batch and stop trusting this peer's height.
                    self.peer_tips.insert(peer, self.our_height());
                    break;
                }
            }
        }
        self.request_more().await;
        Ok(())
    }

    /// Block sync under consensus: the run must chain from our tip to a block whose finality
    /// proof verifies. Nothing is applied otherwise.
    async fn on_proven_blocks(
        &mut self,
        peer: PeerId,
        blocks: Vec<Proposal>,
        finality_proof: &[u8],
    ) -> Result<(), AletheiaError> {
        let Some(driver) = self.consensus.as_ref() else {
            return Ok(());
        };
        let network = driver.network;
        let tip = *self.tip.borrow();
        let proven = FinalityProof::from_ace_bytes(finality_proof)
            .ok()
            .filter(|proof| proof.verify(&network, &driver.set).is_ok())
            .filter(|proof| {
                let mut parent = tip.hash;
                blocks.iter().all(|block| {
                    let linked = block.block.header.parent_hash == parent;
                    parent = block.block.header.block_hash(&network);
                    linked
                }) && parent == proof.block_hash
            });
        let Some(proof) = proven else {
            self.peer_tips.insert(peer, self.our_height());
            self.request_more().await;
            return Ok(());
        };
        let Some(last) = blocks.last().cloned() else {
            return Ok(());
        };
        match self.chain.apply_proven(blocks.clone(), proof).await {
            Ok(tip) => {
                for block in &blocks {
                    self.finalized(tip, block).await?;
                }
                if let Some(driver) = self.consensus.as_mut() {
                    driver.reset(FinalizedTip {
                        hash: tip.hash,
                        height: tip.height,
                        round: last.block.header.slot,
                    });
                }
                self.drive(Input::Start).await?;
            }
            Err(error) if error.is_fail_stop() => return Err(error),
            Err(_) => {
                self.peer_tips.insert(peer, self.our_height());
            }
        }
        self.request_more().await;
        Ok(())
    }

    /// After any new finalized block: publish the tip, tell peers, prune the mempool.
    async fn finalized(
        &mut self,
        tip: LastFinalized,
        block: &Proposal,
    ) -> Result<(), AletheiaError> {
        let _ = self.tip.send(tip);
        self.send(NetworkCommand::SetTip {
            height: tip.height,
            hash: tip.hash,
        })
        .await;
        self.send(NetworkCommand::Broadcast(Message::NewBlock {
            height: tip.height,
            hash: tip.hash,
        }))
        .await;
        let senders: BTreeSet<_> = block
            .block
            .body
            .transactions
            .iter()
            .map(|tx| tx.body.sender)
            .collect();
        let next_nonces = self
            .chain
            .next_nonces(senders.into_iter().collect())
            .await?;
        self.mempool
            .remove_finalized(&block.block.body.transactions, &next_nonces);
        self.mempool.expire(block.block.header.slot);
        if let Some(driver) = self.consensus.as_mut() {
            driver
                .known
                .retain(|_, proposal| proposal.block.header.height > tip.height);
        }
        Ok(())
    }

    async fn admit(&mut self, transaction: SignedTransaction) -> Result<Hash32, AletheiaError> {
        let verified = self.chain.admit(transaction.to_ace_bytes()).await?;
        let id = verified.tx_id().hash();
        match self.mempool.insert(verified)? {
            // Relay to every peer; one that already holds the id ignores the announcement.
            Admitted::New | Admitted::Replaced => {
                self.send(NetworkCommand::Broadcast(Message::TxAnnounce(vec![id])))
                    .await
            }
            Admitted::AlreadyKnown => {}
        }
        Ok(id)
    }

    async fn produce(&mut self) -> Result<(), AletheiaError> {
        // Devnet producer: one block per interval, slot = height (no consensus rounds).
        let height = self.our_height().next()?;
        let candidates = self.mempool.candidates(PROPOSAL_CANDIDATES);
        match self
            .chain
            .propose(candidates, Slot::new(height.get()))
            .await
        {
            Ok((proposal, tip)) => self.finalized(tip, &proposal).await,
            Err(error) if must_stop(&error) => Err(error),
            Err(_) => Ok(()),
        }
    }

    /// Feeds one input to the engine and carries out every output in order, including the
    /// inputs those outputs produce (execution results, built blocks).
    async fn drive(&mut self, input: Input) -> Result<(), AletheiaError> {
        let mut inputs = VecDeque::from([input]);
        while let Some(input) = inputs.pop_front() {
            let Some(driver) = self.consensus.as_mut() else {
                return Ok(());
            };
            let outputs = driver.engine.handle(input)?;
            for output in outputs {
                self.carry_out(output, &mut inputs).await?;
            }
        }
        Ok(())
    }

    async fn carry_out(
        &mut self,
        output: Output,
        inputs: &mut VecDeque<Input>,
    ) -> Result<(), AletheiaError> {
        match output {
            // Durable before anything after it is sent (Section 24.2).
            Output::PersistSafety(safety) => self.chain.persist_safety(safety).await?,
            Output::Broadcast(message) => {
                if let (ConsensusMessage::Proposal(proposal), Some(driver)) =
                    (&message, self.consensus.as_mut())
                {
                    let hash = proposal.block.header.block_hash(&driver.network);
                    driver.known.insert(hash, (**proposal).clone());
                }
                self.send(NetworkCommand::Broadcast(Message::Consensus {
                    msg_type: message.msg_type(),
                    payload: message.encode_payload(),
                }))
                .await;
            }
            Output::Execute(proposal) => {
                let Some(driver) = self.consensus.as_mut() else {
                    return Ok(());
                };
                let block_hash = proposal.block.header.block_hash(&driver.network);
                driver.known.insert(block_hash, (*proposal).clone());
                let (valid, reason) = match self.chain.execute_speculative(*proposal).await {
                    Ok(()) => (true, String::new()),
                    Err(error) if must_stop(&error) => return Err(error),
                    Err(error) => (false, error.to_string()),
                };
                inputs.push_back(Input::Executed {
                    block_hash,
                    valid,
                    reason,
                });
            }
            Output::BuildProposal {
                round,
                parent_qc,
                timeout_cert,
            } => {
                if let Some(driver) = self.consensus.as_mut() {
                    // Pacing (Section 19.4): one slot duration after entering the round.
                    driver.pending_build = Some(PendingBuild {
                        at: deadline(driver.slot_duration),
                        round,
                        parent_qc: *parent_qc,
                        timeout_cert: timeout_cert.map(|tc| *tc),
                    });
                }
            }
            Output::ArmTimer { round, after_ms } => {
                if let Some(driver) = self.consensus.as_mut() {
                    driver.timer = Some((round, deadline(Duration::from_millis(after_ms))));
                }
            }
            Output::Finalize { blocks, proof } => {
                let last = blocks.len().saturating_sub(1);
                for (index, block) in blocks.into_iter().enumerate() {
                    let network = match self.consensus.as_ref() {
                        Some(driver) => driver.network,
                        None => return Ok(()),
                    };
                    let hash = block.block.header.block_hash(&network);
                    let proof = (index == last).then(|| (*proof).clone());
                    let tip = self.chain.finalize_speculative(hash, proof).await?;
                    self.finalized(tip, &block).await?;
                }
            }
            Output::FetchBlock { block_hash } => {
                self.send(NetworkCommand::Broadcast(Message::GetProposal {
                    block_hash,
                }))
                .await;
            }
            Output::Evidence(_) => {
                if let Some(driver) = self.consensus.as_mut() {
                    driver.evidence_seen = driver.evidence_seen.saturating_add(1);
                }
            }
        }
        Ok(())
    }

    /// The leader's paced build: select from the mempool on the certified parent, then hand
    /// the unsigned block to the engine, which signs and broadcasts it.
    async fn build(&mut self) -> Result<(), AletheiaError> {
        let Some(driver) = self.consensus.as_mut() else {
            return Ok(());
        };
        let Some(pending) = driver.pending_build.take() else {
            return Ok(());
        };
        let (Some(me), true) = (driver.me, driver.engine.round() == pending.round) else {
            return Ok(());
        };
        let params = BuildParams {
            slot: pending.round,
            epoch: driver.set.epoch(),
            proposer: me,
            parent_qc: pending.parent_qc,
            timeout_cert: pending.timeout_cert,
        };
        let candidates = self.mempool.candidates(PROPOSAL_CANDIDATES);
        match self.chain.build(candidates, params).await {
            Ok(proposal) => self.drive(Input::Built(Box::new(proposal))).await,
            Err(error) if must_stop(&error) => Err(error),
            // The round times out and the next leader tries.
            Err(_) => Ok(()),
        }
    }
}
