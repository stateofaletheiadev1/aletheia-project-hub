//! Genesis (spec Section 43, APS-0035).
//!
//! ```text
//! genesis/<network>.toml  --parse-->  GenesisConfig  --canonicalize-->  GenesisState (ACE)
//! genesis_id = H_domain("ALETHEIA/GENESIS/v1", ace(GenesisState))
//! ```
//!
//! The TOML is operator input and is validated strictly: unknown fields are refused, amounts
//! are decimal strings, addresses must be canonical for the configured network. Everything
//! consensus depends on is the ACE `GenesisState`, so two builders with the same file get the
//! same bytes, `genesis_id` and state root on any machine.
//!
//! Implemented now: chain identity and timing, fee prices, the AEY and ALnT asset records,
//! protocol schedule entry 1, ALnT/AEY allocations, the epoch-0 validator set, and the
//! monetary authority, attestors, redemption agents and AEY capacity (`[monetary]`).
//! Governance (Phase 10) joins the genesis format in its phase, before any production genesis
//! is built.
//!
//! Genesis validators prove possession of their BLS keys before the genesis id exists. That
//! is sound because domain-separated hashes bind chain id and network kind, never the genesis
//! id (Section 10), so a proof made for the pre-genesis identity verifies on the network.

use aletheia_core::block::{BlockHeader, QuorumCertificate};
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, Address, AletheiaError, AssetId, ChainId,
    DomainTag, Epoch, ErrorCode, Hash32, Height, NetworkIdentity, NetworkKind, ProtocolVersion,
    Slot, ValidatorIndex,
};
use aletheia_crypto::merkle;
use aletheia_monetary::arith::within_supply_bound;
use aletheia_state::{StateKey, StateOverlay, StateValue, StateView};
use serde::Deserialize;

use crate::model::{
    AssetConfig, Balance, ChainTiming, FeePrice, FeeSchedule, MAX_MONETARY_KEYS,
    MAX_VALIDATOR_RECORDS, MonetaryPolicy, ParamId, ProtocolScheduleEntry, Records,
    ValidatorRecord, validator_records_hash,
};

const MAX_ALLOCATIONS: u32 = 100_000;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GenesisConfig {
    pub chain: ChainSection,
    pub fees: FeesSection,
    #[serde(default)]
    pub allocations: Vec<AllocationEntry>,
    /// The epoch-0 validator set, in validator-index order. Empty only for a devnet or regtest
    /// chain run by the single-node producer.
    #[serde(default)]
    pub validators: Vec<ValidatorEntry>,
    /// The monetary authority and AEY policy. Without it nothing can be minted or redeemed.
    pub monetary: Option<MonetarySection>,
    /// The governance council. Without it nothing can be governed: no issuers can be
    /// registered and parameters stay as genesis set them.
    pub governance: Option<GovernanceSection>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GovernanceSection {
    /// Council member addresses (`alt:` text).
    pub council: Vec<String>,
    pub threshold: u8,
    /// Slots per governance epoch (timelocks count these); defaults to 512.
    pub epoch_slots: Option<u64>,
    pub voting_epochs: u64,
    pub execution_window_epochs: u64,
    /// AEY base units a single proposal may add to the authorized capacity (decimal).
    pub max_aey_capacity_increase: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MonetarySection {
    /// Ed25519 public keys, 32 bytes base16 each.
    pub authority_keys: Vec<String>,
    pub authority_threshold: u8,
    #[serde(default)]
    pub redemption_agents: Vec<String>,
    #[serde(default)]
    pub attestors: Vec<String>,
    pub attestor_threshold: u8,
    pub attestor_threshold_large_deviation: u8,
    pub max_deviation_bps: u32,
    pub max_attestation_age_slots: u64,
    pub reserve_feed_id: u32,
    pub enforce_reserve_ratio: bool,
    pub min_reserve_ratio_bps: u32,
    /// AEY base units, decimal string. At least the genesis AEY supply.
    pub aey_authorized_capacity: String,
    /// AEY base units per epoch, decimal string.
    pub aey_epoch_issuance_cap: String,
}

/// The canonical monetary part of genesis.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MonetaryGenesis {
    pub policy: MonetaryPolicy,
    pub aey_authorized_capacity: u128,
    pub aey_epoch_issuance_cap: u128,
}

impl AceEncode for MonetaryGenesis {
    fn encode(&self, out: &mut AceWriter) {
        self.policy.encode(out);
        out.u128(self.aey_authorized_capacity);
        out.u128(self.aey_epoch_issuance_cap);
    }
}

impl AceDecode for MonetaryGenesis {
    fn decode(input: &mut AceReader<'_>) -> Result<MonetaryGenesis, AletheiaError> {
        Ok(MonetaryGenesis {
            policy: MonetaryPolicy::decode(input)?,
            aey_authorized_capacity: input.u128()?,
            aey_epoch_issuance_cap: input.u128()?,
        })
    }
}

fn parse_keys(texts: &[String], what: &str) -> Result<Vec<[u8; 32]>, AletheiaError> {
    if texts.len() > usize::try_from(MAX_MONETARY_KEYS).unwrap_or(usize::MAX) {
        return Err(config_error(format!(
            "{} {what} exceed the maximum of {MAX_MONETARY_KEYS}",
            texts.len()
        )));
    }
    let mut seen = std::collections::BTreeSet::new();
    texts
        .iter()
        .map(|text| {
            let key: [u8; 32] = aletheia_core::base16::decode_fixed(text)
                .map_err(|_| config_error(format!("{what} key \"{text}\" is not valid base16")))?;
            aletheia_crypto::Ed25519PublicKey::from_bytes(&key)
                .map_err(|e| config_error(format!("{what} key {text}: {}", e.detail())))?;
            if !seen.insert(key) {
                return Err(config_error(format!("{what} key {text} is listed twice")));
            }
            Ok(key)
        })
        .collect()
}

impl MonetarySection {
    fn to_genesis(&self, aey_supply: u128) -> Result<MonetaryGenesis, AletheiaError> {
        let policy = MonetaryPolicy {
            authority_keys: parse_keys(&self.authority_keys, "monetary authority")?,
            authority_threshold: self.authority_threshold,
            redemption_agents: parse_keys(&self.redemption_agents, "redemption agent")?,
            attestors: parse_keys(&self.attestors, "attestor")?,
            attestor_threshold: self.attestor_threshold,
            attestor_threshold_large_deviation: self.attestor_threshold_large_deviation,
            max_deviation_bps: self.max_deviation_bps,
            max_attestation_age_slots: self.max_attestation_age_slots,
            reserve_feed_id: self.reserve_feed_id,
            enforce_reserve_ratio: self.enforce_reserve_ratio,
            min_reserve_ratio_bps: self.min_reserve_ratio_bps,
        };
        let within = |threshold: u8, keys: usize, what: &str| {
            if threshold == 0 || usize::from(threshold) > keys {
                Err(config_error(format!(
                    "{what} threshold {threshold} must be between 1 and the {keys} registered keys"
                )))
            } else {
                Ok(())
            }
        };
        within(
            policy.authority_threshold,
            policy.authority_keys.len(),
            "monetary authority",
        )?;
        if !policy.attestors.is_empty() {
            within(
                policy.attestor_threshold,
                policy.attestors.len(),
                "attestor",
            )?;
            within(
                policy.attestor_threshold_large_deviation,
                policy.attestors.len(),
                "large-deviation attestor",
            )?;
            if policy.attestor_threshold_large_deviation < policy.attestor_threshold {
                return Err(config_error(
                    "the large-deviation attestor threshold is below the normal one".to_owned(),
                ));
            }
        }
        if policy.enforce_reserve_ratio
            && (policy.attestors.is_empty() || policy.min_reserve_ratio_bps == 0)
        {
            return Err(config_error(
                "reserve-ratio enforcement needs attestors and a positive min_reserve_ratio_bps"
                    .to_owned(),
            ));
        }
        if policy.max_attestation_age_slots == 0 {
            return Err(config_error(
                "max_attestation_age_slots must be positive".to_owned(),
            ));
        }
        let capacity = within_supply_bound(parse_units(
            &self.aey_authorized_capacity,
            "aey_authorized_capacity",
        )?)?;
        if capacity < aey_supply {
            return Err(config_error(format!(
                "aey_authorized_capacity {capacity} is below the genesis AEY supply {aey_supply}"
            )));
        }
        Ok(MonetaryGenesis {
            policy,
            aey_authorized_capacity: capacity,
            aey_epoch_issuance_cap: within_supply_bound(parse_units(
                &self.aey_epoch_issuance_cap,
                "aey_epoch_issuance_cap",
            )?)?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ValidatorEntry {
    /// BLS12-381 min-pk public key, 48 bytes base16.
    pub consensus_key: String,
    /// Proof of possession over the pre-genesis identity, 96 bytes base16.
    pub proof_of_possession: String,
    /// Ed25519 node identity, 32 bytes base16.
    pub node_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChainSection {
    pub chain_id: u32,
    pub network: String,
    pub protocol_version: u16,
    pub genesis_time_ms: u64,
    pub slot_duration_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FeesSection {
    /// Base units of AEY per execution unit.
    pub eu_price_aey: String,
    /// Mites per execution unit.
    pub eu_price_alnt: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AllocationEntry {
    pub address: String,
    pub asset: String,
    /// Base units as a decimal string.
    pub units: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Allocation {
    pub address: Address,
    pub asset: AssetId,
    pub units: u128,
}

/// The canonical genesis: what `genesis_id` commits to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GenesisState {
    pub chain_id: ChainId,
    pub network_kind: NetworkKind,
    pub protocol_version: ProtocolVersion,
    pub timing: ChainTiming,
    pub fees: FeeSchedule,
    /// Strictly ascending by (address, asset).
    pub allocations: Vec<Allocation>,
    /// Validator-index order.
    pub validators: Vec<ValidatorRecord>,
    pub monetary: Option<MonetaryGenesis>,
    pub governance: Option<crate::registry_model::GovernancePolicy>,
}

fn config_error(detail: String) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::DecodeNonCanonical,
        format!("genesis config: {detail}"),
    )
}

fn parse_units(text: &str, what: &str) -> Result<u128, AletheiaError> {
    if text.is_empty()
        || !text.bytes().all(|b| b.is_ascii_digit())
        || (text.len() > 1 && text.starts_with('0'))
    {
        return Err(config_error(format!(
            "{what} \"{text}\" is not a canonical decimal integer"
        )));
    }
    text.parse::<u128>()
        .map_err(|_| config_error(format!("{what} \"{text}\" exceeds u128")))
}

fn parse_network(text: &str) -> Result<NetworkKind, AletheiaError> {
    match text {
        "mainnet" => Ok(NetworkKind::Mainnet),
        "private-validation" => Ok(NetworkKind::PrivateValidation),
        "devnet" => Ok(NetworkKind::Devnet),
        "regtest" => Ok(NetworkKind::Regtest),
        other => Err(config_error(format!(
            "network \"{other}\" is not one of mainnet, private-validation, devnet, regtest"
        ))),
    }
}

fn parse_asset(text: &str) -> Result<AssetId, AletheiaError> {
    match text {
        "AEY" => Ok(AssetId::AEY),
        "ALnT" => Ok(AssetId::ALNT),
        other => Err(config_error(format!(
            "asset \"{other}\" is not AEY or ALnT"
        ))),
    }
}

impl GenesisConfig {
    pub fn from_toml(text: &str) -> Result<GenesisConfig, AletheiaError> {
        toml::from_str(text).map_err(|e| config_error(e.to_string()))
    }

    /// Validates and canonicalizes the config.
    pub fn to_state(&self) -> Result<GenesisState, AletheiaError> {
        let network_kind = parse_network(&self.chain.network)?;
        if self.chain.protocol_version != 1 {
            return Err(config_error(format!(
                "protocol_version {} must be 1 at genesis",
                self.chain.protocol_version
            )));
        }
        if self.chain.slot_duration_ms == 0 {
            return Err(config_error("slot_duration_ms must be positive".to_owned()));
        }
        let fees = FeeSchedule {
            eu_prices: vec![
                FeePrice {
                    asset: AssetId::AEY,
                    eu_price: parse_units(&self.fees.eu_price_aey, "eu_price_aey")?,
                },
                FeePrice {
                    asset: AssetId::ALNT,
                    eu_price: parse_units(&self.fees.eu_price_alnt, "eu_price_alnt")?,
                },
            ],
        };
        let mut allocations = Vec::with_capacity(self.allocations.len());
        for entry in &self.allocations {
            let address = Address::parse(&entry.address, network_kind).map_err(|e| {
                config_error(format!(
                    "allocation address {}: {}",
                    entry.address,
                    e.detail()
                ))
            })?;
            let units = within_supply_bound(parse_units(&entry.units, "allocation units")?)?;
            allocations.push(Allocation {
                address,
                asset: parse_asset(&entry.asset)?,
                units,
            });
        }
        allocations.sort();
        for pair in allocations.windows(2) {
            if let [first, second] = pair
                && (first.address, first.asset) == (second.address, second.asset)
            {
                return Err(config_error(format!(
                    "duplicate allocation for {} asset {}",
                    first.address.to_text(network_kind),
                    first.asset
                )));
            }
        }
        let chain_id = ChainId::new(self.chain.chain_id);
        let validators = self
            .validators
            .iter()
            .map(|entry| {
                let field = |text: &str, what: &str| {
                    config_error(format!("validator {what} \"{text}\" is not valid base16"))
                };
                Ok(ValidatorRecord {
                    consensus_key: aletheia_core::base16::decode_fixed(&entry.consensus_key)
                        .map_err(|_| field(&entry.consensus_key, "consensus_key"))?,
                    proof_of_possession: aletheia_core::base16::decode_fixed(
                        &entry.proof_of_possession,
                    )
                    .map_err(|_| field(&entry.proof_of_possession, "proof_of_possession"))?,
                    node_key: aletheia_core::base16::decode_fixed(&entry.node_key)
                        .map_err(|_| field(&entry.node_key, "node_key"))?,
                    voting_power: 1,
                })
            })
            .collect::<Result<Vec<_>, AletheiaError>>()?;
        check_validators(
            &NetworkIdentity::new(chain_id, network_kind, Hash32::ZERO),
            &validators,
        )?;
        let aey_supply = allocations
            .iter()
            .filter(|allocation| allocation.asset == AssetId::AEY)
            .try_fold(0u128, |total, allocation| {
                within_supply_bound(
                    total
                        .checked_add(allocation.units)
                        .ok_or_else(|| config_error("genesis AEY supply overflows".to_owned()))?,
                )
            })?;
        let monetary = self
            .monetary
            .as_ref()
            .map(|section| section.to_genesis(aey_supply))
            .transpose()?;
        let governance = self
            .governance
            .as_ref()
            .map(|section| -> Result<crate::registry_model::GovernancePolicy, AletheiaError> {
                let council = section
                    .council
                    .iter()
                    .map(|text| {
                        Address::parse(text, network_kind)
                            .map_err(|e| config_error(format!("council address {text}: {}", e.detail())))
                    })
                    .collect::<Result<Vec<_>, _>>()?;
                let distinct: std::collections::BTreeSet<_> = council.iter().collect();
                if council.is_empty()
                    || distinct.len() != council.len()
                    || section.threshold == 0
                    || usize::from(section.threshold) > council.len()
                    || council.len() > usize::try_from(aletheia_core::registry::MAX_COUNCIL).unwrap_or(32)
                {
                    return Err(config_error(
                        "the council needs 1 to 32 distinct members and a threshold between 1 and their number".to_owned(),
                    ));
                }
                if section.epoch_slots == Some(0) || section.voting_epochs == 0 || section.execution_window_epochs == 0 {
                    return Err(config_error("governance periods must be positive".to_owned()));
                }
                Ok(crate::registry_model::GovernancePolicy {
                    council,
                    threshold: section.threshold,
                    epoch_slots: section.epoch_slots.unwrap_or(crate::registry_model::DEFAULT_EPOCH_SLOTS),
                    voting_epochs: section.voting_epochs,
                    execution_window_epochs: section.execution_window_epochs,
                    max_aey_capacity_increase: within_supply_bound(parse_units(
                        &section.max_aey_capacity_increase,
                        "max_aey_capacity_increase",
                    )?)?,
                })
            })
            .transpose()?;
        Ok(GenesisState {
            chain_id,
            network_kind,
            protocol_version: ProtocolVersion::new(self.chain.protocol_version),
            timing: ChainTiming {
                genesis_time_ms: self.chain.genesis_time_ms,
                slot_duration_ms: self.chain.slot_duration_ms,
            },
            fees,
            allocations,
            validators,
            monetary,
            governance,
        })
    }
}

/// Genesis validators: within the size bound, distinct consensus and node keys, and every
/// proof of possession valid for the pre-genesis identity.
pub fn check_validators(
    pre_genesis: &NetworkIdentity,
    validators: &[ValidatorRecord],
) -> Result<(), AletheiaError> {
    if validators.len() > usize::try_from(MAX_VALIDATOR_RECORDS).unwrap_or(usize::MAX) {
        return Err(config_error(format!(
            "{} validators exceed the maximum of {MAX_VALIDATOR_RECORDS}",
            validators.len()
        )));
    }
    let mut consensus_keys = std::collections::BTreeSet::new();
    let mut node_keys = std::collections::BTreeSet::new();
    for (index, validator) in validators.iter().enumerate() {
        if !consensus_keys.insert(validator.consensus_key) || !node_keys.insert(validator.node_key)
        {
            return Err(config_error(format!(
                "validator {index} repeats a consensus or node key"
            )));
        }
        let proof = aletheia_crypto::bls::BlsSignature::from_bytes(&validator.proof_of_possession)?;
        aletheia_crypto::bls::BlsPublicKey::from_bytes(&validator.consensus_key)?
            .prove_possession(pre_genesis, &proof)
            .map_err(|e| config_error(format!("validator {index}: {}", e.detail())))?;
    }
    Ok(())
}

impl AceEncode for Allocation {
    fn encode(&self, out: &mut AceWriter) {
        self.address.encode(out);
        self.asset.encode(out);
        out.u128(self.units);
    }
}

impl AceDecode for Allocation {
    fn decode(input: &mut AceReader<'_>) -> Result<Allocation, AletheiaError> {
        Ok(Allocation {
            address: Address::decode(input)?,
            asset: AssetId::decode(input)?,
            units: input.u128()?,
        })
    }
}

impl AceEncode for GenesisState {
    fn encode(&self, out: &mut AceWriter) {
        self.chain_id.encode(out);
        self.network_kind.encode(out);
        self.protocol_version.encode(out);
        self.timing.encode(out);
        self.fees.encode(out);
        out.list(&self.allocations);
        out.list(&self.validators);
        out.option(self.monetary.as_ref());
        out.option(self.governance.as_ref());
    }
}

impl AceDecode for GenesisState {
    fn decode(input: &mut AceReader<'_>) -> Result<GenesisState, AletheiaError> {
        Ok(GenesisState {
            chain_id: ChainId::decode(input)?,
            network_kind: NetworkKind::decode(input)?,
            protocol_version: ProtocolVersion::decode(input)?,
            timing: ChainTiming::decode(input)?,
            fees: FeeSchedule::decode(input)?,
            allocations: input.sorted_list(MAX_ALLOCATIONS)?,
            validators: input.list(MAX_VALIDATOR_RECORDS)?,
            monetary: input.option()?,
            governance: input.option()?,
        })
    }
}

struct Empty;

impl StateView for Empty {
    fn get(&self, _: &StateKey) -> Result<Option<StateValue>, AletheiaError> {
        Ok(None)
    }
}

impl GenesisState {
    /// The identity before the genesis id exists. Its domain hashes equal the network's,
    /// which is how genesis validators sign proofs of possession for a chain not yet defined.
    pub fn pre_genesis_identity(&self) -> NetworkIdentity {
        NetworkIdentity::new(self.chain_id, self.network_kind, Hash32::ZERO)
    }

    /// The identity of the network this genesis defines.
    pub fn network(&self) -> NetworkIdentity {
        let genesis_id = self
            .pre_genesis_identity()
            .domain_hash(DomainTag::Genesis, &self.to_ace_bytes());
        NetworkIdentity::new(self.chain_id, self.network_kind, genesis_id)
    }

    /// `validator_set_hash` of the epoch-0 set; zero when genesis has no validators.
    pub fn validator_set_hash(&self) -> Hash32 {
        if self.validators.is_empty() {
            Hash32::ZERO
        } else {
            validator_records_hash(&self.network(), Epoch::new(0), &self.validators)
        }
    }

    /// Initial state (version 0) as sorted changes for the JMT.
    pub fn initial_changes(&self) -> Result<Vec<(StateKey, Option<StateValue>)>, AletheiaError> {
        let records = Records::new(self.network());
        let empty = Empty;
        let mut overlay = StateOverlay::new(&empty);
        overlay.put(
            records.asset_key(AssetId::AEY),
            AssetConfig {
                decimals: 18,
                transferable: true,
            }
            .to_ace_bytes(),
        );
        overlay.put(
            records.asset_key(AssetId::ALNT),
            AssetConfig {
                decimals: 3,
                transferable: true,
            }
            .to_ace_bytes(),
        );
        overlay.put(
            records.param_key(ParamId::FeeSchedule),
            self.fees.to_ace_bytes(),
        );
        overlay.put(
            records.param_key(ParamId::ChainTiming),
            self.timing.to_ace_bytes(),
        );
        let schedule = ProtocolScheduleEntry {
            protocol_version: self.protocol_version.get(),
            activation_height: 0,
            activation_epoch: 0,
            upgrade_id: Hash32::ZERO,
            binary_hashes: Vec::new(),
            migration_id: None,
            recorded_at_height: 0,
        };
        overlay.put(
            records.schedule_key(self.protocol_version.get()),
            schedule.to_ace_bytes(),
        );
        if !self.validators.is_empty() {
            records.put_validator_set(&mut overlay, 0, &self.validators);
        }
        // Supply ledgers (Section 18.4): genesis allocations are the whole issued supply. AEY
        // is reserve-backed; its issuance path (mint authorizations) arrives in Phase 7, and
        // ALnT has none in v0.1 (Section 18.7), so capacity equals the genesis supply.
        for (asset, reserve_backed) in [(AssetId::AEY, true), (AssetId::ALNT, false)] {
            let issued = self
                .allocations
                .iter()
                .filter(|allocation| allocation.asset == asset)
                .try_fold(0u128, |total, allocation| {
                    within_supply_bound(total.checked_add(allocation.units).ok_or_else(|| {
                        config_error(format!("genesis supply of {asset} overflows"))
                    })?)
                })?;
            let mut ledger = aletheia_monetary::SupplyLedger::genesis(issued, reserve_backed);
            if let (AssetId::AEY, Some(monetary)) = (asset, &self.monetary) {
                ledger.authorized_capacity = monetary.aey_authorized_capacity;
                ledger.epoch_issuance_cap = monetary.aey_epoch_issuance_cap;
            }
            records.put_supply_ledger(&mut overlay, asset, &ledger);
        }
        if let Some(monetary) = &self.monetary {
            overlay.put(
                records.param_key(ParamId::MonetaryPolicy),
                monetary.policy.to_ace_bytes(),
            );
        }
        if let Some(governance) = &self.governance {
            overlay.put(
                records.param_key(ParamId::GovernancePolicy),
                governance.to_ace_bytes(),
            );
        }
        for allocation in &self.allocations {
            records.put_balance(
                &mut overlay,
                &allocation.address,
                allocation.asset,
                Balance {
                    available: allocation.units,
                    locked: 0,
                },
            );
        }
        Ok(overlay.into_changes())
    }

    /// The genesis header (height 0) for a state root computed from [`Self::initial_changes`].
    pub fn header(&self, state_root: Hash32) -> BlockHeader {
        let network = self.network();
        let empty_root = merkle::root::<&[u8]>(&network, &[]);
        BlockHeader {
            version: self.protocol_version,
            chain_id: self.chain_id,
            height: Height::GENESIS,
            epoch: Epoch::new(0),
            slot: Slot::new(0),
            protocol_time_ms: self.timing.genesis_time_ms,
            proposer: ValidatorIndex::new(0),
            parent_hash: Hash32::ZERO,
            parent_qc: QuorumCertificate::genesis(),
            timeout_cert: None,
            tx_root: empty_root,
            receipt_root: empty_root,
            state_root,
            event_root: empty_root,
            validator_set_hash: self.validator_set_hash(),
            next_validator_set_hash: self.validator_set_hash(),
            monetary_root: Hash32::ZERO,
            eu_used: 0,
            tx_count: 0,
            extensions: Vec::new(),
        }
    }
}
