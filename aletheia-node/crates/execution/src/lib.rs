//! Execution for Aletheia StableChain: versioned rule sets (Section 44.3) and transaction
//! validation (APS-0003). The block executor, fees, receipts and events arrive in Phase 3.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing
    )
)]

pub mod rules;
pub mod stateless;

pub use rules::{Rules, TxLimits};
pub use stateless::{StatelessValidator, VerifiedTransaction};
