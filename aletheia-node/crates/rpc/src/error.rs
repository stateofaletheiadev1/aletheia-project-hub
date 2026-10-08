//! Errors as both interfaces report them (Sections 37.2, 57). One value, two renderings:
//! JSON-RPC uses its own codes with the protocol code in `data`; REST uses the protocol code
//! and name with an HTTP status.

use aletheia_core::{AletheiaError, ErrorCode};
use serde_json::{Value, json};

#[derive(Debug, Clone, PartialEq)]
pub struct RpcError {
    /// JSON-RPC code (-32xxx).
    pub code: i32,
    pub message: String,
    pub data: Option<Value>,
}

impl RpcError {
    pub fn parse(detail: impl Into<String>) -> RpcError {
        RpcError::new(
            -32700,
            "Parse error",
            Some(json!({ "detail": detail.into() })),
        )
    }
    pub fn invalid_request(detail: impl Into<String>) -> RpcError {
        RpcError::new(
            -32600,
            "Invalid request",
            Some(json!({ "detail": detail.into() })),
        )
    }
    pub fn method_not_found(method: &str) -> RpcError {
        RpcError::new(
            -32601,
            "Method not found",
            Some(json!({ "method": method })),
        )
    }
    pub fn invalid_params(detail: impl Into<String>) -> RpcError {
        RpcError::new(
            -32602,
            "Invalid params",
            Some(json!({ "detail": detail.into() })),
        )
    }
    pub fn internal() -> RpcError {
        // Never leaks internals.
        RpcError::new(-32603, "Internal error", None)
    }
    pub fn rate_limited() -> RpcError {
        RpcError::new(-32001, "Rate limited", None)
    }
    pub fn not_found(what: impl Into<String>) -> RpcError {
        RpcError::new(-32002, "Not found", Some(json!({ "detail": what.into() })))
    }
    pub fn rejected(error: &AletheiaError) -> RpcError {
        RpcError::new(-32010, "Transaction rejected", Some(protocol(error)))
    }
    pub fn simulation_failed(error: &AletheiaError) -> RpcError {
        RpcError::new(-32011, "Simulation failed", Some(protocol(error)))
    }

    pub fn new(code: i32, message: &str, data: Option<Value>) -> RpcError {
        RpcError {
            code,
            message: message.to_owned(),
            data,
        }
    }

    /// The JSON-RPC `error` member.
    pub fn to_json(&self) -> Value {
        let mut out = json!({ "code": self.code, "message": self.message });
        if let (Some(data), Some(map)) = (&self.data, out.as_object_mut()) {
            map.insert("data".to_owned(), data.clone());
        }
        out
    }

    /// The HTTP status a REST response carries for this error.
    pub fn http_status(&self) -> u16 {
        match self.code {
            -32002 => 404,
            -32001 => 429,
            -32603 => 500,
            -32003 => 409,
            _ => 400,
        }
    }

    /// The REST error body: `{ "error": { "code", "name", "message", "details" } }`.
    pub fn to_rest(&self) -> Value {
        let protocol_code = self.data.as_ref().and_then(|d| d.get("code")).cloned();
        let name = self
            .data
            .as_ref()
            .and_then(|d| d.get("name"))
            .cloned()
            .unwrap_or_else(|| json!(rest_name(self.code)));
        json!({ "error": {
            "code": protocol_code.unwrap_or_else(|| json!(self.code)),
            "name": name,
            "message": self.message,
            "details": self.data.clone().unwrap_or(Value::Null),
        }})
    }
}

fn rest_name(code: i32) -> &'static str {
    match code {
        -32700 => "PARSE_ERROR",
        -32600 => "INVALID_REQUEST",
        -32601 => "METHOD_NOT_FOUND",
        -32602 => "INVALID_PARAMS",
        -32001 => "RATE_LIMITED",
        -32002 => "NOT_FOUND",
        -32003 => "NOT_YET_FINALIZED",
        -32010 => "TRANSACTION_REJECTED",
        -32011 => "SIMULATION_FAILED",
        _ => "INTERNAL_ERROR",
    }
}

/// The protocol error as data: `{ code, name, detail }`.
pub fn protocol(error: &AletheiaError) -> Value {
    json!({ "code": error.code().get(), "name": error.code().name(), "detail": error.detail() })
}

/// A backend failure: storage and other fail-stop classes are internal; anything else is the
/// caller's input being refused.
pub fn from_backend(error: &AletheiaError) -> RpcError {
    if error.is_fail_stop() || error.code() == ErrorCode::StoCorrupt {
        RpcError::internal()
    } else {
        RpcError::invalid_params(format!("{}: {}", error.code().name(), error.detail()))
    }
}
