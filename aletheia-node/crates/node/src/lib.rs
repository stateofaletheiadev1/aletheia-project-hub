//! The Aletheia node. Implemented so far: the ledger - finalize path and crash recovery
//! (spec Sections 20, 24). The supervision tree, P2P, consensus and RPC wiring arrive with
//! their phases (Section 46A).

pub mod ledger;

pub use ledger::{Ledger, Reconciled};
