//! Known-answer and strictness tests for the wrapped primitives (Section 17: "every wrapper
//! has known-answer tests from the upstream test vectors").

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use aletheia_core::{ChainId, ErrorCode, Hash32, NetworkIdentity, NetworkKind, base16};
use aletheia_crypto::bls::{self, BlsPublicKey, BlsSecretKey, BlsSignature};
use aletheia_crypto::{Ed25519PublicKey, Ed25519Signature, Ed25519SigningKey, Secret};
use ed25519_dalek::Verifier;

fn hex<const N: usize>(text: &str) -> [u8; N] {
    base16::decode_fixed::<N>(text).unwrap()
}

fn devnet() -> NetworkIdentity {
    NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
}

/// RFC 8032 Section 7.1, TEST 1 and TEST 2. Our wrapper signs 32-byte digests, so the KAT
/// drives the underlying key directly for the raw RFC messages and checks that our public key
/// derivation and strict verifier agree with the RFC's outputs.
#[test]
fn ed25519_rfc8032_vectors() {
    let vectors = [
        (
            "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
            "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
            "",
            "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
        ),
        (
            "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb",
            "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
            "72",
            "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
        ),
    ];
    for (seed, public, message, signature) in vectors {
        let ours = Ed25519SigningKey::from_seed(&Secret::new(hex::<32>(seed))).public_key();
        assert_eq!(base16::encode(&ours.to_bytes()), public);

        let dalek = ed25519_dalek::SigningKey::from_bytes(&hex::<32>(seed));
        let message = base16::decode(message).unwrap();
        let produced = ed25519_dalek::Signer::sign(&dalek, &message);
        assert_eq!(base16::encode(&produced.to_bytes()), signature);
        dalek.verifying_key().verify(&message, &produced).unwrap();
    }
}

#[test]
fn ed25519_sign_and_verify_over_a_digest() {
    let key = Ed25519SigningKey::from_seed(&Secret::new([3u8; 32]));
    let digest = Hash32::from_bytes([9u8; 32]);
    let signature = key.sign(&digest);
    key.public_key().verify(&digest, &signature).unwrap();
    let other = Hash32::from_bytes([8u8; 32]);
    assert_eq!(
        key.public_key()
            .verify(&other, &signature)
            .unwrap_err()
            .code(),
        ErrorCode::SigInvalid
    );
}

/// Adding the group order L to S yields the same point equation but a non-canonical encoding;
/// strict verification must refuse it (malleability defence, ADR-003).
#[test]
fn ed25519_non_canonical_s_is_refused() {
    const ORDER_L: [u8; 32] = [
        0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde,
        0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10,
    ];
    let key = Ed25519SigningKey::from_seed(&Secret::new([5u8; 32]));
    let digest = Hash32::from_bytes([1u8; 32]);
    let mut bytes = key.sign(&digest).to_bytes();
    let mut carry = 0u16;
    for (s_byte, l_byte) in bytes[32..].iter_mut().zip(ORDER_L) {
        let sum = u16::from(*s_byte) + u16::from(l_byte) + carry;
        *s_byte = sum.to_le_bytes()[0];
        carry = sum >> 8;
    }
    assert_eq!(carry, 0, "S + L must still fit in 32 bytes for this test");
    let malleated = Ed25519Signature::from_bytes(bytes);
    assert!(key.public_key().verify(&digest, &malleated).is_err());
}

#[test]
fn ed25519_small_order_and_invalid_keys_are_refused() {
    // The identity point (y = 1) has order 1.
    let mut identity = [0u8; 32];
    identity[0] = 1;
    assert_eq!(
        Ed25519PublicKey::from_bytes(&identity).unwrap_err().code(),
        ErrorCode::KeyWeak
    );
    // y = 2 is not the y-coordinate of any curve point.
    let mut off_curve = [0u8; 32];
    off_curve[0] = 2;
    assert_eq!(
        Ed25519PublicKey::from_bytes(&off_curve).unwrap_err().code(),
        ErrorCode::KeyMalformed
    );
}

/// Ethereum consensus-spec `sign` vector: same ciphersuite (min-pk, G2, `_POP_` DST), message
/// of 32 zero bytes.
#[test]
fn bls_consensus_spec_sign_vector() {
    let secret = BlsSecretKey::from_scalar_bytes(&Secret::new(hex::<32>(
        "263dbd792f5b1be47ed85f8938c0f29586af0d3ac7b977f21c278fe1462040e3",
    )))
    .unwrap();
    assert_eq!(
        base16::encode(&secret.public_key().to_bytes()),
        "a491d1b0ecd9bb917989f0e74f0dea0422eac4a873e5e2644f368dffb9a6e20fd6e10c1b77654d067c0618f6e5a7f79a"
    );
    let signature = secret.sign(&Hash32::ZERO);
    assert_eq!(
        base16::encode(&signature.to_bytes()),
        "b6ed936746e01f8ecf281f020953fbf1f01debd5657c4a383940b020b26507f6076334f91e2366c96e9ab279fb5158090352ea1c5b0c9274504f4f0e7053af24802e51e4568d164fe986834f41e55c8e850ce1f98458c0cfc9ab380b55285a55"
    );
    secret
        .public_key()
        .verify(&Hash32::ZERO, &signature)
        .unwrap();
}

#[test]
fn bls_proof_of_possession_is_network_bound() {
    let secret = BlsSecretKey::from_key_material(&Secret::new([11u8; 32])).unwrap();
    let proof = secret.prove_possession(&devnet());
    assert!(
        secret
            .public_key()
            .prove_possession(&devnet(), &proof)
            .is_ok()
    );

    let mainnet = NetworkIdentity::new(ChainId::new(7771), NetworkKind::Mainnet, Hash32::ZERO);
    let error = secret
        .public_key()
        .prove_possession(&mainnet, &proof)
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::BlsPopInvalid);

    // A vote signature is not a proof of possession: the DSTs differ.
    let vote = secret.sign(&devnet().domain_hash(
        aletheia_core::DomainTag::BlsProofOfPossession,
        &secret.public_key().to_bytes(),
    ));
    assert!(
        secret
            .public_key()
            .prove_possession(&devnet(), &vote)
            .is_err()
    );
}

#[test]
fn bls_quorum_aggregate_verifies_only_for_the_signing_set() {
    let digest = devnet().domain_hash(aletheia_core::DomainTag::Vote, b"round 7 block x epoch 1");
    let secrets: Vec<BlsSecretKey> = (1u8..=4)
        .map(|i| BlsSecretKey::from_key_material(&Secret::new([i; 32])).unwrap())
        .collect();
    let proven: Vec<_> = secrets
        .iter()
        .map(|s| {
            s.public_key()
                .prove_possession(&devnet(), &s.prove_possession(&devnet()))
                .unwrap()
        })
        .collect();
    let votes: Vec<BlsSignature> = secrets[..3].iter().map(|s| s.sign(&digest)).collect();
    let aggregate = bls::aggregate_signatures(&votes.iter().collect::<Vec<_>>()).unwrap();

    let signers: Vec<_> = proven[..3].iter().collect();
    bls::verify_aggregate(&signers, &digest, &aggregate).unwrap();

    let wrong_set: Vec<_> = proven[1..].iter().collect();
    assert_eq!(
        bls::verify_aggregate(&wrong_set, &digest, &aggregate)
            .unwrap_err()
            .code(),
        ErrorCode::SigInvalid
    );
    assert_eq!(
        bls::verify_aggregate(&[], &digest, &aggregate)
            .unwrap_err()
            .code(),
        ErrorCode::BlsAggregateEmpty
    );
    assert_eq!(
        bls::aggregate_signatures(&[]).unwrap_err().code(),
        ErrorCode::BlsAggregateEmpty
    );
}

#[test]
fn bls_encodings_are_validated() {
    // All-zero bytes are not a valid compressed point (the compression flag bit is unset).
    assert_eq!(
        BlsPublicKey::from_bytes(&[0u8; 48]).unwrap_err().code(),
        ErrorCode::KeyMalformed
    );
    assert_eq!(
        BlsSignature::from_bytes(&[0u8; 96]).unwrap_err().code(),
        ErrorCode::SigMalformed
    );
    // The compressed identity (0xc0 then zeros) is refused as a public key.
    let mut identity = [0u8; 48];
    identity[0] = 0xc0;
    assert_eq!(
        BlsPublicKey::from_bytes(&identity).unwrap_err().code(),
        ErrorCode::KeyMalformed
    );
}

#[test]
fn generated_keys_work() {
    let ed = Ed25519SigningKey::generate().unwrap();
    let digest = Hash32::from_bytes([2u8; 32]);
    ed.public_key().verify(&digest, &ed.sign(&digest)).unwrap();
    let bls_key = BlsSecretKey::generate().unwrap();
    bls_key
        .public_key()
        .verify(&digest, &bls_key.sign(&digest))
        .unwrap();
}
