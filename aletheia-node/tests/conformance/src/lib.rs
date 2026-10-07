//! APS conformance support (spec Sections 52, 54).
//!
//! - [`fuzz`]: one function per fuzz target. `fuzz/` (cargo-fuzz, nightly) calls them with
//!   coverage-guided input; `tests/fuzz_smoke.rs` calls them with random input on stable so
//!   every CI run exercises the same assertions.
//! - [`vectors`]: builders for the published vectors in `tests/vectors/APS-NNNN/*.json`.
//!   `tests/vectors.rs` fails if a committed file differs from what the code produces.
//!
//! Test-only code: assertions here are the point, so the panic lints are relaxed.

#![allow(
    clippy::panic,
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing
)]

pub mod fuzz;
pub mod vectors;
