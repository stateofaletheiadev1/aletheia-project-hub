//! Block propagation, block sync and transaction gossip (spec Sections 21, 36; Phase 4).
//!
//! One task owns the mempool and what it knows of each peer's tip. It reacts to network
//! events and local submissions:
//!
//! - a peer ahead of us is asked for the next blocks (`GetBlocks`, at most 64 per request,
//!   one request in flight); each block is re-executed and finalized by the chain thread;
//! - every new tip, ours or synced, is announced with `NewBlock`;
//! - transactions are gossiped by id (`TxAnnounce`); peers pull the bodies they lack
//!   (`GetTxs`), which limits amplification;
//! - on devnet and regtest only, an optional producer proposes a block each interval (until
//!   DSP replaces it in Phase 5).
//!
//! A block that fails re-execution stops the sync from that peer: the block is refused,
//! never applied, and another peer is asked.

use std::collections::{BTreeMap, BTreeSet};
use std::time::Duration;

use aletheia_core::block::Proposal;
use aletheia_core::{AceEncode, AletheiaError, ErrorCode, Hash32, Height, SignedTransaction, Slot};
use aletheia_p2p::message::MAX_BLOCKS_PER_REQUEST;
use aletheia_p2p::{Message, NetworkCommand, NetworkEvent, NetworkHandle, PeerId};
use aletheia_storage::datadir::LastFinalized;
use tokio::sync::{mpsc, oneshot, watch};

use crate::chain::ChainHandle;
use crate::channels::{PROPOSAL_CANDIDATES, TX_RESPONSE_BYTES};
use crate::mempool::{Admitted, Mempool};

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
        loop {
            let tick = async {
                match producer.as_mut() {
                    Some(interval) => {
                        interval.tick().await;
                    }
                    None => std::future::pending::<()>().await,
                }
            };
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
                let blocks = self.chain.read_blocks(from, count).await?;
                if !blocks.is_empty() {
                    self.send(NetworkCommand::Send {
                        peer,
                        message: Message::Blocks(blocks),
                    })
                    .await;
                }
            }
            Message::Blocks(blocks) => self.on_blocks(peer, blocks).await?,
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
                    // into peer scoring is wired with the consensus inbox in Phase 5.
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

    /// Asks the most advanced peer for the next blocks, if one is ahead and nothing is in flight.
    async fn request_more(&mut self) {
        if self.in_flight.is_some() {
            return;
        }
        let ours = self.our_height();
        let Some((&peer, &theirs)) = self.peer_tips.iter().max_by_key(|(_, height)| **height)
        else {
            return;
        };
        if theirs <= ours {
            return;
        }
        let Ok(from) = ours.next() else { return };
        let behind = theirs.get().saturating_sub(ours.get());
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
    ) -> Result<(), AletheiaError> {
        if self.in_flight == Some(peer) {
            self.in_flight = None;
        }
        for block in blocks {
            if block.block.header.height <= self.our_height() {
                continue;
            }
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
        // Devnet producer: one block per interval, slot = height (no consensus rounds yet).
        let height = self.our_height().next()?;
        let candidates = self.mempool.candidates(PROPOSAL_CANDIDATES);
        match self
            .chain
            .propose(candidates, Slot::new(height.get()))
            .await
        {
            Ok((proposal, tip)) => self.finalized(tip, &proposal).await,
            Err(error)
                if error.is_fail_stop() || error.code() == ErrorCode::ProtocolUpgradeRequired =>
            {
                Err(error)
            }
            Err(_) => Ok(()),
        }
    }
}
