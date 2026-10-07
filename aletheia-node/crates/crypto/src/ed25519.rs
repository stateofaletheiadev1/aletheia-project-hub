//! Ed25519 account and node-identity signatures (ADR-003).
//!
//! Verification is strict RFC 8032: non-canonical `S`, small-order `R` and weak (small-order)
//! public keys are all refused. Keys are validated once, at parse time, so a
//! [`Ed25519PublicKey`] value is always a usable, non-weak point.
//!
//! Signatures are made over a 32-byte domain digest (Section 13: `signing_digest =
//! H_domain("ALETHEIA/TXSIG/v1", ace(body))`), never over raw protocol bytes, which keeps the
//! message short for hardware wallets and binds it to one network.

use aletheia_core::{AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32};
use ed25519_dalek::{Signer, SigningKey, VerifyingKey};

use crate::secret::Secret;

pub const PUBLIC_KEY_LEN: usize = 32;
pub const SIGNATURE_LEN: usize = 64;

/// A validated Ed25519 public key: canonical encoding, on the curve, not small order.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Ed25519PublicKey {
    key: VerifyingKey,
}

impl Ed25519PublicKey {
    pub fn from_bytes(bytes: &[u8; PUBLIC_KEY_LEN]) -> Result<Ed25519PublicKey, AletheiaError> {
        let key = VerifyingKey::from_bytes(bytes).map_err(|_| {
            AletheiaError::new(
                ErrorCode::KeyMalformed,
                "Ed25519 public key is not a valid curve point encoding".to_owned(),
            )
        })?;
        if key.is_weak() {
            return Err(AletheiaError::new(
                ErrorCode::KeyWeak,
                "Ed25519 public key is a small-order point".to_owned(),
            ));
        }
        Ok(Ed25519PublicKey { key })
    }

    pub fn to_bytes(&self) -> [u8; PUBLIC_KEY_LEN] {
        self.key.to_bytes()
    }

    /// Strict verification of `signature` over `digest`.
    pub fn verify(
        &self,
        digest: &Hash32,
        signature: &Ed25519Signature,
    ) -> Result<(), AletheiaError> {
        let signature = ed25519_dalek::Signature::from_bytes(&signature.bytes);
        self.key
            .verify_strict(digest.as_bytes(), &signature)
            .map_err(|_| {
                AletheiaError::new(
                    ErrorCode::SigInvalid,
                    format!(
                        "Ed25519 signature does not verify for key {} over digest {digest}",
                        aletheia_core::base16::encode(&self.to_bytes())
                    ),
                )
            })
    }
}

impl core::fmt::Debug for Ed25519PublicKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(
            f,
            "Ed25519PublicKey({})",
            aletheia_core::base16::encode(&self.to_bytes())
        )
    }
}

impl AceEncode for Ed25519PublicKey {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.to_bytes());
    }

    fn encoded_len_hint(&self) -> usize {
        PUBLIC_KEY_LEN
    }
}

impl AceDecode for Ed25519PublicKey {
    fn decode(input: &mut AceReader<'_>) -> Result<Ed25519PublicKey, AletheiaError> {
        Ed25519PublicKey::from_bytes(&input.array::<PUBLIC_KEY_LEN>()?)
    }
}

/// Ed25519 signature bytes. Canonicality of `S` is checked during verification, where the
/// strict verifier sees the whole signature; a decoded value is not yet a valid signature.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Ed25519Signature {
    bytes: [u8; SIGNATURE_LEN],
}

impl Ed25519Signature {
    pub const fn from_bytes(bytes: [u8; SIGNATURE_LEN]) -> Ed25519Signature {
        Ed25519Signature { bytes }
    }

    pub const fn to_bytes(&self) -> [u8; SIGNATURE_LEN] {
        self.bytes
    }
}

impl core::fmt::Debug for Ed25519Signature {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(
            f,
            "Ed25519Signature({})",
            aletheia_core::base16::encode(&self.bytes)
        )
    }
}

impl AceEncode for Ed25519Signature {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.bytes);
    }

    fn encoded_len_hint(&self) -> usize {
        SIGNATURE_LEN
    }
}

impl AceDecode for Ed25519Signature {
    fn decode(input: &mut AceReader<'_>) -> Result<Ed25519Signature, AletheiaError> {
        input
            .array::<SIGNATURE_LEN>()
            .map(Ed25519Signature::from_bytes)
    }
}

/// An Ed25519 signing key. The seed is zeroized on drop; there is no way to print it.
#[allow(
    missing_debug_implementations,
    reason = "secret key material must not be printable"
)]
pub struct Ed25519SigningKey {
    key: SigningKey,
}

impl Ed25519SigningKey {
    /// A fresh key from the operating system CSPRNG. Key generation only; randomness never
    /// enters consensus (Section 17).
    pub fn generate() -> Result<Ed25519SigningKey, AletheiaError> {
        let mut seed = Secret::new([0u8; 32]);
        getrandom::fill(seed.expose_mut()).map_err(|error| {
            AletheiaError::new(
                ErrorCode::KeyGenerationFailed,
                format!("operating system randomness unavailable: {error}"),
            )
        })?;
        Ok(Ed25519SigningKey::from_seed(&seed))
    }

    /// Builds a key from a 32-byte RFC 8032 seed held in a [`Secret`].
    pub fn from_seed(seed: &Secret<[u8; 32]>) -> Ed25519SigningKey {
        Ed25519SigningKey {
            key: SigningKey::from_bytes(seed.expose()),
        }
    }

    /// The matching public key. A key derived from a clamped secret scalar is a multiple of
    /// the prime-order base point and so never small order; no validation is needed.
    pub fn public_key(&self) -> Ed25519PublicKey {
        Ed25519PublicKey {
            key: self.key.verifying_key(),
        }
    }

    pub fn sign(&self, digest: &Hash32) -> Ed25519Signature {
        Ed25519Signature::from_bytes(self.key.sign(digest.as_bytes()).to_bytes())
    }
}
