//! Protocol version 1: genesis rules.
//!
//! Limits are the devnet defaults of Section 13, to be benchmarked before freezing.

use aletheia_core::tx::TX_BODY_VERSION_1;
use aletheia_core::{AssetId, TxType};

use super::TxLimits;

/// Transaction types active at version 1. Monetary, registry and payment types join as
/// their modules are implemented (Phases 6-11), before version 1 is frozen.
pub const TX_TYPES: &[TxType] = &[TxType::TRANSFER, TxType::BATCH_TRANSFER];

pub const TX_LIMITS: TxLimits = TxLimits {
    max_tx_bytes: 64 * 1024,
    max_validity_slots: 7_200,
    fee_assets: &[AssetId::AEY, AssetId::ALNT],
    body_versions: &[TX_BODY_VERSION_1],
};
