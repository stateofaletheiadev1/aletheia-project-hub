//! Deterministic leader scheduling (spec Section 19.6, ADR-018).
//!
//! ```text
//! seed(epoch)         = H_domain("ALETHEIA/ORDER/v1", "leader" || u64(epoch) || finalized_hash_at(epoch_start − 1))
//! perm(epoch)         = Fisher–Yates over [0..N) driven by a BLAKE3 XOF keyed by seed(epoch)
//! leader(epoch, slot) = active_set(epoch)[ perm(epoch)[ slot mod N ] ]
//! ```
//!
//! Only finalized data feeds the seed, so every honest node computes the same schedule.
//! Indices are drawn by rejection sampling, so no position is favoured by modulo bias. Epoch 0
//! seeds from `genesis_id` (ERRATA E-22). No local randomness is ever used.

use aletheia_core::{AceEncode, DomainTag, Epoch, Hash32, NetworkIdentity, Slot, ValidatorIndex};

/// A permutation of validator positions for one epoch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LeaderSchedule {
    epoch: Epoch,
    order: Vec<u16>,
}

pub fn seed(network: &NetworkIdentity, epoch: Epoch, finalized_before_epoch: &Hash32) -> Hash32 {
    let mut hasher = network.domain_hasher(DomainTag::Order);
    hasher
        .update(b"leader")
        .update(&epoch.to_ace_bytes())
        .update(finalized_before_epoch.as_bytes());
    hasher.finalize()
}

/// Draws a uniform value in `0..bound` from the stream, rejecting draws that would bias it.
fn uniform_below(stream: &mut blake3::OutputReader, bound: u64) -> u64 {
    // Accept r < bound × ⌊2^64 / bound⌋: every residue is then equally likely.
    let bound = bound.max(1);
    let space = u128::from(u64::MAX).saturating_add(1);
    let zone = space
        .checked_div(u128::from(bound))
        .unwrap_or(0)
        .saturating_mul(u128::from(bound));
    loop {
        let mut bytes = [0u8; 8];
        stream.fill(&mut bytes);
        let draw = u64::from_le_bytes(bytes);
        if u128::from(draw) < zone {
            return draw.checked_rem(bound).unwrap_or(0);
        }
    }
}

impl LeaderSchedule {
    pub fn new(epoch: Epoch, seed: &Hash32, validators: u16) -> LeaderSchedule {
        let mut order: Vec<u16> = (0..validators).collect();
        let mut stream = blake3::Hasher::new_keyed(seed.as_bytes()).finalize_xof();
        let mut position = order.len();
        while position > 1 {
            let last = position.saturating_sub(1);
            let pick = usize::try_from(uniform_below(
                &mut stream,
                u64::try_from(position).unwrap_or(u64::MAX),
            ))
            .unwrap_or(0);
            order.swap(last, pick);
            position = last;
        }
        LeaderSchedule { epoch, order }
    }

    pub fn epoch(&self) -> Epoch {
        self.epoch
    }

    /// The leader of `slot`.
    pub fn leader(&self, slot: Slot) -> ValidatorIndex {
        let len = u64::try_from(self.order.len()).unwrap_or(1).max(1);
        let position = usize::try_from(slot.get().checked_rem(len).unwrap_or(0)).unwrap_or(0);
        ValidatorIndex::new(self.order.get(position).copied().unwrap_or(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aletheia_core::{ChainId, NetworkKind};
    use std::collections::BTreeSet;

    fn network() -> NetworkIdentity {
        NetworkIdentity::new(
            ChainId::new(7771),
            NetworkKind::Devnet,
            Hash32::from_bytes([4; 32]),
        )
    }

    #[test]
    fn the_schedule_is_a_permutation_and_every_validator_leads_once_per_n_slots() {
        let schedule = LeaderSchedule::new(
            Epoch::new(3),
            &seed(&network(), Epoch::new(3), &Hash32::ZERO),
            7,
        );
        let leaders: BTreeSet<u16> = (0..7)
            .map(|slot| schedule.leader(Slot::new(slot)).get())
            .collect();
        assert_eq!(leaders.len(), 7);
        assert_eq!(
            schedule.leader(Slot::new(2)),
            schedule.leader(Slot::new(9)),
            "period N"
        );
    }

    #[test]
    fn the_schedule_depends_on_epoch_and_finalized_hash_only() {
        let n = network();
        let a = LeaderSchedule::new(Epoch::new(1), &seed(&n, Epoch::new(1), &Hash32::ZERO), 10);
        let b = LeaderSchedule::new(Epoch::new(1), &seed(&n, Epoch::new(1), &Hash32::ZERO), 10);
        let c = LeaderSchedule::new(Epoch::new(2), &seed(&n, Epoch::new(2), &Hash32::ZERO), 10);
        let d = LeaderSchedule::new(
            Epoch::new(1),
            &seed(&n, Epoch::new(1), &Hash32::from_bytes([1; 32])),
            10,
        );
        assert_eq!(a, b);
        assert_ne!(a.order, c.order);
        assert_ne!(a.order, d.order);
    }

    #[test]
    fn first_slot_leaders_are_spread_over_many_epochs() {
        // A crude bias check: over 7,000 epochs each of 7 validators leads slot 0 near 1,000 times.
        let n = network();
        let mut counts = [0u32; 7];
        for epoch in 0..7_000u64 {
            let schedule = LeaderSchedule::new(
                Epoch::new(epoch),
                &seed(&n, Epoch::new(epoch), &Hash32::ZERO),
                7,
            );
            counts[usize::from(schedule.leader(Slot::new(0)).get())] += 1;
        }
        assert!(
            counts.iter().all(|&c| (850..1150).contains(&c)),
            "{counts:?}"
        );
    }

    #[test]
    fn a_single_validator_always_leads() {
        let schedule = LeaderSchedule::new(Epoch::new(0), &Hash32::ZERO, 1);
        assert_eq!(schedule.leader(Slot::new(12345)), ValidatorIndex::new(0));
    }
}
