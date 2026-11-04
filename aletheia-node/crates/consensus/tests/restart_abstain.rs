//! After a restart the engine must not build a second, different proposal for a round its
//! signer already signed: it abstains, the round times out, and the next round proceeds with a
//! timeout certificate (Mainnet Beta, 2026-11-04: a restart mid-round otherwise fail-stopped on the
//! signer's equivocation guard).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic
)]

use aletheia_consensus::schedule::LeaderSchedule;
use aletheia_consensus::{
    ConsensusMessage, ConsensusSigner, Engine, FinalizedTip, Input, Output, SafetyData,
    ValidatorInfo, ValidatorSet,
};
use aletheia_core::{
    AletheiaError, ChainId, Epoch, Hash32, Height, NetworkIdentity, NetworkKind, Slot,
    ValidatorIndex,
};
use aletheia_crypto::{BlsSecretKey, Secret};

fn network() -> NetworkIdentity {
    NetworkIdentity::new(
        ChainId::new(7770),
        NetworkKind::Mainnet,
        Hash32::from_bytes([4; 32]),
    )
}

struct KeySigner(BlsSecretKey);

impl ConsensusSigner for KeySigner {
    fn sign_proposal(&mut self, _: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        Ok(self.0.sign(digest).to_bytes())
    }
    fn sign_vote(
        &mut self,
        _: Slot,
        _: &Hash32,
        digest: &Hash32,
    ) -> Result<[u8; 96], AletheiaError> {
        Ok(self.0.sign(digest).to_bytes())
    }
    fn sign_timeout(&mut self, _: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        Ok(self.0.sign(digest).to_bytes())
    }
}

fn single_validator() -> Engine<KeySigner> {
    let key = BlsSecretKey::from_key_material(&Secret::new([1; 32])).unwrap();
    let member = ValidatorInfo {
        consensus_key: key
            .public_key()
            .prove_possession(&network(), &key.prove_possession(&network()))
            .unwrap(),
        node_key: [0; 32],
        voting_power: 1,
    };
    let set = ValidatorSet::new(Epoch::new(0), vec![member]).unwrap();
    Engine::new(
        network(),
        set,
        LeaderSchedule::new(Epoch::new(0), &Hash32::ZERO, 1),
        Some(ValidatorIndex::new(0)),
        KeySigner(key),
        SafetyData::genesis(Epoch::new(0)),
        FinalizedTip {
            hash: Hash32::from_bytes([9; 32]),
            height: Height::GENESIS,
            round: Slot::new(0),
        },
    )
}

fn builds(outputs: &[Output]) -> Option<(Slot, bool)> {
    outputs.iter().find_map(|o| match o {
        Output::BuildProposal {
            round,
            timeout_cert,
            ..
        } => Some((*round, timeout_cert.is_some())),
        _ => None,
    })
}

#[test]
fn a_fresh_leader_builds_in_its_first_round() {
    let mut engine = single_validator();
    assert_eq!(
        builds(&engine.handle(Input::Start).unwrap()),
        Some((Slot::new(1), false))
    );
}

#[test]
fn a_round_already_proposed_in_is_skipped_and_the_next_round_builds() {
    let mut engine = single_validator();
    engine.already_proposed(Slot::new(1));
    assert_eq!(
        builds(&engine.handle(Input::Start).unwrap()),
        None,
        "must not rebuild round 1"
    );
    let after_timeout = engine.handle(Input::RoundTimer(Slot::new(1))).unwrap();
    assert!(
        after_timeout.iter().any(|o| matches!(
            o,
            Output::Broadcast(ConsensusMessage::TimeoutCertificate(_))
        )),
        "a single validator forms the timeout certificate itself: {after_timeout:?}"
    );
    assert_eq!(builds(&after_timeout), Some((Slot::new(2), true)));
}

#[test]
fn an_older_mark_does_not_hold_back_a_later_round() {
    let mut engine = single_validator();
    engine.already_proposed(Slot::new(1));
    engine.already_proposed(Slot::new(0));
    let _ = engine.handle(Input::Start).unwrap();
    assert_eq!(
        builds(&engine.handle(Input::RoundTimer(Slot::new(1))).unwrap()),
        Some((Slot::new(2), true))
    );
}
