//! Identifiers the rails carry, each checked when built (Section 40C.4 layer 2): IBAN
//! (ISO 13616, MOD 97-10), BIC (ISO 9362 shape), LEI (ISO 17442, MOD 97-10), UETR (UUID
//! version 4 in ISO 20022 form), country codes (ISO 3166-1 alpha-2) and calendar dates.

use serde::{Deserialize, Serialize};

use crate::error::ModelError;

/// ISO 7064 MOD 97-10 over an already rearranged string of digits and capital letters
/// (letters count as two digits, A = 10 … Z = 35). A valid identifier leaves 1.
fn mod97(chars: impl Iterator<Item = u8>) -> Option<u32> {
    let mut rem = 0u32;
    for c in chars {
        rem = match c {
            b'0'..=b'9' => rem
                .checked_mul(10)?
                .checked_add(u32::from(c.checked_sub(b'0')?))?,
            b'A'..=b'Z' => rem
                .checked_mul(100)?
                .checked_add(u32::from(c.checked_sub(b'A')?))?
                .checked_add(10)?,
            _ => return None,
        }
        .checked_rem(97)?;
    }
    Some(rem)
}

fn upper_alnum(value: &str) -> bool {
    value
        .bytes()
        .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
}

/// An International Bank Account Number, stored without spaces.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct Iban(String);

impl Iban {
    /// Accepts the printed form with spaces; nothing else is forgiven.
    pub fn new(value: &str) -> Result<Iban, ModelError> {
        let compact: String = value.chars().filter(|c| *c != ' ').collect();
        let bytes = compact.as_bytes();
        let shape = (15..=34).contains(&bytes.len())
            && bytes
                .get(..2)
                .is_some_and(|c| c.iter().all(u8::is_ascii_uppercase))
            && bytes
                .get(2..4)
                .is_some_and(|c| c.iter().all(u8::is_ascii_digit))
            && upper_alnum(&compact);
        if !shape {
            return Err(ModelError::new(
                "IBAN",
                format!(
                    "\"{value}\" is not an IBAN (2 letters, 2 check digits, 11-30 letters or digits)"
                ),
            ));
        }
        let rearranged = bytes
            .get(4..)
            .unwrap_or_default()
            .iter()
            .chain(bytes.get(..4).unwrap_or_default())
            .copied();
        if mod97(rearranged) != Some(1) {
            return Err(ModelError::new(
                "IBAN",
                format!("the check digits of {compact} do not match"),
            ));
        }
        Ok(Iban(compact))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn country(&self) -> &str {
        self.0.get(..2).unwrap_or_default()
    }
}

impl TryFrom<String> for Iban {
    type Error = ModelError;
    fn try_from(value: String) -> Result<Iban, ModelError> {
        Iban::new(&value)
    }
}

impl From<Iban> for String {
    fn from(value: Iban) -> String {
        value.0
    }
}

/// A Business Identifier Code: 4 letters (institution), 2 letters (country), 2 letters or
/// digits (location), optionally 3 more (branch).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct Bic(String);

impl Bic {
    pub fn new(value: &str) -> Result<Bic, ModelError> {
        let b = value.as_bytes();
        let shape = (b.len() == 8 || b.len() == 11)
            && b.get(..6)
                .is_some_and(|c| c.iter().all(u8::is_ascii_uppercase))
            && upper_alnum(value);
        if !shape {
            return Err(ModelError::new(
                "BIC",
                format!("\"{value}\" is not a BIC (8 or 11 characters: AAAA CC LL [BBB])"),
            ));
        }
        Ok(Bic(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Bic {
    type Error = ModelError;
    fn try_from(value: String) -> Result<Bic, ModelError> {
        Bic::new(&value)
    }
}

impl From<Bic> for String {
    fn from(value: Bic) -> String {
        value.0
    }
}

/// A Legal Entity Identifier: 18 letters or digits and 2 check digits.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct Lei(String);

impl Lei {
    pub fn new(value: &str) -> Result<Lei, ModelError> {
        if value.len() != 20
            || !upper_alnum(value)
            || !value
                .as_bytes()
                .get(18..)
                .is_some_and(|c| c.iter().all(u8::is_ascii_digit))
        {
            return Err(ModelError::new(
                "LEI",
                format!("\"{value}\" is not an LEI (20 characters, the last two digits)"),
            ));
        }
        if mod97(value.bytes()) != Some(1) {
            return Err(ModelError::new(
                "LEI",
                format!("the check digits of {value} do not match"),
            ));
        }
        Ok(Lei(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Lei {
    type Error = ModelError;
    fn try_from(value: String) -> Result<Lei, ModelError> {
        Lei::new(&value)
    }
}

impl From<Lei> for String {
    fn from(value: Lei) -> String {
        value.0
    }
}

/// A Unique End-to-end Transaction Reference: a version 4 UUID in its lowercase hyphenated
/// form. Carried unchanged by every hop; never regenerated.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct Uetr([u8; 36]);

impl Uetr {
    pub fn new(value: &str) -> Result<Uetr, ModelError> {
        let b = value.as_bytes();
        let bad = || {
            ModelError::new(
                "UETR",
                format!(
                    "\"{value}\" is not a version 4 UUID (xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx, lowercase)"
                ),
            )
        };
        if b.len() != 36 {
            return Err(bad());
        }
        for (i, c) in b.iter().enumerate() {
            let ok = if matches!(i, 8 | 13 | 18 | 23) {
                *c == b'-'
            } else {
                c.is_ascii_digit() || (b'a'..=b'f').contains(c)
            };
            if !ok {
                return Err(bad());
            }
        }
        if b.get(14) != Some(&b'4') || !b.get(19).is_some_and(|c| b"89ab".contains(c)) {
            return Err(bad());
        }
        let mut raw = [0u8; 36];
        raw.copy_from_slice(b);
        Ok(Uetr(raw))
    }

    pub fn as_str(&self) -> &str {
        core::str::from_utf8(&self.0).unwrap_or_default()
    }
}

impl TryFrom<String> for Uetr {
    type Error = ModelError;
    fn try_from(value: String) -> Result<Uetr, ModelError> {
        Uetr::new(&value)
    }
}

impl From<Uetr> for String {
    fn from(value: Uetr) -> String {
        value.as_str().to_owned()
    }
}

/// ISO 3166-1 alpha-2, as carried in `Ctry` fields. Aletheia's own entry is the governed
/// user-assigned code (Section 40B.2), never `AL`, which is Albania.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct CountryCode([u8; 2]);

impl CountryCode {
    pub fn new(value: &str) -> Result<CountryCode, ModelError> {
        match value.as_bytes() {
            [a, b] if a.is_ascii_uppercase() && b.is_ascii_uppercase() => Ok(CountryCode([*a, *b])),
            _ => Err(ModelError::new(
                "CountryCode",
                format!("\"{value}\" is not two capital letters"),
            )),
        }
    }

    pub fn as_str(&self) -> &str {
        core::str::from_utf8(&self.0).unwrap_or_default()
    }
}

impl TryFrom<String> for CountryCode {
    type Error = ModelError;
    fn try_from(value: String) -> Result<CountryCode, ModelError> {
        CountryCode::new(&value)
    }
}

impl From<CountryCode> for String {
    fn from(value: CountryCode) -> String {
        value.as_str().to_owned()
    }
}

/// A calendar date (ISO 8601 `YYYY-MM-DD`), as in settlement dates and profile validity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct Date {
    pub year: u16,
    pub month: u8,
    pub day: u8,
}

impl Date {
    pub fn parse(value: &str) -> Result<Date, ModelError> {
        let bad = || ModelError::new("Date", format!("\"{value}\" is not a date YYYY-MM-DD"));
        let b = value.as_bytes();
        if b.len() != 10 || b.get(4) != Some(&b'-') || b.get(7) != Some(&b'-') {
            return Err(bad());
        }
        let number =
            |range: core::ops::Range<usize>| -> Option<u16> { value.get(range)?.parse().ok() };
        let year = number(0..4).ok_or_else(bad)?;
        let month = number(5..7)
            .and_then(|m| u8::try_from(m).ok())
            .ok_or_else(bad)?;
        let day = number(8..10)
            .and_then(|d| u8::try_from(d).ok())
            .ok_or_else(bad)?;
        let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
        let days_in_month = match month {
            1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
            4 | 6 | 9 | 11 => 30,
            2 if leap => 29,
            2 => 28,
            _ => return Err(bad()),
        };
        if day == 0 || day > days_in_month {
            return Err(bad());
        }
        Ok(Date { year, month, day })
    }
}

impl TryFrom<String> for Date {
    type Error = ModelError;
    fn try_from(value: String) -> Result<Date, ModelError> {
        Date::parse(&value)
    }
}

impl From<Date> for String {
    fn from(value: Date) -> String {
        format!("{:04}-{:02}-{:02}", value.year, value.month, value.day)
    }
}

impl core::fmt::Display for Date {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{:04}-{:02}-{:02}", self.year, self.month, self.day)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ibans_check_their_digits() {
        // Published example IBANs (ECBS / national examples).
        for good in [
            "DE89 3704 0044 0532 0130 00",
            "GB82 WEST 1234 5698 7654 32",
            "FR14 2004 1010 0505 0001 3M02 606",
            "NL91ABNA0417164300",
        ] {
            assert!(Iban::new(good).is_ok(), "{good}");
        }
        assert!(
            Iban::new("DE89 3704 0044 0532 0130 01").is_err(),
            "one digit off"
        );
        assert!(Iban::new("de89370400440532013000").is_err(), "lowercase");
        assert!(Iban::new("DE89").is_err(), "too short");
        assert_eq!(Iban::new("DE89370400440532013000").unwrap().country(), "DE");
    }

    #[test]
    fn bics_have_the_iso_9362_shape() {
        assert!(Bic::new("DEUTDEFF").is_ok());
        assert!(Bic::new("DEUTDEFF500").is_ok());
        assert!(Bic::new("DEUTDEF").is_err());
        assert!(Bic::new("DEU1DEFF").is_err());
        assert!(Bic::new("deutdeff").is_err());
    }

    #[test]
    fn leis_check_their_digits() {
        // A published LEI (GLEIF's own).
        assert!(Lei::new("506700GE1G29325QX363").is_ok());
        assert!(Lei::new("506700GE1G29325QX364").is_err());
        assert!(Lei::new("506700GE1G29325QX3").is_err());
    }

    #[test]
    fn uetrs_are_version_4_uuids() {
        assert!(Uetr::new("eb6305c9-1f7f-49de-aed0-16487c27b42d").is_ok());
        assert!(
            Uetr::new("eb6305c9-1f7f-19de-aed0-16487c27b42d").is_err(),
            "version 1"
        );
        assert!(
            Uetr::new("eb6305c9-1f7f-49de-ced0-16487c27b42d").is_err(),
            "variant"
        );
        assert!(
            Uetr::new("EB6305C9-1F7F-49DE-AED0-16487C27B42D").is_err(),
            "uppercase"
        );
    }

    #[test]
    fn dates_are_real_calendar_days() {
        assert!(Date::parse("2028-02-29").is_ok());
        assert!(Date::parse("2027-02-29").is_err());
        assert!(Date::parse("2026-13-01").is_err());
        assert!(Date::parse("2026-1-01").is_err());
        assert!(Date::parse("2026-10-05").unwrap() < Date::parse("2026-10-06").unwrap());
        assert_eq!(
            String::from(Date::parse("2026-01-09").unwrap()),
            "2026-01-09"
        );
    }

    #[test]
    fn country_codes_are_two_capitals() {
        assert!(CountryCode::new("XL").is_ok());
        assert!(CountryCode::new("xl").is_err());
        assert!(CountryCode::new("XLL").is_err());
    }
}
