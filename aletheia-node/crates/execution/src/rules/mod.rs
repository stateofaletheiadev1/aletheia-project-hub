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

pub mod v1;

/// Size, window and fee-asset limits a rule set enforces during stateless validation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TxLimits {
    pub max_tx_bytes: usize,
    pub max_validity_slots: u64,
    pub fee_assets: &'static [AssetId],
    pub body_versions: &'static [u16],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Rules {
    V1,
}

impl Rules {
    pub fn for_version(version: ProtocolVersion) -> Result<Rules, AletheiaError> {
        match version.get() {
            1 => Ok(Rules::V1),
            other => Err(AletheiaError::new(
                ErrorCode::ProtocolVersionUnsupported,
                format!("protocol version {other} is newer than this binary (supports 1..=1)"),
            )),
        }
    }

    pub fn version(self) -> ProtocolVersion {
        match self {
            Rules::V1 => ProtocolVersion::new(1),
        }
    }

    pub fn tx_type_active(self, tx_type: TxType) -> bool {
        match self {
            Rules::V1 => v1::TX_TYPES.contains(&tx_type),
        }
    }

    pub fn tx_limits(self) -> TxLimits {
        match self {
            Rules::V1 => v1::TX_LIMITS,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_versions_are_refused_by_name() {
        assert_eq!(Rules::for_version(ProtocolVersion::new(1)), Ok(Rules::V1));
        let error = Rules::for_version(ProtocolVersion::new(2)).unwrap_err();
        assert_eq!(error.code(), ErrorCode::ProtocolVersionUnsupported);
        assert!(error.detail().contains("protocol version 2"));
    }

    #[test]
    fn version_round_trips() {
        assert_eq!(Rules::for_version(Rules::V1.version()), Ok(Rules::V1));
    }
}
