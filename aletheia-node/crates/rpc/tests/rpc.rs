//! The public interfaces over a devnet (spec Section 37): a transfer submitted and read back
//! through JSON-RPC, REST/JSON-RPC parity, and the strict JSON-RPC 2.0 rules.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use std::sync::Mutex;

use aletheia_core::block::Proposal;
use aletheia_core::tx::SignedTransaction;
use aletheia_core::{
    AceDecode, AceEncode, Address, AletheiaError, AssetId, ErrorCode, Hash32, NetworkIdentity,
    base16,
};
use aletheia_execution::Receipt;
use aletheia_execution::model::{Account, AssetConfig, Balance, ValidatorRecord};
use aletheia_monetary::SupplyLedger;
use aletheia_rpc::rest::route;
use aletheia_rpc::{Backend, BlockRef, Located, NodeStatus, Service, jsonrpc};
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};
use serde_json::{Value, json};

struct DevnetBackend(Mutex<Devnet>);

fn find<T>(
    net: &Devnet,
    tx_id: Hash32,
    pick: impl Fn(&Proposal, usize, &aletheia_execution::ExecutedBlock) -> T,
) -> Option<Located<T>> {
    for (proposal, executed) in &net.blocks {
        for (index, tx) in proposal.block.body.transactions.iter().enumerate() {
            if tx.body.tx_id(&net.network).hash() == tx_id {
                let header = &proposal.block.header;
                return Some(Located {
                    value: pick(proposal, index, executed),
                    height: header.height.get(),
                    index: u32::try_from(index).unwrap(),
                    block_hash: header.block_hash(&net.network),
                    slot: header.slot.get(),
                });
            }
        }
    }
    None
}

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
        Ok(find(&net, tx_id, |p, i, _| {
            p.block.body.transactions[i].clone()
        }))
    }

    async fn receipt(&self, tx_id: Hash32) -> Result<Option<Located<Receipt>>, AletheiaError> {
        let net = self.0.lock().unwrap();
        Ok(find(&net, tx_id, |_, i, e| e.receipts[i].clone()))
    }

    async fn account(&self, address: Address) -> Result<Option<Account>, AletheiaError> {
        Ok(self.0.lock().unwrap().account(&address))
    }

    async fn balance(&self, address: Address, asset: AssetId) -> Result<Balance, AletheiaError> {
        Ok(self.0.lock().unwrap().balance(&address, asset))
    }

    async fn assets(&self) -> Result<Vec<(AssetId, AssetConfig)>, AletheiaError> {
        let net = self.0.lock().unwrap();
        let records = net.records();
        let view = net.view();
        let mut out = Vec::new();
        for id in [AssetId::AEY, AssetId::ALNT] {
            if let Some(config) = records.asset(&view, id)? {
                out.push((id, config));
            }
        }
        Ok(out)
    }

    async fn supply(&self, asset: AssetId) -> Result<Option<SupplyLedger>, AletheiaError> {
        let net = self.0.lock().unwrap();
        net.records().supply_ledger(&net.view(), asset)
    }

    async fn validators(&self, epoch: u64) -> Result<Option<Vec<ValidatorRecord>>, AletheiaError> {
        let net = self.0.lock().unwrap();
        net.records().validator_set(&net.view(), epoch)
    }

    async fn submit(&self, bytes: Vec<u8>) -> Result<Hash32, AletheiaError> {
        let mut net = self.0.lock().unwrap();
        let tx = SignedTransaction::from_ace_bytes(&bytes)?;
        // Admission runs the stateless and stateful checks; then the devnet seals a block.
        let preview = net.simulate(&tx)?;
        let _ = preview;
        let id = tx.body.tx_id(&net.network).hash();
        net.produce(vec![tx])?;
        Ok(id)
    }

    async fn simulate(&self, bytes: Vec<u8>) -> Result<Receipt, AletheiaError> {
        let net = self.0.lock().unwrap();
        net.simulate(&SignedTransaction::from_ace_bytes(&bytes)?)
    }
}

fn service() -> Service<DevnetBackend> {
    Service::new(DevnetBackend(Mutex::new(Devnet::new(
        3,
        100 * ONE_AEY,
        1_000 * ONE_ALNT,
    ))))
}

fn signed_transfer(
    service: &Service<DevnetBackend>,
    amount: u128,
    nonce_offset: u64,
) -> (String, Address) {
    let net = service.backend.0.lock().unwrap();
    let to = net.address(1);
    let nonce = net.next_nonce(0) + nonce_offset;
    let tx = net.transfer(0, nonce, to, AssetId::AEY, amount);
    (base16::encode(&tx.to_ace_bytes()), to)
}

async fn rpc(service: &Service<DevnetBackend>, method: &str, params: Value) -> Value {
    let body = json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params }).to_string();
    let answer = jsonrpc::handle(service, body.as_bytes()).await.unwrap();
    serde_json::from_str(&answer).unwrap()
}

async fn raw(service: &Service<DevnetBackend>, body: &str) -> Option<Value> {
    jsonrpc::handle(service, body.as_bytes())
        .await
        .map(|a| serde_json::from_str(&a).unwrap())
}

fn result(answer: &Value) -> &Value {
    answer
        .get("result")
        .unwrap_or_else(|| panic!("an error: {answer}"))
}

fn error_code(answer: &Value) -> i64 {
    answer["error"]["code"]
        .as_i64()
        .unwrap_or_else(|| panic!("not an error: {answer}"))
}

#[tokio::test]
async fn a_transfer_goes_in_and_reads_back_through_json_rpc() {
    let service = service();
    let (tx, to) = signed_transfer(&service, 7 * ONE_AEY + 5, 0);
    let network = service.backend.network();

    let simulated = rpc(&service, "simulateTransaction", json!({ "tx": tx })).await;
    assert_eq!(result(&simulated)["receipt"]["status"], "SUCCESS");

    let submitted = rpc(&service, "submitTransaction", json!({ "tx": tx })).await;
    let tx_id = result(&submitted)["txId"].as_str().unwrap().to_owned();
    assert!(tx_id.starts_with("AL:T"));
    assert_eq!(result(&submitted)["status"], "ACCEPTED");

    let shown = rpc(&service, "getTransaction", json!({ "txId": tx_id })).await;
    let shown = result(&shown);
    assert_eq!(shown["status"], "FINALIZED");
    assert_eq!(shown["type"], "Transfer");
    assert_eq!(shown["transfer"]["amount"], (7 * ONE_AEY + 5).to_string());
    assert_eq!(shown["transfer"]["display"], "7.000000000000000005");
    assert_eq!(
        shown["transfer"]["recipient"],
        to.to_text(network.network_kind())
    );
    assert_eq!(shown["receipt"]["status"], "SUCCESS");

    let receipt = rpc(&service, "getReceipt", json!({ "txId": tx_id })).await;
    assert_eq!(result(&receipt)["status"], "SUCCESS");
    assert!(
        result(&receipt)["block"]
            .as_str()
            .unwrap()
            .starts_with("AL:B")
    );

    let balance = rpc(
        &service,
        "getBalance",
        json!({ "address": to.to_text(network.network_kind()), "asset": "AEY" }),
    )
    .await;
    assert_eq!(
        result(&balance)["available"],
        (107 * ONE_AEY + 5).to_string()
    );
    assert_eq!(result(&balance)["display"], "107.000000000000000005");
    // ALnT has 3 decimals: its display form must not borrow AEY's 18.
    let alnt = rpc(
        &service,
        "getBalance",
        json!({ "address": to.to_text(network.network_kind()), "asset": "ALnT" }),
    )
    .await;
    let units: u128 = result(&alnt)["available"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();
    let expected = format!("{}.{:03}", units / 1_000, units % 1_000);
    assert_eq!(result(&alnt)["display"], expected.as_str());

    // The same transaction again: refused, with the protocol error named.
    let again = rpc(&service, "submitTransaction", json!({ "tx": tx })).await;
    assert_eq!(error_code(&again), -32010);
    assert_eq!(again["error"]["data"]["name"], "TX_NONCE_TOO_LOW");
}

#[tokio::test]
async fn rest_and_json_rpc_return_identical_data() {
    let service = service();
    let (tx, to) = signed_transfer(&service, ONE_AEY, 0);
    let tx_id = result(&rpc(&service, "submitTransaction", json!({ "tx": tx })).await)["txId"]
        .as_str()
        .unwrap()
        .to_owned();
    let network = service.backend.network();
    let address = to.to_text(network.network_kind());
    let block = result(&rpc(&service, "getBlockByHeight", json!({ "height": 1 })).await)["id"]
        .as_str()
        .unwrap()
        .to_owned();

    let pairs: Vec<(&str, Value, String)> = vec![
        ("getNetworkStatus", json!({}), "/network/status".to_owned()),
        ("getChainHead", json!({}), "/chain/head".to_owned()),
        (
            "getBlockByHeight",
            json!({ "height": 1 }),
            "/blocks/height/1".to_owned(),
        ),
        (
            "getBlock",
            json!({ "block": block }),
            format!("/blocks/{block}"),
        ),
        (
            "getTransaction",
            json!({ "txId": tx_id }),
            format!("/transactions/{tx_id}"),
        ),
        (
            "getReceipt",
            json!({ "txId": tx_id }),
            format!("/receipts/{tx_id}"),
        ),
        (
            "getAccount",
            json!({ "address": address }),
            format!("/accounts/{address}"),
        ),
        ("getAssets", json!({}), "/assets".to_owned()),
        (
            "getMonetarySupply",
            json!({ "asset": "AEY" }),
            "/monetary/AEY/supply".to_owned(),
        ),
        ("getValidatorSet", json!({}), "/validators".to_owned()),
    ];
    for (method, params, path) in pairs {
        let via_rpc = rpc(&service, method, params).await;
        let via_rest = route(&service, "GET", &path, &[], &[]).await;
        assert_eq!(via_rest.status, 200, "{path}: {}", via_rest.body);
        assert_eq!(result(&via_rpc), &via_rest.body, "{method} vs {path}");
    }
    // A chosen epoch arrives as a query parameter.
    let via_rpc = rpc(&service, "getValidatorSet", json!({ "epoch": 0 })).await;
    let query = [("epoch".to_owned(), "0".to_owned())];
    let via_rest = route(&service, "GET", "/validators", &query, &[]).await;
    assert_eq!(via_rest.status, 200, "{}", via_rest.body);
    assert_eq!(result(&via_rpc), &via_rest.body);
    assert_eq!(via_rest.body["epoch"], 0);
    let future = rpc(&service, "getValidatorSet", json!({ "epoch": 9_999 })).await;
    assert!(
        future.get("error").is_some(),
        "an epoch that has not begun is refused: {future}"
    );
    let balance = rpc(
        &service,
        "getBalance",
        json!({ "address": address, "asset": "AEY" }),
    )
    .await;
    let rest = route(
        &service,
        "GET",
        &format!("/accounts/{address}/balances"),
        &[("asset".to_owned(), "AEY".to_owned())],
        &[],
    )
    .await;
    assert_eq!(&Value::Array(vec![result(&balance).clone()]), &rest.body);

    // Errors match too: not found is -32002 and HTTP 404.
    let missing = rpc(&service, "getBlockByHeight", json!({ "height": 999 })).await;
    assert_eq!(error_code(&missing), -32002);
    assert_eq!(
        route(&service, "GET", "/blocks/height/999", &[], &[])
            .await
            .status,
        404
    );
    // Submitting through REST works the same way.
    let (tx2, _) = signed_transfer(&service, ONE_AEY, 0);
    let posted = route(
        &service,
        "POST",
        "/transactions",
        &[],
        json!({ "tx": tx2 }).to_string().as_bytes(),
    )
    .await;
    assert_eq!(posted.status, 200, "{}", posted.body);
    assert_eq!(posted.body["status"], "ACCEPTED");
}

#[tokio::test]
async fn json_rpc_2_0_is_strict() {
    let service = service();
    let code = |v: Option<Value>| error_code(&v.unwrap());
    // Parse error, missing version, bad ids, positional params, unknown method and parameter.
    assert_eq!(code(raw(&service, "{not json").await), -32700);
    assert_eq!(
        code(raw(&service, r#"{"id":1,"method":"getAssets"}"#).await),
        -32600
    );
    assert_eq!(
        code(
            raw(
                &service,
                r#"{"jsonrpc":"2.0","id":null,"method":"getAssets"}"#
            )
            .await
        ),
        -32600
    );
    assert_eq!(
        code(
            raw(
                &service,
                r#"{"jsonrpc":"2.0","id":1.5,"method":"getAssets"}"#
            )
            .await
        ),
        -32600
    );
    assert_eq!(
        code(
            raw(
                &service,
                r#"{"jsonrpc":"2.0","id":1,"method":"getBlockByHeight","params":[1]}"#
            )
            .await
        ),
        -32602
    );
    assert_eq!(
        code(
            raw(
                &service,
                r#"{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}"#
            )
            .await
        ),
        -32601
    );
    assert_eq!(
        code(
            raw(
                &service,
                r#"{"jsonrpc":"2.0","id":1,"method":"getAssets","params":{"x":1}}"#
            )
            .await
        ),
        -32602
    );
    // A 0x-prefixed value is refused wherever it appears.
    assert_eq!(
        code(
            raw(
                &service,
                r#"{"jsonrpc":"2.0","id":1,"method":"submitTransaction","params":{"tx":"0xabcd"}}"#
            )
            .await
        ),
        -32602
    );
    assert_eq!(
        route(&service, "GET", "/accounts/0xabc", &[], &[])
            .await
            .status,
        400
    );
    // Nesting beyond 32 levels.
    let deep = format!(
        r#"{{"jsonrpc":"2.0","id":1,"method":"getAssets","params":{{"a":{}1{}}}}}"#,
        "[".repeat(40),
        "]".repeat(40)
    );
    assert_eq!(code(raw(&service, &deep).await), -32600);

    // A notification gets no response, even when it fails.
    assert_eq!(
        raw(&service, r#"{"jsonrpc":"2.0","method":"getAssets"}"#).await,
        None
    );
    assert_eq!(
        raw(&service, r#"{"jsonrpc":"2.0","method":"nope"}"#).await,
        None
    );

    // A batch: answers for calls with ids, none for the notification.
    let batch = r#"[{"jsonrpc":"2.0","id":"a","method":"getAssets"},{"jsonrpc":"2.0","method":"getAssets"},{"jsonrpc":"2.0","id":2,"method":"nope"}]"#;
    let answers = raw(&service, batch).await.unwrap();
    let answers = answers.as_array().unwrap();
    assert_eq!(answers.len(), 2);
    assert!(
        answers
            .iter()
            .any(|a| a["id"] == "a" && a.get("result").is_some())
    );
    assert!(
        answers
            .iter()
            .any(|a| a["id"] == 2 && a["error"]["code"] == -32601)
    );
    // Empty and oversized batches.
    assert_eq!(code(raw(&service, "[]").await), -32600);
    let big = format!(
        "[{}]",
        vec![r#"{"jsonrpc":"2.0","id":1,"method":"getAssets"}"#; 51].join(",")
    );
    assert_eq!(code(raw(&service, &big).await), -32600);
}

#[tokio::test]
async fn bad_identifiers_name_the_problem() {
    let service = service();
    let answer = rpc(&service, "getTransaction", json!({ "txId": "AL:Tnope" })).await;
    assert_eq!(error_code(&answer), -32602);
    let answer = rpc(
        &service,
        "getBalance",
        json!({ "address": "AL:qqq", "asset": "AEY" }),
    )
    .await;
    assert_eq!(error_code(&answer), -32602);
    let answer = rpc(
        &service,
        "getBalance",
        json!({ "address": "x", "asset": "DOGE" }),
    )
    .await;
    assert_eq!(error_code(&answer), -32602);
    let _ = ErrorCode::TxNonceTooLow;
}

proptest::proptest! {
    #![proptest_config(proptest::prelude::ProptestConfig::with_cases(256))]

    /// Arbitrary bodies never panic the dispatcher.
    #[test]
    fn any_body_is_answered_or_ignored(body in proptest::collection::vec(proptest::num::u8::ANY, 0..256)) {
        let service = service();
        let runtime = tokio::runtime::Builder::new_current_thread().build().unwrap();
        let _ = runtime.block_on(jsonrpc::handle(&service, &body));
    }
}
