//! Quorum and timeout certificates with real BLS keys (spec Sections 19.3, 19.5).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_consensus::certificate::{
    TimeoutCollector, VoteCollector, verify_qc, verify_tc, verify_vote,
};
use aletheia_consensus::{Timeout, ValidatorInfo, ValidatorSet, Vote};
use aletheia_core::block::{QuorumCertificate, SignerBitmap, TimeoutCertificate};
use aletheia_core::{ChainId, Epoch, Hash32, NetworkIdentity, NetworkKind, Slot, ValidatorIndex};
use aletheia_crypto::{BlsSecretKey, Secret};

fn network() -> NetworkIdentity {
    NetworkIdentity::new(
        ChainId::new(7771),
        NetworkKind::Devnet,
        Hash32::from_bytes([4; 32]),
    )
}

fn validators(n: u8) -> (ValidatorSet, Vec<BlsSecretKey>) {
    let keys: Vec<BlsSecretKey> = (1..=n)
        .map(|i| BlsSecretKey::from_key_material(&Secret::new([i; 32])).unwrap())
        .collect();
    let members = keys
        .iter()
        .enumerate()
        .map(|(i, key)| ValidatorInfo {
            consensus_key: key
                .public_key()
                .prove_possession(&network(), &key.prove_possession(&network()))
                .unwrap(),
            node_key: [u8::try_from(i).unwrap(); 32],
            voting_power: 1,
        })
        .collect();
    (ValidatorSet::new(Epoch::new(1), members).unwrap(), keys)
}

fn vote(keys: &[BlsSecretKey], voter: u16, round: u64, block: u8) -> Vote {
    let hash = Hash32::from_bytes([block; 32]);
    let digest = QuorumCertificate::vote_digest(&network(), Slot::new(round), &hash, Epoch::new(1));
    Vote {
        round: Slot::new(round),
        block_hash: hash,
        epoch: Epoch::new(1),
        voter: ValidatorIndex::new(voter),
        signature: keys[usize::from(voter)].sign(&digest).to_bytes(),
    }
}

#[test]
fn quorum_sizes_follow_n_minus_f() {
    for (n, f, q) in [(1, 0, 1), (4, 1, 3), (5, 1, 4), (7, 2, 5), (10, 3, 7)] {
        let (set, _) = validators(n);
        assert_eq!((set.max_faulty(), set.quorum()), (f, q), "N = {n}");
    }
}

#[test]
fn a_qc_forms_at_quorum_and_verifies() {
    let (set, keys) = validators(4);
    let mut collector = VoteCollector::default();
    assert!(
        collector
            .add(&set, &vote(&keys, 0, 5, 9))
            .unwrap()
            .is_none()
    );
    assert!(
        collector
            .add(&set, &vote(&keys, 0, 5, 9))
            .unwrap()
            .is_none(),
        "a repeated vote does not count twice"
    );
    assert!(
        collector
            .add(&set, &vote(&keys, 2, 5, 9))
            .unwrap()
            .is_none()
    );
    let qc = collector
        .add(&set, &vote(&keys, 3, 5, 9))
        .unwrap()
        .expect("third distinct vote is a quorum of 4");
    verify_qc(&network(), &set, &qc).unwrap();
    assert_eq!(qc.signers.count(), 3);
    assert!(
        collector
            .add(&set, &vote(&keys, 1, 5, 9))
            .unwrap()
            .is_none(),
        "the QC is produced once"
    );
}

#[test]
fn votes_for_different_blocks_do_not_combine() {
    let (set, keys) = validators(4);
    let mut collector = VoteCollector::default();
    collector.add(&set, &vote(&keys, 0, 5, 9)).unwrap();
    collector.add(&set, &vote(&keys, 1, 5, 9)).unwrap();
    assert!(
        collector
            .add(&set, &vote(&keys, 2, 5, 8))
            .unwrap()
            .is_none()
    );
}

#[test]
fn a_qc_is_refused_for_the_wrong_epoch_size_quorum_or_content() {
    let (set, keys) = validators(4);
    let mut collector = VoteCollector::default();
    let qc = [0u16, 1, 2]
        .iter()
        .find_map(|&i| collector.add(&set, &vote(&keys, i, 5, 9)).unwrap())
        .unwrap();

    let mut wrong_epoch = qc.clone();
    wrong_epoch.epoch = Epoch::new(2);
    assert!(verify_qc(&network(), &set, &wrong_epoch).is_err());

    let mut wrong_size = qc.clone();
    wrong_size.signers = SignerBitmap::new(5).unwrap();
    assert!(verify_qc(&network(), &set, &wrong_size).is_err());

    let mut too_few = qc.clone();
    let mut bitmap = SignerBitmap::new(4).unwrap();
    bitmap.set(ValidatorIndex::new(0)).unwrap();
    bitmap.set(ValidatorIndex::new(1)).unwrap();
    too_few.signers = bitmap;
    assert!(verify_qc(&network(), &set, &too_few).is_err());

    let mut other_block = qc.clone();
    other_block.block_hash = Hash32::from_bytes([1; 32]);
    assert!(
        verify_qc(&network(), &set, &other_block).is_err(),
        "the aggregate is bound to the block hash"
    );

    let mut claimed_signers = qc;
    let mut bitmap = SignerBitmap::new(4).unwrap();
    for i in [0, 1, 3] {
        bitmap.set(ValidatorIndex::new(i)).unwrap();
    }
    claimed_signers.signers = bitmap;
    assert!(
        verify_qc(&network(), &set, &claimed_signers).is_err(),
        "the bitmap must name who actually signed"
    );
}

#[test]
fn a_forged_vote_does_not_verify() {
    let (set, keys) = validators(4);
    let mut forged = vote(&keys, 1, 5, 9);
    forged.voter = ValidatorIndex::new(2);
    assert!(verify_vote(&network(), &set, &forged).is_err());
    assert!(verify_vote(&network(), &set, &vote(&keys, 1, 5, 9)).is_ok());
}

#[test]
fn a_tc_over_different_high_qc_rounds_verifies_and_reports_the_highest_qc() {
    let (set, keys) = validators(4);
    let mut collector = TimeoutCollector::default();
    let mut result = None;
    for (voter, high) in [(0u16, 3u64), (1, 4), (3, 2)] {
        let mut high_qc = QuorumCertificate::genesis();
        high_qc.round = Slot::new(high);
        let digest = TimeoutCertificate::timeout_digest(
            &network(),
            Slot::new(6),
            Epoch::new(1),
            Slot::new(high),
        );
        let timeout = Timeout {
            round: Slot::new(6),
            epoch: Epoch::new(1),
            high_qc,
            voter: ValidatorIndex::new(voter),
            signature: keys[usize::from(voter)].sign(&digest).to_bytes(),
        };
        result = collector.add(&set, &timeout).unwrap();
    }
    let (tc, highest) = result.expect("three timeouts are a quorum of 4");
    verify_tc(&network(), &set, &tc).unwrap();
    assert_eq!(
        tc.high_qc_rounds,
        vec![Slot::new(3), Slot::new(4), Slot::new(2)],
        "in validator-index order"
    );
    assert_eq!(tc.max_high_qc_round(), Some(Slot::new(4)));
    assert_eq!(highest.round, Slot::new(4));

    let mut lied = tc;
    lied.high_qc_rounds[0] = Slot::new(9);
    assert!(
        verify_tc(&network(), &set, &lied).is_err(),
        "a reported high-QC round is signed by its validator"
    );
}
