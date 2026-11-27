//! Validator registry payloads (spec Section 34): transaction types 64-66, active from protocol
//! version 2 (ADR-069), and key rotation and equivocation evidence, types 67-69, active from
//! protocol version 3 (ADR-074, ADR-075). Activation, rejection, suspension and reinstatement are governance
//! actions (`GovAction`), not operator transactions.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::block::{BLS_PUBLIC_KEY_LEN, BLS_SIGNATURE_LEN, BlockHeader};
use crate::{AletheiaError, Epoch, Hash32, Slot};

/// Proof that one validator signed two conflicting consensus messages (Section 19.8,
/// ADR-075), checkable by anyone against the epoch's set in state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Equivocation {
    /// Two votes by `voter` in one round of `epoch` for different blocks. A vote's signature
    /// covers its round, block hash and epoch, so the hashes and signatures are the whole proof.
    Votes {
        epoch: Epoch,
        round: Slot,
        voter: u16,
        first: Box<(Hash32, [u8; BLS_SIGNATURE_LEN])>,
        second: Box<(Hash32, [u8; BLS_SIGNATURE_LEN])>,
    },
    /// Two proposals by the same leader for one slot. A proposal's signature covers only the
    /// block hash, so the headers come along to show they share epoch, slot and proposer.
    Proposals {
        first: Box<(BlockHeader, [u8; BLS_SIGNATURE_LEN])>,
        second: Box<(BlockHeader, [u8; BLS_SIGNATURE_LEN])>,
    },
}

/// The evidence file a node saves for submission: `ALEVID01 | ACE(Equivocation)`.
pub const EVIDENCE_FILE_MAGIC: &[u8; 8] = b"ALEVID01";

impl Equivocation {
    pub fn to_file_bytes(&self) -> Vec<u8> {
        let mut bytes = EVIDENCE_FILE_MAGIC.to_vec();
        bytes.extend_from_slice(&self.to_ace_bytes());
        bytes
    }

    pub fn from_file_bytes(bytes: &[u8]) -> Result<Equivocation, AletheiaError> {
        let body = bytes
            .strip_prefix(&EVIDENCE_FILE_MAGIC[..])
            .ok_or_else(|| {
                AletheiaError::new(
                    crate::ErrorCode::DecodeNonCanonical,
                    "not an evidence file (wrong magic)".to_owned(),
                )
            })?;
        Equivocation::from_ace_bytes(body)
    }
}

impl AceEncode for Equivocation {
    fn encode(&self, out: &mut AceWriter) {
        match self {
            Equivocation::Votes {
                epoch,
                round,
                voter,
                first,
                second,
            } => {
                out.u8(1);
                epoch.encode(out);
                round.encode(out);
                out.u16(*voter);
                for side in [first, second] {
                    side.0.encode(out);
                    out.fixed(&side.1);
                }
            }
            Equivocation::Proposals { first, second } => {
                out.u8(2);
                for side in [first, second] {
                    side.0.encode(out);
                    out.fixed(&side.1);
                }
            }
        }
    }
}

impl AceDecode for Equivocation {
    fn decode(input: &mut AceReader<'_>) -> Result<Equivocation, AletheiaError> {
        match input.u8()? {
            1 => {
                let epoch = Epoch::decode(input)?;
                let round = Slot::decode(input)?;
                let voter = input.u16()?;
                let first = Box::new((Hash32::decode(input)?, input.array()?));
                let second = Box::new((Hash32::decode(input)?, input.array()?));
                Ok(Equivocation::Votes {
                    epoch,
                    round,
                    voter,
                    first,
                    second,
                })
            }
            2 => {
                let first = (BlockHeader::decode(input)?, input.array()?);
                let second = (BlockHeader::decode(input)?, input.array()?);
                Ok(Equivocation::Proposals {
                    first: Box::new(first),
                    second: Box::new(second),
                })
            }
            other => Err(AletheiaError::new(
                crate::ErrorCode::DecodeNonCanonical,
                format!("equivocation kind {other}"),
            )),
        }
    }
}

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
    /// Type 67 (version 3): a new consensus key, with its proof of possession; a member's
    /// takes effect when this block closes the epoch.
    RotateConsensusKey {
        node_key: [u8; 32],
        consensus_key: [u8; BLS_PUBLIC_KEY_LEN],
        proof_of_possession: [u8; BLS_SIGNATURE_LEN],
    },
    /// Type 68 (version 3): a new transport certificate hash; the previous one stays accepted
    /// for a grace period so the node can restart onto the new certificate.
    RotateTransportCert {
        node_key: [u8; 32],
        transport_cert_hash: Hash32,
    },
    /// Type 69 (version 3): proof of a validator's equivocation, from any account; the
    /// validator is suspended (ADR-075).
    SubmitEvidence(Box<Equivocation>),
}

impl ValidatorOp {
    pub const REGISTER: u16 = 64;
    pub const WITHDRAW_APPLICATION: u16 = 65;
    pub const REQUEST_EXIT: u16 = 66;
    pub const ROTATE_CONSENSUS_KEY: u16 = 67;
    pub const ROTATE_TRANSPORT_CERT: u16 = 68;
    pub const SUBMIT_EVIDENCE: u16 = 69;
    /// The types protocol version 2 activates.
    pub const TX_TYPES: [u16; 3] = [
        Self::REGISTER,
        Self::WITHDRAW_APPLICATION,
        Self::REQUEST_EXIT,
    ];
    /// The types protocol version 3 adds (ADR-074, ADR-075).
    pub const VERSION_3_TX_TYPES: [u16; 3] = [
        Self::ROTATE_CONSENSUS_KEY,
        Self::ROTATE_TRANSPORT_CERT,
        Self::SUBMIT_EVIDENCE,
    ];

    pub const fn tx_type(&self) -> u16 {
        match self {
            ValidatorOp::Register(_) => Self::REGISTER,
            ValidatorOp::WithdrawApplication { .. } => Self::WITHDRAW_APPLICATION,
            ValidatorOp::RequestExit { .. } => Self::REQUEST_EXIT,
            ValidatorOp::RotateConsensusKey { .. } => Self::ROTATE_CONSENSUS_KEY,
            ValidatorOp::RotateTransportCert { .. } => Self::ROTATE_TRANSPORT_CERT,
            ValidatorOp::SubmitEvidence(_) => Self::SUBMIT_EVIDENCE,
        }
    }

    /// The node key the operation is about; evidence names its validator by index in an
    /// epoch's set instead.
    pub fn node_key(&self) -> Option<[u8; 32]> {
        match self {
            ValidatorOp::Register(application) => Some(application.node_key),
            ValidatorOp::WithdrawApplication { node_key }
            | ValidatorOp::RequestExit { node_key }
            | ValidatorOp::RotateConsensusKey { node_key, .. }
            | ValidatorOp::RotateTransportCert { node_key, .. } => Some(*node_key),
            ValidatorOp::SubmitEvidence(_) => None,
        }
    }

    pub fn encode_content(&self, out: &mut AceWriter) {
        match self {
            ValidatorOp::Register(application) => application.encode(out),
            ValidatorOp::WithdrawApplication { node_key }
            | ValidatorOp::RequestExit { node_key } => out.fixed(node_key),
            ValidatorOp::RotateConsensusKey {
                node_key,
                consensus_key,
                proof_of_possession,
            } => {
                out.fixed(node_key);
                out.fixed(consensus_key);
                out.fixed(proof_of_possession);
            }
            ValidatorOp::RotateTransportCert {
                node_key,
                transport_cert_hash,
            } => {
                out.fixed(node_key);
                transport_cert_hash.encode(out);
            }
            ValidatorOp::SubmitEvidence(evidence) => evidence.encode(out),
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
            Self::ROTATE_CONSENSUS_KEY => (|| {
                Ok(ValidatorOp::RotateConsensusKey {
                    node_key: input.array()?,
                    consensus_key: input.array()?,
                    proof_of_possession: input.array()?,
                })
            })(),
            Self::ROTATE_TRANSPORT_CERT => (|| {
                Ok(ValidatorOp::RotateTransportCert {
                    node_key: input.array()?,
                    transport_cert_hash: Hash32::decode(input)?,
                })
            })(),
            Self::SUBMIT_EVIDENCE => Equivocation::decode(input)
                .map(|evidence| ValidatorOp::SubmitEvidence(Box::new(evidence))),
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
            ValidatorOp::RotateConsensusKey {
                node_key: [8; 32],
                consensus_key: [9; BLS_PUBLIC_KEY_LEN],
                proof_of_possession: [10; BLS_SIGNATURE_LEN],
            },
            ValidatorOp::RotateTransportCert {
                node_key: [11; 32],
                transport_cert_hash: Hash32::from_bytes([12; 32]),
            },
            ValidatorOp::SubmitEvidence(Box::new(Equivocation::Votes {
                epoch: Epoch::new(2),
                round: Slot::new(900),
                voter: 1,
                first: Box::new((Hash32::from_bytes([13; 32]), [14; BLS_SIGNATURE_LEN])),
                second: Box::new((Hash32::from_bytes([15; 32]), [16; BLS_SIGNATURE_LEN])),
            })),
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
        assert!(ValidatorOp::decode_content(70, &mut AceReader::new(&[])).is_none());
    }
}
