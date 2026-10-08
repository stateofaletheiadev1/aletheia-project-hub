//! The encrypted keystore (spec Section 41): the 32-byte seed sealed with XChaCha20-Poly1305
//! under a key from Argon2id over the password. A wrong password or any tampering fails the
//! authentication tag; nothing is decrypted partially. The file carries the address in clear
//! so a wallet can show it without the password.

use aletheia_core::base16;
use aletheia_crypto::Secret;
use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde_json::{Value, json};
use zeroize::Zeroize;

use crate::WalletError;

/// Argon2id cost: 64 MiB, 3 passes, 1 lane.
pub const KDF_MEMORY_KIB: u32 = 64 * 1024;
pub const KDF_PASSES: u32 = 3;
pub const KDF_LANES: u32 = 1;

fn kdf(
    password: &[u8],
    salt: &[u8],
    memory: u32,
    passes: u32,
    lanes: u32,
) -> Result<Secret<[u8; 32]>, WalletError> {
    let params = Params::new(memory, passes, lanes, Some(32))
        .map_err(|e| WalletError(format!("keystore parameters: {e}")))?;
    let mut key = [0u8; 32];
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password, salt, &mut key)
        .map_err(|e| WalletError(format!("key derivation: {e}")))?;
    let out = Secret::new(key);
    key.zeroize();
    Ok(out)
}

/// Seals `seed` under `password`. `salt` (16 bytes) and `nonce` (24 bytes) must be random.
pub fn seal(
    seed: &Secret<[u8; 32]>,
    password: &[u8],
    salt: [u8; 16],
    nonce: [u8; 24],
    address: &str,
) -> Result<Value, WalletError> {
    let key = kdf(password, &salt, KDF_MEMORY_KIB, KDF_PASSES, KDF_LANES)?;
    let cipher = XChaCha20Poly1305::new(key.expose().into());
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce), seed.expose().as_slice())
        .map_err(|_| WalletError("encryption failed".to_owned()))?;
    Ok(json!({
        "version": 1,
        "address": address,
        "kdf": {
            "name": "argon2id",
            "memoryKib": KDF_MEMORY_KIB,
            "passes": KDF_PASSES,
            "lanes": KDF_LANES,
            "salt": base16::encode(&salt),
        },
        "cipher": {
            "name": "xchacha20poly1305",
            "nonce": base16::encode(&nonce),
            "ciphertext": base16::encode(&ciphertext),
        },
    }))
}

fn field<'a>(file: &'a Value, path: &[&str]) -> Result<&'a Value, WalletError> {
    path.iter()
        .try_fold(file, |node, key| node.get(key))
        .ok_or_else(|| WalletError(format!("keystore field {} is missing", path.join("."))))
}

fn hex_field(file: &Value, path: &[&str]) -> Result<Vec<u8>, WalletError> {
    let text = field(file, path)?
        .as_str()
        .ok_or_else(|| WalletError(format!("keystore field {} is not text", path.join("."))))?;
    base16::decode(text)
        .map_err(|e| WalletError(format!("keystore field {}: {}", path.join("."), e.detail())))
}

fn number_field(file: &Value, path: &[&str]) -> Result<u32, WalletError> {
    field(file, path)?
        .as_u64()
        .and_then(|n| u32::try_from(n).ok())
        .ok_or_else(|| WalletError(format!("keystore field {} is not a number", path.join("."))))
}

/// Opens a keystore with `password`.
pub fn open(file: &Value, password: &[u8]) -> Result<Secret<[u8; 32]>, WalletError> {
    if field(file, &["version"])?.as_u64() != Some(1) {
        return Err(WalletError("unsupported keystore version".to_owned()));
    }
    if field(file, &["kdf", "name"])?.as_str() != Some("argon2id")
        || field(file, &["cipher", "name"])?.as_str() != Some("xchacha20poly1305")
    {
        return Err(WalletError("unsupported keystore algorithms".to_owned()));
    }
    let salt = hex_field(file, &["kdf", "salt"])?;
    let key = kdf(
        password,
        &salt,
        number_field(file, &["kdf", "memoryKib"])?,
        number_field(file, &["kdf", "passes"])?,
        number_field(file, &["kdf", "lanes"])?,
    )?;
    let nonce = hex_field(file, &["cipher", "nonce"])?;
    if nonce.len() != 24 {
        return Err(WalletError("keystore nonce is not 24 bytes".to_owned()));
    }
    let ciphertext = hex_field(file, &["cipher", "ciphertext"])?;
    let mut plain = XChaCha20Poly1305::new(key.expose().into())
        .decrypt(XNonce::from_slice(&nonce), ciphertext.as_slice())
        .map_err(|_| WalletError("wrong password, or the keystore was changed".to_owned()))?;
    let seed: [u8; 32] = plain
        .as_slice()
        .try_into()
        .map_err(|_| WalletError("keystore holds the wrong length of key".to_owned()))?;
    plain.zeroize();
    Ok(Secret::new(seed))
}
