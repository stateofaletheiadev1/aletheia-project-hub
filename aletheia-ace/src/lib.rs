//! ACE, the Aletheia Compute Engine: builds, launches, supervises and recovers the Aletheia
//! StableChain node (`aletheiad`) on whatever compute is at hand, and reports honestly what
//! that compute can and cannot guarantee.
//!
//! Not to be confused with ACE in the StableChain sources, the Aletheia Canonical Encoding
//! (APS-0041), which this engine never produces or parses.
//!
//! Module map (docs/ARCHITECTURE.md):
//! - [`settings`]: `ace.toml`;  [`nodecfg`]: the node's own TOML, read with the daemon's rules
//! - [`source`]: pinned GitLab checkout;  [`builder`]: compile, hash, provenance, verify
//! - [`preflight`], [`host`], [`persistence`]: what the environment offers
//! - [`supervisor`], [`lifecycle`], [`node_exit`]: running the node
//! - [`rpc`], [`sockets`]: discovering and checking the RPC; [`tunnel`]: optional public route
//! - [`snapshot`], [`datadir`]: recovery checkpoints

#![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used, clippy::panic))]

pub mod builder;
pub mod datadir;
pub mod error;
pub mod host;
pub mod lifecycle;
pub mod node_exit;
pub mod nodecfg;
pub mod oplog;
pub mod persistence;
pub mod preflight;
pub mod rpc;
pub mod settings;
pub mod snapshot;
pub mod sockets;
pub mod source;
pub mod supervisor;
pub mod tunnel;
