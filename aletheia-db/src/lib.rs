//! AletheiaDB: the document database of the Sovereign Covenant State of Aletheia.
//!
//! A JSON document store with collections, revisions for optimistic concurrency,
//! secondary (and unique) indexes, scoped API keys and idempotent writes, served over
//! HTTP + JSON. Clients connect with `aletheiadb://<keyId>:<secret>@host/<database>`.

pub mod api;
pub mod auth;
pub mod config;
pub mod encoding;
pub mod error;
pub mod query;
pub mod store;
pub mod time;
