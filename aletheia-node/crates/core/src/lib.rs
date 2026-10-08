//! Protocol foundation for Aletheia StableChain: strong types, protocol errors, canonical
//! encoding (ACE), network identity with domain-separated hashing, and the text forms of
//! addresses, transaction IDs, block IDs and binary values.
//!
//! Everything here is consensus-critical. No floats, no unordered iteration, no wall clock,
//! no panics on untrusted input (spec Sections 3 and 6).

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

pub mod ace;
pub mod address;
pub mod apn;
pub mod base16;
mod bech32m;
pub mod block;
pub mod bridge;
pub mod error;
pub mod error_codes;
pub mod ids;
pub mod monetary;
pub mod network;
pub mod registry;
mod text_id;
pub mod tx;
pub mod types;

pub use ace::{AceDecode, AceEncode, AceReader, AceWriter};
pub use address::{Address, AddressType};
pub use block::{
    Block, BlockBody, BlockHeader, ExtensionField, Proposal, QuorumCertificate, SignerBitmap,
    TimeoutCertificate,
};
pub use error::AletheiaError;
pub use error_codes::{ErrorClass, ErrorCode};
pub use ids::{BlockId, TxId};
pub use network::{ChainId, DomainHasher, DomainTag, NetworkIdentity, NetworkKind};
pub use tx::{
    AuthScheme, Authorization, Fee, Payload, PublicKeyEntry, SignatureEntry, SignedTransaction,
    TransactionBody, TransferLeg, TxType,
};
pub use types::{
    AeyAmount, AeyTag, AlntAmount, AlntTag, Amount, AssetId, AssetTag, Epoch, Hash32, Height,
    ProtocolVersion, Slot, ValidatorIndex,
};
