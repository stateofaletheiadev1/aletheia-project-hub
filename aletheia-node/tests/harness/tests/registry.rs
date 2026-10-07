//! Native registries and governance (spec Sections 31-33, 35; Phase 10 exit: "permission
//! tests; history proofs").

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_core::registry::{
    ControllerRef, Encumbrance, GovAction, IdentityStatus, ParcelStatus, RegistryKind, RegistryOp,
    ResidenceStatus, parcel_transfer_digest, proposal_id,
};
use aletheia_core::{
    AceEncode, AssetId, ChainId, ErrorCode, Hash32, NetworkIdentity, NetworkKind, Payload,
};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use aletheia_execution::registry_model::{LandOp, ProposalStatus, Registry};
use aletheia_execution::{Receipt, ReceiptStatus};
use aletheia_state::JellyfishMerkleTree;
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT, keys};

const ACCOUNTS: usize = 8;
const EPOCH_SLOTS: u64 = 4;

fn authority_key() -> Ed25519SigningKey {
    Ed25519SigningKey::from_seed(&Secret::new([77; 32]))
}

/// Council: accounts 0, 1, 2 (2 of 3). Governance epochs of 4 slots.
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
    Devnet::with_genesis_extra(ACCOUNTS, 100 * ONE_AEY, 1_000 * ONE_ALNT, &extra)
}

trait Submit {
    fn submit(&mut self, from: usize, op: RegistryOp) -> Receipt;
    fn skip_epochs(&mut self, epochs: u64);
}

impl Submit for Devnet {
    fn submit(&mut self, from: usize, op: RegistryOp) -> Receipt {
        let nonce = self.next_nonce(from);
        let mut body = self.body(from, nonce, Payload::Registry(Box::new(op)));
        body.fee.eu_limit = 100_000;
        body.fee.max_fee = 400_000; // room for governed fee-price changes
        let tx = self.sign(from, body);
        let (_, executed) = self.produce(vec![tx]).expect("the block is valid");
        executed.receipts[0].clone()
    }

    fn skip_epochs(&mut self, epochs: u64) {
        for _ in 0..epochs * EPOCH_SLOTS {
            self.produce(Vec::new()).unwrap();
        }
    }
}

fn ok(r: &Receipt) {
    assert_eq!(r.status, ReceiptStatus::Success, "{r:?}");
}

fn refused(r: &Receipt, code: ErrorCode) {
    assert_eq!(r.status, ReceiptStatus::FailedExecution, "{r:?}");
    assert_eq!(r.error_code, code.get(), "expected {code:?}: {r:?}");
}

/// Proposed by member 0, approved by member 1, executed after its timelock by account 7.
fn govern(net: &mut Devnet, action: GovAction) -> Hash32 {
    let nonce = net.next_nonce(0);
    let id = proposal_id(&net.network, &net.address(0), nonce, &action);
    ok(&net.submit(
        0,
        RegistryOp::GovPropose {
            action: action.clone(),
        },
    ));
    ok(&net.submit(
        1,
        RegistryOp::GovVote {
            proposal_id: id,
            approve: true,
        },
    ));
    net.skip_epochs(action.timelock_epochs() + 1);
    ok(&net.submit(7, RegistryOp::GovExecute { proposal_id: id }));
    id
}

fn register(
    net: &mut Devnet,
    kind: RegistryKind,
    issuer_id: u32,
    controller: usize,
    scopes: Vec<u32>,
    cosign: Vec<u32>,
) {
    let cosign_key = (!cosign.is_empty()).then(|| authority_key().public_key().to_bytes());
    govern(
        net,
        GovAction::RegisterIssuer {
            kind,
            issuer_id,
            controller: net.address(controller),
            scopes,
            cosign_classes: cosign,
            cosign_key,
        },
    );
}

fn h(byte: u8) -> Hash32 {
    Hash32::from_bytes([byte; 32])
}

// ---- governance ----

#[test]
fn proposals_need_the_council_threshold_and_their_timelock() {
    let mut net = devnet();
    let action = GovAction::SetFeePrice {
        asset: AssetId::ALNT,
        eu_price: 2,
    };
    // Outsiders cannot propose.
    refused(
        &net.submit(
            5,
            RegistryOp::GovPropose {
                action: action.clone(),
            },
        ),
        ErrorCode::GovNotCouncil,
    );

    let nonce = net.next_nonce(0);
    let id = proposal_id(&net.network, &net.address(0), nonce, &action);
    ok(&net.submit(
        0,
        RegistryOp::GovPropose {
            action: action.clone(),
        },
    ));
    // One approval of two: not executable.
    refused(
        &net.submit(7, RegistryOp::GovExecute { proposal_id: id }),
        ErrorCode::GovProposalState,
    );
    refused(
        &net.submit(
            0,
            RegistryOp::GovVote {
                proposal_id: id,
                approve: true,
            },
        ),
        ErrorCode::GovAlreadyVoted,
    );
    refused(
        &net.submit(
            6,
            RegistryOp::GovVote {
                proposal_id: id,
                approve: true,
            },
        ),
        ErrorCode::GovNotCouncil,
    );
    ok(&net.submit(
        1,
        RegistryOp::GovVote {
            proposal_id: id,
            approve: true,
        },
    ));
    // Approved, but timelocked for one governance epoch.
    refused(
        &net.submit(7, RegistryOp::GovExecute { proposal_id: id }),
        ErrorCode::GovProposalState,
    );
    net.skip_epochs(2);
    ok(&net.submit(7, RegistryOp::GovExecute { proposal_id: id }));
    let schedule = net.records().fee_schedule(&net.view()).unwrap();
    assert_eq!(schedule.price(AssetId::ALNT), Some(2));
    // Executed once only.
    refused(
        &net.submit(7, RegistryOp::GovExecute { proposal_id: id }),
        ErrorCode::GovProposalState,
    );
}

#[test]
fn rejected_and_expired_proposals_never_execute() {
    let mut net = devnet();
    let action = GovAction::SetFeePrice {
        asset: AssetId::ALNT,
        eu_price: 2,
    };
    let nonce = net.next_nonce(0);
    let rejected = proposal_id(&net.network, &net.address(0), nonce, &action);
    ok(&net.submit(
        0,
        RegistryOp::GovPropose {
            action: action.clone(),
        },
    ));
    ok(&net.submit(
        1,
        RegistryOp::GovVote {
            proposal_id: rejected,
            approve: false,
        },
    ));
    ok(&net.submit(
        2,
        RegistryOp::GovVote {
            proposal_id: rejected,
            approve: false,
        },
    ));
    let reg = net.records();
    let registry = Registry { records: &reg };
    assert_eq!(
        registry
            .proposal(&net.view(), &rejected)
            .unwrap()
            .unwrap()
            .status,
        ProposalStatus::Rejected
    );
    net.skip_epochs(2);
    refused(
        &net.submit(
            7,
            RegistryOp::GovExecute {
                proposal_id: rejected,
            },
        ),
        ErrorCode::GovProposalState,
    );

    // Never approved within its voting period.
    let nonce = net.next_nonce(0);
    let stale = proposal_id(&net.network, &net.address(0), nonce, &action);
    ok(&net.submit(0, RegistryOp::GovPropose { action }));
    net.skip_epochs(4);
    refused(
        &net.submit(
            1,
            RegistryOp::GovVote {
                proposal_id: stale,
                approve: true,
            },
        ),
        ErrorCode::GovProposalState,
    );
}

#[test]
fn governance_actions_stay_within_their_bounds() {
    let mut net = devnet();
    // A fee price may at most double per proposal: 1 -> 3 is refused at execution.
    let action = GovAction::SetFeePrice {
        asset: AssetId::ALNT,
        eu_price: 3,
    };
    let nonce = net.next_nonce(0);
    let id = proposal_id(&net.network, &net.address(0), nonce, &action);
    ok(&net.submit(
        0,
        RegistryOp::GovPropose {
            action: action.clone(),
        },
    ));
    ok(&net.submit(
        1,
        RegistryOp::GovVote {
            proposal_id: id,
            approve: true,
        },
    ));
    net.skip_epochs(2);
    refused(
        &net.submit(7, RegistryOp::GovExecute { proposal_id: id }),
        ErrorCode::GovOutOfBounds,
    );

    // A council must be valid even to be proposed.
    let bad = GovAction::SetCouncil {
        members: vec![net.address(0)],
        threshold: 2,
    };
    refused(
        &net.submit(0, RegistryOp::GovPropose { action: bad }),
        ErrorCode::GovOutOfBounds,
    );

    // AEY capacity rises by at most the governed maximum.
    let reg = net.records();
    let capacity = reg
        .supply_ledger(&net.view(), AssetId::AEY)
        .unwrap()
        .unwrap()
        .authorized_capacity;
    govern(
        &mut net,
        GovAction::SetAeyCapacity {
            capacity: capacity + 10 * ONE_AEY,
        },
    );
    let raised = net
        .records()
        .supply_ledger(&net.view(), AssetId::AEY)
        .unwrap()
        .unwrap()
        .authorized_capacity;
    assert_eq!(raised, capacity + 10 * ONE_AEY);

    // An upgrade is scheduled into the protocol schedule.
    let height = net.head.height.get();
    govern(
        &mut net,
        GovAction::ScheduleUpgrade {
            protocol_version: 2,
            activation_height: height + 1_000,
        },
    );
    let entry = net
        .records()
        .schedule_entry(&net.view(), 2)
        .unwrap()
        .unwrap();
    assert_eq!(entry.activation_height, height + 1_000);
}

// ---- identity ----

#[test]
fn only_a_scoped_issuer_manages_identities_and_credentials() {
    let mut net = devnet();
    register(&mut net, RegistryKind::Identity, 1, 3, vec![7], Vec::new());
    let create = RegistryOp::IdentityCreate {
        identity_id: h(1),
        controller: net.address(5),
        issuer_id: 1,
        attributes_commitment: h(2),
    };
    refused(&net.submit(4, create.clone()), ErrorCode::RegNotAuthorized);
    ok(&net.submit(3, create.clone()));
    refused(&net.submit(3, create), ErrorCode::RegAlreadyExists);

    let credential = |schema| RegistryOp::CredentialIssue {
        credential_id: h(schema),
        subject: h(1),
        schema_id: u32::from(schema),
        issuer_id: 1,
        commitment: h(3),
        status_list_index: 9,
        expiry_epoch: 1_000,
    };
    refused(&net.submit(3, credential(8)), ErrorCode::RegOutOfScope);
    ok(&net.submit(3, credential(7)));
    ok(&net.submit(
        3,
        RegistryOp::CredentialStatus {
            issuer_id: 1,
            updates: vec![(9, true)],
        },
    ));
    let reg = net.records();
    assert!(
        Registry { records: &reg }
            .is_revoked(&net.view(), 1, 9)
            .unwrap()
    );
    refused(
        &net.submit(
            4,
            RegistryOp::CredentialStatus {
                issuer_id: 1,
                updates: vec![(9, false)],
            },
        ),
        ErrorCode::RegNotAuthorized,
    );

    // Only the identity's controller rotates it; revocation is final.
    refused(
        &net.submit(
            3,
            RegistryOp::IdentityRotate {
                identity_id: h(1),
                new_controller: net.address(6),
            },
        ),
        ErrorCode::RegNotAuthorized,
    );
    ok(&net.submit(
        5,
        RegistryOp::IdentityRotate {
            identity_id: h(1),
            new_controller: net.address(6),
        },
    ));
    ok(&net.submit(
        3,
        RegistryOp::IdentitySetStatus {
            identity_id: h(1),
            status: IdentityStatus::Revoked,
        },
    ));
    refused(
        &net.submit(
            3,
            RegistryOp::IdentitySetStatus {
                identity_id: h(1),
                status: IdentityStatus::Active,
            },
        ),
        ErrorCode::RegInvalidTransition,
    );

    // A deactivated issuer can do nothing.
    govern(
        &mut net,
        GovAction::SetIssuerActive {
            kind: RegistryKind::Identity,
            issuer_id: 1,
            active: false,
        },
    );
    let create = RegistryOp::IdentityCreate {
        identity_id: h(9),
        controller: net.address(5),
        issuer_id: 1,
        attributes_commitment: h(2),
    };
    refused(&net.submit(3, create), ErrorCode::RegIssuerUnknown);
}

// ---- residence ----

#[test]
fn residence_follows_its_lifecycle_and_keeps_history() {
    let mut net = devnet();
    register(&mut net, RegistryKind::Identity, 1, 3, vec![7], Vec::new());
    register(&mut net, RegistryKind::Residence, 2, 4, vec![1], Vec::new());
    ok(&net.submit(
        3,
        RegistryOp::IdentityCreate {
            identity_id: h(1),
            controller: net.address(5),
            issuer_id: 1,
            attributes_commitment: h(2),
        },
    ));
    let issue = |class| RegistryOp::ResidenceIssue {
        residence_id: h(class),
        identity_id: h(1),
        class: u16::from(class),
        issuer_id: 2,
        expiry_epoch: 1_000,
    };
    refused(&net.submit(3, issue(1)), ErrorCode::RegNotAuthorized);
    refused(&net.submit(4, issue(2)), ErrorCode::RegOutOfScope);
    ok(&net.submit(4, issue(1)));
    ok(&net.submit(
        4,
        RegistryOp::ResidenceSetStatus {
            residence_id: h(1),
            status: ResidenceStatus::Revoked,
            reason_code: 12,
        },
    ));
    refused(
        &net.submit(
            4,
            RegistryOp::ResidenceSetStatus {
                residence_id: h(1),
                status: ResidenceStatus::Active,
                reason_code: 0,
            },
        ),
        ErrorCode::RegInvalidTransition,
    );
    let reg = net.records();
    let registry = Registry { records: &reg };
    let record = registry.residence(&net.view(), &h(1)).unwrap().unwrap();
    assert_eq!(record.history_seq, 2, "issued, then revoked");
    assert_eq!(
        registry
            .residence_history(&net.view(), &h(1), 1)
            .unwrap()
            .unwrap()
            .reason_code,
        12
    );
    assert_eq!(record.status_at(10_000), ResidenceStatus::Revoked);
}

// ---- land ----

fn land(net: &mut Devnet) {
    register(net, RegistryKind::Land, 3, 4, vec![1, 2], vec![2]);
    for (parcel, class) in [(1u8, 1u16), (2, 2)] {
        let op = RegistryOp::ParcelRegister {
            parcel_id: h(parcel),
            geometry_commitment: h(100 + parcel),
            controller: ControllerRef::Address(net.address(5)),
            class,
            authority_id: 3,
        };
        ok(&net.submit(4, op));
    }
}

#[test]
fn parcels_move_only_by_their_controller_and_never_while_locked() {
    let mut net = devnet();
    land(&mut net);
    let to = |i: usize, net: &Devnet| ControllerRef::Address(net.address(i));
    let transfer = |net: &Devnet, to_account| RegistryOp::ParcelTransfer {
        parcel_id: h(1),
        new_controller: to(to_account, net),
        authority_signature: None,
    };
    refused(
        &net.submit(6, transfer(&net, 6)),
        ErrorCode::RegNotAuthorized,
    );

    let encumbrance = Encumbrance {
        kind: 1,
        holder: net.address(7),
        ref_hash: h(9),
        until_epoch: 1_000,
    };
    refused(
        &net.submit(
            5,
            RegistryOp::ParcelEncumber {
                parcel_id: h(1),
                encumbrance,
            },
        ),
        ErrorCode::RegNotAuthorized,
    );
    ok(&net.submit(
        4,
        RegistryOp::ParcelEncumber {
            parcel_id: h(1),
            encumbrance,
        },
    ));
    refused(
        &net.submit(5, transfer(&net, 6)),
        ErrorCode::RegParcelLocked,
    );
    refused(
        &net.submit(
            6,
            RegistryOp::ParcelRelease {
                parcel_id: h(1),
                index: 0,
            },
        ),
        ErrorCode::RegNotAuthorized,
    );
    ok(&net.submit(
        7,
        RegistryOp::ParcelRelease {
            parcel_id: h(1),
            index: 0,
        },
    ));
    ok(&net.submit(5, transfer(&net, 6)));

    // The new controller may move it on; frozen and retired parcels may not move.
    ok(&net.submit(
        4,
        RegistryOp::ParcelSetStatus {
            parcel_id: h(1),
            status: ParcelStatus::Frozen,
        },
    ));
    refused(
        &net.submit(6, transfer(&net, 5)),
        ErrorCode::RegParcelLocked,
    );
    ok(&net.submit(
        4,
        RegistryOp::ParcelSetStatus {
            parcel_id: h(1),
            status: ParcelStatus::Retired,
        },
    ));
    refused(
        &net.submit(
            4,
            RegistryOp::ParcelSetStatus {
                parcel_id: h(1),
                status: ParcelStatus::Registered,
            },
        ),
        ErrorCode::RegInvalidTransition,
    );
}

#[test]
fn co_signed_classes_need_the_authoritys_signature_for_this_very_transfer() {
    let mut net = devnet();
    land(&mut net);
    let new_controller = ControllerRef::Address(net.address(6));
    let plain = RegistryOp::ParcelTransfer {
        parcel_id: h(2),
        new_controller,
        authority_signature: None,
    };
    refused(&net.submit(5, plain), ErrorCode::RegCosignRequired);

    // Signed for a different nonce: a replayed co-signature.
    let nonce = net.next_nonce(5);
    let stale = parcel_transfer_digest(
        &net.network,
        &h(2),
        &new_controller,
        &net.address(5),
        nonce + 7,
    );
    let replay = RegistryOp::ParcelTransfer {
        parcel_id: h(2),
        new_controller,
        authority_signature: Some(authority_key().sign(&stale).to_bytes()),
    };
    refused(&net.submit(5, replay), ErrorCode::RegCosignRequired);

    let nonce = net.next_nonce(5);
    let digest =
        parcel_transfer_digest(&net.network, &h(2), &new_controller, &net.address(5), nonce);
    let signed = RegistryOp::ParcelTransfer {
        parcel_id: h(2),
        new_controller,
        authority_signature: Some(authority_key().sign(&digest).to_bytes()),
    };
    ok(&net.submit(5, signed));
}

#[test]
fn land_history_is_provable_against_the_state_root() {
    let mut net = devnet();
    land(&mut net);
    let new_controller = ControllerRef::Address(net.address(6));
    ok(&net.submit(
        5,
        RegistryOp::ParcelTransfer {
            parcel_id: h(1),
            new_controller,
            authority_signature: None,
        },
    ));

    let reg = net.records();
    let registry = Registry { records: &reg };
    let entry = registry
        .land_history(&net.view(), &h(1), 1)
        .unwrap()
        .unwrap();
    assert_eq!(entry.op, LandOp::Transfer);
    assert_eq!(
        entry.prior_controller,
        Some(ControllerRef::Address(net.address(5)))
    );
    assert_eq!(entry.new_controller, Some(new_controller));

    // Anyone holding only the block header can check the entry with a proof.
    let key = registry.land_history_key(&h(1), 1);
    let version = net.head.height.get();
    let tree = JellyfishMerkleTree::new(&net.store, net.network);
    let proof = tree.prove(&key, version).unwrap();
    let root = net.head.state_root;
    proof
        .verify(&net.network, &root, &key, Some(&entry.to_ace_bytes()))
        .unwrap();

    // A forged entry, or a claim the entry does not exist, fails.
    let mut forged = entry.clone();
    forged.new_controller = Some(ControllerRef::Address(net.address(7)));
    assert!(
        proof
            .verify(&net.network, &root, &key, Some(&forged.to_ace_bytes()))
            .is_err()
    );
    assert!(proof.verify(&net.network, &root, &key, None).is_err());

    // The registration (sequence 0) is provable too, from the same root.
    let first = registry.land_history_key(&h(1), 0);
    let value = registry
        .land_history(&net.view(), &h(1), 0)
        .unwrap()
        .unwrap()
        .to_ace_bytes();
    tree.prove(&first, version)
        .unwrap()
        .verify(&net.network, &root, &first, Some(&value))
        .unwrap();
}

#[test]
fn a_chain_without_a_council_cannot_govern() {
    let mut net = Devnet::new(2, ONE_AEY, 1_000 * ONE_ALNT);
    let r = net.submit(
        0,
        RegistryOp::GovPropose {
            action: GovAction::SetFeePrice {
                asset: AssetId::ALNT,
                eu_price: 2,
            },
        },
    );
    refused(&r, ErrorCode::GovNoCouncil);
}
