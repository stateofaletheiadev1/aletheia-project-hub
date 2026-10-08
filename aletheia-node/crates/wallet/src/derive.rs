//! SLIP-0010 Ed25519 key derivation (spec Section 41): hardened path
//! `m/44'/<coin type>'/<account>'/0'/<index>'`. Ed25519 under SLIP-0010 has hardened children
//! only.

use aletheia_crypto::Secret;
use hmac::{Hmac, Mac};
use sha2::Sha512;
use zeroize::Zeroize;

use crate::WalletError;

type HmacSha512 = Hmac<Sha512>;

/// The coin type in the derivation path. PROVISIONAL: not yet registered in SLIP-0044 nor
/// recorded in APS-0030. Changing it changes every derived address, so it must be settled
/// before any mainnet wallet derives keys.
pub const PROVISIONAL_COIN_TYPE: u32 = 7771;

const HARDENED: u32 = 0x8000_0000;

/// A node of the derivation tree: key and chain code, wiped on drop.
pub struct ExtendedKey {
    key: Secret<[u8; 32]>,
    chain_code: Secret<[u8; 32]>,
}

impl core::fmt::Debug for ExtendedKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("ExtendedKey(..)")
    }
}

fn split(mut digest: [u8; 64]) -> ExtendedKey {
    let mut key = [0u8; 32];
    let mut chain_code = [0u8; 32];
    key.copy_from_slice(digest.get(..32).unwrap_or(&[0; 32]));
    chain_code.copy_from_slice(digest.get(32..).unwrap_or(&[0; 32]));
    digest.zeroize();
    let out = ExtendedKey {
        key: Secret::new(key),
        chain_code: Secret::new(chain_code),
    };
    key.zeroize();
    chain_code.zeroize();
    out
}

fn hmac(key: &[u8], parts: &[&[u8]]) -> Result<[u8; 64], WalletError> {
    // HMAC takes keys of any length; the error type exists only for other MACs.
    let mut mac =
        <HmacSha512 as Mac>::new_from_slice(key).map_err(|_| WalletError("HMAC key".to_owned()))?;
    for part in parts {
        mac.update(part);
    }
    Ok(mac.finalize().into_bytes().into())
}

impl ExtendedKey {
    /// The master node for a seed (16 to 64 bytes).
    pub fn master(seed: &[u8]) -> Result<ExtendedKey, WalletError> {
        if !(16..=64).contains(&seed.len()) {
            return Err(WalletError("a seed is 16 to 64 bytes".to_owned()));
        }
        hmac(b"ed25519 seed", &[seed]).map(split)
    }

    /// The hardened child `index'`.
    pub fn child(&self, index: u32) -> Result<ExtendedKey, WalletError> {
        let hardened = index | HARDENED;
        hmac(
            self.chain_code.expose(),
            &[&[0u8], self.key.expose(), &hardened.to_be_bytes()],
        )
        .map(split)
    }

    /// Follows a path of hardened indices.
    pub fn path(&self, indices: &[u32]) -> Result<ExtendedKey, WalletError> {
        let mut node = self.child(indices.first().copied().unwrap_or(0))?;
        for index in indices.iter().skip(1) {
            node = node.child(*index)?;
        }
        Ok(node)
    }

    /// The 32-byte Ed25519 seed this node holds.
    pub fn key(&self) -> &Secret<[u8; 32]> {
        &self.key
    }

    pub fn chain_code(&self) -> &Secret<[u8; 32]> {
        &self.chain_code
    }
}

/// The key at `m/44'/coin'/account'/0'/index'`.
pub fn account_key(
    seed: &[u8],
    coin_type: u32,
    account: u32,
    index: u32,
) -> Result<ExtendedKey, WalletError> {
    ExtendedKey::master(seed)?.path(&[44, coin_type, account, 0, index])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(bytes: &[u8]) -> String {
        aletheia_core::base16::encode(bytes)
    }

    /// SLIP-0010 test vector 1 for ed25519.
    #[test]
    fn slip_0010_vector_1() {
        let seed = aletheia_core::base16::decode("000102030405060708090a0b0c0d0e0f").unwrap();
        let master = ExtendedKey::master(&seed).unwrap();
        assert_eq!(
            hex(master.chain_code().expose()),
            "90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb"
        );
        assert_eq!(
            hex(master.key().expose()),
            "2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7"
        );
        let child = master.child(0).unwrap();
        assert_eq!(
            hex(child.chain_code().expose()),
            "8b59aa11380b624e81507a27fedda59fea6d0b779a778918a2fd3590e16e9c69"
        );
        assert_eq!(
            hex(child.key().expose()),
            "68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3"
        );
        // m/0'/1'/2'/2'/1000000000'
        let deep = master.path(&[0, 1, 2, 2, 1_000_000_000]).unwrap();
        assert_eq!(
            hex(deep.key().expose()),
            "8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793"
        );
    }

    #[test]
    fn accounts_and_indices_give_different_keys() {
        let seed = [9u8; 32];
        let a = account_key(&seed, PROVISIONAL_COIN_TYPE, 0, 0).unwrap();
        let b = account_key(&seed, PROVISIONAL_COIN_TYPE, 0, 1).unwrap();
        let c = account_key(&seed, PROVISIONAL_COIN_TYPE, 1, 0).unwrap();
        assert_ne!(a.key().expose(), b.key().expose());
        assert_ne!(a.key().expose(), c.key().expose());
        assert_eq!(
            a.key().expose(),
            account_key(&seed, PROVISIONAL_COIN_TYPE, 0, 0)
                .unwrap()
                .key()
                .expose()
        );
    }
}
