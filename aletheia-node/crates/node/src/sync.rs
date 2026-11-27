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

use aletheia_consensus::{ConsensusMessage, FinalityProof, Input, Output};
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
use crate::channels::{PROPOSAL_CANDIDATES, SNAPSHOT_READS, TX_RESPONSE_BYTES};
use crate::consensus::{ConsensusDriver, PendingBuild};
use crate::ledger::BuildParams;
use crate::mempool::{Admitted, Mempool};

/// Under consensus, block sync starts only when a peer is this far ahead. Closer than that,
/// the blocks are in flight through consensus and will be finalized there.
pub(crate) const SYNC_LAG_BLOCKS: u64 = 8;

/// What the node knows of its peers, published for the RPC status (`peers`, `syncing`).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) struct PeerView {
    pub(crate) connected: u32,
    /// The highest finalized height any connected peer has reported.
    pub(crate) best_tip: u64,
}

impl PeerView {
    /// Syncing: a peer is far enough ahead that blocks come by block sync, not consensus.
    pub(crate) fn syncing(&self, our_height: u64) -> bool {
        self.best_tip > our_height.saturating_add(SYNC_LAG_BLOCKS)
    }
}

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
    pub(crate) peers: watch::Sender<PeerView>,
    /// The peer we are currently syncing blocks from.
    pub(crate) in_flight: Option<PeerId>,
    /// Peers that answered a block request with nothing although they are ahead: started from
    /// a snapshot above our height (ADR-072). Not asked again while connected.
    pub(crate) no_history: BTreeSet<PeerId>,
    /// Present on a chain with validators.
    pub(crate) consensus: Option<ConsensusDriver>,
    /// Where this node's complete snapshots are, served to peers (ADR-073).
    pub(crate) snapshot_root: std::path::PathBuf,
    /// Snapshot reads in progress, at most [`SNAPSHOT_READS`]; owned and reaped here so a
    /// slow disk never holds up consensus.
    pub(crate) snapshot_reads: tokio::task::JoinSet<()>,
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

    fn publish_peers(&self) {
        let view = PeerView {
            connected: u32::try_from(self.peer_tips.len()).unwrap_or(u32::MAX),
            best_tip: self.peer_tips.values().map(|h| h.get()).max().unwrap_or(0),
        };
        self.peers.send_if_modified(|current| {
            let changed = *current != view;
            *current = view;
            changed
        });
    }

    async fn send(&self, command: NetworkCommand) {
        let _ = self.network.commands.send(command).await;
    }

    /// Ends the service only for an error that must stop the node. Anything else (a peer's bad
    /// block, a request that failed, a signer that did not answer) is reported and the service
    /// carries on: on Mainnet Beta one such error once ended consensus for ten hours with
    /// nothing logged (2026-11-21).
    fn survive(result: Result<(), AletheiaError>) -> Result<(), AletheiaError> {
        match result {
            Err(error) if must_stop(&error) => Err(error),
            Err(error) => {
                crate::consensus::operator_note(&format!(
                    "warn {} ({}): {}; continuing",
                    error.code().name(),
                    error.code().get(),
                    error.detail()
                ));
                Ok(())
            }
            Ok(()) => Ok(()),
        }
    }

    /// After an error interrupted the engine's outputs, make sure a round timer is armed: the
    /// engine then times out and moves on instead of waiting for a timer that was never set.
    fn keep_timer(&mut self) {
        if let Some(driver) = self.consensus.as_mut()
            && driver.timer.is_none()
        {
            let wait = driver.slot_duration.saturating_mul(4);
            driver.timer = Some((driver.engine.round(), deadline(wait)));
        }
    }

    pub(crate) async fn run(mut self) -> Result<(), AletheiaError> {
        let mut producer = self.produce_every.map(tokio::time::interval);
        self.announce_validators().await;
        if self.consensus.is_some() {
            let started = self.drive(Input::Start).await;
            let failed = started.is_err();
            Self::survive(started)?;
            if failed {
                self.keep_timer();
            }
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
            let step = tokio::select! {
                event = self.network.events.recv() => match event {
                    Some(event) => self.on_network(event).await,
                    None => {
                        return Err(AletheiaError::new(
                            ErrorCode::StoIo,
                            "the network task stopped".to_owned(),
                        ));
                    }
                },
                Some(submission) = self.submissions.recv() => {
                    let result = self.admit(submission.transaction).await;
                    let _ = submission.reply.send(result);
                    Ok(())
                }
                () = tick => self.produce().await,
                () = sleep_until_or_never(timer.map(|(_, at)| at)) => {
                    if let Some(driver) = self.consensus.as_mut() {
                        driver.timer = None;
                    }
                    match timer {
                        Some((round, _)) => self.drive(Input::RoundTimer(round)).await,
                        None => Ok(()),
                    }
                }
                () = sleep_until_or_never(build_at) => self.build().await,
                Some(_) = self.snapshot_reads.join_next(), if !self.snapshot_reads.is_empty() => Ok(()),
            };
            let failed = step.is_err();
            Self::survive(step)?;
            if failed {
                self.keep_timer();
            }
        }
    }

    async fn on_network(&mut self, event: NetworkEvent) -> Result<(), AletheiaError> {
        match event {
            NetworkEvent::Connected {
                peer, tip_height, ..
            } => {
                self.peer_tips.insert(peer, tip_height);
                self.publish_peers();
                self.request_more().await;
            }
            NetworkEvent::Disconnected { peer, .. } => {
                self.peer_tips.remove(&peer);
                self.no_history.remove(&peer);
                self.publish_peers();
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
                self.publish_peers();
                self.request_more().await;
            }
            Message::GetBlocks { from, count } => {
                // Always answered, empty when these blocks are not here (a node started from a
                // snapshot above them), so the asker moves on instead of waiting (ADR-072).
                let (blocks, proof) = self.chain.read_blocks(from, count).await?;
                self.send(NetworkCommand::Send {
                    peer,
                    message: Message::Blocks {
                        blocks,
                        finality_proof: proof.map(|p| p.to_ace_bytes()).unwrap_or_default(),
                    },
                })
                .await;
            }
            Message::Blocks {
                blocks,
                finality_proof,
            } => self.on_blocks(peer, blocks, &finality_proof).await?,
            Message::GetProposal { block_hash } => self.serve_proposal(peer, block_hash).await?,
            Message::Consensus { msg_type, payload } => {
                // Undecodable or invalid messages are dropped; the engine verifies the rest.
                let Ok(message) = ConsensusMessage::decode(msg_type, &payload) else {
                    return Ok(());
                };
                let relay = match self.consensus.as_mut() {
                    Some(driver) => driver.relay(msg_type, &payload, &message),
                    None => return Ok(()),
                };
                // Passed on once, verified, to every other peer (ADR-070): a validator whose
                // direct link to another is down still hears it through the rest.
                if relay {
                    self.send(NetworkCommand::BroadcastExcept {
                        except: peer,
                        message: Message::Consensus {
                            msg_type,
                            payload: payload.clone(),
                        },
                    })
                    .await;
                }
                self.drive(Input::Message(message)).await?;
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
            Message::GetSnapshotOffer => self.serve_snapshot(peer, None),
            Message::GetSnapshotPart {
                height,
                chunk,
                offset,
            } => self.serve_snapshot(peer, Some((height, chunk, offset))),
            // Answers are only read while a new node fetches its snapshot (ADR-073).
            Message::SnapshotOffer { .. } | Message::SnapshotPart { .. } => {}
            // Peer exchange is handled inside the network service (ADR-070); never delivered here.
            Message::ListenPort { .. }
            | Message::GetPeers
            | Message::Peers(_)
            | Message::UnknownMgmt { .. } => {}
        }
        Ok(())
    }

    /// Answers a snapshot request off this task: an offer, or a part of a chunk (ADR-073).
    fn serve_snapshot(&mut self, peer: PeerId, part: Option<(u64, u32, u64)>) {
        if self.snapshot_reads.len() >= SNAPSHOT_READS {
            return;
        }
        let root = self.snapshot_root.clone();
        let commands = self.network.commands.clone();
        self.snapshot_reads.spawn(async move {
            let read = tokio::task::spawn_blocking(move || match part {
                None => crate::snapshots::offer(&root),
                Some((height, chunk, offset)) => {
                    crate::snapshots::part(&root, height, chunk, offset)
                }
            })
            .await;
            if let Ok(message) = read {
                let _ = commands.send(NetworkCommand::Send { peer, message }).await;
            }
        });
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
        let Some((&peer, &theirs)) = self
            .peer_tips
            .iter()
            .filter(|(peer, _)| !self.no_history.contains(*peer))
            .max_by_key(|(_, height)| **height)
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
        let asked = self.in_flight == Some(peer);
        if asked {
            self.in_flight = None;
        }
        let ours = self.our_height();
        if asked && blocks.is_empty() {
            let ahead = self
                .peer_tips
                .get(&peer)
                .is_some_and(|theirs| *theirs > ours);
            if ahead {
                crate::consensus::operator_note(&format!(
                    "info peer {} does not hold blocks above height {ours} (started from a later snapshot); syncing from others",
                    aletheia_core::base16::encode(&peer)
                ));
                self.no_history.insert(peer);
            }
        }
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
        // One epoch per batch (ADR-069): every block in the engine's epoch, and only the last
        // may close it; the proof is then checked against that epoch's set.
        let epoch = driver.set.epoch();
        let one_epoch = blocks.iter().enumerate().all(|(position, block)| {
            block.block.header.epoch == epoch
                && (position.saturating_add(1) == blocks.len()
                    || !aletheia_consensus::engine::closes_epoch(&block.block.header))
        });
        let proven = FinalityProof::from_ace_bytes(finality_proof)
            .ok()
            .filter(|_| one_epoch)
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
        match self.chain.apply_proven(blocks.clone(), proof).await {
            Ok(tip) => {
                for block in &blocks {
                    self.finalized(tip, block).await?;
                }
                self.restart_engine().await?;
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

    /// Restarts the engine at the finalized tip, in the epoch the ledger says it runs (the
    /// next one when the tip closed its epoch, ADR-069).
    async fn restart_engine(&mut self) -> Result<(), AletheiaError> {
        if self.consensus.is_none() {
            return Ok(());
        }
        let at = self.chain.engine_epoch().await?;
        if let Some(driver) = self.consensus.as_mut() {
            driver.restart(&at)?;
        }
        self.announce_validators().await;
        Ok(())
    }

    /// Tells the network the current epoch's validators, so it keeps connections to all of
    /// them (ADR-070), with the certificate hash each registered, so a connection presenting
    /// another certificate is refused (ADR-071). A genesis validator, or a registration with a
    /// zero hash, is not pinned.
    async fn announce_validators(&self) {
        let Some(driver) = self.consensus.as_ref() else {
            return;
        };
        let keys = driver.validator_keys();
        let hashes: Vec<Option<Hash32>> = match self
            .chain
            .rpc(crate::rpc::RpcQuery::Registry(keys.clone()))
            .await
        {
            Ok(crate::rpc::RpcAnswer::Registry(view)) => view
                .registrations
                .iter()
                .map(|registration| {
                    registration
                        .as_ref()
                        .map(|r| r.transport_cert_hash)
                        .filter(|hash| *hash != Hash32::ZERO)
                })
                .collect(),
            _ => Vec::new(),
        };
        let pins = keys
            .iter()
            .enumerate()
            .map(|(i, key)| aletheia_p2p::ValidatorPin {
                node_key: *key,
                cert_hash: hashes.get(i).copied().flatten(),
            })
            .collect();
        self.send(NetworkCommand::SetValidators(pins)).await;
    }

    /// Feeds one input to the engine and carries out every output in order, including the
    /// inputs those outputs produce (execution results, built blocks). When the engine
    /// finalizes the block that closes its epoch, the next epoch's engine takes over.
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
            if self
                .consensus
                .as_ref()
                .is_some_and(|driver| driver.engine.is_closed())
            {
                self.restart_engine().await?;
                inputs.clear();
                inputs.push_back(Input::Start);
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
                let msg_type = message.msg_type();
                let payload = message.encode_payload();
                if let Some(driver) = self.consensus.as_mut() {
                    if let ConsensusMessage::Proposal(proposal) = &message {
                        let hash = proposal.block.header.block_hash(&driver.network);
                        driver.known.insert(hash, (**proposal).clone());
                    }
                    // Our own messages coming back through a peer are not relayed again.
                    driver.sent(msg_type, &payload);
                }
                self.send(NetworkCommand::Broadcast(Message::Consensus {
                    msg_type,
                    payload,
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
                suffix: _,
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
