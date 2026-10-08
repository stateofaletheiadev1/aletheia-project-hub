//! The ISO 20022 gateway core (spec Sections 40, 40C.7, 40C.8): an integration boundary, not a
//! bank. It records every message in a hash-chained audit ledger, handles each exactly once,
//! runs the four validation layers and maps payments to APN operations for the gateway
//! operator's signer.
//!
//! Network transport (mTLS with pinned counterparty certificates), the HSM signer and the
//! PostgreSQL store sit around this core; here they are traits and in-memory stores.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing,
        clippy::arithmetic_side_effects
    )
)]

pub mod audit;
pub mod exactly_once;
pub mod pipeline;

pub use audit::{
    AuditEntry, AuditError, AuditLedger, AuditRecord, AuditStore, MemoryAuditStore, Stage,
};
pub use exactly_once::{Inbox, InboxKey, InboxOutcome, Outbox, OutboxItem, OutboxState, Receipt};
pub use pipeline::{
    ChainView, Gateway, GatewayConfig, Inbound, LegState, OutboundLeg, Resolved, Screener,
    Screening, leg_id, msg_id_hash, rail_code, uetr_hash,
};
