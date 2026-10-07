//! Round pacing (spec Section 19.4). Progress is event-driven: a node enters round `r + 1` as
//! soon as it holds `QC(r)` or `TC(r)`. Time only paces proposals and triggers timeouts; it
//! never decides safety. The pacemaker is pure: the caller owns the clock and feeds expiries in.

use aletheia_core::Slot;

/// Devnet defaults (benchmark before freezing): 1.5 s base timeout, ×1.5 per consecutive
/// timeout, capped at 12 s.
pub const TIMEOUT_BASE_MS: u64 = 1_500;
pub const TIMEOUT_CAP_MS: u64 = 12_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Pacemaker {
    round: Slot,
    consecutive_timeouts: u32,
}

impl Pacemaker {
    pub fn new(round: Slot) -> Pacemaker {
        Pacemaker {
            round,
            consecutive_timeouts: 0,
        }
    }

    pub fn round(&self) -> Slot {
        self.round
    }

    /// Enters `certified + 1` if that is ahead. Returns the new round when it advanced. A QC
    /// resets the back-off; a TC extends it.
    pub fn advance(&mut self, certified: Slot, by_timeout: bool) -> Option<Slot> {
        let target = certified.next().ok()?;
        if target <= self.round {
            return None;
        }
        self.round = target;
        self.consecutive_timeouts = if by_timeout {
            self.consecutive_timeouts.saturating_add(1)
        } else {
            0
        };
        Some(target)
    }

    /// How long to wait in the current round before timing out.
    pub fn timeout_ms(&self) -> u64 {
        // ×1.5 per step in integers: multiply by 3, divide by 2.
        let mut timeout = TIMEOUT_BASE_MS;
        for _ in 0..self.consecutive_timeouts.min(16) {
            timeout = timeout.saturating_mul(3) / 2;
            if timeout >= TIMEOUT_CAP_MS {
                return TIMEOUT_CAP_MS;
            }
        }
        timeout
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_certificate_moves_the_round_forward_never_back() {
        let mut pacemaker = Pacemaker::new(Slot::new(1));
        assert_eq!(pacemaker.advance(Slot::new(1), false), Some(Slot::new(2)));
        assert_eq!(pacemaker.advance(Slot::new(0), false), None);
        assert_eq!(
            pacemaker.advance(Slot::new(5), false),
            Some(Slot::new(6)),
            "catches up to a later certificate"
        );
    }

    #[test]
    fn timeouts_back_off_by_half_and_reset_on_a_qc() {
        let mut pacemaker = Pacemaker::new(Slot::new(1));
        assert_eq!(pacemaker.timeout_ms(), 1_500);
        pacemaker.advance(Slot::new(1), true);
        assert_eq!(pacemaker.timeout_ms(), 2_250);
        pacemaker.advance(Slot::new(2), true);
        assert_eq!(pacemaker.timeout_ms(), 3_375);
        for round in 3..20 {
            pacemaker.advance(Slot::new(round), true);
        }
        assert_eq!(pacemaker.timeout_ms(), TIMEOUT_CAP_MS);
        pacemaker.advance(Slot::new(20), false);
        assert_eq!(pacemaker.timeout_ms(), 1_500);
    }
}
