//! The REST adapter (Section 37.1) under `/api/v1/`: each route builds the same named
//! parameters a JSON-RPC call would and calls the same service method, so both interfaces
//! return identical data.

use serde_json::{Map, Value, json};

use crate::backend::Backend;
use crate::encode::has_hex_prefix;
use crate::error::RpcError;
use crate::service::Service;

/// An HTTP response: status and JSON body.
#[derive(Debug, Clone, PartialEq)]
pub struct RestResponse {
    pub status: u16,
    pub body: Value,
}

fn params(pairs: &[(&str, Value)]) -> Map<String, Value> {
    pairs
        .iter()
        .map(|(k, v)| ((*k).to_owned(), v.clone()))
        .collect()
}

fn s(text: &str) -> Value {
    Value::String(text.to_owned())
}

/// Routes one request. `path` is below `/api/v1`, e.g. `/accounts/AL:…/balances`; `query` is
/// the decoded query pairs; `body` the request body for POST.
pub async fn route<B: Backend>(
    service: &Service<B>,
    method: &str,
    path: &str,
    query: &[(String, String)],
    body: &[u8],
) -> RestResponse {
    match dispatch(service, method, path, query, body).await {
        Ok(body) => RestResponse { status: 200, body },
        Err(error) => RestResponse {
            status: error.http_status(),
            body: error.to_rest(),
        },
    }
}

async fn dispatch<B: Backend>(
    service: &Service<B>,
    method: &str,
    path: &str,
    query: &[(String, String)],
    body: &[u8],
) -> Result<Value, RpcError> {
    if query.iter().any(|(_, v)| has_hex_prefix(&s(v)))
        || path.split('/').any(|seg| has_hex_prefix(&s(seg)))
    {
        return Err(RpcError::invalid_params(
            "0x-prefixed values are not accepted: use unprefixed lowercase base16 or AL: forms",
        ));
    }
    let segments: Vec<&str> = path
        .trim_matches('/')
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();
    let q = |name: &str| {
        query
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    };
    match (method, segments.as_slice()) {
        ("GET", ["network", "status"]) => service.call("getNetworkStatus", &Map::new()).await,
        ("GET", ["chain", "head"]) => service.call("getChainHead", &Map::new()).await,
        ("GET", ["chain", "finalized"]) => service.call("getFinalizedHead", &Map::new()).await,
        ("GET", ["chain", "params"]) => service.call("getChainParams", &Map::new()).await,
        ("GET", ["blocks", "height", height]) => {
            service
                .call("getBlockByHeight", &params(&[("height", s(height))]))
                .await
        }
        ("GET", ["blocks", id, "finality"]) => {
            service
                .call("getFinalityProof", &params(&[("block", s(id))]))
                .await
        }
        ("GET", ["blocks", id]) => service.call("getBlock", &params(&[("block", s(id))])).await,
        ("POST", ["transactions", "simulate"]) => {
            let tx = tx_from_body(body)?;
            service
                .call("simulateTransaction", &params(&[("tx", tx)]))
                .await
        }
        ("POST", ["transactions"]) => {
            let tx = tx_from_body(body)?;
            service
                .call("submitTransaction", &params(&[("tx", tx)]))
                .await
        }
        ("GET", ["transactions", id]) => {
            service
                .call("getTransaction", &params(&[("txId", s(id))]))
                .await
        }
        ("GET", ["receipts", id]) => {
            service
                .call("getReceipt", &params(&[("txId", s(id))]))
                .await
        }
        ("GET", ["accounts", address]) => {
            service
                .call("getAccount", &params(&[("address", s(address))]))
                .await
        }
        ("GET", ["accounts", address, "nonce"]) => {
            let account = service
                .call("getAccount", &params(&[("address", s(address))]))
                .await?;
            Ok(json!({ "address": account.get("address"), "nonce": account.get("nonce") }))
        }
        ("GET", ["accounts", address, "balances"]) => {
            let assets: Vec<String> = match q("asset") {
                Some(asset) => vec![asset.to_owned()],
                None => vec!["AEY".to_owned(), "ALnT".to_owned()],
            };
            let mut out = Vec::new();
            for asset in assets {
                out.push(
                    service
                        .call(
                            "getBalance",
                            &params(&[("address", s(address)), ("asset", Value::String(asset))]),
                        )
                        .await?,
                );
            }
            Ok(Value::Array(out))
        }
        ("GET", ["assets"]) => service.call("getAssets", &Map::new()).await,
        ("GET", ["monetary", asset, "supply"]) => {
            service
                .call("getMonetarySupply", &params(&[("asset", s(asset))]))
                .await
        }
        ("GET" | "POST", _) => Err(RpcError::not_found(format!(
            "no route {method} /api/v1{path}"
        ))),
        _ => Err(RpcError::invalid_request(format!(
            "method {method} is not used by this API"
        ))),
    }
}

/// `POST /transactions` takes `{ "tx": "<base16 ACE bytes>" }`.
fn tx_from_body(body: &[u8]) -> Result<Value, RpcError> {
    let value: Value = serde_json::from_slice(body).map_err(|e| RpcError::parse(e.to_string()))?;
    if has_hex_prefix(&value) {
        return Err(RpcError::invalid_params(
            "0x-prefixed values are not accepted: use unprefixed lowercase base16",
        ));
    }
    value
        .get("tx")
        .filter(|v| v.is_string())
        .cloned()
        .ok_or_else(|| RpcError::invalid_params("the body is { \"tx\": \"<base16>\" }"))
}
