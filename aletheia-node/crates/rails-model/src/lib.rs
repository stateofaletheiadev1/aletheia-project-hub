//! The Aletheia Canonical Payment (spec Section 40C.2, APS-0056): one internal model that every
//! inbound and outbound rail message passes through, so `n` rails need `2n` mappings.
//!
//! This is off-chain data: `serde` is allowed and nothing here is consensus bytes. Values are
//! checked when they are built. A text type cannot hold an over-long value, an identifier
//! cannot hold one with a wrong check digit, and an amount converts to AEY exactly or not at
//! all. There is no truncation anywhere in this crate.

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

pub mod acp;
pub mod amount;
pub mod error;
pub mod ids;
pub mod text;

pub use acp::{
    AccountRef, AgentRef, CanonicalPayment, ChargeBearer, Direction, Party, PostalAddress,
    Remittance, Settlement,
};
pub use amount::{AEY_PER_CENT, Amount, CurrencyCode, aey_from_cents, cents_from_aey};
pub use error::ModelError;
pub use ids::{Bic, CountryCode, Date, Iban, Lei, Uetr};
pub use text::{Max16Text, Max35Text, Max70Text, Max140Text};
