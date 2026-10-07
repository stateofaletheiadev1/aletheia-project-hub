//! Deterministic in-block transaction ordering (spec Section 22, APS-0011, ADR-012, R.12).
//!
//! ```text
//! 1. partition by priority class: System < MonetaryAuthority < Governance < Normal
//! 2. within a class, group by sender; each group sorted by nonce, contiguous from the sender's
//!    next_nonce in the parent state
//! 3. order groups by k(sender) = H_domain("ALETHEIA/ORDER/v1", parent_hash || sender_bytes)
//! 4. concatenate classes, groups, transactions
//! ```
//!
//! The proposer picks *which* transactions; the protocol fixes their order. Fees cannot buy
//! position, and because the parent hash is fixed before the block is built, the proposer
//! cannot grind sender positions. Sorting uses a strict total order on unique keys, so the
//! result does not depend on the sort algorithm.

use std::collections::BTreeMap;

use aletheia_core::{
    Address, AletheiaError, DomainTag, ErrorCode, Hash32, NetworkIdentity, TxType,
};

use crate::stateless::VerifiedTransaction;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum PriorityClass {
    System,
    MonetaryAuthority,
    Governance,
    Normal,
}

/// Priority class of a transaction type. Validator and evidence types are System, monetary
/// operations MonetaryAuthority, governance types Governance (Section 13 tag ranges); the
/// types active at protocol version 1 are all Normal.
pub fn priority_class(tx_type: TxType) -> PriorityClass {
    match tx_type.get() {
        16..=20 | 96 => PriorityClass::MonetaryAuthority,
        64..=79 => PriorityClass::System,
        80..=95 => PriorityClass::Governance,
        _ => PriorityClass::Normal,
    }
}

/// `k(sender)` for a parent.
pub fn order_key(network: &NetworkIdentity, parent_hash: &Hash32, sender: &Address) -> Hash32 {
    let mut hasher = network.domain_hasher(DomainTag::Order);
    hasher
        .update(parent_hash.as_bytes())
        .update(&sender.to_bytes());
    hasher.finalize()
}

fn order_error(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::BlkNotCanonicalOrder, detail)
}

/// The canonical order of `transactions` (indices into the slice). `next_nonce` gives each
/// sender's next nonce in the parent state. Fails if a sender's nonces are not contiguous
/// from its next nonce or repeat.
pub fn canonical_order(
    network: &NetworkIdentity,
    parent_hash: &Hash32,
    transactions: &[VerifiedTransaction],
    next_nonce: &mut dyn FnMut(&Address) -> Result<u64, AletheiaError>,
) -> Result<Vec<usize>, AletheiaError> {
    // (class, order key) -> sender group of (nonce, index). A sender's transactions may span
    // classes in principle; each (class, sender) group is checked for contiguity separately,
    // in class order, continuing from where the previous class left the nonce.
    let mut groups: BTreeMap<(PriorityClass, Hash32), (Address, BTreeMap<u64, usize>)> =
        BTreeMap::new();
    for (index, verified) in transactions.iter().enumerate() {
        let body = &verified.transaction().body;
        let group = groups
            .entry((
                priority_class(body.tx_type()),
                order_key(network, parent_hash, &body.sender),
            ))
            .or_insert_with(|| (body.sender, BTreeMap::new()));
        if group.1.insert(body.nonce, index).is_some() {
            return Err(order_error(format!(
                "sender {:?} repeats nonce {}",
                body.sender, body.nonce
            )));
        }
    }

    let mut expected: BTreeMap<Address, u64> = BTreeMap::new();
    let mut order = Vec::with_capacity(transactions.len());
    for ((_, _), (sender, nonces)) in groups {
        let mut next = match expected.get(&sender) {
            Some(n) => *n,
            None => next_nonce(&sender)?,
        };
        for (nonce, index) in nonces {
            if nonce != next {
                return Err(order_error(format!(
                    "sender {sender:?} has nonce {nonce} where {next} is next"
                )));
            }
            next = next
                .checked_add(1)
                .ok_or_else(|| order_error("nonce overflow".to_owned()))?;
            order.push(index);
        }
        expected.insert(sender, next);
    }
    Ok(order)
}

/// Validators accept a block only if its transactions are already in canonical order.
pub fn check_canonical_order(
    network: &NetworkIdentity,
    parent_hash: &Hash32,
    transactions: &[VerifiedTransaction],
    next_nonce: &mut dyn FnMut(&Address) -> Result<u64, AletheiaError>,
) -> Result<(), AletheiaError> {
    let order = canonical_order(network, parent_hash, transactions, next_nonce)?;
    if let Some(position) = order
        .iter()
        .enumerate()
        .position(|(position, &index)| position != index)
    {
        return Err(order_error(format!(
            "transaction at position {position} is out of canonical order"
        )));
    }
    Ok(())
}
