//! Per-peer rate limiting and scoring (spec Section 36). Wall-clock time is fine here: none of
//! this influences consensus outputs, only which connections the node keeps.

use std::time::Instant;

use crate::frame::Channel;
use crate::limits::{BAN_THRESHOLD, MAX_SCORE, rate_budget};

/// Token bucket over frames.
#[derive(Debug, Clone, Copy)]
pub struct TokenBucket {
    per_second: u32,
    burst: u32,
    /// Thousandths of a token, so fractional refill accumulates without floats.
    milli_tokens: u64,
    last: Instant,
}

impl TokenBucket {
    pub fn new(per_second: u32, burst: u32, now: Instant) -> TokenBucket {
        TokenBucket {
            per_second,
            burst,
            milli_tokens: u64::from(burst).saturating_mul(1_000),
            last: now,
        }
    }

    /// Takes one token if available.
    pub fn try_take(&mut self, now: Instant) -> bool {
        let elapsed_ms =
            u64::try_from(now.saturating_duration_since(self.last).as_millis()).unwrap_or(u64::MAX);
        let refill = elapsed_ms.saturating_mul(u64::from(self.per_second));
        let cap = u64::from(self.burst).saturating_mul(1_000);
        self.milli_tokens = self.milli_tokens.saturating_add(refill).min(cap);
        self.last = now;
        if self.milli_tokens >= 1_000 {
            self.milli_tokens = self.milli_tokens.saturating_sub(1_000);
            true
        } else {
            false
        }
    }
}

/// One bucket per channel plus the peer's score.
#[derive(Debug, Clone)]
pub struct PeerBudget {
    buckets: [TokenBucket; 6],
    score: i32,
}

fn bucket_index(channel: Channel) -> usize {
    usize::from(channel.code())
}

impl PeerBudget {
    pub fn new(now: Instant) -> PeerBudget {
        PeerBudget {
            buckets: Channel::ALL.map(|channel| {
                let (per_second, burst) = rate_budget(channel);
                TokenBucket::new(per_second, burst, now)
            }),
            score: 0,
        }
    }

    pub fn admit(&mut self, channel: Channel, now: Instant) -> bool {
        self.buckets
            .get_mut(bucket_index(channel))
            .is_some_and(|bucket| bucket.try_take(now))
    }

    /// Applies a score change; true when the peer must now be banned.
    pub fn adjust(&mut self, delta: i32) -> bool {
        self.score = self.score.saturating_add(delta).min(MAX_SCORE);
        self.score <= BAN_THRESHOLD
    }

    pub fn score(&self) -> i32 {
        self.score
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::limits::{SCORE_INVALID, SCORE_USEFUL};
    use std::time::Duration;

    #[test]
    fn a_bucket_allows_its_burst_then_refills_at_its_rate() {
        let start = Instant::now();
        let mut bucket = TokenBucket::new(10, 3, start);
        assert!((0..3).all(|_| bucket.try_take(start)));
        assert!(!bucket.try_take(start), "burst exhausted");
        assert!(
            !bucket.try_take(start + Duration::from_millis(50)),
            "half a token after 50 ms"
        );
        assert!(
            bucket.try_take(start + Duration::from_millis(100)),
            "one token after 100 ms at 10/s"
        );
        assert!(bucket.try_take(start + Duration::from_secs(60)));
        assert!(bucket.try_take(start + Duration::from_secs(60)));
        assert!(bucket.try_take(start + Duration::from_secs(60)));
        assert!(
            !bucket.try_take(start + Duration::from_secs(60)),
            "refill is capped at the burst"
        );
    }

    #[test]
    fn one_invalid_message_bans_and_goodwill_is_capped() {
        let mut budget = PeerBudget::new(Instant::now());
        for _ in 0..1_000 {
            budget.adjust(SCORE_USEFUL);
        }
        assert_eq!(budget.score(), MAX_SCORE);
        assert!(
            !budget.adjust(SCORE_INVALID),
            "a well-behaved peer survives one invalid message"
        );
        assert!(budget.adjust(SCORE_INVALID), "but not two");
        assert!(
            PeerBudget::new(Instant::now()).adjust(SCORE_INVALID),
            "a new peer is banned at once"
        );
    }

    #[test]
    fn channels_have_independent_budgets() {
        let now = Instant::now();
        let mut budget = PeerBudget::new(now);
        let mgmt_burst = rate_budget(Channel::Mgmt).1;
        for _ in 0..mgmt_burst {
            assert!(budget.admit(Channel::Mgmt, now));
        }
        assert!(!budget.admit(Channel::Mgmt, now));
        assert!(
            budget.admit(Channel::BlockProp, now),
            "management flooding does not starve blocks"
        );
    }
}
