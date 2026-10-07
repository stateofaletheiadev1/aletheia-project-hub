//! Builders for the published conformance vectors (spec Section 8 item 9, Section 54).
//!
//! Every value is derived from fixed inputs - seeds, chain id 7771, the four network kinds -
//! so any implementation can reproduce the files byte for byte. Hex is unprefixed lowercase
//! base16 (APS-0048); errors are listed by their stable APS-0038 name.

use aletheia_core::tx::TX_BODY_VERSION_1;
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, Address, AddressType, AletheiaError, AssetId,
    AuthScheme, Authorization, BlockHeader, BlockId, ChainId, DomainTag, Epoch, Fee, Hash32,
    Height, NetworkIdentity, NetworkKind, Payload, ProtocolVersion, PublicKeyEntry,
    QuorumCertificate, SignatureEntry, SignedTransaction, Slot, TransactionBody, TransferLeg, TxId,
    ValidatorIndex, base16,
};
use aletheia_crypto::{BlsSecretKey, Ed25519SigningKey, Secret, merkle};
use aletheia_execution::{Rules, StatelessValidator};
use serde_json::{Value, json};

pub const CHAIN_ID: u32 = 7771;

pub fn network(kind: NetworkKind) -> NetworkIdentity {
    NetworkIdentity::new(ChainId::new(CHAIN_ID), kind, Hash32::ZERO)
}

fn devnet() -> NetworkIdentity {
    network(NetworkKind::Devnet)
}

fn error_name<T>(result: Result<T, AletheiaError>) -> &'static str {
    match result {
        Ok(_) => "ACCEPTED",
        Err(error) => error.code().name(),
    }
}

/// A fixed 32-byte pattern: byte `i` is `seed + 7 * i` (mod 256).
fn pattern(seed: u8) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    let mut value = seed;
    for byte in &mut bytes {
        *byte = value;
        value = value.wrapping_add(7);
    }
    bytes
}

/// Every published vector file: (path under `tests/vectors/`, contents).
pub fn all() -> Vec<(&'static str, Value)> {
    vec![
        ("APS-0001/domain-hash.json", domain_hash()),
        ("APS-0002/addresses.json", addresses()),
        ("APS-0002/identifiers.json", identifiers()),
        ("APS-0003/transactions.json", transactions()),
        ("APS-0004/block-header.json", block_header()),
        ("APS-0006/list-merkle.json", list_merkle()),
        (
            "APS-0009/bls-proof-of-possession.json",
            bls_proof_of_possession(),
        ),
        ("APS-0041/canonical-encoding.json", canonical_encoding()),
        ("APS-0048/base16.json", base16_text()),
    ]
}

fn domain_hash() -> Value {
    let mut cases = Vec::new();
    for kind in NetworkKind::ALL {
        for (tag, message) in [
            (DomainTag::TxId, &b""[..]),
            (DomainTag::Block, b"aletheia"),
            (DomainTag::Address, &[0u8, 1, 2, 3]),
        ] {
            cases.push(json!({
                "chain_id": CHAIN_ID,
                "network_kind": kind.code(),
                "tag": tag.as_str(),
                "message": base16::encode(message),
                "hash": network(kind).domain_hash(tag, message).to_string(),
            }));
        }
    }
    json!({
        "aps": "APS-0001",
        "description": "H_domain(tag, msg) = BLAKE3(u8(len(tag)) || tag || u32_le(chain_id) || u8(network_kind) || msg)",
        "cases": cases,
    })
}

fn addresses() -> Value {
    let mut valid = Vec::new();
    for kind in NetworkKind::ALL {
        for (address_type, seed) in [
            (AddressType::Ed25519Account, 1),
            (AddressType::MultisigAccount, 2),
            (AddressType::Contract, 3),
            (AddressType::NativeModule, 4),
        ] {
            let address = Address::new(address_type, Hash32::from_bytes(pattern(seed)));
            valid.push(json!({
                "network_kind": kind.code(),
                "payload": base16::encode(&address.to_bytes()),
                "text": address.to_text(kind),
            }));
        }
    }
    let sample = Address::new(AddressType::Ed25519Account, Hash32::from_bytes(pattern(1)));
    let mainnet_text = sample.to_text(NetworkKind::Mainnet);
    let invalid_inputs = [
        (
            "other network",
            sample.to_text(NetworkKind::PrivateValidation),
        ),
        (
            "uppercase data",
            format!("AL:{}", mainnet_text[3..].to_uppercase()),
        ),
        ("lowercase prefix", format!("al:{}", &mainnet_text[3..])),
        ("too short", mainnet_text[..61].to_owned()),
        (
            "checksum altered",
            format!(
                "{}{}",
                &mainnet_text[..61],
                if mainnet_text.ends_with('q') {
                    'p'
                } else {
                    'q'
                }
            ),
        ),
        (
            "character outside charset",
            format!("{}b{}", &mainnet_text[..10], &mainnet_text[11..]),
        ),
    ];
    let invalid: Vec<Value> = invalid_inputs
        .iter()
        .map(|(reason, text)| {
            json!({
                "reason": reason,
                "network_kind": NetworkKind::Mainnet.code(),
                "text": text,
                "error": error_name(Address::parse(text, NetworkKind::Mainnet)),
            })
        })
        .collect();
    let derived_key = Ed25519SigningKey::from_seed(&Secret::new(pattern(9))).public_key();
    json!({
        "aps": "APS-0002",
        "description": "AL: addresses: 33-byte payload, Bech32m with the network HRP implied (al, alt, ald, alr), 62 characters",
        "valid": valid,
        "invalid": invalid,
        "derivation": [{
            "kind": "ed25519 account",
            "network_kind": NetworkKind::Devnet.code(),
            "chain_id": CHAIN_ID,
            "public_key": base16::encode(&derived_key.to_bytes()),
            "text": aletheia_crypto::address::ed25519_account(&devnet(), &derived_key).to_text(NetworkKind::Devnet),
        }],
    })
}

fn identifiers() -> Value {
    let mut cases = Vec::new();
    for kind in NetworkKind::ALL {
        let hash = Hash32::from_bytes(pattern(5));
        cases.push(json!({
            "network_kind": kind.code(),
            "hash": hash.to_string(),
            "tx_id": TxId::from_hash(hash).to_text(kind),
            "block_id": BlockId::from_hash(hash).to_text(kind),
        }));
    }
    json!({
        "aps": "APS-0002",
        "description": "AL:T transaction ids and AL:B block ids: 32-byte hash, Bech32m with HRP = network HRP + t / b, 62 characters",
        "cases": cases,
    })
}

fn sample_body(sender: Address) -> TransactionBody {
    TransactionBody {
        version: TX_BODY_VERSION_1,
        chain_id: ChainId::new(CHAIN_ID),
        network_kind: NetworkKind::Devnet,
        sender,
        nonce: 0,
        fee: Fee {
            fee_asset: AssetId::AEY,
            max_fee: 2_100_000_000_000_000,
            eu_limit: 5_000,
        },
        valid_from_slot: Slot::new(1_000),
        expiry_slot: Slot::new(8_200),
        memo: b"vector 1".to_vec(),
        payload: Payload::Transfer(TransferLeg {
            recipient: Address::new(AddressType::Ed25519Account, Hash32::from_bytes(pattern(2))),
            asset: AssetId::AEY,
            amount: 125_000_000_000_000_000_000,
        }),
    }
}

fn signed_single(body: TransactionBody, key: &Ed25519SigningKey) -> SignedTransaction {
    let signature = key.sign(&body.signing_digest(&devnet()));
    SignedTransaction {
        body,
        authorization: Authorization {
            scheme: AuthScheme::Ed25519,
            threshold: 1,
            public_keys: vec![PublicKeyEntry {
                alg_id: 1,
                key: key.public_key().to_bytes().to_vec(),
            }],
            signatures: vec![SignatureEntry {
                signer_index: 0,
                alg_id: 1,
                signature: signature.to_bytes().to_vec(),
            }],
        },
    }
}

fn transactions() -> Value {
    let key = Ed25519SigningKey::from_seed(&Secret::new(pattern(9)));
    let sender = aletheia_crypto::address::ed25519_account(&devnet(), &key.public_key());
    let tx = signed_single(sample_body(sender), &key);
    let validator = StatelessValidator::new(devnet(), Rules::V1);

    let mut wrong_chain = sample_body(sender);
    wrong_chain.chain_id = ChainId::new(1);
    let mut long_window = sample_body(sender);
    long_window.expiry_slot = Slot::new(1_000 + 7_201);
    let mut tampered = tx.clone();
    if let Some(memo_byte) = tampered.body.memo.first_mut() {
        *memo_byte ^= 1;
    }
    let mut trailing = tx.to_ace_bytes();
    trailing.push(0);

    let rejections: Vec<Value> = [
        ("trailing byte", trailing),
        (
            "wrong chain",
            signed_single(wrong_chain, &key).to_ace_bytes(),
        ),
        (
            "validity window over 7200 slots",
            signed_single(long_window, &key).to_ace_bytes(),
        ),
        ("body changed after signing", tampered.to_ace_bytes()),
    ]
    .into_iter()
    .map(|(reason, bytes)| {
        json!({
            "reason": reason,
            "bytes": base16::encode(&bytes),
            "error": error_name(validator.validate(&bytes)),
        })
    })
    .collect();

    json!({
        "aps": "APS-0003",
        "description": "Signed Ed25519 transfer on devnet (chain 7771); key seed is the 32-byte pattern starting 09 with step 7",
        "network": { "chain_id": CHAIN_ID, "network_kind": NetworkKind::Devnet.code() },
        "accepted": [{
            "signing_seed": base16::encode(&pattern(9)),
            "body": base16::encode(&tx.body.to_ace_bytes()),
            "signed": base16::encode(&tx.to_ace_bytes()),
            "tx_id": tx.body.tx_id(&devnet()).to_text(NetworkKind::Devnet),
            "signing_digest": tx.body.signing_digest(&devnet()).to_string(),
            "witness_hash": tx.witness_hash(&devnet()).to_string(),
        }],
        "rejected": rejections,
    })
}

fn block_header() -> Value {
    let header = BlockHeader {
        version: ProtocolVersion::new(1),
        chain_id: ChainId::new(CHAIN_ID),
        height: Height::new(1),
        epoch: Epoch::new(0),
        slot: Slot::new(1),
        protocol_time_ms: 1_791_331_200_500,
        proposer: ValidatorIndex::new(0),
        parent_hash: Hash32::from_bytes(pattern(10)),
        parent_qc: QuorumCertificate::genesis(),
        timeout_cert: None,
        tx_root: merkle::root::<&[u8]>(&devnet(), &[]),
        receipt_root: merkle::root::<&[u8]>(&devnet(), &[]),
        state_root: Hash32::from_bytes(pattern(11)),
        event_root: merkle::root::<&[u8]>(&devnet(), &[]),
        validator_set_hash: Hash32::from_bytes(pattern(12)),
        next_validator_set_hash: Hash32::from_bytes(pattern(12)),
        monetary_root: Hash32::from_bytes(pattern(13)),
        eu_used: 0,
        tx_count: 0,
        extensions: Vec::new(),
    };
    json!({
        "aps": "APS-0004",
        "description": "Block header at height 1 with the genesis parent QC and empty list roots; block_hash = H_domain(\"ALETHEIA/BLOCK/v1\", ace(header))",
        "cases": [{
            "network": { "chain_id": CHAIN_ID, "network_kind": NetworkKind::Devnet.code() },
            "header": base16::encode(&header.to_ace_bytes()),
            "block_hash": header.block_hash(&devnet()).to_string(),
            "block_id": header.block_id(&devnet()).to_text(NetworkKind::Devnet),
        }],
    })
}

fn list_merkle() -> Value {
    let cases: Vec<Value> = (0u8..=5)
        .map(|count| {
            let items: Vec<Vec<u8>> = (0..count).map(|i| vec![i]).collect();
            json!({
                "items": items.iter().map(|item| base16::encode(item)).collect::<Vec<_>>(),
                "root": merkle::root(&devnet(), &items).to_string(),
            })
        })
        .collect();
    json!({
        "aps": "APS-0006",
        "description": "List Merkle roots on devnet (chain 7771): leaf and node domains, odd node promoted, empty root = leaf hash of nothing",
        "cases": cases,
    })
}

fn bls_proof_of_possession() -> Value {
    let key = BlsSecretKey::from_key_material(&Secret::new(pattern(20)))
        .expect("fixed key material is valid");
    let proof = key.prove_possession(&devnet());
    let digest = QuorumCertificate::vote_digest(
        &devnet(),
        Slot::new(7),
        &Hash32::from_bytes(pattern(14)),
        Epoch::new(1),
    );
    json!({
        "aps": "APS-0009",
        "description": "BLS12-381 min-pk; key from IETF KeyGen over the 32-byte pattern starting 14 (hex) with step 7; PoP over H_domain(\"ALETHEIA/BLS-POP/v1\", pk)",
        "cases": [{
            "network": { "chain_id": CHAIN_ID, "network_kind": NetworkKind::Devnet.code() },
            "key_material": base16::encode(&pattern(20)),
            "public_key": base16::encode(&key.public_key().to_bytes()),
            "proof_of_possession": base16::encode(&proof.to_bytes()),
            "vote_digest": digest.to_string(),
            "vote_signature": base16::encode(&key.sign(&digest).to_bytes()),
        }],
    })
}

fn canonical_encoding() -> Value {
    let mut list = AceWriter::new();
    list.list(&[1u16, 2, 3]);
    let mut option = AceWriter::new();
    option.option(Some(&7u64));
    let accepted = json!([
        { "type": "u16", "value": "258", "bytes": base16::encode(&258u16.to_ace_bytes()) },
        { "type": "u64", "value": "1", "bytes": base16::encode(&1u64.to_ace_bytes()) },
        { "type": "u128", "value": u128::MAX.to_string(), "bytes": base16::encode(&u128::MAX.to_ace_bytes()) },
        { "type": "bool", "value": "true", "bytes": base16::encode(&true.to_ace_bytes()) },
        { "type": "list<u16>", "value": "[1, 2, 3]", "bytes": base16::encode(list.as_bytes()) },
        { "type": "option<u64>", "value": "7", "bytes": base16::encode(option.as_bytes()) },
    ]);
    let rejected: Vec<Value> = [
        ("bool", "02", error_name(bool::from_ace_bytes(&[2]))),
        (
            "u16",
            "0100ff",
            error_name(u16::from_ace_bytes(&[1, 0, 0xff])),
        ),
        ("u64", "010203", error_name(u64::from_ace_bytes(&[1, 2, 3]))),
        (
            "option<u8>",
            "0200",
            error_name(AceReader::new(&[2, 0]).option::<u8>()),
        ),
        (
            "sorted list<u16> with duplicate",
            "0200000001000100",
            error_name(AceReader::new(&[2, 0, 0, 0, 1, 0, 1, 0]).sorted_list::<u16>(8)),
        ),
    ]
    .into_iter()
    .map(|(type_name, bytes, error)| json!({ "type": type_name, "bytes": bytes, "error": error }))
    .collect();
    json!({
        "aps": "APS-0041",
        "description": "ACE: fixed-width little-endian integers, u8 booleans and presence tags, u32 length prefixes, strictly sorted lists, no trailing bytes",
        "accepted": accepted,
        "rejected": rejected,
    })
}

fn base16_text() -> Value {
    let cases: Vec<Value> = [
        "", "00", "9fabff", "0x00", "0X00", "AB", "abc", "ab cd", "zz",
    ]
    .into_iter()
    .map(|text| match base16::decode(text) {
        Ok(bytes) => json!({ "text": text, "bytes_len": bytes.len(), "result": "ACCEPTED" }),
        Err(error) => json!({ "text": text, "result": error.code().name() }),
    })
    .collect();
    json!({
        "aps": "APS-0048",
        "description": "Base16 text: lowercase, unprefixed, even length; 0x is rejected, never stripped",
        "cases": cases,
    })
}
