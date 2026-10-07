//! Choosing which transactions go into a block (the proposer's side of Section 22).
//!
//! The proposer picks *which* transactions; their order is fixed by protocol. [`select`]
//! orders the candidates canonically, then applies them one by one on a scratch overlay and
//! keeps those that pass stateful validation and fit the block limits. Dropping a transaction
//! also drops its sender's later nonces (they fail the nonce check), so the selection stays in
//! canonical order with contiguous nonces.
//!
//! The selection is then executed again by [`crate::execute_block`], the same function every
//! validator runs, and that result is what goes into the header. Building and validating
//! therefore cannot disagree about a block's roots.

use std::collections::BTreeMap;

use aletheia_core::{Address, AletheiaError, ErrorCode};
use aletheia_state::{StateOverlay, StateView};

use crate::context::BlockContext;
use crate::model::Records;
use crate::ordering::canonical_order;
use crate::rules::Rules;
use crate::stateless::VerifiedTransaction;

/// Keeps, per sender, only the contiguous run of nonces starting at the sender's next nonce.
fn contiguous_runs(
    records: &Records,
    base: &dyn StateView,
    candidates: Vec<VerifiedTransaction>,
) -> Result<Vec<VerifiedTransaction>, AletheiaError> {
    let mut by_sender: BTreeMap<Address, BTreeMap<u64, VerifiedTransaction>> = BTreeMap::new();
    for tx in candidates {
        let body = &tx.transaction().body;
        by_sender
            .entry(body.sender)
            .or_default()
            .entry(body.nonce)
            .or_insert(tx);
    }
    let mut kept = Vec::new();
    for (sender, nonces) in by_sender {
        let mut next = records
            .account(base, &sender)?
            .map_or(0, |account| account.next_nonce);
        for (nonce, tx) in nonces {
            if nonce != next {
                break;
            }
            kept.push(tx);
            next = next.saturating_add(1);
        }
    }
    Ok(kept)
}

/// The transactions to include, in canonical order.
pub fn select(
    rules: Rules,
    records: &Records,
    base: &dyn StateView,
    ctx: &BlockContext,
    candidates: Vec<VerifiedTransaction>,
) -> Result<Vec<VerifiedTransaction>, AletheiaError> {
    let limits = rules.block_limits();
    let runs: Vec<VerifiedTransaction> = contiguous_runs(records, base, candidates)?
        .into_iter()
        .filter(|tx| rules.tx_type_active(tx.transaction().body.tx_type()))
        .collect();
    let order = canonical_order(records.network(), &ctx.parent_hash, &runs, &mut |sender| {
        Ok(records
            .account(base, sender)?
            .map_or(0, |account| account.next_nonce))
    })?;

    let mut overlay = StateOverlay::new(base);
    let mut included = Vec::new();
    let (mut bytes, mut eu) = (0usize, 0u64);
    for index in order {
        let Some(tx) = runs.get(index) else { continue };
        let tx_count = u32::try_from(included.len()).unwrap_or(u32::MAX);
        if tx_count >= limits.max_block_txs
            || bytes.saturating_add(tx.encoded_len()) > limits.max_block_bytes
        {
            break;
        }
        overlay.checkpoint();
        match rules.apply_transaction(records, &mut overlay, tx, ctx, tx_count) {
            Ok(receipt) if eu.saturating_add(receipt.eu_used) <= limits.max_block_eu => {
                overlay.commit_checkpoint();
                eu = eu.saturating_add(receipt.eu_used);
                bytes = bytes.saturating_add(tx.encoded_len());
                included.push(tx.clone());
            }
            Ok(_) => {
                overlay.revert_to_checkpoint()?;
                break;
            }
            Err(error) if error.is_fail_stop() || error.code() == ErrorCode::StoCorrupt => {
                return Err(error);
            }
            Err(_) => overlay.revert_to_checkpoint()?,
        }
    }
    Ok(included)
}
