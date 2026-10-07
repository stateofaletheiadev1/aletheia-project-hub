//! Algorithm identifiers for cryptographic agility (APS-0037, ADR-039).
//!
//! Every public key and signature in a protocol object carries one of these bytes, and each
//! protocol version names the set it accepts. Zero is never valid, so zeroed memory cannot be
//! mistaken for a real algorithm tag.

use aletheia_core::{AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum SignatureAlgorithm {
    /// Ed25519 with strict RFC 8032 verification (ADR-003). Account and node-identity keys.
    Ed25519,
    /// BLS12-381 min-pk, ciphersuite `BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_` (ADR-004).
    /// Consensus keys.
    Bls12381MinPk,
}

impl SignatureAlgorithm {
    /// Reserved for ML-DSA accounts (address type 4). Decoding it fails until a protocol
    /// version activates it.
    pub const RESERVED_ML_DSA: u8 = 3;

    pub const fn code(self) -> u8 {
        match self {
            SignatureAlgorithm::Ed25519 => 1,
            SignatureAlgorithm::Bls12381MinPk => 2,
        }
    }

    pub fn from_code(code: u8) -> Result<SignatureAlgorithm, AletheiaError> {
        match code {
            1 => Ok(SignatureAlgorithm::Ed25519),
            2 => Ok(SignatureAlgorithm::Bls12381MinPk),
            other => Err(AletheiaError::new(
                ErrorCode::CryptoAlgorithmUnsupported,
                format!("signature algorithm {other} is not supported (expected 1 or 2)"),
            )),
        }
    }
}

impl AceEncode for SignatureAlgorithm {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.code());
    }

    fn encoded_len_hint(&self) -> usize {
        1
    }
}

impl AceDecode for SignatureAlgorithm {
    fn decode(input: &mut AceReader<'_>) -> Result<SignatureAlgorithm, AletheiaError> {
        let offset = input.position();
        let code = input.u8()?;
        SignatureAlgorithm::from_code(code).map_err(|error| {
            AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!("at offset {offset}: {}", error.detail()),
            )
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_stable_and_zero_is_invalid() {
        assert_eq!(SignatureAlgorithm::Ed25519.code(), 1);
        assert_eq!(SignatureAlgorithm::Bls12381MinPk.code(), 2);
        for code in [0, SignatureAlgorithm::RESERVED_ML_DSA, 255] {
            let error = SignatureAlgorithm::from_code(code).unwrap_err();
            assert_eq!(error.code(), ErrorCode::CryptoAlgorithmUnsupported);
        }
        assert_eq!(
            SignatureAlgorithm::from_ace_bytes(&[0]).unwrap_err().code(),
            ErrorCode::DecodeNonCanonical
        );
    }
}
