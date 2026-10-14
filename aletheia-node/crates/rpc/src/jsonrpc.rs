//! The JSON-RPC 2.0 adapter (Section 37.2), strict:
//!
//! - `"jsonrpc": "2.0"`; `id` a string or integer (not `null`, not a fraction); a request
//!   without `id` is a notification and gets no response;
//! - named parameters only (`params` an object); positional arrays are `-32602`;
//! - batches of 1 to 50 calls within 1 MiB, answered as an array (notifications omitted);
//! - nesting at most 32 levels; any `0x`-prefixed string is `-32602`.

use serde_json::{Map, Value, json};

use crate::backend::Backend;
use crate::encode::{depth, has_hex_prefix};
use crate::error::RpcError;
use crate::service::Service;

pub const MAX_BODY_BYTES: usize = 1 << 20;
pub const MAX_BATCH: usize = 50;
pub const MAX_DEPTH: usize = 32;

fn response(id: Value, outcome: Result<Value, RpcError>) -> Value {
    match outcome {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err(error) => json!({ "jsonrpc": "2.0", "id": id, "error": error.to_json() }),
    }
}

/// How many calls a body asks for, for the per-IP budget: a batch costs one unit per call, not
/// one per HTTP request. Anything that is not a well-formed array counts as one (it will be
/// answered with a single error).
pub fn calls_in(body: &[u8]) -> u32 {
    let starts_array = body
        .iter()
        .find(|b| !b.is_ascii_whitespace())
        .is_some_and(|b| *b == b'[');
    if !starts_array || body.len() > MAX_BODY_BYTES {
        return 1;
    }
    serde_json::from_slice::<Vec<Value>>(body).map_or(1, |calls| {
        u32::try_from(calls.len()).unwrap_or(u32::MAX).max(1)
    })
}

/// Handles one HTTP body. `None`: nothing to send (only notifications).
pub async fn handle<B: Backend>(service: &Service<B>, body: &[u8]) -> Option<String> {
    if body.len() > MAX_BODY_BYTES {
        return Some(
            response(
                Value::Null,
                Err(RpcError::invalid_request(
                    "the request is larger than 1 MiB",
                )),
            )
            .to_string(),
        );
    }
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(e) => {
            return Some(response(Value::Null, Err(RpcError::parse(e.to_string()))).to_string());
        }
    };
    if depth(&parsed) > MAX_DEPTH {
        return Some(
            response(
                Value::Null,
                Err(RpcError::invalid_request("the request nests too deeply")),
            )
            .to_string(),
        );
    }
    match parsed {
        Value::Array(calls) => {
            if calls.is_empty() || calls.len() > MAX_BATCH {
                return Some(
                    response(
                        Value::Null,
                        Err(RpcError::invalid_request(format!(
                            "a batch has 1 to {MAX_BATCH} calls"
                        ))),
                    )
                    .to_string(),
                );
            }
            let mut out = Vec::new();
            for call in calls {
                if let Some(answer) = one(service, call).await {
                    out.push(answer);
                }
            }
            (!out.is_empty()).then(|| Value::Array(out).to_string())
        }
        call => one(service, call).await.map(|v| v.to_string()),
    }
}

async fn one<B: Backend>(service: &Service<B>, call: Value) -> Option<Value> {
    let Value::Object(call) = call else {
        return Some(response(
            Value::Null,
            Err(RpcError::invalid_request("a call is a JSON object")),
        ));
    };
    let id = match call.get("id") {
        None => None,
        Some(id @ Value::String(_)) => Some(id.clone()),
        Some(Value::Number(n)) if n.is_i64() || n.is_u64() => Some(Value::Number(n.clone())),
        Some(_) => {
            return Some(response(
                Value::Null,
                Err(RpcError::invalid_request("id is a string or an integer")),
            ));
        }
    };
    let outcome = validate(&call).map(|(method, params)| (method.to_owned(), params));
    let outcome = match outcome {
        Ok((method, params)) => service.call(&method, &params).await,
        Err(e) => Err(e),
    };
    // A notification gets no response, even an error.
    id.map(|id| response(id, outcome))
}

fn validate(call: &Map<String, Value>) -> Result<(&str, Map<String, Value>), RpcError> {
    if call.get("jsonrpc").and_then(Value::as_str) != Some("2.0") {
        return Err(RpcError::invalid_request(
            "\"jsonrpc\": \"2.0\" is required",
        ));
    }
    let method = call
        .get("method")
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::invalid_request("\"method\" (a string) is required"))?;
    if let Some(extra) = call
        .keys()
        .find(|k| !matches!(k.as_str(), "jsonrpc" | "id" | "method" | "params"))
    {
        return Err(RpcError::invalid_request(format!(
            "unknown member \"{extra}\""
        )));
    }
    let params = match call.get("params") {
        None => Map::new(),
        Some(Value::Object(map)) => map.clone(),
        Some(Value::Array(_)) => {
            return Err(RpcError::invalid_params(
                "parameters are named: pass an object, not an array",
            ));
        }
        Some(_) => return Err(RpcError::invalid_params("\"params\" is an object")),
    };
    if has_hex_prefix(&Value::Object(params.clone())) {
        return Err(RpcError::invalid_params(
            "0x-prefixed values are not accepted: use unprefixed lowercase base16 or alt: forms",
        ));
    }
    Ok((method, params))
}
