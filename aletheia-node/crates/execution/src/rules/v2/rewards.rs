//! Validator rewards, protocol version 2 (ADR-069, founder decisions of 2026-11-26).
//!
//! ```text
//! source     every fee in FEE_POOL (each fee asset)  +  up to pool_payout ALnT from REWARD_POOL
//! period     period_slots (default: one day of slots); paid by the first block of the next
//! split      by work: credit = blocks served while a member − parent signatures missed
//! recipient  the registered operator; a validator without one (the state's own) pays the
//!            state beneficiary, or leaves its share in the pools while none is set
//! ```
//!
//! ALnT's supply is fixed (Section 18.7), so rewards only move what already exists: fees, and
//! whatever the treasury transfers into [`REWARD_POOL`]. Remainders of the division stay where
//! they were.
//!
//! The record is written only when something changes: a missed signature, a set change, a
//! payout. A healthy network, where every member signs every block, writes nothing per block,
//! which keeps state growth on 500 ms slots at zero.

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, Address, AletheiaError, AssetId, ErrorCode,
};
use aletheia_state::{StateOverlay, StateView};

use crate::context::BlockContext;
use crate::model::{FEE_POOL, ParamId, Records, module_address};
use crate::rules::v1::Touched;
use crate::rules::v1::balances::{credit, debit};
use crate::validator_model::{VALIDATOR_REGISTRY, Validators};

/// Holds what the treasury sets aside for validator rewards.
pub const REWARD_POOL: Address = module_address(11);

/// Bound on the entries of one period's record.
const MAX_ENTRIES: u32 = 4096;

fn corrupt(what: &str, error: &AletheiaError) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoCorrupt,
        format!("stored {what} does not decode: {}", error.detail()),
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RewardPolicy {
    pub period_slots: u64,
    pub pool_payout: u128,
    pub state_beneficiary: Option<Address>,
}

impl AceEncode for RewardPolicy {
    fn encode(&self, out: &mut AceWriter) {
        out.u64(self.period_slots);
        out.u128(self.pool_payout);
        out.option(self.state_beneficiary.as_ref());
    }
}

impl AceDecode for RewardPolicy {
    fn decode(input: &mut AceReader<'_>) -> Result<RewardPolicy, AletheiaError> {
        Ok(RewardPolicy {
            period_slots: input.u64()?,
            pool_payout: input.u128()?,
            state_beneficiary: input.option()?,
        })
    }
}

/// One validator's work in the current period.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WorkEntry {
    pub node_key: [u8; 32],
    /// In the set now; its credit grows with every block from `since`.
    pub active: bool,
    pub since_height: u64,
    pub missed: u64,
    /// Credit from earlier stretches of membership in this period.
    pub earned: u64,
}

impl WorkEntry {
    fn credit(&self, end_height: u64) -> u64 {
        let current = if self.active {
            end_height
                .saturating_sub(self.since_height)
                .saturating_sub(self.missed)
        } else {
            0
        };
        self.earned.saturating_add(current)
    }
}

impl AceEncode for WorkEntry {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.node_key);
        out.bool(self.active);
        out.u64(self.since_height);
        out.u64(self.missed);
        out.u64(self.earned);
    }
}

impl AceDecode for WorkEntry {
    fn decode(input: &mut AceReader<'_>) -> Result<WorkEntry, AletheiaError> {
        Ok(WorkEntry {
            node_key: input.array()?,
            active: input.bool()?,
            since_height: input.u64()?,
            missed: input.u64()?,
            earned: input.u64()?,
        })
    }
}

/// The current period's record, entries in ascending node-key order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RewardLedger {
    pub period: u64,
    pub entries: Vec<WorkEntry>,
}

impl AceEncode for RewardLedger {
    fn encode(&self, out: &mut AceWriter) {
        out.u64(self.period);
        out.list(&self.entries);
    }
}

impl AceDecode for RewardLedger {
    fn decode(input: &mut AceReader<'_>) -> Result<RewardLedger, AletheiaError> {
        Ok(RewardLedger {
            period: input.u64()?,
            entries: input.list(MAX_ENTRIES)?,
        })
    }
}

impl RewardLedger {
    fn entry_mut(&mut self, node_key: &[u8; 32]) -> Option<&mut WorkEntry> {
        self.entries.iter_mut().find(|e| &e.node_key == node_key)
    }

    /// Starts (or restarts) a member's stretch at `height`.
    fn activate(&mut self, node_key: [u8; 32], height: u64) {
        match self.entry_mut(&node_key) {
            Some(entry) if entry.active => {}
            Some(entry) => {
                entry.active = true;
                entry.since_height = height;
                entry.missed = 0;
            }
            None => {
                self.entries.push(WorkEntry {
                    node_key,
                    active: true,
                    since_height: height,
                    missed: 0,
                    earned: 0,
                });
                self.entries.sort_by(|a, b| a.node_key.cmp(&b.node_key));
            }
        }
    }

    /// Ends a member's stretch at `height`, folding it into `earned`.
    fn deactivate(&mut self, node_key: &[u8; 32], height: u64) {
        if let Some(entry) = self.entry_mut(node_key)
            && entry.active
        {
            entry.earned = entry.credit(height);
            entry.active = false;
            entry.missed = 0;
        }
    }
}

/// One day of slots for the chain's slot duration.
fn default_period_slots(records: &Records, view: &dyn StateView) -> Result<u64, AletheiaError> {
    let slot_ms = records.chain_timing(view)?.slot_duration_ms.max(1);
    Ok(86_400_000u64.checked_div(slot_ms).unwrap_or(1).max(1))
}

pub fn policy(records: &Records, view: &dyn StateView) -> Result<RewardPolicy, AletheiaError> {
    match view.get(&records.param_key(ParamId::RewardPolicy))? {
        Some(bytes) => {
            RewardPolicy::from_ace_bytes(&bytes).map_err(|e| corrupt("reward policy", &e))
        }
        None => Ok(RewardPolicy {
            period_slots: default_period_slots(records, view)?,
            pool_payout: 0,
            state_beneficiary: None,
        }),
    }
}

pub fn put_policy(records: &Records, overlay: &mut StateOverlay<'_>, policy: &RewardPolicy) {
    overlay.put(
        records.param_key(ParamId::RewardPolicy),
        policy.to_ace_bytes(),
    );
}

pub fn ledger(
    records: &Records,
    view: &dyn StateView,
) -> Result<Option<RewardLedger>, AletheiaError> {
    view.get(&records.param_key(ParamId::RewardLedger))?
        .map(|bytes| RewardLedger::from_ace_bytes(&bytes).map_err(|e| corrupt("reward ledger", &e)))
        .transpose()
}

/// Who receives a validator's share: its operator, or the state beneficiary for a validator
/// without a licensed operator.
fn recipient(
    records: &Records,
    view: &dyn StateView,
    node_key: &[u8; 32],
    policy: &RewardPolicy,
) -> Result<Option<Address>, AletheiaError> {
    let registration = Validators::new(records).registration(view, node_key)?;
    Ok(match registration {
        Some(record) if record.operator != VALIDATOR_REGISTRY => Some(record.operator),
        _ => policy.state_beneficiary,
    })
}

/// Pays the closed period: each source amount split by credit, floors only.
fn pay_out(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    ledger: &RewardLedger,
    end_height: u64,
    policy: &RewardPolicy,
    touched: &mut Touched,
) -> Result<(), AletheiaError> {
    let credits: Vec<([u8; 32], u128)> = ledger
        .entries
        .iter()
        .map(|e| (e.node_key, u128::from(e.credit(end_height))))
        .filter(|(_, credit)| *credit > 0)
        .collect();
    let total: u128 = credits
        .iter()
        .map(|(_, c)| *c)
        .fold(0, u128::saturating_add);
    if total == 0 {
        return Ok(());
    }
    let pool_alnt = records
        .balance(overlay, &REWARD_POOL, AssetId::ALNT)?
        .available;
    let mut sources = vec![(
        REWARD_POOL,
        AssetId::ALNT,
        pool_alnt.min(policy.pool_payout),
    )];
    for asset in [AssetId::ALNT, AssetId::AEY] {
        let fees = records.balance(overlay, &FEE_POOL, asset)?.available;
        sources.push((FEE_POOL, asset, fees));
    }
    for (source, asset, amount) in sources {
        if amount == 0 {
            continue;
        }
        for (node_key, weight) in &credits {
            let Some(to) = recipient(records, overlay, node_key, policy)? else {
                continue;
            };
            // amount × weight / total without overflow: weight ≤ total, so split the product.
            let whole = amount.checked_div(total).unwrap_or(0);
            let rest = amount.checked_rem(total).unwrap_or(0);
            let share = whole
                .saturating_mul(*weight)
                .saturating_add(rest.saturating_mul(*weight).checked_div(total).unwrap_or(0));
            if share == 0 {
                continue;
            }
            debit(records, overlay, &source, asset, share)?;
            credit(records, overlay, &to, asset, share)?;
            touched.push((source, asset));
            touched.push((to, asset));
        }
    }
    Ok(())
}

/// End of every non-suffix version-2 block, after the registry's end of block: pays a closed
/// period, counts the parent signatures members missed, and follows set changes.
pub fn end_block(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    ctx: &BlockContext,
) -> Result<Touched, AletheiaError> {
    let mut touched = Vec::new();
    let validators = Validators::new(records);
    let epoch = ctx.epoch.get();
    let height = ctx.height.get();
    let Some(set) = validators.set(overlay, epoch)? else {
        // A chain without validators (devnet producer) has no one to reward.
        return Ok(touched);
    };
    let policy = policy(records, overlay)?;
    let period = ctx.slot.get().checked_div(policy.period_slots).unwrap_or(0);
    let stored = ledger(records, overlay)?;
    let mut changed = false;
    let mut current = match stored.clone() {
        Some(current) => current,
        None => {
            changed = true;
            let mut fresh = RewardLedger {
                period,
                entries: Vec::new(),
            };
            for member in &set {
                fresh.activate(member.node_key, height);
            }
            fresh
        }
    };

    if period > current.period {
        pay_out(records, overlay, &current, height, &policy, &mut touched)?;
        let mut fresh = RewardLedger {
            period,
            entries: Vec::new(),
        };
        for member in &set {
            fresh.activate(member.node_key, height);
        }
        current = fresh;
        changed = true;
    }

    // Members that did not sign the parent's certificate missed this block's work.
    if ctx.parent_signers.is_signed() {
        for (index, member) in (0u16..).zip(&set) {
            if !ctx.parent_signers.contains(index)
                && let Some(entry) = current.entry_mut(&member.node_key)
                && entry.active
            {
                entry.missed = entry.missed.saturating_add(1);
                changed = true;
            }
        }
    }

    // This block closed the epoch: members leaving stop earning after it, members joining start
    // with the next block.
    let state = validators.epoch_state(overlay)?;
    if state.closed
        && state.epoch == epoch
        && let Some(next) = validators.set(overlay, epoch.saturating_add(1))?
    {
        let after = height.saturating_add(1);
        for member in &set {
            if !next.iter().any(|n| n.node_key == member.node_key) {
                current.deactivate(&member.node_key, after);
            }
        }
        for member in &next {
            current.activate(member.node_key, after);
        }
        changed = true;
    }

    if changed && stored.as_ref() != Some(&current) {
        overlay.put(
            records.param_key(ParamId::RewardLedger),
            current.to_ace_bytes(),
        );
    }
    Ok(touched)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credit_is_blocks_served_minus_missed_plus_earlier_stretches() {
        let entry = WorkEntry {
            node_key: [1; 32],
            active: true,
            since_height: 100,
            missed: 7,
            earned: 40,
        };
        assert_eq!(entry.credit(200), 40 + 100 - 7);
        let left = WorkEntry {
            active: false,
            ..entry
        };
        assert_eq!(left.credit(200), 40);
    }

    #[test]
    fn a_member_who_leaves_and_returns_keeps_what_it_earned() {
        let mut ledger = RewardLedger {
            period: 0,
            entries: Vec::new(),
        };
        ledger.activate([2; 32], 10);
        ledger.entry_mut(&[2; 32]).unwrap().missed = 3;
        ledger.deactivate(&[2; 32], 30);
        assert_eq!(ledger.entries[0].earned, 17);
        ledger.activate([2; 32], 50);
        assert_eq!(ledger.entries[0].credit(60), 17 + 10);
    }

    #[test]
    fn records_round_trip() {
        let ledger = RewardLedger {
            period: 9,
            entries: vec![WorkEntry {
                node_key: [3; 32],
                active: true,
                since_height: 1,
                missed: 2,
                earned: 3,
            }],
        };
        assert_eq!(
            RewardLedger::from_ace_bytes(&ledger.to_ace_bytes()),
            Ok(ledger)
        );
        let policy = RewardPolicy {
            period_slots: 172_800,
            pool_payout: 5,
            state_beneficiary: Some(module_address(42)),
        };
        assert_eq!(
            RewardPolicy::from_ace_bytes(&policy.to_ace_bytes()),
            Ok(policy)
        );
    }
}
