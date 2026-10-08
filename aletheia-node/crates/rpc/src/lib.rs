//! Public interfaces (spec Section 37, APS-0028, APS-0047): REST under `/api/v1/` and JSON-RPC
//! 2.0 under `/rpc/v1`, both thin adapters over one service layer, so behaviour, validation,
//! limits and errors are the same whichever a client uses. Everything served is finalized.
//!
//! This crate is transport-independent: the HTTP server (and WebSocket subscriptions) call
//! [`jsonrpc::handle`] and [`rest::route`].

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

pub mod backend;
pub mod encode;
pub mod error;
pub mod jsonrpc;
pub mod rest;
pub mod service;

pub use backend::{Backend, BlockRef, Located, NodeStatus};
pub use error::RpcError;
pub use service::{METHODS, Service};
