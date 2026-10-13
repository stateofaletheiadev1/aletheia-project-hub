//! Monetary operations, protocol version 1 (spec Sections 18.4, 18.5, 18.8).
//!
//! Every operation moves balances and the asset's supply ledger together, so the supply
//! check after the block (I7) confirms each one independently:
//!
//! ```text
//! Mint     credit destination      issued_total += a, circulating += a  (+ liabilities, AEY)
//! Burn     debit holder            burned_total += a, circulating −= a  (− liabilities, AEY)
//! Lock     available → locked      circulating −= a,  locked += a
//! Unlock   locked → available      locked −= a,       circulating += a
//! Redeem   burn, agent co-signs    as Burn, and redeemed_total += a; RedemptionRequested
//! ReserveAttestation               no balances; latest and history in namespace 80
//! ```
//!
//! A mint needs M of N authority signatures over the authorization digest, an unused
//! authorization id, an epoch no later than `valid_until_epoch`, room under the authorized
//! capacity (I3) and the epoch cap (I4), and, when reserve-ratio enforcement is on, a fresh
//! attestation covering the new outstanding supply (I9). Any failure fails the transaction;
//! the fee is still charged (Section 23).

use aletheia_core::monetary::{
    AssetAmount, IndexedSignature, MintAuthorization, Redemption, ReserveAttestation,
};
use aletheia_core::{AceEncode, Address, AletheiaError, AssetId, ErrorCode, Hash32};
use aletheia_crypto::{Ed25519PublicKey, Ed25519Signature};
use aletheia_monetary::SupplyLedger;
use aletheia_state::StateOverlay;

use crate::context::{BlockContext, Meter, OutOfEu};
use crate::model::{MonetaryPolicy, Records, StoredAttestation, module_address};
use crate::receipt::{Event, event_type};
use crate::rules::v1::balances::{credit, debit, lock, unlock};
use crate::rules::v1::limits::{MONETARY_EU, SIGNATURE_EU};

/// Emits the monetary module's events.
pub(crate) const MONETARY_MODULE: Address = module_address(3);

type Step = Result<Result<(), OutOfEu>, AletheiaError>;

fn fail(code: ErrorCode, detail: String) -> AletheiaError {
    AletheiaError::new(code, detail)
}

fn overflow(what: &str) -> AletheiaError {
    fail(ErrorCode::ArithmeticOverflow, format!("{what} overflows"))
}

pub(crate) fn policy(
    records: &Records,
    overlay: &StateOverlay<'_>,
) -> Result<MonetaryPolicy, AletheiaError> {
    records.monetary_policy(overlay)?.ok_or_else(|| {
        fail(
            ErrorCode::AssetNotIssuable,
            "this chain has no monetary authority".to_owned(),
        )
    })
}

fn ledger(
    records: &Records,
    overlay: &StateOverlay<'_>,
    asset: AssetId,
) -> Result<SupplyLedger, AletheiaError> {
    records.supply_ledger(overlay, asset)?.ok_or_else(|| {
        fail(
            ErrorCode::TxAssetUnknown,
            format!("asset {asset} has no supply ledger"),
        )
    })
}

/// At least `threshold` signatures, each from a registered key, each valid over `digest`.
/// Indices must be strictly ascending, so no key counts twice. The decoder already refuses
/// anything else; this check keeps the rule true for any caller that builds the list itself.
/// Charges EU per signature checked.
pub(crate) fn check_signatures(
    keys: &[[u8; 32]],
    threshold: u8,
    signatures: &[IndexedSignature],
    digest: &Hash32,
    meter: &mut Meter,
    what: &str,
) -> Result<Result<(), OutOfEu>, AletheiaError> {
    if threshold == 0 || signatures.len() < usize::from(threshold) {
        return Err(fail(
            ErrorCode::MonetaryAuthorizationInvalid,
            format!(
                "{what} has {} signatures; {threshold} are required",
                signatures.len()
            ),
        ));
    }
    if signatures
        .windows(2)
        .any(|pair| matches!(pair, [a, b] if a.index >= b.index))
    {
        return Err(fail(
            ErrorCode::MonetaryAuthorizationInvalid,
            format!("{what} lists a signer twice or out of order"),
        ));
    }
    for signed in signatures {
        if meter.charge(SIGNATURE_EU).is_err() {
            return Ok(Err(OutOfEu));
        }
        let key = keys.get(usize::from(signed.index)).ok_or_else(|| {
            fail(
                ErrorCode::MonetaryAuthorizationInvalid,
                format!(
                    "{what} names signer {}, which is not registered",
                    signed.index
                ),
            )
        })?;
        Ed25519PublicKey::from_bytes(key)
            .and_then(|key| key.verify(digest, &Ed25519Signature::from_bytes(signed.signature)))
            .map_err(|_| {
                fail(
                    ErrorCode::MonetaryAuthorizationInvalid,
                    format!(
                        "{what}: signature of signer {} does not verify",
                        signed.index
                    ),
                )
            })?;
    }
    Ok(Ok(()))
}

fn event(schema: &str, topics: Vec<Hash32>, data: Vec<u8>) -> Event {
    Event {
        emitter: MONETARY_MODULE,
        event_type: event_type(schema),
        topics,
        data,
    }
}

fn asset_topic(asset: AssetId) -> Hash32 {
    let mut bytes = [0u8; 32];
    bytes[28..].copy_from_slice(&asset.get().to_be_bytes());
    Hash32::from_bytes(bytes)
}

pub(crate) fn mint(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    authorization: &MintAuthorization,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Step {
    if meter.charge(MONETARY_EU).is_err() {
        return Ok(Err(OutOfEu));
    }
    let policy = policy(records, overlay)?;
    if authorization.asset != AssetId::AEY {
        return Err(fail(
            ErrorCode::AssetNotIssuable,
            format!(
                "asset {} has no issuance path in version 1",
                authorization.asset
            ),
        ));
    }
    if ctx.epoch.get() > authorization.valid_until_epoch {
        return Err(fail(
            ErrorCode::MintAuthorizationExpired,
            format!(
                "epoch {} is after valid_until_epoch {}",
                ctx.epoch, authorization.valid_until_epoch
            ),
        ));
    }
    if let Err(out) = check_signatures(
        &policy.authority_keys,
        policy.authority_threshold,
        &authorization.signatures,
        &authorization.digest(records.network()),
        meter,
        "mint authorization",
    )? {
        return Ok(Err(out));
    }
    if let Some(height) = records.mint_consumed_at(overlay, &authorization.authorization_id)? {
        return Err(fail(
            ErrorCode::MintAuthorizationConsumed,
            format!(
                "authorization {} was consumed at height {height}",
                authorization.authorization_id
            ),
        ));
    }

    issue(
        records,
        overlay,
        &policy,
        ctx,
        &authorization.destination,
        authorization.amount,
    )?;
    let (asset, amount) = (authorization.asset, authorization.amount);
    overlay.put(
        records.mint_authorization_key(&authorization.authorization_id),
        ctx.height.get().to_ace_bytes(),
    );

    let mut data = authorization.destination.to_ace_bytes();
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(authorization.reserve_ref.as_bytes());
    events.push(event(
        "aletheia.monetary.mint.v1",
        vec![
            authorization.authorization_id,
            authorization.destination.account_hash(),
            asset_topic(asset),
        ],
        data,
    ));
    Ok(Ok(()))
}

/// New AEY to `destination`, inside the authorized capacity (I3), the epoch cap (I4) and,
/// when enforced, the reserve ratio (I9); balances and the supply ledger move together.
/// Shared by Mint and the APN inbound credit (Section 40C.7).
pub(crate) fn issue(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    policy: &MonetaryPolicy,
    ctx: &BlockContext,
    destination: &Address,
    amount: u128,
) -> Result<(), AletheiaError> {
    let asset = AssetId::AEY;
    let mut supply = ledger(records, overlay, asset)?;
    if supply.issuance_epoch != ctx.epoch.get() {
        supply.issuance_epoch = ctx.epoch.get();
        supply.issued_this_epoch = 0;
    }
    let outstanding = supply
        .outstanding(asset)?
        .checked_add(amount)
        .ok_or_else(|| overflow("outstanding supply"))?;
    if outstanding > supply.authorized_capacity {
        return Err(fail(
            ErrorCode::MonetaryCapacityExceeded,
            format!(
                "outstanding would be {outstanding}; authorized capacity is {}",
                supply.authorized_capacity
            ),
        ));
    }
    let this_epoch = supply
        .issued_this_epoch
        .checked_add(amount)
        .ok_or_else(|| overflow("epoch issuance"))?;
    if this_epoch > supply.epoch_issuance_cap {
        return Err(fail(
            ErrorCode::EpochIssuanceCapExceeded,
            format!(
                "epoch {} issuance would be {this_epoch}; cap is {}",
                ctx.epoch, supply.epoch_issuance_cap
            ),
        ));
    }
    if policy.enforce_reserve_ratio {
        check_reserve_ratio(records, overlay, policy, ctx, outstanding)?;
    }

    credit(records, overlay, destination, asset, amount)?;
    supply.issued_total = supply
        .issued_total
        .checked_add(amount)
        .ok_or_else(|| overflow("issued_total"))?;
    supply.circulating = supply
        .circulating
        .checked_add(amount)
        .ok_or_else(|| overflow("circulating"))?;
    supply.issued_this_epoch = this_epoch;
    if supply.reserve_backed {
        supply.outstanding_liabilities = supply
            .outstanding_liabilities
            .checked_add(amount)
            .ok_or_else(|| overflow("liabilities"))?;
    }
    records.put_supply_ledger(overlay, asset, &supply);
    Ok(())
}

/// I9 at issuance: a fresh attestation whose value covers the new outstanding supply at the
/// minimum ratio. Stale or missing attestations block minting only (Section 18.8).
fn check_reserve_ratio(
    records: &Records,
    overlay: &StateOverlay<'_>,
    policy: &MonetaryPolicy,
    ctx: &BlockContext,
    outstanding: u128,
) -> Result<(), AletheiaError> {
    let stale = || {
        fail(
            ErrorCode::ReserveAttestationStale,
            format!(
                "no reserve attestation for feed {} within {} slots",
                policy.reserve_feed_id, policy.max_attestation_age_slots
            ),
        )
    };
    let latest = records
        .latest_attestation(overlay, policy.reserve_feed_id)?
        .ok_or_else(stale)?;
    let age = ctx.slot.get().saturating_sub(latest.observed_slot);
    if age > policy.max_attestation_age_slots {
        return Err(stale());
    }
    // attested × 10_000 ≥ outstanding × min_ratio_bps, in 256-bit intermediates.
    let covered = aletheia_monetary::arith::widening_mul(latest.value, 10_000);
    let required = aletheia_monetary::arith::widening_mul(
        outstanding,
        u128::from(policy.min_reserve_ratio_bps),
    );
    if covered < required {
        return Err(fail(
            ErrorCode::ReserveRatioInsufficient,
            format!(
                "attested reserve {} does not cover outstanding {outstanding} at {} bps",
                latest.value, policy.min_reserve_ratio_bps
            ),
        ));
    }
    Ok(())
}

/// Burn and the burn half of Redeem.
fn burn_units(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    holder: &Address,
    asset: AssetId,
    amount: u128,
    redeemed: bool,
) -> Result<(), AletheiaError> {
    let mut supply = ledger(records, overlay, asset)?;
    debit(records, overlay, holder, asset, amount)?;
    supply.burned_total = supply
        .burned_total
        .checked_add(amount)
        .ok_or_else(|| overflow("burned_total"))?;
    supply.circulating = supply.circulating.checked_sub(amount).ok_or_else(|| {
        fail(
            ErrorCode::MonetaryInvariantViolated,
            format!(
                "burning {amount} exceeds circulating {}",
                supply.circulating
            ),
        )
    })?;
    if supply.reserve_backed {
        supply.outstanding_liabilities = supply
            .outstanding_liabilities
            .checked_sub(amount)
            .ok_or_else(|| overflow("liabilities"))?;
    }
    if redeemed {
        supply.redeemed_total = supply
            .redeemed_total
            .checked_add(amount)
            .ok_or_else(|| overflow("redeemed_total"))?;
    }
    records.put_supply_ledger(overlay, asset, &supply);
    Ok(())
}

pub(crate) fn burn(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    holder: &Address,
    burn: &AssetAmount,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Step {
    if meter.charge(MONETARY_EU).is_err() {
        return Ok(Err(OutOfEu));
    }
    burn_units(records, overlay, holder, burn.asset, burn.amount, false)?;
    events.push(event(
        "aletheia.monetary.burn.v1",
        vec![holder.account_hash(), asset_topic(burn.asset)],
        burn.amount.to_le_bytes().to_vec(),
    ));
    Ok(Ok(()))
}

pub(crate) fn lock_or_unlock(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    holder: &Address,
    request: &AssetAmount,
    locking: bool,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Step {
    if meter.charge(MONETARY_EU).is_err() {
        return Ok(Err(OutOfEu));
    }
    let (asset, amount) = (request.asset, request.amount);
    let mut supply = ledger(records, overlay, asset)?;
    let shortfall = |what: &str| {
        fail(
            ErrorCode::MonetaryInvariantViolated,
            format!("moving {amount} exceeds the {what} bucket"),
        )
    };
    if locking {
        lock(records, overlay, holder, asset, amount)?;
        supply.circulating = supply
            .circulating
            .checked_sub(amount)
            .ok_or_else(|| shortfall("circulating"))?;
        supply.locked = supply
            .locked
            .checked_add(amount)
            .ok_or_else(|| overflow("locked"))?;
    } else {
        unlock(records, overlay, holder, asset, amount)?;
        supply.locked = supply
            .locked
            .checked_sub(amount)
            .ok_or_else(|| shortfall("locked"))?;
        supply.circulating = supply
            .circulating
            .checked_add(amount)
            .ok_or_else(|| overflow("circulating"))?;
    }
    records.put_supply_ledger(overlay, asset, &supply);
    events.push(event(
        if locking {
            "aletheia.monetary.lock.v1"
        } else {
            "aletheia.monetary.unlock.v1"
        },
        vec![holder.account_hash(), asset_topic(asset)],
        amount.to_le_bytes().to_vec(),
    ));
    Ok(Ok(()))
}

pub(crate) fn redeem(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    holder: &Address,
    nonce: u64,
    redemption: &Redemption,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Step {
    if meter.charge(MONETARY_EU).is_err() {
        return Ok(Err(OutOfEu));
    }
    let policy = policy(records, overlay)?;
    if redemption.asset != AssetId::AEY {
        return Err(fail(
            ErrorCode::AssetNotIssuable,
            format!("asset {} has no redemption path", redemption.asset),
        ));
    }
    let digest = redemption.digest(records.network(), holder, nonce);
    let signature = IndexedSignature {
        index: redemption.agent_index,
        signature: redemption.agent_signature,
    };
    if let Err(out) = check_signatures(
        &policy.redemption_agents,
        1,
        core::slice::from_ref(&signature),
        &digest,
        meter,
        "redemption co-authorization",
    )? {
        return Ok(Err(out));
    }
    burn_units(
        records,
        overlay,
        holder,
        redemption.asset,
        redemption.amount,
        true,
    )?;
    let mut data = redemption.amount.to_le_bytes().to_vec();
    data.extend_from_slice(redemption.settlement_ref.as_bytes());
    data.push(redemption.agent_index);
    events.push(event(
        "aletheia.monetary.redemption_requested.v1",
        vec![
            holder.account_hash(),
            asset_topic(redemption.asset),
            redemption.settlement_ref,
        ],
        data,
    ));
    Ok(Ok(()))
}

pub(crate) fn attest(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    attestation: &ReserveAttestation,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Step {
    if meter.charge(MONETARY_EU).is_err() {
        return Ok(Err(OutOfEu));
    }
    let policy = policy(records, overlay)?;
    let rejected = |detail: String| fail(ErrorCode::AttestationRejected, detail);
    let slot = ctx.slot.get();
    if attestation.observed_slot > slot {
        return Err(rejected(format!(
            "observed at slot {}, after the current slot {slot}",
            attestation.observed_slot
        )));
    }
    if slot.saturating_sub(attestation.observed_slot) > policy.max_attestation_age_slots {
        return Err(rejected(format!(
            "observed at slot {}, older than {} slots",
            attestation.observed_slot, policy.max_attestation_age_slots
        )));
    }
    let previous = records.latest_attestation(overlay, attestation.feed_id)?;
    let mut threshold = policy.attestor_threshold;
    if let Some(previous) = previous {
        if attestation.observed_slot <= previous.observed_slot {
            return Err(rejected(format!(
                "observed at slot {}, not after the last attestation (slot {})",
                attestation.observed_slot, previous.observed_slot
            )));
        }
        // |new − old| × 10_000 > old × max_deviation_bps needs the higher threshold.
        let moved = aletheia_monetary::arith::widening_mul(
            attestation.value.abs_diff(previous.value),
            10_000,
        );
        let allowed = aletheia_monetary::arith::widening_mul(
            previous.value,
            u128::from(policy.max_deviation_bps),
        );
        if moved > allowed {
            threshold = policy.attestor_threshold_large_deviation;
        }
    }
    let digest = attestation.digest(records.network());
    let large = threshold != policy.attestor_threshold;
    let checked = check_signatures(
        &policy.attestors,
        threshold,
        &attestation.signatures,
        &digest,
        meter,
        "reserve attestation",
    )
    .map_err(|error| {
        if large {
            rejected(format!(
                "the value moved more than {} bps, which needs {threshold} attestor signatures: {}",
                policy.max_deviation_bps,
                error.detail()
            ))
        } else {
            error
        }
    })?;
    if let Err(out) = checked {
        return Ok(Err(out));
    }

    let sequence = previous.map_or(Ok(0), |p| {
        p.sequence
            .checked_add(1)
            .ok_or_else(|| overflow("attestation sequence"))
    })?;
    let stored = StoredAttestation {
        sequence,
        epoch: attestation.epoch,
        value: attestation.value,
        observed_slot: attestation.observed_slot,
        evidence_ref: attestation.evidence_ref,
        accepted_at_height: ctx.height.get(),
    };
    overlay.put(
        records.attestation_key(attestation.feed_id),
        stored.to_ace_bytes(),
    );
    overlay.put(
        records.attestation_history_key(attestation.feed_id, sequence),
        stored.to_ace_bytes(),
    );
    let mut data = attestation.value.to_le_bytes().to_vec();
    data.extend_from_slice(&attestation.observed_slot.to_le_bytes());
    events.push(event(
        "aletheia.oracle.reserve_attestation.v1",
        vec![
            Hash32::from_bytes({
                let mut topic = [0u8; 32];
                topic[28..].copy_from_slice(&attestation.feed_id.to_be_bytes());
                topic
            }),
            attestation.evidence_ref,
        ],
        data,
    ));
    Ok(Ok(()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use aletheia_crypto::{Ed25519SigningKey, Secret};

    #[test]
    fn one_key_listed_twice_never_meets_a_threshold_of_two() {
        let key = Ed25519SigningKey::from_seed(&Secret::new([5; 32]));
        let other = Ed25519SigningKey::from_seed(&Secret::new([6; 32]));
        let keys = [key.public_key().to_bytes(), other.public_key().to_bytes()];
        let digest = Hash32::from_bytes([1; 32]);
        let signed = IndexedSignature {
            index: 0,
            signature: key.sign(&digest).to_bytes(),
        };
        let mut meter = Meter::new(1_000_000);
        let error =
            check_signatures(&keys, 2, &[signed, signed], &digest, &mut meter, "test").unwrap_err();
        assert_eq!(error.code(), ErrorCode::MonetaryAuthorizationInvalid);
    }
}
