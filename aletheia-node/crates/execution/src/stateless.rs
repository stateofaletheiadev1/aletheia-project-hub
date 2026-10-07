//! Stateless transaction validation (APS-0003, Appendix R.4).
//!
//! Checks run in the order Section 13 fixes, and the first failure decides the error code:
//!
//! 1. size, before any decoding (`TxTooLarge`);
//! 2. canonical decode (`Decode*`);
//! 3. body version supported (`TxVersionUnsupported`);
//! 4. chain and network (`TxWrongChain`, `TxWrongNetwork`);
//! 5. type active at the protocol version (`TxTypeNotActive`);
//! 6. field ranges (`TxFieldOutOfRange`);
//! 7. validity window well formed (`TxValidityWindowInvalid`);
//! 8. authorization scheme and threshold (`TxAuthMalformed`, `TxThresholdNotMet`);
//! 9. strict signature verification (`KeyMalformed`, `KeyWeak`, `SigInvalid`).
//!
//! Signatures come last because they are the expensive check: a flood of oversized or
//! wrong-network transactions is turned away before any curve arithmetic. Nothing here reads
//! state or the clock, so every validator reaches the same verdict on the same bytes.

use aletheia_core::{
    AceDecode, AletheiaError, AuthScheme, Authorization, ErrorCode, Hash32, NetworkIdentity,
    Payload, SignedTransaction, TransactionBody, TransferLeg, TxId,
};
use aletheia_crypto::{Ed25519PublicKey, Ed25519Signature, SignatureAlgorithm};

use crate::rules::Rules;

/// A transaction that passed every stateless check under one network and rule set.
///
/// Only [`StatelessValidator::validate`] constructs it, so holding one is evidence the checks
/// ran. Stateful checks (nonce, balance, key commitment, slot window) still follow.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiedTransaction {
    transaction: SignedTransaction,
    tx_id: TxId,
    witness_hash: Hash32,
    encoded_len: usize,
}

impl VerifiedTransaction {
    pub fn transaction(&self) -> &SignedTransaction {
        &self.transaction
    }

    pub fn tx_id(&self) -> TxId {
        self.tx_id
    }

    pub fn witness_hash(&self) -> Hash32 {
        self.witness_hash
    }

    pub fn encoded_len(&self) -> usize {
        self.encoded_len
    }
}

#[derive(Debug, Clone, Copy)]
pub struct StatelessValidator {
    network: NetworkIdentity,
    rules: Rules,
}

impl StatelessValidator {
    pub fn new(network: NetworkIdentity, rules: Rules) -> StatelessValidator {
        StatelessValidator { network, rules }
    }

    pub fn validate(&self, bytes: &[u8]) -> Result<VerifiedTransaction, AletheiaError> {
        let limits = self.rules.tx_limits();
        if bytes.len() > limits.max_tx_bytes {
            return Err(reject(
                ErrorCode::TxTooLarge,
                format!(
                    "transaction is {} bytes; limit is {}",
                    bytes.len(),
                    limits.max_tx_bytes
                ),
            ));
        }

        let transaction = SignedTransaction::from_ace_bytes(bytes)?;
        let body = &transaction.body;

        if !limits.body_versions.contains(&body.version) {
            return Err(reject(
                ErrorCode::TxVersionUnsupported,
                format!(
                    "body version {} is not accepted at protocol version {}",
                    body.version,
                    self.rules.version()
                ),
            ));
        }
        if body.chain_id != self.network.chain_id() {
            return Err(reject(
                ErrorCode::TxWrongChain,
                format!(
                    "transaction is for chain {}; this is chain {}",
                    body.chain_id,
                    self.network.chain_id()
                ),
            ));
        }
        if body.network_kind != self.network.network_kind() {
            return Err(reject(
                ErrorCode::TxWrongNetwork,
                format!(
                    "transaction is for {}; this is {}",
                    body.network_kind,
                    self.network.network_kind()
                ),
            ));
        }
        if !self.rules.tx_type_active(body.tx_type()) {
            return Err(reject(
                ErrorCode::TxTypeNotActive,
                format!(
                    "transaction type {} is not active at protocol version {}",
                    body.tx_type(),
                    self.rules.version()
                ),
            ));
        }
        check_field_ranges(body, limits.fee_assets)?;
        check_validity_window(body, limits.max_validity_slots)?;
        check_authorization_shape(&transaction.authorization)?;
        verify_signatures(
            &transaction.authorization,
            &body.signing_digest(&self.network),
        )?;

        Ok(VerifiedTransaction {
            tx_id: body.tx_id(&self.network),
            witness_hash: transaction.witness_hash(&self.network),
            encoded_len: bytes.len(),
            transaction,
        })
    }
}

fn reject(code: ErrorCode, detail: String) -> AletheiaError {
    AletheiaError::new(code, detail)
}

fn check_field_ranges(
    body: &TransactionBody,
    fee_assets: &[aletheia_core::AssetId],
) -> Result<(), AletheiaError> {
    if !fee_assets.contains(&body.fee.fee_asset) {
        return Err(reject(
            ErrorCode::TxFieldOutOfRange,
            format!("asset {} cannot pay fees", body.fee.fee_asset),
        ));
    }
    if body.fee.eu_limit == 0 {
        return Err(reject(
            ErrorCode::TxFieldOutOfRange,
            "eu_limit is 0".to_owned(),
        ));
    }
    let zero = |what: &str| {
        Err(reject(
            ErrorCode::TxFieldOutOfRange,
            format!("{what} moves 0 units"),
        ))
    };
    let legs: &[TransferLeg] = match &body.payload {
        Payload::Transfer(leg) => core::slice::from_ref(leg),
        Payload::BatchTransfer(legs) => legs,
        Payload::Mint(authorization) => {
            return if authorization.amount == 0 {
                zero("mint")
            } else {
                Ok(())
            };
        }
        Payload::Burn(amount) | Payload::Lock(amount) | Payload::Unlock(amount) => {
            return if amount.amount == 0 {
                zero("monetary operation")
            } else {
                Ok(())
            };
        }
        Payload::Redeem(redemption) => {
            return if redemption.amount == 0 {
                zero("redemption")
            } else {
                Ok(())
            };
        }
        Payload::ReserveAttestation(_) => return Ok(()),
        #[cfg(feature = "test-protocol-v2")]
        Payload::TestRemark(_) => return Ok(()),
    };
    if legs.is_empty() {
        return Err(reject(
            ErrorCode::TxFieldOutOfRange,
            "batch transfer has no legs".to_owned(),
        ));
    }
    if let Some(index) = legs.iter().position(|leg| leg.amount == 0) {
        return Err(reject(
            ErrorCode::TxFieldOutOfRange,
            format!("transfer leg {index} moves 0 units"),
        ));
    }
    Ok(())
}

fn check_validity_window(body: &TransactionBody, max_slots: u64) -> Result<(), AletheiaError> {
    let span = body
        .expiry_slot
        .get()
        .checked_sub(body.valid_from_slot.get())
        .ok_or_else(|| {
            reject(
                ErrorCode::TxValidityWindowInvalid,
                format!(
                    "expiry slot {} precedes valid-from slot {}",
                    body.expiry_slot, body.valid_from_slot
                ),
            )
        })?;
    if span > max_slots {
        return Err(reject(
            ErrorCode::TxValidityWindowInvalid,
            format!("validity window of {span} slots exceeds {max_slots}"),
        ));
    }
    Ok(())
}

/// Scheme, threshold, key and signature counts fit together (ADR-044). The signature count
/// must equal the threshold exactly: extra signatures would change the witness hash without
/// changing the intent, which is malleability for no benefit.
fn check_authorization_shape(authorization: &Authorization) -> Result<(), AletheiaError> {
    let keys = authorization.public_keys.len();
    let threshold = usize::from(authorization.threshold);
    let malformed = |detail: String| reject(ErrorCode::TxAuthMalformed, detail);
    match authorization.scheme {
        AuthScheme::Ed25519 if keys != 1 || threshold != 1 => {
            return Err(malformed(format!(
                "Ed25519 authorization has {keys} keys and threshold {threshold}; both must be 1"
            )));
        }
        AuthScheme::MultiEd25519 if keys < 2 => {
            return Err(malformed(format!(
                "multisig authorization has {keys} keys; at least 2 are required"
            )));
        }
        AuthScheme::MultiEd25519 if threshold == 0 || threshold > keys => {
            return Err(malformed(format!(
                "multisig threshold {threshold} is outside 1..={keys}"
            )));
        }
        _ => {}
    }
    if let Some(entry) = authorization
        .public_keys
        .iter()
        .find(|entry| entry.alg_id != SignatureAlgorithm::Ed25519.code())
    {
        return Err(malformed(format!(
            "key algorithm {} is not allowed for account authorization",
            entry.alg_id
        )));
    }
    if authorization.signatures.len() != threshold {
        return Err(reject(
            ErrorCode::TxThresholdNotMet,
            format!(
                "{} signatures for threshold {threshold}",
                authorization.signatures.len()
            ),
        ));
    }
    for signature in &authorization.signatures {
        let index = usize::from(signature.signer_index);
        let key = authorization.public_keys.get(index).ok_or_else(|| {
            malformed(format!(
                "signer index {index} has no key (authorization has {keys})"
            ))
        })?;
        if signature.alg_id != key.alg_id {
            return Err(malformed(format!(
                "signature by key {index} claims algorithm {}, key is algorithm {}",
                signature.alg_id, key.alg_id
            )));
        }
    }
    Ok(())
}

fn verify_signatures(authorization: &Authorization, digest: &Hash32) -> Result<(), AletheiaError> {
    for signature in &authorization.signatures {
        let key = authorization
            .public_keys
            .get(usize::from(signature.signer_index))
            .ok_or_else(|| {
                reject(
                    ErrorCode::TxAuthMalformed,
                    "signer index has no key".to_owned(),
                )
            })?;
        let key_bytes = <[u8; 32]>::try_from(key.key.as_slice()).map_err(|_| {
            reject(
                ErrorCode::KeyMalformed,
                format!("Ed25519 key is {} bytes, expected 32", key.key.len()),
            )
        })?;
        let signature_bytes =
            <[u8; 64]>::try_from(signature.signature.as_slice()).map_err(|_| {
                reject(
                    ErrorCode::SigMalformed,
                    format!(
                        "Ed25519 signature is {} bytes, expected 64",
                        signature.signature.len()
                    ),
                )
            })?;
        Ed25519PublicKey::from_bytes(&key_bytes)?
            .verify(digest, &Ed25519Signature::from_bytes(signature_bytes))?;
    }
    Ok(())
}
