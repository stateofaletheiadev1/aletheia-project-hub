//! Per-peer rate limiting and scoring (spec Section 36). Wall-clock time is fine here: none of
//! this influences consensus outputs, only which connections the node keeps.

use std::time::Instant;

use crate::frame::Channel;
use crate::limits::{BAN_THRESHOLD, MAX_SCORE, byte_budget, rate_budget};

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
        self.try_take_n(1, now)
    }

    /// Takes `count` tokens if that many are available; takes none otherwise.
    pub fn try_take_n(&mut self, count: u64, now: Instant) -> bool {
        let elapsed_ms =
            u64::try_from(now.saturating_duration_since(self.last).as_millis()).unwrap_or(u64::MAX);
        let refill = elapsed_ms.saturating_mul(u64::from(self.per_second));
        let cap = u64::from(self.burst).saturating_mul(1_000);
        self.milli_tokens = self.milli_tokens.saturating_add(refill).min(cap);
        self.last = now;
        let needed = count.saturating_mul(1_000);
        if self.milli_tokens >= needed {
            self.milli_tokens = self.milli_tokens.saturating_sub(needed);
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
    bytes: [TokenBucket; 6],
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
            bytes: Channel::ALL.map(|channel| {
                let (per_second, burst) = byte_budget(channel);
                TokenBucket::new(per_second, burst, now)
            }),
            score: 0,
        }
    }

    /// Admits one frame of `payload_bytes` on `channel` if both its frame and byte budgets
    /// allow it.
    pub fn admit(&mut self, channel: Channel, payload_bytes: usize, now: Instant) -> bool {
        let index = bucket_index(channel);
        let bytes = u64::try_from(payload_bytes).unwrap_or(u64::MAX);
        self.buckets
            .get_mut(index)
            .is_some_and(|bucket| bucket.try_take(now))
            && self
                .bytes
                .get_mut(index)
                .is_some_and(|bucket| bucket.try_take_n(bytes, now))
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
            assert!(budget.admit(Channel::Mgmt, 8, now));
        }
        assert!(!budget.admit(Channel::Mgmt, 8, now));
        assert!(
            budget.admit(Channel::BlockProp, 40, now),
            "management flooding does not starve blocks"
        );
    }

    #[test]
    fn large_frames_spend_the_byte_budget_within_the_frame_budget() {
        let now = Instant::now();
        let mut budget = PeerBudget::new(now);
        let (_, burst) = crate::limits::byte_budget(Channel::Consensus);
        let frame = crate::frame::MAX_FRAME_CONSENSUS_BYTES;
        let fits = usize::try_from(burst).unwrap() / frame;
        for _ in 0..fits {
            assert!(budget.admit(Channel::Consensus, frame, now));
        }
        assert!(
            !budget.admit(Channel::Consensus, frame, now),
            "{fits} maximum frames exhaust the byte burst long before the 2,000-frame burst"
        );
        assert!(
            budget.admit(Channel::Consensus, 100, now + Duration::from_millis(10)),
            "small frames continue as bytes refill"
        );
    }

    #[test]
    fn every_channel_admits_its_largest_frame() {
        let now = Instant::now();
        for channel in Channel::ALL {
            let mut budget = PeerBudget::new(now);
            assert!(
                budget.admit(channel, channel.max_payload(), now),
                "{channel:?}"
            );
        }
    }
}
