//! State records of the native registries and governance (spec Sections 15, 31-33, 35).
//!
//! ```text
//! 32 IdentityRegistry   (0, issuer_id) IssuerRecord     (1, identity_id) IdentityRecord
//! 33 Credentials        (1, credential_id) Credential   (2, issuer_id, word) revocation bits
//! 34 ResidenceRegistry  (0, issuer_id) IssuerRecord     (1, residence_id) ResidenceRecord
//!                       (2, residence_id, seq) ResidenceHistory
//! 35 LandRegistry       (0, authority_id) IssuerRecord  (1, parcel_id) ParcelRecord
//! 36 LandHistory        (parcel_id, seq) LandHistory
//! 64 Governance         proposal_id → Proposal
//! 65 ProtocolParams     parameter 4 → GovernancePolicy
//! ```

use aletheia_core::registry::{
    ControllerRef, Encumbrance, GovAction, IdentityStatus, ParcelStatus, RegistryKind,
    ResidenceStatus,
};
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, Address, AletheiaError, ErrorCode, Hash32,
};
use aletheia_state::{Namespace, StateKey, StateOverlay, StateView};

use crate::model::{ParamId, Records};

macro_rules! record {
    ($(#[$doc:meta])* $name:ident { $($field:ident : $ty:ty),* $(,)? }) => {
        $(#[$doc])*
        #[derive(Debug, Clone, PartialEq, Eq)]
        pub struct $name {
            $(pub $field: $ty,)*
        }

        impl AceEncode for $name {
            fn encode(&self, out: &mut AceWriter) {
                $(self.$field.encode(out);)*
            }
        }

        impl AceDecode for $name {
            fn decode(input: &mut AceReader<'_>) -> Result<$name, AletheiaError> {
                Ok($name { $($field: <$ty>::decode(input)?,)* })
            }
        }
    };
}

fn list<T: AceEncode>(out: &mut AceWriter, items: &[T]) {
    out.list(items);
}

fn u32s(out: &mut AceWriter, items: &[u32]) {
    out.u32(u32::try_from(items.len()).unwrap_or(u32::MAX));
    for item in items {
        out.u32(*item);
    }
}

fn read_u32s(input: &mut AceReader<'_>) -> Result<Vec<u32>, AletheiaError> {
    let n = input.u32()?;
    if n > aletheia_core::registry::MAX_SCOPES {
        return Err(AletheiaError::new(
            ErrorCode::StoCorrupt,
            "stored scope list too long".to_owned(),
        ));
    }
    (0..n).map(|_| input.u32()).collect()
}

/// An issuer (identity, residence) or registry authority (land).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IssuerRecord {
    pub controller: Address,
    pub scopes: Vec<u32>,
    pub cosign_classes: Vec<u32>,
    pub cosign_key: Option<[u8; 32]>,
    pub active: bool,
}

impl AceEncode for IssuerRecord {
    fn encode(&self, out: &mut AceWriter) {
        self.controller.encode(out);
        u32s(out, &self.scopes);
        u32s(out, &self.cosign_classes);
        out.option(self.cosign_key.as_ref());
        out.bool(self.active);
    }
}

impl AceDecode for IssuerRecord {
    fn decode(input: &mut AceReader<'_>) -> Result<IssuerRecord, AletheiaError> {
        Ok(IssuerRecord {
            controller: Address::decode(input)?,
            scopes: read_u32s(input)?,
            cosign_classes: read_u32s(input)?,
            cosign_key: input.option()?,
            active: input.bool()?,
        })
    }
}

record!(
    /// Section 31.
    IdentityRecord {
        controller: Address,
        status: IdentityStatus,
        issuer_id: u32,
        created_epoch: u64,
        updated_epoch: u64,
        attributes_commitment: Hash32,
    }
);

record!(
    /// Section 31.
    CredentialRecord {
        subject: Hash32,
        schema_id: u32,
        issuer_id: u32,
        commitment: Hash32,
        status_list_index: u32,
        issued_epoch: u64,
        expiry_epoch: u64,
    }
);

record!(
    /// Section 32. The stored status is never `Expired`; read it through
    /// [`ResidenceRecord::status_at`].
    ResidenceRecord {
        identity_id: Hash32,
        class: u16,
        status: ResidenceStatus,
        issuer_id: u32,
        issued_epoch: u64,
        expiry_epoch: u64,
        revocation_reason_code: u16,
        history_seq: u64,
    }
);

impl ResidenceRecord {
    /// Expiry is evaluated against the chain's epoch, never a wall clock (Section 32).
    pub fn status_at(&self, epoch: u64) -> ResidenceStatus {
        if self.status == ResidenceStatus::Active && epoch > self.expiry_epoch {
            ResidenceStatus::Expired
        } else {
            self.status
        }
    }
}

record!(ResidenceHistory {
    status: ResidenceStatus,
    reason_code: u16,
    epoch: u64,
    tx_id: Hash32,
});

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParcelRecord {
    pub geometry_commitment: Hash32,
    pub controller: ControllerRef,
    pub class: u16,
    pub status: ParcelStatus,
    pub encumbrances: Vec<Encumbrance>,
    pub authority_id: u32,
    pub history_seq: u64,
}

impl AceEncode for ParcelRecord {
    fn encode(&self, out: &mut AceWriter) {
        self.geometry_commitment.encode(out);
        self.controller.encode(out);
        out.u16(self.class);
        self.status.encode(out);
        list(out, &self.encumbrances);
        out.u32(self.authority_id);
        out.u64(self.history_seq);
    }
}

impl AceDecode for ParcelRecord {
    fn decode(input: &mut AceReader<'_>) -> Result<ParcelRecord, AletheiaError> {
        Ok(ParcelRecord {
            geometry_commitment: Hash32::decode(input)?,
            controller: ControllerRef::decode(input)?,
            class: input.u16()?,
            status: ParcelStatus::decode(input)?,
            encumbrances: input.list(64)?,
            authority_id: input.u32()?,
            history_seq: input.u64()?,
        })
    }
}

/// What happened to a parcel (Section 33, namespace 36).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LandOp {
    Register,
    Transfer,
    Encumber,
    Release,
    SetStatus,
}

impl LandOp {
    const fn code(self) -> u8 {
        match self {
            LandOp::Register => 1,
            LandOp::Transfer => 2,
            LandOp::Encumber => 3,
            LandOp::Release => 4,
            LandOp::SetStatus => 5,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LandHistory {
    pub op: LandOp,
    pub prior_controller: Option<ControllerRef>,
    pub new_controller: Option<ControllerRef>,
    /// Hash of the authority's co-signature, or zero.
    pub authority_sig_ref: Hash32,
    pub tx_id: Hash32,
    pub epoch: u64,
}

impl AceEncode for LandHistory {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.op.code());
        out.option(self.prior_controller.as_ref());
        out.option(self.new_controller.as_ref());
        self.authority_sig_ref.encode(out);
        self.tx_id.encode(out);
        out.u64(self.epoch);
    }
}

impl AceDecode for LandHistory {
    fn decode(input: &mut AceReader<'_>) -> Result<LandHistory, AletheiaError> {
        let op = match input.u8()? {
            1 => LandOp::Register,
            2 => LandOp::Transfer,
            3 => LandOp::Encumber,
            4 => LandOp::Release,
            5 => LandOp::SetStatus,
            _ => {
                return Err(AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    "unknown land history op".to_owned(),
                ));
            }
        };
        Ok(LandHistory {
            op,
            prior_controller: input.option()?,
            new_controller: input.option()?,
            authority_sig_ref: Hash32::decode(input)?,
            tx_id: Hash32::decode(input)?,
            epoch: input.u64()?,
        })
    }
}

/// The council and its timing (namespace 65 parameter 4).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GovernancePolicy {
    pub council: Vec<Address>,
    pub threshold: u8,
    /// Slots per governance epoch (timelocks and expiries count these; ADR-048).
    pub epoch_slots: u64,
    pub voting_epochs: u64,
    pub execution_window_epochs: u64,
    pub max_aey_capacity_increase: u128,
}

impl AceEncode for GovernancePolicy {
    fn encode(&self, out: &mut AceWriter) {
        out.list(&self.council);
        out.u8(self.threshold);
        out.u64(self.epoch_slots);
        out.u64(self.voting_epochs);
        out.u64(self.execution_window_epochs);
        out.u128(self.max_aey_capacity_increase);
    }
}

impl AceDecode for GovernancePolicy {
    fn decode(input: &mut AceReader<'_>) -> Result<GovernancePolicy, AletheiaError> {
        Ok(GovernancePolicy {
            council: input.list(aletheia_core::registry::MAX_COUNCIL)?,
            threshold: input.u8()?,
            epoch_slots: input.u64()?,
            voting_epochs: input.u64()?,
            execution_window_epochs: input.u64()?,
            max_aey_capacity_increase: input.u128()?,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProposalStatus {
    Voting,
    /// Approved and waiting out its timelock.
    Timelocked,
    Rejected,
    Executed,
    Expired,
}

impl ProposalStatus {
    const fn code(self) -> u8 {
        match self {
            ProposalStatus::Voting => 1,
            ProposalStatus::Timelocked => 2,
            ProposalStatus::Rejected => 3,
            ProposalStatus::Executed => 4,
            ProposalStatus::Expired => 5,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Proposal {
    pub proposer: Address,
    pub action: GovAction,
    pub status: ProposalStatus,
    pub approvals: Vec<Address>,
    pub rejections: Vec<Address>,
    pub submitted_epoch: u64,
    pub voting_until_epoch: u64,
    /// Set when approved: the first epoch it may execute in.
    pub executable_from_epoch: u64,
}

impl AceEncode for Proposal {
    fn encode(&self, out: &mut AceWriter) {
        self.proposer.encode(out);
        self.action.encode(out);
        out.u8(self.status.code());
        out.list(&self.approvals);
        out.list(&self.rejections);
        out.u64(self.submitted_epoch);
        out.u64(self.voting_until_epoch);
        out.u64(self.executable_from_epoch);
    }
}

impl AceDecode for Proposal {
    fn decode(input: &mut AceReader<'_>) -> Result<Proposal, AletheiaError> {
        let proposer = Address::decode(input)?;
        let action = GovAction::decode(input)?;
        let status = match input.u8()? {
            1 => ProposalStatus::Voting,
            2 => ProposalStatus::Timelocked,
            3 => ProposalStatus::Rejected,
            4 => ProposalStatus::Executed,
            5 => ProposalStatus::Expired,
            _ => {
                return Err(AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    "unknown proposal status".to_owned(),
                ));
            }
        };
        Ok(Proposal {
            proposer,
            action,
            status,
            approvals: input.list(aletheia_core::registry::MAX_COUNCIL)?,
            rejections: input.list(aletheia_core::registry::MAX_COUNCIL)?,
            submitted_epoch: input.u64()?,
            voting_until_epoch: input.u64()?,
            executable_from_epoch: input.u64()?,
        })
    }
}

fn corrupt(what: &str, e: &AletheiaError) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoCorrupt,
        format!("stored {what} does not decode: {}", e.detail()),
    )
}

/// Typed access to registry state.
#[derive(Debug, Clone, Copy)]
pub struct Registry<'a> {
    pub records: &'a Records,
}

const ISSUER: u8 = 0;
const ITEM: u8 = 1;
const EXTRA: u8 = 2;

impl Registry<'_> {
    fn key(&self, namespace: Namespace, parts: &[&[u8]]) -> StateKey {
        let raw: Vec<u8> = parts.concat();
        StateKey::derive_raw(self.records.network(), namespace, &raw)
    }

    fn get<T: AceDecode>(
        &self,
        view: &dyn StateView,
        key: &StateKey,
        what: &str,
    ) -> Result<Option<T>, AletheiaError> {
        view.get(key)?
            .map(|bytes| T::from_ace_bytes(&bytes).map_err(|e| corrupt(what, &e)))
            .transpose()
    }

    fn put<T: AceEncode>(&self, overlay: &mut StateOverlay<'_>, key: StateKey, value: &T) {
        overlay.put(key, value.to_ace_bytes());
    }

    pub const fn issuer_namespace(kind: RegistryKind) -> Namespace {
        match kind {
            RegistryKind::Identity => Namespace::IdentityRegistry,
            RegistryKind::Residence => Namespace::ResidenceRegistry,
            RegistryKind::Land => Namespace::LandRegistry,
        }
    }

    pub fn issuer_key(&self, kind: RegistryKind, id: u32) -> StateKey {
        self.key(
            Self::issuer_namespace(kind),
            &[&[ISSUER], &id.to_le_bytes()],
        )
    }

    pub fn issuer(
        &self,
        view: &dyn StateView,
        kind: RegistryKind,
        id: u32,
    ) -> Result<Option<IssuerRecord>, AletheiaError> {
        self.get(view, &self.issuer_key(kind, id), "issuer")
    }

    pub fn put_issuer(
        &self,
        overlay: &mut StateOverlay<'_>,
        kind: RegistryKind,
        id: u32,
        record: &IssuerRecord,
    ) {
        self.put(overlay, self.issuer_key(kind, id), record);
    }

    pub fn identity_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::IdentityRegistry, &[&[ITEM], id.as_bytes()])
    }

    pub fn identity(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<IdentityRecord>, AletheiaError> {
        self.get(view, &self.identity_key(id), "identity")
    }

    pub fn put_identity(
        &self,
        overlay: &mut StateOverlay<'_>,
        id: &Hash32,
        record: &IdentityRecord,
    ) {
        self.put(overlay, self.identity_key(id), record);
    }

    pub fn credential_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::Credentials, &[&[ITEM], id.as_bytes()])
    }

    pub fn credential(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<CredentialRecord>, AletheiaError> {
        self.get(view, &self.credential_key(id), "credential")
    }

    pub fn put_credential(
        &self,
        overlay: &mut StateOverlay<'_>,
        id: &Hash32,
        record: &CredentialRecord,
    ) {
        self.put(overlay, self.credential_key(id), record);
    }

    /// One 64-bit word of an issuer's revocation bitmap.
    pub fn status_word_key(&self, issuer: u32, word: u32) -> StateKey {
        self.key(
            Namespace::Credentials,
            &[&[EXTRA], &issuer.to_le_bytes(), &word.to_le_bytes()],
        )
    }

    pub fn status_word(
        &self,
        view: &dyn StateView,
        issuer: u32,
        word: u32,
    ) -> Result<u64, AletheiaError> {
        Ok(self
            .get::<u64>(
                view,
                &self.status_word_key(issuer, word),
                "revocation bitmap",
            )?
            .unwrap_or(0))
    }

    /// Whether the credential at `index` of `issuer`'s status list is revoked.
    pub fn is_revoked(
        &self,
        view: &dyn StateView,
        issuer: u32,
        index: u32,
    ) -> Result<bool, AletheiaError> {
        let word = self.status_word(view, issuer, index / 64)?;
        Ok(word & (1u64 << (index % 64)) != 0)
    }

    pub fn residence_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::ResidenceRegistry, &[&[ITEM], id.as_bytes()])
    }

    pub fn residence(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<ResidenceRecord>, AletheiaError> {
        self.get(view, &self.residence_key(id), "residence")
    }

    pub fn put_residence(
        &self,
        overlay: &mut StateOverlay<'_>,
        id: &Hash32,
        record: &ResidenceRecord,
    ) {
        self.put(overlay, self.residence_key(id), record);
    }

    pub fn residence_history_key(&self, id: &Hash32, seq: u64) -> StateKey {
        self.key(
            Namespace::ResidenceRegistry,
            &[&[EXTRA], id.as_bytes(), &seq.to_le_bytes()],
        )
    }

    pub fn residence_history(
        &self,
        view: &dyn StateView,
        id: &Hash32,
        seq: u64,
    ) -> Result<Option<ResidenceHistory>, AletheiaError> {
        self.get(
            view,
            &self.residence_history_key(id, seq),
            "residence history",
        )
    }

    pub fn parcel_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::LandRegistry, &[&[ITEM], id.as_bytes()])
    }

    pub fn parcel(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<ParcelRecord>, AletheiaError> {
        self.get(view, &self.parcel_key(id), "parcel")
    }

    pub fn put_parcel(&self, overlay: &mut StateOverlay<'_>, id: &Hash32, record: &ParcelRecord) {
        self.put(overlay, self.parcel_key(id), record);
    }

    pub fn land_history_key(&self, id: &Hash32, seq: u64) -> StateKey {
        self.key(Namespace::LandHistory, &[id.as_bytes(), &seq.to_le_bytes()])
    }

    pub fn land_history(
        &self,
        view: &dyn StateView,
        id: &Hash32,
        seq: u64,
    ) -> Result<Option<LandHistory>, AletheiaError> {
        self.get(view, &self.land_history_key(id, seq), "land history")
    }

    pub fn proposal_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::Governance, &[id.as_bytes()])
    }

    pub fn proposal(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<Proposal>, AletheiaError> {
        self.get(view, &self.proposal_key(id), "proposal")
    }

    pub fn put_proposal(&self, overlay: &mut StateOverlay<'_>, id: &Hash32, record: &Proposal) {
        self.put(overlay, self.proposal_key(id), record);
    }

    pub fn policy(&self, view: &dyn StateView) -> Result<Option<GovernancePolicy>, AletheiaError> {
        self.get(
            view,
            &self.records.param_key(ParamId::GovernancePolicy),
            "governance policy",
        )
    }

    pub fn put_policy(&self, overlay: &mut StateOverlay<'_>, policy: &GovernancePolicy) {
        self.put(
            overlay,
            self.records.param_key(ParamId::GovernancePolicy),
            policy,
        );
    }
}

/// Slots per governance epoch when a chain has no governance policy (Section 19.4: 512).
pub const DEFAULT_EPOCH_SLOTS: u64 = 512;
