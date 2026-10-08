//! A JSON-RPC client over HTTP/1.1 for the CLI. Plain HTTP for a node on the same host or a
//! private network; a remote node is reached through a TLS-terminating proxy until this
//! client speaks TLS itself.

use std::net::SocketAddr;

use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::WalletError;
use crate::flow::Rpc;

/// The largest response read (the server caps requests at 1 MiB; responses are similar).
const MAX_RESPONSE: u64 = 8 << 20;

#[derive(Debug, Clone)]
pub struct HttpRpc {
    pub address: SocketAddr,
}

impl HttpRpc {
    /// From `http://host:port` or `host:port`.
    pub fn parse(url: &str) -> Result<HttpRpc, WalletError> {
        let rest = url
            .strip_prefix("http://")
            .unwrap_or(url)
            .trim_end_matches('/');
        let rest = rest.strip_suffix("/rpc/v1").unwrap_or(rest);
        if url.starts_with("https://") {
            return Err(WalletError(
                "https is not supported by this client yet; use a local node or a TLS proxy"
                    .to_owned(),
            ));
        }
        let address = rest.parse().map_err(|_| {
            WalletError(format!(
                "\"{url}\" is not host:port (an IP address and port)"
            ))
        })?;
        Ok(HttpRpc { address })
    }
}

impl Rpc for HttpRpc {
    async fn call(&self, method: &str, params: Value) -> Result<Value, WalletError> {
        let body =
            json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params }).to_string();
        let mut stream = TcpStream::connect(self.address)
            .await
            .map_err(|e| WalletError(format!("cannot reach the node at {}: {e}", self.address)))?;
        let request = format!(
            "POST /rpc/v1 HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            self.address,
            body.len()
        );
        stream
            .write_all(request.as_bytes())
            .await
            .map_err(|e| WalletError(format!("sending to the node: {e}")))?;
        let mut response = Vec::new();
        stream
            .take(MAX_RESPONSE)
            .read_to_end(&mut response)
            .await
            .map_err(|e| WalletError(format!("reading from the node: {e}")))?;
        let text = String::from_utf8_lossy(&response);
        let payload = text.split_once("\r\n\r\n").map(|(_, b)| b).unwrap_or("");
        let answer: Value = serde_json::from_str(payload).map_err(|_| {
            WalletError(format!(
                "the node did not answer with JSON-RPC: {}",
                text.lines().next().unwrap_or("")
            ))
        })?;
        if let Some(error) = answer.get("error") {
            let message = error
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("error");
            let detail = error
                .get("data")
                .map(|d| {
                    let name = d.get("name").and_then(Value::as_str).unwrap_or("");
                    let detail = d.get("detail").and_then(Value::as_str).unwrap_or("");
                    format!(" {name} {detail}").trim_end().to_owned()
                })
                .unwrap_or_default();
            return Err(WalletError(format!("{message}:{detail}")));
        }
        answer
            .get("result")
            .cloned()
            .ok_or_else(|| WalletError("the node answered without a result".to_owned()))
    }
}
