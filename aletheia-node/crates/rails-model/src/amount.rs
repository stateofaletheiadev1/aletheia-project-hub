//! Amounts and conversion (Section 40C.6). AEY has 18 decimals and EUR has 2: one cent is
//! exactly `10^16` AEY base units. The outside world never sees a fraction of a cent, and AEY
//! is never lost or created in conversion. Nothing is rounded after a signature.

use serde::{Deserialize, Serialize};

use crate::error::ModelError;

/// AEY base units in one euro cent.
pub const AEY_PER_CENT: u128 = 10_000_000_000_000_000;

/// ISO 4217 alphabetic code. `AEY` is not one and is refused: external messages state the
/// currency, and the settlement asset only in supplementary data (40B.7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct CurrencyCode([u8; 3]);

impl CurrencyCode {
    pub fn new(value: &str) -> Result<CurrencyCode, ModelError> {
        match value.as_bytes() {
            [a, b, c] if [a, b, c].iter().all(|x| x.is_ascii_uppercase()) => {
                if value == "AEY" {
                    return Err(ModelError::new(
                        "CurrencyCode",
                        "AEY is not an ISO 4217 currency; state EUR (or the converted currency)",
                    ));
                }
                Ok(CurrencyCode([*a, *b, *c]))
            }
            _ => Err(ModelError::new(
                "CurrencyCode",
                format!("\"{value}\" is not three capital letters"),
            )),
        }
    }

    pub fn as_str(&self) -> &str {
        core::str::from_utf8(&self.0).unwrap_or_default()
    }
}

impl TryFrom<String> for CurrencyCode {
    type Error = ModelError;
    fn try_from(value: String) -> Result<CurrencyCode, ModelError> {
        CurrencyCode::new(&value)
    }
}

impl From<CurrencyCode> for String {
    fn from(value: CurrencyCode) -> String {
        value.as_str().to_owned()
    }
}

/// An amount in a currency's minor units (cents for EUR), as an exact integer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Amount {
    pub minor_units: u128,
    pub currency: CurrencyCode,
}

impl Amount {
    /// Parses the ISO 20022 decimal form (`"1234.50"`) for a currency with `exponent` minor
    /// digits. More fraction digits than the currency has is an error, not a rounding.
    pub fn parse(text: &str, currency: CurrencyCode, exponent: u32) -> Result<Amount, ModelError> {
        let bad = |why: &str| ModelError::new("Amount", format!("\"{text}\" {why}"));
        let (whole, fraction) = text.split_once('.').unwrap_or((text, ""));
        if whole.is_empty() || !whole.bytes().all(|b| b.is_ascii_digit()) {
            return Err(bad("is not a decimal amount"));
        }
        if !fraction.bytes().all(|b| b.is_ascii_digit())
            || (text.contains('.') && fraction.is_empty())
        {
            return Err(bad("is not a decimal amount"));
        }
        let digits = u32::try_from(fraction.len()).map_err(|_| bad("has too many digits"))?;
        if digits > exponent {
            return Err(bad(&format!(
                "has {digits} fraction digits; {} has {exponent}",
                currency.as_str()
            )));
        }
        let scale = 10u128
            .checked_pow(exponent)
            .ok_or_else(|| bad("has an unsupported exponent"))?;
        let pad = 10u128
            .checked_pow(exponent.saturating_sub(digits))
            .ok_or_else(|| bad("has an unsupported exponent"))?;
        let whole: u128 = whole.parse().map_err(|_| bad("is too large"))?;
        let fraction: u128 = if fraction.is_empty() {
            0
        } else {
            fraction.parse().map_err(|_| bad("is too large"))?
        };
        let minor_units = whole
            .checked_mul(scale)
            .and_then(|w| fraction.checked_mul(pad).and_then(|f| w.checked_add(f)))
            .ok_or_else(|| bad("is too large"))?;
        Ok(Amount {
            minor_units,
            currency,
        })
    }

    /// The ISO 20022 decimal form with exactly `exponent` fraction digits.
    pub fn render(&self, exponent: u32) -> String {
        let scale = 10u128.checked_pow(exponent).unwrap_or(1);
        let whole = self.minor_units.checked_div(scale).unwrap_or(0);
        let fraction = self.minor_units.checked_rem(scale).unwrap_or(0);
        if exponent == 0 {
            format!("{whole}")
        } else {
            format!(
                "{whole}.{fraction:0width$}",
                width = usize::try_from(exponent).unwrap_or(0)
            )
        }
    }
}

/// Inbound EUR: `cents × 10^16` AEY base units, exact.
pub fn aey_from_cents(cents: u128) -> Result<u128, ModelError> {
    cents.checked_mul(AEY_PER_CENT).ok_or_else(|| {
        ModelError::new(
            "Amount",
            format!("{cents} cents is too large to hold in AEY"),
        )
    })
}

/// Outbound EUR: only a whole number of cents leaves (`RailAmountNotRepresentable`).
pub fn cents_from_aey(base_units: u128) -> Result<u128, ModelError> {
    if base_units.checked_rem(AEY_PER_CENT) != Some(0) {
        return Err(ModelError::new(
            "Amount",
            format!(
                "{base_units} AEY base units is not a whole number of euro cents; round to a multiple of {AEY_PER_CENT} before signing"
            ),
        ));
    }
    Ok(base_units.checked_div(AEY_PER_CENT).unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn eur() -> CurrencyCode {
        CurrencyCode::new("EUR").unwrap()
    }

    #[test]
    fn decimal_amounts_are_exact_or_refused() {
        assert_eq!(
            Amount::parse("1234.50", eur(), 2).unwrap().minor_units,
            123_450
        );
        assert_eq!(Amount::parse("7", eur(), 2).unwrap().minor_units, 700);
        assert_eq!(Amount::parse("0.5", eur(), 2).unwrap().minor_units, 50);
        assert!(Amount::parse("1.234", eur(), 2).is_err(), "never rounded");
        assert!(Amount::parse("-1.00", eur(), 2).is_err());
        assert!(Amount::parse("1.", eur(), 2).is_err());
        assert!(Amount::parse("1e3", eur(), 2).is_err());
        assert_eq!(
            Amount::parse("1234.50", eur(), 2).unwrap().render(2),
            "1234.50"
        );
        assert_eq!(Amount::parse("0.05", eur(), 2).unwrap().render(2), "0.05");
    }

    #[test]
    fn aey_is_not_a_currency() {
        assert!(CurrencyCode::new("AEY").is_err());
        assert!(CurrencyCode::new("eur").is_err());
    }

    #[test]
    fn cents_and_aey_convert_exactly() {
        assert_eq!(aey_from_cents(1).unwrap(), AEY_PER_CENT);
        assert_eq!(cents_from_aey(1_250 * AEY_PER_CENT).unwrap(), 1_250);
        assert!(cents_from_aey(1_250 * AEY_PER_CENT + 1).is_err());
    }

    proptest::proptest! {
        /// Conversion never creates or loses a base unit (40C.12 property).
        #[test]
        fn round_trip_is_exact(cents in 0u128..1_000_000_000_000_000u128) {
            let aey = aey_from_cents(cents).unwrap();
            proptest::prop_assert_eq!(cents_from_aey(aey).unwrap(), cents);
        }

        #[test]
        fn render_then_parse_is_identity(minor in 0u128..u128::from(u64::MAX)) {
            let amount = Amount { minor_units: minor, currency: eur() };
            proptest::prop_assert_eq!(Amount::parse(&amount.render(2), eur(), 2).unwrap(), amount);
        }
    }
}
