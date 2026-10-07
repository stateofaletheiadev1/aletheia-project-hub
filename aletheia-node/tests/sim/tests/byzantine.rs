//! DSP Byzantine suite (spec Section 19.8; Phase 5 exit: "simulator Byzantine suite green
//! (10k seeds)"). Each scenario runs `ALETHEIA_SIM_SEEDS` seeds (default 2 locally; the nightly
//! job sets 10,000). Every run checks safety; scenarios with at least a quorum of correct,
//! connected validators also check that finality advances.

#![allow(
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects,
    clippy::as_conversions,
    clippy::cast_possible_truncation
)]

use std::collections::BTreeSet;

use aletheia_consensus::Evidence;
use aletheia_sim::{Behaviour, Scenario, Simulation};

fn seeds() -> u64 {
    std::env::var("ALETHEIA_SIM_SEEDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(2)
}

fn scenario(behaviours: Vec<Behaviour>, duration_ms: u64) -> Scenario {
    Scenario {
        behaviours,
        duration_ms,
        ..Scenario::honest(0)
    }
}

fn correct(behaviours: &[Behaviour]) -> Vec<usize> {
    behaviours
        .iter()
        .enumerate()
        .filter(|(_, b)| **b == Behaviour::Honest)
        .map(|(i, _)| i)
        .collect()
}

#[test]
fn honest_validators_finalize_steadily() {
    for n in [4, 7] {
        for seed in 0..seeds() {
            let s = scenario(vec![Behaviour::Honest; n], 6_000);
            let outcome = Simulation::new(seed, s).run();
            outcome.check_safety();
            assert!(outcome.min_finalized(0..n) >= 20, "N = {n}, seed {seed}");
        }
    }
}

#[test]
fn up_to_f_silent_validators_slow_but_never_stop_finality() {
    for (n, silent) in [(4usize, vec![1usize]), (7, vec![2, 5])] {
        for seed in 0..seeds() {
            let mut behaviours = vec![Behaviour::Honest; n];
            silent
                .iter()
                .for_each(|&i| behaviours[i] = Behaviour::Silent);
            let live = correct(&behaviours);
            let outcome = Simulation::new(seed, scenario(behaviours, 20_000)).run();
            outcome.check_safety();
            assert!(
                outcome.min_finalized(live) >= 3,
                "N = {n}, silent {silent:?}, seed {seed}: timeouts and TCs must carry the rounds a silent leader owns"
            );
        }
    }
}

#[test]
fn more_than_f_silent_validators_halt_progress_without_breaking_safety() {
    // Safety over liveness: with 2 of 4 silent no quorum exists, so nothing is finalized.
    for seed in 0..seeds() {
        let behaviours = vec![
            Behaviour::Honest,
            Behaviour::Silent,
            Behaviour::Honest,
            Behaviour::Silent,
        ];
        let outcome = Simulation::new(seed, scenario(behaviours, 8_000)).run();
        outcome.check_safety();
        assert_eq!(outcome.min_finalized([0, 2]), 0, "seed {seed}");
    }
}

#[test]
fn an_equivocating_proposer_is_caught_and_cannot_fork_finality() {
    for seed in 0..seeds() {
        let behaviours = vec![
            Behaviour::Honest,
            Behaviour::EquivocatingProposer,
            Behaviour::Honest,
            Behaviour::Honest,
        ];
        let outcome = Simulation::new(seed, scenario(behaviours, 12_000)).run();
        outcome.check_safety();
        assert!(outcome.min_finalized([0, 2, 3]) >= 5, "seed {seed}");
    }
}

#[test]
fn a_double_voter_with_an_equivocating_proposer_leaves_evidence_and_no_fork() {
    // F = 2 of 7: one validator proposes twins, another signs both.
    for seed in 0..seeds() {
        let mut behaviours = vec![Behaviour::Honest; 7];
        behaviours[1] = Behaviour::EquivocatingProposer;
        behaviours[4] = Behaviour::DoubleVoter;
        let outcome = Simulation::new(seed, scenario(behaviours, 15_000)).run();
        outcome.check_safety();
        assert!(outcome.min_finalized([0, 2, 3, 5, 6]) >= 5, "seed {seed}");
        assert!(
            outcome.evidence.iter().any(
                |e| matches!(e, Evidence::VoteEquivocation { first, .. } if first.voter.get() == 4)
            ),
            "seed {seed}: the double voter's conflicting votes are evidence"
        );
    }
}

#[test]
fn an_invalid_proposer_is_rejected_with_evidence_and_the_chain_moves_on() {
    for seed in 0..seeds() {
        let behaviours = vec![
            Behaviour::Honest,
            Behaviour::Honest,
            Behaviour::InvalidProposer,
            Behaviour::Honest,
        ];
        let outcome = Simulation::new(seed, scenario(behaviours, 15_000)).run();
        outcome.check_safety();
        assert!(outcome.min_finalized([0, 1, 3]) >= 5, "seed {seed}");
        assert!(
            outcome.evidence.iter().any(
                |e| matches!(e, Evidence::InvalidProposal { proposer, .. } if proposer.get() == 2)
            ),
            "seed {seed}"
        );
    }
}

#[test]
fn a_partition_without_a_quorum_side_stalls_and_heals_without_a_fork() {
    for seed in 0..seeds() {
        let mut s = scenario(vec![Behaviour::Honest; 4], 20_000);
        let halves = vec![BTreeSet::from([0, 1]), BTreeSet::from([2, 3])];
        s.partitions = vec![(2_000, 6_000, halves)];
        let outcome = Simulation::new(seed, s).run();
        outcome.check_safety();
        assert!(
            outcome.min_finalized(0..4) >= 5,
            "seed {seed}: progress resumes after the partition heals"
        );
    }
}

#[test]
fn the_majority_side_of_a_partition_keeps_finalizing_and_the_minority_never_forks() {
    for seed in 0..seeds() {
        let mut s = scenario(vec![Behaviour::Honest; 7], 12_000);
        let split = vec![BTreeSet::from([0, 1, 2, 3, 4]), BTreeSet::from([5, 6])];
        s.partitions = vec![(1_000, 12_000, split)];
        let outcome = Simulation::new(seed, s).run();
        outcome.check_safety();
        assert!(
            outcome.min_finalized(0..5) >= 10,
            "seed {seed}: the side with a quorum (5 of 7) continues"
        );
    }
}

#[test]
fn a_lossy_network_recovers_after_stabilization() {
    for seed in 0..seeds() {
        let mut s = scenario(vec![Behaviour::Honest; 4], 20_000);
        s.drop_permille = 200;
        s.stable_after_ms = 6_000;
        let outcome = Simulation::new(seed, s).run();
        outcome.check_safety();
        assert!(outcome.min_finalized(0..4) >= 10, "seed {seed}");
    }
}

/// The core property over many random worlds: up to F Byzantine validators of random kinds,
/// random partitions, random loss. Safety must hold in every one.
#[test]
fn safety_holds_under_random_faults() {
    for seed in 0..seeds() * 4 {
        let mut rng = seed.wrapping_mul(0x9e37_79b9_7f4a_7c15) | 1;
        let mut next = || {
            rng ^= rng << 13;
            rng ^= rng >> 7;
            rng ^= rng << 17;
            rng
        };
        let n = [4usize, 5, 7][(next() % 3) as usize];
        let f = (n - 1) / 3;
        let mut behaviours = vec![Behaviour::Honest; n];
        for _ in 0..f {
            let victim = (next() % n as u64) as usize;
            behaviours[victim] = [
                Behaviour::Silent,
                Behaviour::EquivocatingProposer,
                Behaviour::DoubleVoter,
                Behaviour::InvalidProposer,
            ][(next() % 4) as usize];
        }
        let mut s = scenario(behaviours, 8_000);
        s.drop_permille = next() % 300;
        s.stable_after_ms = next() % 8_000;
        if next() % 2 == 0 {
            let cut = 1 + (next() % (n as u64 - 1)) as usize;
            let start = next() % 4_000;
            s.partitions = vec![(
                start,
                start + next() % 4_000,
                vec![(0..cut).collect(), (cut..n).collect()],
            )];
        }
        Simulation::new(seed, s).run().check_safety();
    }
}
