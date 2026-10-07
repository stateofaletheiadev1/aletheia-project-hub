//! Supply invariants under random traffic (spec Section 18.4; Phase 6 exit: "supply
//! invariants property-tested").
//!
//! Random blocks of transfers and batch transfers in both native assets, with amounts that
//! often exceed the sender's balance (failed payloads still pay their fee) and fees in either
//! asset. After every block, a full audit: the sum of every balance equals the ledger's
//! digital supply, I1-I8 hold, and with no issuance path in version 1 the issued supply
//! never moves. A block that would create value is refused by the per-block check.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_core::{Address, AssetId, ErrorCode, Payload, TransferLeg};
use aletheia_execution::executor::check_supply;
use aletheia_execution::model::FEE_POOL;
use aletheia_execution::{Rules, VerifiedTransaction};
use aletheia_monetary::SupplyLedger;
use aletheia_state::StateOverlay;
use aletheia_test_harness::{Devnet, EU_PRICE_AEY, ONE_AEY, ONE_ALNT};
use proptest::prelude::*;

const ACCOUNTS: usize = 5;
const ASSETS: [AssetId; 2] = [AssetId::AEY, AssetId::ALNT];

/// One random transaction: sender, fee asset, and legs as (recipient index, asset, amount
/// as a fraction in thousandths of the sender's balance, up to 1.5x).
#[derive(Debug, Clone)]
struct Spec {
    from: usize,
    fee_in_aey: bool,
    legs: Vec<(usize, bool, u16)>,
}

fn spec() -> impl Strategy<Value = Spec> {
    (
        0..ACCOUNTS,
        any::<bool>(),
        proptest::collection::vec((0..ACCOUNTS, any::<bool>(), 0u16..1_500), 1..4),
    )
        .prop_map(|(from, fee_in_aey, legs)| Spec {
            from,
            fee_in_aey,
            legs,
        })
}

fn every_holder(net: &Devnet) -> Vec<Address> {
    let mut holders: Vec<Address> = (0..ACCOUNTS).map(|i| net.address(i)).collect();
    holders.push(FEE_POOL);
    holders
}

/// Full audit (I7 in full, plus I1-I8): every balance summed against the ledger.
fn audit(net: &Devnet, genesis: &[SupplyLedger; 2]) {
    let records = net.records();
    for (asset, initial) in ASSETS.iter().zip(genesis) {
        let ledger = records.supply_ledger(&net.view(), *asset).unwrap().unwrap();
        ledger.check(*asset).unwrap();
        let held: u128 = every_holder(net)
            .iter()
            .map(|holder| {
                let balance = net.balance(holder, *asset);
                balance.available + balance.locked
            })
            .sum();
        assert_eq!(held, ledger.digital(*asset).unwrap(), "asset {asset}");
        assert_eq!(
            ledger.issued_total, initial.issued_total,
            "no issuance in v1"
        );
        assert_eq!(ledger.burned_total, initial.burned_total);
    }
}

fn build(
    net: &Devnet,
    nonces: &mut [u64; ACCOUNTS],
    spec: &Spec,
) -> aletheia_core::SignedTransaction {
    let legs: Vec<TransferLeg> = spec
        .legs
        .iter()
        .map(|&(to, aey, fraction)| {
            let asset = if aey { AssetId::AEY } else { AssetId::ALNT };
            let available = net.balance(&net.address(spec.from), asset).available;
            TransferLeg {
                recipient: net.address(to),
                asset,
                amount: available / 1_000 * u128::from(fraction),
            }
        })
        .collect();
    let payload = if legs.len() == 1 {
        Payload::Transfer(legs[0])
    } else {
        Payload::BatchTransfer(legs)
    };
    let mut body = net.body(spec.from, nonces[spec.from], payload);
    if spec.fee_in_aey {
        body.fee.fee_asset = AssetId::AEY;
        body.fee.max_fee = u128::from(body.fee.eu_limit) * EU_PRICE_AEY;
    }
    nonces[spec.from] += 1;
    net.sign(spec.from, body)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(48))]

    #[test]
    fn every_block_conserves_both_assets(
        blocks in proptest::collection::vec(proptest::collection::vec(spec(), 0..6), 1..6),
    ) {
        let mut net = Devnet::new(ACCOUNTS, 50 * ONE_AEY, 50 * ONE_ALNT);
        let records = net.records();
        let genesis = ASSETS.map(|asset| records.supply_ledger(&net.view(), asset).unwrap().unwrap());
        audit(&net, &genesis);
        for block in &blocks {
            let mut nonces = [0u64; ACCOUNTS];
            for (i, nonce) in nonces.iter_mut().enumerate() {
                *nonce = net.next_nonce(i);
            }
            let txs: Vec<_> = block.iter().map(|spec| build(&net, &mut nonces, spec)).collect();
            // A block can be invalid as a whole (say, a fee no longer affordable after an
            // earlier transfer in it); then nothing changes and the audit still holds.
            let _ = net.produce(txs);
            audit(&net, &genesis);
        }
    }
}

#[test]
fn a_block_that_creates_value_is_refused() {
    let net = Devnet::new(2, 10 * ONE_AEY, 10 * ONE_ALNT);
    let records = net.records();
    let tx = net.transfer(0, 0, net.address(1), AssetId::ALNT, 5);
    let verified: Vec<VerifiedTransaction> = net.verify(&[tx]).unwrap();
    let view = net.view();
    let mut overlay = StateOverlay::new(&view);
    // The recipient gains 5 Mites and nobody pays them: value from nowhere.
    let recipient = net.address(1);
    let mut balance = records
        .balance(&overlay, &recipient, AssetId::ALNT)
        .unwrap();
    balance.available += 5;
    records.put_balance(&mut overlay, &recipient, AssetId::ALNT, balance);
    let error = check_supply(Rules::V1, &records, &view, &overlay, &verified).unwrap_err();
    assert_eq!(error.code(), ErrorCode::MonetaryInvariantViolated);
    assert!(error.detail().contains("I7"), "{error}");
}

#[test]
fn a_ledger_change_without_matching_balances_is_refused() {
    let net = Devnet::new(2, 10 * ONE_AEY, 10 * ONE_ALNT);
    let records = net.records();
    let tx = net.transfer(0, 0, net.address(1), AssetId::AEY, ONE_AEY);
    let verified = net.verify(&[tx]).unwrap();
    let view = net.view();
    let mut overlay = StateOverlay::new(&view);
    // Supply recorded as issued and circulating, with no account holding it.
    let mut ledger = records
        .supply_ledger(&overlay, AssetId::AEY)
        .unwrap()
        .unwrap();
    ledger.issued_total += 7;
    ledger.circulating += 7;
    ledger.authorized_capacity += 7;
    ledger.outstanding_liabilities += 7;
    records.put_supply_ledger(&mut overlay, AssetId::AEY, &ledger);
    let error = check_supply(Rules::V1, &records, &view, &overlay, &verified).unwrap_err();
    assert!(error.detail().contains("I7"), "{error}");
}

#[test]
fn genesis_records_each_assets_whole_supply() {
    let net = Devnet::new(3, 4 * ONE_AEY, 9 * ONE_ALNT);
    let records = net.records();
    let aey = records
        .supply_ledger(&net.view(), AssetId::AEY)
        .unwrap()
        .unwrap();
    let alnt = records
        .supply_ledger(&net.view(), AssetId::ALNT)
        .unwrap()
        .unwrap();
    assert_eq!(aey.issued_total, 12 * ONE_AEY);
    assert!(aey.reserve_backed, "AEY is reserve-backed");
    assert_eq!(aey.outstanding_liabilities, 12 * ONE_AEY);
    assert_eq!(alnt.issued_total, 27 * ONE_ALNT);
    assert!(!alnt.reserve_backed);
    assert_eq!(
        alnt.authorized_capacity, alnt.issued_total,
        "no ALnT issuance in v0.1"
    );
}

/// The random test's audit is meaningful only if blocks really move value: a known mix of a
/// successful transfer, a failed one that still pays its fee, and a batch.
#[test]
fn a_mixed_block_moves_value_and_still_conserves_it() {
    let mut net = Devnet::new(ACCOUNTS, 50 * ONE_AEY, 50 * ONE_ALNT);
    let records = net.records();
    let genesis = ASSETS.map(|asset| records.supply_ledger(&net.view(), asset).unwrap().unwrap());
    let (b, c) = (net.address(1), net.address(2));
    let batch = net.sign(
        2,
        net.body(
            2,
            0,
            Payload::BatchTransfer(vec![
                TransferLeg {
                    recipient: b,
                    asset: AssetId::AEY,
                    amount: ONE_AEY,
                },
                TransferLeg {
                    recipient: net.address(3),
                    asset: AssetId::ALNT,
                    amount: 7,
                },
            ]),
        ),
    );
    let (_, executed) = net
        .produce(vec![
            net.transfer(0, 0, c, AssetId::AEY, 3 * ONE_AEY),
            net.transfer(1, 0, c, AssetId::AEY, 500 * ONE_AEY), // more than it holds
            batch,
        ])
        .unwrap();
    let statuses: Vec<_> = executed.receipts.iter().map(|r| r.status).collect();
    assert_eq!(
        statuses
            .iter()
            .filter(|s| **s == aletheia_execution::ReceiptStatus::Success)
            .count(),
        2,
        "{statuses:?}"
    );
    assert!(
        executed.receipts.iter().all(|r| r.fee_amount > 0),
        "every transaction paid its fee"
    );
    assert!(net.balance(&FEE_POOL, AssetId::ALNT).available > 0);
    // Account 2 received 3 AEY and sent 1 AEY in its batch (fees are in ALnT).
    assert_eq!(net.balance(&c, AssetId::AEY).available, 52 * ONE_AEY);
    audit(&net, &genesis);
}
