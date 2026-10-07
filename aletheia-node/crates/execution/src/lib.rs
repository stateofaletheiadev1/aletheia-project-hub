//! Execution for Aletheia StableChain (spec Sections 13, 20, 22, 23, 38, 43, 44): transaction
//! validation, versioned rule sets, deterministic ordering, the block executor, genesis and
//! the protocol schedule.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing
    )
)]

pub mod context;
pub mod continuity;
pub mod executor;
pub mod genesis;
pub mod model;
pub mod ordering;
pub mod receipt;
pub mod rules;
pub mod stateless;

pub use context::BlockContext;
pub use executor::{ExecutedBlock, check_header_results, execute_block};
pub use genesis::{GenesisConfig, GenesisState};
pub use model::Records;
pub use receipt::{Event, Receipt, ReceiptStatus};
pub use rules::{BlockLimits, Rules, TxLimits};
pub use stateless::{StatelessValidator, VerifiedTransaction};
