//! WebSocket subscriptions at `/ws/v1` (spec Section 37, ADR-064).
//!
//! The socket speaks JSON-RPC 2.0. Any method the HTTP interface offers can be called over it,
//! and three topics can be subscribed to:
//!
//! ```text
//! → {"jsonrpc":"2.0","id":1,"method":"subscribe","params":{"topic":"finalizedBlocks"}}
//! → {"jsonrpc":"2.0","id":2,"method":"subscribe","params":{"topic":"transactionStatus","txId":"alt:T…"}}
//! → {"jsonrpc":"2.0","id":3,"method":"subscribe","params":{"topic":"account","address":"alt:…"}}
//! ← {"jsonrpc":"2.0","id":1,"result":{"subscription":"1"}}
//! ← {"jsonrpc":"2.0","method":"subscription","params":{"subscription":"1","result":{…}}}
//! → {"jsonrpc":"2.0","id":4,"method":"unsubscribe","params":{"subscription":"1"}}
//! ```
//!
//! Everything delivered is finalized. One follower per server reads each newly finalized block
//! once and fans it out to every connection; a connection that falls behind the buffer is sent a
//! `gap` notice (and should re-read by height) rather than holding the node back. Connections,
//! subscriptions per connection and message sizes are bounded.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use aletheia_core::Hash32;
use aletheia_core::block::Proposal;
use aletheia_core::tx::Payload;
use serde_json::{Map, Value, json};
use tokio::sync::{OwnedSemaphorePermit, Semaphore, broadcast};

use crate::backend::{Backend, BlockRef};
use crate::encode::{address_text, block_summary, parse_address, parse_tx_id, tx_text};
use crate::error::RpcError;
use crate::service::Service;

/// Open sockets per server.
pub const MAX_CONNECTIONS: usize = 1_024;
/// Subscriptions per socket.
pub const MAX_SUBSCRIPTIONS: usize = 32;
/// Largest message a client may send.
pub const MAX_MESSAGE_BYTES: usize = 64 * 1024;
/// Finalized blocks buffered for slow sockets before they are told of a gap.
const BUFFER: usize = 256;
/// How often the follower looks for a new finalized height.
const FOLLOW_EVERY: Duration = Duration::from_millis(200);
/// Blocks read per follower tick; a larger jump is reported as a gap.
const CATCH_UP: u64 = 64;
/// Ping interval, so proxies keep the socket open and dead peers are noticed.
pub const PING_EVERY: Duration = Duration::from_secs(15);

/// One finalized block as the subscriptions need it.
#[derive(Debug)]
pub struct BlockEvent {
    pub height: u64,
    pub summary: Value,
    /// Per transaction: its id and the accounts it touches, in canonical text.
    pub txs: Vec<(Hash32, Vec<String>)>,
}

#[derive(Debug, Clone)]
pub enum Fanout {
    Block(Arc<BlockEvent>),
    /// Heights the follower skipped (the node jumped further than one tick reads).
    Skipped {
        from: u64,
        to: u64,
    },
}

/// The shared side: the broadcast channel, the connection budget, the follower flag.
#[derive(Debug)]
pub struct Hub {
    sender: broadcast::Sender<Fanout>,
    connections: Arc<Semaphore>,
    following: AtomicBool,
}

impl Default for Hub {
    fn default() -> Self {
        Hub {
            sender: broadcast::channel(BUFFER).0,
            connections: Arc::new(Semaphore::new(MAX_CONNECTIONS)),
            following: AtomicBool::new(false),
        }
    }
}

impl Hub {
    pub fn admit(&self) -> Option<OwnedSemaphorePermit> {
        self.connections.clone().try_acquire_owned().ok()
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Fanout> {
        self.sender.subscribe()
    }

    /// Starts the follower the first time anyone connects.
    pub fn ensure_follower<B: Backend + 'static>(self: &Arc<Self>, service: Arc<Service<B>>) {
        if self.following.swap(true, Ordering::SeqCst) {
            return;
        }
        let hub = Arc::clone(self);
        tokio::spawn(async move { hub.follow(service).await });
    }

    async fn follow<B: Backend>(&self, service: Arc<Service<B>>) {
        let network = service.backend.network();
        let mut last: Option<u64> = None;
        loop {
            tokio::time::sleep(FOLLOW_EVERY).await;
            let Ok(status) = service.backend.status().await else {
                continue;
            };
            let tip = status.finalized_height;
            let Some(seen) = last else {
                last = Some(tip);
                continue;
            };
            if tip <= seen {
                continue;
            }
            let mut from = seen.saturating_add(1);
            if tip.saturating_sub(seen) > CATCH_UP {
                let skip_to = tip.saturating_sub(CATCH_UP);
                let _ = self.sender.send(Fanout::Skipped { from, to: skip_to });
                from = skip_to.saturating_add(1);
            }
            for height in from..=tip {
                match service.backend.block(BlockRef::Height(height)).await {
                    Ok(Some(proposal)) => {
                        let _ = self
                            .sender
                            .send(Fanout::Block(Arc::new(event(&network, &proposal))));
                        last = Some(height);
                    }
                    // Read again next tick.
                    _ => break,
                }
            }
        }
    }
}

fn event(network: &aletheia_core::NetworkIdentity, proposal: &Proposal) -> BlockEvent {
    let txs = proposal
        .block
        .body
        .transactions
        .iter()
        .map(|tx| {
            let mut accounts = vec![address_text(network, &tx.body.sender)];
            match &tx.body.payload {
                Payload::Transfer(leg) => accounts.push(address_text(network, &leg.recipient)),
                Payload::BatchTransfer(legs) => {
                    accounts.extend(legs.iter().map(|l| address_text(network, &l.recipient)))
                }
                _ => {}
            }
            (tx.body.tx_id(network).hash(), accounts)
        })
        .collect();
    BlockEvent {
        height: proposal.block.header.height.get(),
        summary: block_summary(network, proposal),
        txs,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Topic {
    FinalizedBlocks,
    TransactionStatus(Hash32),
    Account(String),
}

/// One socket's subscriptions and the replies they produce. Transport-free so it can be tested
/// without a socket.
#[derive(Debug, Default)]
pub struct Session {
    subscriptions: Vec<(String, Topic)>,
    next: u64,
}

fn reply(id: &Value, result: Result<Value, RpcError>) -> String {
    match result {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err(error) => json!({ "jsonrpc": "2.0", "id": id, "error": error.to_json() }),
    }
    .to_string()
}

fn notify(subscription: &str, result: Value) -> String {
    json!({ "jsonrpc": "2.0", "method": "subscription", "params": { "subscription": subscription, "result": result } }).to_string()
}

fn text<'a>(params: &'a Map<String, Value>, name: &str) -> Result<&'a str, RpcError> {
    params
        .get(name)
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::invalid_params(format!("\"{name}\" (a string) is required")))
}

impl Session {
    pub fn len(&self) -> usize {
        self.subscriptions.len()
    }

    pub fn is_empty(&self) -> bool {
        self.subscriptions.is_empty()
    }

    /// Handles one client message; returns the messages to send back, in order.
    pub async fn handle<B: Backend>(&mut self, service: &Service<B>, message: &str) -> Vec<String> {
        let parsed: Option<Value> = serde_json::from_str(message).ok();
        let method = parsed
            .as_ref()
            .and_then(|v| v.get("method"))
            .and_then(Value::as_str);
        let (Some(request), Some(method @ ("subscribe" | "unsubscribe"))) =
            (parsed.as_ref(), method)
        else {
            // Everything else is an ordinary JSON-RPC call (or batch) over the socket.
            return crate::jsonrpc::handle(service, message.as_bytes())
                .await
                .into_iter()
                .collect();
        };
        let id = request.get("id").cloned().unwrap_or(Value::Null);
        let empty = Map::new();
        let params = request
            .get("params")
            .and_then(Value::as_object)
            .unwrap_or(&empty);
        if method == "unsubscribe" {
            let result = text(params, "subscription").map(|wanted| {
                let before = self.subscriptions.len();
                self.subscriptions.retain(|(sid, _)| sid != wanted);
                Value::Bool(self.subscriptions.len() < before)
            });
            return vec![reply(&id, result)];
        }
        if self.subscriptions.len() >= MAX_SUBSCRIPTIONS {
            return vec![reply(
                &id,
                Err(RpcError::invalid_request(format!(
                    "at most {MAX_SUBSCRIPTIONS} subscriptions per connection"
                ))),
            )];
        }
        let network = service.backend.network();
        let topic = match text(params, "topic") {
            Ok("finalizedBlocks") => Ok(Topic::FinalizedBlocks),
            Ok("transactionStatus") => text(params, "txId")
                .and_then(|t| parse_tx_id(&network, t))
                .map(Topic::TransactionStatus),
            Ok("account") => text(params, "address")
                .and_then(|a| parse_address(&network, a))
                .map(|a| Topic::Account(address_text(&network, &a))),
            Ok(other) => Err(RpcError::invalid_params(format!(
                "unknown topic \"{other}\" (finalizedBlocks, transactionStatus, account)"
            ))),
            Err(e) => Err(e),
        };
        let topic = match topic {
            Ok(topic) => topic,
            Err(error) => return vec![reply(&id, Err(error))],
        };
        self.next = self.next.saturating_add(1);
        let sid = self.next.to_string();
        let mut out = vec![reply(&id, Ok(json!({ "subscription": sid })))];
        // A transaction finalized before the subscription is answered at once.
        if let Topic::TransactionStatus(hash) = &topic
            && let Ok(tx) = service.transaction(*hash).await
        {
            out.push(notify(&sid, tx));
            return out;
        }
        self.subscriptions.push((sid, topic));
        out
    }

    /// Notifications for one fanned-out event.
    pub async fn deliver<B: Backend>(
        &mut self,
        service: &Service<B>,
        fanout: &Fanout,
    ) -> Vec<String> {
        let mut out = Vec::new();
        match fanout {
            Fanout::Skipped { from, to } => {
                for (sid, _) in &self.subscriptions {
                    out.push(notify(
                        sid,
                        json!({ "gap": { "fromHeight": from, "toHeight": to } }),
                    ));
                }
            }
            Fanout::Block(block) => {
                let network = service.backend.network();
                let mut done = Vec::new();
                for (sid, topic) in &self.subscriptions {
                    match topic {
                        Topic::FinalizedBlocks => out.push(notify(sid, block.summary.clone())),
                        Topic::TransactionStatus(hash) => {
                            if block.txs.iter().any(|(id, _)| id == hash) {
                                let result = service
                                    .transaction(*hash)
                                    .await
                                    .unwrap_or_else(|_| json!({ "txId": tx_text(&network, *hash), "status": "FINALIZED", "block": { "height": block.height } }));
                                out.push(notify(sid, result));
                                done.push(sid.clone());
                            }
                        }
                        Topic::Account(address) => {
                            for (id, accounts) in &block.txs {
                                if accounts.contains(address)
                                    && let Ok(tx) = service.transaction(*id).await
                                {
                                    out.push(notify(
                                        sid,
                                        json!({ "address": address, "transaction": tx }),
                                    ));
                                }
                            }
                        }
                    }
                }
                self.subscriptions.retain(|(sid, _)| !done.contains(sid));
            }
        }
        out
    }

    /// The notice a socket gets when it fell behind the buffer.
    pub fn lagged(&self, missed: u64) -> Vec<String> {
        self.subscriptions
            .iter()
            .map(|(sid, _)| notify(sid, json!({ "gap": { "missedBlocks": missed } })))
            .collect()
    }
}
