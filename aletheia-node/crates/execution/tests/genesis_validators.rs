//! Genesis validators (spec Sections 19.1, 43): proofs of possession are checked, keys are
//! distinct, the set is recorded in state and committed to by the genesis header.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::indexing_slicing)]

use aletheia_core::{ChainId, Epoch, ErrorCode, Hash32, NetworkIdentity, NetworkKind};
use aletheia_crypto::{BlsSecretKey, Secret};
use aletheia_execution::GenesisConfig;
use aletheia_execution::model::{Records, validator_records_hash};

const BASE: &str = "[chain]\nchain_id = 7771\nnetwork = \"devnet\"\nprotocol_version = 1\ngenesis_time_ms = 1767225600000\nslot_duration_ms = 500\n\n[fees]\neu_price_aey = \"1000000000\"\neu_price_alnt = \"1\"\n";

fn pre_genesis() -> NetworkIdentity {
    NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
}

fn bls(index: u8) -> BlsSecretKey {
    BlsSecretKey::from_key_material(&Secret::new([index.wrapping_add(40); 32])).unwrap()
}

/// `[[validators]]` for key `key`, proving possession with key `prover`.
fn entry(key: u8, prover: u8, node_key: u8) -> String {
    let public = bls(key).public_key().to_bytes();
    let proof = bls(prover).prove_possession(&pre_genesis()).to_bytes();
    format!(
        "\n[[validators]]\nconsensus_key = \"{}\"\nproof_of_possession = \"{}\"\nnode_key = \"{}\"\n",
        aletheia_core::base16::encode(&public),
        aletheia_core::base16::encode(&proof),
        aletheia_core::base16::encode(&[node_key; 32]),
    )
}

fn genesis(
    entries: &[String],
) -> Result<aletheia_execution::GenesisState, aletheia_core::AletheiaError> {
    GenesisConfig::from_toml(&format!("{BASE}{}", entries.concat()))?.to_state()
}

#[test]
fn validators_are_recorded_and_committed_to_by_the_header() {
    let state = genesis(&[
        entry(0, 0, 1),
        entry(1, 1, 2),
        entry(2, 2, 3),
        entry(3, 3, 4),
    ])
    .unwrap();
    assert_eq!(state.validators.len(), 4);
    let network = state.network();
    let expected = validator_records_hash(&network, Epoch::new(0), &state.validators);
    assert_ne!(expected, Hash32::ZERO);
    let header = state.header(Hash32::ZERO);
    assert_eq!(header.validator_set_hash, expected);
    assert_eq!(header.next_validator_set_hash, expected);

    let key = Records::new(network).validator_set_key(0);
    assert!(
        state
            .initial_changes()
            .unwrap()
            .iter()
            .any(|(k, v)| *k == key && v.is_some()),
        "the epoch-0 set is in genesis state"
    );
}

#[test]
fn a_proof_made_before_genesis_verifies_on_the_network() {
    let state = genesis(&[entry(0, 0, 1)]).unwrap();
    let network = state.network();
    assert_ne!(network.genesis_id(), Hash32::ZERO);
    let record = state.validators[0];
    aletheia_crypto::bls::BlsPublicKey::from_bytes(&record.consensus_key)
        .unwrap()
        .prove_possession(
            &network,
            &aletheia_crypto::bls::BlsSignature::from_bytes(&record.proof_of_possession).unwrap(),
        )
        .expect("domain hashes do not depend on the genesis id");
}

#[test]
fn a_wrong_proof_of_possession_is_refused() {
    let error = genesis(&[entry(0, 0, 1), entry(1, 0, 2)]).unwrap_err();
    assert!(error.detail().contains("validator 1"), "{error}");
}

#[test]
fn repeated_keys_are_refused() {
    assert!(
        genesis(&[entry(0, 0, 1), entry(0, 0, 2)]).is_err(),
        "same consensus key"
    );
    assert!(
        genesis(&[entry(0, 0, 1), entry(1, 1, 1)]).is_err(),
        "same node key"
    );
}

#[test]
fn malformed_keys_are_refused() {
    let bad = entry(0, 0, 1).replace("consensus_key = \"", "consensus_key = \"zz");
    assert_eq!(
        genesis(&[bad]).unwrap_err().code(),
        ErrorCode::DecodeNonCanonical
    );
}

#[test]
fn a_genesis_without_validators_commits_to_no_set() {
    let state = genesis(&[]).unwrap();
    assert_eq!(state.header(Hash32::ZERO).validator_set_hash, Hash32::ZERO);
}
