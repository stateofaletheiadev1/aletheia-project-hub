//! The signing flow (spec Section 41): check the network, build the body, simulate it, show a
//! human summary, sign the digest, submit, and track the transaction to FINALIZED. It talks to
//! a node through [`Rpc`] (JSON-RPC methods by name), so the same flow serves the CLI over
//! HTTP and tests in process.

use core::future::Future;
use std::time::Duration;

use aletheia_core::tx::{
    AuthScheme, Authorization, Fee, Payload, PublicKeyEntry, SignatureEntry, SignedTransaction,
    TX_BODY_VERSION_1, TransactionBody, TransferLeg,
};
use aletheia_core::{
    AceEncode, Address, AssetId, ChainId, Hash32, NetworkIdentity, NetworkKind, Slot, base16,
};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use serde_json::{Value, json};

use crate::WalletError;
use crate::uri::format_amount;

/// One JSON-RPC call by method name with named parameters; returns `result` or the error.
pub trait Rpc: Send + Sync {
    fn call(
        &self,
        method: &str,
        params: Value,
    ) -> impl Future<Output = Result<Value, WalletError>> + Send;
}

/// A key and the network it signs for.
pub struct Account {
    key: Ed25519SigningKey,
    network: NetworkIdentity,
}

impl core::fmt::Debug for Account {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Account")
            .field("address", &self.address())
            .finish_non_exhaustive()
    }
}

impl Account {
    pub fn new(seed: &Secret<[u8; 32]>, network: NetworkIdentity) -> Account {
        Account {
            key: Ed25519SigningKey::from_seed(seed),
            network,
        }
    }

    pub fn address(&self) -> Address {
        aletheia_crypto::address::ed25519_account(&self.network, &self.key.public_key())
    }

    pub fn network(&self) -> NetworkIdentity {
        self.network
    }

    /// Signs the body's `TXSIG` digest.
    pub fn sign(&self, body: TransactionBody) -> SignedTransaction {
        let signature = self.key.sign(&body.signing_digest(&self.network));
        SignedTransaction {
            body,
            authorization: Authorization {
                scheme: AuthScheme::Ed25519,
                threshold: 1,
                public_keys: vec![PublicKeyEntry {
                    alg_id: 1,
                    key: self.key.public_key().to_bytes().to_vec(),
                }],
                signatures: vec![SignatureEntry {
                    signer_index: 0,
                    alg_id: 1,
                    signature: signature.to_bytes().to_vec(),
                }],
            },
        }
    }
}

/// The network a node says it is, checked before anything is signed.
pub async fn node_network(rpc: &impl Rpc) -> Result<(NetworkIdentity, u64), WalletError> {
    let status = rpc.call("getNetworkStatus", json!({})).await?;
    let chain_id = status
        .get("chainId")
        .and_then(Value::as_u64)
        .and_then(|c| u32::try_from(c).ok())
        .ok_or_else(|| WalletError("the node did not report its chain id".to_owned()))?;
    let name = status.get("network").and_then(Value::as_str).unwrap_or("");
    let kind = NetworkKind::ALL
        .into_iter()
        .find(|k| k.to_string() == name)
        .ok_or_else(|| WalletError(format!("the node reported an unknown network \"{name}\"")))?;
    let height = status
        .get("finalizedHeight")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    Ok((
        NetworkIdentity::new(ChainId::new(chain_id), kind, Hash32::ZERO),
        height,
    ))
}

/// What the user confirms before signing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Summary {
    pub network: String,
    pub chain_id: u32,
    pub from: String,
    pub recipient: String,
    pub asset: String,
    pub amount: String,
    pub fee_estimate: String,
    pub fee_asset: String,
    pub eu_used: u64,
}

impl core::fmt::Display for Summary {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        writeln!(
            f,
            "Network          {} (chain {})",
            self.network, self.chain_id
        )?;
        writeln!(f, "From             {}", self.from)?;
        writeln!(f, "Recipient        {}", self.recipient)?;
        writeln!(f, "Amount           {} {}", self.amount, self.asset)?;
        write!(
            f,
            "Fee (estimate)   {} {}   ({} EU)",
            self.fee_estimate, self.fee_asset, self.eu_used
        )
    }
}

/// A transfer to build.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransferRequest {
    pub recipient: Address,
    pub asset: AssetId,
    pub amount: u128,
    pub fee_asset: AssetId,
    pub max_fee: u128,
    pub eu_limit: u64,
    /// Slots the transaction stays valid for.
    pub validity_slots: u64,
}

fn asset_name(asset: AssetId) -> String {
    match asset {
        AssetId::AEY => "AEY".to_owned(),
        AssetId::ALNT => "ALnT".to_owned(),
        other => other.get().to_string(),
    }
}

/// The outcome of a submitted transfer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Sent {
    pub tx_id: String,
    /// The transaction as the node reports it once finalized (`None` if not seen in time).
    pub finalized: Option<Value>,
}

/// Builds, simulates, confirms, signs, submits and tracks a transfer. `confirm` sees the
/// summary and returns false to stop before signing.
pub async fn transfer(
    rpc: &impl Rpc,
    account: &Account,
    request: &TransferRequest,
    confirm: impl FnOnce(&Summary) -> bool,
    track: Duration,
) -> Result<Sent, WalletError> {
    let (network, height) = node_network(rpc).await?;
    let mine = account.network();
    if network.chain_id() != mine.chain_id() || network.network_kind() != mine.network_kind() {
        return Err(WalletError(format!(
            "the node is chain {} on {:?}; this wallet signs for chain {} on {:?}",
            network.chain_id().get(),
            network.network_kind(),
            mine.chain_id().get(),
            mine.network_kind()
        )));
    }
    let kind = network.network_kind();
    let from = account.address();
    let nonce = rpc
        .call("getAccount", json!({ "address": from.to_text(kind) }))
        .await?
        .get("nonce")
        .and_then(Value::as_u64)
        .ok_or_else(|| WalletError("the node did not report the account nonce".to_owned()))?;
    let head = rpc.call("getFinalizedHead", json!({})).await?;
    let slot = head.get("slot").and_then(Value::as_u64).unwrap_or(height);
    let body = TransactionBody {
        version: TX_BODY_VERSION_1,
        chain_id: network.chain_id(),
        network_kind: kind,
        sender: from,
        nonce,
        fee: Fee {
            fee_asset: request.fee_asset,
            max_fee: request.max_fee,
            eu_limit: request.eu_limit,
        },
        valid_from_slot: Slot::new(slot),
        expiry_slot: Slot::new(slot.saturating_add(request.validity_slots)),
        memo: Vec::new(),
        payload: Payload::Transfer(TransferLeg {
            recipient: request.recipient,
            asset: request.asset,
            amount: request.amount,
        }),
    };
    // Simulate first: the summary shows what the chain will charge.
    let preview = account.sign(body.clone());
    let simulated = rpc
        .call(
            "simulateTransaction",
            json!({ "tx": base16::encode(&preview.to_ace_bytes()) }),
        )
        .await?;
    let receipt_status = simulated
        .get("receipt")
        .and_then(|r| r.get("status"))
        .and_then(Value::as_str)
        .unwrap_or("");
    if receipt_status != "SUCCESS" {
        let name = simulated
            .get("receipt")
            .and_then(|r| r.get("errorName"))
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        return Err(WalletError(format!(
            "the transfer would fail on chain: {name}"
        )));
    }
    let summary = Summary {
        network: kind.to_string(),
        chain_id: network.chain_id().get(),
        from: from.to_text(kind),
        recipient: request.recipient.to_text(kind),
        asset: asset_name(request.asset),
        amount: format_amount(request.amount, 18),
        fee_estimate: simulated
            .get("fee")
            .and_then(|f| f.get("display"))
            .and_then(Value::as_str)
            .unwrap_or("?")
            .to_owned(),
        fee_asset: asset_name(request.fee_asset),
        eu_used: simulated.get("euUsed").and_then(Value::as_u64).unwrap_or(0),
    };
    if !confirm(&summary) {
        return Err(WalletError(
            "not signed: the transfer was not confirmed".to_owned(),
        ));
    }
    let signed = account.sign(body);
    let submitted = rpc
        .call(
            "submitTransaction",
            json!({ "tx": base16::encode(&signed.to_ace_bytes()) }),
        )
        .await?;
    let tx_id = submitted
        .get("txId")
        .and_then(Value::as_str)
        .ok_or_else(|| WalletError("the node did not return a transaction id".to_owned()))?
        .to_owned();
    // Track to FINALIZED: the node only reports finalized transactions.
    let deadline = std::time::Instant::now().checked_add(track);
    loop {
        if let Ok(shown) = rpc.call("getTransaction", json!({ "txId": tx_id })).await {
            return Ok(Sent {
                tx_id,
                finalized: Some(shown),
            });
        }
        if deadline.is_none_or(|d| std::time::Instant::now() >= d) {
            return Ok(Sent {
                tx_id,
                finalized: None,
            });
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}
