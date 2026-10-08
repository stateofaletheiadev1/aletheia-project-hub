//! The canonical payment (Section 40C.2): a superset of the ISO 20022 payment elements every
//! supported rail uses, so nothing is lost on the way in. Structured address fields are kept
//! apart, never concatenated.

use serde::{Deserialize, Serialize};

use crate::amount::Amount;
use crate::error::ModelError;
use crate::ids::{Bic, CountryCode, Date, Iban, Lei, Uetr};
use crate::text::{Max16Text, Max35Text, Max70Text, Max140Text};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Direction {
    Inbound,
    Outbound,
}

/// Who bears the charges (ISO 20022 `ChrgBr`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChargeBearer {
    /// `DEBT`: borne by the debtor.
    Debt,
    /// `CRED`: borne by the creditor.
    Cred,
    /// `SHAR`: shared.
    Shar,
    /// `SLEV`: following the service level (SEPA).
    Slev,
}

impl ChargeBearer {
    pub const fn code(self) -> &'static str {
        match self {
            ChargeBearer::Debt => "DEBT",
            ChargeBearer::Cred => "CRED",
            ChargeBearer::Shar => "SHAR",
            ChargeBearer::Slev => "SLEV",
        }
    }

    pub fn from_code(code: &str) -> Option<ChargeBearer> {
        Some(match code {
            "DEBT" => ChargeBearer::Debt,
            "CRED" => ChargeBearer::Cred,
            "SHAR" => ChargeBearer::Shar,
            "SLEV" => ChargeBearer::Slev,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct PostalAddress {
    pub street_name: Option<Max70Text>,
    pub building_number: Option<Max16Text>,
    pub post_code: Option<Max16Text>,
    pub town_name: Option<Max35Text>,
    pub country: Option<CountryCode>,
    /// Hybrid form only; the profile decides whether lines are allowed.
    pub address_lines: Vec<Max70Text>,
}

impl PostalAddress {
    /// Structured: town and country present, no free-form lines.
    pub fn is_structured(&self) -> bool {
        self.town_name.is_some() && self.country.is_some() && self.address_lines.is_empty()
    }

    /// Hybrid: town and country present, with at most two free-form lines.
    pub fn is_hybrid(&self) -> bool {
        self.town_name.is_some() && self.country.is_some() && self.address_lines.len() <= 2
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Party {
    pub name: Max140Text,
    pub postal_address: Option<PostalAddress>,
    pub lei: Option<Lei>,
    pub country_of_residence: Option<CountryCode>,
}

/// How an account is named.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccountRef {
    Iban(Iban),
    /// An Aletheia account number (`ALX…`, Section 40B.3.1), carried as text.
    Aan(Max35Text),
    Other {
        scheme: Max35Text,
        id: Max35Text,
    },
    /// A proxy (phone, e-mail, business id) resolved before settlement.
    Proxy(Max140Text),
}

/// How an agent (a bank or participant) is named.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentRef {
    Bic(Bic),
    /// An Aletheia Institution Code (Section 40B.2).
    Aic(Max16Text),
    ClearingMember {
        system: Max35Text,
        member: Max35Text,
    },
    Lei(Lei),
}

/// The interbank settlement: amount and currency, date.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Settlement {
    pub amount: Amount,
    pub date: Option<Date>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Remittance {
    None,
    Unstructured(Vec<Max140Text>),
    /// A structured creditor reference (ISO 11649 `RF…`, or a scheme-accepted reference).
    Structured {
        creditor_reference: Max35Text,
    },
}

/// One payment, as every rail sees it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CanonicalPayment {
    pub uetr: Uetr,
    pub end_to_end_id: Max35Text,
    pub instruction_id: Option<Max35Text>,
    /// The carrying message's `MsgId`.
    pub message_id: Max35Text,
    /// Which profile parsed it or will emit it.
    pub rail: String,
    pub profile_version: String,
    pub direction: Direction,
    pub settlement: Settlement,
    pub charge_bearer: ChargeBearer,
    pub debtor: Party,
    pub debtor_account: AccountRef,
    pub debtor_agent: AgentRef,
    pub creditor: Party,
    pub creditor_account: AccountRef,
    pub creditor_agent: AgentRef,
    /// Ordered, at most three.
    pub intermediaries: Vec<AgentRef>,
    /// ISO 20022 `ExternalPurpose1Code` (four characters).
    pub purpose: Option<String>,
    pub remittance: Remittance,
}

/// Agents between the debtor's and the creditor's: at most three (ISO 20022).
pub const MAX_INTERMEDIARIES: usize = 3;

impl CanonicalPayment {
    /// The model-level rules every payment obeys regardless of rail.
    pub fn check(&self) -> Result<(), ModelError> {
        if self.intermediaries.len() > MAX_INTERMEDIARIES {
            return Err(ModelError::new(
                "CanonicalPayment",
                format!(
                    "{} intermediary agents; at most {MAX_INTERMEDIARIES}",
                    self.intermediaries.len()
                ),
            ));
        }
        if let Some(purpose) = &self.purpose
            && (purpose.len() != 4 || !purpose.bytes().all(|b| b.is_ascii_uppercase()))
        {
            return Err(ModelError::new(
                "CanonicalPayment",
                format!("purpose \"{purpose}\" is not a four-letter code"),
            ));
        }
        Ok(())
    }

    /// Every text a sanctions screen and a character-set check look at, with where it is.
    pub fn texts(&self) -> Vec<(&'static str, &str)> {
        let mut out = vec![
            ("EndToEndId", self.end_to_end_id.as_str()),
            ("MsgId", self.message_id.as_str()),
            ("Dbtr/Nm", self.debtor.name.as_str()),
            ("Cdtr/Nm", self.creditor.name.as_str()),
        ];
        for (party, prefix) in [(&self.debtor, "Dbtr"), (&self.creditor, "Cdtr")] {
            if let Some(address) = &party.postal_address {
                let named = [
                    (
                        "StrtNm",
                        address.street_name.as_ref().map(Max70Text::as_str),
                    ),
                    (
                        "BldgNb",
                        address.building_number.as_ref().map(Max16Text::as_str),
                    ),
                    ("PstCd", address.post_code.as_ref().map(Max16Text::as_str)),
                    ("TwnNm", address.town_name.as_ref().map(Max35Text::as_str)),
                ];
                for (field, value) in named {
                    if let Some(value) = value {
                        out.push((
                            if prefix == "Dbtr" {
                                debtor_field(field)
                            } else {
                                creditor_field(field)
                            },
                            value,
                        ));
                    }
                }
                for line in &address.address_lines {
                    out.push((
                        if prefix == "Dbtr" {
                            "Dbtr/PstlAdr/AdrLine"
                        } else {
                            "Cdtr/PstlAdr/AdrLine"
                        },
                        line.as_str(),
                    ));
                }
            }
        }
        match &self.remittance {
            Remittance::Unstructured(lines) => {
                out.extend(lines.iter().map(|l| ("RmtInf/Ustrd", l.as_str())));
            }
            Remittance::Structured { creditor_reference } => {
                out.push(("RmtInf/Strd/CdtrRefInf/Ref", creditor_reference.as_str()));
            }
            Remittance::None => {}
        }
        out
    }
}

fn debtor_field(field: &str) -> &'static str {
    match field {
        "StrtNm" => "Dbtr/PstlAdr/StrtNm",
        "BldgNb" => "Dbtr/PstlAdr/BldgNb",
        "PstCd" => "Dbtr/PstlAdr/PstCd",
        _ => "Dbtr/PstlAdr/TwnNm",
    }
}

fn creditor_field(field: &str) -> &'static str {
    match field {
        "StrtNm" => "Cdtr/PstlAdr/StrtNm",
        "BldgNb" => "Cdtr/PstlAdr/BldgNb",
        "PstCd" => "Cdtr/PstlAdr/PstCd",
        _ => "Cdtr/PstlAdr/TwnNm",
    }
}
