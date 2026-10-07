//! The Arno VM (spec Sections 27-29): the bytecode format and the deploy-time verifier, which
//! the compiler also runs on everything it emits. The interpreter follows in Phase 9.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing
    )
)]

pub mod opcode;
pub mod package;
pub mod verifier;

pub use opcode::{HostFn, Instr, Op};
pub use package::{Constant, FunctionDef, Package, TypeDef};
pub use verifier::{verify, verify_bytes};
