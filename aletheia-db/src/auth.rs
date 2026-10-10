//! API keys and roles.
//!
//! A key is `<id>.<secret>`: a 16-hex-character id and 32 random bytes (base64url).
//! Only SHA-256 of the secret is stored. Keys carry 256 bits of entropy, so a fast hash
//! is the right choice here (password hashing like Argon2 protects low-entropy secrets).
//! The root key is not stored in the database at all: its hash comes from the
//! environment, so losing the data file can never lock the operator out.

use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use crate::error::{DbError, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Role {
    Read,
    ReadWrite,
    Admin,
}

impl Role {
    pub fn parse(s: &str) -> Result<Role> {
        match s {
            "read" => Ok(Role::Read),
            "readWrite" => Ok(Role::ReadWrite),
            "admin" => Ok(Role::Admin),
            _ => Err(DbError::invalid("role must be one of: read, readWrite, admin")),
        }
    }
}

/// Who is making a request.
#[derive(Debug, Clone)]
pub struct Principal {
    pub key_id: String,
    /// `None` for the root key, which may do everything.
    pub scope: Option<(String, Role)>,
}

impl Principal {
    pub fn root() -> Self {
        Principal {
            key_id: "root".into(),
            scope: None,
        }
    }

    pub fn is_root(&self) -> bool {
        self.scope.is_none()
    }

    pub fn require_root(&self) -> Result<()> {
        if self.is_root() {
            Ok(())
        } else {
            Err(DbError::Forbidden("this action needs the root key".into()))
        }
    }

    /// Database-scoped keys may only touch their own database, at or below their role.
    pub fn require(&self, database: &str, needed: Role) -> Result<()> {
        match &self.scope {
            None => Ok(()),
            Some((db, role)) if db == database && *role >= needed => Ok(()),
            Some((db, _)) if db == database => Err(DbError::Forbidden(format!("this key's role does not allow {needed:?} access"))),
            Some(_) => Err(DbError::Forbidden("this key is not valid for that database".into())),
        }
    }
}

/// A stored key record (the secret itself is never stored).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyRecord {
    pub id: String,
    pub name: String,
    pub database: String,
    pub role: Role,
    pub secret_sha256: String,
    pub created_at: String,
}

pub fn random_bytes<const N: usize>() -> [u8; N] {
    let mut buf = [0u8; N];
    getrandom::fill(&mut buf).expect("operating system random source unavailable");
    buf
}

pub fn new_secret() -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(random_bytes::<32>())
}

pub fn new_key_id() -> String {
    hex(&random_bytes::<8>())
}

pub fn sha256_hex(data: &[u8]) -> String {
    hex(&Sha256::digest(data))
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn constant_time_eq(a: &str, b: &str) -> bool {
    a.len() == b.len() && bool::from(a.as_bytes().ct_eq(b.as_bytes()))
}

/// Splits `Authorization: Bearer <id>.<secret>`.
pub fn parse_bearer(header: Option<&str>) -> Result<(String, String)> {
    let token = header.and_then(|h| h.strip_prefix("Bearer ")).ok_or(DbError::Unauthorized)?.trim();
    let (id, secret) = token.split_once('.').ok_or(DbError::Unauthorized)?;
    if id.is_empty() || id.len() > 32 || secret.len() < 16 || secret.len() > 128 {
        return Err(DbError::Unauthorized);
    }
    Ok((id.to_string(), secret.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roles_are_ordered_and_scoped() {
        let p = Principal {
            key_id: "k".into(),
            scope: Some(("gov".into(), Role::ReadWrite)),
        };
        assert!(p.require("gov", Role::Read).is_ok());
        assert!(p.require("gov", Role::ReadWrite).is_ok());
        assert!(p.require("gov", Role::Admin).is_err());
        assert!(p.require("other", Role::Read).is_err());
        assert!(p.require_root().is_err());
        assert!(Principal::root().require("any", Role::Admin).is_ok());
    }

    #[test]
    fn bearer_tokens_parse_strictly() {
        assert!(parse_bearer(Some("Bearer abcd.0123456789abcdefXYZ")).is_ok());
        assert!(parse_bearer(Some("Basic abc")).is_err());
        assert!(parse_bearer(Some("Bearer nodot")).is_err());
        assert!(parse_bearer(None).is_err());
        assert!(parse_bearer(Some("Bearer id.short")).is_err());
    }

    #[test]
    fn secrets_are_long_and_random() {
        let a = new_secret();
        assert_eq!(a.len(), 43);
        assert_ne!(a, new_secret());
        assert_eq!(new_key_id().len(), 16);
        assert!(constant_time_eq("abc", "abc") && !constant_time_eq("abc", "abd") && !constant_time_eq("a", "ab"));
    }
}
