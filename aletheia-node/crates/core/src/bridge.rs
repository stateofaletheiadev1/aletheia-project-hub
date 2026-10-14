//! The public stablechain bridge, consensus formats (spec Section 40A, APS-0046): the bridge
//! message, routes and guardian sets as governance sets them, quorum attestations, and the
//! bridge transaction payloads (types 112-117).

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::network::{DomainTag, NetworkIdentity};
use crate::types::{AssetId, Hash32};

/// Aletheia's own chain id in bridge messages.
pub const ALETHEIA_CHAIN: u32 = 0;
/// Longest remote address or token identifier.
pub const MAX_REMOTE_BYTES: u32 = 64;
/// Largest guardian set (the bitmap is a u64).
pub const MAX_GUARDIANS: u32 = 64;
const MAX_ROUTE_ASSETS: u32 = 16;

fn bad(detail: impl Into<String>) -> AletheiaError {
    AletheiaError::new(ErrorCode::DecodeNonCanonical, detail.into())
}

/// Message kinds (40A.5).
pub mod kind {
    pub const LOCK_AND_MINT: u8 = 1;
    pub const BURN_AND_RELEASE: u8 = 2;
    pub const BURN_AND_MINT: u8 = 3;
}

/// One cross-chain transfer, as both sides see it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeMessage {
    pub version: u16,
    pub source_chain: u32,
    pub dest_chain: u32,
    pub route_id: u32,
    /// Strictly +1 per route and direction.
    pub sequence: u64,
    pub kind: u8,
    pub asset: AssetId,
    pub remote_token: Vec<u8>,
    pub sender: Vec<u8>,
    pub recipient: Vec<u8>,
    /// Aletheia base units.
    pub amount: u128,
    pub fee: u128,
    pub expiry_slot: u64,
}

impl AceEncode for BridgeMessage {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.version);
        out.u32(self.source_chain);
        out.u32(self.dest_chain);
        out.u32(self.route_id);
        out.u64(self.sequence);
        out.u8(self.kind);
        self.asset.encode(out);
        out.bytes(&self.remote_token);
        out.bytes(&self.sender);
        out.bytes(&self.recipient);
        out.u128(self.amount);
        out.u128(self.fee);
        out.u64(self.expiry_slot);
    }
}

impl AceDecode for BridgeMessage {
    fn decode(input: &mut AceReader<'_>) -> Result<BridgeMessage, AletheiaError> {
        let message = BridgeMessage {
            version: input.u16()?,
            source_chain: input.u32()?,
            dest_chain: input.u32()?,
            route_id: input.u32()?,
            sequence: input.u64()?,
            kind: input.u8()?,
            asset: AssetId::decode(input)?,
            remote_token: input.bytes(MAX_REMOTE_BYTES)?.to_vec(),
            sender: input.bytes(MAX_REMOTE_BYTES)?.to_vec(),
            recipient: input.bytes(MAX_REMOTE_BYTES)?.to_vec(),
            amount: input.u128()?,
            fee: input.u128()?,
            expiry_slot: input.u64()?,
        };
        if !(kind::LOCK_AND_MINT..=kind::BURN_AND_MINT).contains(&message.kind) {
            return Err(bad(format!(
                "bridge message kind {} does not exist",
                message.kind
            )));
        }
        Ok(message)
    }
}

impl BridgeMessage {
    /// `H_domain("ALETHEIA/BRIDGE-MSG/v1", ace(message))`.
    pub fn id(&self, network: &NetworkIdentity) -> Hash32 {
        network.domain_hash(DomainTag::BridgeMessage, &self.to_ace_bytes())
    }
}

/// What guardians sign for a message: `H_domain("ALETHEIA/BRIDGE-ATTEST/v1", id ‖ route)`.
pub fn attestation_digest(network: &NetworkIdentity, message_id: &Hash32, route_id: u32) -> Hash32 {
    let mut out = AceWriter::new();
    message_id.encode(&mut out);
    out.u32(route_id);
    network.domain_hash(DomainTag::BridgeAttestation, out.as_bytes())
}

/// Control actions guardians sign: flag a message, pause or resume a route.
pub mod control {
    pub const FLAG: u8 = 1;
    pub const PAUSE: u8 = 2;
    pub const RESUME: u8 = 3;
}

/// `H_domain("ALETHEIA/BRIDGE-CONTROL/v1", action ‖ route ‖ subject ‖ counter)`: the counter
/// (the route's pause count) makes an old pause or resume signature unusable later.
pub fn control_digest(
    network: &NetworkIdentity,
    action: u8,
    route_id: u32,
    subject: &Hash32,
    counter: u64,
) -> Hash32 {
    let mut out = AceWriter::new();
    out.u8(action);
    out.u32(route_id);
    subject.encode(&mut out);
    out.u64(counter);
    network.domain_hash(DomainTag::BridgeControl, out.as_bytes())
}

/// An aggregate BLS signature by the guardians whose bits are set.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Attestation {
    pub signers: u64,
    pub aggregate: [u8; 96],
}

impl AceEncode for Attestation {
    fn encode(&self, out: &mut AceWriter) {
        out.u64(self.signers);
        out.fixed(&self.aggregate);
    }
}

impl AceDecode for Attestation {
    fn decode(input: &mut AceReader<'_>) -> Result<Attestation, AletheiaError> {
        Ok(Attestation {
            signers: input.u64()?,
            aggregate: input.array()?,
        })
    }
}

/// One guardian: its BLS key and proof of possession.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Guardian {
    pub public_key: [u8; 48],
    pub proof_of_possession: [u8; 96],
}

impl AceEncode for Guardian {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.public_key);
        out.fixed(&self.proof_of_possession);
    }
}

impl AceDecode for Guardian {
    fn decode(input: &mut AceReader<'_>) -> Result<Guardian, AletheiaError> {
        Ok(Guardian {
            public_key: input.array()?,
            proof_of_possession: input.array()?,
        })
    }
}

/// A guardian set (N ≥ 7, threshold ≥ ⌈2N/3⌉ on production routes; checked by governance).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GuardianSet {
    pub set_id: u32,
    pub guardians: Vec<Guardian>,
    pub threshold: u16,
}

impl AceEncode for GuardianSet {
    fn encode(&self, out: &mut AceWriter) {
        out.u32(self.set_id);
        out.list(&self.guardians);
        out.u16(self.threshold);
    }
}

impl AceDecode for GuardianSet {
    fn decode(input: &mut AceReader<'_>) -> Result<GuardianSet, AletheiaError> {
        Ok(GuardianSet {
            set_id: input.u32()?,
            guardians: input.list(MAX_GUARDIANS)?,
            threshold: input.u16()?,
        })
    }
}

/// Directions an asset may move on a route.
pub mod direction {
    pub const OUTBOUND: u8 = 1;
    pub const INBOUND: u8 = 2;
    pub const BOTH: u8 = 3;
}

/// One asset on a route.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RouteAsset {
    pub asset: AssetId,
    pub direction: u8,
    pub remote_token: Vec<u8>,
    /// The remote token's decimals, for exact conversion.
    pub remote_decimals: u8,
    /// A foreign asset minted on Aletheia (its own supply ledger), as opposed to AEY.
    pub bridged: bool,
}

impl AceEncode for RouteAsset {
    fn encode(&self, out: &mut AceWriter) {
        self.asset.encode(out);
        out.u8(self.direction);
        out.bytes(&self.remote_token);
        out.u8(self.remote_decimals);
        out.bool(self.bridged);
    }
}

impl AceDecode for RouteAsset {
    fn decode(input: &mut AceReader<'_>) -> Result<RouteAsset, AletheiaError> {
        Ok(RouteAsset {
            asset: AssetId::decode(input)?,
            direction: input.u8()?,
            remote_token: input.bytes(MAX_REMOTE_BYTES)?.to_vec(),
            remote_decimals: input.u8()?,
            bridged: input.bool()?,
        })
    }
}

/// Verification tiers (40A.3).
pub mod verification {
    pub const LIGHT_CLIENT: u8 = 1;
    pub const GUARDIANS: u8 = 2;
    pub const GUARDIANS_AND_ISSUER: u8 = 3;
}

/// A route as governance configures it (40A.6).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeRoute {
    pub route_id: u32,
    pub remote_chain_id: u32,
    pub remote_address_len: u8,
    pub verification: u8,
    pub finality_depth: u32,
    pub guardian_set: u32,
    pub assets: Vec<RouteAsset>,
    pub per_tx_max: u128,
    pub per_epoch_max: u128,
    pub global_exposure_max: u128,
    pub large_transfer_threshold: u128,
    pub large_transfer_delay_epochs: u32,
    pub fee_bps: u16,
    /// Epochs a guardian pause lasts unless governance ratifies it.
    pub pause_expiry_epochs: u32,
}

impl AceEncode for BridgeRoute {
    fn encode(&self, out: &mut AceWriter) {
        out.u32(self.route_id);
        out.u32(self.remote_chain_id);
        out.u8(self.remote_address_len);
        out.u8(self.verification);
        out.u32(self.finality_depth);
        out.u32(self.guardian_set);
        out.list(&self.assets);
        out.u128(self.per_tx_max);
        out.u128(self.per_epoch_max);
        out.u128(self.global_exposure_max);
        out.u128(self.large_transfer_threshold);
        out.u32(self.large_transfer_delay_epochs);
        out.u16(self.fee_bps);
        out.u32(self.pause_expiry_epochs);
    }
}

impl AceDecode for BridgeRoute {
    fn decode(input: &mut AceReader<'_>) -> Result<BridgeRoute, AletheiaError> {
        Ok(BridgeRoute {
            route_id: input.u32()?,
            remote_chain_id: input.u32()?,
            remote_address_len: input.u8()?,
            verification: input.u8()?,
            finality_depth: input.u32()?,
            guardian_set: input.u32()?,
            assets: input.list(MAX_ROUTE_ASSETS)?,
            per_tx_max: input.u128()?,
            per_epoch_max: input.u128()?,
            global_exposure_max: input.u128()?,
            large_transfer_threshold: input.u128()?,
            large_transfer_delay_epochs: input.u32()?,
            fee_bps: input.u16()?,
            pause_expiry_epochs: input.u32()?,
        })
    }
}

/// Bridge payloads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BridgeOp {
    /// 112: send `amount` of `asset` to `recipient` on the route's remote chain.
    BridgeOut {
        route_id: u32,
        asset: AssetId,
        recipient: Vec<u8>,
        amount: u128,
        max_fee: u128,
    },
    /// 113: a relayer brings a remote message with its guardian quorum attestation.
    BridgeIn {
        message: BridgeMessage,
        attestation: Attestation,
    },
    /// 114: settles a large inbound message after its delay, if not flagged.
    SettleDelayed { message_id: Hash32 },
    /// 115: a guardian quorum holds a pending message for governance review.
    FlagMessage {
        route_id: u32,
        message_id: Hash32,
        attestation: Attestation,
    },
    /// 116: a guardian quorum pauses a route (new messages only).
    PauseRoute {
        route_id: u32,
        attestation: Attestation,
    },
    /// 117: a guardian quorum resumes a paused route.
    ResumeRoute {
        route_id: u32,
        attestation: Attestation,
    },
}

impl BridgeOp {
    pub const TX_TYPES: [u16; 6] = [112, 113, 114, 115, 116, 117];

    pub const fn tx_type(&self) -> u16 {
        match self {
            BridgeOp::BridgeOut { .. } => 112,
            BridgeOp::BridgeIn { .. } => 113,
            BridgeOp::SettleDelayed { .. } => 114,
            BridgeOp::FlagMessage { .. } => 115,
            BridgeOp::PauseRoute { .. } => 116,
            BridgeOp::ResumeRoute { .. } => 117,
        }
    }

    pub fn encode_content(&self, out: &mut AceWriter) {
        match self {
            BridgeOp::BridgeOut {
                route_id,
                asset,
                recipient,
                amount,
                max_fee,
            } => {
                out.u32(*route_id);
                asset.encode(out);
                out.bytes(recipient);
                out.u128(*amount);
                out.u128(*max_fee);
            }
            BridgeOp::BridgeIn {
                message,
                attestation,
            } => {
                message.encode(out);
                attestation.encode(out);
            }
            BridgeOp::SettleDelayed { message_id } => message_id.encode(out),
            BridgeOp::FlagMessage {
                route_id,
                message_id,
                attestation,
            } => {
                out.u32(*route_id);
                message_id.encode(out);
                attestation.encode(out);
            }
            BridgeOp::PauseRoute {
                route_id,
                attestation,
            }
            | BridgeOp::ResumeRoute {
                route_id,
                attestation,
            } => {
                out.u32(*route_id);
                attestation.encode(out);
            }
        }
    }

    pub fn decode_content(
        tx_type: u16,
        input: &mut AceReader<'_>,
    ) -> Option<Result<BridgeOp, AletheiaError>> {
        let op = || -> Result<BridgeOp, AletheiaError> {
            Ok(match tx_type {
                112 => BridgeOp::BridgeOut {
                    route_id: input.u32()?,
                    asset: AssetId::decode(input)?,
                    recipient: input.bytes(MAX_REMOTE_BYTES)?.to_vec(),
                    amount: input.u128()?,
                    max_fee: input.u128()?,
                },
                113 => BridgeOp::BridgeIn {
                    message: BridgeMessage::decode(input)?,
                    attestation: Attestation::decode(input)?,
                },
                114 => BridgeOp::SettleDelayed {
                    message_id: Hash32::decode(input)?,
                },
                115 => BridgeOp::FlagMessage {
                    route_id: input.u32()?,
                    message_id: Hash32::decode(input)?,
                    attestation: Attestation::decode(input)?,
                },
                116 => BridgeOp::PauseRoute {
                    route_id: input.u32()?,
                    attestation: Attestation::decode(input)?,
                },
                117 => BridgeOp::ResumeRoute {
                    route_id: input.u32()?,
                    attestation: Attestation::decode(input)?,
                },
                _ => return Err(bad("not a bridge type")),
            })
        };
        BridgeOp::TX_TYPES.contains(&tx_type).then(op)
    }
}

/// Converts between Aletheia base units (`local` decimals) and remote units, exactly or not
/// at all (40A.5: no rounding, no dust).
pub fn to_remote_units(amount: u128, local_decimals: u8, remote_decimals: u8) -> Option<u128> {
    if remote_decimals >= local_decimals {
        amount.checked_mul(
            10u128.checked_pow(u32::from(remote_decimals.saturating_sub(local_decimals)))?,
        )
    } else {
        let scale =
            10u128.checked_pow(u32::from(local_decimals.saturating_sub(remote_decimals)))?;
        (amount.checked_rem(scale)? == 0)
            .then(|| amount.checked_div(scale))
            .flatten()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversion_is_exact_or_refused() {
        // AEY 18 decimals to a 6-decimal remote token.
        assert_eq!(
            to_remote_units(1_500_000_000_000_000_000, 18, 6),
            Some(1_500_000)
        );
        assert_eq!(
            to_remote_units(1_500_000_000_000_000_001, 18, 6),
            None,
            "dust is refused"
        );
        assert_eq!(to_remote_units(15, 6, 18), Some(15_000_000_000_000));
    }

    #[test]
    fn messages_round_trip_and_bad_kinds_are_refused() {
        let message = BridgeMessage {
            version: 1,
            source_chain: 101,
            dest_chain: ALETHEIA_CHAIN,
            route_id: 3,
            sequence: 1,
            kind: kind::BURN_AND_RELEASE,
            asset: AssetId::AEY,
            remote_token: vec![1; 20],
            sender: vec![2; 20],
            recipient: vec![3; 20],
            amount: 5,
            fee: 0,
            expiry_slot: 99,
        };
        let bytes = message.to_ace_bytes();
        assert_eq!(BridgeMessage::from_ace_bytes(&bytes).unwrap(), message);
        let mut wrong = message.clone();
        wrong.kind = 9;
        assert!(BridgeMessage::from_ace_bytes(&wrong.to_ace_bytes()).is_err());
    }
}
