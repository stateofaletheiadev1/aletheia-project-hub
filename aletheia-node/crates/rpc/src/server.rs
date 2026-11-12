//! The HTTP server (Section 37): `POST /rpc/v1`, `/api/v1/…` and the `/ws/v1` WebSocket on Axum
//! and Hyper, over the same service. Bodies are capped at 1 MiB, each client has a request
//! budget per second (JSON-RPC `-32001`, HTTP 429 beyond it; every WebSocket message counts),
//! and no CORS headers are sent (CORS off by default).
//!
//! A client is its IP address or, when it presents one, its API key (ADR-066). Behind a reverse
//! proxy listed in `trusted_proxies`, the client IP is read from `X-Forwarded-For`; from any
//! other peer the header is ignored. API keys are configured as BLAKE3 hashes only and each has
//! its own budget; a key that matches none is refused (401), never downgraded silently.

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, RawQuery, State};
use axum::http::{HeaderMap, Method, StatusCode, Uri, header};
use axum::response::Response;
use axum::routing::{any, get, post};
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;

use crate::backend::Backend;
use crate::error::RpcError;
use crate::jsonrpc::{self, MAX_BODY_BYTES};
use crate::rest;
use crate::service::Service;
use crate::ws::{Hub, MAX_MESSAGE_BYTES, PING_EVERY, Session};

/// Requests per second per client IP, unless configured otherwise.
pub const DEFAULT_REQUESTS_PER_SECOND: u32 = 50;

/// The BLAKE3 key-derivation context API keys are hashed under.
const API_KEY_CONTEXT: &str = "AletheiaChain 2026-11-12 RPC API key v1";

/// The hash an operator configures for an API key; the key itself is never stored.
pub fn api_key_hash(key: &str) -> [u8; 32] {
    blake3::derive_key(API_KEY_CONTEXT, key.as_bytes())
}

/// An API key the server accepts, by hash, with its own budget.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApiKey {
    /// For the operator's configuration; never sent to clients.
    pub name: String,
    pub hash: [u8; 32],
    pub requests_per_second: u32,
}

/// How the server tells clients apart and how much each may ask.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerConfig {
    /// Budget per client IP (clients without a key).
    pub requests_per_second: u32,
    /// Reverse proxies whose `X-Forwarded-For` is believed.
    pub trusted_proxies: Vec<IpAddr>,
    pub api_keys: Vec<ApiKey>,
}

impl ServerConfig {
    pub fn per_ip(requests_per_second: u32) -> ServerConfig {
        ServerConfig {
            requests_per_second,
            trusted_proxies: Vec::new(),
            api_keys: Vec::new(),
        }
    }
}

/// Whose budget a request spends.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Client {
    Ip(IpAddr),
    /// An index into `ServerConfig::api_keys`.
    Key(usize),
}

#[derive(Debug)]
struct Limiter {
    config: ServerConfig,
    windows: Mutex<HashMap<Client, (Instant, u32)>>,
}

/// Above this many tracked addresses, windows that have ended are dropped before a new one is
/// added, so a sender rotating source addresses (an IPv6 /64 holds 2^64) cannot grow the map
/// without bound: it holds at most the addresses seen in the last second.
const PRUNE_ABOVE: usize = 4_096;

impl Limiter {
    fn new(config: ServerConfig) -> Limiter {
        Limiter {
            config,
            windows: Mutex::new(HashMap::new()),
        }
    }

    /// Who is asking: the API key presented (`Authorization: Bearer …` or `X-Api-Key`), else the
    /// client IP. `Err` for a key that matches no configured key.
    fn client(&self, peer: IpAddr, headers: &HeaderMap) -> Result<Client, ()> {
        let presented = headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .or_else(|| headers.get("x-api-key").and_then(|v| v.to_str().ok()));
        if let Some(key) = presented {
            let hash = blake3::Hash::from(api_key_hash(key.trim()));
            // Every configured key is compared, in constant time, whichever matches.
            let mut found = None;
            for (index, known) in self.config.api_keys.iter().enumerate() {
                if hash == blake3::Hash::from(known.hash) && found.is_none() {
                    found = Some(index);
                }
            }
            return found.map(Client::Key).ok_or(());
        }
        Ok(Client::Ip(self.client_ip(peer, headers)))
    }

    /// The peer, or behind a trusted proxy the right-most `X-Forwarded-For` address that is not
    /// itself a trusted proxy (entries further left are client-supplied and not believed). A
    /// malformed header leaves the peer's own address.
    fn client_ip(&self, peer: IpAddr, headers: &HeaderMap) -> IpAddr {
        let trusted = |ip: &IpAddr| self.config.trusted_proxies.contains(ip);
        if !trusted(&peer) {
            return peer;
        }
        let mut chain: Vec<IpAddr> = Vec::new();
        for value in headers.get_all("x-forwarded-for") {
            let Ok(text) = value.to_str() else {
                return peer;
            };
            for part in text.split(',') {
                match part.trim().parse::<IpAddr>() {
                    Ok(ip) => chain.push(ip),
                    Err(_) => return peer,
                }
            }
        }
        chain
            .into_iter()
            .rev()
            .find(|ip| !trusted(ip))
            .unwrap_or(peer)
    }

    fn budget(&self, client: Client) -> u32 {
        match client {
            Client::Ip(_) => self.config.requests_per_second,
            Client::Key(index) => self
                .config
                .api_keys
                .get(index)
                .map_or(0, |k| k.requests_per_second),
        }
    }

    /// Whether `client` may make `calls` more calls in the current one-second window.
    fn allow(&self, client: Client, calls: u32) -> bool {
        let budget = self.budget(client);
        let Ok(mut windows) = self.windows.lock() else {
            return false;
        };
        let now = Instant::now();
        if windows.len() >= PRUNE_ABOVE && !windows.contains_key(&client) {
            windows.retain(|_, (start, _)| now.duration_since(*start).as_secs() < 1);
        }
        let entry = windows.entry(client).or_insert((now, 0));
        if now.duration_since(entry.0).as_secs() >= 1 {
            *entry = (now, 0);
        }
        entry.1 = entry.1.saturating_add(calls);
        entry.1 <= budget
    }
}

fn unauthorized() -> Response {
    json_response(
        401,
        serde_json::json!({ "error": { "name": "UNKNOWN_API_KEY", "message": "the API key is not recognised; send none to use the public budget" } })
            .to_string(),
    )
}

#[derive(Debug)]
struct Shared<B: Backend> {
    service: Arc<Service<B>>,
    limiter: Limiter,
    hub: Arc<Hub>,
}

fn json_response(status: u16, body: String) -> Response {
    Response::builder()
        .status(StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body))
        .unwrap_or_else(|_| Response::new(Body::empty()))
}

async fn rpc<B: Backend + 'static>(
    State(shared): State<Arc<Shared<B>>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Ok(client) = shared.limiter.client(peer.ip(), &headers) else {
        return unauthorized();
    };
    if !shared.limiter.allow(client, jsonrpc::calls_in(&body)) {
        let error = serde_json::json!({ "jsonrpc": "2.0", "id": null, "error": RpcError::rate_limited().to_json() });
        return json_response(429, error.to_string());
    }
    match jsonrpc::handle(&shared.service, &body).await {
        Some(answer) => json_response(200, answer),
        // Only notifications: nothing to answer.
        None => Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty())
            .unwrap_or_else(|_| Response::new(Body::empty())),
    }
}

/// Decodes `%XX` escapes and `+` in a query component.
fn decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0usize;
    while let Some(&b) = bytes.get(i) {
        match b {
            b'+' => out.push(b' '),
            b'%' => {
                let hex = bytes.get(i.saturating_add(1)..i.saturating_add(3));
                match hex
                    .and_then(|h| core::str::from_utf8(h).ok())
                    .and_then(|h| u8::from_str_radix(h, 16).ok())
                {
                    Some(value) => {
                        out.push(value);
                        i = i.saturating_add(2);
                    }
                    None => out.push(b),
                }
            }
            other => out.push(other),
        }
        i = i.saturating_add(1);
    }
    String::from_utf8_lossy(&out).into_owned()
}

async fn api<B: Backend + 'static>(
    State(shared): State<Arc<Shared<B>>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    method: Method,
    uri: Uri,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Ok(client) = shared.limiter.client(peer.ip(), &headers) else {
        return unauthorized();
    };
    if !shared.limiter.allow(client, 1) {
        return json_response(429, RpcError::rate_limited().to_rest().to_string());
    }
    let path = decode(uri.path().strip_prefix("/api/v1").unwrap_or(""));
    let pairs: Vec<(String, String)> = query
        .unwrap_or_default()
        .split('&')
        .filter(|p| !p.is_empty())
        .map(|p| {
            let (k, v) = p.split_once('=').unwrap_or((p, ""));
            (decode(k), decode(v))
        })
        .collect();
    let answer = rest::route(&shared.service, method.as_str(), &path, &pairs, &body).await;
    json_response(answer.status, answer.body.to_string())
}

async fn ws<B: Backend + 'static>(
    State(shared): State<Arc<Shared<B>>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    upgrade: WebSocketUpgrade,
) -> Response {
    let Ok(client) = shared.limiter.client(peer.ip(), &headers) else {
        return unauthorized();
    };
    if !shared.limiter.allow(client, 1) {
        return json_response(429, RpcError::rate_limited().to_rest().to_string());
    }
    let Some(permit) = shared.hub.admit() else {
        return json_response(503, serde_json::json!({ "error": { "name": "TOO_MANY_CONNECTIONS", "message": "the WebSocket connection limit is reached; retry later" } }).to_string());
    };
    shared.hub.ensure_follower(Arc::clone(&shared.service));
    upgrade
        .max_message_size(MAX_MESSAGE_BYTES)
        .max_frame_size(MAX_MESSAGE_BYTES)
        .on_upgrade(move |socket| async move {
            connection(shared, socket, client).await;
            drop(permit);
        })
}

/// One socket: client messages, fanned-out blocks and pings, until either side closes.
async fn connection<B: Backend + 'static>(
    shared: Arc<Shared<B>>,
    socket: WebSocket,
    client: Client,
) {
    let (mut sink, mut stream) = socket.split();
    let mut events = shared.hub.subscribe();
    let mut session = Session::default();
    let mut ping = tokio::time::interval(PING_EVERY);
    ping.tick().await;
    loop {
        let outgoing: Vec<String> = tokio::select! {
            incoming = stream.next() => match incoming {
                Some(Ok(Message::Text(text))) => {
                    if shared.limiter.allow(client, jsonrpc::calls_in(text.as_bytes())) {
                        session.handle(&shared.service, text.as_str()).await
                    } else {
                        vec![serde_json::json!({ "jsonrpc": "2.0", "id": null, "error": RpcError::rate_limited().to_json() }).to_string()]
                    }
                }
                Some(Ok(Message::Binary(_))) => {
                    vec![serde_json::json!({ "jsonrpc": "2.0", "id": null, "error": RpcError::invalid_request("messages are JSON text").to_json() }).to_string()]
                }
                Some(Ok(Message::Ping(_) | Message::Pong(_))) => Vec::new(),
                Some(Ok(Message::Close(_)) | Err(_)) | None => break,
            },
            fanout = events.recv(), if !session.is_empty() => match fanout {
                Ok(fanout) => session.deliver(&shared.service, &fanout).await,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(missed)) => session.lagged(missed),
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            },
            _ = ping.tick() => {
                if sink.send(Message::Ping(Bytes::new())).await.is_err() {
                    break;
                }
                Vec::new()
            }
        };
        for text in outgoing {
            if sink.send(Message::Text(text.into())).await.is_err() {
                return;
            }
        }
        // A socket idle on events drains its receiver so it does not report stale lag later.
        if session.is_empty() {
            events = events.resubscribe();
        }
    }
    let _ = sink.close().await;
}

/// The router with a per-IP budget only, for embedding in tests or another server.
pub fn router<B: Backend + 'static>(service: Service<B>, requests_per_second: u32) -> Router {
    router_with(service, ServerConfig::per_ip(requests_per_second))
}

/// The router with trusted proxies and API keys.
pub fn router_with<B: Backend + 'static>(service: Service<B>, config: ServerConfig) -> Router {
    let shared = Arc::new(Shared {
        service: Arc::new(service),
        limiter: Limiter::new(config),
        hub: Arc::new(Hub::default()),
    });
    Router::new()
        .route("/rpc/v1", post(rpc::<B>))
        .route("/ws/v1", get(ws::<B>))
        .route("/api/v1/{*path}", any(api::<B>))
        .layer(axum::extract::DefaultBodyLimit::max(MAX_BODY_BYTES))
        .with_state(shared)
}

/// Serves with a per-IP budget only, until the listener fails or the task is dropped.
pub async fn serve<B: Backend + 'static>(
    listener: TcpListener,
    service: Service<B>,
    requests_per_second: u32,
) -> std::io::Result<()> {
    serve_with(listener, service, ServerConfig::per_ip(requests_per_second)).await
}

/// Serves with trusted proxies and API keys, until the listener fails or the task is dropped.
pub async fn serve_with<B: Backend + 'static>(
    listener: TcpListener,
    service: Service<B>,
    config: ServerConfig,
) -> std::io::Result<()> {
    let app = router_with(service, config);
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(text: &str) -> Client {
        Client::Ip(text.parse().unwrap())
    }

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.append(*name, value.parse().unwrap());
        }
        map
    }

    fn with_key(per_ip: u32, key: &str, per_key: u32) -> Limiter {
        Limiter::new(ServerConfig {
            requests_per_second: per_ip,
            trusted_proxies: vec!["127.0.0.1".parse().unwrap()],
            api_keys: vec![ApiKey {
                name: "explorer".to_owned(),
                hash: api_key_hash(key),
                requests_per_second: per_key,
            }],
        })
    }

    #[test]
    fn a_batch_spends_one_unit_per_call() {
        let limiter = Limiter::new(ServerConfig::per_ip(10));
        assert!(limiter.allow(ip("192.0.2.1"), 10));
        assert!(
            !limiter.allow(ip("192.0.2.1"), 1),
            "a 10-call batch used the whole budget"
        );
    }

    #[test]
    fn rotating_addresses_cannot_grow_the_limiter_without_bound() {
        let limiter = Limiter::new(ServerConfig::per_ip(10));
        for i in 0..u32::try_from(PRUNE_ABOVE + 10).unwrap() {
            let address = IpAddr::V6(std::net::Ipv6Addr::from(u128::from(i)));
            limiter.allow(Client::Ip(address), 1);
        }
        // Every window is still within its second, so none could be dropped yet; once they
        // end, the next new address prunes them.
        {
            let mut windows = limiter.windows.lock().unwrap();
            let past = Instant::now() - std::time::Duration::from_secs(2);
            for (start, _) in windows.values_mut() {
                *start = past;
            }
        }
        limiter.allow(ip("2001:db8::1"), 1);
        assert_eq!(limiter.windows.lock().unwrap().len(), 1);
    }

    #[test]
    fn forwarded_addresses_are_believed_only_from_a_trusted_proxy() {
        let limiter = with_key(5, "k", 5);
        let peer = |text: &str| text.parse::<IpAddr>().unwrap();
        let forwarded = headers(&[("x-forwarded-for", "198.51.100.7")]);
        // From the trusted proxy: the forwarded client.
        assert_eq!(
            limiter.client(peer("127.0.0.1"), &forwarded),
            Ok(ip("198.51.100.7"))
        );
        // From anyone else: the header is ignored.
        assert_eq!(
            limiter.client(peer("203.0.113.9"), &forwarded),
            Ok(ip("203.0.113.9"))
        );
        // A client cannot pick its address by prepending entries: the right-most untrusted
        // one (what the proxy saw) counts.
        let spoofed = headers(&[("x-forwarded-for", "10.9.9.9, 198.51.100.7")]);
        assert_eq!(
            limiter.client(peer("127.0.0.1"), &spoofed),
            Ok(ip("198.51.100.7"))
        );
        let chained = headers(&[("x-forwarded-for", "198.51.100.7, 127.0.0.1")]);
        assert_eq!(
            limiter.client(peer("127.0.0.1"), &chained),
            Ok(ip("198.51.100.7"))
        );
        let garbage = headers(&[("x-forwarded-for", "not-an-ip")]);
        assert_eq!(
            limiter.client(peer("127.0.0.1"), &garbage),
            Ok(ip("127.0.0.1"))
        );
        // Two visitors behind the proxy now have separate budgets.
        for _ in 0..5 {
            assert!(limiter.allow(ip("198.51.100.7"), 1));
        }
        assert!(!limiter.allow(ip("198.51.100.7"), 1));
        assert!(limiter.allow(ip("198.51.100.8"), 1));
    }

    #[test]
    fn api_keys_have_their_own_budget_and_unknown_keys_are_refused() {
        let limiter = with_key(2, "s3cret-key", 100);
        let peer: IpAddr = "203.0.113.9".parse().unwrap();
        let bearer = headers(&[("authorization", "Bearer s3cret-key")]);
        let keyed = limiter.client(peer, &bearer).unwrap();
        assert_eq!(keyed, Client::Key(0));
        assert_eq!(
            limiter.client(peer, &headers(&[("x-api-key", "s3cret-key")])),
            Ok(Client::Key(0))
        );
        assert!(limiter.allow(keyed, 100));
        assert!(!limiter.allow(keyed, 1));
        // The key's budget is not the address's.
        assert!(limiter.allow(Client::Ip(peer), 2));
        assert_eq!(
            limiter.client(peer, &headers(&[("authorization", "Bearer wrong")])),
            Err(())
        );
    }

    #[test]
    fn calls_are_counted_without_trusting_the_body() {
        assert_eq!(jsonrpc::calls_in(br#"{"jsonrpc":"2.0"}"#), 1);
        assert_eq!(jsonrpc::calls_in(b"  [1, 2, 3]"), 3);
        assert_eq!(jsonrpc::calls_in(b"[]"), 1);
        assert_eq!(jsonrpc::calls_in(b"[not json"), 1);
    }
}
