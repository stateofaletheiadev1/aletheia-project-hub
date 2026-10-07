//! Wrapped cryptographic primitives for Aletheia StableChain (Section 17, APS-0037).
//!
//! No custom primitives: Ed25519 comes from `ed25519-dalek`, BLS12-381 from `blst`, hashing
//! from `blake3`. This crate fixes how they are used - strict verification, subgroup and
//! proof-of-possession checks, domain separation, zeroized and unprintable secrets - and maps
//! every failure to a protocol error code.

#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::indexing_slicing,
        clippy::arithmetic_side_effects,
        clippy::as_conversions,
    )
)]

pub mod address;
pub mod algorithm;
pub mod bls;
pub mod ed25519;
pub mod merkle;
mod secret;

pub use algorithm::SignatureAlgorithm;
pub use bls::{BlsPublicKey, BlsSecretKey, BlsSignature, ProvenBlsPublicKey};
pub use ed25519::{Ed25519PublicKey, Ed25519Signature, Ed25519SigningKey};
pub use secret::Secret;
