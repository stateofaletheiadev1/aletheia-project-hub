//! The per-asset supply ledger and its invariants (spec Section 18.4, Appendix R.8).
//!
//! ```text
//! I1  outstanding   = issued_total − burned_total
//! I2  outstanding   = circulating + locked + reserved + bridge_escrow + physical_cash_outstanding
//! I3  outstanding   ≤ authorized_capacity
//! I4  issued_this_epoch ≤ epoch_issuance_cap
//! I5  redeemed_total ≤ burned_total
//! I6  issued_total, burned_total, redeemed_total never decrease
//! I7  Σ digital balances == circulating + locked + reserved + bridge_escrow
//!     (incremental: the block's net balance change equals the change of those buckets)
//! I8  reserve-backed assets: outstanding_liabilities = outstanding
//! ```
//!
//! `outstanding` is derived, not stored, so I1 holds by construction once `burned_total ≤
//! issued_total` (checked). I9 (reserve ratio against attestations) and I10-I15 (bridge and
//! physical cash) need the oracle, bridge and cash modules and are checked there; their
//! buckets already exist here so I2 and I7 account for them from the start.
//!
//! A violation found while executing a proposed block makes the block invalid
//! ([`ErrorCode::MonetaryInvariantViolated`]): the node refuses to vote. One found in
//! finalized state is [`ErrorCode::MonetaryInvariantViolatedFinalized`], a fail-stop. The node
//! never repairs balances itself.

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, AssetId, ErrorCode,
};

/// Per-asset supply buckets, in base units. State namespace 4 (`MonetaryLedger`), key
/// `AssetId`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct SupplyLedger {
    pub issued_total: u128,
    pub burned_total: u128,
    pub redeemed_total: u128,
    /// Available balances of ordinary accounts.
    pub circulating: u128,
    /// Locked balances (escrow, staking bonds).
    pub locked: u128,
    /// Held in reserve accounts.
    pub reserved: u128,
    /// Held in bridge escrow accounts.
    pub bridge_escrow: u128,
    /// Issued as physical banknotes; not an on-chain balance.
    pub physical_cash_outstanding: u128,
    pub authorized_capacity: u128,
    pub epoch_issuance_cap: u128,
    pub issued_this_epoch: u128,
    /// The epoch `issued_this_epoch` counts.
    pub issuance_epoch: u64,
    /// Reserve-backed assets (AEY) track liabilities against outstanding supply (I8).
    pub reserve_backed: bool,
    pub outstanding_liabilities: u128,
}

/// The net change of all digital balances of one asset over a block: the sum of every
/// account's increase and the sum of every account's decrease, kept apart so no signed
/// arithmetic is needed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct BalanceDelta {
    pub increased: u128,
    pub decreased: u128,
}

impl BalanceDelta {
    /// Records one account's balance moving from `before` to `after`.
    pub fn record(&mut self, before: u128, after: u128) -> Result<(), AletheiaError> {
        let overflow = || violation(AssetId::AEY, "balance delta overflows".to_owned());
        if after >= before {
            self.increased = self
                .increased
                .checked_add(after.abs_diff(before))
                .ok_or_else(overflow)?;
        } else {
            self.decreased = self
                .decreased
                .checked_add(before.abs_diff(after))
                .ok_or_else(overflow)?;
        }
        Ok(())
    }
}

fn violation(asset: AssetId, detail: String) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::MonetaryInvariantViolated,
        format!("asset {asset}: {detail}"),
    )
}

fn sum(asset: AssetId, parts: &[u128]) -> Result<u128, AletheiaError> {
    parts.iter().try_fold(0u128, |total, part| {
        total
            .checked_add(*part)
            .ok_or_else(|| violation(asset, "supply buckets overflow".to_owned()))
    })
}

impl SupplyLedger {
    /// A ledger for supply that exists from genesis: all of it issued and circulating, and
    /// the authorized capacity equal to it (no issuance path until one is governed in).
    pub fn genesis(issued: u128, reserve_backed: bool) -> SupplyLedger {
        SupplyLedger {
            issued_total: issued,
            circulating: issued,
            authorized_capacity: issued,
            reserve_backed,
            outstanding_liabilities: if reserve_backed { issued } else { 0 },
            ..SupplyLedger::default()
        }
    }

    /// I1: `issued_total − burned_total`.
    pub fn outstanding(&self, asset: AssetId) -> Result<u128, AletheiaError> {
        self.issued_total
            .checked_sub(self.burned_total)
            .ok_or_else(|| {
                violation(
                    asset,
                    format!(
                        "I1: burned_total {} exceeds issued_total {}",
                        self.burned_total, self.issued_total
                    ),
                )
            })
    }

    /// The part of supply held as on-chain balances (the right side of I7).
    pub fn digital(&self, asset: AssetId) -> Result<u128, AletheiaError> {
        sum(
            asset,
            &[
                self.circulating,
                self.locked,
                self.reserved,
                self.bridge_escrow,
            ],
        )
    }

    /// I1-I5 and I8 on one ledger.
    pub fn check(&self, asset: AssetId) -> Result<(), AletheiaError> {
        let outstanding = self.outstanding(asset)?;
        let held = sum(
            asset,
            &[self.digital(asset)?, self.physical_cash_outstanding],
        )?;
        if outstanding != held {
            return Err(violation(
                asset,
                format!("I2: outstanding {outstanding} but buckets hold {held}"),
            ));
        }
        if outstanding > self.authorized_capacity {
            return Err(violation(
                asset,
                format!(
                    "I3: outstanding {outstanding} exceeds authorized capacity {}",
                    self.authorized_capacity
                ),
            ));
        }
        if self.issued_this_epoch > self.epoch_issuance_cap {
            return Err(violation(
                asset,
                format!(
                    "I4: issued {} this epoch, cap {}",
                    self.issued_this_epoch, self.epoch_issuance_cap
                ),
            ));
        }
        if self.redeemed_total > self.burned_total {
            return Err(violation(
                asset,
                format!(
                    "I5: redeemed_total {} exceeds burned_total {}",
                    self.redeemed_total, self.burned_total
                ),
            ));
        }
        if self.reserve_backed && self.outstanding_liabilities != outstanding {
            return Err(violation(
                asset,
                format!(
                    "I8: liabilities {} differ from outstanding {outstanding}",
                    self.outstanding_liabilities
                ),
            ));
        }
        if !self.reserve_backed && self.outstanding_liabilities != 0 {
            return Err(violation(
                asset,
                "I8: an asset without reserve backing records liabilities".to_owned(),
            ));
        }
        Ok(())
    }

    /// One block's transition: both ledgers pass [`SupplyLedger::check`], the totals never
    /// decrease (I6), and the block's net balance change equals the change of the digital
    /// buckets (I7, incremental).
    pub fn check_transition(
        before: &SupplyLedger,
        after: &SupplyLedger,
        balances: BalanceDelta,
        asset: AssetId,
    ) -> Result<(), AletheiaError> {
        before.check(asset)?;
        after.check(asset)?;
        for (name, old, new) in [
            ("issued_total", before.issued_total, after.issued_total),
            ("burned_total", before.burned_total, after.burned_total),
            (
                "redeemed_total",
                before.redeemed_total,
                after.redeemed_total,
            ),
        ] {
            if new < old {
                return Err(violation(
                    asset,
                    format!("I6: {name} decreased from {old} to {new}"),
                ));
            }
        }
        let expected = sum(asset, &[before.digital(asset)?, balances.increased])?;
        let actual = sum(asset, &[after.digital(asset)?, balances.decreased])?;
        if expected != actual {
            return Err(violation(
                asset,
                format!(
                    "I7: balances rose by {} and fell by {}, but digital supply went from {} to {}",
                    balances.increased,
                    balances.decreased,
                    before.digital(asset)?,
                    after.digital(asset)?
                ),
            ));
        }
        Ok(())
    }
}

impl AceEncode for SupplyLedger {
    fn encode(&self, out: &mut AceWriter) {
        out.u128(self.issued_total);
        out.u128(self.burned_total);
        out.u128(self.redeemed_total);
        out.u128(self.circulating);
        out.u128(self.locked);
        out.u128(self.reserved);
        out.u128(self.bridge_escrow);
        out.u128(self.physical_cash_outstanding);
        out.u128(self.authorized_capacity);
        out.u128(self.epoch_issuance_cap);
        out.u128(self.issued_this_epoch);
        out.u64(self.issuance_epoch);
        out.bool(self.reserve_backed);
        out.u128(self.outstanding_liabilities);
    }
}

impl AceDecode for SupplyLedger {
    fn decode(input: &mut AceReader<'_>) -> Result<SupplyLedger, AletheiaError> {
        Ok(SupplyLedger {
            issued_total: input.u128()?,
            burned_total: input.u128()?,
            redeemed_total: input.u128()?,
            circulating: input.u128()?,
            locked: input.u128()?,
            reserved: input.u128()?,
            bridge_escrow: input.u128()?,
            physical_cash_outstanding: input.u128()?,
            authorized_capacity: input.u128()?,
            epoch_issuance_cap: input.u128()?,
            issued_this_epoch: input.u128()?,
            issuance_epoch: input.u64()?,
            reserve_backed: input.bool()?,
            outstanding_liabilities: input.u128()?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    const A: AssetId = AssetId::ALNT;

    #[test]
    fn a_genesis_ledger_is_consistent() {
        SupplyLedger::genesis(1_000, false).check(A).unwrap();
        SupplyLedger::genesis(1_000, true)
            .check(AssetId::AEY)
            .unwrap();
        SupplyLedger::genesis(0, false).check(A).unwrap();
    }

    #[test]
    fn each_invariant_is_enforced() {
        let good = SupplyLedger::genesis(1_000, true);
        let broken = [
            (
                "I1",
                SupplyLedger {
                    burned_total: 1_001,
                    ..good
                },
            ),
            (
                "I2",
                SupplyLedger {
                    circulating: 999,
                    ..good
                },
            ),
            (
                "I3",
                SupplyLedger {
                    authorized_capacity: 999,
                    ..good
                },
            ),
            (
                "I4",
                SupplyLedger {
                    issued_this_epoch: 1,
                    ..good
                },
            ),
            (
                "I5",
                SupplyLedger {
                    redeemed_total: 1,
                    ..good
                },
            ),
            (
                "I8",
                SupplyLedger {
                    outstanding_liabilities: 5,
                    ..good
                },
            ),
        ];
        for (name, ledger) in broken {
            let error = ledger.check(AssetId::AEY).unwrap_err();
            assert_eq!(error.code(), ErrorCode::MonetaryInvariantViolated, "{name}");
            assert!(error.detail().contains(name), "{name}: {error}");
        }
    }

    #[test]
    fn totals_never_decrease() {
        let before = SupplyLedger {
            issued_total: 10,
            burned_total: 4,
            circulating: 6,
            authorized_capacity: 10,
            ..SupplyLedger::default()
        };
        let after = SupplyLedger {
            burned_total: 3,
            circulating: 7,
            ..before
        };
        let error = SupplyLedger::check_transition(&before, &after, BalanceDelta::default(), A)
            .unwrap_err();
        assert!(error.detail().contains("I6"), "{error}");
    }

    #[test]
    fn money_created_in_balances_without_issuance_is_caught() {
        let ledger = SupplyLedger::genesis(1_000, false);
        let mut delta = BalanceDelta::default();
        delta.record(100, 150).unwrap();
        delta.record(50, 0).unwrap();
        delta.record(0, 1).unwrap(); // one base unit from nowhere
        let error = SupplyLedger::check_transition(&ledger, &ledger, delta, A).unwrap_err();
        assert!(error.detail().contains("I7"), "{error}");
    }

    proptest! {
        /// Any set of moves that conserves value passes I7 with an unchanged ledger; any move
        /// that does not is caught.
        #[test]
        fn i7_accepts_exactly_the_conserving_moves(
            moves in proptest::collection::vec((0u128..1_000_000, 0u128..1_000_000), 1..20),
            leak in 0u128..3,
        ) {
            let supply: u128 = moves.iter().map(|(amount, _)| amount).sum();
            let ledger = SupplyLedger::genesis(supply, false);
            let mut delta = BalanceDelta::default();
            for (amount, _) in &moves {
                // Each move takes `amount` from one account and gives it to another.
                delta.record(*amount, 0).unwrap();
                delta.record(0, *amount).unwrap();
            }
            delta.record(0, leak).unwrap();
            let result = SupplyLedger::check_transition(&ledger, &ledger, delta, A);
            prop_assert_eq!(result.is_ok(), leak == 0);
        }

        #[test]
        fn the_encoding_round_trips(
            values in proptest::array::uniform12(any::<u128>()),
            epoch in any::<u64>(),
            backed in any::<bool>(),
        ) {
            let ledger = SupplyLedger {
                issued_total: values[0],
                burned_total: values[1],
                redeemed_total: values[2],
                circulating: values[3],
                locked: values[4],
                reserved: values[5],
                bridge_escrow: values[6],
                physical_cash_outstanding: values[7],
                authorized_capacity: values[8],
                epoch_issuance_cap: values[9],
                issued_this_epoch: values[10],
                issuance_epoch: epoch,
                reserve_backed: backed,
                outstanding_liabilities: values[11],
            };
            prop_assert_eq!(SupplyLedger::from_ace_bytes(&ledger.to_ace_bytes()).unwrap(), ledger);
        }
    }
}
