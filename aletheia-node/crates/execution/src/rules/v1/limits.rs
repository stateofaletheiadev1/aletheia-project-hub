//! Protocol version 1 limits and costs: the devnet defaults of Sections 13, 14.3 and 29, to be
//! benchmarked on reference hardware before version 1 is frozen.

use aletheia_core::tx::TX_BODY_VERSION_1;
use aletheia_core::{AssetId, TxType};

use crate::rules::{BlockLimits, TxLimits};

/// Transaction types active at version 1. Registry and payment types join as their modules
/// are implemented (Phases 8-11), before version 1 is frozen.
pub const TX_TYPES: &[TxType] = &[
    TxType::TRANSFER,
    TxType::BATCH_TRANSFER,
    TxType::MINT,
    TxType::BURN,
    TxType::LOCK,
    TxType::UNLOCK,
    TxType::REDEEM,
    TxType::RESERVE_ATTESTATION,
    TxType::CONTRACT_DEPLOY,
    TxType::CONTRACT_CALL,
    TxType::new(48),
    TxType::new(49),
    TxType::new(50),
    TxType::new(51),
    TxType::new(52),
    TxType::new(53),
    TxType::new(56),
    TxType::new(57),
    TxType::new(59),
    TxType::new(60),
    TxType::new(61),
    TxType::new(62),
    TxType::new(63),
    TxType::new(80),
    TxType::new(81),
    TxType::new(82),
    TxType::new(128),
    TxType::new(129),
    TxType::new(130),
    TxType::new(131),
    TxType::new(132),
    TxType::new(133),
    TxType::new(134),
    TxType::new(135),
    TxType::new(136),
    TxType::new(137),
    TxType::new(138),
    TxType::new(139),
    TxType::new(140),
    TxType::new(141),
    TxType::new(142),
    TxType::new(143),
];

pub const TX_LIMITS: TxLimits = TxLimits {
    max_tx_bytes: 64 * 1024,
    max_validity_slots: 7_200,
    fee_assets: &[AssetId::AEY, AssetId::ALNT],
    body_versions: &[TX_BODY_VERSION_1],
};

pub const BLOCK_LIMITS: BlockLimits = BlockLimits {
    max_block_bytes: 4 * 1024 * 1024,
    max_block_txs: 20_000,
    max_block_eu: 2_000_000_000,
};

/// Section 29: a native transfer costs 2,000 EU flat. A batch costs that per leg, so a batch
/// is never cheaper per movement than separate transfers.
pub const TRANSFER_EU: u64 = 2_000;

/// A monetary operation's base cost (devnet default, benchmarked before version 1 freezes).
pub const MONETARY_EU: u64 = 5_000;
/// Each Ed25519 signature a monetary operation verifies (authority, agent, attestor).
pub const SIGNATURE_EU: u64 = 3_000;

/// A registry or governance operation.
pub const REGISTRY_EU: u64 = 3_000;

/// One APN payment leg, return or accepted recall: a transfer plus the participant, limit
/// and de-duplication records it reads and writes.
pub const PAYMENT_EU: u64 = 4_000;
/// Any other APN operation, and a batch's own overhead.
pub const APN_EU: u64 = 3_000;
