//! Address derivation from keys and deployments (APS-0002, Section 11, ADR-062).
//!
//! ```text
//! account_hash (Ed25519)  = H_domain("ALETHEIA/ADDR/v1", u8(0) || u8(alg_id) || pubkey)
//! account_hash (multisig) = H_domain("ALETHEIA/ADDR/v1", u8(1) || u8(threshold) || ace(list<PublicKeyEntry>))
//! account_hash (contract) = H_domain("ALETHEIA/ADDR/v1", u8(2) || deployer || u64(deployer_nonce) || code_hash)
//! address                 = last 20 bytes of account_hash
//! ```
//!
//! For keys the full 32-byte account hash is also the account's key commitment: execution
//! stores it with the account and compares all 32 bytes on every later transaction, so finding
//! a key whose hash shares an existing account's last 20 bytes does not let anyone spend from
//! it. The multisig layout (one-byte threshold, keys tagged with `alg_id` and strictly sorted)
//! resolves ERRATA E-4.

use aletheia_core::{
    AceEncode, AceWriter, Address, AddressType, AletheiaError, AuthScheme, Authorization,
    DomainTag, ErrorCode, Hash32, NetworkIdentity, PublicKeyEntry,
};

use crate::algorithm::SignatureAlgorithm;
use crate::ed25519::Ed25519PublicKey;

/// The 32-byte key commitment of a single Ed25519 key.
pub fn ed25519_commitment(network: &NetworkIdentity, key: &Ed25519PublicKey) -> Hash32 {
    let mut hasher = network.domain_hasher(DomainTag::Address);
    hasher
        .update(&[
            AddressType::Ed25519Account.code(),
            SignatureAlgorithm::Ed25519.code(),
        ])
        .update(&key.to_bytes());
    hasher.finalize()
}

pub fn ed25519_account(network: &NetworkIdentity, key: &Ed25519PublicKey) -> Address {
    Address::from_account_hash(&ed25519_commitment(network, key))
}

/// A contract's address (Section 11): the last 20 bytes of `H_domain("ALETHEIA/ADDR/v1",
/// u8(2) || deployer || u64(deployer_nonce) || code_hash)`, with the deployer in its ACE
/// encoding.
pub fn contract_account(
    network: &NetworkIdentity,
    deployer: &Address,
    deployer_nonce: u64,
    code_hash: &Hash32,
) -> Address {
    let mut hasher = network.domain_hasher(DomainTag::Address);
    hasher
        .update(&[AddressType::Contract.code()])
        .update(&deployer.to_ace_bytes())
        .update(&deployer_nonce.to_le_bytes())
        .update(code_hash.as_bytes());
    Address::from_account_hash(&hasher.finalize())
}

/// The 32-byte key commitment of a multisig. `keys` must be strictly ascending, as the
/// authorization decoder already guarantees.
pub fn multisig_commitment(
    network: &NetworkIdentity,
    threshold: u8,
    keys: &[PublicKeyEntry],
) -> Hash32 {
    let mut encoded_keys = AceWriter::new();
    encoded_keys.list(keys);
    let mut hasher = network.domain_hasher(DomainTag::Address);
    hasher
        .update(&[AddressType::MultisigAccount.code(), threshold])
        .update(encoded_keys.as_bytes());
    hasher.finalize()
}

pub fn multisig_account(
    network: &NetworkIdentity,
    threshold: u8,
    keys: &[PublicKeyEntry],
) -> Address {
    Address::from_account_hash(&multisig_commitment(network, threshold, keys))
}

/// The key commitment of an authorization's keys. Execution checks that its last 20 bytes are
/// the sender for an account's first transaction and stores it; after that the stored
/// commitment is authoritative, so keys can rotate without changing the address.
pub fn authorization_commitment(
    network: &NetworkIdentity,
    authorization: &Authorization,
) -> Result<Hash32, AletheiaError> {
    match authorization.scheme {
        AuthScheme::Ed25519 => {
            let entry = match authorization.public_keys.as_slice() {
                [only] => only,
                keys => {
                    return Err(AletheiaError::new(
                        ErrorCode::TxAuthMalformed,
                        format!(
                            "Ed25519 authorization carries {} keys, expected 1",
                            keys.len()
                        ),
                    ));
                }
            };
            let bytes = <[u8; 32]>::try_from(entry.key.as_slice()).map_err(|_| {
                AletheiaError::new(
                    ErrorCode::KeyMalformed,
                    format!("Ed25519 key is {} bytes, expected 32", entry.key.len()),
                )
            })?;
            Ok(ed25519_commitment(
                network,
                &Ed25519PublicKey::from_bytes(&bytes)?,
            ))
        }
        AuthScheme::MultiEd25519 => Ok(multisig_commitment(
            network,
            authorization.threshold,
            &authorization.public_keys,
        )),
    }
}

/// The address controlled by an authorization's keys.
pub fn authorization_address(
    network: &NetworkIdentity,
    authorization: &Authorization,
) -> Result<Address, AletheiaError> {
    authorization_commitment(network, authorization).map(|hash| Address::from_account_hash(&hash))
}

pub fn contract(
    network: &NetworkIdentity,
    deployer: &Address,
    deployer_nonce: u64,
    code_hash: &Hash32,
) -> Address {
    contract_account(network, deployer, deployer_nonce, code_hash)
}

#[cfg(test)]
mod tests {
    use super::*;
    use aletheia_core::{ChainId, NetworkKind};

    fn network(kind: NetworkKind) -> NetworkIdentity {
        NetworkIdentity::new(ChainId::new(7771), kind, Hash32::ZERO)
    }

    fn key() -> Ed25519PublicKey {
        let seed = crate::Secret::new([42u8; 32]);
        crate::ed25519::Ed25519SigningKey::from_seed(&seed).public_key()
    }

    #[test]
    fn ed25519_address_follows_the_normative_preimage() {
        let n = network(NetworkKind::Devnet);
        let mut preimage = vec![0u8, 1u8];
        preimage.extend_from_slice(&key().to_bytes());
        let expected = n.domain_hash(DomainTag::Address, &preimage);
        assert_eq!(ed25519_commitment(&n, &key()), expected);
        let address = ed25519_account(&n, &key());
        assert_eq!(address.as_bytes()[..], expected.as_bytes()[12..]);
    }

    #[test]
    fn the_same_key_has_different_addresses_on_different_networks() {
        let devnet = ed25519_account(&network(NetworkKind::Devnet), &key());
        let mainnet = ed25519_account(&network(NetworkKind::Mainnet), &key());
        assert_ne!(devnet, mainnet);
    }

    #[test]
    fn multisig_address_depends_on_threshold_and_keys() {
        let n = network(NetworkKind::Devnet);
        let keys = vec![
            PublicKeyEntry {
                alg_id: 1,
                key: vec![1; 32],
            },
            PublicKeyEntry {
                alg_id: 1,
                key: vec![2; 32],
            },
        ];
        let two_of_two = multisig_account(&n, 2, &keys);
        assert_eq!(
            two_of_two,
            Address::from_account_hash(&multisig_commitment(&n, 2, &keys))
        );
        assert_ne!(two_of_two, multisig_account(&n, 1, &keys));
        assert_ne!(two_of_two, multisig_account(&n, 2, &keys[..1]));
    }

    #[test]
    fn single_key_authorization_maps_to_the_ed25519_address_and_commitment() {
        let n = network(NetworkKind::Devnet);
        let authorization = Authorization {
            scheme: AuthScheme::Ed25519,
            threshold: 1,
            public_keys: vec![PublicKeyEntry {
                alg_id: 1,
                key: key().to_bytes().to_vec(),
            }],
            signatures: vec![],
        };
        assert_eq!(
            authorization_address(&n, &authorization),
            Ok(ed25519_account(&n, &key()))
        );
        assert_eq!(
            authorization_commitment(&n, &authorization),
            Ok(ed25519_commitment(&n, &key()))
        );
    }

    #[test]
    fn contract_address_depends_on_deployer_nonce_and_code() {
        let n = network(NetworkKind::Devnet);
        let deployer = ed25519_account(&n, &key());
        let code = Hash32::from_bytes([5u8; 32]);
        let first = contract(&n, &deployer, 0, &code);
        assert!(!first.is_native_module());
        assert_ne!(first, contract(&n, &deployer, 1, &code));
        assert_ne!(
            first,
            contract(&n, &deployer, 0, &Hash32::from_bytes([6u8; 32]))
        );
    }
}
