//! The one service layer both interfaces call (Section 37.2: no business logic in either
//! adapter). Each method takes named parameters and returns the JSON result, so REST and
//! JSON-RPC answer identically by construction.

use aletheia_core::{AssetId, base16};
use serde_json::{Map, Value, json};

use crate::backend::{Backend, BlockRef};
use crate::encode::{
    address_text, amount, asset_name, block_summary, block_text, display, native_decimals,
    parse_address, parse_asset, parse_block_id, parse_tx_id, receipt_json, transaction_json,
    tx_text,
};
use crate::error::{RpcError, from_backend};

pub type Params = Map<String, Value>;

/// Methods v1 this node offers, by name.
pub const METHODS: &[&str] = &[
    "getNetworkStatus",
    "getChainHead",
    "getFinalizedHead",
    "getChainParams",
    "getBlock",
    "getBlockByHeight",
    "getFinalityProof",
    "submitTransaction",
    "simulateTransaction",
    "getTransaction",
    "getReceipt",
    "getAccount",
    "getBalance",
    "getAssets",
    "getMonetarySupply",
];

fn text<'a>(params: &'a Params, name: &str) -> Result<&'a str, RpcError> {
    params
        .get(name)
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::invalid_params(format!("\"{name}\" (a string) is required")))
}

fn number(params: &Params, name: &str) -> Result<u64, RpcError> {
    match params.get(name) {
        Some(Value::Number(n)) => n
            .as_u64()
            .ok_or_else(|| RpcError::invalid_params(format!("\"{name}\" is a whole number"))),
        Some(Value::String(s)) => s
            .parse()
            .map_err(|_| RpcError::invalid_params(format!("\"{name}\" is a whole number"))),
        _ => Err(RpcError::invalid_params(format!(
            "\"{name}\" (a whole number) is required"
        ))),
    }
}

fn bytes(params: &Params, name: &str) -> Result<Vec<u8>, RpcError> {
    base16::decode(text(params, name)?)
        .map_err(|e| RpcError::invalid_params(format!("\"{name}\": {}", e.detail())))
}

/// Refuses parameters a method does not take, so a typo is not silently ignored.
fn only(params: &Params, allowed: &[&str]) -> Result<(), RpcError> {
    match params.keys().find(|k| !allowed.contains(&k.as_str())) {
        Some(extra) => Err(RpcError::invalid_params(format!(
            "unknown parameter \"{extra}\""
        ))),
        None => Ok(()),
    }
}

#[derive(Debug)]
pub struct Service<B: Backend> {
    pub backend: B,
}

impl<B: Backend> Service<B> {
    pub fn new(backend: B) -> Service<B> {
        Service { backend }
    }

    /// Runs one method by name.
    pub async fn call(&self, method: &str, params: &Params) -> Result<Value, RpcError> {
        match method {
            "getNetworkStatus" => {
                only(params, &[])?;
                self.network_status().await
            }
            "getChainHead" | "getFinalizedHead" => {
                only(params, &[])?;
                self.head().await
            }
            "getChainParams" => {
                only(params, &[])?;
                self.chain_params().await
            }
            "getBlock" => {
                only(params, &["block"])?;
                let network = self.backend.network();
                let hash = parse_block_id(&network, text(params, "block")?)?;
                self.block(BlockRef::Hash(hash)).await
            }
            "getBlockByHeight" => {
                only(params, &["height"])?;
                self.block(BlockRef::Height(number(params, "height")?))
                    .await
            }
            "getFinalityProof" => {
                only(params, &["block"])?;
                let network = self.backend.network();
                let hash = parse_block_id(&network, text(params, "block")?)?;
                self.finality_proof(hash).await
            }
            "submitTransaction" => {
                only(params, &["tx"])?;
                self.submit(bytes(params, "tx")?).await
            }
            "simulateTransaction" => {
                only(params, &["tx"])?;
                self.simulate(bytes(params, "tx")?).await
            }
            "getTransaction" => {
                only(params, &["txId"])?;
                let network = self.backend.network();
                self.transaction(parse_tx_id(&network, text(params, "txId")?)?)
                    .await
            }
            "getReceipt" => {
                only(params, &["txId"])?;
                let network = self.backend.network();
                self.receipt(parse_tx_id(&network, text(params, "txId")?)?)
                    .await
            }
            "getAccount" => {
                only(params, &["address"])?;
                let network = self.backend.network();
                self.account(&parse_address(&network, text(params, "address")?)?)
                    .await
            }
            "getBalance" => {
                only(params, &["address", "asset"])?;
                let network = self.backend.network();
                let address = parse_address(&network, text(params, "address")?)?;
                let asset = parse_asset(text(params, "asset")?)?;
                self.balance(&address, asset).await
            }
            "getAssets" => {
                only(params, &[])?;
                self.assets().await
            }
            "getMonetarySupply" => {
                only(params, &["asset"])?;
                self.supply(parse_asset(text(params, "asset")?)?).await
            }
            other => Err(RpcError::method_not_found(other)),
        }
    }

    pub async fn network_status(&self) -> Result<Value, RpcError> {
        let network = self.backend.network();
        let status = self.backend.status().await.map_err(|e| from_backend(&e))?;
        Ok(json!({
            "chainId": network.chain_id().get(),
            "network": format!("{:?}", network.network_kind()).to_lowercase(),
            "protocolVersion": status.protocol_version,
            "peers": status.peers,
            "syncing": status.syncing,
            "finalizedHeight": status.finalized_height,
            "finalizedBlock": block_text(&network, status.finalized_hash),
        }))
    }

    /// Only finalized blocks are served, so the head is the finalized head.
    pub async fn head(&self) -> Result<Value, RpcError> {
        let status = self.backend.status().await.map_err(|e| from_backend(&e))?;
        self.block(BlockRef::Height(status.finalized_height)).await
    }

    pub async fn chain_params(&self) -> Result<Value, RpcError> {
        let status = self.backend.status().await.map_err(|e| from_backend(&e))?;
        let network = self.backend.network();
        Ok(json!({
            "chainId": network.chain_id().get(),
            "protocolVersion": status.protocol_version,
            "feeAssets": ["AEY", "ALnT"],
        }))
    }

    pub async fn block(&self, at: BlockRef) -> Result<Value, RpcError> {
        let network = self.backend.network();
        match self.backend.block(at).await.map_err(|e| from_backend(&e))? {
            Some(proposal) => Ok(block_summary(&network, &proposal)),
            None => Err(RpcError::not_found("no finalized block there")),
        }
    }

    pub async fn finality_proof(&self, hash: aletheia_core::Hash32) -> Result<Value, RpcError> {
        let network = self.backend.network();
        let proposal = self
            .backend
            .block(BlockRef::Hash(hash))
            .await
            .map_err(|e| from_backend(&e))?
            .ok_or_else(|| RpcError::not_found("no finalized block with that id"))?;
        let height = proposal.block.header.height.get();
        let proof = self
            .backend
            .finality_proof(height)
            .await
            .map_err(|e| from_backend(&e))?
            .ok_or_else(|| RpcError::not_found("no finality proof is stored for that block"))?;
        Ok(json!({
            "block": block_text(&network, hash),
            "height": height,
            "proof": base16::encode(&proof),
        }))
    }

    pub async fn submit(&self, tx: Vec<u8>) -> Result<Value, RpcError> {
        let network = self.backend.network();
        let id = self.backend.submit(tx).await.map_err(|e| {
            if e.is_fail_stop() {
                RpcError::internal()
            } else {
                RpcError::rejected(&e)
            }
        })?;
        Ok(json!({ "txId": tx_text(&network, id), "status": "ACCEPTED" }))
    }

    pub async fn simulate(&self, tx: Vec<u8>) -> Result<Value, RpcError> {
        let network = self.backend.network();
        let receipt = self.backend.simulate(tx).await.map_err(|e| {
            if e.is_fail_stop() {
                RpcError::internal()
            } else {
                RpcError::simulation_failed(&e)
            }
        })?;
        Ok(json!({
            "euUsed": receipt.eu_used,
            "fee": amount(receipt.fee_amount, receipt.fee_asset),
            "receipt": receipt_json(&network, &receipt),
        }))
    }

    pub async fn transaction(&self, tx_id: aletheia_core::Hash32) -> Result<Value, RpcError> {
        let network = self.backend.network();
        let tx = self
            .backend
            .transaction(tx_id)
            .await
            .map_err(|e| from_backend(&e))?
            .ok_or_else(|| RpcError::not_found("no finalized transaction with that id"))?;
        let receipt = self
            .backend
            .receipt(tx_id)
            .await
            .map_err(|e| from_backend(&e))?;
        Ok(transaction_json(
            &network,
            &tx,
            receipt.as_ref().map(|r| &r.value),
        ))
    }

    pub async fn receipt(&self, tx_id: aletheia_core::Hash32) -> Result<Value, RpcError> {
        let network = self.backend.network();
        let receipt = self
            .backend
            .receipt(tx_id)
            .await
            .map_err(|e| from_backend(&e))?
            .ok_or_else(|| RpcError::not_found("no receipt for that transaction"))?;
        let mut out = receipt_json(&network, &receipt.value);
        if let Some(map) = out.as_object_mut() {
            map.insert(
                "block".to_owned(),
                json!(block_text(&network, receipt.block_hash)),
            );
        }
        Ok(out)
    }

    pub async fn account(&self, address: &aletheia_core::Address) -> Result<Value, RpcError> {
        let network = self.backend.network();
        let account = self
            .backend
            .account(*address)
            .await
            .map_err(|e| from_backend(&e))?;
        Ok(match account {
            Some(a) => json!({
                "address": address_text(&network, address),
                "exists": true,
                "nonce": a.next_nonce,
                "authScheme": a.auth_scheme,
                "flags": a.flags,
            }),
            // An address with no transactions yet: nonce 0, still able to receive.
            None => json!({
                "address": address_text(&network, address),
                "exists": false,
                "nonce": 0,
            }),
        })
    }

    pub async fn balance(
        &self,
        address: &aletheia_core::Address,
        asset: AssetId,
    ) -> Result<Value, RpcError> {
        let network = self.backend.network();
        let balance = self
            .backend
            .balance(*address, asset)
            .await
            .map_err(|e| from_backend(&e))?;
        let status = self.backend.status().await.map_err(|e| from_backend(&e))?;
        let decimals = native_decimals(asset);
        Ok(json!({
            "address": address_text(&network, address),
            "asset": asset_name(asset),
            "available": balance.available.to_string(),
            "locked": balance.locked.to_string(),
            "display": display(balance.available, decimals),
            "height": status.finalized_height,
        }))
    }

    pub async fn assets(&self) -> Result<Value, RpcError> {
        let assets = self.backend.assets().await.map_err(|e| from_backend(&e))?;
        Ok(Value::Array(
            assets
                .into_iter()
                .map(|(id, config)| {
                    json!({
                        "id": id.get(),
                        "name": asset_name(id),
                        "decimals": config.decimals,
                        "transferable": config.transferable,
                    })
                })
                .collect(),
        ))
    }

    pub async fn supply(&self, asset: AssetId) -> Result<Value, RpcError> {
        let ledger = self
            .backend
            .supply(asset)
            .await
            .map_err(|e| from_backend(&e))?
            .ok_or_else(|| RpcError::not_found("that asset has no supply ledger"))?;
        let status = self.backend.status().await.map_err(|e| from_backend(&e))?;
        Ok(json!({
            "asset": asset_name(asset),
            "height": status.finalized_height,
            "issuedTotal": ledger.issued_total.to_string(),
            "burnedTotal": ledger.burned_total.to_string(),
            "redeemedTotal": ledger.redeemed_total.to_string(),
            "circulating": ledger.circulating.to_string(),
            "locked": ledger.locked.to_string(),
            "reserved": ledger.reserved.to_string(),
            "bridgeEscrow": ledger.bridge_escrow.to_string(),
            "physicalCashOutstanding": ledger.physical_cash_outstanding.to_string(),
            "authorizedCapacity": ledger.authorized_capacity.to_string(),
            "outstandingLiabilities": ledger.outstanding_liabilities.to_string(),
        }))
    }
}
