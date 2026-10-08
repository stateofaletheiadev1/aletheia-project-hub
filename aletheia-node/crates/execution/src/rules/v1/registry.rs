//! Identity, residence and land registries and governance, protocol version 1 (spec
//! Sections 31-33, 35; ADR-048).
//!
//! Permissions, checked before anything changes:
//!
//! ```text
//! identity create/update/status, credentials   the identity issuer's controller (in scope)
//! identity rotate                               the identity's controller
//! residence issue/status                        the residence issuer's controller (class in scope)
//! parcel register/encumber/status               the land authority's controller (class in scope)
//! parcel release                                the authority or the encumbrance holder
//! parcel transfer                               the controller (+ authority co-signature by class)
//! propose / vote                                a council member;  execute: anyone, after the timelock
//! ```
//!
//! Governance performs only designated actions, each with bounds. Epochs here are governance
//! epochs, `slot / epoch_slots`, until epoch transitions arrive (ADR-048).

use aletheia_core::registry::{
    ControllerRef, GovAction, IdentityStatus, ParcelStatus, RegistryKind, RegistryOp,
    ResidenceStatus, parcel_transfer_digest, proposal_id,
};
use aletheia_core::{AceEncode, Address, AletheiaError, AssetId, ErrorCode, Hash32};
use aletheia_crypto::{Ed25519PublicKey, Ed25519Signature};
use aletheia_state::StateOverlay;

use crate::context::{BlockContext, Meter, OutOfEu};
use crate::model::{ParamId, ProtocolScheduleEntry, Records, module_address};
use crate::receipt::{Event, event_type};
use crate::registry_model::{
    CredentialRecord, DEFAULT_EPOCH_SLOTS, GovernancePolicy, IdentityRecord, IssuerRecord,
    LandHistory, LandOp, ParcelRecord, Proposal, ProposalStatus, Registry, ResidenceHistory,
    ResidenceRecord,
};
use crate::rules::v1::limits::{REGISTRY_EU, SIGNATURE_EU};
use crate::stateless::VerifiedTransaction;

type Step = Result<Result<(), OutOfEu>, AletheiaError>;

/// Emits registry and governance events.
pub(crate) const REGISTRY_MODULE: Address = module_address(5);
/// Highest revocation-list index (a 2^20-bit list per issuer).
pub const MAX_STATUS_INDEX: u32 = (1 << 20) - 1;

fn fail(code: ErrorCode, detail: impl Into<String>) -> AletheiaError {
    AletheiaError::new(code, detail.into())
}

struct Cx<'a, 'o> {
    reg: Registry<'a>,
    overlay: &'a mut StateOverlay<'o>,
    sender: Address,
    nonce: u64,
    tx_id: Hash32,
    ctx: &'a BlockContext,
    events: &'a mut Vec<Event>,
}

impl Cx<'_, '_> {
    fn epoch(&self) -> Result<u64, AletheiaError> {
        let slots = self
            .reg
            .policy(self.overlay)?
            .map_or(DEFAULT_EPOCH_SLOTS, |p| p.epoch_slots)
            .max(1);
        Ok(self.ctx.slot.get().checked_div(slots).unwrap_or(0))
    }

    fn emit(&mut self, schema: &str, topics: Vec<Hash32>, data: Vec<u8>) {
        self.events.push(Event {
            emitter: REGISTRY_MODULE,
            event_type: event_type(schema),
            topics,
            data,
        });
    }

    /// The issuer, registered for `kind`, active, and controlled by the sender.
    fn issuer(&self, kind: RegistryKind, id: u32) -> Result<IssuerRecord, AletheiaError> {
        let issuer = self
            .reg
            .issuer(self.overlay, kind, id)?
            .filter(|i| i.active)
            .ok_or_else(|| {
                fail(
                    ErrorCode::RegIssuerUnknown,
                    format!("no active {kind:?} issuer {id}"),
                )
            })?;
        if issuer.controller != self.sender {
            return Err(fail(
                ErrorCode::RegNotAuthorized,
                format!("only the controller of {kind:?} issuer {id} may do this"),
            ));
        }
        Ok(issuer)
    }

    fn in_scope(issuer: &IssuerRecord, scope: u32, what: &str) -> Result<(), AletheiaError> {
        if issuer.scopes.contains(&scope) {
            Ok(())
        } else {
            Err(fail(
                ErrorCode::RegOutOfScope,
                format!("{what} {scope} is outside this issuer's scope"),
            ))
        }
    }

    fn identity(&self, id: &Hash32) -> Result<IdentityRecord, AletheiaError> {
        self.reg
            .identity(self.overlay, id)?
            .ok_or_else(|| fail(ErrorCode::RegNotFound, format!("no identity {id}")))
    }

    /// Whether the sender controls `controller` (an address directly, or an active identity).
    fn controls(&self, controller: &ControllerRef) -> Result<bool, AletheiaError> {
        Ok(match controller {
            ControllerRef::Address(address) => *address == self.sender,
            ControllerRef::Identity(id) => self
                .reg
                .identity(self.overlay, id)?
                .is_some_and(|i| i.status == IdentityStatus::Active && i.controller == self.sender),
        })
    }

    fn land_history(&mut self, parcel_id: &Hash32, parcel: &mut ParcelRecord, entry: LandHistory) {
        let key = self.reg.land_history_key(parcel_id, parcel.history_seq);
        self.overlay.put(key, entry.to_ace_bytes());
        parcel.history_seq = parcel.history_seq.saturating_add(1);
    }

    fn residence_history(&mut self, id: &Hash32, residence: &mut ResidenceRecord, epoch: u64) {
        let entry = ResidenceHistory {
            status: residence.status,
            reason_code: residence.revocation_reason_code,
            epoch,
            tx_id: self.tx_id,
        };
        self.overlay.put(
            self.reg.residence_history_key(id, residence.history_seq),
            entry.to_ace_bytes(),
        );
        residence.history_seq = residence.history_seq.saturating_add(1);
    }
}

#[allow(
    clippy::too_many_lines,
    reason = "one arm per registry operation reads best as one table"
)]
pub(crate) fn apply(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    op: &RegistryOp,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Step {
    if meter.charge(REGISTRY_EU).is_err() {
        return Ok(Err(OutOfEu));
    }
    let body = &verified.transaction().body;
    let mut cx = Cx {
        reg: Registry { records },
        overlay,
        sender: body.sender,
        nonce: body.nonce,
        tx_id: verified.tx_id().hash(),
        ctx,
        events,
    };
    let epoch = cx.epoch()?;
    match op {
        RegistryOp::IdentityCreate {
            identity_id,
            controller,
            issuer_id,
            attributes_commitment,
        } => {
            cx.issuer(RegistryKind::Identity, *issuer_id)?;
            if cx.reg.identity(cx.overlay, identity_id)?.is_some() {
                return Err(fail(
                    ErrorCode::RegAlreadyExists,
                    format!("identity {identity_id} exists"),
                ));
            }
            let record = IdentityRecord {
                controller: *controller,
                status: IdentityStatus::Active,
                issuer_id: *issuer_id,
                created_epoch: epoch,
                updated_epoch: epoch,
                attributes_commitment: *attributes_commitment,
            };
            cx.reg.put_identity(cx.overlay, identity_id, &record);
            cx.emit(
                "aletheia.identity.created.v1",
                vec![*identity_id],
                controller.to_ace_bytes(),
            );
        }
        RegistryOp::IdentityUpdate {
            identity_id,
            attributes_commitment,
        } => {
            let mut identity = cx.identity(identity_id)?;
            cx.issuer(RegistryKind::Identity, identity.issuer_id)?;
            if identity.status == IdentityStatus::Revoked {
                return Err(fail(
                    ErrorCode::RegInvalidTransition,
                    "a revoked identity cannot change",
                ));
            }
            identity.attributes_commitment = *attributes_commitment;
            identity.updated_epoch = epoch;
            cx.reg.put_identity(cx.overlay, identity_id, &identity);
            cx.emit(
                "aletheia.identity.updated.v1",
                vec![*identity_id],
                attributes_commitment.as_bytes().to_vec(),
            );
        }
        RegistryOp::IdentitySetStatus {
            identity_id,
            status,
        } => {
            let mut identity = cx.identity(identity_id)?;
            cx.issuer(RegistryKind::Identity, identity.issuer_id)?;
            if identity.status == IdentityStatus::Revoked {
                return Err(fail(ErrorCode::RegInvalidTransition, "revocation is final"));
            }
            identity.status = *status;
            identity.updated_epoch = epoch;
            cx.reg.put_identity(cx.overlay, identity_id, &identity);
            cx.emit(
                "aletheia.identity.status.v1",
                vec![*identity_id],
                vec![status.code()],
            );
        }
        RegistryOp::IdentityRotate {
            identity_id,
            new_controller,
        } => {
            let mut identity = cx.identity(identity_id)?;
            if identity.controller != cx.sender {
                return Err(fail(
                    ErrorCode::RegNotAuthorized,
                    "only the identity's controller may rotate it",
                ));
            }
            if identity.status != IdentityStatus::Active {
                return Err(fail(
                    ErrorCode::RegInvalidTransition,
                    "only an active identity can rotate its controller",
                ));
            }
            identity.controller = *new_controller;
            identity.updated_epoch = epoch;
            cx.reg.put_identity(cx.overlay, identity_id, &identity);
            cx.emit(
                "aletheia.identity.rotated.v1",
                vec![*identity_id],
                new_controller.to_ace_bytes(),
            );
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
            let issuer = cx.issuer(RegistryKind::Identity, *issuer_id)?;
            Cx::in_scope(&issuer, *schema_id, "schema")?;
            if cx.identity(subject)?.status != IdentityStatus::Active {
                return Err(fail(
                    ErrorCode::RegInvalidTransition,
                    "credentials are issued only to active identities",
                ));
            }
            if cx.reg.credential(cx.overlay, credential_id)?.is_some() {
                return Err(fail(
                    ErrorCode::RegAlreadyExists,
                    format!("credential {credential_id} exists"),
                ));
            }
            if *status_list_index > MAX_STATUS_INDEX || *expiry_epoch <= epoch {
                return Err(fail(
                    ErrorCode::TxFieldOutOfRange,
                    "status index out of range or expiry not in the future",
                ));
            }
            let record = CredentialRecord {
                subject: *subject,
                schema_id: *schema_id,
                issuer_id: *issuer_id,
                commitment: *commitment,
                status_list_index: *status_list_index,
                issued_epoch: epoch,
                expiry_epoch: *expiry_epoch,
            };
            cx.reg.put_credential(cx.overlay, credential_id, &record);
            cx.emit(
                "aletheia.credential.issued.v1",
                vec![*credential_id, *subject],
                schema_id.to_le_bytes().to_vec(),
            );
        }
        RegistryOp::CredentialStatus { issuer_id, updates } => {
            cx.issuer(RegistryKind::Identity, *issuer_id)?;
            for (index, revoked) in updates {
                if *index > MAX_STATUS_INDEX {
                    return Err(fail(
                        ErrorCode::TxFieldOutOfRange,
                        format!("status index {index} out of range"),
                    ));
                }
                let word = index / 64;
                let bit = 1u64 << (index % 64);
                let current = cx.reg.status_word(cx.overlay, *issuer_id, word)?;
                let next = if *revoked {
                    current | bit
                } else {
                    current & !bit
                };
                cx.overlay.put(
                    cx.reg.status_word_key(*issuer_id, word),
                    next.to_ace_bytes(),
                );
            }
            cx.emit(
                "aletheia.credential.status.v1",
                Vec::new(),
                issuer_id.to_le_bytes().to_vec(),
            );
        }
        RegistryOp::ResidenceIssue {
            residence_id,
            identity_id,
            class,
            issuer_id,
            expiry_epoch,
        } => {
            let issuer = cx.issuer(RegistryKind::Residence, *issuer_id)?;
            Cx::in_scope(&issuer, u32::from(*class), "residence class")?;
            if cx.identity(identity_id)?.status != IdentityStatus::Active {
                return Err(fail(
                    ErrorCode::RegInvalidTransition,
                    "residence is issued only to active identities",
                ));
            }
            if cx.reg.residence(cx.overlay, residence_id)?.is_some() {
                return Err(fail(
                    ErrorCode::RegAlreadyExists,
                    format!("residence {residence_id} exists"),
                ));
            }
            if *expiry_epoch <= epoch {
                return Err(fail(
                    ErrorCode::TxFieldOutOfRange,
                    "residence expiry must be in the future",
                ));
            }
            let mut record = ResidenceRecord {
                identity_id: *identity_id,
                class: *class,
                status: ResidenceStatus::Active,
                issuer_id: *issuer_id,
                issued_epoch: epoch,
                expiry_epoch: *expiry_epoch,
                revocation_reason_code: 0,
                history_seq: 0,
            };
            cx.residence_history(residence_id, &mut record, epoch);
            cx.reg.put_residence(cx.overlay, residence_id, &record);
            cx.emit(
                "aletheia.residence.issued.v1",
                vec![*residence_id, *identity_id],
                class.to_le_bytes().to_vec(),
            );
        }
        RegistryOp::ResidenceSetStatus {
            residence_id,
            status,
            reason_code,
        } => {
            let mut record = cx.reg.residence(cx.overlay, residence_id)?.ok_or_else(|| {
                fail(
                    ErrorCode::RegNotFound,
                    format!("no residence {residence_id}"),
                )
            })?;
            cx.issuer(RegistryKind::Residence, record.issuer_id)?;
            let allowed = matches!(
                (record.status_at(epoch), status),
                (
                    ResidenceStatus::Pending,
                    ResidenceStatus::Active | ResidenceStatus::Revoked
                ) | (ResidenceStatus::Active, ResidenceStatus::Revoked)
            );
            if !allowed {
                return Err(fail(
                    ErrorCode::RegInvalidTransition,
                    format!(
                        "residence cannot go from {:?} to {status:?}",
                        record.status_at(epoch)
                    ),
                ));
            }
            record.status = *status;
            record.revocation_reason_code = *reason_code;
            cx.residence_history(residence_id, &mut record, epoch);
            cx.reg.put_residence(cx.overlay, residence_id, &record);
            cx.emit(
                "aletheia.residence.status.v1",
                vec![*residence_id],
                vec![status.code()],
            );
        }
        RegistryOp::ParcelRegister {
            parcel_id,
            geometry_commitment,
            controller,
            class,
            authority_id,
        } => {
            let authority = cx.issuer(RegistryKind::Land, *authority_id)?;
            Cx::in_scope(&authority, u32::from(*class), "parcel class")?;
            if cx.reg.parcel(cx.overlay, parcel_id)?.is_some() {
                return Err(fail(
                    ErrorCode::RegAlreadyExists,
                    format!("parcel {parcel_id} exists"),
                ));
            }
            let mut parcel = ParcelRecord {
                geometry_commitment: *geometry_commitment,
                controller: *controller,
                class: *class,
                status: ParcelStatus::Registered,
                encumbrances: Vec::new(),
                authority_id: *authority_id,
                history_seq: 0,
            };
            let entry = LandHistory {
                op: LandOp::Register,
                prior_controller: None,
                new_controller: Some(*controller),
                authority_sig_ref: Hash32::ZERO,
                tx_id: cx.tx_id,
                epoch,
            };
            cx.land_history(parcel_id, &mut parcel, entry);
            cx.reg.put_parcel(cx.overlay, parcel_id, &parcel);
            cx.emit(
                "aletheia.land.registered.v1",
                vec![*parcel_id],
                controller.to_ace_bytes(),
            );
        }
        RegistryOp::ParcelTransfer {
            parcel_id,
            new_controller,
            authority_signature,
        } => {
            let mut parcel = cx
                .reg
                .parcel(cx.overlay, parcel_id)?
                .ok_or_else(|| fail(ErrorCode::RegNotFound, format!("no parcel {parcel_id}")))?;
            if !cx.controls(&parcel.controller)? {
                return Err(fail(
                    ErrorCode::RegNotAuthorized,
                    "only the parcel's controller may transfer it",
                ));
            }
            let encumbered = parcel.encumbrances.iter().any(|e| e.until_epoch >= epoch);
            if parcel.status != ParcelStatus::Registered || encumbered {
                return Err(fail(
                    ErrorCode::RegParcelLocked,
                    format!("parcel is {:?} and cannot transfer", parcel.status),
                ));
            }
            let authority = cx
                .reg
                .issuer(cx.overlay, RegistryKind::Land, parcel.authority_id)?
                .ok_or_else(|| {
                    fail(
                        ErrorCode::RegIssuerUnknown,
                        "the parcel's authority is not registered",
                    )
                })?;
            let mut sig_ref = Hash32::ZERO;
            if authority.cosign_classes.contains(&u32::from(parcel.class)) {
                if meter.charge(SIGNATURE_EU).is_err() {
                    return Ok(Err(OutOfEu));
                }
                let digest = parcel_transfer_digest(
                    records.network(),
                    parcel_id,
                    new_controller,
                    &cx.sender,
                    cx.nonce,
                );
                let valid = match (authority.cosign_key, authority_signature) {
                    (Some(key), Some(signature)) => Ed25519PublicKey::from_bytes(&key)
                        .and_then(|k| k.verify(&digest, &Ed25519Signature::from_bytes(*signature)))
                        .is_ok(),
                    _ => false,
                };
                if !valid {
                    return Err(fail(
                        ErrorCode::RegCosignRequired,
                        "this parcel class needs the authority's co-signature",
                    ));
                }
                if let Some(signature) = authority_signature {
                    sig_ref = Hash32::from_bytes(*blake3::hash(signature).as_bytes());
                }
            }
            let prior = parcel.controller;
            parcel.controller = *new_controller;
            let entry = LandHistory {
                op: LandOp::Transfer,
                prior_controller: Some(prior),
                new_controller: Some(*new_controller),
                authority_sig_ref: sig_ref,
                tx_id: cx.tx_id,
                epoch,
            };
            cx.land_history(parcel_id, &mut parcel, entry);
            cx.reg.put_parcel(cx.overlay, parcel_id, &parcel);
            cx.emit(
                "aletheia.land.transferred.v1",
                vec![*parcel_id],
                new_controller.to_ace_bytes(),
            );
        }
        RegistryOp::ParcelEncumber {
            parcel_id,
            encumbrance,
        } => {
            let mut parcel = cx
                .reg
                .parcel(cx.overlay, parcel_id)?
                .ok_or_else(|| fail(ErrorCode::RegNotFound, format!("no parcel {parcel_id}")))?;
            cx.issuer(RegistryKind::Land, parcel.authority_id)?;
            if matches!(parcel.status, ParcelStatus::Retired) || parcel.encumbrances.len() >= 64 {
                return Err(fail(
                    ErrorCode::RegInvalidTransition,
                    "a retired parcel, or one with 64 encumbrances, takes no more",
                ));
            }
            parcel.encumbrances.push(*encumbrance);
            if parcel.status == ParcelStatus::Registered {
                parcel.status = ParcelStatus::Encumbered;
            }
            let entry = LandHistory {
                op: LandOp::Encumber,
                prior_controller: None,
                new_controller: None,
                authority_sig_ref: Hash32::ZERO,
                tx_id: cx.tx_id,
                epoch,
            };
            cx.land_history(parcel_id, &mut parcel, entry);
            cx.reg.put_parcel(cx.overlay, parcel_id, &parcel);
            cx.emit(
                "aletheia.land.encumbered.v1",
                vec![*parcel_id],
                encumbrance.to_ace_bytes(),
            );
        }
        RegistryOp::ParcelRelease { parcel_id, index } => {
            let mut parcel = cx
                .reg
                .parcel(cx.overlay, parcel_id)?
                .ok_or_else(|| fail(ErrorCode::RegNotFound, format!("no parcel {parcel_id}")))?;
            let position = usize::try_from(*index).unwrap_or(usize::MAX);
            let holder = parcel
                .encumbrances
                .get(position)
                .map(|e| e.holder)
                .ok_or_else(|| fail(ErrorCode::RegNotFound, format!("no encumbrance {index}")))?;
            let authority_ok = cx.issuer(RegistryKind::Land, parcel.authority_id).is_ok();
            if !authority_ok && holder != cx.sender {
                return Err(fail(
                    ErrorCode::RegNotAuthorized,
                    "only the authority or the holder may release an encumbrance",
                ));
            }
            parcel.encumbrances.remove(position);
            if parcel.encumbrances.is_empty() && parcel.status == ParcelStatus::Encumbered {
                parcel.status = ParcelStatus::Registered;
            }
            let entry = LandHistory {
                op: LandOp::Release,
                prior_controller: None,
                new_controller: None,
                authority_sig_ref: Hash32::ZERO,
                tx_id: cx.tx_id,
                epoch,
            };
            cx.land_history(parcel_id, &mut parcel, entry);
            cx.reg.put_parcel(cx.overlay, parcel_id, &parcel);
            cx.emit(
                "aletheia.land.released.v1",
                vec![*parcel_id],
                index.to_le_bytes().to_vec(),
            );
        }
        RegistryOp::ParcelSetStatus { parcel_id, status } => {
            let mut parcel = cx
                .reg
                .parcel(cx.overlay, parcel_id)?
                .ok_or_else(|| fail(ErrorCode::RegNotFound, format!("no parcel {parcel_id}")))?;
            cx.issuer(RegistryKind::Land, parcel.authority_id)?;
            let target = match (parcel.status, status) {
                (ParcelStatus::Retired, _) | (_, ParcelStatus::Encumbered) => None,
                (_, ParcelStatus::Frozen | ParcelStatus::Retired) => Some(*status),
                // Unfreezing returns to Encumbered while encumbrances remain.
                (ParcelStatus::Frozen, ParcelStatus::Registered) => {
                    Some(if parcel.encumbrances.is_empty() {
                        ParcelStatus::Registered
                    } else {
                        ParcelStatus::Encumbered
                    })
                }
                _ => None,
            };
            let Some(target) = target else {
                return Err(fail(
                    ErrorCode::RegInvalidTransition,
                    format!("parcel cannot go from {:?} to {status:?}", parcel.status),
                ));
            };
            parcel.status = target;
            let entry = LandHistory {
                op: LandOp::SetStatus,
                prior_controller: None,
                new_controller: None,
                authority_sig_ref: Hash32::ZERO,
                tx_id: cx.tx_id,
                epoch,
            };
            cx.land_history(parcel_id, &mut parcel, entry);
            cx.reg.put_parcel(cx.overlay, parcel_id, &parcel);
            cx.emit(
                "aletheia.land.status.v1",
                vec![*parcel_id],
                vec![target.code()],
            );
        }
        RegistryOp::GovPropose { action } => governance_propose(&mut cx, action, epoch)?,
        RegistryOp::GovVote {
            proposal_id,
            approve,
        } => governance_vote(&mut cx, proposal_id, *approve, epoch)?,
        RegistryOp::GovExecute { proposal_id } => {
            governance_execute(&mut cx, records, proposal_id, epoch)?
        }
    }
    Ok(Ok(()))
}

fn policy(cx: &Cx<'_, '_>) -> Result<GovernancePolicy, AletheiaError> {
    cx.reg.policy(cx.overlay)?.ok_or_else(|| {
        fail(
            ErrorCode::GovNoCouncil,
            "this chain has no governance council",
        )
    })
}

fn council_member(cx: &Cx<'_, '_>, policy: &GovernancePolicy) -> Result<(), AletheiaError> {
    if policy.council.contains(&cx.sender) {
        Ok(())
    } else {
        Err(fail(
            ErrorCode::GovNotCouncil,
            "only a council member may propose or vote",
        ))
    }
}

fn check_council(members: &[Address], threshold: u8) -> Result<(), AletheiaError> {
    let distinct: std::collections::BTreeSet<_> = members.iter().collect();
    if members.is_empty()
        || distinct.len() != members.len()
        || threshold == 0
        || usize::from(threshold) > members.len()
    {
        return Err(fail(
            ErrorCode::GovOutOfBounds,
            "a council needs distinct members and a threshold between 1 and their number",
        ));
    }
    Ok(())
}

/// Bounds that do not depend on state (state-dependent bounds are checked at execution).
fn check_action(action: &GovAction) -> Result<(), AletheiaError> {
    match action {
        GovAction::RegisterIssuer {
            kind,
            cosign_classes,
            cosign_key,
            scopes,
            ..
        } => {
            if scopes.is_empty() {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    "an issuer needs at least one scope",
                ));
            }
            if !cosign_classes.is_empty() && (*kind != RegistryKind::Land || cosign_key.is_none()) {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    "co-signed classes are for land authorities with a co-signing key",
                ));
            }
            Ok(())
        }
        GovAction::SetCouncil { members, threshold } => check_council(members, *threshold),
        GovAction::ScheduleUpgrade {
            protocol_version, ..
        } if *protocol_version < 2 => Err(fail(
            ErrorCode::GovOutOfBounds,
            "an upgrade schedules version 2 or later",
        )),
        GovAction::SetFeePrice { eu_price: 0, .. } => Err(fail(
            ErrorCode::GovOutOfBounds,
            "a fee price cannot be zero",
        )),
        GovAction::UpsertParticipant(spec) => {
            use aletheia_core::apn::role;
            if !(role::DIRECT_PARTICIPANT..=role::TECHNICAL_SERVICE_PROVIDER).contains(&spec.role) {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    format!("participant role {} does not exist", spec.role),
                ));
            }
            let indirect = spec.role == role::INDIRECT_PARTICIPANT;
            if indirect != spec.sponsor.is_some() || spec.sponsor == Some(spec.aic) {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    "an indirect participant has a sponsor (another participant); no other role has one",
                ));
            }
            if spec.routing_code > 9_999 {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    "a routing code has four digits",
                ));
            }
            Ok(())
        }
        GovAction::SetParticipantStatus { status, .. }
            if !(aletheia_core::apn::status::APPLIED..=aletheia_core::apn::status::TERMINATED)
                .contains(status) =>
        {
            Err(fail(
                ErrorCode::GovOutOfBounds,
                format!("participant status {status} does not exist"),
            ))
        }
        GovAction::UpsertBridgeRoute(route) => crate::rules::v1::bridge::check_route(route),
        _ => Ok(()),
    }
}

/// Admits a participant as ACTIVE, or replaces an existing participant's record keeping its
/// status and certification epoch. One settlement account belongs to one participant.
fn upsert_participant(
    cx: &mut Cx<'_, '_>,
    records: &Records,
    spec: &aletheia_core::apn::ParticipantSpec,
    epoch: u64,
) -> Result<(), AletheiaError> {
    let apn = crate::apn_model::Apn { records };
    if let Some(holder) = apn.participant_at(cx.overlay, &spec.settlement_address)?
        && holder.spec.aic != spec.aic
    {
        return Err(fail(
            ErrorCode::ApnAlreadyExists,
            format!(
                "the settlement account belongs to {}",
                holder.spec.aic.text()
            ),
        ));
    }
    if let Some(sponsor) = &spec.sponsor
        && apn.participant(cx.overlay, sponsor)?.is_none()
    {
        return Err(fail(
            ErrorCode::ApnParticipantUnknown,
            format!("no sponsor {}", sponsor.text()),
        ));
    }
    let existing = apn.participant(cx.overlay, &spec.aic)?;
    if let Some(old) = &existing {
        if old.status == aletheia_core::apn::status::TERMINATED {
            return Err(fail(
                ErrorCode::ApnIllegalTransition,
                format!("participant {} is terminated", spec.aic.text()),
            ));
        }
        if old.spec.settlement_address != spec.settlement_address {
            cx.overlay
                .delete(apn.by_address_key(&old.spec.settlement_address));
        }
    }
    let participant = crate::apn_model::Participant {
        spec: spec.clone(),
        status: existing
            .as_ref()
            .map_or(aletheia_core::apn::status::ACTIVE, |p| p.status),
        certified_epoch: existing.as_ref().map_or(epoch, |p| p.certified_epoch),
        updated_epoch: epoch,
    };
    apn.put_participant(cx.overlay, &participant);
    Ok(())
}

fn settle(proposal: &mut Proposal, policy: &GovernancePolicy, epoch: u64) {
    let approvals = proposal.approvals.len();
    let council = policy.council.len();
    let threshold = usize::from(policy.threshold);
    if approvals >= threshold {
        proposal.status = ProposalStatus::Timelocked;
        proposal.executable_from_epoch = epoch.saturating_add(proposal.action.timelock_epochs());
    } else if proposal.rejections.len() > council.saturating_sub(threshold) {
        proposal.status = ProposalStatus::Rejected;
    }
}

fn governance_propose(
    cx: &mut Cx<'_, '_>,
    action: &GovAction,
    epoch: u64,
) -> Result<(), AletheiaError> {
    let policy = policy(cx)?;
    council_member(cx, &policy)?;
    check_action(action)?;
    let id = proposal_id(cx.reg.records.network(), &cx.sender, cx.nonce, action);
    if cx.reg.proposal(cx.overlay, &id)?.is_some() {
        return Err(fail(ErrorCode::RegAlreadyExists, "this proposal exists"));
    }
    let mut proposal = Proposal {
        proposer: cx.sender,
        action: action.clone(),
        status: ProposalStatus::Voting,
        approvals: vec![cx.sender],
        rejections: Vec::new(),
        submitted_epoch: epoch,
        voting_until_epoch: epoch.saturating_add(policy.voting_epochs),
        executable_from_epoch: 0,
    };
    settle(&mut proposal, &policy, epoch);
    cx.reg.put_proposal(cx.overlay, &id, &proposal);
    cx.emit(
        "aletheia.governance.proposed.v1",
        vec![id],
        action.to_ace_bytes(),
    );
    Ok(())
}

fn governance_vote(
    cx: &mut Cx<'_, '_>,
    id: &Hash32,
    approve: bool,
    epoch: u64,
) -> Result<(), AletheiaError> {
    let policy = policy(cx)?;
    council_member(cx, &policy)?;
    let mut proposal = cx
        .reg
        .proposal(cx.overlay, id)?
        .ok_or_else(|| fail(ErrorCode::RegNotFound, format!("no proposal {id}")))?;
    if proposal.status != ProposalStatus::Voting || epoch > proposal.voting_until_epoch {
        return Err(fail(
            ErrorCode::GovProposalState,
            format!(
                "the proposal is {:?}, or its voting period ended",
                proposal.status
            ),
        ));
    }
    if proposal.approvals.contains(&cx.sender) || proposal.rejections.contains(&cx.sender) {
        return Err(fail(
            ErrorCode::GovAlreadyVoted,
            "this member already voted",
        ));
    }
    if approve {
        proposal.approvals.push(cx.sender);
    } else {
        proposal.rejections.push(cx.sender);
    }
    settle(&mut proposal, &policy, epoch);
    cx.reg.put_proposal(cx.overlay, id, &proposal);
    cx.emit(
        "aletheia.governance.voted.v1",
        vec![*id],
        vec![u8::from(approve)],
    );
    Ok(())
}

fn governance_execute(
    cx: &mut Cx<'_, '_>,
    records: &Records,
    id: &Hash32,
    epoch: u64,
) -> Result<(), AletheiaError> {
    let mut policy = policy(cx)?;
    let mut proposal = cx
        .reg
        .proposal(cx.overlay, id)?
        .ok_or_else(|| fail(ErrorCode::RegNotFound, format!("no proposal {id}")))?;
    if proposal.status != ProposalStatus::Timelocked {
        return Err(fail(
            ErrorCode::GovProposalState,
            format!("the proposal is {:?}, not approved", proposal.status),
        ));
    }
    if epoch < proposal.executable_from_epoch {
        return Err(fail(
            ErrorCode::GovProposalState,
            format!("timelocked until epoch {}", proposal.executable_from_epoch),
        ));
    }
    if epoch
        > proposal
            .executable_from_epoch
            .saturating_add(policy.execution_window_epochs)
    {
        proposal.status = ProposalStatus::Expired;
        cx.reg.put_proposal(cx.overlay, id, &proposal);
        return Err(fail(
            ErrorCode::GovProposalState,
            "the execution window has passed",
        ));
    }
    check_action(&proposal.action)?;
    match &proposal.action {
        GovAction::RegisterIssuer {
            kind,
            issuer_id,
            controller,
            scopes,
            cosign_classes,
            cosign_key,
        } => {
            let record = IssuerRecord {
                controller: *controller,
                scopes: scopes.clone(),
                cosign_classes: cosign_classes.clone(),
                cosign_key: *cosign_key,
                active: true,
            };
            cx.reg.put_issuer(cx.overlay, *kind, *issuer_id, &record);
        }
        GovAction::SetIssuerActive {
            kind,
            issuer_id,
            active,
        } => {
            let mut record = cx
                .reg
                .issuer(cx.overlay, *kind, *issuer_id)?
                .ok_or_else(|| {
                    fail(
                        ErrorCode::RegIssuerUnknown,
                        format!("no {kind:?} issuer {issuer_id}"),
                    )
                })?;
            record.active = *active;
            cx.reg.put_issuer(cx.overlay, *kind, *issuer_id, &record);
        }
        GovAction::SetFeePrice { asset, eu_price } => {
            let mut schedule = records.fee_schedule(cx.overlay)?;
            let entry = schedule
                .eu_prices
                .iter_mut()
                .find(|p| p.asset == *asset)
                .ok_or_else(|| {
                    fail(
                        ErrorCode::GovOutOfBounds,
                        format!("asset {asset} is not a fee asset"),
                    )
                })?;
            let doubled = entry.eu_price.saturating_mul(2);
            let new_doubled = eu_price.saturating_mul(2);
            if *eu_price > doubled || new_doubled < entry.eu_price {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    "a fee price may at most double or halve per proposal",
                ));
            }
            entry.eu_price = *eu_price;
            cx.overlay.put(
                records.param_key(ParamId::FeeSchedule),
                schedule.to_ace_bytes(),
            );
        }
        GovAction::SetAeyCapacity { capacity } => {
            let mut ledger = records
                .supply_ledger(cx.overlay, AssetId::AEY)?
                .ok_or_else(|| fail(ErrorCode::TxAssetUnknown, "AEY has no supply ledger"))?;
            let ceiling = ledger
                .authorized_capacity
                .saturating_add(policy.max_aey_capacity_increase);
            if *capacity > ceiling || *capacity < ledger.outstanding(AssetId::AEY)? {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    format!("capacity must stay between outstanding supply and {ceiling}"),
                ));
            }
            ledger.authorized_capacity = *capacity;
            records.put_supply_ledger(cx.overlay, AssetId::AEY, &ledger);
        }
        GovAction::ScheduleUpgrade {
            protocol_version,
            activation_height,
        } => {
            if *activation_height <= cx.ctx.height.get() {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    "an upgrade activates at a future height",
                ));
            }
            if records
                .schedule_entry(cx.overlay, *protocol_version)?
                .is_some()
            {
                return Err(fail(
                    ErrorCode::GovOutOfBounds,
                    format!("version {protocol_version} is already scheduled"),
                ));
            }
            let entry = ProtocolScheduleEntry {
                protocol_version: *protocol_version,
                activation_height: *activation_height,
                activation_epoch: 0,
                upgrade_id: *id,
                binary_hashes: Vec::new(),
                migration_id: None,
                recorded_at_height: cx.ctx.height.get(),
            };
            cx.overlay.put(
                records.schedule_key(*protocol_version),
                entry.to_ace_bytes(),
            );
        }
        GovAction::SetCouncil { members, threshold } => {
            check_council(members, *threshold)?;
            policy.council = members.clone();
            policy.threshold = *threshold;
            cx.reg.put_policy(cx.overlay, &policy);
        }
        GovAction::UpsertParticipant(spec) => upsert_participant(cx, records, spec, epoch)?,
        GovAction::SetParticipantStatus { aic, status } => {
            let apn = crate::apn_model::Apn { records };
            let mut participant = apn.participant(cx.overlay, aic)?.ok_or_else(|| {
                fail(
                    ErrorCode::ApnParticipantUnknown,
                    format!("no participant {}", aic.text()),
                )
            })?;
            if participant.status == aletheia_core::apn::status::TERMINATED {
                return Err(fail(
                    ErrorCode::ApnIllegalTransition,
                    format!("participant {} is terminated", aic.text()),
                ));
            }
            participant.status = *status;
            participant.updated_epoch = epoch;
            apn.put_participant(cx.overlay, &participant);
        }
        GovAction::UpsertBridgeRoute(route) => {
            let bridge_epoch = crate::rules::v1::bridge::epoch(records, cx.overlay, cx.ctx)?;
            crate::rules::v1::bridge::upsert_route(records, cx.overlay, route, bridge_epoch)?;
        }
        GovAction::RegisterGuardianSet(set) => {
            crate::rules::v1::bridge::register_guardians(records, cx.overlay, set)?;
        }
        GovAction::SetBridgeRoutePaused { route_id, paused } => {
            crate::rules::v1::bridge::set_paused(records, cx.overlay, *route_id, *paused)?;
        }
    }
    proposal.status = ProposalStatus::Executed;
    cx.reg.put_proposal(cx.overlay, id, &proposal);
    cx.emit(
        "aletheia.governance.executed.v1",
        vec![*id],
        proposal.action.to_ace_bytes(),
    );
    Ok(())
}
