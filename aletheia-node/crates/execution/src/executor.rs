//! Block execution (spec Section 20, APS-0012). Sequential in v0.1, in canonical order.
//!
//! [`execute_block`] runs a block against a read-only base view and returns the sorted state
//! changes plus everything the header commits to besides the state root. The caller turns the
//! changes into the state root with the JMT (into a scratch batch when only verifying), so
//! execution itself never writes storage.

use aletheia_core::block::BlockHeader;
use aletheia_core::{AletheiaError, ErrorCode, Hash32, NetworkIdentity};
use aletheia_crypto::merkle;
use aletheia_state::{StateKey, StateOverlay, StateValue, StateView};

use crate::context::BlockContext;
use crate::model::Records;
use crate::ordering::check_canonical_order;
use crate::receipt::Receipt;
use crate::rules::Rules;
use crate::stateless::VerifiedTransaction;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutedBlock {
    pub changes: Vec<(StateKey, Option<StateValue>)>,
    pub receipts: Vec<Receipt>,
    pub tx_root: Hash32,
    pub receipt_root: Hash32,
    pub event_root: Hash32,
    pub eu_used: u64,
    pub tx_count: u32,
}

fn limit_exceeded(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::BlkLimitExceeded, detail)
}

pub fn execute_block(
    rules: Rules,
    records: &Records,
    base: &dyn StateView,
    ctx: &BlockContext,
    transactions: &[VerifiedTransaction],
) -> Result<ExecutedBlock, AletheiaError> {
    let limits = rules.block_limits();
    let tx_count = u32::try_from(transactions.len())
        .map_err(|_| limit_exceeded("transaction count exceeds u32".to_owned()))?;
    if tx_count > limits.max_block_txs {
        return Err(limit_exceeded(format!(
            "{tx_count} transactions exceed {}",
            limits.max_block_txs
        )));
    }
    let bytes: usize = transactions
        .iter()
        .map(VerifiedTransaction::encoded_len)
        .fold(0, usize::saturating_add);
    if bytes > limits.max_block_bytes {
        return Err(limit_exceeded(format!(
            "{bytes} transaction bytes exceed {}",
            limits.max_block_bytes
        )));
    }
    if let Some(inactive) = transactions
        .iter()
        .find(|tx| !rules.tx_type_active(tx.transaction().body.tx_type()))
    {
        return Err(AletheiaError::new(
            ErrorCode::TxTypeNotActive,
            format!(
                "transaction type {} is not active at protocol version {}",
                inactive.transaction().body.tx_type(),
                rules.version()
            ),
        ));
    }
    check_canonical_order(
        records.network(),
        &ctx.parent_hash,
        transactions,
        &mut |sender| {
            Ok(records
                .account(base, sender)?
                .map_or(0, |account| account.next_nonce))
        },
    )?;

    let mut overlay = StateOverlay::new(base);
    let mut receipts = Vec::with_capacity(transactions.len());
    let mut touched = Vec::new();
    let mut eu_used = 0u64;
    for (index, tx) in (0u32..).zip(transactions) {
        let (receipt, moved) = rules
            .apply_transaction(records, &mut overlay, tx, ctx, index)
            .map_err(|error| {
                if error.is_fail_stop() || error.code() == ErrorCode::StoCorrupt {
                    return error;
                }
                AletheiaError::new(
                    ErrorCode::BlkInvalidTransaction,
                    format!(
                        "transaction {index} ({}) is invalid: {} ({}): {}",
                        tx.tx_id().to_text(records.network().network_kind()),
                        error.code().name(),
                        error.code().get(),
                        error.detail()
                    ),
                )
            })?;
        touched.extend(moved);
        eu_used = eu_used
            .checked_add(receipt.eu_used)
            .ok_or_else(|| limit_exceeded("block EU overflows".to_owned()))?;
        receipts.push(receipt);
    }
    if eu_used > limits.max_block_eu {
        return Err(limit_exceeded(format!(
            "block uses {eu_used} EU; limit {}",
            limits.max_block_eu
        )));
    }

    touched.extend(rules.end_block(records, &mut overlay, ctx)?);
    check_supply(rules, records, base, &overlay, transactions, &touched)?;

    let network = records.network();
    let witness: Vec<[u8; 32]> = transactions
        .iter()
        .map(|tx| tx.witness_hash().into_bytes())
        .collect();
    let receipt_hashes: Vec<[u8; 32]> = receipts
        .iter()
        .map(|r| r.hash(network).into_bytes())
        .collect();
    let event_hashes: Vec<[u8; 32]> = receipts
        .iter()
        .flat_map(|r| r.events.iter())
        .map(|e| e.hash(network).into_bytes())
        .collect();
    Ok(ExecutedBlock {
        changes: overlay.into_changes(),
        tx_root: merkle::root(network, &witness),
        receipt_root: merkle::root(network, &receipt_hashes),
        event_root: merkle::root(network, &event_hashes),
        receipts,
        eu_used,
        tx_count,
    })
}

/// The monetary invariant check after every block (Section 18.4). For each asset whose
/// balances the block can touch, the net balance change - recomputed from the state before
/// and after, not trusted from the code that moved it - must equal the change of the asset's
/// digital supply buckets, and the ledger must satisfy I1-I8 before and after.
pub fn check_supply(
    rules: Rules,
    records: &Records,
    base: &dyn StateView,
    after: &StateOverlay<'_>,
    transactions: &[VerifiedTransaction],
    reported: &[(aletheia_core::Address, aletheia_core::AssetId)],
) -> Result<(), AletheiaError> {
    let touched: std::collections::BTreeSet<(aletheia_core::Address, aletheia_core::AssetId)> =
        transactions
            .iter()
            .flat_map(|tx| rules.touched_balances(tx))
            .chain(reported.iter().copied())
            .collect();
    let mut deltas: std::collections::BTreeMap<
        aletheia_core::AssetId,
        aletheia_monetary::BalanceDelta,
    > = std::collections::BTreeMap::new();
    for (address, asset) in &touched {
        let total = |balance: crate::model::Balance| {
            balance
                .available
                .checked_add(balance.locked)
                .ok_or_else(|| {
                    AletheiaError::new(
                        ErrorCode::MonetaryInvariantViolated,
                        format!("a balance of asset {asset} overflows"),
                    )
                })
        };
        let before = total(records.balance(base, address, *asset)?)?;
        let now = total(records.balance(after, address, *asset)?)?;
        deltas.entry(*asset).or_default().record(before, now)?;
    }
    for (asset, delta) in deltas {
        let missing = || {
            AletheiaError::new(
                ErrorCode::MonetaryInvariantViolated,
                format!("asset {asset} has balances but no supply ledger"),
            )
        };
        let before = records.supply_ledger(base, asset)?.ok_or_else(missing)?;
        let now = records.supply_ledger(after, asset)?.ok_or_else(missing)?;
        aletheia_monetary::SupplyLedger::check_transition(&before, &now, delta, asset)?;
    }
    Ok(())
}

/// Compares a header's committed results with re-execution (voting rule V1, Section 19.5).
pub fn check_header_results(
    network: &NetworkIdentity,
    header: &BlockHeader,
    executed: &ExecutedBlock,
    state_root: &Hash32,
) -> Result<(), AletheiaError> {
    let mismatch = |field: &str, header_value: String, computed: String| {
        AletheiaError::new(
            ErrorCode::BlkRootMismatch,
            format!(
                "block {} at height {}: header {field} {header_value}, re-execution gives {computed}",
                header.block_id(network).to_text(network.network_kind()),
                header.height
            ),
        )
    };
    let roots = [
        ("tx_root", header.tx_root, executed.tx_root),
        ("receipt_root", header.receipt_root, executed.receipt_root),
        ("event_root", header.event_root, executed.event_root),
        ("state_root", header.state_root, *state_root),
    ];
    for (field, committed, computed) in roots {
        if committed != computed {
            return Err(mismatch(field, committed.to_string(), computed.to_string()));
        }
    }
    if header.eu_used != executed.eu_used {
        return Err(mismatch(
            "eu_used",
            header.eu_used.to_string(),
            executed.eu_used.to_string(),
        ));
    }
    if header.tx_count != executed.tx_count {
        return Err(mismatch(
            "tx_count",
            header.tx_count.to_string(),
            executed.tx_count.to_string(),
        ));
    }
    Ok(())
}
