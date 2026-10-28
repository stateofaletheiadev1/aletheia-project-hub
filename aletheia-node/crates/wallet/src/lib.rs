//! The wallet (spec Section 41, APS-0030): SLIP-0010 Ed25519 keys, an encrypted keystore
//! (Argon2id + XChaCha20-Poly1305), `aletheia:` payment URIs, and the signing flow (verify the
//! network, build, simulate, summarise, sign, submit, track to FINALIZED). Seeds and keys live
//! in `Secret` and are never logged or printed.

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

pub mod derive;
pub mod flow;
pub mod http;
pub mod keystore;
pub mod uri;

pub use flow::{Account, Rpc, Sent, Summary, TransferRequest, node_network, transfer};
pub use http::HttpRpc;
pub use uri::{PaymentUri, asset_decimals, format_amount, parse_amount};

/// What went wrong, in plain words. Never carries key material.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WalletError(pub String);

impl core::fmt::Display for WalletError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for WalletError {}
