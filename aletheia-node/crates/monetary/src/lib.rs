//! Native monetary architecture (spec Section 18). Implemented so far: monetary arithmetic
//! (APS-0020). Asset framework, ALnT, AEY, the supply ledger and invariants follow in
//! Phases 6 and 7.

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

pub use arith::{MAX_BASE_UNITS, Rounding, mul_div};
