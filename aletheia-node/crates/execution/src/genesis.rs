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
//! protocol schedule entry 1, ALnT/AEY allocations and the epoch-0 validator set. The monetary
//! authority and AEY capacity (Phase 7) and governance (Phase 10) join the genesis format in
//! their phases, before any production genesis is built.
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
    AssetConfig, Balance, ChainTiming, FeePrice, FeeSchedule, MAX_VALIDATOR_RECORDS, ParamId,
    ProtocolScheduleEntry, Records, ValidatorRecord, validator_records_hash,
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
            records.put_supply_ledger(
                &mut overlay,
                asset,
                &aletheia_monetary::SupplyLedger::genesis(issued, reserve_backed),
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
