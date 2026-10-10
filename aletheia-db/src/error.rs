//! Typed errors. Every failure the API can return maps to exactly one code, and the
//! codes match the adapter contract of the government platform (aletheiagov brief §8.3).

use serde_json::{Value, json};

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    Invalid(String),
    #[error("missing or invalid API key")]
    Unauthorized,
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    Unavailable(String),
    #[error("the request took too long; its outcome is unknown")]
    Timeout,
    #[error("internal error")]
    Internal(String),
}

impl DbError {
    pub fn code(&self) -> &'static str {
        match self {
            DbError::NotFound(_) => "NotFound",
            DbError::Conflict(_) => "Conflict",
            DbError::Invalid(_) => "Invalid",
            DbError::Unauthorized => "Unauthorized",
            DbError::Forbidden(_) => "Forbidden",
            DbError::Unavailable(_) => "Unavailable",
            DbError::Timeout => "Timeout",
            DbError::Internal(_) => "Internal",
        }
    }

    pub fn status(&self) -> u16 {
        match self {
            DbError::NotFound(_) => 404,
            DbError::Conflict(_) => 409,
            DbError::Invalid(_) => 400,
            DbError::Unauthorized => 401,
            DbError::Forbidden(_) => 403,
            DbError::Unavailable(_) => 503,
            DbError::Timeout => 504,
            DbError::Internal(_) => 500,
        }
    }

    /// The JSON body sent to clients. Internal details are logged, never returned.
    pub fn body(&self, request_id: &str) -> Value {
        let message = match self {
            DbError::Internal(_) => "internal error".to_string(),
            other => other.to_string(),
        };
        json!({ "error": { "code": self.code(), "message": message }, "requestId": request_id })
    }

    pub fn invalid(msg: impl Into<String>) -> Self {
        DbError::Invalid(msg.into())
    }
    pub fn not_found(msg: impl Into<String>) -> Self {
        DbError::NotFound(msg.into())
    }
    pub fn conflict(msg: impl Into<String>) -> Self {
        DbError::Conflict(msg.into())
    }
}

macro_rules! internal_from {
    ($($t:ty),*) => {$(
        impl From<$t> for DbError {
            fn from(e: $t) -> Self { DbError::Internal(e.to_string()) }
        }
    )*};
}

internal_from!(
    redb::Error,
    redb::DatabaseError,
    redb::TransactionError,
    redb::TableError,
    redb::StorageError,
    redb::CommitError,
    serde_json::Error
);

pub type Result<T> = std::result::Result<T, DbError>;
