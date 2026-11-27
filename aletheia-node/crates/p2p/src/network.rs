//! The network service: listener, dialer, and one reader and one writer task per peer, all
//! owned by a single supervisor task (spec Sections 36, 46A.1).
//!
//! The node talks to it only through two bounded channels: [`NetworkCommand`] in,
//! [`NetworkEvent`] out. Peer exchange (ADR-070) happens here, out of the node's sight: the
//! supervisor keeps the address book, answers and asks for peers, and keeps connections to
//! the current validators and a few other peers. Peer state - outboxes, scores, bans - is owned by the supervisor;
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
    ADDRESS_BAN_DURATION, BAN_DURATION, DIAL_BACKOFF_INITIAL, DIAL_BACKOFF_MAX, MAX_INBOUND_PEERS,
    MAX_OUTBOUND_PEERS, MAX_PEERS_PER_IP, MAX_PENDING_HANDSHAKES, MIN_OUTBOUND_PEERS,
    NETWORK_COMMAND_QUEUE, NETWORK_EVENT_QUEUE, PEER_EXCHANGE_INTERVAL, PEER_OUTBOX_FRAMES,
    SCORE_INVALID, SCORE_RATE_EXCEEDED, SCORE_USEFUL,
};
use crate::message::{MAX_PEER_ADDRESSES, Message};
use crate::peer_book::PeerBook;
use crate::peer_score::PeerBudget;
use crate::tls::server_config;

/// A peer is identified by its Ed25519 node key.
pub type PeerId = [u8; 32];

#[derive(Debug, Clone)]
pub struct DialTarget {
    pub address: SocketAddr,
    pub expect: PeerExpectation,
}

/// A validator of the current epoch: its node key, and the SHA-256 of the transport
/// certificate registered for it, when one is (ADR-071).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatorPin {
    pub node_key: PeerId,
    /// The certificates it may present; empty (a genesis validator) is not pinned. Two during
    /// a certificate rotation (ADR-074).
    pub cert_hashes: Vec<Hash32>,
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
    /// To every connected peer but one: relaying what that peer sent (ADR-070).
    BroadcastExcept {
        except: PeerId,
        message: Message,
    },
    /// The current epoch's validators by node key, with their registered certificate hashes;
    /// the network keeps connections to every one whose address it knows (ADR-070) and refuses
    /// a validator connection whose certificate is not the registered one (ADR-071).
    SetValidators(Vec<ValidatorPin>),
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
    /// A peer-exchange message (ADR-070), handled by the supervisor and never shown to the node.
    Exchange {
        peer: PeerId,
        generation: u64,
        message: Message,
    },
}

struct PeerEntry {
    /// Distinguishes this connection from a later one to the same peer, so a late close
    /// notice from an old connection never removes its replacement.
    generation: u64,
    address: SocketAddr,
    /// SHA-256 of the certificate the peer presented.
    cert_hash: Hash32,
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

/// Peer arrivals and departures not yet handed to the node, per peer. The supervisor never
/// waits on the node's event queue: the node may itself be waiting to hand the supervisor a
/// command, and the two would wait on each other forever. Changes are kept here and delivered
/// as the queue has room. Per peer, a departure always comes before a later arrival, and an
/// arrival the node never saw is cancelled by the departure that follows it, so this holds at
/// most one entry per peer the node knows of or is about to learn of.
#[derive(Default)]
struct Lifecycle {
    pending: BTreeMap<PeerId, PendingChange>,
    /// Peers whose arrival the node has been told of and whose departure it has not.
    announced: std::collections::BTreeSet<PeerId>,
}

#[derive(Default)]
struct PendingChange {
    disconnected: Option<String>,
    connected: Option<(SocketAddr, Height, Hash32)>,
}

impl Lifecycle {
    fn connected(&mut self, peer: PeerId, address: SocketAddr, tip: (Height, Hash32)) {
        self.pending.entry(peer).or_default().connected = Some((address, tip.0, tip.1));
    }

    fn disconnected(&mut self, peer: PeerId, reason: String) {
        let entry = self.pending.entry(peer).or_default();
        // An arrival the node never saw needs no departure either.
        entry.connected = None;
        if self.announced.contains(&peer) && entry.disconnected.is_none() {
            entry.disconnected = Some(reason);
        }
        if entry.disconnected.is_none() {
            self.pending.remove(&peer);
        }
    }

    fn is_empty(&self) -> bool {
        self.pending.is_empty()
    }

    /// The next change to deliver, in per-peer order.
    fn next(&mut self) -> Option<NetworkEvent> {
        let (&peer, entry) = self.pending.iter_mut().next()?;
        let event = if let Some(reason) = entry.disconnected.take() {
            self.announced.remove(&peer);
            NetworkEvent::Disconnected { peer, reason }
        } else if let Some((address, tip_height, tip_hash)) = entry.connected.take() {
            self.announced.insert(peer);
            NetworkEvent::Connected {
                peer,
                address,
                tip_height,
                tip_hash,
            }
        } else {
            self.pending.remove(&peer);
            return self.next();
        };
        if entry.disconnected.is_none() && entry.connected.is_none() {
            self.pending.remove(&peer);
        }
        Some(event)
    }
}

/// The unit an address ban covers: the address itself for IPv4, its /64 for IPv6 (one host
/// commonly holds a whole /64).
fn address_scope(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V4(_) => ip,
        IpAddr::V6(v6) => {
            let mut octets = v6.octets();
            for byte in octets.iter_mut().skip(8) {
                *byte = 0;
            }
            IpAddr::V6(std::net::Ipv6Addr::from(octets))
        }
    }
}

struct Supervisor {
    local_id: PeerId,
    next_generation: u64,
    peers: BTreeMap<PeerId, PeerEntry>,
    banned: BTreeMap<PeerId, Instant>,
    /// Source addresses of banned inbound peers (IPv6 by /64), see [`ADDRESS_BAN_DURATION`].
    banned_addresses: BTreeMap<IpAddr, Instant>,
    lifecycle: Lifecycle,
    events: mpsc::Sender<NetworkEvent>,
    internal: mpsc::Sender<Internal>,
    tip: watch::Sender<(Height, Hash32)>,
    background: Vec<JoinHandle<()>>,
    local: Arc<LocalNode>,
    /// The port this node accepts connections on, announced to every peer.
    listen_port: u16,
    book: PeerBook,
    /// The current epoch's validators and their registered certificate hashes (ADR-071).
    validators: BTreeMap<PeerId, Vec<Hash32>>,
    /// Dial tasks started from the address book, by the key they are pinned to.
    dialers: BTreeMap<PeerId, JoinHandle<()>>,
}

impl Drop for Supervisor {
    fn drop(&mut self) {
        self.background.iter().for_each(JoinHandle::abort);
        self.dialers.values().for_each(JoinHandle::abort);
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
        local: Arc::clone(&local),
        listen_port: local_addr.port(),
        book: PeerBook::default(),
        validators: BTreeMap::new(),
        dialers: BTreeMap::new(),
        local_id: local.node_key.public_key().to_bytes(),
        next_generation: 0,
        peers: BTreeMap::new(),
        banned: BTreeMap::new(),
        banned_addresses: BTreeMap::new(),
        lifecycle: Lifecycle::default(),
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
        match PeerConnection::connect(target.address, &local, current_tip, target.expect.clone())
            .await
        {
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
        if !budget.admit(frame.channel, frame.payload.len(), Instant::now()) {
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
        if matches!(
            message,
            Message::ListenPort { .. }
                | Message::GetPeers
                | Message::Peers(_)
                | Message::UnknownMgmt { .. }
        ) {
            if internal
                .send(Internal::Exchange {
                    peer,
                    generation,
                    message,
                })
                .await
                .is_err()
            {
                return;
            }
            continue;
        }
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
        let mut exchange = tokio::time::interval(PEER_EXCHANGE_INTERVAL);
        exchange.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            let deliver = !self.lifecycle.is_empty();
            let events = self.events.clone();
            tokio::select! {
                Some(command) = commands.recv() => self.handle_command(command).await,
                Some(message) = internal.recv() => self.handle_internal(message).await,
                _ = exchange.tick() => {
                    let peers: Vec<PeerId> = self.peers.keys().copied().collect();
                    for peer in peers {
                        self.send_to(peer, &Message::GetPeers).await;
                    }
                    self.maintain();
                }
                permit = events.reserve(), if deliver => match permit {
                    Ok(permit) => {
                        if let Some(event) = self.lifecycle.next() {
                            permit.send(event);
                        }
                    }
                    // The node is gone; nothing will read what the network has to say.
                    Err(_) => return,
                },
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
            NetworkCommand::BroadcastExcept { except, message } => {
                let peers: Vec<PeerId> = self
                    .peers
                    .keys()
                    .copied()
                    .filter(|peer| *peer != except)
                    .collect();
                for peer in peers {
                    self.send_to(peer, &message).await;
                }
            }
            NetworkCommand::SetValidators(pins) => {
                let next: BTreeMap<PeerId, Vec<Hash32>> = pins
                    .into_iter()
                    .filter(|pin| pin.node_key != self.local_id)
                    .map(|pin| (pin.node_key, pin.cert_hashes))
                    .collect();
                // A dial task pinned to an old certificate hash starts again with the new one.
                self.dialers.retain(|key, task| {
                    let same = next.get(key) == self.validators.get(key);
                    if !same {
                        task.abort();
                    }
                    same
                });
                self.validators = next;
                // A connected validator whose certificate is not the registered one goes.
                let mismatched: Vec<PeerId> = self
                    .peers
                    .iter()
                    .filter(|(key, entry)| self.pin_refuses(key, entry.cert_hash))
                    .map(|(key, _)| *key)
                    .collect();
                for peer in mismatched {
                    self.remove(
                        peer,
                        "its transport certificate is not the one registered for this validator"
                            .to_owned(),
                    )
                    .await;
                }
                self.maintain();
            }
            NetworkCommand::SetTip { height, hash } => {
                let _ = self.tip.send((height, hash));
            }
        }
    }

    /// Whether `peer` is a pinned validator and `cert_hash` is none of its certificates.
    fn pin_refuses(&self, peer: &PeerId, cert_hash: Hash32) -> bool {
        matches!(self.validators.get(peer), Some(pins) if !pins.is_empty() && !pins.contains(&cert_hash))
    }

    /// Starts dial tasks, pinned to their keys, for every validator this node knows an address
    /// for and is not connected to, and for other known peers while fewer than
    /// [`MIN_OUTBOUND_PEERS`] outbound connections are open; stops the tasks of peers no longer
    /// wanted. Dial tasks already redial on their own after a disconnect.
    fn maintain(&mut self) {
        self.dialers.retain(|_, task| !task.is_finished());
        let outbound = self.peers.values().filter(|e| e.outbound).count();
        let mut wanted: std::collections::BTreeSet<PeerId> =
            self.validators.keys().copied().collect();
        let spare = MIN_OUTBOUND_PEERS.saturating_sub(outbound);
        if spare > 0 {
            for key in self.book.known() {
                if wanted.len() >= self.validators.len().saturating_add(spare) {
                    break;
                }
                if !self.peers.contains_key(&key) && key != self.local_id {
                    wanted.insert(key);
                }
            }
        }
        // Tasks for peers that are neither validators nor needed for spare capacity stop.
        let keep: std::collections::BTreeSet<PeerId> = wanted
            .iter()
            .copied()
            .chain(
                self.peers
                    .keys()
                    .copied()
                    .filter(|k| self.dialers.contains_key(k)),
            )
            .collect();
        self.dialers.retain(|key, task| {
            let stay = keep.contains(key);
            if !stay {
                task.abort();
            }
            stay
        });
        for key in wanted {
            if self.dialers.contains_key(&key)
                || self.peers.contains_key(&key)
                || self.dialers.len() >= MAX_OUTBOUND_PEERS
            {
                continue;
            }
            let Some(address) = self.book.address(&key) else {
                continue;
            };
            let target = DialTarget {
                address,
                expect: PeerExpectation {
                    node_key: Some(key),
                    cert_hashes: self.validators.get(&key).cloned().unwrap_or_default(),
                },
            };
            let task = tokio::spawn(dial_loop(
                target,
                Arc::clone(&self.local),
                self.tip.subscribe(),
                self.internal.clone(),
            ));
            self.dialers.insert(key, task);
        }
    }

    async fn handle_exchange(&mut self, peer: PeerId, message: Message) {
        match message {
            Message::ListenPort { port } => {
                // Where an inbound peer accepts connections: its address with the announced port.
                if let Some(entry) = self.peers.get(&peer)
                    && !entry.outbound
                    && port != 0
                {
                    let address = SocketAddr::new(entry.address.ip(), port);
                    self.book.learn_live(peer, address);
                    self.maintain();
                }
            }
            Message::GetPeers => {
                let answer = self
                    .book
                    .answer(usize::try_from(MAX_PEER_ADDRESSES).unwrap_or(64), &peer);
                self.send_to(peer, &Message::Peers(answer)).await;
            }
            Message::Peers(list) => {
                for hint in list {
                    self.book.learn_hint(&self.local_id, hint);
                }
                self.maintain();
            }
            // A later release's management message: nothing to do.
            _ => {}
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
            Internal::Exchange {
                peer,
                generation,
                message,
            } => {
                if self
                    .peers
                    .get(&peer)
                    .is_some_and(|entry| entry.generation == generation)
                {
                    self.handle_exchange(peer, message).await;
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
                    if let Some(entry) = self.peers.get(&peer)
                        && !entry.outbound
                    {
                        self.banned_addresses.insert(
                            address_scope(entry.address.ip()),
                            now.checked_add(ADDRESS_BAN_DURATION).unwrap_or(now),
                        );
                    }
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

    fn is_address_banned(&mut self, ip: IpAddr) -> bool {
        let now = Instant::now();
        self.banned_addresses.retain(|_, until| *until > now);
        self.banned_addresses.contains_key(&address_scope(ip))
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
        if self.is_banned(&peer) || (!outbound && self.is_address_banned(identity.address.ip())) {
            return;
        }
        // A validator must present the certificate registered for it (ADR-071).
        if self.pin_refuses(&peer, identity.cert_hash) {
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
                cert_hash: identity.cert_hash,
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
            self.lifecycle.connected(
                peer,
                identity.address,
                (identity.hello.tip_height, identity.hello.tip_hash),
            );
        }
        // Peer exchange (ADR-070): an address we reached the peer at is a live one; tell the
        // peer where we accept connections and ask whom it knows.
        if outbound {
            self.book.learn_live(peer, identity.address);
        }
        let port = self.listen_port;
        self.send_to(peer, &Message::ListenPort { port }).await;
        self.send_to(peer, &Message::GetPeers).await;
    }

    async fn remove(&mut self, peer: PeerId, reason: String) {
        if self.peers.remove(&peer).is_some() {
            self.lifecycle.disconnected(peer, reason);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn address() -> SocketAddr {
        "127.0.0.1:1".parse().unwrap()
    }

    fn drain(lifecycle: &mut Lifecycle) -> Vec<NetworkEvent> {
        std::iter::from_fn(|| lifecycle.next()).collect()
    }

    #[test]
    fn an_arrival_the_node_never_saw_is_cancelled_by_its_departure() {
        let mut lifecycle = Lifecycle::default();
        lifecycle.connected([1; 32], address(), (Height::GENESIS, Hash32::ZERO));
        lifecycle.disconnected([1; 32], "gone".to_owned());
        assert!(lifecycle.is_empty());
        assert!(drain(&mut lifecycle).is_empty());
    }

    #[test]
    fn a_known_peer_that_reconnects_departs_before_it_arrives_again() {
        let mut lifecycle = Lifecycle::default();
        lifecycle.connected([1; 32], address(), (Height::GENESIS, Hash32::ZERO));
        assert!(matches!(
            drain(&mut lifecycle).as_slice(),
            [NetworkEvent::Connected { .. }]
        ));
        lifecycle.disconnected([1; 32], "first".to_owned());
        lifecycle.connected([1; 32], address(), (Height::GENESIS, Hash32::ZERO));
        lifecycle.disconnected([1; 32], "second".to_owned());
        lifecycle.connected([1; 32], address(), (Height::GENESIS, Hash32::ZERO));
        let events = drain(&mut lifecycle);
        assert!(
            matches!(
                events.as_slice(),
                [
                    NetworkEvent::Disconnected { reason, .. },
                    NetworkEvent::Connected { .. }
                ] if reason == "first"
            ),
            "{events:?}"
        );
    }

    #[test]
    fn address_bans_cover_an_ipv6_slash_64_and_one_ipv4_address() {
        let a: IpAddr = "2001:db8:1:2:aaaa::1".parse().unwrap();
        let b: IpAddr = "2001:db8:1:2:bbbb::9".parse().unwrap();
        let other: IpAddr = "2001:db8:1:3::1".parse().unwrap();
        assert_eq!(address_scope(a), address_scope(b));
        assert_ne!(address_scope(a), address_scope(other));
        let v4: IpAddr = "192.0.2.7".parse().unwrap();
        assert_eq!(address_scope(v4), v4);
    }

    #[test]
    fn a_departure_of_an_unknown_peer_is_not_reported() {
        let mut lifecycle = Lifecycle::default();
        lifecycle.disconnected([2; 32], "never announced".to_owned());
        assert!(lifecycle.is_empty());
    }
}
