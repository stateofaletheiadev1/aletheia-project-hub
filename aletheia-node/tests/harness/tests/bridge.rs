//! The bridge's on-chain part (spec Section 40A; Phase 12B): routes and guardian sets under
//! governance, transfers out and in with guardian quorum attestations, exact conversion,
//! limits, sequence order, replay, expiry, pauses, equivocation, the large-transfer delay and
//! flags, and the supply invariants I10-I12 under random flows.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_core::bridge::{
    Attestation, BridgeMessage, BridgeOp, BridgeRoute, Guardian, GuardianSet, RouteAsset,
    attestation_digest, control, control_digest, direction, kind, verification,
};
use aletheia_core::registry::{GovAction, RegistryOp, proposal_id};
use aletheia_core::{
    AssetId, ChainId, ErrorCode, Hash32, NetworkIdentity, NetworkKind, Payload, Slot,
};
use aletheia_crypto::Secret;
use aletheia_crypto::bls::{BlsSecretKey, BlsSignature, aggregate_signatures};
use aletheia_execution::bridge_model::Bridge;
use aletheia_execution::rules::v1::bridge::BRIDGE_ESCROW;
use aletheia_execution::{Receipt, ReceiptStatus};
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT, keys};

const EPOCH_SLOTS: u64 = 4;
/// Accounts: 0-2 the council, 3 Alice, 4 Bob, 5 a relayer.
const ALICE: usize = 3;
const BOB: usize = 4;
const RELAYER: usize = 5;
const ROUTE: u32 = 1;
const REMOTE_CHAIN: u32 = 101;
/// "USDC · route 1": a bridged asset with the remote token's 6 decimals.
const USDC: AssetId = AssetId::new(1003);
const ONE_USDC: u128 = 1_000_000;
const AEY_TOKEN: [u8; 20] = [0xAA; 20];
const USDC_TOKEN: [u8; 20] = [0xBB; 20];

struct Bed {
    net: Devnet,
    guardians: Vec<BlsSecretKey>,
    in_sequence: u64,
}

fn devnet() -> Devnet {
    let provisional = NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO);
    let council: Vec<String> = keys(3)
        .iter()
        .map(|k| {
            format!(
                "\"{}\"",
                aletheia_crypto::address::ed25519_account(&provisional, &k.public_key())
                    .to_text(NetworkKind::Devnet)
            )
        })
        .collect();
    let extra = format!(
        "\n[governance]\ncouncil = [{}]\nthreshold = 2\nepoch_slots = {EPOCH_SLOTS}\nvoting_epochs = 3\nexecution_window_epochs = 5\nmax_aey_capacity_increase = \"{}\"\n",
        council.join(", "),
        10 * ONE_AEY
    );
    Devnet::with_genesis_extra(6, 1_000 * ONE_AEY, 1_000 * ONE_ALNT, &extra)
}

fn submit(net: &mut Devnet, from: usize, payload: Payload) -> Receipt {
    let nonce = net.next_nonce(from);
    let mut body = net.body(from, nonce, payload);
    body.fee.eu_limit = 100_000;
    body.fee.max_fee = 100_000;
    body.valid_from_slot = net.next_slot();
    body.expiry_slot = Slot::new(net.next_slot().get() + 7_000);
    let tx = net.sign(from, body);
    let (_, executed) = net.produce(vec![tx]).expect("the block is valid");
    executed.receipts[0].clone()
}

fn ok(r: &Receipt) {
    assert_eq!(r.status, ReceiptStatus::Success, "{r:?}");
}

fn refused(r: &Receipt, code: ErrorCode) {
    assert_eq!(r.status, ReceiptStatus::FailedExecution, "{r:?}");
    assert_eq!(r.error_code, code.get(), "expected {code:?}: {r:?}");
}

fn govern(net: &mut Devnet, action: GovAction) -> Receipt {
    let nonce = net.next_nonce(0);
    let id = proposal_id(&net.network, &net.address(0), nonce, &action);
    ok(&submit(
        net,
        0,
        Payload::Registry(Box::new(RegistryOp::GovPropose {
            action: action.clone(),
        })),
    ));
    ok(&submit(
        net,
        1,
        Payload::Registry(Box::new(RegistryOp::GovVote {
            proposal_id: id,
            approve: true,
        })),
    ));
    for _ in 0..(action.timelock_epochs() + 1) * EPOCH_SLOTS {
        net.produce(Vec::new()).unwrap();
    }
    submit(
        net,
        RELAYER,
        Payload::Registry(Box::new(RegistryOp::GovExecute { proposal_id: id })),
    )
}

fn guardian_keys(count: u8, base: u8) -> Vec<BlsSecretKey> {
    (0..count)
        .map(|i| BlsSecretKey::from_key_material(&Secret::new([base + i; 32])).unwrap())
        .collect()
}

fn guardian_set(net: &Devnet, set_id: u32, keys: &[BlsSecretKey], threshold: u16) -> GuardianSet {
    GuardianSet {
        set_id,
        guardians: keys
            .iter()
            .map(|k| Guardian {
                public_key: k.public_key().to_bytes(),
                proof_of_possession: k.prove_possession(&net.network).to_bytes(),
            })
            .collect(),
        threshold,
    }
}

fn route() -> BridgeRoute {
    BridgeRoute {
        route_id: ROUTE,
        remote_chain_id: REMOTE_CHAIN,
        remote_address_len: 20,
        verification: verification::GUARDIANS,
        finality_depth: 64,
        guardian_set: 1,
        assets: vec![
            RouteAsset {
                asset: AssetId::AEY,
                direction: direction::BOTH,
                remote_token: AEY_TOKEN.to_vec(),
                remote_decimals: 6,
                bridged: false,
            },
            RouteAsset {
                asset: USDC,
                direction: direction::BOTH,
                remote_token: USDC_TOKEN.to_vec(),
                remote_decimals: 6,
                bridged: true,
            },
        ],
        per_tx_max: 50 * ONE_AEY,
        per_epoch_max: 120 * ONE_AEY,
        global_exposure_max: 500 * ONE_AEY,
        large_transfer_threshold: 30 * ONE_AEY,
        large_transfer_delay_epochs: 1,
        fee_bps: 10,
        pause_expiry_epochs: 3,
    }
}

/// A devnet with guardian set 1 (4 guardians, threshold 3) and route 1, open.
fn bed() -> Bed {
    let mut net = devnet();
    let guardians = guardian_keys(4, 70);
    let set = guardian_set(&net, 1, &guardians, 3);
    ok(&govern(
        &mut net,
        GovAction::RegisterGuardianSet(Box::new(set)),
    ));
    ok(&govern(
        &mut net,
        GovAction::UpsertBridgeRoute(Box::new(route())),
    ));
    let mut bed = Bed {
        net,
        guardians,
        in_sequence: 0,
    };
    // A new route starts paused by the council.
    refused(
        &bed.out(ALICE, AssetId::AEY, ONE_AEY),
        ErrorCode::BridgeRoutePaused,
    );
    ok(&govern(
        &mut bed.net,
        GovAction::SetBridgeRoutePaused {
            route_id: ROUTE,
            paused: false,
        },
    ));
    bed
}

impl Bed {
    fn attest(&self, digest: &Hash32, signers: &[usize]) -> Attestation {
        let signatures: Vec<BlsSignature> = signers
            .iter()
            .map(|&i| self.guardians[i].sign(digest))
            .collect();
        let refs: Vec<&BlsSignature> = signatures.iter().collect();
        Attestation {
            signers: signers.iter().fold(0u64, |bits, &i| bits | (1 << i)),
            aggregate: aggregate_signatures(&refs).unwrap().to_bytes(),
        }
    }

    fn out(&mut self, from: usize, asset: AssetId, amount: u128) -> Receipt {
        let op = BridgeOp::BridgeOut {
            route_id: ROUTE,
            asset,
            recipient: vec![0x11; 20],
            amount,
            max_fee: amount,
        };
        submit(&mut self.net, from, Payload::Bridge(Box::new(op)))
    }

    /// A remote message to `to`: AEY coming back, or USDC locked on the remote chain.
    fn message(&self, sequence: u64, asset: AssetId, to: usize, amount: u128) -> BridgeMessage {
        let (message_kind, token) = if asset == AssetId::AEY {
            (kind::BURN_AND_RELEASE, AEY_TOKEN)
        } else {
            (kind::LOCK_AND_MINT, USDC_TOKEN)
        };
        BridgeMessage {
            version: 1,
            source_chain: REMOTE_CHAIN,
            dest_chain: 0,
            route_id: ROUTE,
            sequence,
            kind: message_kind,
            asset,
            remote_token: token.to_vec(),
            sender: vec![0x22; 20],
            recipient: self.net.address(to).to_bytes().to_vec(),
            amount,
            fee: 0,
            expiry_slot: self.net.next_slot().get() + 1_000,
        }
    }

    fn deliver(&mut self, message: &BridgeMessage, signers: &[usize]) -> Receipt {
        let digest = attestation_digest(&self.net.network, &message.id(&self.net.network), ROUTE);
        let attestation = self.attest(&digest, signers);
        submit(
            &mut self.net,
            RELAYER,
            Payload::Bridge(Box::new(BridgeOp::BridgeIn {
                message: message.clone(),
                attestation,
            })),
        )
    }

    /// The next inbound message, delivered with guardians 0-2.
    fn inbound(&mut self, asset: AssetId, to: usize, amount: u128) -> (Receipt, BridgeMessage) {
        let message = self.message(self.in_sequence + 1, asset, to, amount);
        let receipt = self.deliver(&message, &[0, 1, 2]);
        if receipt.status == ReceiptStatus::Success {
            self.in_sequence += 1;
        }
        (receipt, message)
    }

    fn control(&mut self, action: u8, subject: Hash32, signers: &[usize]) -> Receipt {
        let pauses = self.route_state().pauses;
        let counter = if action == control::FLAG { 0 } else { pauses };
        let digest = control_digest(&self.net.network, action, ROUTE, &subject, counter);
        let attestation = self.attest(&digest, signers);
        let op = match action {
            control::FLAG => BridgeOp::FlagMessage {
                route_id: ROUTE,
                message_id: subject,
                attestation,
            },
            control::PAUSE => BridgeOp::PauseRoute {
                route_id: ROUTE,
                attestation,
            },
            _ => BridgeOp::ResumeRoute {
                route_id: ROUTE,
                attestation,
            },
        };
        submit(&mut self.net, RELAYER, Payload::Bridge(Box::new(op)))
    }

    fn route_state(&self) -> aletheia_execution::bridge_model::RouteState {
        let records = self.net.records();
        Bridge { records: &records }
            .route(&self.net.view(), ROUTE)
            .unwrap()
            .unwrap()
    }

    fn aey(&self, who: usize) -> u128 {
        self.net
            .balance(&self.net.address(who), AssetId::AEY)
            .available
    }

    fn ledger(&self, asset: AssetId) -> aletheia_monetary::SupplyLedger {
        self.net
            .records()
            .supply_ledger(&self.net.view(), asset)
            .unwrap()
            .unwrap()
    }

    fn epochs(&mut self, epochs: u64) {
        for _ in 0..epochs * EPOCH_SLOTS {
            self.net.produce(Vec::new()).unwrap();
        }
    }
}

#[test]
fn aey_goes_out_into_escrow_and_comes_back() {
    let mut bed = bed();
    let before = bed.aey(ALICE);
    let receipt = bed.out(ALICE, AssetId::AEY, 10 * ONE_AEY);
    ok(&receipt);
    let fee = 10 * ONE_AEY / 1_000;
    assert_eq!(bed.aey(ALICE), before - 10 * ONE_AEY - fee);
    assert_eq!(
        bed.net.balance(&BRIDGE_ESCROW, AssetId::AEY).available,
        10 * ONE_AEY
    );
    assert_eq!(bed.ledger(AssetId::AEY).bridge_escrow, 10 * ONE_AEY);
    let state = bed.route_state();
    assert_eq!((state.out_sequence, state.escrowed), (1, 10 * ONE_AEY));

    // The outbound message is in state under its id, with the next sequence.
    let id = receipt.events[0].topics[0];
    let records = bed.net.records();
    let stored = Bridge { records: &records }
        .outbound(&bed.net.view(), &id)
        .unwrap()
        .unwrap();
    assert_eq!(
        (stored.sequence, stored.kind, stored.dest_chain),
        (1, kind::LOCK_AND_MINT, REMOTE_CHAIN)
    );
    assert_eq!(stored.id(&bed.net.network), id);

    // Four come back to Bob.
    let bob = bed.aey(BOB);
    let (receipt, message) = bed.inbound(AssetId::AEY, BOB, 4 * ONE_AEY);
    ok(&receipt);
    assert_eq!(bed.aey(BOB), bob + 4 * ONE_AEY);
    assert_eq!(bed.ledger(AssetId::AEY).bridge_escrow, 6 * ONE_AEY);

    // Replay: the same message again is refused.
    refused(
        &bed.deliver(&message, &[1, 2, 3]),
        ErrorCode::BridgeSequenceGap,
    );
    assert_eq!(bed.aey(BOB), bob + 4 * ONE_AEY);

    // More than the route escrows cannot come back.
    let (receipt, _) = bed.inbound(AssetId::AEY, BOB, 7 * ONE_AEY);
    refused(&receipt, ErrorCode::BridgeLimitExceeded);
}

#[test]
fn forged_attestations_are_refused() {
    let mut bed = bed();
    ok(&bed.out(ALICE, AssetId::AEY, 10 * ONE_AEY));
    let message = bed.message(1, AssetId::AEY, BOB, ONE_AEY);

    // Too few signers.
    refused(
        &bed.deliver(&message, &[0, 1]),
        ErrorCode::BridgeAttestationInvalid,
    );

    // A quorum that signed another message.
    let other = bed.message(1, AssetId::AEY, ALICE, ONE_AEY);
    let digest = attestation_digest(&bed.net.network, &other.id(&bed.net.network), ROUTE);
    let attestation = bed.attest(&digest, &[0, 1, 2]);
    let op = BridgeOp::BridgeIn {
        message: message.clone(),
        attestation,
    };
    refused(
        &submit(&mut bed.net, RELAYER, Payload::Bridge(Box::new(op))),
        ErrorCode::BridgeAttestationInvalid,
    );

    // Keys outside the set, claiming to be guardians 0-2.
    let outsiders = guardian_keys(3, 90);
    let digest = attestation_digest(&bed.net.network, &message.id(&bed.net.network), ROUTE);
    let signatures: Vec<BlsSignature> = outsiders.iter().map(|k| k.sign(&digest)).collect();
    let refs: Vec<&BlsSignature> = signatures.iter().collect();
    let op = BridgeOp::BridgeIn {
        message: message.clone(),
        attestation: Attestation {
            signers: 0b111,
            aggregate: aggregate_signatures(&refs).unwrap().to_bytes(),
        },
    };
    refused(
        &submit(&mut bed.net, RELAYER, Payload::Bridge(Box::new(op))),
        ErrorCode::BridgeAttestationInvalid,
    );

    // A bitmap naming a guardian the set does not have.
    let mut attestation = bed.attest(&digest, &[0, 1, 2]);
    attestation.signers |= 1 << 9;
    let op = BridgeOp::BridgeIn {
        message: message.clone(),
        attestation,
    };
    refused(
        &submit(&mut bed.net, RELAYER, Payload::Bridge(Box::new(op))),
        ErrorCode::BridgeAttestationInvalid,
    );

    // Signed under another network's domain.
    let elsewhere = NetworkIdentity::new(ChainId::new(9), NetworkKind::Devnet, Hash32::ZERO);
    let digest = attestation_digest(&elsewhere, &message.id(&bed.net.network), ROUTE);
    let attestation = bed.attest(&digest, &[0, 1, 2]);
    let op = BridgeOp::BridgeIn {
        message: message.clone(),
        attestation,
    };
    refused(
        &submit(&mut bed.net, RELAYER, Payload::Bridge(Box::new(op))),
        ErrorCode::BridgeAttestationInvalid,
    );

    // The honest quorum succeeds.
    ok(&bed.deliver(&message, &[1, 2, 3]));
}

#[test]
fn order_destination_and_expiry_are_enforced() {
    let mut bed = bed();
    ok(&bed.out(ALICE, AssetId::AEY, 10 * ONE_AEY));

    // Sequence 2 before 1 is a gap.
    let early = bed.message(2, AssetId::AEY, BOB, ONE_AEY);
    refused(
        &bed.deliver(&early, &[0, 1, 2]),
        ErrorCode::BridgeSequenceGap,
    );

    // Another destination chain, or another source chain.
    let mut wrong = bed.message(1, AssetId::AEY, BOB, ONE_AEY);
    wrong.dest_chain = 5;
    refused(
        &bed.deliver(&wrong, &[0, 1, 2]),
        ErrorCode::BridgeWrongDestination,
    );
    let mut wrong = bed.message(1, AssetId::AEY, BOB, ONE_AEY);
    wrong.source_chain = 202;
    refused(
        &bed.deliver(&wrong, &[0, 1, 2]),
        ErrorCode::BridgeWrongDestination,
    );

    // A recipient that is not an Aletheia address.
    let mut wrong = bed.message(1, AssetId::AEY, BOB, ONE_AEY);
    wrong.recipient = vec![0x33; 20];
    refused(
        &bed.deliver(&wrong, &[0, 1, 2]),
        ErrorCode::BridgeWrongDestination,
    );

    // An expired message.
    let mut expired = bed.message(1, AssetId::AEY, BOB, ONE_AEY);
    expired.expiry_slot = bed.net.next_slot().get() - 1;
    refused(
        &bed.deliver(&expired, &[0, 1, 2]),
        ErrorCode::BridgeMessageExpired,
    );

    // The wrong kind or remote token for the asset.
    let mut wrong = bed.message(1, AssetId::AEY, BOB, ONE_AEY);
    wrong.kind = kind::LOCK_AND_MINT;
    refused(
        &bed.deliver(&wrong, &[0, 1, 2]),
        ErrorCode::BridgeAssetNotOnRoute,
    );
    let mut wrong = bed.message(1, AssetId::AEY, BOB, ONE_AEY);
    wrong.remote_token = USDC_TOKEN.to_vec();
    refused(
        &bed.deliver(&wrong, &[0, 1, 2]),
        ErrorCode::BridgeAssetNotOnRoute,
    );

    // Sequence 1, then 2.
    ok(&bed.inbound(AssetId::AEY, BOB, ONE_AEY).0);
    ok(&bed.inbound(AssetId::AEY, BOB, ONE_AEY).0);
    assert_eq!(bed.route_state().in_sequence, 2);
}

#[test]
fn conversion_is_exact_and_limits_hold() {
    let mut bed = bed();
    // AEY has 18 decimals, the remote token 6: one base unit has no remote equivalent.
    refused(
        &bed.out(ALICE, AssetId::AEY, ONE_AEY + 1),
        ErrorCode::BridgeAmountNotConvertible,
    );
    // ALNT does not cross this route.
    refused(
        &bed.out(ALICE, AssetId::ALNT, ONE_ALNT),
        ErrorCode::BridgeAssetNotOnRoute,
    );

    // Per transaction: 50 AEY.
    refused(
        &bed.out(ALICE, AssetId::AEY, 51 * ONE_AEY),
        ErrorCode::BridgeLimitExceeded,
    );
    // Per epoch: 120 AEY. Eight attempts of 50 cover a whole epoch (four blocks), so at
    // least one is refused, and each epoch starts a new count.
    let mut refusals = 0;
    for _ in 0..8 {
        let receipt = bed.out(ALICE, AssetId::AEY, 50 * ONE_AEY);
        if receipt.status != ReceiptStatus::Success {
            refused(&receipt, ErrorCode::BridgeLimitExceeded);
            refusals += 1;
        }
        assert!(bed.route_state().epoch_flow <= 120 * ONE_AEY);
    }
    assert!((1..8).contains(&refusals), "{refusals} refusals");
}

#[test]
fn pauses_stop_new_messages_only() {
    let mut bed = bed();
    ok(&bed.out(ALICE, AssetId::AEY, 40 * ONE_AEY));
    // A large transfer back waits its delay.
    let (receipt, large) = bed.inbound(AssetId::AEY, BOB, 35 * ONE_AEY);
    ok(&receipt);
    let large_id = large.id(&bed.net.network);

    // Two guardians cannot pause; three can.
    refused(
        &bed.control(control::PAUSE, Hash32::ZERO, &[0, 1]),
        ErrorCode::BridgeAttestationInvalid,
    );
    ok(&bed.control(control::PAUSE, Hash32::ZERO, &[0, 1, 3]));
    refused(
        &bed.out(ALICE, AssetId::AEY, ONE_AEY),
        ErrorCode::BridgeRoutePaused,
    );
    let (receipt, _) = bed.inbound(AssetId::AEY, BOB, ONE_AEY);
    refused(&receipt, ErrorCode::BridgeRoutePaused);

    // A waiting message still settles during a pause.
    bed.epochs(1);
    let bob = bed.aey(BOB);
    ok(&submit(
        &mut bed.net,
        RELAYER,
        Payload::Bridge(Box::new(BridgeOp::SettleDelayed {
            message_id: large_id,
        })),
    ));
    assert_eq!(bed.aey(BOB), bob + 35 * ONE_AEY);

    // The guardians resume; an old resume attestation cannot be replayed after the next pause.
    let digest = control_digest(
        &bed.net.network,
        control::RESUME,
        ROUTE,
        &Hash32::ZERO,
        bed.route_state().pauses,
    );
    let old_resume = bed.attest(&digest, &[0, 1, 2]);
    ok(&bed.control(control::RESUME, Hash32::ZERO, &[0, 1, 2]));
    ok(&bed.out(ALICE, AssetId::AEY, ONE_AEY));
    ok(&bed.control(control::PAUSE, Hash32::ZERO, &[0, 1, 2]));
    let replay = BridgeOp::ResumeRoute {
        route_id: ROUTE,
        attestation: old_resume,
    };
    refused(
        &submit(&mut bed.net, RELAYER, Payload::Bridge(Box::new(replay))),
        ErrorCode::BridgeAttestationInvalid,
    );

    // A guardian pause expires on its own after three epochs.
    bed.epochs(3);
    ok(&bed.out(ALICE, AssetId::AEY, ONE_AEY));

    // A council pause cannot be lifted by the guardians.
    ok(&govern(
        &mut bed.net,
        GovAction::SetBridgeRoutePaused {
            route_id: ROUTE,
            paused: true,
        },
    ));
    refused(
        &bed.out(ALICE, AssetId::AEY, ONE_AEY),
        ErrorCode::BridgeRoutePaused,
    );
    refused(
        &bed.control(control::RESUME, Hash32::ZERO, &[0, 1, 2]),
        ErrorCode::BridgeRoutePaused,
    );
}

#[test]
fn equivocation_pauses_the_route() {
    let mut bed = bed();
    ok(&bed.out(ALICE, AssetId::AEY, 10 * ONE_AEY));
    ok(&bed.inbound(AssetId::AEY, BOB, ONE_AEY).0);
    let bob = bed.aey(BOB);

    // A quorum signs a second message for sequence 1.
    let conflicting = bed.message(1, AssetId::AEY, ALICE, 2 * ONE_AEY);
    let receipt = bed.deliver(&conflicting, &[1, 2, 3]);
    ok(&receipt);
    assert!(bed.route_state().paused);
    assert_eq!(bed.aey(BOB), bob);
    refused(
        &bed.out(ALICE, AssetId::AEY, ONE_AEY),
        ErrorCode::BridgeRoutePaused,
    );

    // A conflicting message without a quorum proves nothing and pauses nothing.
    let mut bed = self::bed();
    ok(&bed.out(ALICE, AssetId::AEY, 10 * ONE_AEY));
    ok(&bed.inbound(AssetId::AEY, BOB, ONE_AEY).0);
    let conflicting = bed.message(1, AssetId::AEY, ALICE, 2 * ONE_AEY);
    refused(
        &bed.deliver(&conflicting, &[1, 2]),
        ErrorCode::BridgeAttestationInvalid,
    );
    assert!(!bed.route_state().paused);
}

#[test]
fn large_transfers_wait_and_flags_hold_them() {
    let mut bed = bed();
    ok(&bed.out(ALICE, AssetId::AEY, 50 * ONE_AEY));
    bed.epochs(1);
    ok(&bed.out(ALICE, AssetId::AEY, 40 * ONE_AEY));

    let (receipt, first) = bed.inbound(AssetId::AEY, BOB, 30 * ONE_AEY);
    ok(&receipt);
    let (receipt, second) = bed.inbound(AssetId::AEY, BOB, 40 * ONE_AEY);
    ok(&receipt);
    let (first, second) = (first.id(&bed.net.network), second.id(&bed.net.network));
    let bob = bed.aey(BOB);
    let settle = |bed: &mut Bed, id: Hash32| {
        submit(
            &mut bed.net,
            RELAYER,
            Payload::Bridge(Box::new(BridgeOp::SettleDelayed { message_id: id })),
        )
    };

    // Too early.
    refused(&settle(&mut bed, first), ErrorCode::BridgeMessageHeld);
    // The guardians flag the second; it stays held after the delay.
    refused(
        &bed.control(control::FLAG, second, &[0, 1]),
        ErrorCode::BridgeAttestationInvalid,
    );
    ok(&bed.control(control::FLAG, second, &[0, 2, 3]));
    bed.epochs(1);
    ok(&settle(&mut bed, first));
    refused(&settle(&mut bed, second), ErrorCode::BridgeMessageHeld);
    assert_eq!(bed.aey(BOB), bob + 30 * ONE_AEY);
    // Settled once only.
    refused(&settle(&mut bed, first), ErrorCode::BridgeMessageUnknown);
    refused(
        &settle(&mut bed, Hash32::ZERO),
        ErrorCode::BridgeMessageUnknown,
    );
}

#[test]
fn bridged_assets_are_minted_and_burned_against_remote_locks() {
    let mut bed = bed();
    let (receipt, _) = bed.inbound(USDC, BOB, 25 * ONE_USDC);
    ok(&receipt);
    assert_eq!(
        bed.net.balance(&bed.net.address(BOB), USDC).available,
        25 * ONE_USDC
    );
    let ledger = bed.ledger(USDC);
    assert_eq!(
        (ledger.issued_total, ledger.circulating),
        (25 * ONE_USDC, 25 * ONE_USDC)
    );
    assert_eq!(bed.route_state().minted, 25 * ONE_USDC);

    // Bob sends 10 back: burned here, released on the remote chain.
    ok(&bed.out(BOB, USDC, 10 * ONE_USDC));
    let ledger = bed.ledger(USDC);
    assert_eq!(ledger.burned_total, 10 * ONE_USDC);
    assert_eq!(bed.route_state().minted, 15 * ONE_USDC);
    let records = bed.net.records();
    let flows = Bridge { records: &records }
        .flows(&bed.net.view(), USDC)
        .unwrap();
    assert_eq!(
        (flows.locks, flows.releases),
        (25 * ONE_USDC, 10 * ONE_USDC)
    );

    // Bridged USDC moves like any asset on Aletheia.
    let (nonce, alice) = (bed.net.next_nonce(BOB), bed.net.address(ALICE));
    let transfer = bed.net.transfer(BOB, nonce, alice, USDC, 5 * ONE_USDC);
    let (_, executed) = bed.net.produce(vec![transfer]).unwrap();
    ok(&executed.receipts[0]);
    // Alice sends hers back, keeping enough for the fee.
    ok(&bed.out(ALICE, USDC, 4 * ONE_USDC));
    assert_eq!(bed.route_state().minted, 11 * ONE_USDC);
}

#[test]
fn governance_bounds_routes_and_guardian_sets() {
    let mut net = devnet();
    // A route needs a registered guardian set.
    refused(
        &govern(&mut net, GovAction::UpsertBridgeRoute(Box::new(route()))),
        ErrorCode::BridgeGuardianSetUnknown,
    );
    // A threshold below two thirds.
    let keys = guardian_keys(4, 70);
    let weak = guardian_set(&net, 1, &keys, 2);
    refused(
        &govern(&mut net, GovAction::RegisterGuardianSet(Box::new(weak))),
        ErrorCode::GovOutOfBounds,
    );
    // A proof of possession for another key.
    let mut rogue = guardian_set(&net, 1, &keys, 3);
    rogue.guardians[1].proof_of_possession = rogue.guardians[0].proof_of_possession;
    refused(
        &govern(&mut net, GovAction::RegisterGuardianSet(Box::new(rogue))),
        ErrorCode::GovOutOfBounds,
    );
    // Light clients are not active yet; Aletheia cannot be its own remote chain.
    let mut light = route();
    light.verification = verification::LIGHT_CLIENT;
    let receipt = submit(
        &mut net,
        0,
        Payload::Registry(Box::new(RegistryOp::GovPropose {
            action: GovAction::UpsertBridgeRoute(Box::new(light)),
        })),
    );
    refused(&receipt, ErrorCode::GovOutOfBounds);
    let mut own = route();
    own.remote_chain_id = 0;
    let receipt = submit(
        &mut net,
        0,
        Payload::Registry(Box::new(RegistryOp::GovPropose {
            action: GovAction::UpsertBridgeRoute(Box::new(own)),
        })),
    );
    refused(&receipt, ErrorCode::GovOutOfBounds);
    // ALNT cannot be declared bridged.
    let mut native = route();
    native.assets[1].asset = AssetId::ALNT;
    let receipt = submit(
        &mut net,
        0,
        Payload::Registry(Box::new(RegistryOp::GovPropose {
            action: GovAction::UpsertBridgeRoute(Box::new(native)),
        })),
    );
    refused(&receipt, ErrorCode::GovOutOfBounds);
}

/// I10-I12 under random flows: every block's end-of-block check passes (a violation would
/// make `produce` fail), and the route's figures match the ledger and balances.
#[test]
fn invariants_hold_under_random_flows() {
    let mut bed = bed();
    let mut rng: u64 = 0x5eed;
    let mut next = || {
        rng = rng
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        rng >> 33
    };
    for _ in 0..40 {
        let amount_aey = u128::from(next() % 20 + 1) * ONE_AEY;
        let amount_usdc = u128::from(next() % 20 + 1) * ONE_USDC;
        match next() % 5 {
            0 | 1 => {
                let from = if next() % 2 == 0 { ALICE } else { BOB };
                let _ = bed.out(from, AssetId::AEY, amount_aey);
            }
            2 => {
                let _ = bed.inbound(AssetId::AEY, BOB, amount_aey);
            }
            3 => {
                let _ = bed.inbound(USDC, ALICE, amount_usdc);
            }
            _ => {
                let _ = bed.out(ALICE, USDC, amount_usdc);
            }
        }
        if next() % 4 == 0 {
            bed.epochs(1);
        }
        let state = bed.route_state();
        let escrow = bed.net.balance(&BRIDGE_ESCROW, AssetId::AEY).available;
        assert_eq!(state.escrowed, escrow, "I10 per route");
        assert_eq!(bed.ledger(AssetId::AEY).bridge_escrow, escrow, "I10 ledger");
        let records = bed.net.records();
        let flows = Bridge { records: &records }
            .flows(&bed.net.view(), USDC)
            .unwrap();
        let outstanding = bed.ledger(USDC).outstanding(USDC).unwrap();
        assert!(outstanding <= flows.locks - flows.releases, "I11");
        assert_eq!(outstanding, state.minted);
        assert!(
            state.escrowed + state.minted <= state.route.global_exposure_max,
            "I12 exposure"
        );
        assert!(state.epoch_flow <= state.route.per_epoch_max, "I12 flow");
    }
}
