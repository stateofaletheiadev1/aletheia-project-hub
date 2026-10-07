//! AEY monetary operations and attacks on them (spec Sections 18.4, 18.5, 18.8; Phase 7 exit:
//! "monetary attack tests").
//!
//! Every block here also passes the supply check that runs after each block (I1-I8), so each
//! accepted operation is independently confirmed to have moved balances and the ledger
//! together.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects,
    clippy::as_conversions,
    clippy::cast_possible_truncation
)]

use aletheia_core::monetary::{
    AssetAmount, IndexedSignature, MintAuthorization, Redemption, ReserveAttestation,
};
use aletheia_core::{
    Address, AssetId, ChainId, Epoch, ErrorCode, Hash32, NetworkIdentity, Payload,
};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use aletheia_execution::{Receipt, ReceiptStatus};
use aletheia_monetary::SupplyLedger;
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};

const ACCOUNTS: usize = 3;
const FUNDED_AEY: u128 = 100 * ONE_AEY;
const GENESIS_AEY: u128 = ACCOUNTS as u128 * FUNDED_AEY;
const CAPACITY: u128 = GENESIS_AEY + 1_000 * ONE_AEY;
const EPOCH_CAP: u128 = 600 * ONE_AEY;
const FEED: u32 = 1;
const MAX_AGE: u64 = 20;

fn key(seed: u8) -> Ed25519SigningKey {
    Ed25519SigningKey::from_seed(&Secret::new([seed; 32]))
}
fn authority(i: usize) -> Ed25519SigningKey {
    key(50 + i as u8)
}
fn agent(i: usize) -> Ed25519SigningKey {
    key(60 + i as u8)
}
fn attestor(i: usize) -> Ed25519SigningKey {
    key(70 + i as u8)
}

fn hex_keys(keys: impl Iterator<Item = Ed25519SigningKey>) -> String {
    keys.map(|k| {
        format!(
            "\"{}\"",
            aletheia_core::base16::encode(&k.public_key().to_bytes())
        )
    })
    .collect::<Vec<_>>()
    .join(", ")
}

/// 2-of-3 authority, one redemption agent, 2-of-3 attestors (3 for moves over 10%), reserve
/// ratio enforced at 100%.
fn devnet(enforce_ratio: bool) -> Devnet {
    let monetary = format!(
        "\n[monetary]\nauthority_keys = [{}]\nauthority_threshold = 2\nredemption_agents = [{}]\nattestors = [{}]\nattestor_threshold = 2\nattestor_threshold_large_deviation = 3\nmax_deviation_bps = 1000\nmax_attestation_age_slots = {MAX_AGE}\nreserve_feed_id = {FEED}\nenforce_reserve_ratio = {enforce_ratio}\nmin_reserve_ratio_bps = 10000\naey_authorized_capacity = \"{CAPACITY}\"\naey_epoch_issuance_cap = \"{EPOCH_CAP}\"\n",
        hex_keys((0..3).map(authority)),
        hex_keys((0..1).map(agent)),
        hex_keys((0..3).map(attestor)),
    );
    Devnet::with_genesis_extra(ACCOUNTS, FUNDED_AEY, 1_000 * ONE_ALNT, &monetary)
}

fn sign_all(keys: &[(u8, Ed25519SigningKey)], digest: &Hash32) -> Vec<IndexedSignature> {
    keys.iter()
        .map(|(index, key)| IndexedSignature {
            index: *index,
            signature: key.sign(digest).to_bytes(),
        })
        .collect()
}

fn authorization(
    net: &Devnet,
    id: u8,
    asset: AssetId,
    amount: u128,
    destination: Address,
    signers: &[usize],
) -> MintAuthorization {
    let mut authorization = MintAuthorization {
        authorization_id: Hash32::from_bytes([id; 32]),
        asset,
        amount,
        destination,
        reserve_ref: Hash32::from_bytes([0xee; 32]),
        valid_until_epoch: 5,
        signatures: Vec::new(),
    };
    let signers: Vec<(u8, Ed25519SigningKey)> =
        signers.iter().map(|&i| (i as u8, authority(i))).collect();
    authorization.signatures = sign_all(&signers, &authorization.digest(&net.network));
    authorization
}

fn attestation(
    net: &Devnet,
    value: u128,
    observed_slot: u64,
    signers: &[usize],
) -> ReserveAttestation {
    let mut attestation = ReserveAttestation {
        feed_id: FEED,
        epoch: 0,
        value,
        observed_slot,
        evidence_ref: Hash32::from_bytes([0xab; 32]),
        signatures: Vec::new(),
    };
    let signers: Vec<(u8, Ed25519SigningKey)> =
        signers.iter().map(|&i| (i as u8, attestor(i))).collect();
    attestation.signatures = sign_all(&signers, &attestation.digest(&net.network));
    attestation
}

/// One transaction per block, as methods so arguments may borrow the devnet (two-phase
/// borrows apply to method receivers).
trait Submit {
    /// Submits one transaction from account `from` in its own block; returns its receipt.
    fn submit(&mut self, from: usize, payload: Payload) -> Receipt;
    fn mint(&mut self, authorization: MintAuthorization) -> Receipt;
}

impl Submit for Devnet {
    fn submit(&mut self, from: usize, payload: Payload) -> Receipt {
        let nonce = self.next_nonce(from);
        let mut body = self.body(from, nonce, payload);
        body.fee.eu_limit = 100_000;
        body.fee.max_fee = 100_000;
        let tx = self.sign(from, body);
        let (_, executed) = self.produce(vec![tx]).expect("the block is valid");
        executed.receipts[0].clone()
    }

    fn mint(&mut self, authorization: MintAuthorization) -> Receipt {
        self.submit(0, Payload::Mint(Box::new(authorization)))
    }
}

fn assert_failed(receipt: &Receipt, code: ErrorCode) {
    assert_eq!(
        receipt.status,
        ReceiptStatus::FailedExecution,
        "{receipt:?}"
    );
    assert_eq!(
        receipt.error_code,
        code.get(),
        "expected {code:?}, got {receipt:?}"
    );
    assert!(
        receipt.fee_amount > 0,
        "a failed operation still pays its fee"
    );
}

fn aey(net: &Devnet) -> SupplyLedger {
    net.records()
        .supply_ledger(&net.view(), AssetId::AEY)
        .unwrap()
        .unwrap()
}

/// A fresh attestation covering everything up to the capacity.
fn attest_fully(net: &mut Devnet) {
    let slot = net.next_slot().get();
    let receipt = net.submit(
        0,
        Payload::ReserveAttestation(Box::new(attestation(net, CAPACITY, slot, &[0, 1]))),
    );
    assert_eq!(receipt.status, ReceiptStatus::Success, "{receipt:?}");
}

#[test]
fn an_authorized_mint_issues_aey_and_updates_the_ledger() {
    let mut net = devnet(true);
    attest_fully(&mut net);
    let to = net.address(1);
    let receipt = net.mint(authorization(
        &net,
        1,
        AssetId::AEY,
        250 * ONE_AEY,
        to,
        &[0, 2],
    ));
    assert_eq!(receipt.status, ReceiptStatus::Success, "{receipt:?}");
    assert_eq!(
        net.balance(&to, AssetId::AEY).available,
        FUNDED_AEY + 250 * ONE_AEY
    );
    let ledger = aey(&net);
    assert_eq!(ledger.issued_total, GENESIS_AEY + 250 * ONE_AEY);
    assert_eq!(ledger.outstanding_liabilities, ledger.issued_total);
    assert_eq!(ledger.issued_this_epoch, 250 * ONE_AEY);
    assert_eq!(receipt.events.len(), 1, "a mint event");
}

#[test]
fn an_authorization_mints_exactly_once() {
    let mut net = devnet(true);
    attest_fully(&mut net);
    let to = net.address(1);
    let auth = authorization(&net, 2, AssetId::AEY, ONE_AEY, to, &[0, 1]);
    assert_eq!(net.mint(auth.clone()).status, ReceiptStatus::Success);
    // The same authorization again, by anyone: refused, nothing issued.
    let before = aey(&net);
    assert_failed(
        &net.submit(2, Payload::Mint(Box::new(auth))),
        ErrorCode::MintAuthorizationConsumed,
    );
    assert_eq!(aey(&net).issued_total, before.issued_total);
}

#[test]
fn too_few_unknown_forged_or_tampered_signatures_are_refused() {
    let mut net = devnet(false);
    let to = net.address(1);
    let issued = aey(&net).issued_total;

    // One signature where two are required.
    let r = net.mint(authorization(&net, 3, AssetId::AEY, ONE_AEY, to, &[0]));
    assert_failed(&r, ErrorCode::MonetaryAuthorizationInvalid);

    // A signer index nobody is registered at.
    let mut unknown = authorization(&net, 4, AssetId::AEY, ONE_AEY, to, &[0, 1]);
    unknown.signatures[1].index = 7;
    assert_failed(&net.mint(unknown), ErrorCode::MonetaryAuthorizationInvalid);

    // An outsider signing in authority 1's place.
    let mut forged = authorization(&net, 5, AssetId::AEY, ONE_AEY, to, &[0]);
    let digest = forged.digest(&net.network);
    forged.signatures.push(IndexedSignature {
        index: 1,
        signature: key(99).sign(&digest).to_bytes(),
    });
    assert_failed(&net.mint(forged), ErrorCode::MonetaryAuthorizationInvalid);

    // Validly signed, then the amount raised.
    let mut tampered = authorization(&net, 6, AssetId::AEY, ONE_AEY, to, &[0, 1]);
    tampered.amount = 1_000 * ONE_AEY;
    assert_failed(&net.mint(tampered), ErrorCode::MonetaryAuthorizationInvalid);

    // Validly signed for another chain.
    let mut other = authorization(&net, 7, AssetId::AEY, ONE_AEY, to, &[]);
    let foreign =
        NetworkIdentity::new(ChainId::new(9999), net.network.network_kind(), Hash32::ZERO);
    other.signatures = sign_all(
        &[(0, authority(0)), (1, authority(1))],
        &other.digest(&foreign),
    );
    assert_failed(&net.mint(other), ErrorCode::MonetaryAuthorizationInvalid);

    assert_eq!(aey(&net).issued_total, issued, "nothing was issued");
}

#[test]
fn one_authority_signing_twice_does_not_decode() {
    let net = devnet(false);
    let mut doubled = authorization(&net, 8, AssetId::AEY, ONE_AEY, net.address(1), &[0, 0]);
    doubled.signatures[1].signature = doubled.signatures[0].signature;
    let body = net.body(0, 0, Payload::Mint(Box::new(doubled)));
    let tx = net.sign(0, body);
    assert_eq!(
        net.verify(&[tx]).unwrap_err().code(),
        ErrorCode::DecodeNonCanonical
    );
}

#[test]
fn alnt_has_no_issuance_or_redemption_path() {
    let mut net = devnet(false);
    let to = net.address(1);
    let r = net.mint(authorization(&net, 9, AssetId::ALNT, ONE_ALNT, to, &[0, 1]));
    assert_failed(&r, ErrorCode::AssetNotIssuable);
}

#[test]
fn an_expired_authorization_is_refused() {
    let mut net = devnet(false);
    net.epoch = Epoch::new(6);
    let to = net.address(1);
    let r = net.mint(authorization(&net, 10, AssetId::AEY, ONE_AEY, to, &[0, 1]));
    assert_failed(&r, ErrorCode::MintAuthorizationExpired);
}

#[test]
fn capacity_and_the_epoch_cap_bound_issuance() {
    let mut net = devnet(false);
    let to = net.address(1);
    // Within capacity (1,000 AEY of room) but over the 600 AEY epoch cap.
    let r = net.mint(authorization(
        &net,
        11,
        AssetId::AEY,
        700 * ONE_AEY,
        to,
        &[0, 1],
    ));
    assert_failed(&r, ErrorCode::EpochIssuanceCapExceeded);
    assert_eq!(
        net.mint(authorization(
            &net,
            12,
            AssetId::AEY,
            600 * ONE_AEY,
            to,
            &[0, 1]
        ))
        .status,
        ReceiptStatus::Success
    );
    let r = net.mint(authorization(&net, 13, AssetId::AEY, ONE_AEY, to, &[0, 1]));
    assert_failed(&r, ErrorCode::EpochIssuanceCapExceeded);

    // A new epoch resets the epoch counter; capacity still binds: 400 AEY of room is left.
    net.epoch = Epoch::new(1);
    let r = net.mint(authorization(
        &net,
        14,
        AssetId::AEY,
        401 * ONE_AEY,
        to,
        &[0, 1],
    ));
    assert_failed(&r, ErrorCode::MonetaryCapacityExceeded);
    assert_eq!(
        net.mint(authorization(
            &net,
            15,
            AssetId::AEY,
            400 * ONE_AEY,
            to,
            &[0, 1]
        ))
        .status,
        ReceiptStatus::Success
    );
    assert_eq!(aey(&net).outstanding(AssetId::AEY).unwrap(), CAPACITY);
}

#[test]
fn without_a_fresh_attestation_minting_stops_but_transfers_continue() {
    let mut net = devnet(true);
    let to = net.address(1);
    let r = net.mint(authorization(&net, 16, AssetId::AEY, ONE_AEY, to, &[0, 1]));
    assert_failed(&r, ErrorCode::ReserveAttestationStale);

    attest_fully(&mut net);
    for _ in 0..=MAX_AGE {
        let b = net.address(2);
        let nonce = net.next_nonce(1);
        net.produce(vec![net.transfer(1, nonce, b, AssetId::AEY, 1)])
            .unwrap();
    }
    let r = net.mint(authorization(&net, 17, AssetId::AEY, ONE_AEY, to, &[0, 1]));
    assert_failed(&r, ErrorCode::ReserveAttestationStale);
}

#[test]
fn minting_beyond_the_attested_reserve_is_refused() {
    let mut net = devnet(true);
    // The reserve covers the genesis supply plus 10 AEY at 100%.
    let slot = net.next_slot().get();
    let a = attestation(&net, GENESIS_AEY + 10 * ONE_AEY, slot, &[0, 1]);
    assert_eq!(
        net.submit(0, Payload::ReserveAttestation(Box::new(a)))
            .status,
        ReceiptStatus::Success
    );
    let to = net.address(1);
    let r = net.mint(authorization(
        &net,
        18,
        AssetId::AEY,
        11 * ONE_AEY,
        to,
        &[0, 1],
    ));
    assert_failed(&r, ErrorCode::ReserveRatioInsufficient);
    let r = net.mint(authorization(
        &net,
        19,
        AssetId::AEY,
        10 * ONE_AEY,
        to,
        &[0, 1],
    ));
    assert_eq!(r.status, ReceiptStatus::Success, "{r:?}");
}

#[test]
fn attestations_must_be_registered_fresh_newer_and_bounded() {
    let mut net = devnet(true);
    let slot = net.next_slot().get();

    // From an outsider in attestor 1's place.
    let mut outsider = attestation(&net, CAPACITY, slot, &[0]);
    let digest = outsider.digest(&net.network);
    outsider.signatures.push(IndexedSignature {
        index: 1,
        signature: key(98).sign(&digest).to_bytes(),
    });
    let r = net.submit(0, Payload::ReserveAttestation(Box::new(outsider)));
    assert_failed(&r, ErrorCode::MonetaryAuthorizationInvalid);

    // Observed in the future.
    let future = net.next_slot().get() + 5;
    let r = net.submit(
        0,
        Payload::ReserveAttestation(Box::new(attestation(&net, CAPACITY, future, &[0, 1]))),
    );
    assert_failed(&r, ErrorCode::AttestationRejected);

    // Accepted, then one observed no later than it.
    let slot = net.next_slot().get();
    let first = attestation(&net, CAPACITY, slot, &[0, 1]);
    assert_eq!(
        net.submit(0, Payload::ReserveAttestation(Box::new(first)))
            .status,
        ReceiptStatus::Success
    );
    let r = net.submit(
        0,
        Payload::ReserveAttestation(Box::new(attestation(&net, CAPACITY, slot, &[1, 2]))),
    );
    assert_failed(&r, ErrorCode::AttestationRejected);

    // A 50% drop needs all three attestors.
    let slot = net.next_slot().get();
    let r = net.submit(
        0,
        Payload::ReserveAttestation(Box::new(attestation(&net, CAPACITY / 2, slot, &[0, 1]))),
    );
    assert_failed(&r, ErrorCode::AttestationRejected);
    let slot = net.next_slot().get();
    let r = net.submit(
        0,
        Payload::ReserveAttestation(Box::new(attestation(&net, CAPACITY / 2, slot, &[0, 1, 2]))),
    );
    assert_eq!(r.status, ReceiptStatus::Success, "{r:?}");
    let latest = net
        .records()
        .latest_attestation(&net.view(), FEED)
        .unwrap()
        .unwrap();
    assert_eq!(
        (latest.value, latest.sequence),
        (CAPACITY / 2, 1),
        "history keeps both"
    );
}

fn redemption(
    net: &Devnet,
    holder: usize,
    amount: u128,
    agent_key: &Ed25519SigningKey,
) -> Redemption {
    let mut redemption = Redemption {
        asset: AssetId::AEY,
        amount,
        settlement_ref: Hash32::from_bytes([0x5e; 32]),
        agent_index: 0,
        agent_signature: [0; 64],
    };
    let digest = redemption.digest(&net.network, &net.address(holder), net.next_nonce(holder));
    redemption.agent_signature = agent_key.sign(&digest).to_bytes();
    redemption
}

#[test]
fn a_co_signed_redemption_burns_and_requests_settlement() {
    let mut net = devnet(false);
    let r = redemption(&net, 1, 30 * ONE_AEY, &agent(0));
    let receipt = net.submit(1, Payload::Redeem(Box::new(r)));
    assert_eq!(receipt.status, ReceiptStatus::Success, "{receipt:?}");
    let ledger = aey(&net);
    assert_eq!(ledger.burned_total, 30 * ONE_AEY);
    assert_eq!(ledger.redeemed_total, 30 * ONE_AEY);
    assert_eq!(ledger.outstanding_liabilities, GENESIS_AEY - 30 * ONE_AEY);
    assert_eq!(
        net.balance(&net.address(1), AssetId::AEY).available,
        FUNDED_AEY - 30 * ONE_AEY
    );
    assert_eq!(receipt.events.len(), 1, "RedemptionRequested");
}

#[test]
fn redemptions_without_a_valid_agent_co_signature_are_refused() {
    let mut net = devnet(false);
    // Signed by someone who is not an agent.
    let r = redemption(&net, 1, ONE_AEY, &key(97));
    assert_failed(
        &net.submit(1, Payload::Redeem(Box::new(r))),
        ErrorCode::MonetaryAuthorizationInvalid,
    );
    // A genuine co-signature for account 1, replayed by account 2.
    let stolen = redemption(&net, 1, ONE_AEY, &agent(0));
    assert_failed(
        &net.submit(2, Payload::Redeem(Box::new(stolen))),
        ErrorCode::MonetaryAuthorizationInvalid,
    );
    // A genuine co-signature reused at a later nonce by its own holder.
    let used = redemption(&net, 1, ONE_AEY, &agent(0));
    assert_eq!(
        net.submit(1, Payload::Redeem(Box::new(used))).status,
        ReceiptStatus::Success
    );
    assert_failed(
        &net.submit(1, Payload::Redeem(Box::new(used))),
        ErrorCode::MonetaryAuthorizationInvalid,
    );
    assert_eq!(aey(&net).redeemed_total, ONE_AEY, "only the genuine one");
}

#[test]
fn burn_lock_and_unlock_move_the_right_buckets() {
    let mut net = devnet(false);
    let holder = net.address(1);
    let burn = AssetAmount {
        asset: AssetId::AEY,
        amount: 5 * ONE_AEY,
    };
    assert_eq!(
        net.submit(1, Payload::Burn(burn)).status,
        ReceiptStatus::Success
    );
    assert_eq!(aey(&net).burned_total, 5 * ONE_AEY);

    let lock = AssetAmount {
        asset: AssetId::AEY,
        amount: 20 * ONE_AEY,
    };
    assert_eq!(
        net.submit(1, Payload::Lock(lock)).status,
        ReceiptStatus::Success
    );
    assert_eq!(net.balance(&holder, AssetId::AEY).locked, 20 * ONE_AEY);
    assert_eq!(aey(&net).locked, 20 * ONE_AEY);

    let too_much = AssetAmount {
        asset: AssetId::AEY,
        amount: 21 * ONE_AEY,
    };
    assert_failed(
        &net.submit(1, Payload::Unlock(too_much)),
        ErrorCode::InsufficientLocked,
    );
    let back = AssetAmount {
        asset: AssetId::AEY,
        amount: 20 * ONE_AEY,
    };
    assert_eq!(
        net.submit(1, Payload::Unlock(back)).status,
        ReceiptStatus::Success
    );
    assert_eq!(aey(&net).locked, 0);

    let overdraw = AssetAmount {
        asset: AssetId::AEY,
        amount: 1_000 * ONE_AEY,
    };
    assert_failed(
        &net.submit(1, Payload::Burn(overdraw)),
        ErrorCode::InsufficientBalance,
    );
    // Locked funds cannot be spent: lock everything, then try to transfer.
    let all = net.balance(&holder, AssetId::AEY).available;
    net.submit(
        1,
        Payload::Lock(AssetAmount {
            asset: AssetId::AEY,
            amount: all,
        }),
    );
    let r = net.submit(
        1,
        Payload::Transfer(aletheia_core::TransferLeg {
            recipient: net.address(2),
            asset: AssetId::AEY,
            amount: 1,
        }),
    );
    assert_failed(&r, ErrorCode::InsufficientBalance);
}

#[test]
fn a_chain_without_a_monetary_authority_cannot_mint() {
    let mut net = Devnet::new(2, ONE_AEY, 1_000 * ONE_ALNT);
    let to = net.address(1);
    let r = net.mint(authorization(&net, 20, AssetId::AEY, 1, to, &[0, 1]));
    assert_failed(&r, ErrorCode::AssetNotIssuable);
}
