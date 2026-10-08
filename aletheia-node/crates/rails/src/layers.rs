//! Validation layers 2 and 3 (Section 40C.4) over the canonical payment, driven by the
//! profile. The first failure decides the outcome and its ISO reason code. Inbound, a failure
//! rejects the message; outbound, the payment is refused before anything is emitted. Nothing
//! is changed to make a payment pass.

use aletheia_rails_model::{AccountRef, AgentRef, CanonicalPayment, Date, Remittance};

use crate::profile::RailProfile;

/// Why a payment does not pass, naming the layer, the ISO reason, the field and the rule.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RailRejection {
    pub layer: u8,
    pub reason: &'static str,
    pub field: &'static str,
    pub detail: String,
}

impl core::fmt::Display for RailRejection {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(
            f,
            "layer {} ({}), {}: {}",
            self.layer, self.reason, self.field, self.detail
        )
    }
}

impl std::error::Error for RailRejection {}

fn reject(
    layer: u8,
    reason: &'static str,
    field: &'static str,
    detail: impl Into<String>,
) -> RailRejection {
    RailRejection {
        layer,
        reason,
        field,
        detail: detail.into(),
    }
}

/// Layer 2: usage-guideline rules beyond the schema. Character set, lengths the profile
/// narrows, account and agent identifier rules, address structure, UETR presence.
pub fn usage_rules(payment: &CanonicalPayment, profile: &RailProfile) -> Result<(), RailRejection> {
    payment
        .check()
        .map_err(|e| reject(2, "FF01", "CdtTrfTxInf", e.to_string()))?;

    let charset = profile.charset();
    for (field, text) in payment.texts() {
        if let Some(c) = charset.first_violation(text) {
            return Err(reject(
                2,
                "FF01",
                field,
                format!(
                    "\"{c}\" is outside the {} character set this rail carries; it is not transliterated, so change the text or contact support",
                    profile.charset.set
                ),
            ));
        }
    }

    let e2e = payment.end_to_end_id.as_str().chars().count();
    if e2e > profile.fields.end_to_end_id_max {
        return Err(reject(
            2,
            "FF01",
            "EndToEndId",
            format!(
                "{e2e} characters; this rail carries at most {}",
                profile.fields.end_to_end_id_max
            ),
        ));
    }
    if let Remittance::Unstructured(lines) = &payment.remittance {
        if lines.len() > profile.fields.remittance_unstructured_lines {
            return Err(reject(
                2,
                "FF01",
                "RmtInf/Ustrd",
                format!(
                    "{} lines; this rail carries at most {}",
                    lines.len(),
                    profile.fields.remittance_unstructured_lines
                ),
            ));
        }
        if let Some(line) = lines
            .iter()
            .find(|l| l.as_str().chars().count() > profile.fields.remittance_unstructured_max)
        {
            return Err(reject(
                2,
                "FF01",
                "RmtInf/Ustrd",
                format!(
                    "{} characters; this rail carries at most {} and nothing is truncated",
                    line.as_str().chars().count(),
                    profile.fields.remittance_unstructured_max
                ),
            ));
        }
    }

    if profile.fields.account == "iban" {
        for (field, account) in [
            ("DbtrAcct", &payment.debtor_account),
            ("CdtrAcct", &payment.creditor_account),
        ] {
            if !matches!(account, AccountRef::Iban(_)) {
                return Err(reject(
                    2,
                    "AC01",
                    field,
                    "this rail identifies accounts by IBAN",
                ));
            }
        }
    }
    if profile.fields.agent_bic == "required" {
        for (field, agent) in [
            ("DbtrAgt", &payment.debtor_agent),
            ("CdtrAgt", &payment.creditor_agent),
        ] {
            if !matches!(agent, AgentRef::Bic(_)) {
                return Err(reject(
                    2,
                    "RC01",
                    field,
                    "this rail identifies agents by BIC",
                ));
            }
        }
    }

    let address_required = profile.address.mode == "structured-or-hybrid-required";
    if profile.address.mode != "any" {
        for (field, party) in [
            ("Dbtr/PstlAdr", &payment.debtor),
            ("Cdtr/PstlAdr", &payment.creditor),
        ] {
            match &party.postal_address {
                None if address_required => {
                    return Err(reject(
                        2,
                        "FF01",
                        field,
                        "this rail needs a structured or hybrid postal address (town and country at least)",
                    ));
                }
                Some(address) if !address.is_structured() && !address.is_hybrid() => {
                    return Err(reject(
                        2,
                        "FF01",
                        field,
                        "unstructured addresses are not carried: give town and country, and at most two address lines",
                    ));
                }
                _ => {}
            }
        }
    }
    Ok(())
}

/// Answers whether a duplicate-detection key was already seen within the scheme's window.
pub type DuplicateCheck<'a> = &'a dyn Fn(&str) -> bool;

/// The duplicate-detection key the profile names.
pub fn duplicate_key(payment: &CanonicalPayment, profile: &RailProfile) -> String {
    if profile.fields.duplicate_key == "uetr" {
        return format!("uetr:{}", payment.uetr.as_str());
    }
    let account = match &payment.debtor_account {
        AccountRef::Iban(iban) => iban.as_str().to_owned(),
        AccountRef::Aan(aan) => aan.as_str().to_owned(),
        AccountRef::Other { scheme, id } => format!("{scheme}/{id}"),
        AccountRef::Proxy(proxy) => proxy.as_str().to_owned(),
    };
    format!(
        "e2e:{}|{}|{}|{}",
        payment.end_to_end_id,
        account,
        payment.settlement.amount.minor_units,
        payment
            .settlement
            .date
            .map_or_else(String::new, |d| d.to_string())
    )
}

/// Day of the week for a date, Monday = 0 … Sunday = 6.
pub fn weekday(date: Date) -> u8 {
    // Days since 1970-01-01 (a Thursday) by H. Hinnant's days-from-civil.
    let (y, m, d) = (
        i64::from(date.year),
        i64::from(date.month),
        i64::from(date.day),
    );
    let y = if m <= 2 { y.saturating_sub(1) } else { y };
    let era = y.div_euclid(400);
    let yoe = y.saturating_sub(era.saturating_mul(400));
    let mp = if m > 2 {
        m.saturating_sub(3)
    } else {
        m.saturating_add(9)
    };
    let doy = mp
        .saturating_mul(153)
        .saturating_add(2)
        .div_euclid(5)
        .saturating_add(d)
        .saturating_sub(1);
    let doe = yoe
        .saturating_mul(365)
        .saturating_add(yoe.div_euclid(4))
        .saturating_sub(yoe.div_euclid(100))
        .saturating_add(doy);
    let days = era
        .saturating_mul(146_097)
        .saturating_add(doe)
        .saturating_sub(719_468);
    // 1970-01-01 is a Thursday (3 with Monday = 0).
    u8::try_from(days.saturating_add(3).rem_euclid(7)).unwrap_or(0)
}

/// Layer 3: scheme business rules. Currency, amount bounds, charge bearer, settlement date on
/// an operating day, duplicates.
pub fn scheme_rules(
    payment: &CanonicalPayment,
    profile: &RailProfile,
    seen: DuplicateCheck<'_>,
) -> Result<(), RailRejection> {
    let currency = payment.settlement.amount.currency;
    if !profile
        .currency
        .allowed
        .iter()
        .any(|c| c == currency.as_str())
    {
        return Err(reject(
            3,
            "AM03",
            "IntrBkSttlmAmt/@Ccy",
            format!(
                "{} is not carried by this rail (allowed: {})",
                currency.as_str(),
                profile.currency.allowed.join(", ")
            ),
        ));
    }
    if payment.settlement.amount.minor_units == 0 {
        return Err(reject(3, "AM01", "IntrBkSttlmAmt", "the amount is zero"));
    }
    if let Ok(Some(max)) = profile.scheme_max()
        && max.currency == currency
        && payment.settlement.amount.minor_units > max.minor_units
    {
        return Err(reject(
            3,
            "AM02",
            "IntrBkSttlmAmt",
            format!(
                "{} is above the scheme maximum {}",
                payment
                    .settlement
                    .amount
                    .render(profile.currency.minor_units),
                profile.limits.scheme_max_amount
            ),
        ));
    }
    if !profile.fields.charge_bearer.is_empty()
        && payment.charge_bearer.code() != profile.fields.charge_bearer
    {
        return Err(reject(
            3,
            "FF01",
            "ChrgBr",
            format!(
                "{} is not allowed; this rail uses {}",
                payment.charge_bearer.code(),
                profile.fields.charge_bearer
            ),
        ));
    }
    if profile.timing.operating_calendar == "business-days" {
        let Some(date) = payment.settlement.date else {
            return Err(reject(
                3,
                "DT01",
                "IntrBkSttlmDt",
                "this rail settles on a stated business day",
            ));
        };
        if weekday(date) >= 5 {
            return Err(reject(
                3,
                "DT01",
                "IntrBkSttlmDt",
                format!("{date} is a weekend day; this rail settles on business days"),
            ));
        }
    }
    if seen(&duplicate_key(payment, profile)) {
        return Err(reject(
            3,
            "DUPL",
            "CdtTrfTxInf",
            "this payment was already accepted",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weekdays_match_the_calendar() {
        // 2026-10-05 Monday, 2026-10-10 Saturday, 2027-01-01 Friday, 2000-02-29 Tuesday.
        assert_eq!(weekday(Date::parse("2026-10-05").unwrap()), 0);
        assert_eq!(weekday(Date::parse("2026-10-10").unwrap()), 5);
        assert_eq!(weekday(Date::parse("2027-01-01").unwrap()), 4);
        assert_eq!(weekday(Date::parse("2000-02-29").unwrap()), 1);
        assert_eq!(weekday(Date::parse("1970-01-01").unwrap()), 3);
    }
}
