//! The Arno VM (spec Sections 27-29): the bytecode format, the deploy-time verifier (which
//! the compiler also runs on everything it emits), and the metered interpreter.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing
    )
)]

pub mod cost;
pub mod interp;
pub mod opcode;
pub mod package;
pub mod trap;
pub mod value;
pub mod verifier;
pub mod wire;
pub mod worker;

pub use interp::{ChainInfo, Failure, Host, Outcome, run};
pub use opcode::{HostFn, Instr, Op};
pub use package::{Constant, FunctionDef, Package, TypeDef};
pub use trap::Trap;
pub use value::Value;
pub use verifier::{verify, verify_bytes};
