//! Protocol version 1: genesis rules (spec Sections 13, 23, 29, 38).
//!
//! The transaction lifecycle, in order:
//!
//! 1. stateful validation - slot window, fee terms, key binding, nonce, fee affordability. A
//!    failure here makes the transaction (and so the block) invalid: it never executes and is
//!    never charged;
//! 2. the payload runs on a checkpoint under an EU meter; failure or exhaustion reverts it;
//! 3. the fee `eu_used × eu_price` is charged even if the payload failed (Section 23). If a
//!    successful payload left too little of the fee asset, the payload is reverted and
//!    recorded as failed; the fee is then always payable because step 1 checked
//!    `available >= max_fee >= eu_limit × eu_price`;
//! 4. the nonce advances, creating the account record on its first transaction;
//! 5. the receipt commits to the transaction's ordered write set.

pub mod balances;
pub mod limits;
pub mod transfer;

use aletheia_core::{AceEncode, AceWriter, AletheiaError, ErrorCode, Payload};
use aletheia_crypto::address::authorization_address;
use aletheia_state::StateOverlay;

use crate::context::{BlockContext, Meter, PayloadOutcome, outcome};
use crate::model::{Account, FEE_POOL, Records};
use crate::receipt::{Event, Receipt, ReceiptStatus};
use crate::stateless::VerifiedTransaction;

pub use limits::{BLOCK_LIMITS, TX_LIMITS, TX_TYPES};

fn invalid(code: ErrorCode, detail: String) -> AletheiaError {
    AletheiaError::new(code, detail)
}

/// Step 1. Returns the account record (if it exists) and the fee asset's EU price.
pub(crate) fn validate_stateful(
    records: &Records,
    overlay: &StateOverlay<'_>,
    verified: &VerifiedTransaction,
    ctx: &BlockContext,
) -> Result<(Option<Account>, u128), AletheiaError> {
    let tx = verified.transaction();
    let body = &tx.body;
    if ctx.slot < body.valid_from_slot {
        return Err(invalid(
            ErrorCode::TxNotYetValid,
            format!(
                "slot {} is before valid-from slot {}",
                ctx.slot, body.valid_from_slot
            ),
        ));
    }
    if ctx.slot > body.expiry_slot {
        return Err(invalid(
            ErrorCode::TxExpired,
            format!(
                "slot {} is after expiry slot {}",
                ctx.slot, body.expiry_slot
            ),
        ));
    }

    let price = records
        .fee_schedule(overlay)?
        .price(body.fee.fee_asset)
        .ok_or_else(|| {
            invalid(
                ErrorCode::TxFieldOutOfRange,
                format!("asset {} has no EU price", body.fee.fee_asset),
            )
        })?;
    let worst_case = u128::from(body.fee.eu_limit)
        .checked_mul(price)
        .ok_or_else(|| {
            invalid(
                ErrorCode::TxMaxFeeInsufficient,
                "eu_limit × eu_price overflows".to_owned(),
            )
        })?;
    if body.fee.max_fee < worst_case {
        return Err(invalid(
            ErrorCode::TxMaxFeeInsufficient,
            format!(
                "max_fee {} is below eu_limit {} × eu_price {price}",
                body.fee.max_fee, body.fee.eu_limit
            ),
        ));
    }

    let account = records.account(overlay, &body.sender)?;
    let controlling = authorization_address(records.network(), &tx.authorization)?;
    match &account {
        None => {
            if controlling != body.sender {
                return Err(invalid(
                    ErrorCode::TxKeyMismatch,
                    "authorization keys do not derive the sender address".to_owned(),
                ));
            }
            if body.nonce != 0 {
                return Err(invalid(
                    ErrorCode::TxNonceTooHigh,
                    format!("new account's first nonce is 0, got {}", body.nonce),
                ));
            }
        }
        Some(existing) => {
            if controlling.account_hash() != existing.pubkey_commitment {
                return Err(invalid(
                    ErrorCode::TxKeyMismatch,
                    "authorization keys do not match the account's key commitment".to_owned(),
                ));
            }
            if body.nonce < existing.next_nonce {
                return Err(invalid(
                    ErrorCode::TxNonceTooLow,
                    format!(
                        "nonce {} is below next nonce {}",
                        body.nonce, existing.next_nonce
                    ),
                ));
            }
            if body.nonce > existing.next_nonce {
                return Err(invalid(
                    ErrorCode::TxNonceTooHigh,
                    format!(
                        "nonce {} is above next nonce {}",
                        body.nonce, existing.next_nonce
                    ),
                ));
            }
        }
    }

    let fee_balance = records.balance(overlay, &body.sender, body.fee.fee_asset)?;
    if fee_balance.available < body.fee.max_fee {
        return Err(invalid(
            ErrorCode::TxFeeUnaffordable,
            format!(
                "available {} of fee asset {} is below max_fee {}",
                fee_balance.available, body.fee.fee_asset, body.fee.max_fee
            ),
        ));
    }
    Ok((account, price))
}

/// Runs a transaction's payload; each protocol version supplies its own.
pub type PayloadRunner = fn(
    &Records,
    &mut StateOverlay<'_>,
    &VerifiedTransaction,
    &mut Meter,
    &mut Vec<Event>,
) -> Result<PayloadOutcome, AletheiaError>;

pub fn run_payload(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Result<PayloadOutcome, AletheiaError> {
    let body = &verified.transaction().body;
    let result = match &body.payload {
        Payload::Transfer(leg) => transfer::apply_legs(
            records,
            overlay,
            &body.sender,
            core::slice::from_ref(leg),
            meter,
            events,
        ),
        Payload::BatchTransfer(legs) => {
            transfer::apply_legs(records, overlay, &body.sender, legs, meter, events)
        }
        #[cfg(feature = "test-protocol-v2")]
        Payload::TestRemark(_) => Err(invalid(
            ErrorCode::TxTypeNotActive,
            "type not active at protocol version 1".to_owned(),
        )),
    };
    outcome(result)
}

fn write_set_hash(
    records: &Records,
    changes: &[(aletheia_state::StateKey, Option<Vec<u8>>)],
) -> aletheia_core::Hash32 {
    let mut out = AceWriter::new();
    out.u32(u32::try_from(changes.len()).unwrap_or(u32::MAX));
    for (key, value) in changes {
        key.hash().encode(&mut out);
        out.option(
            value
                .as_deref()
                .map(aletheia_state::jmt::value_hash)
                .as_ref(),
        );
    }
    records
        .network()
        .domain_hash(aletheia_core::DomainTag::WriteSet, out.as_bytes())
}

/// The balances a version-1 transaction can change: the fee (sender and fee pool) and each
/// transfer leg (sender and recipient).
pub fn touched_balances(
    verified: &VerifiedTransaction,
) -> Vec<(aletheia_core::Address, aletheia_core::AssetId)> {
    let body = &verified.transaction().body;
    let mut touched = vec![
        (body.sender, body.fee.fee_asset),
        (FEE_POOL, body.fee.fee_asset),
    ];
    let legs: &[aletheia_core::TransferLeg] = match &body.payload {
        Payload::Transfer(leg) => core::slice::from_ref(leg),
        Payload::BatchTransfer(legs) => legs,
        #[cfg(feature = "test-protocol-v2")]
        Payload::TestRemark(_) => &[],
    };
    for leg in legs {
        touched.push((body.sender, leg.asset));
        touched.push((leg.recipient, leg.asset));
    }
    touched
}

/// Applies one transaction at position `index` of the block. `Err` means the block is
/// invalid (stateful validation failed) or the node must stop (fail-stop error).
pub fn apply_transaction(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    ctx: &BlockContext,
    index: u32,
) -> Result<Receipt, AletheiaError> {
    apply_transaction_with(records, overlay, verified, ctx, index, run_payload)
}

/// The version-1 lifecycle around a version-specific payload runner. Later versions reuse it
/// by path when their lifecycle is unchanged (Section 44.3).
pub fn apply_transaction_with(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    ctx: &BlockContext,
    index: u32,
    run: PayloadRunner,
) -> Result<Receipt, AletheiaError> {
    let (account, price) = validate_stateful(records, overlay, verified, ctx)?;
    let tx = verified.transaction();
    let body = &tx.body;
    let mark = overlay.mark();

    overlay.checkpoint();
    let mut meter = Meter::new(body.fee.eu_limit);
    let mut events = Vec::new();
    let mut result = run(records, overlay, verified, &mut meter, &mut events)?;

    if matches!(result, PayloadOutcome::Success) {
        let fee = u128::from(meter.used()).saturating_mul(price);
        if records
            .balance(overlay, &body.sender, body.fee.fee_asset)?
            .available
            < fee
        {
            result = PayloadOutcome::Failed(invalid(
                ErrorCode::InsufficientBalance,
                "payload left too little of the fee asset to pay the fee".to_owned(),
            ));
        }
    }
    let (status, error_code) = match &result {
        PayloadOutcome::Success => {
            overlay.commit_checkpoint();
            (ReceiptStatus::Success, 0)
        }
        PayloadOutcome::Failed(error) => {
            overlay.revert_to_checkpoint()?;
            events.clear();
            (ReceiptStatus::FailedExecution, error.code().get())
        }
        PayloadOutcome::OutOfEu => {
            overlay.revert_to_checkpoint()?;
            events.clear();
            meter.exhaust();
            (ReceiptStatus::OutOfEu, 0)
        }
    };

    // Fees: exact integer product, Rounding::Ceil is trivially exact for integer prices.
    let fee = u128::from(meter.used())
        .checked_mul(price)
        .ok_or_else(|| invalid(ErrorCode::ArithmeticOverflow, "fee overflows".to_owned()))?;
    balances::debit(records, overlay, &body.sender, body.fee.fee_asset, fee)?;
    balances::credit(records, overlay, &FEE_POOL, body.fee.fee_asset, fee)?;

    let next = Account {
        next_nonce: body
            .nonce
            .checked_add(1)
            .ok_or_else(|| invalid(ErrorCode::ArithmeticOverflow, "nonce overflow".to_owned()))?,
        auth_scheme: account.map_or(tx.authorization.scheme.code(), |a| a.auth_scheme),
        pubkey_commitment: match account {
            Some(existing) => existing.pubkey_commitment,
            None => body.sender.account_hash(),
        },
        flags: account.map_or(0, |a| a.flags),
    };
    records.put_account(overlay, &body.sender, &next);

    Ok(Receipt {
        tx_id: verified.tx_id().hash(),
        height: ctx.height.get(),
        index_in_block: index,
        status,
        error_code,
        eu_used: meter.used(),
        fee_asset: body.fee.fee_asset,
        fee_amount: fee,
        write_set_hash: write_set_hash(records, &overlay.changes_since(mark)),
        events,
        return_data: Vec::new(),
    })
}
