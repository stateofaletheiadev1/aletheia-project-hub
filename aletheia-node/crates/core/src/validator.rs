//! Validator registry payloads (spec Section 34, ADR-069): transaction types 64-66, active from
//! protocol version 2. Activation, rejection, suspension and reinstatement are governance
//! actions (`GovAction`), not operator transactions.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::block::{BLS_PUBLIC_KEY_LEN, BLS_SIGNATURE_LEN};
use crate::{AletheiaError, Hash32};

/// What an operator submits to become a validator. The bond is in ALnT base units and is
/// locked in the registry until the application is withdrawn or rejected, or the validator's
/// exit takes effect.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValidatorApplication {
    pub consensus_key: [u8; BLS_PUBLIC_KEY_LEN],
    /// Proof of possession of `consensus_key`, checked at registration and again whenever a
    /// node builds the set.
    pub proof_of_possession: [u8; BLS_SIGNATURE_LEN],
    /// Ed25519 P2P identity; the registry key.
    pub node_key: [u8; 32],
    /// SHA-256 of the node's TLS certificate, for pinning (Section 36).
    pub transport_cert_hash: Hash32,
    /// Commitment to the operator's off-chain licence and operations record. Never personal
    /// data on-chain (rule 12).
    pub metadata_hash: Hash32,
    pub bond: u128,
}

impl AceEncode for ValidatorApplication {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.consensus_key);
        out.fixed(&self.proof_of_possession);
        out.fixed(&self.node_key);
        self.transport_cert_hash.encode(out);
        self.metadata_hash.encode(out);
        out.u128(self.bond);
    }
}

impl AceDecode for ValidatorApplication {
    fn decode(input: &mut AceReader<'_>) -> Result<ValidatorApplication, AletheiaError> {
        Ok(ValidatorApplication {
            consensus_key: input.array()?,
            proof_of_possession: input.array()?,
            node_key: input.array()?,
            transport_cert_hash: Hash32::decode(input)?,
            metadata_hash: Hash32::decode(input)?,
            bond: input.u128()?,
        })
    }
}

/// Operator transactions of the validator registry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidatorOp {
    /// Type 64: apply; the sender becomes the operator.
    Register(Box<ValidatorApplication>),
    /// Type 65: the operator withdraws an application not yet activated; the bond returns.
    WithdrawApplication { node_key: [u8; 32] },
    /// Type 66: the operator of an active validator leaves at the end of the current epoch.
    RequestExit { node_key: [u8; 32] },
}

impl ValidatorOp {
    pub const REGISTER: u16 = 64;
    pub const WITHDRAW_APPLICATION: u16 = 65;
    pub const REQUEST_EXIT: u16 = 66;
    pub const TX_TYPES: [u16; 3] = [
        Self::REGISTER,
        Self::WITHDRAW_APPLICATION,
        Self::REQUEST_EXIT,
    ];

    pub const fn tx_type(&self) -> u16 {
        match self {
            ValidatorOp::Register(_) => Self::REGISTER,
            ValidatorOp::WithdrawApplication { .. } => Self::WITHDRAW_APPLICATION,
            ValidatorOp::RequestExit { .. } => Self::REQUEST_EXIT,
        }
    }

    /// The node key the operation is about.
    pub fn node_key(&self) -> [u8; 32] {
        match self {
            ValidatorOp::Register(application) => application.node_key,
            ValidatorOp::WithdrawApplication { node_key }
            | ValidatorOp::RequestExit { node_key } => *node_key,
        }
    }

    pub fn encode_content(&self, out: &mut AceWriter) {
        match self {
            ValidatorOp::Register(application) => application.encode(out),
            ValidatorOp::WithdrawApplication { node_key }
            | ValidatorOp::RequestExit { node_key } => out.fixed(node_key),
        }
    }

    /// `None` when `tx_type` is not a validator registry type.
    pub fn decode_content(
        tx_type: u16,
        input: &mut AceReader<'_>,
    ) -> Option<Result<ValidatorOp, AletheiaError>> {
        Some(match tx_type {
            Self::REGISTER => {
                ValidatorApplication::decode(input).map(|a| ValidatorOp::Register(Box::new(a)))
            }
            Self::WITHDRAW_APPLICATION => input
                .array()
                .map(|node_key| ValidatorOp::WithdrawApplication { node_key }),
            Self::REQUEST_EXIT => input
                .array()
                .map(|node_key| ValidatorOp::RequestExit { node_key }),
            _ => return None,
        })
    }
}

/// Registration status (Section 19.1's status machine plus the application outcomes).
pub mod status {
    /// Applied, awaiting the Council.
    pub const REGISTERED: u8 = 1;
    /// In the set from `joined_epoch`.
    pub const ACTIVE: u8 = 2;
    /// Exit requested; leaves when the current epoch closes.
    pub const EXITING: u8 = 3;
    /// Removed by governance; keeps its bond and may be reinstated.
    pub const SUSPENDED: u8 = 4;
    /// Left the set; bond returned.
    pub const REMOVED: u8 = 5;
    /// Application rejected by the Council or withdrawn; bond returned.
    pub const REJECTED: u8 = 6;

    pub const fn name(status: u8) -> &'static str {
        match status {
            REGISTERED => "registered",
            ACTIVE => "active",
            EXITING => "exiting",
            SUSPENDED => "suspended",
            REMOVED => "removed",
            REJECTED => "rejected",
            _ => "unknown",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_operation_round_trips_through_its_type() {
        let ops = [
            ValidatorOp::Register(Box::new(ValidatorApplication {
                consensus_key: [1; BLS_PUBLIC_KEY_LEN],
                proof_of_possession: [2; BLS_SIGNATURE_LEN],
                node_key: [3; 32],
                transport_cert_hash: Hash32::from_bytes([4; 32]),
                metadata_hash: Hash32::from_bytes([5; 32]),
                bond: 10_000_000,
            })),
            ValidatorOp::WithdrawApplication { node_key: [6; 32] },
            ValidatorOp::RequestExit { node_key: [7; 32] },
        ];
        for op in ops {
            let mut out = AceWriter::new();
            op.encode_content(&mut out);
            let bytes = out.into_bytes();
            let mut input = AceReader::new(&bytes);
            let decoded = ValidatorOp::decode_content(op.tx_type(), &mut input)
                .unwrap()
                .unwrap();
            input.finish().unwrap();
            assert_eq!(decoded, op);
        }
        assert!(ValidatorOp::decode_content(67, &mut AceReader::new(&[])).is_none());
    }
}
