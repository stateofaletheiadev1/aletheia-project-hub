//! Native monetary architecture (spec Section 18). Implemented: monetary arithmetic
//! (APS-0020) and the per-asset supply ledger with invariants I1-I8 (Section 18.4). AEY
//! issuance, redemption and reserve attestations follow in Phase 7.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::arithmetic_side_effects
    )
)]

pub mod arith;
pub mod ledger;

pub use arith::{MAX_BASE_UNITS, Rounding, mul_div};
pub use ledger::{BalanceDelta, SupplyLedger};
