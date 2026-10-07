//! DSP v0.1, the Deterministic Sovereign Pipeline (spec Section 19, ADR-008).
//!
//! Everything in this crate is deterministic and free of I/O, clocks and threads: safety never
//! depends on timing (19.0). The node and the simulator drive the same code by feeding it
//! messages, execution results and timer expiries.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing,
        clippy::arithmetic_side_effects
    )
)]

pub mod certificate;
pub mod engine;
pub mod finality;
pub mod lifecycle;
pub mod message;
pub mod pacemaker;
pub mod safety;
pub mod schedule;
pub mod validator_set;

pub use engine::{ConsensusSigner, Engine, FinalizedTip, Input, Output};
pub use finality::{Evidence, FinalityProof};
pub use message::{ConsensusMessage, Timeout, Vote};
pub use safety::{ProposalFacts, SafetyData, SafetyRules, VoteRefusal};
pub use validator_set::{ValidatorInfo, ValidatorSet};
