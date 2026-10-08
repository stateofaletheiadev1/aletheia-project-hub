//! The Aletheia node (spec Sections 20, 24, 46, 46A): the ledger with its finalize path and
//! crash recovery, the chain thread that owns it, the mempool, block propagation and sync, and
//! the runtime that assembles them. Consensus (DSP) and RPC arrive with their phases.

pub(crate) mod chain;
pub mod channels;
pub(crate) mod consensus;
pub mod ledger;
pub mod mempool;
pub mod rpc;
pub mod runtime;
pub(crate) mod sync;

pub use ledger::{Ledger, Reconciled};
pub use rpc::NodeBackend;
pub use runtime::{Node, NodeConfig};
