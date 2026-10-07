//! Monetary arithmetic (spec Section 18.2, APS-0020, Appendix R.7).
//!
//! All amounts are unsigned 128-bit integers of base units. Products use a 256-bit
//! intermediate so `a × b / d` never overflows where the true result fits, and every division
//! names its rounding: `Floor` for amounts the protocol pays out, `Ceil` for fees charged to
//! users, `HalfEven` for reporting only (never written to state).
//!
//! The 256-bit product and the 256-by-128 division are written out over 64-bit limbs rather
//! than pulled from a big-integer crate: the code is short, has no unsafe and no allocation,
//! and the property tests check it against the identity `q × d + r = a × b` with `r < d`.

use aletheia_core::{AletheiaError, ErrorCode};

/// Largest balance or supply the protocol accepts: 2^120 − 1 base units. The 8 bits of
/// headroom mean the sum of two maximal values cannot wrap a `u128` (Section 18.2).
pub const MAX_BASE_UNITS: u128 = (1u128 << 120) - 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Rounding {
    /// Toward zero. Default for amounts the protocol pays out.
    Floor,
    /// Away from zero when there is a remainder. Fees charged to users.
    Ceil,
    /// To nearest, ties to even. Reporting only; never in state.
    HalfEven,
}

const LOW_64: u128 = (1u128 << 64) - 1;

/// The full 256-bit product as `(high, low)` halves.
#[expect(
    clippy::arithmetic_side_effects,
    reason = "limb products are of 64-bit values and fit u128; each partial sum is bounded below by construction"
)]
pub fn widening_mul(a: u128, b: u128) -> (u128, u128) {
    let (a_hi, a_lo) = (a >> 64, a & LOW_64);
    let (b_hi, b_lo) = (b >> 64, b & LOW_64);
    let lo_lo = a_lo * b_lo;
    let lo_hi = a_lo * b_hi;
    let hi_lo = a_hi * b_lo;
    let hi_hi = a_hi * b_hi;
    // At most 3 × (2^64 − 1): fits.
    let middle = (lo_lo >> 64) + (lo_hi & LOW_64) + (hi_lo & LOW_64);
    let low = (lo_lo & LOW_64) | (middle << 64);
    // The true high half is < 2^128 because a × b < 2^256.
    let high = hi_hi + (lo_hi >> 64) + (hi_lo >> 64) + (middle >> 64);
    (high, low)
}

/// `(high, low) / divisor` as `(quotient, remainder)`, or None when the quotient does not fit
/// in 128 bits (exactly when `high >= divisor`) or the divisor is zero.
pub fn div_wide(high: u128, low: u128, divisor: u128) -> Option<(u128, u128)> {
    if divisor == 0 || high >= divisor {
        return None;
    }
    // Restoring long division over the 128 low bits, starting from the high half as the
    // initial remainder. `carry` holds the bit shifted out of the top of the remainder.
    let mut remainder = high;
    let mut quotient = 0u128;
    for bit in (0..128).rev() {
        let carry = remainder >> 127;
        remainder = (remainder << 1) | ((low >> bit) & 1);
        if carry == 1 || remainder >= divisor {
            remainder = remainder.wrapping_sub(divisor);
            quotient |= 1u128 << bit;
        }
    }
    Some((quotient, remainder))
}

/// `a × b / divisor` with the given rounding.
pub fn mul_div(a: u128, b: u128, divisor: u128, rounding: Rounding) -> Result<u128, AletheiaError> {
    if divisor == 0 {
        return Err(AletheiaError::new(
            ErrorCode::ArithmeticDivisionByZero,
            format!("{a} × {b} / 0: divisor must be non-zero"),
        ));
    }
    let (high, low) = widening_mul(a, b);
    let overflow = || {
        AletheiaError::new(
            ErrorCode::ArithmeticOverflow,
            format!("{a} × {b} / {divisor} does not fit in 128 bits"),
        )
    };
    let (quotient, remainder) = div_wide(high, low, divisor).ok_or_else(overflow)?;
    let round_up = match rounding {
        Rounding::Floor => false,
        Rounding::Ceil => remainder != 0,
        // remainder > divisor − remainder  ⇔  2 × remainder > divisor, without overflow.
        Rounding::HalfEven => {
            let other = divisor.wrapping_sub(remainder);
            remainder > other || (remainder == other && quotient % 2 == 1)
        }
    };
    if round_up {
        quotient.checked_add(1).ok_or_else(overflow)
    } else {
        Ok(quotient)
    }
}

/// Refuses amounts above [`MAX_BASE_UNITS`].
pub fn within_supply_bound(units: u128) -> Result<u128, AletheiaError> {
    if units > MAX_BASE_UNITS {
        return Err(AletheiaError::new(
            ErrorCode::ArithmeticOverflow,
            format!("{units} base units exceeds the protocol bound 2^120 − 1"),
        ));
    }
    Ok(units)
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn rounding_modes_on_small_values() {
        assert_eq!(mul_div(7, 1, 2, Rounding::Floor), Ok(3));
        assert_eq!(mul_div(7, 1, 2, Rounding::Ceil), Ok(4));
        assert_eq!(
            mul_div(5, 1, 2, Rounding::HalfEven),
            Ok(2),
            "2.5 rounds to even"
        );
        assert_eq!(
            mul_div(7, 1, 2, Rounding::HalfEven),
            Ok(4),
            "3.5 rounds to even"
        );
        assert_eq!(
            mul_div(7, 1, 3, Rounding::HalfEven),
            Ok(2),
            "2.33 rounds down"
        );
        assert_eq!(
            mul_div(8, 1, 3, Rounding::HalfEven),
            Ok(3),
            "2.67 rounds up"
        );
        assert_eq!(
            mul_div(6, 1, 3, Rounding::Ceil),
            Ok(2),
            "exact division does not round up"
        );
    }

    #[test]
    fn products_beyond_u128_divide_back_down() {
        // (2^127) × 6 / 3 = 2^128: does not fit. (2^127) × 6 / 4 = 3 × 2^126: fits.
        assert_eq!(
            mul_div(1 << 127, 6, 3, Rounding::Floor).unwrap_err().code(),
            ErrorCode::ArithmeticOverflow
        );
        assert_eq!(mul_div(1 << 127, 6, 4, Rounding::Floor), Ok(3 << 126));
        assert_eq!(
            mul_div(u128::MAX, u128::MAX, u128::MAX, Rounding::Floor),
            Ok(u128::MAX)
        );
    }

    #[test]
    fn division_by_zero_is_an_error() {
        assert_eq!(
            mul_div(1, 1, 0, Rounding::Floor).unwrap_err().code(),
            ErrorCode::ArithmeticDivisionByZero
        );
    }

    #[test]
    fn supply_bound_is_2_pow_120_minus_1() {
        assert_eq!(within_supply_bound(MAX_BASE_UNITS), Ok(MAX_BASE_UNITS));
        assert!(within_supply_bound(MAX_BASE_UNITS + 1).is_err());
        assert!(
            MAX_BASE_UNITS.checked_add(MAX_BASE_UNITS).is_some(),
            "two maximal values cannot wrap"
        );
    }

    proptest! {
        #[test]
        fn wide_product_and_division_satisfy_the_division_identity(a: u128, b: u128, d in 1u128..) {
            let (high, low) = widening_mul(a, b);
            if let Some((q, r)) = div_wide(high, low, d) {
                prop_assert!(r < d);
                // q × d + r must reproduce (high, low) exactly.
                let (qh, ql) = widening_mul(q, d);
                let (sum_low, carry) = ql.overflowing_add(r);
                prop_assert_eq!((qh + u128::from(carry), sum_low), (high, low));
            } else {
                prop_assert!(high >= d);
            }
        }

        #[test]
        fn matches_native_arithmetic_when_the_product_fits(a: u64, b: u64, d in 1u128..) {
            let product = u128::from(a) * u128::from(b);
            prop_assert_eq!(mul_div(u128::from(a), u128::from(b), d, Rounding::Floor), Ok(product / d));
            let ceil = product / d + u128::from(product % d != 0);
            prop_assert_eq!(mul_div(u128::from(a), u128::from(b), d, Rounding::Ceil), Ok(ceil));
        }

        #[test]
        fn widening_mul_matches_native_for_small_operands(a: u64, b: u64) {
            prop_assert_eq!(widening_mul(u128::from(a), u128::from(b)), (0, u128::from(a) * u128::from(b)));
        }
    }
}
