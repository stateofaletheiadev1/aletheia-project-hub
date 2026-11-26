//! Validator registry and epoch state (spec Sections 19.1, 34; ADR-069).
//!
//! ```text
//! namespace 16, key node_key      ValidatorRegistration
//! namespace 17, key epoch         the epoch's set (ValidatorRecord list, model.rs)
//! namespace 65, parameter 5       ValidatorEpochState
//! namespace 65, parameter 6       ValidatorPolicy
//! ```
//!
//! Every record is absent on a chain that never ran a validator transaction, and absence reads
//! as epoch 0, open, with no pending change and the default policy: blocks executed before
//! protocol version 2 see exactly the state they always saw.

use aletheia_core::block::{BLS_PUBLIC_KEY_LEN, BLS_SIGNATURE_LEN};
use aletheia_core::validator::ValidatorApplication;
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, Address, AletheiaError, ErrorCode, Hash32,
};
use aletheia_state::{Namespace, StateKey, StateOverlay, StateView};

use crate::model::{ParamId, Records, ValidatorRecord, module_address};

/// Holds every bond (ALnT) while it is locked.
pub const VALIDATOR_REGISTRY: Address = module_address(10);

/// 10,000 ALnT (3 decimals) until the Council sets another minimum.
pub const DEFAULT_MIN_BOND: u128 = 10_000_000;
/// The largest set until the Council sets another; `MAX_VALIDATORS` bounds it absolutely.
pub const DEFAULT_MAX_VALIDATORS: u16 = 100;
/// Bound on each pending-change list in one block.
pub const MAX_PENDING: u32 = 1024;

fn corrupt(what: &str, error: &AletheiaError) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoCorrupt,
        format!("stored {what} does not decode: {}", error.detail()),
    )
}

/// One operator's validator, from application to removal.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValidatorRegistration {
    pub operator: Address,
    pub consensus_key: [u8; BLS_PUBLIC_KEY_LEN],
    pub proof_of_possession: [u8; BLS_SIGNATURE_LEN],
    pub node_key: [u8; 32],
    pub transport_cert_hash: Hash32,
    pub metadata_hash: Hash32,
    /// ALnT base units held by [`VALIDATOR_REGISTRY`]; zero once returned.
    pub bond: u128,
    /// `aletheia_core::validator::status`.
    pub status: u8,
    pub registered_slot: u64,
    /// The first epoch whose set includes it.
    pub joined_epoch: Option<u64>,
    /// The first epoch whose set no longer includes it.
    pub left_epoch: Option<u64>,
}

impl ValidatorRegistration {
    pub fn from_application(
        operator: Address,
        application: &ValidatorApplication,
        status: u8,
        registered_slot: u64,
    ) -> ValidatorRegistration {
        ValidatorRegistration {
            operator,
            consensus_key: application.consensus_key,
            proof_of_possession: application.proof_of_possession,
            node_key: application.node_key,
            transport_cert_hash: application.transport_cert_hash,
            metadata_hash: application.metadata_hash,
            bond: application.bond,
            status,
            registered_slot,
            joined_epoch: None,
            left_epoch: None,
        }
    }

    /// The set member this registration contributes (equal weight, Section 19.1).
    pub fn member(&self) -> ValidatorRecord {
        ValidatorRecord {
            consensus_key: self.consensus_key,
            proof_of_possession: self.proof_of_possession,
            node_key: self.node_key,
            voting_power: 1,
        }
    }
}

fn epoch_option(out: &mut AceWriter, epoch: Option<u64>) {
    match epoch {
        None => out.u8(0),
        Some(epoch) => {
            out.u8(1);
            out.u64(epoch);
        }
    }
}

fn read_epoch_option(input: &mut AceReader<'_>) -> Result<Option<u64>, AletheiaError> {
    match input.u8()? {
        0 => Ok(None),
        1 => input.u64().map(Some),
        other => Err(AletheiaError::new(
            ErrorCode::DecodeNonCanonical,
            format!("epoch option marker {other}"),
        )),
    }
}

impl AceEncode for ValidatorRegistration {
    fn encode(&self, out: &mut AceWriter) {
        self.operator.encode(out);
        out.fixed(&self.consensus_key);
        out.fixed(&self.proof_of_possession);
        out.fixed(&self.node_key);
        self.transport_cert_hash.encode(out);
        self.metadata_hash.encode(out);
        out.u128(self.bond);
        out.u8(self.status);
        out.u64(self.registered_slot);
        epoch_option(out, self.joined_epoch);
        epoch_option(out, self.left_epoch);
    }
}

impl AceDecode for ValidatorRegistration {
    fn decode(input: &mut AceReader<'_>) -> Result<ValidatorRegistration, AletheiaError> {
        Ok(ValidatorRegistration {
            operator: Address::decode(input)?,
            consensus_key: input.array()?,
            proof_of_possession: input.array()?,
            node_key: input.array()?,
            transport_cert_hash: Hash32::decode(input)?,
            metadata_hash: Hash32::decode(input)?,
            bond: input.u128()?,
            status: input.u8()?,
            registered_slot: input.u64()?,
            joined_epoch: read_epoch_option(input)?,
            left_epoch: read_epoch_option(input)?,
        })
    }
}

/// The validator epoch, and the set changes made in the current block. The lists are only ever
/// non-empty inside a block: the end of the block that made a change closes the epoch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatorEpochState {
    pub epoch: u64,
    /// The last block closed `epoch`; the next block is a suffix block (same epoch, empty) or
    /// the first block of `epoch + 1`.
    pub closed: bool,
    /// The closing block of the previous epoch: the leader seed's finalized hash. Zero in
    /// epoch 0, which seeds from `genesis_id` (ERRATA E-22).
    pub opened_after: Hash32,
    /// Node keys joining at the end of this block, in the order they were admitted.
    pub joining: Vec<[u8; 32]>,
    /// Node keys leaving at the end of this block, in the order they were removed.
    pub leaving: Vec<[u8; 32]>,
    /// Bonds to return at the end of this block (rejected applications), in order.
    pub refunds: Vec<[u8; 32]>,
}

impl Default for ValidatorEpochState {
    fn default() -> Self {
        ValidatorEpochState {
            epoch: 0,
            closed: false,
            opened_after: Hash32::ZERO,
            joining: Vec::new(),
            leaving: Vec::new(),
            refunds: Vec::new(),
        }
    }
}

impl ValidatorEpochState {
    pub fn changes_set(&self) -> bool {
        !self.joining.is_empty() || !self.leaving.is_empty()
    }
}

fn keys(out: &mut AceWriter, keys: &[[u8; 32]]) {
    out.u32(u32::try_from(keys.len()).unwrap_or(u32::MAX));
    for key in keys {
        out.fixed(key);
    }
}

fn read_keys(input: &mut AceReader<'_>) -> Result<Vec<[u8; 32]>, AletheiaError> {
    let count = input.u32()?;
    if count > MAX_PENDING {
        return Err(AletheiaError::new(
            ErrorCode::DecodeLengthExceeded,
            format!("{count} pending validator changes exceed {MAX_PENDING}"),
        ));
    }
    (0..count).map(|_| input.array()).collect()
}

impl AceEncode for ValidatorEpochState {
    fn encode(&self, out: &mut AceWriter) {
        out.u64(self.epoch);
        out.bool(self.closed);
        self.opened_after.encode(out);
        keys(out, &self.joining);
        keys(out, &self.leaving);
        keys(out, &self.refunds);
    }
}

impl AceDecode for ValidatorEpochState {
    fn decode(input: &mut AceReader<'_>) -> Result<ValidatorEpochState, AletheiaError> {
        Ok(ValidatorEpochState {
            epoch: input.u64()?,
            closed: input.bool()?,
            opened_after: Hash32::decode(input)?,
            joining: read_keys(input)?,
            leaving: read_keys(input)?,
            refunds: read_keys(input)?,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValidatorPolicy {
    pub min_bond: u128,
    pub max_validators: u16,
}

impl Default for ValidatorPolicy {
    fn default() -> Self {
        ValidatorPolicy {
            min_bond: DEFAULT_MIN_BOND,
            max_validators: DEFAULT_MAX_VALIDATORS,
        }
    }
}

impl AceEncode for ValidatorPolicy {
    fn encode(&self, out: &mut AceWriter) {
        out.u128(self.min_bond);
        out.u16(self.max_validators);
    }
}

impl AceDecode for ValidatorPolicy {
    fn decode(input: &mut AceReader<'_>) -> Result<ValidatorPolicy, AletheiaError> {
        Ok(ValidatorPolicy {
            min_bond: input.u128()?,
            max_validators: input.u16()?,
        })
    }
}

/// Typed access to the validator records.
#[derive(Debug, Clone, Copy)]
pub struct Validators<'r> {
    records: &'r Records,
}

impl<'r> Validators<'r> {
    pub fn new(records: &'r Records) -> Validators<'r> {
        Validators { records }
    }

    pub fn registration_key(&self, node_key: &[u8; 32]) -> StateKey {
        StateKey::derive(
            self.records.network(),
            Namespace::ValidatorRegistry,
            node_key,
        )
    }

    pub fn registration(
        &self,
        view: &dyn StateView,
        node_key: &[u8; 32],
    ) -> Result<Option<ValidatorRegistration>, AletheiaError> {
        view.get(&self.registration_key(node_key))?
            .map(|bytes| {
                ValidatorRegistration::from_ace_bytes(&bytes)
                    .map_err(|e| corrupt("validator registration", &e))
            })
            .transpose()
    }

    pub fn put_registration(
        &self,
        overlay: &mut StateOverlay<'_>,
        registration: &ValidatorRegistration,
    ) {
        overlay.put(
            self.registration_key(&registration.node_key),
            registration.to_ace_bytes(),
        );
    }

    pub fn epoch_state(&self, view: &dyn StateView) -> Result<ValidatorEpochState, AletheiaError> {
        view.get(&self.records.param_key(ParamId::ValidatorEpoch))?
            .map(|bytes| {
                ValidatorEpochState::from_ace_bytes(&bytes)
                    .map_err(|e| corrupt("validator epoch state", &e))
            })
            .transpose()
            .map(Option::unwrap_or_default)
    }

    pub fn put_epoch_state(&self, overlay: &mut StateOverlay<'_>, state: &ValidatorEpochState) {
        overlay.put(
            self.records.param_key(ParamId::ValidatorEpoch),
            state.to_ace_bytes(),
        );
    }

    pub fn policy(&self, view: &dyn StateView) -> Result<ValidatorPolicy, AletheiaError> {
        view.get(&self.records.param_key(ParamId::ValidatorPolicy))?
            .map(|bytes| {
                ValidatorPolicy::from_ace_bytes(&bytes).map_err(|e| corrupt("validator policy", &e))
            })
            .transpose()
            .map(Option::unwrap_or_default)
    }

    pub fn put_policy(&self, overlay: &mut StateOverlay<'_>, policy: &ValidatorPolicy) {
        overlay.put(
            self.records.param_key(ParamId::ValidatorPolicy),
            policy.to_ace_bytes(),
        );
    }

    /// The set of `epoch`; an epoch the chain has not reached has none.
    pub fn set(
        &self,
        view: &dyn StateView,
        epoch: u64,
    ) -> Result<Option<Vec<ValidatorRecord>>, AletheiaError> {
        self.records.validator_set(view, epoch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_round_trip() {
        let registration = ValidatorRegistration {
            operator: module_address(42),
            consensus_key: [1; BLS_PUBLIC_KEY_LEN],
            proof_of_possession: [2; BLS_SIGNATURE_LEN],
            node_key: [3; 32],
            transport_cert_hash: Hash32::from_bytes([4; 32]),
            metadata_hash: Hash32::from_bytes([5; 32]),
            bond: 10_000_000,
            status: aletheia_core::validator::status::ACTIVE,
            registered_slot: 9,
            joined_epoch: Some(1),
            left_epoch: None,
        };
        assert_eq!(
            ValidatorRegistration::from_ace_bytes(&registration.to_ace_bytes()),
            Ok(registration)
        );
        let state = ValidatorEpochState {
            epoch: 3,
            closed: true,
            opened_after: Hash32::from_bytes([7; 32]),
            joining: vec![[8; 32]],
            leaving: vec![[9; 32], [10; 32]],
            refunds: vec![],
        };
        assert_eq!(
            ValidatorEpochState::from_ace_bytes(&state.to_ace_bytes()),
            Ok(state)
        );
        let policy = ValidatorPolicy::default();
        assert_eq!(
            ValidatorPolicy::from_ace_bytes(&policy.to_ace_bytes()),
            Ok(policy)
        );
    }

    #[test]
    fn absence_reads_as_epoch_zero_open_with_nothing_pending() {
        let state = ValidatorEpochState::default();
        assert_eq!(state.epoch, 0);
        assert!(!state.closed);
        assert!(!state.changes_set());
        assert_eq!(state.opened_after, Hash32::ZERO);
    }
}
