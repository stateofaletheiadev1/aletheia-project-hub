//! The engine holds votes and timeouts only for rounds within a window ahead of its own, but
//! takes certificates from any round, so a node that has fallen behind still catches up.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_consensus::certificate::VoteCollector;
use aletheia_consensus::engine::MAX_ROUNDS_AHEAD;
use aletheia_consensus::schedule::LeaderSchedule;
use aletheia_consensus::{
    ConsensusMessage, ConsensusSigner, Engine, FinalizedTip, Input, Output, SafetyData,
    ValidatorInfo, ValidatorSet, Vote,
};
use aletheia_core::block::QuorumCertificate;
use aletheia_core::{
    AletheiaError, ChainId, Epoch, ErrorCode, Hash32, Height, NetworkIdentity, NetworkKind, Slot,
    ValidatorIndex,
};
use aletheia_crypto::{BlsSecretKey, Secret};

fn network() -> NetworkIdentity {
    NetworkIdentity::new(
        ChainId::new(7771),
        NetworkKind::Devnet,
        Hash32::from_bytes([4; 32]),
    )
}

/// An observer never signs.
struct NoSigner;

impl ConsensusSigner for NoSigner {
    fn sign_proposal(&mut self, _: Slot, _: &Hash32) -> Result<[u8; 96], AletheiaError> {
        Err(AletheiaError::new(
            ErrorCode::SigInvalid,
            "observer".to_owned(),
        ))
    }
    fn sign_vote(&mut self, _: Slot, _: &Hash32, _: &Hash32) -> Result<[u8; 96], AletheiaError> {
        Err(AletheiaError::new(
            ErrorCode::SigInvalid,
            "observer".to_owned(),
        ))
    }
    fn sign_timeout(&mut self, _: Slot, _: &Hash32) -> Result<[u8; 96], AletheiaError> {
        Err(AletheiaError::new(
            ErrorCode::SigInvalid,
            "observer".to_owned(),
        ))
    }
}

fn setup() -> (Engine<NoSigner>, ValidatorSet, Vec<BlsSecretKey>) {
    let keys: Vec<BlsSecretKey> = (1..=4u8)
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
    let set = ValidatorSet::new(Epoch::new(0), members).unwrap();
    let engine = Engine::new(
        network(),
        set.clone(),
        LeaderSchedule::new(Epoch::new(0), &Hash32::ZERO, 4),
        None,
        NoSigner,
        SafetyData::genesis(Epoch::new(0)),
        FinalizedTip {
            hash: Hash32::from_bytes([9; 32]),
            height: Height::GENESIS,
            round: Slot::new(0),
        },
    );
    (engine, set, keys)
}

fn vote(keys: &[BlsSecretKey], voter: u16, round: u64) -> Vote {
    let hash = Hash32::from_bytes([7; 32]);
    let digest = QuorumCertificate::vote_digest(&network(), Slot::new(round), &hash, Epoch::new(0));
    Vote {
        round: Slot::new(round),
        block_hash: hash,
        epoch: Epoch::new(0),
        voter: ValidatorIndex::new(voter),
        signature: keys[usize::from(voter)].sign(&digest).to_bytes(),
    }
}

fn forms_qc(outputs: &[Output]) -> bool {
    outputs
        .iter()
        .any(|o| matches!(o, Output::Broadcast(ConsensusMessage::QuorumCertificate(_))))
}

#[test]
fn votes_far_beyond_the_current_round_are_not_held() {
    let (mut engine, _, keys) = setup();
    let far = engine.round().get() + MAX_ROUNDS_AHEAD + 10;
    let mut outputs = Vec::new();
    for voter in 0..4 {
        outputs.extend(
            engine
                .handle(Input::Message(ConsensusMessage::Vote(vote(
                    &keys, voter, far,
                ))))
                .unwrap(),
        );
    }
    assert!(!forms_qc(&outputs), "votes beyond the window were counted");
    assert_eq!(engine.round(), Slot::new(1), "and did not move the round");
}

#[test]
fn votes_within_the_window_still_form_certificates() {
    let (mut engine, _, keys) = setup();
    let near = engine.round().get() + MAX_ROUNDS_AHEAD;
    let mut outputs = Vec::new();
    for voter in 0..3 {
        outputs.extend(
            engine
                .handle(Input::Message(ConsensusMessage::Vote(vote(
                    &keys, voter, near,
                ))))
                .unwrap(),
        );
    }
    assert!(forms_qc(&outputs));
    assert_eq!(engine.round(), Slot::new(near + 1));
}

#[test]
fn a_certificate_from_far_ahead_still_catches_the_node_up() {
    let (mut engine, set, keys) = setup();
    let far = engine.round().get() + 10 * MAX_ROUNDS_AHEAD;
    let mut collector = VoteCollector::default();
    let mut qc = None;
    for voter in 0..3 {
        if let Some(formed) = collector.add(&set, &vote(&keys, voter, far)).unwrap() {
            qc = Some(formed);
        }
    }
    engine
        .handle(Input::Message(ConsensusMessage::QuorumCertificate(
            Box::new(qc.unwrap()),
        )))
        .unwrap();
    assert_eq!(engine.round(), Slot::new(far + 1));
}
