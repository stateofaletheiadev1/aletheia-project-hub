//! State records the execution rules read and write (spec Sections 15, 18.3, 23, 44.4).
//!
//! Each record has a hand-written ACE layout and a typed key helper, so no module computes a
//! state key by hand and no record crosses into state un-encoded.

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, Address, AddressType, AletheiaError, AssetId,
    ErrorCode, Hash32, NetworkIdentity,
};
use aletheia_state::{Namespace, StateKey, StateOverlay, StateView};

/// Native module accounts (APS-0002): type 3 addresses whose account hash is 31 zero bytes
/// followed by the module id.
pub const fn module_address(module_id: u8) -> Address {
    let mut bytes = [0u8; 32];
    bytes[31] = module_id;
    Address::new(AddressType::NativeModule, Hash32::from_bytes(bytes))
}

/// Receives every fee (Section 23); distribution to validators happens at epoch end.
pub const FEE_POOL: Address = module_address(1);

fn decode_record<T: AceDecode>(bytes: &[u8], what: &str) -> Result<T, AletheiaError> {
    T::from_ace_bytes(bytes).map_err(|e| {
        AletheiaError::new(
            ErrorCode::StoCorrupt,
            format!("stored {what} does not decode: {}", e.detail()),
        )
    })
}

/// Typed access to the state records of one network.
#[derive(Debug, Clone, Copy)]
pub struct Records {
    network: NetworkIdentity,
}

impl Records {
    pub fn new(network: NetworkIdentity) -> Records {
        Records { network }
    }

    pub fn network(&self) -> &NetworkIdentity {
        &self.network
    }

    pub fn account_key(&self, address: &Address) -> StateKey {
        StateKey::derive(&self.network, Namespace::Accounts, address)
    }

    pub fn balance_key(&self, address: &Address, asset: AssetId) -> StateKey {
        let mut key = address.to_ace_bytes();
        key.extend_from_slice(&asset.to_ace_bytes());
        StateKey::derive_raw(&self.network, Namespace::Balances, &key)
    }

    pub fn asset_key(&self, asset: AssetId) -> StateKey {
        StateKey::derive(&self.network, Namespace::Assets, &asset)
    }

    pub fn param_key(&self, param: ParamId) -> StateKey {
        StateKey::derive(&self.network, Namespace::ProtocolParams, &param.code())
    }

    pub fn schedule_key(&self, version: u16) -> StateKey {
        StateKey::derive(&self.network, Namespace::ProtocolSchedule, &version)
    }

    pub fn account(
        &self,
        view: &dyn StateView,
        address: &Address,
    ) -> Result<Option<Account>, AletheiaError> {
        view.get(&self.account_key(address))?
            .map(|bytes| decode_record(&bytes, "account"))
            .transpose()
    }

    pub fn put_account(
        &self,
        overlay: &mut StateOverlay<'_>,
        address: &Address,
        account: &Account,
    ) {
        overlay.put(self.account_key(address), account.to_ace_bytes());
    }

    /// A missing balance is zero: recipients need no account record to receive.
    pub fn balance(
        &self,
        view: &dyn StateView,
        address: &Address,
        asset: AssetId,
    ) -> Result<Balance, AletheiaError> {
        Ok(view
            .get(&self.balance_key(address, asset))?
            .map(|bytes| decode_record(&bytes, "balance"))
            .transpose()?
            .unwrap_or_default())
    }

    /// Writes a balance; an all-zero balance is deleted so empty entries never accumulate.
    pub fn put_balance(
        &self,
        overlay: &mut StateOverlay<'_>,
        address: &Address,
        asset: AssetId,
        balance: Balance,
    ) {
        let key = self.balance_key(address, asset);
        if balance == Balance::default() {
            overlay.delete(key);
        } else {
            overlay.put(key, balance.to_ace_bytes());
        }
    }

    pub fn asset(
        &self,
        view: &dyn StateView,
        asset: AssetId,
    ) -> Result<Option<AssetConfig>, AletheiaError> {
        view.get(&self.asset_key(asset))?
            .map(|bytes| decode_record(&bytes, "asset config"))
            .transpose()
    }

    pub fn fee_schedule(&self, view: &dyn StateView) -> Result<FeeSchedule, AletheiaError> {
        let bytes = view
            .get(&self.param_key(ParamId::FeeSchedule))?
            .ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    "fee schedule parameter is missing from state".to_owned(),
                )
            })?;
        decode_record(&bytes, "fee schedule")
    }

    pub fn chain_timing(&self, view: &dyn StateView) -> Result<ChainTiming, AletheiaError> {
        let bytes = view
            .get(&self.param_key(ParamId::ChainTiming))?
            .ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    "chain timing parameter is missing from state".to_owned(),
                )
            })?;
        decode_record(&bytes, "chain timing")
    }

    pub fn validator_set_key(&self, epoch: u64) -> StateKey {
        StateKey::derive(&self.network, Namespace::ValidatorSets, &epoch)
    }

    /// The validator set of `epoch`, members in validator-index order.
    pub fn validator_set(
        &self,
        view: &dyn StateView,
        epoch: u64,
    ) -> Result<Option<Vec<ValidatorRecord>>, AletheiaError> {
        let Some(bytes) = view.get(&self.validator_set_key(epoch))? else {
            return Ok(None);
        };
        let mut reader = AceReader::new(&bytes);
        reader
            .list(MAX_VALIDATOR_RECORDS)
            .and_then(|members| reader.finish().map(|()| Some(members)))
            .map_err(|e| {
                AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    format!("stored validator set does not decode: {}", e.detail()),
                )
            })
    }

    pub fn put_validator_set(
        &self,
        overlay: &mut StateOverlay<'_>,
        epoch: u64,
        members: &[ValidatorRecord],
    ) {
        let mut out = AceWriter::new();
        out.list(members);
        overlay.put(self.validator_set_key(epoch), out.into_bytes());
    }

    pub fn schedule_entry(
        &self,
        view: &dyn StateView,
        version: u16,
    ) -> Result<Option<ProtocolScheduleEntry>, AletheiaError> {
        view.get(&self.schedule_key(version))?
            .map(|bytes| decode_record(&bytes, "protocol schedule entry"))
            .transpose()
    }
}

/// Namespace 1. Created by the account's first transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Account {
    pub next_nonce: u64,
    /// `AuthScheme` code the account was created with.
    pub auth_scheme: u8,
    /// Commitment to the authorizing keys: the address-derivation hash of the authorization
    /// (equal to the address's own hash until a key rotation changes it).
    pub pubkey_commitment: Hash32,
    pub flags: u32,
}

impl AceEncode for Account {
    fn encode(&self, out: &mut AceWriter) {
        out.u64(self.next_nonce);
        out.u8(self.auth_scheme);
        self.pubkey_commitment.encode(out);
        out.u32(self.flags);
    }
}

impl AceDecode for Account {
    fn decode(input: &mut AceReader<'_>) -> Result<Account, AletheiaError> {
        Ok(Account {
            next_nonce: input.u64()?,
            auth_scheme: input.u8()?,
            pubkey_commitment: Hash32::decode(input)?,
            flags: input.u32()?,
        })
    }
}

/// Namespace 2, key `(Address, AssetId)`. Base units.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Balance {
    pub available: u128,
    pub locked: u128,
}

impl AceEncode for Balance {
    fn encode(&self, out: &mut AceWriter) {
        out.u128(self.available);
        out.u128(self.locked);
    }
}

impl AceDecode for Balance {
    fn decode(input: &mut AceReader<'_>) -> Result<Balance, AletheiaError> {
        Ok(Balance {
            available: input.u128()?,
            locked: input.u128()?,
        })
    }
}

/// Namespace 3. The asset framework (Phase 6) extends this through a new record version.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AssetConfig {
    pub decimals: u8,
    pub transferable: bool,
}

impl AceEncode for AssetConfig {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.decimals);
        out.bool(self.transferable);
    }
}

impl AceDecode for AssetConfig {
    fn decode(input: &mut AceReader<'_>) -> Result<AssetConfig, AletheiaError> {
        Ok(AssetConfig {
            decimals: input.u8()?,
            transferable: input.bool()?,
        })
    }
}

/// Namespace 65 parameter ids.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ParamId {
    FeeSchedule,
    ChainTiming,
}

impl ParamId {
    pub const fn code(self) -> u16 {
        match self {
            ParamId::FeeSchedule => 1,
            ParamId::ChainTiming => 2,
        }
    }
}

/// Section 23: base units of each fee asset per execution unit, set by governance.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeeSchedule {
    /// Strictly ascending by asset.
    pub eu_prices: Vec<FeePrice>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct FeePrice {
    pub asset: AssetId,
    pub eu_price: u128,
}

impl FeeSchedule {
    pub fn price(&self, asset: AssetId) -> Option<u128> {
        self.eu_prices
            .iter()
            .find(|p| p.asset == asset)
            .map(|p| p.eu_price)
    }
}

impl AceEncode for FeePrice {
    fn encode(&self, out: &mut AceWriter) {
        self.asset.encode(out);
        out.u128(self.eu_price);
    }
}

impl AceDecode for FeePrice {
    fn decode(input: &mut AceReader<'_>) -> Result<FeePrice, AletheiaError> {
        Ok(FeePrice {
            asset: AssetId::decode(input)?,
            eu_price: input.u128()?,
        })
    }
}

impl AceEncode for FeeSchedule {
    fn encode(&self, out: &mut AceWriter) {
        out.list(&self.eu_prices);
    }
}

impl AceDecode for FeeSchedule {
    fn decode(input: &mut AceReader<'_>) -> Result<FeeSchedule, AletheiaError> {
        Ok(FeeSchedule {
            eu_prices: input.sorted_list(16)?,
        })
    }
}

/// Genesis time and slot length; `protocol_time_ms = genesis_time_ms + slot × slot_duration_ms`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ChainTiming {
    pub genesis_time_ms: u64,
    pub slot_duration_ms: u64,
}

impl ChainTiming {
    pub fn protocol_time_ms(&self, slot: aletheia_core::Slot) -> Result<u64, AletheiaError> {
        slot.get()
            .checked_mul(self.slot_duration_ms)
            .and_then(|elapsed| elapsed.checked_add(self.genesis_time_ms))
            .ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::ArithmeticOverflow,
                    format!("protocol time at slot {slot} overflows"),
                )
            })
    }
}

impl AceEncode for ChainTiming {
    fn encode(&self, out: &mut AceWriter) {
        out.u64(self.genesis_time_ms);
        out.u64(self.slot_duration_ms);
    }
}

impl AceDecode for ChainTiming {
    fn decode(input: &mut AceReader<'_>) -> Result<ChainTiming, AletheiaError> {
        Ok(ChainTiming {
            genesis_time_ms: input.u64()?,
            slot_duration_ms: input.u64()?,
        })
    }
}

/// Namespace 66 (Section 44.4).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProtocolScheduleEntry {
    pub protocol_version: u16,
    pub activation_height: u64,
    pub activation_epoch: u64,
    pub upgrade_id: Hash32,
    pub binary_hashes: Vec<Hash32>,
    pub migration_id: Option<u32>,
    pub recorded_at_height: u64,
}

impl AceEncode for ProtocolScheduleEntry {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.protocol_version);
        out.u64(self.activation_height);
        out.u64(self.activation_epoch);
        self.upgrade_id.encode(out);
        out.list(&self.binary_hashes);
        out.option(self.migration_id.as_ref());
        out.u64(self.recorded_at_height);
    }
}

impl AceDecode for ProtocolScheduleEntry {
    fn decode(input: &mut AceReader<'_>) -> Result<ProtocolScheduleEntry, AletheiaError> {
        Ok(ProtocolScheduleEntry {
            protocol_version: input.u16()?,
            activation_height: input.u64()?,
            activation_epoch: input.u64()?,
            upgrade_id: Hash32::decode(input)?,
            binary_hashes: input.list(64)?,
            migration_id: input.option()?,
            recorded_at_height: input.u64()?,
        })
    }
}

/// Bound on a stored validator set; equals `aletheia_core::block::MAX_VALIDATORS`.
pub const MAX_VALIDATOR_RECORDS: u32 = 1024;

/// One member of an epoch's validator set (namespace 17, key `epoch`; the record is the ACE
/// list of members in validator-index order). The proof of possession is stored so every node
/// re-verifies the key before aggregating it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValidatorRecord {
    pub consensus_key: [u8; aletheia_core::block::BLS_PUBLIC_KEY_LEN],
    pub proof_of_possession: [u8; aletheia_core::block::BLS_SIGNATURE_LEN],
    pub node_key: [u8; 32],
    pub voting_power: u64,
}

impl AceEncode for ValidatorRecord {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.consensus_key);
        out.fixed(&self.proof_of_possession);
        out.fixed(&self.node_key);
        out.u64(self.voting_power);
    }
}

impl AceDecode for ValidatorRecord {
    fn decode(input: &mut AceReader<'_>) -> Result<ValidatorRecord, AletheiaError> {
        Ok(ValidatorRecord {
            consensus_key: input.array()?,
            proof_of_possession: input.array()?,
            node_key: input.array()?,
            voting_power: input.u64()?,
        })
    }
}

/// `validator_set_hash` of a stored set (ERRATA E-20).
pub fn validator_records_hash(
    network: &NetworkIdentity,
    epoch: aletheia_core::Epoch,
    members: &[ValidatorRecord],
) -> Hash32 {
    aletheia_core::block::validator_set_hash(
        network,
        epoch,
        members
            .iter()
            .map(|m| (&m.consensus_key, &m.node_key, m.voting_power)),
    )
}
