//! State keys (spec Section 15, APS-0005).
//!
//! ```text
//! state_key = H_domain("ALETHEIA/STATEKEY/v1", u8(namespace) || ace(namespace_key))
//! ```
//!
//! Hashing spreads keys uniformly over the 256-bit JMT key space, so no namespace can be used
//! to grow one deep branch of the tree. Which namespaces are active is a protocol-version
//! question for the execution rules; this module only fixes the numbering.

use aletheia_core::{AceEncode, DomainTag, Hash32, NetworkIdentity};

/// State namespaces and their protocol ids (decimal, Section 15 and v4.0 additions).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Namespace {
    Accounts,
    Balances,
    Assets,
    MonetaryLedger,
    MintAuthorizations,
    ValidatorRegistry,
    ValidatorSets,
    IdentityRegistry,
    Credentials,
    ResidenceRegistry,
    LandRegistry,
    LandHistory,
    ContractCode,
    ContractMeta,
    ContractStorage,
    Governance,
    ProtocolParams,
    ProtocolSchedule,
    Oracles,
    BridgeRoutes,
    BridgeMessages,
    BridgedAssets,
    BridgeLightClients,
    ApnParticipants,
    AanMapping,
    ProxyAliases,
    Mandates,
    PaymentRequests,
    MessageAnchors,
    SchemeRules,
    PaymentDedup,
    ExternalLegEscrow,
}

impl Namespace {
    pub const fn id(self) -> u8 {
        match self {
            Namespace::Accounts => 1,
            Namespace::Balances => 2,
            Namespace::Assets => 3,
            Namespace::MonetaryLedger => 4,
            Namespace::MintAuthorizations => 5,
            Namespace::ValidatorRegistry => 16,
            Namespace::ValidatorSets => 17,
            Namespace::IdentityRegistry => 32,
            Namespace::Credentials => 33,
            Namespace::ResidenceRegistry => 34,
            Namespace::LandRegistry => 35,
            Namespace::LandHistory => 36,
            Namespace::ContractCode => 48,
            Namespace::ContractMeta => 49,
            Namespace::ContractStorage => 50,
            Namespace::Governance => 64,
            Namespace::ProtocolParams => 65,
            Namespace::ProtocolSchedule => 66,
            Namespace::Oracles => 80,
            Namespace::BridgeRoutes => 96,
            Namespace::BridgeMessages => 97,
            Namespace::BridgedAssets => 98,
            Namespace::BridgeLightClients => 99,
            Namespace::ApnParticipants => 100,
            Namespace::AanMapping => 101,
            Namespace::ProxyAliases => 102,
            Namespace::Mandates => 103,
            Namespace::PaymentRequests => 104,
            Namespace::MessageAnchors => 105,
            Namespace::SchemeRules => 106,
            Namespace::PaymentDedup => 107,
            Namespace::ExternalLegEscrow => 108,
        }
    }
}

/// A 256-bit JMT key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct StateKey(Hash32);

impl StateKey {
    pub fn derive<K: AceEncode>(
        network: &NetworkIdentity,
        namespace: Namespace,
        key: &K,
    ) -> StateKey {
        StateKey::derive_raw(network, namespace, &key.to_ace_bytes())
    }

    /// For composite keys such as `(Address, AssetId)`: `key_ace` is the concatenated ACE
    /// encoding of the key's fields, in declared order.
    pub fn derive_raw(network: &NetworkIdentity, namespace: Namespace, key_ace: &[u8]) -> StateKey {
        let mut hasher = network.domain_hasher(DomainTag::StateKey);
        hasher.update(&[namespace.id()]).update(key_ace);
        StateKey(hasher.finalize())
    }

    pub const fn from_hash(hash: Hash32) -> StateKey {
        StateKey(hash)
    }

    pub const fn hash(&self) -> Hash32 {
        self.0
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        self.0.as_bytes()
    }

    /// Nibble `index` (0..64) of the key, most significant first: the JMT path.
    pub fn nibble(&self, index: usize) -> u8 {
        let byte = self.0.as_bytes().get(index / 2).copied().unwrap_or(0);
        if index.is_multiple_of(2) {
            byte >> 4
        } else {
            byte & 0x0f
        }
    }
}

/// State values are opaque ACE bytes owned by the module that wrote them.
pub type StateValue = Vec<u8>;

/// Largest value the state accepts: contract bytecode (512 KiB deploy limit) with headroom.
pub const MAX_STATE_VALUE_BYTES: usize = 1024 * 1024;

#[cfg(test)]
mod tests {
    use super::*;
    use aletheia_core::{Address, AssetId, ChainId, NetworkKind};
    use std::collections::BTreeSet;

    fn network() -> NetworkIdentity {
        NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
    }

    #[test]
    fn namespace_ids_are_unique() {
        let all = [
            Namespace::Accounts,
            Namespace::Balances,
            Namespace::Assets,
            Namespace::MonetaryLedger,
            Namespace::MintAuthorizations,
            Namespace::ValidatorRegistry,
            Namespace::ValidatorSets,
            Namespace::IdentityRegistry,
            Namespace::Credentials,
            Namespace::ResidenceRegistry,
            Namespace::LandRegistry,
            Namespace::LandHistory,
            Namespace::ContractCode,
            Namespace::ContractMeta,
            Namespace::ContractStorage,
            Namespace::Governance,
            Namespace::ProtocolParams,
            Namespace::ProtocolSchedule,
            Namespace::Oracles,
            Namespace::BridgeRoutes,
            Namespace::BridgeMessages,
            Namespace::BridgedAssets,
            Namespace::BridgeLightClients,
            Namespace::ApnParticipants,
            Namespace::AanMapping,
            Namespace::ProxyAliases,
            Namespace::Mandates,
            Namespace::PaymentRequests,
            Namespace::MessageAnchors,
            Namespace::SchemeRules,
            Namespace::PaymentDedup,
            Namespace::ExternalLegEscrow,
        ];
        let ids: BTreeSet<u8> = all.iter().map(|n| n.id()).collect();
        assert_eq!(ids.len(), all.len());
    }

    #[test]
    fn the_same_key_in_different_namespaces_differs() {
        let address = Address::from_bytes([1; 20]);
        let account = StateKey::derive(&network(), Namespace::Accounts, &address);
        let meta = StateKey::derive(&network(), Namespace::ContractMeta, &address);
        assert_ne!(account, meta);
    }

    #[test]
    fn composite_keys_follow_the_normative_preimage() {
        let address = Address::from_bytes([1; 20]);
        let mut preimage = vec![Namespace::Balances.id()];
        preimage.extend_from_slice(&address.to_ace_bytes());
        preimage.extend_from_slice(&AssetId::AEY.to_ace_bytes());
        let mut composite = address.to_ace_bytes();
        composite.extend_from_slice(&AssetId::AEY.to_ace_bytes());
        let expected = network().domain_hash(DomainTag::StateKey, &preimage);
        let derived = StateKey::derive_raw(&network(), Namespace::Balances, &composite);
        assert_eq!(derived.hash(), expected);
    }

    #[test]
    fn nibbles_read_most_significant_first() {
        let mut bytes = [0u8; 32];
        bytes[0] = 0xab;
        bytes[31] = 0x0f;
        let key = StateKey::from_hash(Hash32::from_bytes(bytes));
        assert_eq!(
            (key.nibble(0), key.nibble(1), key.nibble(62), key.nibble(63)),
            (0xa, 0xb, 0x0, 0xf)
        );
    }
}
