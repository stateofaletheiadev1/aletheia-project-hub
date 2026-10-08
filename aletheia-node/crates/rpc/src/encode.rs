//! Value encoding at the public boundary (Section 12.2): `AL:` / `AL:T` / `AL:B` identifiers
//! for the node's network, lowercase base16 without a prefix for other binary values, decimal
//! strings for every amount (with a display form using the asset's decimals).

use aletheia_core::block::Proposal;
use aletheia_core::tx::{Payload, SignedTransaction};
use aletheia_core::{Address, AssetId, BlockId, Hash32, NetworkIdentity, TxId, base16};
use aletheia_execution::{Receipt, ReceiptStatus};
use serde_json::{Value, json};

use crate::backend::Located;
use crate::error::RpcError;

/// `123.450000` for 123450000 with 6 decimals.
pub fn display(amount: u128, decimals: u8) -> String {
    let scale = 10u128.checked_pow(u32::from(decimals)).unwrap_or(1);
    let whole = amount.checked_div(scale).unwrap_or(0);
    let fraction = amount.checked_rem(scale).unwrap_or(0);
    if decimals == 0 {
        whole.to_string()
    } else {
        format!("{whole}.{fraction:0width$}", width = usize::from(decimals))
    }
}

/// The asset's public name.
pub fn asset_name(asset: AssetId) -> String {
    match asset {
        AssetId::AEY => "AEY".to_owned(),
        AssetId::ALNT => "ALnT".to_owned(),
        other => other.get().to_string(),
    }
}

/// Decimals of the native assets (bridged assets carry theirs in their config).
pub fn native_decimals(asset: AssetId) -> u8 {
    match asset {
        AssetId::AEY => 18,
        _ => 18,
    }
}

pub fn parse_asset(text: &str) -> Result<AssetId, RpcError> {
    match text {
        "AEY" => Ok(AssetId::AEY),
        "ALnT" => Ok(AssetId::ALNT),
        other => other.parse::<u32>().map(AssetId::new).map_err(|_| {
            RpcError::invalid_params(format!(
                "\"{other}\" is not an asset (AEY, ALnT or a number)"
            ))
        }),
    }
}

pub fn parse_address(network: &NetworkIdentity, text: &str) -> Result<Address, RpcError> {
    Address::parse(text, network.network_kind())
        .map_err(|e| RpcError::invalid_params(format!("address: {}", e.detail())))
}

pub fn parse_tx_id(network: &NetworkIdentity, text: &str) -> Result<Hash32, RpcError> {
    TxId::parse(text, network.network_kind())
        .map(|id| id.hash())
        .map_err(|e| RpcError::invalid_params(format!("transaction id: {}", e.detail())))
}

pub fn parse_block_id(network: &NetworkIdentity, text: &str) -> Result<Hash32, RpcError> {
    BlockId::parse(text, network.network_kind())
        .map(|id| id.hash())
        .map_err(|e| RpcError::invalid_params(format!("block id: {}", e.detail())))
}

pub fn tx_text(network: &NetworkIdentity, hash: Hash32) -> String {
    TxId::from_hash(hash).to_text(network.network_kind())
}

pub fn block_text(network: &NetworkIdentity, hash: Hash32) -> String {
    BlockId::from_hash(hash).to_text(network.network_kind())
}

pub fn address_text(network: &NetworkIdentity, address: &Address) -> String {
    address.to_text(network.network_kind())
}

pub fn amount(value: u128, asset: AssetId) -> Value {
    json!({
        "asset": asset_name(asset),
        "amount": value.to_string(),
        "display": display(value, native_decimals(asset)),
    })
}

/// The payload's name, as the type column shows it.
pub fn payload_name(payload: &Payload) -> &'static str {
    match payload {
        Payload::Transfer(_) => "Transfer",
        Payload::BatchTransfer(_) => "BatchTransfer",
        Payload::Mint(_) => "Mint",
        Payload::Burn(_) => "Burn",
        Payload::Lock(_) => "Lock",
        Payload::Unlock(_) => "Unlock",
        Payload::Redeem(_) => "Redeem",
        Payload::ReserveAttestation(_) => "ReserveAttestation",
        Payload::ContractDeploy(_) => "ContractDeploy",
        Payload::ContractCall(_) => "ContractCall",
        Payload::Registry(_) => "Registry",
        Payload::Apn(_) => "Apn",
        Payload::Bridge(_) => "Bridge",
        #[allow(unreachable_patterns)]
        _ => "Other",
    }
}

pub fn status_name(status: ReceiptStatus) -> &'static str {
    match status {
        ReceiptStatus::Success => "SUCCESS",
        ReceiptStatus::FailedExecution => "FAILED_EXECUTION",
        ReceiptStatus::OutOfEu => "OUT_OF_EU",
        #[allow(unreachable_patterns)]
        _ => "FAILED",
    }
}

pub fn block_summary(network: &NetworkIdentity, proposal: &Proposal) -> Value {
    let header = &proposal.block.header;
    let tx_ids: Vec<String> = proposal
        .block
        .body
        .transactions
        .iter()
        .map(|tx| tx_text(network, tx.body.tx_id(network).hash()))
        .collect();
    json!({
        "id": block_text(network, header.block_hash(network)),
        "height": header.height.get(),
        "slot": header.slot.get(),
        "epoch": header.epoch.get(),
        "protocolTimeMs": header.protocol_time_ms,
        "protocolVersion": header.version.get(),
        "parent": block_text(network, header.parent_hash),
        "proposer": header.proposer.get(),
        "stateRoot": base16::encode(header.state_root.as_bytes()),
        "txRoot": base16::encode(header.tx_root.as_bytes()),
        "receiptRoot": base16::encode(header.receipt_root.as_bytes()),
        "eventRoot": base16::encode(header.event_root.as_bytes()),
        "euUsed": header.eu_used,
        "txCount": header.tx_count,
        "transactions": tx_ids,
    })
}

pub fn receipt_json(network: &NetworkIdentity, receipt: &Receipt) -> Value {
    json!({
        "txId": tx_text(network, receipt.tx_id),
        "height": receipt.height,
        "index": receipt.index_in_block,
        "status": status_name(receipt.status),
        "errorCode": receipt.error_code,
        "errorName": receipt.error().map_or("", |c| c.name()),
        "euUsed": receipt.eu_used,
        "fee": amount(receipt.fee_amount, receipt.fee_asset),
        "writeSetHash": base16::encode(receipt.write_set_hash.as_bytes()),
        "events": receipt.events.iter().map(|e| json!({
            "emitter": address_text(network, &e.emitter),
            "eventType": base16::encode(e.event_type.as_bytes()),
            "topics": e.topics.iter().map(|t| base16::encode(t.as_bytes())).collect::<Vec<_>>(),
            "data": base16::encode(&e.data),
        })).collect::<Vec<_>>(),
    })
}

pub fn transaction_json(
    network: &NetworkIdentity,
    tx: &Located<SignedTransaction>,
    receipt: Option<&Receipt>,
) -> Value {
    let body = &tx.value.body;
    let mut out = json!({
        "txId": tx_text(network, body.tx_id(network).hash()),
        "status": "FINALIZED",
        "block": { "height": tx.height, "id": block_text(network, tx.block_hash), "slot": tx.slot, "index": tx.index },
        "sender": address_text(network, &body.sender),
        "nonce": body.nonce,
        "type": payload_name(&body.payload),
        "txType": body.tx_type().get(),
        "fee": {
            "asset": asset_name(body.fee.fee_asset),
            "maxFee": body.fee.max_fee.to_string(),
            "euLimit": body.fee.eu_limit,
        },
        "validFromSlot": body.valid_from_slot.get(),
        "expirySlot": body.expiry_slot.get(),
    });
    if let Some(map) = out.as_object_mut() {
        match &body.payload {
            Payload::Transfer(leg) => {
                map.insert(
                    "transfer".to_owned(),
                    json!({
                        "recipient": address_text(network, &leg.recipient),
                        "asset": asset_name(leg.asset),
                        "amount": leg.amount.to_string(),
                        "display": display(leg.amount, native_decimals(leg.asset)),
                    }),
                );
            }
            Payload::BatchTransfer(legs) => {
                map.insert(
                    "transfers".to_owned(),
                    Value::Array(
                        legs.iter()
                            .map(|leg| {
                                json!({
                                    "recipient": address_text(network, &leg.recipient),
                                    "asset": asset_name(leg.asset),
                                    "amount": leg.amount.to_string(),
                                })
                            })
                            .collect(),
                    ),
                );
            }
            _ => {}
        }
        if let Some(receipt) = receipt {
            map.insert(
                "receipt".to_owned(),
                json!({
                    "status": status_name(receipt.status),
                    "errorCode": receipt.error_code,
                    "errorName": receipt.error().map_or("", |c| c.name()),
                    "euUsed": receipt.eu_used,
                    "feeCharged": receipt.fee_amount.to_string(),
                    "events": receipt.events.len(),
                }),
            );
        }
    }
    out
}

/// Whether any string anywhere in `value` carries a `0x` prefix (always refused).
pub fn has_hex_prefix(value: &Value) -> bool {
    match value {
        Value::String(s) => s.starts_with("0x") || s.starts_with("0X"),
        Value::Array(items) => items.iter().any(has_hex_prefix),
        Value::Object(map) => map.values().any(has_hex_prefix),
        _ => false,
    }
}

/// Nesting depth of a JSON value.
pub fn depth(value: &Value) -> usize {
    match value {
        Value::Array(items) => 1usize.saturating_add(items.iter().map(depth).max().unwrap_or(0)),
        Value::Object(map) => 1usize.saturating_add(map.values().map(depth).max().unwrap_or(0)),
        _ => 0,
    }
}
