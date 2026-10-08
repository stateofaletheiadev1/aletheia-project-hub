//! Native registry and governance payloads (spec Sections 31-33, 35; APS-0022 to APS-0026).
//!
//! ```text
//! Identity   48 IdentityCreate   49 IdentityUpdate   50 IdentitySetStatus
//!            51 IdentityRotate   52 CredentialIssue  53 CredentialStatus
//! Residence  56 ResidenceIssue   57 ResidenceSetStatus
//! Land       59 ParcelRegister   60 ParcelTransfer   61 ParcelEncumber
//!            62 ParcelRelease    63 ParcelSetStatus
//! Governance 80 GovPropose       81 GovVote          82 GovExecute
//! ```
//!
//! The chain holds commitments, never personal data: identities and credentials carry salted
//! commitments to records kept off chain.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::address::Address;
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::network::{DomainTag, NetworkIdentity};
use crate::types::{AssetId, Hash32};

pub const MAX_SCOPES: u32 = 64;
pub const MAX_COUNCIL: u32 = 32;
pub const MAX_STATUS_UPDATES: u32 = 256;

fn bad(detail: &str) -> AletheiaError {
    AletheiaError::new(ErrorCode::DecodeNonCanonical, detail.to_owned())
}

macro_rules! code_enum {
    ($(#[$doc:meta])* $name:ident { $($variant:ident = $code:literal),* $(,)? }) => {
        $(#[$doc])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub enum $name {
            $($variant,)*
        }

        impl $name {
            pub const fn code(self) -> u8 {
                match self {
                    $($name::$variant => $code,)*
                }
            }

            pub fn from_code(code: u8) -> Option<$name> {
                match code {
                    $($code => Some($name::$variant),)*
                    _ => None,
                }
            }
        }

        impl AceEncode for $name {
            fn encode(&self, out: &mut AceWriter) {
                out.u8(self.code());
            }
        }

        impl AceDecode for $name {
            fn decode(input: &mut AceReader<'_>) -> Result<$name, AletheiaError> {
                $name::from_code(input.u8()?).ok_or_else(|| bad(concat!("unknown ", stringify!($name))))
            }
        }
    };
}

code_enum!(
    /// Section 31.
    IdentityStatus { Active = 1, Suspended = 2, Revoked = 3 }
);
code_enum!(
    /// Section 32. `Expired` is never stored: it is computed from `expiry_epoch`.
    ResidenceStatus { Pending = 1, Active = 2, Expired = 3, Revoked = 4 }
);
code_enum!(
    /// Section 33.
    ParcelStatus { Registered = 1, Encumbered = 2, Frozen = 3, Retired = 4 }
);
code_enum!(
    /// Which registry an issuer or authority serves.
    RegistryKind { Identity = 1, Residence = 2, Land = 3 }
);

/// Who controls a parcel: an identity (through its controller key) or an address.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ControllerRef {
    Identity(Hash32),
    Address(Address),
}

impl AceEncode for ControllerRef {
    fn encode(&self, out: &mut AceWriter) {
        match self {
            ControllerRef::Identity(id) => {
                out.u8(1);
                id.encode(out);
            }
            ControllerRef::Address(address) => {
                out.u8(2);
                address.encode(out);
            }
        }
    }
}

impl AceDecode for ControllerRef {
    fn decode(input: &mut AceReader<'_>) -> Result<ControllerRef, AletheiaError> {
        match input.u8()? {
            1 => Ok(ControllerRef::Identity(Hash32::decode(input)?)),
            2 => Ok(ControllerRef::Address(Address::decode(input)?)),
            _ => Err(bad("unknown controller reference")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Encumbrance {
    pub kind: u16,
    pub holder: Address,
    pub ref_hash: Hash32,
    pub until_epoch: u64,
}

impl AceEncode for Encumbrance {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.kind);
        self.holder.encode(out);
        self.ref_hash.encode(out);
        out.u64(self.until_epoch);
    }
}

impl AceDecode for Encumbrance {
    fn decode(input: &mut AceReader<'_>) -> Result<Encumbrance, AletheiaError> {
        Ok(Encumbrance {
            kind: input.u16()?,
            holder: Address::decode(input)?,
            ref_hash: Hash32::decode(input)?,
            until_epoch: input.u64()?,
        })
    }
}

fn u32_list(out: &mut AceWriter, items: &[u32]) {
    out.u32(u32::try_from(items.len()).unwrap_or(u32::MAX));
    for item in items {
        out.u32(*item);
    }
}

fn read_u32_list(input: &mut AceReader<'_>, max: u32) -> Result<Vec<u32>, AletheiaError> {
    let n = input.u32()?;
    if n > max {
        return Err(bad("list too long"));
    }
    (0..n).map(|_| input.u32()).collect()
}

/// What a governance proposal does. Only these designated actions exist: there is no
/// arbitrary state write, and nothing moves user balances (Section 35).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GovAction {
    /// Registers (or replaces) an issuer or authority with its scopes: identity schemas,
    /// residence classes, or land parcel classes; for land, the classes whose transfers need
    /// the authority's co-signature.
    RegisterIssuer {
        kind: RegistryKind,
        issuer_id: u32,
        controller: Address,
        scopes: Vec<u32>,
        cosign_classes: Vec<u32>,
        /// The Ed25519 key whose signature a co-signed transfer carries (land authorities).
        cosign_key: Option<[u8; 32]>,
    },
    SetIssuerActive {
        kind: RegistryKind,
        issuer_id: u32,
        active: bool,
    },
    /// A fee asset's EU price, at most doubling or halving per proposal.
    SetFeePrice { asset: AssetId, eu_price: u128 },
    /// AEY authorized capacity, rising by at most the governed maximum per proposal.
    SetAeyCapacity { capacity: u128 },
    /// Schedules a protocol version to activate at a height.
    ScheduleUpgrade {
        protocol_version: u16,
        activation_height: u64,
    },
    /// Replaces the council.
    SetCouncil {
        members: Vec<Address>,
        threshold: u8,
    },
    /// Admits (or updates) an APN participant as ACTIVE (Section 40B.2).
    UpsertParticipant(Box<crate::apn::ParticipantSpec>),
    /// Suspends, reinstates or terminates a participant. Suspension takes effect without a
    /// timelock (for cause, Section 40B.2).
    SetParticipantStatus { aic: crate::apn::Aic, status: u8 },
}

impl GovAction {
    /// The timelock class (Section 35): how many governance epochs must pass after approval.
    pub const fn timelock_epochs(&self) -> u64 {
        match self {
            GovAction::SetParticipantStatus {
                status: crate::apn::status::SUSPENDED,
                ..
            } => 0,
            GovAction::RegisterIssuer { .. }
            | GovAction::SetIssuerActive { .. }
            | GovAction::SetFeePrice { .. }
            | GovAction::UpsertParticipant(_)
            | GovAction::SetParticipantStatus { .. } => 1,
            GovAction::SetAeyCapacity { .. } => 4,
            GovAction::ScheduleUpgrade { .. } | GovAction::SetCouncil { .. } => 8,
        }
    }
}

impl AceEncode for GovAction {
    fn encode(&self, out: &mut AceWriter) {
        match self {
            GovAction::RegisterIssuer {
                kind,
                issuer_id,
                controller,
                scopes,
                cosign_classes,
                cosign_key,
            } => {
                out.u8(1);
                kind.encode(out);
                out.u32(*issuer_id);
                controller.encode(out);
                u32_list(out, scopes);
                u32_list(out, cosign_classes);
                match cosign_key {
                    None => out.u8(0),
                    Some(key) => {
                        out.u8(1);
                        out.fixed(key);
                    }
                }
            }
            GovAction::SetIssuerActive {
                kind,
                issuer_id,
                active,
            } => {
                out.u8(2);
                kind.encode(out);
                out.u32(*issuer_id);
                out.bool(*active);
            }
            GovAction::SetFeePrice { asset, eu_price } => {
                out.u8(3);
                asset.encode(out);
                out.u128(*eu_price);
            }
            GovAction::SetAeyCapacity { capacity } => {
                out.u8(4);
                out.u128(*capacity);
            }
            GovAction::ScheduleUpgrade {
                protocol_version,
                activation_height,
            } => {
                out.u8(5);
                out.u16(*protocol_version);
                out.u64(*activation_height);
            }
            GovAction::SetCouncil { members, threshold } => {
                out.u8(6);
                out.list(members);
                out.u8(*threshold);
            }
            GovAction::UpsertParticipant(spec) => {
                out.u8(7);
                spec.encode(out);
            }
            GovAction::SetParticipantStatus { aic, status } => {
                out.u8(8);
                aic.encode(out);
                out.u8(*status);
            }
        }
    }
}

impl AceDecode for GovAction {
    fn decode(input: &mut AceReader<'_>) -> Result<GovAction, AletheiaError> {
        Ok(match input.u8()? {
            1 => GovAction::RegisterIssuer {
                kind: RegistryKind::decode(input)?,
                issuer_id: input.u32()?,
                controller: Address::decode(input)?,
                scopes: read_u32_list(input, MAX_SCOPES)?,
                cosign_classes: read_u32_list(input, MAX_SCOPES)?,
                cosign_key: match input.u8()? {
                    0 => None,
                    1 => Some(input.array()?),
                    _ => return Err(bad("co-signing key marker")),
                },
            },
            2 => GovAction::SetIssuerActive {
                kind: RegistryKind::decode(input)?,
                issuer_id: input.u32()?,
                active: input.bool()?,
            },
            3 => GovAction::SetFeePrice {
                asset: AssetId::decode(input)?,
                eu_price: input.u128()?,
            },
            4 => GovAction::SetAeyCapacity {
                capacity: input.u128()?,
            },
            5 => GovAction::ScheduleUpgrade {
                protocol_version: input.u16()?,
                activation_height: input.u64()?,
            },
            6 => GovAction::SetCouncil {
                members: input.list(MAX_COUNCIL)?,
                threshold: input.u8()?,
            },
            7 => {
                GovAction::UpsertParticipant(Box::new(crate::apn::ParticipantSpec::decode(input)?))
            }
            8 => GovAction::SetParticipantStatus {
                aic: crate::apn::Aic::decode(input)?,
                status: input.u8()?,
            },
            _ => return Err(bad("unknown governance action")),
        })
    }
}

/// Every registry and governance payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegistryOp {
    IdentityCreate {
        identity_id: Hash32,
        controller: Address,
        issuer_id: u32,
        attributes_commitment: Hash32,
    },
    IdentityUpdate {
        identity_id: Hash32,
        attributes_commitment: Hash32,
    },
    IdentitySetStatus {
        identity_id: Hash32,
        status: IdentityStatus,
    },
    IdentityRotate {
        identity_id: Hash32,
        new_controller: Address,
    },
    CredentialIssue {
        credential_id: Hash32,
        subject: Hash32,
        schema_id: u32,
        issuer_id: u32,
        commitment: Hash32,
        status_list_index: u32,
        expiry_epoch: u64,
    },
    /// Batch update of the issuer's revocation bitmap: `(index, revoked)`.
    CredentialStatus {
        issuer_id: u32,
        updates: Vec<(u32, bool)>,
    },
    ResidenceIssue {
        residence_id: Hash32,
        identity_id: Hash32,
        class: u16,
        issuer_id: u32,
        expiry_epoch: u64,
    },
    ResidenceSetStatus {
        residence_id: Hash32,
        status: ResidenceStatus,
        reason_code: u16,
    },
    ParcelRegister {
        parcel_id: Hash32,
        geometry_commitment: Hash32,
        controller: ControllerRef,
        class: u16,
        authority_id: u32,
    },
    /// By the current controller; the authority co-signs when the parcel's class needs it.
    ParcelTransfer {
        parcel_id: Hash32,
        new_controller: ControllerRef,
        authority_signature: Option<[u8; 64]>,
    },
    ParcelEncumber {
        parcel_id: Hash32,
        encumbrance: Encumbrance,
    },
    /// Removes encumbrance `index`, by the authority or the encumbrance holder.
    ParcelRelease {
        parcel_id: Hash32,
        index: u32,
    },
    ParcelSetStatus {
        parcel_id: Hash32,
        status: ParcelStatus,
    },
    GovPropose {
        action: GovAction,
    },
    GovVote {
        proposal_id: Hash32,
        approve: bool,
    },
    GovExecute {
        proposal_id: Hash32,
    },
}

impl RegistryOp {
    pub const fn tx_type(&self) -> u16 {
        match self {
            RegistryOp::IdentityCreate { .. } => 48,
            RegistryOp::IdentityUpdate { .. } => 49,
            RegistryOp::IdentitySetStatus { .. } => 50,
            RegistryOp::IdentityRotate { .. } => 51,
            RegistryOp::CredentialIssue { .. } => 52,
            RegistryOp::CredentialStatus { .. } => 53,
            RegistryOp::ResidenceIssue { .. } => 56,
            RegistryOp::ResidenceSetStatus { .. } => 57,
            RegistryOp::ParcelRegister { .. } => 59,
            RegistryOp::ParcelTransfer { .. } => 60,
            RegistryOp::ParcelEncumber { .. } => 61,
            RegistryOp::ParcelRelease { .. } => 62,
            RegistryOp::ParcelSetStatus { .. } => 63,
            RegistryOp::GovPropose { .. } => 80,
            RegistryOp::GovVote { .. } => 81,
            RegistryOp::GovExecute { .. } => 82,
        }
    }

    pub const TX_TYPES: [u16; 16] = [
        48, 49, 50, 51, 52, 53, 56, 57, 59, 60, 61, 62, 63, 80, 81, 82,
    ];

    pub fn encode_content(&self, out: &mut AceWriter) {
        match self {
            RegistryOp::IdentityCreate {
                identity_id,
                controller,
                issuer_id,
                attributes_commitment,
            } => {
                identity_id.encode(out);
                controller.encode(out);
                out.u32(*issuer_id);
                attributes_commitment.encode(out);
            }
            RegistryOp::IdentityUpdate {
                identity_id,
                attributes_commitment,
            } => {
                identity_id.encode(out);
                attributes_commitment.encode(out);
            }
            RegistryOp::IdentitySetStatus {
                identity_id,
                status,
            } => {
                identity_id.encode(out);
                status.encode(out);
            }
            RegistryOp::IdentityRotate {
                identity_id,
                new_controller,
            } => {
                identity_id.encode(out);
                new_controller.encode(out);
            }
            RegistryOp::CredentialIssue {
                credential_id,
                subject,
                schema_id,
                issuer_id,
                commitment,
                status_list_index,
                expiry_epoch,
            } => {
                credential_id.encode(out);
                subject.encode(out);
                out.u32(*schema_id);
                out.u32(*issuer_id);
                commitment.encode(out);
                out.u32(*status_list_index);
                out.u64(*expiry_epoch);
            }
            RegistryOp::CredentialStatus { issuer_id, updates } => {
                out.u32(*issuer_id);
                out.u32(u32::try_from(updates.len()).unwrap_or(u32::MAX));
                for (index, revoked) in updates {
                    out.u32(*index);
                    out.bool(*revoked);
                }
            }
            RegistryOp::ResidenceIssue {
                residence_id,
                identity_id,
                class,
                issuer_id,
                expiry_epoch,
            } => {
                residence_id.encode(out);
                identity_id.encode(out);
                out.u16(*class);
                out.u32(*issuer_id);
                out.u64(*expiry_epoch);
            }
            RegistryOp::ResidenceSetStatus {
                residence_id,
                status,
                reason_code,
            } => {
                residence_id.encode(out);
                status.encode(out);
                out.u16(*reason_code);
            }
            RegistryOp::ParcelRegister {
                parcel_id,
                geometry_commitment,
                controller,
                class,
                authority_id,
            } => {
                parcel_id.encode(out);
                geometry_commitment.encode(out);
                controller.encode(out);
                out.u16(*class);
                out.u32(*authority_id);
            }
            RegistryOp::ParcelTransfer {
                parcel_id,
                new_controller,
                authority_signature,
            } => {
                parcel_id.encode(out);
                new_controller.encode(out);
                match authority_signature {
                    None => out.u8(0),
                    Some(signature) => {
                        out.u8(1);
                        out.fixed(signature);
                    }
                }
            }
            RegistryOp::ParcelEncumber {
                parcel_id,
                encumbrance,
            } => {
                parcel_id.encode(out);
                encumbrance.encode(out);
            }
            RegistryOp::ParcelRelease { parcel_id, index } => {
                parcel_id.encode(out);
                out.u32(*index);
            }
            RegistryOp::ParcelSetStatus { parcel_id, status } => {
                parcel_id.encode(out);
                status.encode(out);
            }
            RegistryOp::GovPropose { action } => action.encode(out),
            RegistryOp::GovVote {
                proposal_id,
                approve,
            } => {
                proposal_id.encode(out);
                out.bool(*approve);
            }
            RegistryOp::GovExecute { proposal_id } => proposal_id.encode(out),
        }
    }

    /// `None` when `tx_type` is not a registry or governance type.
    pub fn decode_content(
        tx_type: u16,
        input: &mut AceReader<'_>,
    ) -> Option<Result<RegistryOp, AletheiaError>> {
        let op = || -> Result<RegistryOp, AletheiaError> {
            Ok(match tx_type {
                48 => RegistryOp::IdentityCreate {
                    identity_id: Hash32::decode(input)?,
                    controller: Address::decode(input)?,
                    issuer_id: input.u32()?,
                    attributes_commitment: Hash32::decode(input)?,
                },
                49 => RegistryOp::IdentityUpdate {
                    identity_id: Hash32::decode(input)?,
                    attributes_commitment: Hash32::decode(input)?,
                },
                50 => RegistryOp::IdentitySetStatus {
                    identity_id: Hash32::decode(input)?,
                    status: IdentityStatus::decode(input)?,
                },
                51 => RegistryOp::IdentityRotate {
                    identity_id: Hash32::decode(input)?,
                    new_controller: Address::decode(input)?,
                },
                52 => RegistryOp::CredentialIssue {
                    credential_id: Hash32::decode(input)?,
                    subject: Hash32::decode(input)?,
                    schema_id: input.u32()?,
                    issuer_id: input.u32()?,
                    commitment: Hash32::decode(input)?,
                    status_list_index: input.u32()?,
                    expiry_epoch: input.u64()?,
                },
                53 => {
                    let issuer_id = input.u32()?;
                    let n = input.u32()?;
                    if n == 0 || n > MAX_STATUS_UPDATES {
                        return Err(bad("status updates: 1 to 256 entries"));
                    }
                    let updates = (0..n)
                        .map(|_| Ok((input.u32()?, input.bool()?)))
                        .collect::<Result<Vec<_>, AletheiaError>>()?;
                    RegistryOp::CredentialStatus { issuer_id, updates }
                }
                56 => RegistryOp::ResidenceIssue {
                    residence_id: Hash32::decode(input)?,
                    identity_id: Hash32::decode(input)?,
                    class: input.u16()?,
                    issuer_id: input.u32()?,
                    expiry_epoch: input.u64()?,
                },
                57 => RegistryOp::ResidenceSetStatus {
                    residence_id: Hash32::decode(input)?,
                    status: ResidenceStatus::decode(input)?,
                    reason_code: input.u16()?,
                },
                59 => RegistryOp::ParcelRegister {
                    parcel_id: Hash32::decode(input)?,
                    geometry_commitment: Hash32::decode(input)?,
                    controller: ControllerRef::decode(input)?,
                    class: input.u16()?,
                    authority_id: input.u32()?,
                },
                60 => RegistryOp::ParcelTransfer {
                    parcel_id: Hash32::decode(input)?,
                    new_controller: ControllerRef::decode(input)?,
                    authority_signature: match input.u8()? {
                        0 => None,
                        1 => Some(input.array()?),
                        _ => return Err(bad("co-signature marker")),
                    },
                },
                61 => RegistryOp::ParcelEncumber {
                    parcel_id: Hash32::decode(input)?,
                    encumbrance: Encumbrance::decode(input)?,
                },
                62 => RegistryOp::ParcelRelease {
                    parcel_id: Hash32::decode(input)?,
                    index: input.u32()?,
                },
                63 => RegistryOp::ParcelSetStatus {
                    parcel_id: Hash32::decode(input)?,
                    status: ParcelStatus::decode(input)?,
                },
                80 => RegistryOp::GovPropose {
                    action: GovAction::decode(input)?,
                },
                81 => RegistryOp::GovVote {
                    proposal_id: Hash32::decode(input)?,
                    approve: input.bool()?,
                },
                82 => RegistryOp::GovExecute {
                    proposal_id: Hash32::decode(input)?,
                },
                _ => return Err(bad("not a registry type")),
            })
        };
        RegistryOp::TX_TYPES.contains(&tx_type).then(op)
    }
}

/// What a land authority co-signs for a transfer: bound to the parcel, the new controller and
/// the transaction (sender and nonce), so it cannot be replayed (ERRATA E-26).
pub fn parcel_transfer_digest(
    network: &NetworkIdentity,
    parcel_id: &Hash32,
    new_controller: &ControllerRef,
    sender: &Address,
    nonce: u64,
) -> Hash32 {
    let mut out = AceWriter::new();
    parcel_id.encode(&mut out);
    new_controller.encode(&mut out);
    sender.encode(&mut out);
    out.u64(nonce);
    network.domain_hash(DomainTag::ParcelTransfer, out.as_bytes())
}

/// A proposal's id: the proposer, its nonce and the action (so the same action can be
/// proposed again later under a new id).
pub fn proposal_id(
    network: &NetworkIdentity,
    proposer: &Address,
    nonce: u64,
    action: &GovAction,
) -> Hash32 {
    let mut out = AceWriter::new();
    proposer.encode(&mut out);
    out.u64(nonce);
    action.encode(&mut out);
    network.domain_hash(DomainTag::GovernanceProposal, out.as_bytes())
}
