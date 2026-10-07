//! BLS12-381 consensus signatures, min-pk variant (APS-0009, ADR-004).
//!
//! Public keys are 48-byte compressed G1 points, signatures 96-byte compressed G2 points.
//! Votes and proposals use the IETF ciphersuite `BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_`;
//! proofs of possession use the matching `BLS_POP_…` tag, over
//! `H_domain("ALETHEIA/BLS-POP/v1", compressed_public_key)`.
//!
//! Aggregation is only defined over [`ProvenBlsPublicKey`], which can be obtained solely by
//! verifying a proof of possession. That makes the rogue-key attack on fast aggregate
//! verification a type error rather than a review item.

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, DomainTag, ErrorCode, Hash32,
    NetworkIdentity,
};
use blst::BLST_ERROR;
use blst::min_pk::{AggregatePublicKey, AggregateSignature, PublicKey, SecretKey, Signature};

use crate::secret::Secret;

pub const PUBLIC_KEY_LEN: usize = 48;
pub const SIGNATURE_LEN: usize = 96;

pub const SIGNATURE_DST: &[u8] = b"BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
pub const POP_DST: &[u8] = b"BLS_POP_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

/// A BLS public key that decodes to a valid, non-identity point in the G1 subgroup.
/// Not yet safe to aggregate: see [`BlsPublicKey::prove_possession`].
#[derive(Clone, PartialEq, Eq)]
pub struct BlsPublicKey {
    key: PublicKey,
}

impl BlsPublicKey {
    pub fn from_bytes(bytes: &[u8; PUBLIC_KEY_LEN]) -> Result<BlsPublicKey, AletheiaError> {
        // `key_validate` decompresses, rejects the identity and checks subgroup membership.
        // Passing exactly 48 bytes rules out blst's uncompressed form, keeping one encoding.
        PublicKey::key_validate(bytes)
            .map(|key| BlsPublicKey { key })
            .map_err(|error| {
                AletheiaError::new(
                    ErrorCode::KeyMalformed,
                    format!("BLS public key rejected: {}", describe(error)),
                )
            })
    }

    pub fn to_bytes(&self) -> [u8; PUBLIC_KEY_LEN] {
        self.key.compress()
    }

    /// Verifies a proof of possession and returns the key in its aggregatable form.
    pub fn prove_possession(
        self,
        network: &NetworkIdentity,
        proof: &BlsSignature,
    ) -> Result<ProvenBlsPublicKey, AletheiaError> {
        let message = pop_message(network, &self.to_bytes());
        match proof
            .signature
            .verify(true, message.as_bytes(), POP_DST, &[], &self.key, false)
        {
            BLST_ERROR::BLST_SUCCESS => Ok(ProvenBlsPublicKey { key: self.key }),
            error => Err(AletheiaError::new(
                ErrorCode::BlsPopInvalid,
                format!(
                    "proof of possession for BLS key {} does not verify: {}",
                    aletheia_core::base16::encode(&self.to_bytes()),
                    describe(error)
                ),
            )),
        }
    }

    /// Verifies a single signature over a 32-byte domain digest.
    pub fn verify(&self, digest: &Hash32, signature: &BlsSignature) -> Result<(), AletheiaError> {
        match signature.signature.verify(
            true,
            digest.as_bytes(),
            SIGNATURE_DST,
            &[],
            &self.key,
            false,
        ) {
            BLST_ERROR::BLST_SUCCESS => Ok(()),
            error => Err(AletheiaError::new(
                ErrorCode::SigInvalid,
                format!(
                    "BLS signature over digest {digest} does not verify: {}",
                    describe(error)
                ),
            )),
        }
    }
}

impl core::fmt::Debug for BlsPublicKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(
            f,
            "BlsPublicKey({})",
            aletheia_core::base16::encode(&self.to_bytes())
        )
    }
}

impl AceEncode for BlsPublicKey {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.to_bytes());
    }

    fn encoded_len_hint(&self) -> usize {
        PUBLIC_KEY_LEN
    }
}

impl AceDecode for BlsPublicKey {
    fn decode(input: &mut AceReader<'_>) -> Result<BlsPublicKey, AletheiaError> {
        BlsPublicKey::from_bytes(&input.array::<PUBLIC_KEY_LEN>()?)
    }
}

/// A BLS public key whose proof of possession has been verified. Only these may be
/// aggregated. Validator registration stores keys in this form after checking the proof.
#[derive(Clone, PartialEq, Eq)]
pub struct ProvenBlsPublicKey {
    key: PublicKey,
}

impl ProvenBlsPublicKey {
    pub fn to_bytes(&self) -> [u8; PUBLIC_KEY_LEN] {
        self.key.compress()
    }

    /// Verifies one signature over a digest (an individual vote or timeout).
    pub fn verify(&self, digest: &Hash32, signature: &BlsSignature) -> Result<(), AletheiaError> {
        BlsPublicKey { key: self.key }.verify(digest, signature)
    }
}

impl core::fmt::Debug for ProvenBlsPublicKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(
            f,
            "ProvenBlsPublicKey({})",
            aletheia_core::base16::encode(&self.to_bytes())
        )
    }
}

/// Verifies an aggregate signature by `signers` over one digest - the quorum-certificate
/// check of Section 19.3 step 3. Bitmap and quorum checks belong to the caller, which knows
/// the validator set; this function only does the cryptography.
pub fn verify_aggregate(
    signers: &[&ProvenBlsPublicKey],
    digest: &Hash32,
    aggregate: &BlsSignature,
) -> Result<(), AletheiaError> {
    if signers.is_empty() {
        return Err(AletheiaError::new(
            ErrorCode::BlsAggregateEmpty,
            format!("aggregate signature over digest {digest} has no signers"),
        ));
    }
    let keys: Vec<&PublicKey> = signers.iter().map(|signer| &signer.key).collect();
    match aggregate
        .signature
        .fast_aggregate_verify(true, digest.as_bytes(), SIGNATURE_DST, &keys)
    {
        BLST_ERROR::BLST_SUCCESS => Ok(()),
        error => Err(AletheiaError::new(
            ErrorCode::SigInvalid,
            format!(
                "aggregate BLS signature by {} signers over digest {digest} does not verify: {}",
                signers.len(),
                describe(error)
            ),
        )),
    }
}

/// Verifies an aggregate signature where signer `i` signed `digests[i]` - the timeout
/// certificate check, in which each validator signs its own highest QC round (ERRATA E-11).
/// Signers must be proof-of-possession verified, as for [`verify_aggregate`].
pub fn verify_aggregate_distinct(
    signers: &[&ProvenBlsPublicKey],
    digests: &[Hash32],
    aggregate: &BlsSignature,
) -> Result<(), AletheiaError> {
    if signers.is_empty() {
        return Err(AletheiaError::new(
            ErrorCode::BlsAggregateEmpty,
            "aggregate signature has no signers".to_owned(),
        ));
    }
    if signers.len() != digests.len() {
        return Err(AletheiaError::new(
            ErrorCode::SigMalformed,
            format!(
                "{} signers but {} signed messages",
                signers.len(),
                digests.len()
            ),
        ));
    }
    let keys: Vec<&PublicKey> = signers.iter().map(|signer| &signer.key).collect();
    let messages: Vec<&[u8]> = digests
        .iter()
        .map(|digest| &digest.as_bytes()[..])
        .collect();
    // Distinct messages are required by the scheme; identical digests from different signers
    // are still sound here because every key carries a verified proof of possession.
    match aggregate
        .signature
        .aggregate_verify(true, &messages, SIGNATURE_DST, &keys, false)
    {
        BLST_ERROR::BLST_SUCCESS => Ok(()),
        error => Err(AletheiaError::new(
            ErrorCode::SigInvalid,
            format!(
                "aggregate BLS signature over {} messages does not verify: {}",
                digests.len(),
                describe(error)
            ),
        )),
    }
}

/// Aggregates individual signatures. Each must already have been verified (Section 19.3:
/// "verify each vote before inclusion"); aggregation itself proves nothing.
pub fn aggregate_signatures(signatures: &[&BlsSignature]) -> Result<BlsSignature, AletheiaError> {
    let parts: Vec<&Signature> = signatures.iter().map(|s| &s.signature).collect();
    AggregateSignature::aggregate(&parts, true)
        .map(|aggregate| BlsSignature {
            signature: aggregate.to_signature(),
        })
        .map_err(|error| {
            let code = if signatures.is_empty() {
                ErrorCode::BlsAggregateEmpty
            } else {
                ErrorCode::SigMalformed
            };
            AletheiaError::new(
                code,
                format!("cannot aggregate BLS signatures: {}", describe(error)),
            )
        })
}

/// Sum of public keys, for caching per `(epoch, bitmap)` as Section 19.3 permits.
pub fn aggregate_public_keys(
    signers: &[&ProvenBlsPublicKey],
) -> Result<[u8; PUBLIC_KEY_LEN], AletheiaError> {
    let keys: Vec<&PublicKey> = signers.iter().map(|signer| &signer.key).collect();
    AggregatePublicKey::aggregate(&keys, false)
        .map(|aggregate| aggregate.to_public_key().compress())
        .map_err(|error| {
            AletheiaError::new(
                ErrorCode::BlsAggregateEmpty,
                format!(
                    "cannot aggregate {} BLS keys: {}",
                    signers.len(),
                    describe(error)
                ),
            )
        })
}

/// A BLS signature that decodes to a point in the G2 subgroup.
#[derive(Clone, PartialEq, Eq)]
pub struct BlsSignature {
    signature: Signature,
}

impl BlsSignature {
    pub fn from_bytes(bytes: &[u8; SIGNATURE_LEN]) -> Result<BlsSignature, AletheiaError> {
        Signature::sig_validate(bytes, true)
            .map(|signature| BlsSignature { signature })
            .map_err(|error| {
                AletheiaError::new(
                    ErrorCode::SigMalformed,
                    format!("BLS signature rejected: {}", describe(error)),
                )
            })
    }

    pub fn to_bytes(&self) -> [u8; SIGNATURE_LEN] {
        self.signature.compress()
    }
}

impl core::fmt::Debug for BlsSignature {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(
            f,
            "BlsSignature({})",
            aletheia_core::base16::encode(&self.to_bytes())
        )
    }
}

impl AceEncode for BlsSignature {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.to_bytes());
    }

    fn encoded_len_hint(&self) -> usize {
        SIGNATURE_LEN
    }
}

impl AceDecode for BlsSignature {
    fn decode(input: &mut AceReader<'_>) -> Result<BlsSignature, AletheiaError> {
        BlsSignature::from_bytes(&input.array::<SIGNATURE_LEN>()?)
    }
}

/// A BLS secret key. In production consensus keys live in an HSM behind aletheia-signer
/// (Section 19.2); this type exists for the signer's software backend, devnet and tests.
#[allow(
    missing_debug_implementations,
    reason = "secret key material must not be printable"
)]
pub struct BlsSecretKey {
    key: SecretKey,
}

impl BlsSecretKey {
    /// A fresh key from the operating system CSPRNG via IETF KeyGen.
    pub fn generate() -> Result<BlsSecretKey, AletheiaError> {
        let mut ikm = Secret::new([0u8; 32]);
        getrandom::fill(ikm.expose_mut()).map_err(|error| {
            AletheiaError::new(
                ErrorCode::KeyGenerationFailed,
                format!("operating system randomness unavailable: {error}"),
            )
        })?;
        BlsSecretKey::from_key_material(&ikm)
    }

    /// IETF KeyGen from at least 32 bytes of input key material.
    pub fn from_key_material(ikm: &Secret<[u8; 32]>) -> Result<BlsSecretKey, AletheiaError> {
        SecretKey::key_gen(ikm.expose(), &[])
            .map(|key| BlsSecretKey { key })
            .map_err(|error| {
                AletheiaError::new(
                    ErrorCode::KeyGenerationFailed,
                    format!("BLS key generation failed: {}", describe(error)),
                )
            })
    }

    /// Loads a 32-byte big-endian scalar (the IETF serialization).
    pub fn from_scalar_bytes(bytes: &Secret<[u8; 32]>) -> Result<BlsSecretKey, AletheiaError> {
        SecretKey::from_bytes(bytes.expose())
            .map(|key| BlsSecretKey { key })
            .map_err(|error| {
                AletheiaError::new(
                    ErrorCode::KeyMalformed,
                    format!("BLS secret scalar rejected: {}", describe(error)),
                )
            })
    }

    pub fn public_key(&self) -> BlsPublicKey {
        BlsPublicKey {
            key: self.key.sk_to_pk(),
        }
    }

    pub fn sign(&self, digest: &Hash32) -> BlsSignature {
        BlsSignature {
            signature: self.key.sign(digest.as_bytes(), SIGNATURE_DST, &[]),
        }
    }

    /// Proof of possession for this key on `network`, submitted at validator registration.
    pub fn prove_possession(&self, network: &NetworkIdentity) -> BlsSignature {
        let message = pop_message(network, &self.key.sk_to_pk().compress());
        BlsSignature {
            signature: self.key.sign(message.as_bytes(), POP_DST, &[]),
        }
    }
}

fn pop_message(network: &NetworkIdentity, public_key: &[u8; PUBLIC_KEY_LEN]) -> Hash32 {
    network.domain_hash(DomainTag::BlsProofOfPossession, public_key)
}

fn describe(error: BLST_ERROR) -> &'static str {
    match error {
        BLST_ERROR::BLST_SUCCESS => "success",
        BLST_ERROR::BLST_BAD_ENCODING => "bad encoding",
        BLST_ERROR::BLST_POINT_NOT_ON_CURVE => "point not on curve",
        BLST_ERROR::BLST_POINT_NOT_IN_GROUP => "point not in subgroup",
        BLST_ERROR::BLST_AGGR_TYPE_MISMATCH => "empty or mismatched aggregate",
        BLST_ERROR::BLST_VERIFY_FAIL => "verification failed",
        BLST_ERROR::BLST_PK_IS_INFINITY => "point at infinity",
        BLST_ERROR::BLST_BAD_SCALAR => "bad scalar",
    }
}
