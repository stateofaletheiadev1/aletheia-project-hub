//! Balance movements shared by every version-1 module. Frozen with version 1.

use aletheia_core::{Address, AletheiaError, AssetId, ErrorCode};
use aletheia_monetary::arith::within_supply_bound;
use aletheia_state::StateOverlay;

use crate::model::Records;

pub(crate) fn debit(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    address: &Address,
    asset: AssetId,
    amount: u128,
) -> Result<(), AletheiaError> {
    let mut balance = records.balance(overlay, address, asset)?;
    balance.available = balance.available.checked_sub(amount).ok_or_else(|| {
        AletheiaError::new(
            ErrorCode::InsufficientBalance,
            format!(
                "available {} of asset {asset} is less than {amount}",
                balance.available
            ),
        )
    })?;
    records.put_balance(overlay, address, asset, balance);
    Ok(())
}

pub(crate) fn credit(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    address: &Address,
    asset: AssetId,
    amount: u128,
) -> Result<(), AletheiaError> {
    let mut balance = records.balance(overlay, address, asset)?;
    let total = balance.available.checked_add(amount).ok_or_else(|| {
        AletheiaError::new(
            ErrorCode::ArithmeticOverflow,
            format!("{} + {amount} overflows", balance.available),
        )
    })?;
    balance.available = within_supply_bound(total)?;
    records.put_balance(overlay, address, asset, balance);
    Ok(())
}
