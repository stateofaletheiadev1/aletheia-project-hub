//! The HTTP server (Section 37): `POST /rpc/v1` and `/api/v1/…` on Axum and Hyper, over the
//! same service. Bodies are capped at 1 MiB, each client IP has a request budget per second
//! (JSON-RPC `-32001`, HTTP 429 beyond it), and no CORS headers are sent (CORS off by default).

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::{ConnectInfo, RawQuery, State};
use axum::http::{Method, StatusCode, Uri, header};
use axum::response::Response;
use axum::routing::{any, post};
use tokio::net::TcpListener;

use crate::backend::Backend;
use crate::error::RpcError;
use crate::jsonrpc::{self, MAX_BODY_BYTES};
use crate::rest;
use crate::service::Service;

/// Requests per second per client IP, unless configured otherwise.
pub const DEFAULT_REQUESTS_PER_SECOND: u32 = 50;

#[derive(Debug)]
struct Limiter {
    per_second: u32,
    windows: Mutex<HashMap<IpAddr, (Instant, u32)>>,
}

/// Above this many tracked addresses, windows that have ended are dropped before a new one is
/// added, so a sender rotating source addresses (an IPv6 /64 holds 2^64) cannot grow the map
/// without bound: it holds at most the addresses seen in the last second.
const PRUNE_ABOVE: usize = 4_096;

impl Limiter {
    /// Whether `ip` may make `calls` more calls in the current one-second window.
    fn allow(&self, ip: IpAddr, calls: u32) -> bool {
        let Ok(mut windows) = self.windows.lock() else {
            return false;
        };
        let now = Instant::now();
        if windows.len() >= PRUNE_ABOVE && !windows.contains_key(&ip) {
            windows.retain(|_, (start, _)| now.duration_since(*start).as_secs() < 1);
        }
        let entry = windows.entry(ip).or_insert((now, 0));
        if now.duration_since(entry.0).as_secs() >= 1 {
            *entry = (now, 0);
        }
        entry.1 = entry.1.saturating_add(calls);
        entry.1 <= self.per_second
    }
}

#[derive(Debug)]
struct Shared<B: Backend> {
    service: Service<B>,
    limiter: Limiter,
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
    body: Bytes,
) -> Response {
    if !shared.limiter.allow(peer.ip(), jsonrpc::calls_in(&body)) {
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
    body: Bytes,
) -> Response {
    if !shared.limiter.allow(peer.ip(), 1) {
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

/// The router, for embedding in tests or another server.
pub fn router<B: Backend + 'static>(service: Service<B>, requests_per_second: u32) -> Router {
    let shared = Arc::new(Shared {
        service,
        limiter: Limiter {
            per_second: requests_per_second,
            windows: Mutex::new(HashMap::new()),
        },
    });
    Router::new()
        .route("/rpc/v1", post(rpc::<B>))
        .route("/api/v1/{*path}", any(api::<B>))
        .layer(axum::extract::DefaultBodyLimit::max(MAX_BODY_BYTES))
        .with_state(shared)
}

/// Serves until the listener fails or the task is dropped.
pub async fn serve<B: Backend + 'static>(
    listener: TcpListener,
    service: Service<B>,
    requests_per_second: u32,
) -> std::io::Result<()> {
    let app = router(service, requests_per_second);
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_batch_spends_one_unit_per_call() {
        let limiter = Limiter {
            per_second: 10,
            windows: Mutex::new(HashMap::new()),
        };
        let ip: IpAddr = "192.0.2.1".parse().unwrap();
        assert!(limiter.allow(ip, 10));
        assert!(
            !limiter.allow(ip, 1),
            "a 10-call batch used the whole budget"
        );
    }

    #[test]
    fn rotating_addresses_cannot_grow_the_limiter_without_bound() {
        let limiter = Limiter {
            per_second: 10,
            windows: Mutex::new(HashMap::new()),
        };
        for i in 0..u32::try_from(PRUNE_ABOVE + 10).unwrap() {
            let ip = IpAddr::V6(std::net::Ipv6Addr::from(u128::from(i)));
            limiter.allow(ip, 1);
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
        limiter.allow("2001:db8::1".parse().unwrap(), 1);
        assert_eq!(limiter.windows.lock().unwrap().len(), 1);
    }

    #[test]
    fn calls_are_counted_without_trusting_the_body() {
        assert_eq!(jsonrpc::calls_in(br#"{"jsonrpc":"2.0"}"#), 1);
        assert_eq!(jsonrpc::calls_in(b"  [1, 2, 3]"), 3);
        assert_eq!(jsonrpc::calls_in(b"[]"), 1);
        assert_eq!(jsonrpc::calls_in(b"[not json"), 1);
    }
}
