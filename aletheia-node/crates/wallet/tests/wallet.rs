//! The wallet against a node (spec Section 41): keystore, payment URIs, and the full flow from
//! a derived key: check the network, simulate, confirm, sign, submit, track to FINALIZED.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use std::sync::Mutex;
use std::time::Duration;

use aletheia_core::block::Proposal;
use aletheia_core::tx::SignedTransaction;
use aletheia_core::{
    AceDecode, Address, AletheiaError, AssetId, ChainId, Hash32, NetworkIdentity, NetworkKind,
};
use aletheia_crypto::Secret;
use aletheia_execution::Receipt;
use aletheia_execution::model::{Account as AccountRecord, AssetConfig, Balance};
use aletheia_monetary::SupplyLedger;
use aletheia_rpc::{Backend, BlockRef, Located, NodeStatus, Service};
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};
use aletheia_wallet::derive::{PROVISIONAL_COIN_TYPE, account_key};
use aletheia_wallet::{Account, PaymentUri, Rpc, TransferRequest, WalletError, keystore, transfer};
use serde_json::{Value, json};

// ---- an in-process node: the RPC service over a devnet ----

struct DevnetBackend(Mutex<Devnet>);

impl Backend for DevnetBackend {
    fn network(&self) -> NetworkIdentity {
        self.0.lock().unwrap().network
    }
    async fn status(&self) -> Result<NodeStatus, AletheiaError> {
        let net = self.0.lock().unwrap();
        Ok(NodeStatus {
            finalized_height: net.head.height.get(),
            finalized_hash: net.head.block_hash(&net.network),
            protocol_version: net.head.version.get(),
            peers: None,
            syncing: false,
        })
    }
    async fn block(&self, at: BlockRef) -> Result<Option<Proposal>, AletheiaError> {
        let net = self.0.lock().unwrap();
        Ok(net
            .blocks
            .iter()
            .map(|(p, _)| p)
            .find(|p| match at {
                BlockRef::Height(h) => p.block.header.height.get() == h,
                BlockRef::Hash(hash) => p.block.header.block_hash(&net.network) == hash,
            })
            .cloned())
    }
    async fn finality_proof(&self, _height: u64) -> Result<Option<Vec<u8>>, AletheiaError> {
        Ok(None)
    }
    async fn transaction(
        &self,
        tx_id: Hash32,
    ) -> Result<Option<Located<SignedTransaction>>, AletheiaError> {
        let net = self.0.lock().unwrap();
        for (proposal, _) in &net.blocks {
            for (index, tx) in proposal.block.body.transactions.iter().enumerate() {
                if tx.body.tx_id(&net.network).hash() == tx_id {
                    let header = &proposal.block.header;
                    return Ok(Some(Located {
                        value: tx.clone(),
                        height: header.height.get(),
                        index: u32::try_from(index).unwrap(),
                        block_hash: header.block_hash(&net.network),
                        slot: header.slot.get(),
                    }));
                }
            }
        }
        Ok(None)
    }
    async fn receipt(&self, tx_id: Hash32) -> Result<Option<Located<Receipt>>, AletheiaError> {
        let net = self.0.lock().unwrap();
        for (proposal, executed) in &net.blocks {
            for (index, receipt) in executed.receipts.iter().enumerate() {
                if receipt.tx_id == tx_id {
                    let header = &proposal.block.header;
                    return Ok(Some(Located {
                        value: receipt.clone(),
                        height: header.height.get(),
                        index: u32::try_from(index).unwrap(),
                        block_hash: header.block_hash(&net.network),
                        slot: header.slot.get(),
                    }));
                }
            }
        }
        Ok(None)
    }
    async fn account(&self, address: Address) -> Result<Option<AccountRecord>, AletheiaError> {
        Ok(self.0.lock().unwrap().account(&address))
    }
    async fn balance(&self, address: Address, asset: AssetId) -> Result<Balance, AletheiaError> {
        Ok(self.0.lock().unwrap().balance(&address, asset))
    }
    async fn assets(&self) -> Result<Vec<(AssetId, AssetConfig)>, AletheiaError> {
        Ok(Vec::new())
    }
    async fn supply(&self, _asset: AssetId) -> Result<Option<SupplyLedger>, AletheiaError> {
        Ok(None)
    }
    async fn validators(
        &self,
        _epoch: u64,
    ) -> Result<Option<Vec<aletheia_execution::model::ValidatorRecord>>, AletheiaError> {
        Ok(None)
    }
    async fn submit(&self, bytes: Vec<u8>) -> Result<Hash32, AletheiaError> {
        let mut net = self.0.lock().unwrap();
        let tx = SignedTransaction::from_ace_bytes(&bytes)?;
        net.simulate(&tx)?;
        let id = tx.body.tx_id(&net.network).hash();
        net.produce(vec![tx])?;
        Ok(id)
    }
    async fn simulate(&self, bytes: Vec<u8>) -> Result<Receipt, AletheiaError> {
        let net = self.0.lock().unwrap();
        net.simulate(&SignedTransaction::from_ace_bytes(&bytes)?)
    }
}

struct InProcess(Service<DevnetBackend>);

impl Rpc for InProcess {
    async fn call(&self, method: &str, params: Value) -> Result<Value, WalletError> {
        let Value::Object(params) = params else {
            return Err(WalletError("params".to_owned()));
        };
        self.0.call(method, &params).await.map_err(|e| {
            WalletError(format!(
                "{} {}",
                e.message,
                e.data.map(|d| d.to_string()).unwrap_or_default()
            ))
        })
    }
}

const SEED: [u8; 32] = [42; 32];

/// A devnet where the wallet's derived address holds 50 AEY and 100 ALnT for fees.
fn node_and_account() -> (InProcess, Account) {
    let mut net = Devnet::new(3, 100 * ONE_AEY, 1_000 * ONE_ALNT);
    let derived = account_key(&SEED, PROVISIONAL_COIN_TYPE, 0, 0).unwrap();
    let account = Account::new(derived.key(), net.network);
    let me = account.address();
    let fund_aey = net.transfer(0, 0, me, AssetId::AEY, 50 * ONE_AEY);
    let fund_alnt = net.transfer(0, 1, me, AssetId::ALNT, 100 * ONE_ALNT);
    net.produce(vec![fund_aey, fund_alnt]).unwrap();
    (
        InProcess(Service::new(DevnetBackend(Mutex::new(net)))),
        account,
    )
}

fn request(to: Address, amount: u128) -> TransferRequest {
    TransferRequest {
        recipient: to,
        asset: AssetId::AEY,
        amount,
        fee_asset: AssetId::ALNT,
        max_fee: 10_000,
        eu_limit: 10_000,
        validity_slots: 1_000,
    }
}

#[tokio::test]
async fn a_derived_key_sends_aey_and_tracks_it_to_finalized() {
    let (node, account) = node_and_account();
    let to = node.0.backend.0.lock().unwrap().address(2);
    let mut shown = None;
    let sent = transfer(
        &node,
        &account,
        &request(to, 12 * ONE_AEY + 34),
        |summary| {
            shown = Some(summary.clone());
            true
        },
        Duration::from_secs(5),
    )
    .await
    .unwrap();
    let summary = shown.unwrap();
    assert_eq!(summary.amount, "12.000000000000000034");
    assert_eq!(summary.network, "devnet");
    assert!(summary.to_string().contains("Recipient"));
    let finalized = sent.finalized.unwrap();
    assert_eq!(finalized["status"], "FINALIZED");
    assert_eq!(finalized["receipt"]["status"], "SUCCESS");
    let net = node.0.backend.0.lock().unwrap();
    assert_eq!(net.balance(&to, AssetId::AEY).available, 112 * ONE_AEY + 34);
}

#[tokio::test]
async fn nothing_is_signed_without_confirmation_or_on_the_wrong_network() {
    let (node, account) = node_and_account();
    let to = node.0.backend.0.lock().unwrap().address(2);
    let declined = transfer(
        &node,
        &account,
        &request(to, ONE_AEY),
        |_| false,
        Duration::from_secs(1),
    )
    .await;
    assert!(declined.unwrap_err().0.contains("not confirmed"));
    assert_eq!(
        node.0
            .backend
            .0
            .lock()
            .unwrap()
            .balance(&to, AssetId::AEY)
            .available,
        100 * ONE_AEY
    );

    // A wallet configured for another chain refuses this node.
    let other = NetworkIdentity::new(ChainId::new(9), NetworkKind::Devnet, Hash32::ZERO);
    let elsewhere = Account::new(&Secret::new(SEED), other);
    let refused = transfer(
        &node,
        &elsewhere,
        &request(to, ONE_AEY),
        |_| true,
        Duration::from_secs(1),
    )
    .await;
    assert!(
        refused
            .unwrap_err()
            .0
            .contains("this wallet signs for chain 9")
    );

    // A transfer that would fail is stopped at simulation, before signing.
    let too_much = transfer(
        &node,
        &account,
        &request(to, 1_000 * ONE_AEY),
        |_| true,
        Duration::from_secs(1),
    )
    .await;
    assert!(too_much.unwrap_err().0.contains("would fail"));
}

#[test]
fn the_keystore_opens_only_with_the_password_and_unchanged() {
    let seed = Secret::new([7u8; 32]);
    let file = keystore::seal(&seed, b"correct horse", [1; 16], [2; 24], "alt:example").unwrap();
    assert_eq!(
        keystore::open(&file, b"correct horse").unwrap().expose(),
        seed.expose()
    );
    assert!(keystore::open(&file, b"wrong horse").is_err());
    let mut tampered = file.clone();
    let ciphertext = tampered["cipher"]["ciphertext"]
        .as_str()
        .unwrap()
        .to_owned();
    let flipped = match ciphertext.strip_prefix('0') {
        Some(rest) => format!("1{rest}"),
        None => format!("0{}", &ciphertext[1..]),
    };
    tampered["cipher"]["ciphertext"] = json!(flipped);
    assert!(keystore::open(&tampered, b"correct horse").is_err());
    // The key is never written in clear.
    assert!(
        !file
            .to_string()
            .contains(&aletheia_core::base16::encode(seed.expose()))
    );
}

#[test]
fn payment_uris_round_trip_and_check_the_network() {
    let net = Devnet::new(2, ONE_AEY, ONE_ALNT);
    let to = net.address(1);
    let uri = PaymentUri {
        recipient: to,
        asset: AssetId::AEY,
        amount: Some(125 * ONE_AEY + 5),
        memo: Some("Invoice 42 & rent".to_owned()),
    };
    let text = uri.format(NetworkKind::Devnet, 18);
    assert!(text.starts_with("aletheia:alt:"));
    assert!(text.contains("amount=125.000000000000000005"));
    assert_eq!(
        PaymentUri::parse(&text, NetworkKind::Devnet, 18).unwrap(),
        uri
    );
    // The same address on another network is refused by its checksum.
    assert!(PaymentUri::parse(&text, NetworkKind::Mainnet, 18).is_err());
    // More decimals than the asset has is refused, never rounded.
    let fine = text.replace("125.000000000000000005", "1.0000000000000000001");
    assert!(PaymentUri::parse(&fine, NetworkKind::Devnet, 18).is_err());
}

#[test]
fn amounts_use_each_assets_own_decimals() {
    use aletheia_wallet::{asset_decimals, format_amount, parse_amount};
    // 1 ALnT is 1,000 Mites; reading it with AEY's 18 decimals asked for more than the supply.
    assert_eq!(asset_decimals(AssetId::ALNT), 3);
    assert_eq!(asset_decimals(AssetId::AEY), 18);
    assert_eq!(
        parse_amount("1000", asset_decimals(AssetId::ALNT)).unwrap(),
        1_000_000
    );
    assert_eq!(
        parse_amount("1.5", asset_decimals(AssetId::ALNT)).unwrap(),
        1_500
    );
    assert!(parse_amount("0.0001", asset_decimals(AssetId::ALNT)).is_err());
    assert_eq!(
        parse_amount("1", asset_decimals(AssetId::AEY)).unwrap(),
        1_000_000_000_000_000_000
    );
    assert_eq!(format_amount(1_500, asset_decimals(AssetId::ALNT)), "1.500");
}
