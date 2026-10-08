//! External rail interoperability (spec Section 40C, APS-0056): rail profiles as versioned,
//! reviewed data, the ISO 20022 reason-code table, and validation layers 2 (usage rules) and 3
//! (scheme rules) over the canonical payment. Layer 1 (XML syntax and schema) and layer 4
//! (Aletheia rules against chain state) live with the parser and the gateway.
//!
//! A rail is added by writing a profile and two mappings, never by touching the core or
//! another rail. Every check names the field and the rule; nothing is truncated or
//! transliterated silently.

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

pub mod charset;
pub mod layers;
pub mod profile;
pub mod reasons;

pub use layers::{DuplicateCheck, RailRejection, scheme_rules, usage_rules};
pub use profile::{ProfileError, ProfileSet, RailProfile};
pub use reasons::{ApnState, IsoReason, REASONS};
