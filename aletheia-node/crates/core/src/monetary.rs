//! Monetary payloads (spec Sections 13, 18.5, 18.8; APS-0018, APS-0021, APS-0045).
//!
//! ```text
//! 16 Mint               MintAuthorization
//! 17 Burn               AssetAmount
//! 18 Lock / 19 Unlock   AssetAmount
//! 20 Redeem             Redemption
//! 96 ReserveAttestation ReserveAttestation
//!
//! MintAuthorization  = authorization_id Hash32 | asset u32 | amount u128 | destination Address
//!                    | reserve_ref Hash32 | valid_until_epoch u64 | signatures
//! digest             = H_domain("ALETHEIA/MINTAUTH/v1", ace(fields without signatures))
//! Redemption         = asset u32 | amount u128 | settlement_ref Hash32 | agent_index u8
//!                    | agent_signature [64]
//! redemption digest  = H_domain("ALETHEIA/REDEEM/v1", ace(sender, nonce, asset, amount,
//!                      settlement_ref))                                    (ERRATA E-23)
//! ReserveAttestation = feed_id u32 | epoch u64 | value u128 | observed_slot u64
//!                    | evidence_ref Hash32 | signatures
//! digest             = H_domain("ALETHEIA/RESERVE-ATTEST/v1", ace(fields without signatures))
//! signatures         = list<{ index u8, ed25519 [64] }>, 1..=16, strictly ascending by index
//! ```
//!
//! Signers are named by their index in the registered key list (monetary authority,
//! redemption agents, attestors), which lives in state; this module checks only that the list
//! is canonical. Who is registered and how many must sign is decided by the monetary rules.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::address::Address;
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::network::{DomainTag, NetworkIdentity};
use crate::types::{AssetId, Hash32};

/// Most signatures one authorization or attestation carries.
pub const MAX_MONETARY_SIGNATURES: u32 = 16;

/// One registered signer's Ed25519 signature, named by its index in the registry.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IndexedSignature {
    pub index: u8,
    pub signature: [u8; 64],
}

impl AceEncode for IndexedSignature {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.index);
        out.fixed(&self.signature);
    }
}

impl AceDecode for IndexedSignature {
    fn decode(input: &mut AceReader<'_>) -> Result<IndexedSignature, AletheiaError> {
        Ok(IndexedSignature {
            index: input.u8()?,
            signature: input.array()?,
        })
    }
}

/// Decodes a signature list: 1..=16 entries, indices strictly ascending, so a signer appears
/// once and a list has one encoding.
pub(crate) fn decode_signatures(
    input: &mut AceReader<'_>,
) -> Result<Vec<IndexedSignature>, AletheiaError> {
    let offset = input.position();
    let signatures: Vec<IndexedSignature> = input.list(MAX_MONETARY_SIGNATURES)?;
    if signatures.is_empty() {
        return Err(AletheiaError::new(
            ErrorCode::DecodeNonCanonical,
            format!("signature list at offset {offset} is empty"),
        ));
    }
    if signatures
        .windows(2)
        .any(|pair| matches!(pair, [a, b] if a.index >= b.index))
    {
        return Err(AletheiaError::new(
            ErrorCode::DecodeNonCanonical,
            format!("signature list at offset {offset} is not strictly ascending by signer index"),
        ));
    }
    Ok(signatures)
}

/// An amount of one asset: Burn, Lock and Unlock.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AssetAmount {
    pub asset: AssetId,
    pub amount: u128,
}

impl AceEncode for AssetAmount {
    fn encode(&self, out: &mut AceWriter) {
        self.asset.encode(out);
        out.u128(self.amount);
    }
}

impl AceDecode for AssetAmount {
    fn decode(input: &mut AceReader<'_>) -> Result<AssetAmount, AletheiaError> {
        Ok(AssetAmount {
            asset: AssetId::decode(input)?,
            amount: input.u128()?,
        })
    }
}

/// New issuance approved by M of N monetary-authority keys (Section 18.5). Single use: its
/// id is recorded when it is consumed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MintAuthorization {
    pub authorization_id: Hash32,
    pub asset: AssetId,
    pub amount: u128,
    pub destination: Address,
    /// Links to the reserve attestation or off-chain settlement backing this issuance.
    pub reserve_ref: Hash32,
    pub valid_until_epoch: u64,
    pub signatures: Vec<IndexedSignature>,
}

impl MintAuthorization {
    fn encode_fields(&self, out: &mut AceWriter) {
        self.authorization_id.encode(out);
        self.asset.encode(out);
        out.u128(self.amount);
        self.destination.encode(out);
        self.reserve_ref.encode(out);
        out.u64(self.valid_until_epoch);
    }

    /// What each authority key signs.
    pub fn digest(&self, network: &NetworkIdentity) -> Hash32 {
        let mut out = AceWriter::new();
        self.encode_fields(&mut out);
        network.domain_hash(DomainTag::MintAuthorization, out.as_bytes())
    }
}

impl AceEncode for MintAuthorization {
    fn encode(&self, out: &mut AceWriter) {
        self.encode_fields(out);
        out.list(&self.signatures);
    }
}

impl AceDecode for MintAuthorization {
    fn decode(input: &mut AceReader<'_>) -> Result<MintAuthorization, AletheiaError> {
        Ok(MintAuthorization {
            authorization_id: Hash32::decode(input)?,
            asset: AssetId::decode(input)?,
            amount: input.u128()?,
            destination: Address::decode(input)?,
            reserve_ref: Hash32::decode(input)?,
            valid_until_epoch: input.u64()?,
            signatures: decode_signatures(input)?,
        })
    }
}

/// A holder's redemption, co-authorized by a registered redemption agent who settles it off
/// chain (Section 18.5).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Redemption {
    pub asset: AssetId,
    pub amount: u128,
    /// The off-chain settlement this redemption pays out through.
    pub settlement_ref: Hash32,
    pub agent_index: u8,
    pub agent_signature: [u8; 64],
}

impl Redemption {
    /// What the agent signs. Binding the sender and nonce ties the co-authorization to one
    /// transaction, so it cannot be replayed by anyone or reused by the holder.
    pub fn digest(&self, network: &NetworkIdentity, sender: &Address, nonce: u64) -> Hash32 {
        let mut out = AceWriter::new();
        sender.encode(&mut out);
        out.u64(nonce);
        self.asset.encode(&mut out);
        out.u128(self.amount);
        self.settlement_ref.encode(&mut out);
        network.domain_hash(DomainTag::Redemption, out.as_bytes())
    }
}

impl AceEncode for Redemption {
    fn encode(&self, out: &mut AceWriter) {
        self.asset.encode(out);
        out.u128(self.amount);
        self.settlement_ref.encode(out);
        out.u8(self.agent_index);
        out.fixed(&self.agent_signature);
    }
}

impl AceDecode for Redemption {
    fn decode(input: &mut AceReader<'_>) -> Result<Redemption, AletheiaError> {
        Ok(Redemption {
            asset: AssetId::decode(input)?,
            amount: input.u128()?,
            settlement_ref: Hash32::decode(input)?,
            agent_index: input.u8()?,
            agent_signature: input.array()?,
        })
    }
}

/// An attested reserve value, signed by registered attestors (Section 18.8). External data
/// enters consensus only this way.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReserveAttestation {
    pub feed_id: u32,
    pub epoch: u64,
    /// EUR base units.
    pub value: u128,
    pub observed_slot: u64,
    /// Hash of the auditor report, held off chain.
    pub evidence_ref: Hash32,
    pub signatures: Vec<IndexedSignature>,
}

impl ReserveAttestation {
    fn encode_fields(&self, out: &mut AceWriter) {
        out.u32(self.feed_id);
        out.u64(self.epoch);
        out.u128(self.value);
        out.u64(self.observed_slot);
        self.evidence_ref.encode(out);
    }

    /// What each attestor signs.
    pub fn digest(&self, network: &NetworkIdentity) -> Hash32 {
        let mut out = AceWriter::new();
        self.encode_fields(&mut out);
        network.domain_hash(DomainTag::ReserveAttestation, out.as_bytes())
    }
}

impl AceEncode for ReserveAttestation {
    fn encode(&self, out: &mut AceWriter) {
        self.encode_fields(out);
        out.list(&self.signatures);
    }
}

impl AceDecode for ReserveAttestation {
    fn decode(input: &mut AceReader<'_>) -> Result<ReserveAttestation, AletheiaError> {
        Ok(ReserveAttestation {
            feed_id: input.u32()?,
            epoch: input.u64()?,
            value: input.u128()?,
            observed_slot: input.u64()?,
            evidence_ref: Hash32::decode(input)?,
            signatures: decode_signatures(input)?,
        })
    }
}

/// Largest package a deployment carries (it must also fit the transaction size limit).
pub const MAX_DEPLOY_PACKAGE: u32 = 60 * 1024;
/// Largest encoded argument list.
pub const MAX_CALL_ARGS: u32 = 16 * 1024;
/// Longest routine name.
pub const MAX_ROUTINE_NAME: u32 = 64;

/// Coins attached to a contract call or deployment, handed to the routine's Coins parameter.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Attachment {
    pub asset: AssetId,
    pub amount: u128,
}

impl AceEncode for Attachment {
    fn encode(&self, out: &mut AceWriter) {
        self.asset.encode(out);
        out.u128(self.amount);
    }
}

impl AceDecode for Attachment {
    fn decode(input: &mut AceReader<'_>) -> Result<Attachment, AletheiaError> {
        Ok(Attachment {
            asset: AssetId::decode(input)?,
            amount: input.u128()?,
        })
    }
}

/// `ContractDeploy` (32): an Arno package and its constructor's arguments (Section 27).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractDeploy {
    pub package: Vec<u8>,
    /// The constructor's arguments after the Signer, each in its type's canonical encoding.
    pub args: Vec<u8>,
    pub attach: Option<Attachment>,
}

impl AceEncode for ContractDeploy {
    fn encode(&self, out: &mut AceWriter) {
        out.bytes(&self.package);
        out.bytes(&self.args);
        out.option(self.attach.as_ref());
    }
}

impl AceDecode for ContractDeploy {
    fn decode(input: &mut AceReader<'_>) -> Result<ContractDeploy, AletheiaError> {
        Ok(ContractDeploy {
            package: input.bytes(MAX_DEPLOY_PACKAGE)?.to_vec(),
            args: input.bytes(MAX_CALL_ARGS)?.to_vec(),
            attach: input.option()?,
        })
    }
}

/// `ContractCall` (33): an entry or view routine of a deployed contract, by name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContractCall {
    pub contract: Address,
    pub routine: String,
    pub args: Vec<u8>,
    pub attach: Option<Attachment>,
}

impl AceEncode for ContractCall {
    fn encode(&self, out: &mut AceWriter) {
        self.contract.encode(out);
        out.bytes(self.routine.as_bytes());
        out.bytes(&self.args);
        out.option(self.attach.as_ref());
    }
}

impl AceDecode for ContractCall {
    fn decode(input: &mut AceReader<'_>) -> Result<ContractCall, AletheiaError> {
        let contract = Address::decode(input)?;
        let routine = core::str::from_utf8(input.bytes(MAX_ROUTINE_NAME)?)
            .map_err(|_| {
                AletheiaError::new(
                    ErrorCode::DecodeNonCanonical,
                    "routine name is not UTF-8".to_owned(),
                )
            })?
            .to_owned();
        Ok(ContractCall {
            contract,
            routine,
            args: input.bytes(MAX_CALL_ARGS)?.to_vec(),
            attach: input.option()?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::{ChainId, NetworkKind};

    fn network() -> NetworkIdentity {
        NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
    }

    fn authorization(indices: &[u8]) -> MintAuthorization {
        MintAuthorization {
            authorization_id: Hash32::from_bytes([1; 32]),
            asset: AssetId::AEY,
            amount: 500,
            destination: Address::from_bytes([2; 20]),
            reserve_ref: Hash32::from_bytes([3; 32]),
            valid_until_epoch: 9,
            signatures: indices
                .iter()
                .map(|&index| IndexedSignature {
                    index,
                    signature: [index; 64],
                })
                .collect(),
        }
    }

    #[test]
    fn payloads_round_trip() {
        let mint = authorization(&[0, 2]);
        assert_eq!(
            MintAuthorization::from_ace_bytes(&mint.to_ace_bytes()).unwrap(),
            mint
        );
        let redemption = Redemption {
            asset: AssetId::AEY,
            amount: 7,
            settlement_ref: Hash32::from_bytes([4; 32]),
            agent_index: 1,
            agent_signature: [5; 64],
        };
        assert_eq!(
            Redemption::from_ace_bytes(&redemption.to_ace_bytes()).unwrap(),
            redemption
        );
        let attestation = ReserveAttestation {
            feed_id: 1,
            epoch: 0,
            value: 1_000,
            observed_slot: 10,
            evidence_ref: Hash32::from_bytes([6; 32]),
            signatures: vec![IndexedSignature {
                index: 0,
                signature: [7; 64],
            }],
        };
        assert_eq!(
            ReserveAttestation::from_ace_bytes(&attestation.to_ace_bytes()).unwrap(),
            attestation
        );
    }

    #[test]
    fn signature_lists_must_be_canonical() {
        for indices in [&[][..], &[1, 1][..], &[2, 1][..]] {
            let bytes = authorization(indices).to_ace_bytes();
            assert_eq!(
                MintAuthorization::from_ace_bytes(&bytes)
                    .unwrap_err()
                    .code(),
                ErrorCode::DecodeNonCanonical,
                "{indices:?}"
            );
        }
    }

    #[test]
    fn the_digest_excludes_signatures_and_binds_every_field() {
        let a = authorization(&[0]);
        assert_eq!(
            a.digest(&network()),
            authorization(&[0, 1]).digest(&network())
        );
        let mut b = a.clone();
        b.amount += 1;
        assert_ne!(a.digest(&network()), b.digest(&network()));
        let other = NetworkIdentity::new(ChainId::new(7772), NetworkKind::Devnet, Hash32::ZERO);
        assert_ne!(a.digest(&network()), a.digest(&other), "bound to the chain");
    }

    #[test]
    fn a_redemption_co_signature_is_bound_to_one_transaction() {
        let redemption = Redemption {
            asset: AssetId::AEY,
            amount: 7,
            settlement_ref: Hash32::ZERO,
            agent_index: 0,
            agent_signature: [0; 64],
        };
        let sender = Address::from_bytes([9; 20]);
        let other = Address::from_bytes([8; 20]);
        let digest = redemption.digest(&network(), &sender, 3);
        assert_ne!(digest, redemption.digest(&network(), &sender, 4));
        assert_ne!(digest, redemption.digest(&network(), &other, 3));
    }
}
