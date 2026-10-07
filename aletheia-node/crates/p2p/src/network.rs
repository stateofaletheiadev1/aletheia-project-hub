//! The network service: listener, dialer, and one reader and one writer task per peer, all
//! owned by a single supervisor task (spec Sections 36, 46A.1).
//!
//! The node talks to it only through two bounded channels: [`NetworkCommand`] in,
//! [`NetworkEvent`] out. Peer state - outboxes, scores, bans - is owned by the supervisor;
//! reader tasks own their peer's rate budget. Every spawned task's `JoinHandle` is held by
//! its owner and aborted when the peer is removed.

use std::collections::BTreeMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Instant;

use aletheia_core::{AletheiaError, ErrorCode, Hash32, Height};
use tokio::io::{AsyncWriteExt, WriteHalf};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{Semaphore, mpsc, oneshot, watch};
use tokio::task::JoinHandle;
use tokio_rustls::{TlsAcceptor, TlsStream};

use crate::connection::{LocalNode, PeerConnection, PeerExpectation, PeerReader};
use crate::frame::{Channel, Frame};
use crate::limits::{
    BAN_DURATION, DIAL_BACKOFF_INITIAL, DIAL_BACKOFF_MAX, MAX_INBOUND_PEERS, MAX_OUTBOUND_PEERS,
    MAX_PEERS_PER_IP, MAX_PENDING_HANDSHAKES, NETWORK_COMMAND_QUEUE, NETWORK_EVENT_QUEUE,
    PEER_OUTBOX_FRAMES, SCORE_INVALID, SCORE_RATE_EXCEEDED, SCORE_USEFUL,
};
use crate::message::Message;
use crate::peer_score::PeerBudget;
use crate::tls::server_config;

/// A peer is identified by its Ed25519 node key.
pub type PeerId = [u8; 32];

#[derive(Debug, Clone)]
pub struct DialTarget {
    pub address: SocketAddr,
    pub expect: PeerExpectation,
}

#[derive(Debug, Clone)]
pub struct NetworkConfig {
    pub listen: SocketAddr,
    pub dial: Vec<DialTarget>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NetworkEvent {
    Connected {
        peer: PeerId,
        address: SocketAddr,
        tip_height: Height,
        tip_hash: Hash32,
    },
    Disconnected {
        peer: PeerId,
        reason: String,
    },
    Message {
        peer: PeerId,
        message: Message,
    },
}

#[derive(Debug, Clone)]
pub enum NetworkCommand {
    Send {
        peer: PeerId,
        message: Message,
    },
    Broadcast(Message),
    /// The tip advertised in future handshakes.
    SetTip {
        height: Height,
        hash: Hash32,
    },
}

/// The node's end of the network service. Dropping it stops the supervisor and every peer
/// task it owns.
#[derive(Debug)]
pub struct NetworkHandle {
    pub commands: mpsc::Sender<NetworkCommand>,
    pub events: mpsc::Receiver<NetworkEvent>,
    pub local_addr: SocketAddr,
    supervisor: JoinHandle<()>,
}

impl NetworkHandle {
    pub async fn shutdown(self) {
        self.supervisor.abort();
    }
}

impl Drop for NetworkHandle {
    fn drop(&mut self) {
        self.supervisor.abort();
    }
}

/// Outbound queues, one per priority slot (state and snapshot sync share the lowest).
struct Outbox {
    slots: [mpsc::Sender<Frame>; 5],
}

fn slot(channel: Channel) -> usize {
    usize::from(channel.priority())
}

/// Messages from the supervisor's own tasks.
enum Internal {
    Connected {
        connection: Box<PeerConnection>,
        outbound: bool,
        closed: Option<oneshot::Sender<()>>,
    },
    Closed {
        peer: PeerId,
        generation: u64,
        reason: String,
    },
    Ban {
        peer: PeerId,
        generation: u64,
        reason: String,
    },
}

struct PeerEntry {
    /// Distinguishes this connection from a later one to the same peer, so a late close
    /// notice from an old connection never removes its replacement.
    generation: u64,
    address: SocketAddr,
    outbound: bool,
    dialer: PeerId,
    outbox: Outbox,
    reader: JoinHandle<()>,
    writer: JoinHandle<()>,
    /// Dropped when the peer is removed, which tells every dial task waiting on this peer -
    /// including ones whose own duplicate connection was refused - to redial.
    closed: Vec<oneshot::Sender<()>>,
}

impl Drop for PeerEntry {
    fn drop(&mut self) {
        self.reader.abort();
        self.writer.abort();
    }
}

struct Supervisor {
    local_id: PeerId,
    next_generation: u64,
    peers: BTreeMap<PeerId, PeerEntry>,
    banned: BTreeMap<PeerId, Instant>,
    events: mpsc::Sender<NetworkEvent>,
    internal: mpsc::Sender<Internal>,
    tip: watch::Sender<(Height, Hash32)>,
    background: Vec<JoinHandle<()>>,
}

impl Drop for Supervisor {
    fn drop(&mut self) {
        self.background.iter().for_each(JoinHandle::abort);
    }
}

pub async fn start(
    config: NetworkConfig,
    local: LocalNode,
    tip: (Height, Hash32),
) -> Result<NetworkHandle, AletheiaError> {
    let listener = TcpListener::bind(config.listen).await.map_err(|e| {
        AletheiaError::new(
            ErrorCode::P2pConnectionLimit,
            format!("listen on {}: {e}", config.listen),
        )
    })?;
    let local_addr = listener.local_addr().map_err(|e| {
        AletheiaError::new(
            ErrorCode::P2pConnectionLimit,
            format!("listener address: {e}"),
        )
    })?;
    let acceptor = TlsAcceptor::from(server_config(&local.certificate)?);
    let local = Arc::new(local);
    let (command_tx, command_rx) = mpsc::channel(NETWORK_COMMAND_QUEUE);
    let (event_tx, event_rx) = mpsc::channel(NETWORK_EVENT_QUEUE);
    let (internal_tx, internal_rx) = mpsc::channel(NETWORK_COMMAND_QUEUE);
    let (tip_tx, tip_rx) = watch::channel(tip);

    let mut background = vec![tokio::spawn(accept_loop(
        listener,
        acceptor,
        Arc::clone(&local),
        tip_rx.clone(),
        internal_tx.clone(),
    ))];
    for target in config.dial {
        background.push(tokio::spawn(dial_loop(
            target,
            Arc::clone(&local),
            tip_rx.clone(),
            internal_tx.clone(),
        )));
    }
    let supervisor = Supervisor {
        local_id: local.node_key.public_key().to_bytes(),
        next_generation: 0,
        peers: BTreeMap::new(),
        banned: BTreeMap::new(),
        events: event_tx,
        internal: internal_tx,
        tip: tip_tx,
        background,
    };
    let task = tokio::spawn(supervisor.run(command_rx, internal_rx));
    Ok(NetworkHandle {
        commands: command_tx,
        events: event_rx,
        local_addr,
        supervisor: task,
    })
}

async fn accept_loop(
    listener: TcpListener,
    acceptor: TlsAcceptor,
    local: Arc<LocalNode>,
    tip: watch::Receiver<(Height, Hash32)>,
    internal: mpsc::Sender<Internal>,
) {
    let pending = Arc::new(Semaphore::new(MAX_PENDING_HANDSHAKES));
    loop {
        let Ok((tcp, _)) = listener.accept().await else {
            continue;
        };
        // Over the pending-handshake cap the connection is closed at once (Section 36).
        let Ok(permit) = Arc::clone(&pending).try_acquire_owned() else {
            drop(tcp);
            continue;
        };
        let (acceptor, local, internal, tip) = (
            acceptor.clone(),
            Arc::clone(&local),
            internal.clone(),
            *tip.borrow(),
        );
        // Handshake tasks are bounded by the semaphore and by HANDSHAKE_TIMEOUT; they end on
        // their own and hand the connection to the supervisor, which owns it from then on.
        let _handshake = tokio::spawn(async move {
            if let Ok(connection) = PeerConnection::accept(tcp, &acceptor, &local, tip).await {
                let _ = internal
                    .send(Internal::Connected {
                        connection: Box::new(connection),
                        outbound: false,
                        closed: None,
                    })
                    .await;
            }
            drop(permit);
        });
    }
}

async fn dial_loop(
    target: DialTarget,
    local: Arc<LocalNode>,
    tip: watch::Receiver<(Height, Hash32)>,
    internal: mpsc::Sender<Internal>,
) {
    let mut backoff = DIAL_BACKOFF_INITIAL;
    loop {
        let current_tip = *tip.borrow();
        match PeerConnection::connect(target.address, &local, current_tip, target.expect).await {
            Ok(connection) => {
                backoff = DIAL_BACKOFF_INITIAL;
                let (closed_tx, closed_rx) = oneshot::channel();
                if internal
                    .send(Internal::Connected {
                        connection: Box::new(connection),
                        outbound: true,
                        closed: Some(closed_tx),
                    })
                    .await
                    .is_err()
                {
                    return;
                }
                let _ = closed_rx.await;
            }
            Err(_) => {
                backoff = backoff
                    .checked_mul(2)
                    .unwrap_or(DIAL_BACKOFF_MAX)
                    .min(DIAL_BACKOFF_MAX)
            }
        }
        tokio::time::sleep(backoff).await;
    }
}

async fn reader_loop(
    peer: PeerId,
    generation: u64,
    mut reader: PeerReader,
    events: mpsc::Sender<NetworkEvent>,
    internal: mpsc::Sender<Internal>,
) {
    let mut budget = PeerBudget::new(Instant::now());
    let reason = loop {
        let frame = match reader.recv().await {
            Ok(frame) => frame,
            Err(error) => {
                // Oversized or unknown-channel frames are protocol violations, not I/O.
                if matches!(
                    error.code(),
                    ErrorCode::P2pFrameTooLarge
                        | ErrorCode::P2pUnknownChannel
                        | ErrorCode::P2pMalformedMessage
                ) {
                    let _ = internal
                        .send(Internal::Ban {
                            peer,
                            generation,
                            reason: error.to_string(),
                        })
                        .await;
                    return;
                }
                break error.detail().to_owned();
            }
        };
        if !budget.admit(frame.channel, Instant::now()) {
            if budget.adjust(SCORE_RATE_EXCEEDED) {
                let _ = internal
                    .send(Internal::Ban {
                        peer,
                        generation,
                        reason: format!("rate limit exceeded on {:?}", frame.channel),
                    })
                    .await;
                return;
            }
            continue;
        }
        let message = match Message::from_frame(&frame) {
            Ok(message) => message,
            Err(error) => {
                if budget.adjust(SCORE_INVALID) {
                    let _ = internal
                        .send(Internal::Ban {
                            peer,
                            generation,
                            reason: error.to_string(),
                        })
                        .await;
                    return;
                }
                continue;
            }
        };
        budget.adjust(SCORE_USEFUL);
        let event = NetworkEvent::Message { peer, message };
        let delivered = if frame.channel == Channel::TxGossip {
            // Shed, never block, on gossip (Section 46.2).
            !matches!(
                events.try_send(event),
                Err(mpsc::error::TrySendError::Closed(_))
            )
        } else {
            events.send(event).await.is_ok()
        };
        if !delivered {
            return;
        }
    };
    let _ = internal
        .send(Internal::Closed {
            peer,
            generation,
            reason,
        })
        .await;
}

async fn writer_loop(
    peer: PeerId,
    generation: u64,
    mut write: WriteHalf<TlsStream<TcpStream>>,
    mut slots: [mpsc::Receiver<Frame>; 5],
    internal: mpsc::Sender<Internal>,
) {
    let [consensus, block, tx, mgmt, sync] = &mut slots;
    let reason = loop {
        // `biased` drains higher-priority queues first: consensus is never behind gossip.
        let frame = tokio::select! {
            biased;
            Some(frame) = consensus.recv() => frame,
            Some(frame) = block.recv() => frame,
            Some(frame) = tx.recv() => frame,
            Some(frame) = mgmt.recv() => frame,
            Some(frame) = sync.recv() => frame,
            else => return,
        };
        let bytes = match frame.encode() {
            Ok(bytes) => bytes,
            Err(error) => break error.detail().to_owned(),
        };
        if let Err(error) = write.write_all(&bytes).await {
            break format!("send failed: {error}");
        }
        if let Err(error) = write.flush().await {
            break format!("flush failed: {error}");
        }
    };
    let _ = internal
        .send(Internal::Closed {
            peer,
            generation,
            reason,
        })
        .await;
}

impl Supervisor {
    async fn run(
        mut self,
        mut commands: mpsc::Receiver<NetworkCommand>,
        mut internal: mpsc::Receiver<Internal>,
    ) {
        loop {
            tokio::select! {
                Some(command) = commands.recv() => self.handle_command(command).await,
                Some(message) = internal.recv() => self.handle_internal(message).await,
                else => return,
            }
        }
    }

    async fn handle_command(&mut self, command: NetworkCommand) {
        match command {
            NetworkCommand::Send { peer, message } => self.send_to(peer, &message).await,
            NetworkCommand::Broadcast(message) => {
                let peers: Vec<PeerId> = self.peers.keys().copied().collect();
                for peer in peers {
                    self.send_to(peer, &message).await;
                }
            }
            NetworkCommand::SetTip { height, hash } => {
                let _ = self.tip.send((height, hash));
            }
        }
    }

    async fn send_to(&mut self, peer: PeerId, message: &Message) {
        let Some(entry) = self.peers.get(&peer) else {
            return;
        };
        let frame = message.to_frame(0);
        let channel = frame.channel;
        let Some(sender) = entry.outbox.slots.get(slot(channel)) else {
            return;
        };
        match sender.try_send(frame) {
            Ok(()) => {}
            Err(mpsc::error::TrySendError::Full(_)) if channel == Channel::TxGossip => {}
            Err(_) => {
                self.remove(peer, format!("peer cannot keep up on {channel:?}"))
                    .await
            }
        }
    }

    async fn handle_internal(&mut self, message: Internal) {
        match message {
            Internal::Connected {
                connection,
                outbound,
                closed,
            } => self.register(*connection, outbound, closed).await,
            Internal::Closed {
                peer,
                generation,
                reason,
            } => {
                if self
                    .peers
                    .get(&peer)
                    .is_some_and(|entry| entry.generation == generation)
                {
                    self.remove(peer, reason).await;
                }
            }
            Internal::Ban {
                peer,
                generation,
                reason,
            } => {
                if self
                    .peers
                    .get(&peer)
                    .is_some_and(|entry| entry.generation == generation)
                {
                    let now = Instant::now();
                    self.banned
                        .insert(peer, now.checked_add(BAN_DURATION).unwrap_or(now));
                    self.remove(
                        peer,
                        format!("banned for {} s: {reason}", BAN_DURATION.as_secs()),
                    )
                    .await;
                }
            }
        }
    }

    fn is_banned(&mut self, peer: &PeerId) -> bool {
        let now = Instant::now();
        self.banned.retain(|_, until| *until > now);
        self.banned.contains_key(peer)
    }

    fn count_ip(&self, ip: IpAddr) -> usize {
        self.peers
            .values()
            .filter(|entry| entry.address.ip() == ip)
            .count()
    }

    async fn register(
        &mut self,
        connection: PeerConnection,
        outbound: bool,
        closed: Option<oneshot::Sender<()>>,
    ) {
        let identity = connection.peer().clone();
        let peer = identity.node_key.to_bytes();
        if self.is_banned(&peer) {
            return;
        }
        let dialer = if outbound { self.local_id } else { peer };
        let mut waiting: Vec<oneshot::Sender<()>> = closed.into_iter().collect();
        let mut replacing = false;
        if let Some(existing) = self.peers.get_mut(&peer) {
            // Both sides keep the connection whose dialer has the lower node key, so a
            // simultaneous dial leaves exactly one connection, the same one on both ends.
            if existing.dialer <= dialer {
                existing.closed.append(&mut waiting);
                return;
            }
            if let Some(mut old) = self.peers.remove(&peer) {
                waiting.append(&mut old.closed);
            }
            replacing = true;
        }
        let (inbound, outbound_count) =
            self.peers
                .values()
                .fold((0, 0), |(i, o): (usize, usize), e| {
                    if e.outbound {
                        (i, o.saturating_add(1))
                    } else {
                        (i.saturating_add(1), o)
                    }
                });
        if (!outbound && inbound >= MAX_INBOUND_PEERS)
            || (outbound && outbound_count >= MAX_OUTBOUND_PEERS)
            || self.count_ip(identity.address.ip()) >= MAX_PEERS_PER_IP
        {
            return;
        }

        let (reader, write, identity) = connection.split();
        let (senders, receivers): (Vec<_>, Vec<_>) =
            (0..5).map(|_| mpsc::channel(PEER_OUTBOX_FRAMES)).unzip();
        let (Ok(slots_tx), Ok(slots_rx)) = (
            <[mpsc::Sender<Frame>; 5]>::try_from(senders),
            <[mpsc::Receiver<Frame>; 5]>::try_from(receivers),
        ) else {
            return;
        };
        let generation = self.next_generation;
        self.next_generation = self.next_generation.wrapping_add(1);
        let reader_task = tokio::spawn(reader_loop(
            peer,
            generation,
            reader,
            self.events.clone(),
            self.internal.clone(),
        ));
        let writer_task = tokio::spawn(writer_loop(
            peer,
            generation,
            write,
            slots_rx,
            self.internal.clone(),
        ));
        self.peers.insert(
            peer,
            PeerEntry {
                generation,
                address: identity.address,
                outbound,
                dialer,
                outbox: Outbox { slots: slots_tx },
                reader: reader_task,
                writer: writer_task,
                closed: waiting,
            },
        );
        // A replacement is the same peer on a better connection; the node already knows it.
        if !replacing {
            let _ = self
                .events
                .send(NetworkEvent::Connected {
                    peer,
                    address: identity.address,
                    tip_height: identity.hello.tip_height,
                    tip_hash: identity.hello.tip_hash,
                })
                .await;
        }
    }

    async fn remove(&mut self, peer: PeerId, reason: String) {
        if self.peers.remove(&peer).is_some() {
            let _ = self
                .events
                .send(NetworkEvent::Disconnected { peer, reason })
                .await;
        }
    }
}
