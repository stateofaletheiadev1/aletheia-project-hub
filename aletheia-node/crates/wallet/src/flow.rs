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
use crate::uri::{asset_decimals, format_amount};

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

/// Fee terms and validity of a transaction to build.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FeeTerms {
    pub fee_asset: AssetId,
    pub max_fee: u128,
    pub eu_limit: u64,
    /// Slots the transaction stays valid for.
    pub validity_slots: u64,
}

/// What any transaction will cost and who sends it, shown before signing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Preview {
    pub network: String,
    pub chain_id: u32,
    pub from: String,
    /// The nonce the transaction is signed with (governance proposal ids depend on it).
    pub nonce: u64,
    pub fee_estimate: String,
    pub fee_asset: String,
    pub eu_used: u64,
}

impl core::fmt::Display for Preview {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        writeln!(
            f,
            "Network          {} (chain {})",
            self.network, self.chain_id
        )?;
        writeln!(f, "From             {}", self.from)?;
        write!(
            f,
            "Fee (estimate)   {} {}   ({} EU)",
            self.fee_estimate, self.fee_asset, self.eu_used
        )
    }
}

/// The sender's next nonce and the current slot, after checking the node is on the account's
/// network.
async fn prepare(rpc: &impl Rpc, account: &Account) -> Result<(u64, u64), WalletError> {
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
    let from = account.address().to_text(network.network_kind());
    let nonce = rpc
        .call("getAccount", json!({ "address": from }))
        .await?
        .get("nonce")
        .and_then(Value::as_u64)
        .ok_or_else(|| WalletError("the node did not report the account nonce".to_owned()))?;
    let head = rpc.call("getFinalizedHead", json!({})).await?;
    let slot = head.get("slot").and_then(Value::as_u64).unwrap_or(height);
    Ok((nonce, slot))
}

fn body(
    account: &Account,
    nonce: u64,
    slot: u64,
    terms: &FeeTerms,
    payload: Payload,
) -> TransactionBody {
    let network = account.network();
    TransactionBody {
        version: TX_BODY_VERSION_1,
        chain_id: network.chain_id(),
        network_kind: network.network_kind(),
        sender: account.address(),
        nonce,
        fee: Fee {
            fee_asset: terms.fee_asset,
            max_fee: terms.max_fee,
            eu_limit: terms.eu_limit,
        },
        valid_from_slot: Slot::new(slot),
        expiry_slot: Slot::new(slot.saturating_add(terms.validity_slots)),
        memo: Vec::new(),
        payload,
    }
}

/// Simulates the signed body and refuses to go on when it would fail on chain.
async fn simulate(
    rpc: &impl Rpc,
    account: &Account,
    body: &TransactionBody,
) -> Result<Value, WalletError> {
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
            "the transaction would fail on chain: {name}; nothing was signed"
        )));
    }
    Ok(simulated)
}

/// Signs, submits and tracks to FINALIZED (the node only reports finalized transactions).
async fn submit_and_track(
    rpc: &impl Rpc,
    account: &Account,
    body: TransactionBody,
    track: Duration,
) -> Result<Sent, WalletError> {
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

fn fee_display(simulated: &Value) -> String {
    simulated
        .get("fee")
        .and_then(|f| f.get("display"))
        .and_then(Value::as_str)
        .unwrap_or("?")
        .to_owned()
}

/// Builds, simulates, confirms, signs, submits and tracks any transaction. `payload` is built
/// from the nonce the transaction will carry; `confirm` sees the preview and returns false to
/// stop before signing.
pub async fn send(
    rpc: &impl Rpc,
    account: &Account,
    terms: &FeeTerms,
    payload: impl FnOnce(u64) -> Payload,
    confirm: impl FnOnce(&Preview) -> bool,
    track: Duration,
) -> Result<Sent, WalletError> {
    let (nonce, slot) = prepare(rpc, account).await?;
    let body = body(account, nonce, slot, terms, payload(nonce));
    let simulated = simulate(rpc, account, &body).await?;
    let network = account.network();
    let preview = Preview {
        network: network.network_kind().to_string(),
        chain_id: network.chain_id().get(),
        from: account.address().to_text(network.network_kind()),
        nonce,
        fee_estimate: fee_display(&simulated),
        fee_asset: asset_name(terms.fee_asset),
        eu_used: simulated.get("euUsed").and_then(Value::as_u64).unwrap_or(0),
    };
    if !confirm(&preview) {
        return Err(WalletError(
            "not signed: the transaction was not confirmed".to_owned(),
        ));
    }
    submit_and_track(rpc, account, body, track).await
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
    let (nonce, slot) = prepare(rpc, account).await?;
    let terms = FeeTerms {
        fee_asset: request.fee_asset,
        max_fee: request.max_fee,
        eu_limit: request.eu_limit,
        validity_slots: request.validity_slots,
    };
    let payload = Payload::Transfer(TransferLeg {
        recipient: request.recipient,
        asset: request.asset,
        amount: request.amount,
    });
    let body = body(account, nonce, slot, &terms, payload);
    let simulated = simulate(rpc, account, &body)
        .await
        .map_err(|e| WalletError(e.0.replace("the transaction", "the transfer")))?;
    let network = account.network();
    let kind = network.network_kind();
    let summary = Summary {
        network: kind.to_string(),
        chain_id: network.chain_id().get(),
        from: account.address().to_text(kind),
        recipient: request.recipient.to_text(kind),
        asset: asset_name(request.asset),
        amount: format_amount(request.amount, asset_decimals(request.asset)),
        fee_estimate: fee_display(&simulated),
        fee_asset: asset_name(request.fee_asset),
        eu_used: simulated.get("euUsed").and_then(Value::as_u64).unwrap_or(0),
    };
    if !confirm(&summary) {
        return Err(WalletError(
            "not signed: the transfer was not confirmed".to_owned(),
        ));
    }
    submit_and_track(rpc, account, body, track).await
}
