//! Address derivation from keys and deployments (APS-0002, Section 11).
//!
//! ```text
//! account_hash (Ed25519)  = H_domain("ALETHEIA/ADDR/v1", u8(0) || u8(alg_id) || pubkey)
//! account_hash (contract) = H_domain("ALETHEIA/ADDR/v1", u8(2) || deployer || u64(deployer_nonce) || code_hash)
//! ```
//!
//! Multisig derivation waits on the width of `threshold` being fixed (docs/spec/ERRATA.md E-4).

use aletheia_core::{AceEncode, Address, AddressType, DomainTag, Hash32, NetworkIdentity};

use crate::algorithm::SignatureAlgorithm;
use crate::ed25519::Ed25519PublicKey;

pub fn ed25519_account(network: &NetworkIdentity, key: &Ed25519PublicKey) -> Address {
    let mut hasher = network.domain_hasher(DomainTag::Address);
    hasher
        .update(&[
            AddressType::Ed25519Account.code(),
            SignatureAlgorithm::Ed25519.code(),
        ])
        .update(&key.to_bytes());
    Address::new(AddressType::Ed25519Account, hasher.finalize())
}

pub fn contract(
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
    Address::new(AddressType::Contract, hasher.finalize())
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
        let address = ed25519_account(&n, &key());
        assert_eq!(address.account_hash(), expected);
        assert_eq!(address.address_type(), AddressType::Ed25519Account);
    }

    #[test]
    fn the_same_key_has_different_addresses_on_different_networks() {
        let devnet = ed25519_account(&network(NetworkKind::Devnet), &key());
        let mainnet = ed25519_account(&network(NetworkKind::Mainnet), &key());
        assert_ne!(devnet.account_hash(), mainnet.account_hash());
    }

    #[test]
    fn contract_address_depends_on_deployer_nonce_and_code() {
        let n = network(NetworkKind::Devnet);
        let deployer = ed25519_account(&n, &key());
        let code = Hash32::from_bytes([5u8; 32]);
        let first = contract(&n, &deployer, 0, &code);
        assert_eq!(first.address_type(), AddressType::Contract);
        assert_ne!(first, contract(&n, &deployer, 1, &code));
        assert_ne!(
            first,
            contract(&n, &deployer, 0, &Hash32::from_bytes([6u8; 32]))
        );
    }
}
