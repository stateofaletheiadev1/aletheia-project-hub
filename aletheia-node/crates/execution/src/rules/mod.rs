//! Versioned rule sets (Section 44.3, ADR-029).
//!
//! One variant per protocol version. Dispatch is an exhaustive match, not a trait object:
//! adding a version is a compile error everywhere a version-specific decision is made, which
//! is the point. A forgotten branch must not compile.
//!
//! Version 1 is not frozen yet: no production network has activated it, so it may still gain
//! transaction types before mainnet genesis. Once it appears in `frozen.toml` for a production
//! network it never changes again (rule 1).

use aletheia_core::{AletheiaError, AssetId, ErrorCode, ProtocolVersion, TxType};
use aletheia_state::StateOverlay;

use crate::context::BlockContext;
use crate::model::Records;
use crate::receipt::Receipt;
use crate::stateless::VerifiedTransaction;

#[cfg(feature = "test-protocol-v2")]
pub mod test_v2;
pub mod v1;

/// Size, window and fee-asset limits a rule set enforces during stateless validation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TxLimits {
    pub max_tx_bytes: usize,
    pub max_validity_slots: u64,
    pub fee_assets: &'static [AssetId],
    pub body_versions: &'static [u16],
}

/// Per-block limits (Section 14.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockLimits {
    pub max_block_bytes: usize,
    pub max_block_txs: u32,
    pub max_block_eu: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Rules {
    V1,
    /// Test-only (feature `test-protocol-v2`).
    #[cfg(feature = "test-protocol-v2")]
    TestV2,
}

/// Highest protocol version this binary can execute.
#[cfg(not(feature = "test-protocol-v2"))]
pub const MAX_SUPPORTED_VERSION: u16 = 1;
#[cfg(feature = "test-protocol-v2")]
pub const MAX_SUPPORTED_VERSION: u16 = 2;

impl Rules {
    pub fn for_version(version: ProtocolVersion) -> Result<Rules, AletheiaError> {
        match version.get() {
            1 => Ok(Rules::V1),
            #[cfg(feature = "test-protocol-v2")]
            2 => Ok(Rules::TestV2),
            other => Err(AletheiaError::new(
                ErrorCode::ProtocolVersionUnsupported,
                format!(
                    "protocol version {other} is newer than this binary (supports 1..={MAX_SUPPORTED_VERSION})"
                ),
            )),
        }
    }

    pub fn version(self) -> ProtocolVersion {
        match self {
            Rules::V1 => ProtocolVersion::new(1),
            #[cfg(feature = "test-protocol-v2")]
            Rules::TestV2 => ProtocolVersion::new(2),
        }
    }

    pub fn tx_type_active(self, tx_type: TxType) -> bool {
        match self {
            Rules::V1 => v1::TX_TYPES.contains(&tx_type),
            #[cfg(feature = "test-protocol-v2")]
            Rules::TestV2 => test_v2::TX_TYPES.contains(&tx_type),
        }
    }

    pub fn tx_limits(self) -> TxLimits {
        match self {
            Rules::V1 => v1::TX_LIMITS,
            #[cfg(feature = "test-protocol-v2")]
            Rules::TestV2 => v1::TX_LIMITS,
        }
    }

    pub fn block_limits(self) -> BlockLimits {
        match self {
            Rules::V1 => v1::BLOCK_LIMITS,
            #[cfg(feature = "test-protocol-v2")]
            Rules::TestV2 => v1::BLOCK_LIMITS,
        }
    }

    /// Every `(account, asset)` balance applying `tx` can change. The supply check after each
    /// block (Section 18.4, I7) recomputes the net balance change over exactly these.
    pub fn touched_balances(
        self,
        tx: &VerifiedTransaction,
    ) -> Vec<(aletheia_core::Address, AssetId)> {
        match self {
            Rules::V1 => v1::touched_balances(tx),
            #[cfg(feature = "test-protocol-v2")]
            Rules::TestV2 => v1::touched_balances(tx),
        }
    }

    pub fn apply_transaction(
        self,
        records: &Records,
        overlay: &mut StateOverlay<'_>,
        tx: &VerifiedTransaction,
        ctx: &BlockContext,
        index: u32,
    ) -> Result<(Receipt, v1::Touched), AletheiaError> {
        match self {
            Rules::V1 => v1::apply_transaction(records, overlay, tx, ctx, index),
            #[cfg(feature = "test-protocol-v2")]
            Rules::TestV2 => test_v2::apply_transaction(records, overlay, tx, ctx, index),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_versions_are_refused_by_name() {
        assert_eq!(Rules::for_version(ProtocolVersion::new(1)), Ok(Rules::V1));
        let error = Rules::for_version(ProtocolVersion::new(3)).unwrap_err();
        assert_eq!(error.code(), ErrorCode::ProtocolVersionUnsupported);
        assert!(error.detail().contains("protocol version 3"));
    }

    #[test]
    fn version_round_trips() {
        assert_eq!(Rules::for_version(Rules::V1.version()), Ok(Rules::V1));
    }
}
