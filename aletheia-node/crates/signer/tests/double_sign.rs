//! Double-sign protection (spec Section 19.2): refusals, persistence across restarts, and the
//! crash-between-persist-and-sign case.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::path::PathBuf;

use aletheia_consensus::ConsensusSigner;
use aletheia_core::{ErrorCode, Hash32, Slot};
use aletheia_crypto::{BlsSecretKey, Secret};
use aletheia_signer::LocalSigner;

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-signer-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn key() -> BlsSecretKey {
    BlsSecretKey::from_key_material(&Secret::new([3; 32])).unwrap()
}

fn digest(byte: u8) -> Hash32 {
    Hash32::from_bytes([byte; 32])
}

#[test]
fn a_conflicting_vote_in_the_same_round_is_refused() {
    let mut signer = LocalSigner::open(key(), &scratch("conflict")).unwrap();
    signer
        .sign_vote(Slot::new(5), &digest(1), &digest(1))
        .unwrap();
    let error = signer
        .sign_vote(Slot::new(5), &digest(2), &digest(2))
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::SigInvalid);
    assert!(
        error.detail().contains("different message for round 5"),
        "{error}"
    );
}

#[test]
fn the_identical_request_is_signed_again_with_the_same_signature() {
    let mut signer = LocalSigner::open(key(), &scratch("idempotent")).unwrap();
    let first = signer
        .sign_vote(Slot::new(5), &digest(1), &digest(1))
        .unwrap();
    let again = signer
        .sign_vote(Slot::new(5), &digest(1), &digest(1))
        .unwrap();
    assert_eq!(first, again);
}

#[test]
fn rounds_below_the_high_water_mark_are_refused_per_class() {
    let mut signer = LocalSigner::open(key(), &scratch("hwm")).unwrap();
    signer
        .sign_vote(Slot::new(9), &digest(1), &digest(1))
        .unwrap();
    assert!(
        signer
            .sign_vote(Slot::new(8), &digest(2), &digest(2))
            .is_err()
    );
    // Classes are independent: a timeout or proposal for round 8 is not a vote.
    signer.sign_timeout(Slot::new(8), &digest(3)).unwrap();
    signer.sign_proposal(Slot::new(8), &digest(4)).unwrap();
    assert!(signer.sign_timeout(Slot::new(7), &digest(5)).is_err());
    assert!(
        signer.sign_timeout(Slot::new(8), &digest(6)).is_err(),
        "a second, different timeout for round 8"
    );
}

#[test]
fn marks_survive_a_restart() {
    let dir = scratch("restart");
    {
        let mut signer = LocalSigner::open(key(), &dir).unwrap();
        signer
            .sign_vote(Slot::new(12), &digest(1), &digest(1))
            .unwrap();
        signer.sign_timeout(Slot::new(13), &digest(2)).unwrap();
    }
    let mut restarted = LocalSigner::open(key(), &dir).unwrap();
    assert!(
        restarted
            .sign_vote(Slot::new(12), &digest(9), &digest(9))
            .is_err(),
        "conflicting vote after restart"
    );
    assert!(
        restarted
            .sign_vote(Slot::new(11), &digest(9), &digest(9))
            .is_err()
    );
    assert!(
        restarted
            .sign_vote(Slot::new(12), &digest(1), &digest(1))
            .is_ok(),
        "the same vote may be re-issued"
    );
    assert!(restarted.sign_timeout(Slot::new(13), &digest(8)).is_err());
}

#[test]
fn a_crash_after_persisting_but_before_returning_is_safe() {
    // The mark is durable before the signature leaves `sign`. Model the crash by persisting the
    // mark (signing) and then discarding the returned signature, then restarting.
    let dir = scratch("crash");
    {
        let mut signer = LocalSigner::open(key(), &dir).unwrap();
        let _lost = signer
            .sign_vote(Slot::new(20), &digest(1), &digest(1))
            .unwrap();
    }
    let mut restarted = LocalSigner::open(key(), &dir).unwrap();
    assert!(
        restarted
            .sign_vote(Slot::new(20), &digest(2), &digest(2))
            .is_err(),
        "no second message for the round"
    );
    assert!(
        restarted
            .sign_vote(Slot::new(20), &digest(1), &digest(1))
            .is_ok(),
        "the lost signature can be re-issued"
    );
}

#[test]
fn two_signers_cannot_share_one_state_directory() {
    let dir = scratch("lock");
    let _first = LocalSigner::open(key(), &dir).unwrap();
    let error = LocalSigner::open(key(), &dir)
        .err()
        .expect("second open refused");
    assert_eq!(error.code(), ErrorCode::StoDataDirLocked);
}

#[test]
fn a_corrupted_state_file_refuses_to_start() {
    let dir = scratch("corrupt");
    {
        let mut signer = LocalSigner::open(key(), &dir).unwrap();
        signer
            .sign_vote(Slot::new(1), &digest(1), &digest(1))
            .unwrap();
    }
    let path = dir.join("signer-state.ace");
    let mut bytes = std::fs::read(&path).unwrap();
    let middle = bytes.len() / 2;
    bytes[middle] ^= 0xff;
    std::fs::write(&path, bytes).unwrap();
    assert_eq!(
        LocalSigner::open(key(), &dir)
            .err()
            .expect("refused")
            .code(),
        ErrorCode::StoCorrupt
    );
}
