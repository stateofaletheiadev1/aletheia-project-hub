//! Stateless validation with real keys: one test per rejection step, in Section 13 order.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use aletheia_core::tx::TX_BODY_VERSION_1;
use aletheia_core::{
    AceEncode, Address, AddressType, AssetId, AuthScheme, Authorization, ChainId, ErrorCode, Fee,
    Hash32, NetworkIdentity, NetworkKind, Payload, PublicKeyEntry, SignatureEntry,
    SignedTransaction, Slot, TransactionBody, TransferLeg, TxType,
};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use aletheia_execution::{Rules, StatelessValidator};

fn network() -> NetworkIdentity {
    NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO)
}

fn validator() -> StatelessValidator {
    StatelessValidator::new(network(), Rules::V1)
}

fn key(seed: u8) -> Ed25519SigningKey {
    Ed25519SigningKey::from_seed(&Secret::new([seed; 32]))
}

fn body() -> TransactionBody {
    TransactionBody {
        version: TX_BODY_VERSION_1,
        chain_id: ChainId::new(7771),
        network_kind: NetworkKind::Devnet,
        sender: aletheia_crypto::address::ed25519_account(&network(), &key(1).public_key()),
        nonce: 0,
        fee: Fee {
            fee_asset: AssetId::AEY,
            max_fee: 1_000_000,
            eu_limit: 5_000,
        },
        valid_from_slot: Slot::new(10),
        expiry_slot: Slot::new(100),
        memo: Vec::new(),
        payload: Payload::Transfer(TransferLeg {
            recipient: Address::new(AddressType::Ed25519Account, Hash32::from_bytes([2; 32])),
            asset: AssetId::AEY,
            amount: 5,
        }),
    }
}

/// Signs with the given keys; `signers` are indices into the sorted key list.
fn sign(
    body: TransactionBody,
    scheme: AuthScheme,
    threshold: u8,
    keys: &[Ed25519SigningKey],
    signers: &[u8],
) -> SignedTransaction {
    let mut entries: Vec<(PublicKeyEntry, &Ed25519SigningKey)> = keys
        .iter()
        .map(|k| {
            (
                PublicKeyEntry {
                    alg_id: 1,
                    key: k.public_key().to_bytes().to_vec(),
                },
                k,
            )
        })
        .collect();
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    let digest = body.signing_digest(&network());
    let signatures = signers
        .iter()
        .map(|&index| SignatureEntry {
            signer_index: index,
            alg_id: 1,
            signature: entries[usize::from(index)]
                .1
                .sign(&digest)
                .to_bytes()
                .to_vec(),
        })
        .collect();
    SignedTransaction {
        body,
        authorization: Authorization {
            scheme,
            threshold,
            public_keys: entries.into_iter().map(|(entry, _)| entry).collect(),
            signatures,
        },
    }
}

fn single(body: TransactionBody) -> SignedTransaction {
    sign(body, AuthScheme::Ed25519, 1, &[key(1)], &[0])
}

fn rejection(tx: &SignedTransaction) -> ErrorCode {
    validator().validate(&tx.to_ace_bytes()).unwrap_err().code()
}

#[test]
fn a_well_formed_transfer_is_accepted() {
    let tx = single(body());
    let verified = validator().validate(&tx.to_ace_bytes()).unwrap();
    assert_eq!(verified.tx_id(), tx.body.tx_id(&network()));
    assert_eq!(verified.witness_hash(), tx.witness_hash(&network()));
    assert_eq!(verified.transaction(), &tx);
}

#[test]
fn step_1_oversized_input_is_refused_before_decoding() {
    let error = validator().validate(&vec![0u8; 64 * 1024 + 1]).unwrap_err();
    assert_eq!(error.code(), ErrorCode::TxTooLarge);
}

#[test]
fn step_2_non_canonical_bytes_are_refused() {
    let mut bytes = single(body()).to_ace_bytes();
    bytes.push(0);
    assert_eq!(
        validator().validate(&bytes).unwrap_err().code(),
        ErrorCode::DecodeTrailingBytes
    );
}

#[test]
fn step_3_unknown_body_version_is_refused() {
    let mut b = body();
    b.version = 2;
    assert_eq!(rejection(&single(b)), ErrorCode::TxVersionUnsupported);
}

#[test]
fn step_4_other_chain_and_network_are_refused() {
    let mut b = body();
    b.chain_id = ChainId::new(1);
    assert_eq!(rejection(&single(b)), ErrorCode::TxWrongChain);
    let mut b = body();
    b.network_kind = NetworkKind::Mainnet;
    assert_eq!(rejection(&single(b)), ErrorCode::TxWrongNetwork);
}

/// Every type this binary can decode is active at version 1, so the validator's
/// `TxTypeNotActive` branch is unreachable until a type with a layout ships inactive (the
/// Phase 3 test-only V2 rule set). Until then the rule table itself is checked.
#[test]
fn step_5_rule_table_lists_only_active_types() {
    assert!(Rules::V1.tx_type_active(TxType::TRANSFER));
    assert!(!Rules::V1.tx_type_active(TxType::new(16)));
}

#[test]
fn step_6_out_of_range_fields_are_refused() {
    let mut b = body();
    b.fee.fee_asset = AssetId::new(1003);
    assert_eq!(rejection(&single(b)), ErrorCode::TxFieldOutOfRange);
    let mut b = body();
    b.fee.eu_limit = 0;
    assert_eq!(rejection(&single(b)), ErrorCode::TxFieldOutOfRange);
    let mut b = body();
    b.payload = Payload::BatchTransfer(Vec::new());
    assert_eq!(rejection(&single(b)), ErrorCode::TxFieldOutOfRange);
    let mut b = body();
    if let Payload::Transfer(leg) = &mut b.payload {
        leg.amount = 0;
    }
    assert_eq!(rejection(&single(b)), ErrorCode::TxFieldOutOfRange);
}

#[test]
fn step_7_bad_validity_windows_are_refused() {
    let mut b = body();
    b.expiry_slot = Slot::new(9);
    assert_eq!(rejection(&single(b)), ErrorCode::TxValidityWindowInvalid);
    let mut b = body();
    b.expiry_slot = Slot::new(10 + 7_201);
    assert_eq!(rejection(&single(b)), ErrorCode::TxValidityWindowInvalid);
    let mut b = body();
    b.expiry_slot = Slot::new(10 + 7_200);
    assert!(
        validator().validate(&single(b).to_ace_bytes()).is_ok(),
        "exactly the maximum is allowed"
    );
}

#[test]
fn step_8_authorization_shape_is_checked() {
    let tx = sign(body(), AuthScheme::Ed25519, 1, &[key(1), key(2)], &[0]);
    assert_eq!(rejection(&tx), ErrorCode::TxAuthMalformed);
    let tx = sign(
        body(),
        AuthScheme::MultiEd25519,
        3,
        &[key(1), key(2)],
        &[0, 1],
    );
    assert_eq!(rejection(&tx), ErrorCode::TxAuthMalformed);
    let tx = sign(
        body(),
        AuthScheme::MultiEd25519,
        2,
        &[key(1), key(2), key(3)],
        &[0],
    );
    assert_eq!(rejection(&tx), ErrorCode::TxThresholdNotMet);
    let tx = sign(
        body(),
        AuthScheme::MultiEd25519,
        2,
        &[key(1), key(2), key(3)],
        &[0, 1, 2],
    );
    assert_eq!(
        rejection(&tx),
        ErrorCode::TxThresholdNotMet,
        "extra signatures are malleability"
    );
}

#[test]
fn step_9_signatures_must_verify() {
    let mut tx = single(body());
    tx.authorization.signatures[0].signature[0] ^= 1;
    assert_eq!(rejection(&tx), ErrorCode::SigInvalid);

    // A signature over a different network's digest fails here, not earlier.
    let mut tx = single(body());
    let mainnet = NetworkIdentity::new(ChainId::new(7771), NetworkKind::Mainnet, Hash32::ZERO);
    tx.authorization.signatures[0].signature = key(1)
        .sign(&tx.body.signing_digest(&mainnet))
        .to_bytes()
        .to_vec();
    assert_eq!(rejection(&tx), ErrorCode::SigInvalid);
}

#[test]
fn two_of_three_multisig_is_accepted() {
    let tx = sign(
        body(),
        AuthScheme::MultiEd25519,
        2,
        &[key(1), key(2), key(3)],
        &[0, 2],
    );
    assert!(validator().validate(&tx.to_ace_bytes()).is_ok());
}

#[test]
fn earlier_failures_win_over_later_ones() {
    // Wrong chain and a broken signature: the chain check comes first.
    let mut b = body();
    b.chain_id = ChainId::new(1);
    let mut tx = single(b);
    tx.authorization.signatures[0].signature[0] ^= 1;
    assert_eq!(rejection(&tx), ErrorCode::TxWrongChain);
}
