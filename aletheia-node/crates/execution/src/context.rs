//! What a block executes against besides state (spec Section 6.1): the block context, and
//! execution-unit metering (Section 29).

use aletheia_core::{
    AletheiaError, Epoch, ErrorCode, Hash32, Height, ProtocolVersion, Slot, ValidatorIndex,
};

/// Everything besides state and transactions that execution may read. Contracts and native
/// modules read time only through `protocol_time_ms`, which is derived from the slot.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockContext {
    pub height: Height,
    pub slot: Slot,
    pub epoch: Epoch,
    pub protocol_time_ms: u64,
    pub proposer: ValidatorIndex,
    pub parent_hash: Hash32,
    pub protocol_version: ProtocolVersion,
}

/// The metered action could not be paid for within the transaction's `eu_limit`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OutOfEu;

/// Execution-unit meter. Every charge is checked *before* the action it pays for, so
/// execution stops deterministically at `used == limit` (Section 29).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Meter {
    limit: u64,
    used: u64,
}

impl Meter {
    pub fn new(limit: u64) -> Meter {
        Meter { limit, used: 0 }
    }

    pub fn used(&self) -> u64 {
        self.used
    }

    pub fn limit(&self) -> u64 {
        self.limit
    }

    pub fn remaining(&self) -> u64 {
        self.limit.saturating_sub(self.used)
    }

    pub fn charge(&mut self, units: u64) -> Result<(), OutOfEu> {
        match self.used.checked_add(units) {
            Some(total) if total <= self.limit => {
                self.used = total;
                Ok(())
            }
            _ => Err(OutOfEu),
        }
    }

    /// After running out, the whole limit is consumed and paid for.
    pub fn exhaust(&mut self) {
        self.used = self.limit;
    }
}

/// How a transaction's payload ended. Errors here are deterministic outcomes recorded in the
/// receipt, not node failures.
#[derive(Debug)]
pub enum PayloadOutcome {
    Success,
    Failed(AletheiaError),
    OutOfEu,
}

impl From<OutOfEu> for PayloadOutcome {
    fn from(_: OutOfEu) -> PayloadOutcome {
        PayloadOutcome::OutOfEu
    }
}

/// Converts a payload `Result` into an outcome. Fail-stop errors (storage corruption,
/// invariant breaks) are not transaction outcomes and propagate instead.
pub fn outcome(
    result: Result<Result<(), OutOfEu>, AletheiaError>,
) -> Result<PayloadOutcome, AletheiaError> {
    match result {
        Ok(Ok(())) => Ok(PayloadOutcome::Success),
        Ok(Err(OutOfEu)) => Ok(PayloadOutcome::OutOfEu),
        Err(error) if error.is_fail_stop() || error.code() == ErrorCode::StoCorrupt => Err(error),
        Err(error) => Ok(PayloadOutcome::Failed(error)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_meter_refuses_a_charge_that_would_pass_the_limit_and_keeps_the_old_total() {
        let mut meter = Meter::new(5_000);
        assert_eq!(meter.charge(2_000), Ok(()));
        assert_eq!(meter.charge(3_001), Err(OutOfEu));
        assert_eq!(meter.used(), 2_000, "a refused charge consumes nothing");
        assert_eq!(meter.charge(3_000), Ok(()));
        assert_eq!(meter.charge(0), Ok(()));
        assert_eq!(meter.charge(1), Err(OutOfEu));
        meter.exhaust();
        assert_eq!(meter.used(), 5_000);
    }
}
