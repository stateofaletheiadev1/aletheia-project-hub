//! Rail profiles (Section 40C.3): each rail's rules as a TOML file under
//! `crates/rails/profiles/<rail>/<version>.toml`, reviewed like code, hashed, and chosen by the
//! payment's acceptance date. Numbers a scheme operator may change live only here.
//!
//! A profile is `draft` until two named reviewers have checked it against the operator's
//! publications on a recorded date; only then may it be `active`. A production gateway loads
//! active profiles only; drafts are for the rail simulator and tests.

use std::collections::BTreeMap;
use std::path::Path;

use aletheia_rails_model::{Amount, CurrencyCode, Date};
use serde::Deserialize;

use crate::charset::Charset;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProfileError {
    pub file: String,
    pub detail: String,
}

impl core::fmt::Display for ProfileError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}: {}", self.file, self.detail)
    }
}

impl std::error::Error for ProfileError {}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Currency {
    pub allowed: Vec<String>,
    pub minor_units: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Timing {
    /// `always` (24/7/365) or `business-days`.
    pub operating_calendar: String,
    /// IANA time zone the calendar and cut-offs are in, for business-day rails.
    #[serde(default)]
    pub time_zone: String,
    /// Scheme time-out for the beneficiary side's answer (instant schemes).
    #[serde(default)]
    pub max_execution_seconds: Option<u32>,
    /// Our own: when to send a status investigation if no definitive status arrived.
    #[serde(default)]
    pub investigation_after_seconds: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Limits {
    /// Decimal amount in the rail's currency; empty means no scheme cap (partner and
    /// participant limits still apply).
    pub scheme_max_amount: String,
    /// Where the partner's limit comes from.
    pub partner_max_amount: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CharsetRule {
    pub set: String,
    /// `reject` (the only value v0.1 accepts: no transliteration without an explicit table).
    pub on_violation: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Fields {
    pub end_to_end_id_max: usize,
    pub remittance_unstructured_max: usize,
    /// Unstructured remittance lines allowed.
    pub remittance_unstructured_lines: usize,
    /// The charge bearer the rail requires (`SLEV`, `SHAR`, ...), or empty for any.
    pub charge_bearer: String,
    /// `iban` (both accounts must be IBANs) or `any`.
    pub account: String,
    /// `required` or `optional`.
    pub agent_bic: String,
    /// `required` or `optional`.
    pub uetr: String,
    /// `uetr` or `end-to-end-account-amount-date`: what makes two payments duplicates.
    pub duplicate_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AddressRule {
    /// `structured-or-hybrid-required`, `structured-or-hybrid-when-provided` or `any`.
    pub mode: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VerificationOfPayee {
    pub required: bool,
    pub interface: String,
    pub mismatch_behaviour: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Returns {
    /// Business days after settlement a return may come, per the rulebook; absent where the
    /// rulebook sets none (the partner agreement does).
    #[serde(default)]
    pub return_window_business_days: Option<u32>,
    /// Business days after settlement a recall may be sent.
    #[serde(default)]
    pub recall_window_business_days: Option<u32>,
    /// Direct debit: calendar days the debtor may claim a refund of an authorized debit.
    #[serde(default)]
    pub refund_authorised_days: Option<u32>,
    /// Direct debit: calendar days the debtor may claim a refund of an unauthorized debit.
    #[serde(default)]
    pub refund_unauthorised_days: Option<u32>,
}

/// One profile file.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RailProfile {
    pub rail: String,
    pub operator: String,
    pub rulebook: String,
    /// `draft` or `active`.
    pub status: String,
    pub effective_from: Date,
    /// Empty: until superseded.
    pub effective_until: String,
    pub source_documents: Vec<String>,
    pub reviewed_by: Vec<String>,
    /// Empty while draft.
    pub reviewed_on: String,
    pub messages: BTreeMap<String, String>,
    pub currency: Currency,
    pub timing: Timing,
    pub limits: Limits,
    pub charset: CharsetRule,
    pub fields: Fields,
    pub address: AddressRule,
    #[serde(default)]
    pub verification_of_payee: Option<VerificationOfPayee>,
    pub returns: Returns,
    /// Set when loaded: the file's version name and content hash.
    #[serde(skip)]
    pub version: String,
    #[serde(skip)]
    pub hash: [u8; 32],
}

/// The profile hash recorded in every audit record the profile touched.
pub fn profile_hash(bytes: &[u8]) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new_derive_key("ALETHEIA/RAIL-PROFILE/v1");
    hasher.update(bytes);
    *hasher.finalize().as_bytes()
}

impl RailProfile {
    /// Parses and checks one profile file's text.
    pub fn parse(file: &str, version: &str, text: &str) -> Result<RailProfile, ProfileError> {
        let error = |detail: String| ProfileError {
            file: file.to_owned(),
            detail,
        };
        let mut profile: RailProfile = toml::from_str(text).map_err(|e| error(e.to_string()))?;
        profile.version = version.to_owned();
        profile.hash = profile_hash(text.as_bytes());
        profile.check().map_err(error)?;
        Ok(profile)
    }

    /// The rules for the file itself (Section 40C.3), and values the validators rely on.
    fn check(&self) -> Result<(), String> {
        if self.source_documents.is_empty() {
            return Err("a profile names its source documents".to_owned());
        }
        match self.status.as_str() {
            "draft" => {}
            "active" => {
                let mut reviewers = self.reviewed_by.clone();
                reviewers.sort();
                reviewers.dedup();
                if reviewers.len() < 2 {
                    return Err("an active profile has at least two different reviewers".to_owned());
                }
                Date::parse(&self.reviewed_on)
                    .map_err(|_| "an active profile records its review date".to_owned())?;
            }
            other => return Err(format!("status \"{other}\" is neither draft nor active")),
        }
        if !self.effective_until.is_empty() {
            let until = Date::parse(&self.effective_until).map_err(|e| e.to_string())?;
            if until <= self.effective_from {
                return Err("effective_until is not after effective_from".to_owned());
            }
        }
        if self.currency.allowed.is_empty() {
            return Err("a profile allows at least one currency".to_owned());
        }
        for code in &self.currency.allowed {
            CurrencyCode::new(code).map_err(|e| e.to_string())?;
        }
        if !self.limits.scheme_max_amount.is_empty() {
            self.scheme_max().map_err(|e| e.to_string())?;
        }
        if Charset::from_name(&self.charset.set).is_none() {
            return Err(format!(
                "character set \"{}\" is not known",
                self.charset.set
            ));
        }
        if self.charset.on_violation != "reject" {
            return Err("on_violation must be \"reject\": nothing is transliterated without an explicit table".to_owned());
        }
        if !matches!(
            self.timing.operating_calendar.as_str(),
            "always" | "business-days"
        ) {
            return Err(format!(
                "operating calendar \"{}\" is not known",
                self.timing.operating_calendar
            ));
        }
        if self.timing.operating_calendar == "business-days" && self.timing.time_zone.is_empty() {
            return Err("a business-day rail names its time zone".to_owned());
        }
        let fields = &self.fields;
        let known = [
            ("account", fields.account.as_str(), &["iban", "any"][..]),
            (
                "agent_bic",
                fields.agent_bic.as_str(),
                &["required", "optional"][..],
            ),
            ("uetr", fields.uetr.as_str(), &["required", "optional"][..]),
            (
                "duplicate_key",
                fields.duplicate_key.as_str(),
                &["uetr", "end-to-end-account-amount-date"][..],
            ),
            (
                "address.mode",
                self.address.mode.as_str(),
                &[
                    "structured-or-hybrid-required",
                    "structured-or-hybrid-when-provided",
                    "any",
                ][..],
            ),
        ];
        for (name, value, allowed) in known {
            if !allowed.contains(&value) {
                return Err(format!("{name} \"{value}\" is not one of {allowed:?}"));
            }
        }
        if !fields.charge_bearer.is_empty()
            && aletheia_rails_model::ChargeBearer::from_code(&fields.charge_bearer).is_none()
        {
            return Err(format!(
                "charge bearer \"{}\" is not known",
                fields.charge_bearer
            ));
        }
        if !self.messages.contains_key("credit_transfer")
            && !self.messages.contains_key("direct_debit")
        {
            return Err("a profile names its credit transfer or direct debit message".to_owned());
        }
        Ok(())
    }

    /// The scheme cap in minor units of the first allowed currency, if any.
    pub fn scheme_max(&self) -> Result<Option<Amount>, aletheia_rails_model::ModelError> {
        if self.limits.scheme_max_amount.is_empty() {
            return Ok(None);
        }
        let code = self.currency.allowed.first().map_or("", String::as_str);
        let currency = CurrencyCode::new(code)?;
        Amount::parse(
            &self.limits.scheme_max_amount,
            currency,
            self.currency.minor_units,
        )
        .map(Some)
    }

    pub fn charset(&self) -> Charset {
        Charset::from_name(&self.charset.set).unwrap_or(Charset::EpcLatin)
    }

    /// Whether the profile is in force on `date`.
    pub fn in_force(&self, date: Date) -> bool {
        date >= self.effective_from
            && (self.effective_until.is_empty()
                || Date::parse(&self.effective_until).is_ok_and(|until| date < until))
    }
}

/// Every profile of every rail, as loaded at gateway start.
#[derive(Debug, Clone, Default)]
pub struct ProfileSet {
    profiles: Vec<RailProfile>,
}

impl ProfileSet {
    /// Loads `<dir>/<rail>/<version>.toml`. With `active_only`, drafts are refused (production).
    pub fn load(dir: &Path, active_only: bool) -> Result<ProfileSet, ProfileError> {
        let io = |path: &Path, e: std::io::Error| ProfileError {
            file: path.display().to_string(),
            detail: e.to_string(),
        };
        let mut profiles = Vec::new();
        let mut rails: Vec<_> = std::fs::read_dir(dir)
            .map_err(|e| io(dir, e))?
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect();
        rails.sort();
        for rail_dir in rails {
            let mut files: Vec<_> = std::fs::read_dir(&rail_dir)
                .map_err(|e| io(&rail_dir, e))?
                .filter_map(Result::ok)
                .map(|e| e.path())
                .filter(|p| p.extension().is_some_and(|x| x == "toml"))
                .collect();
            files.sort();
            for file in files {
                let text = std::fs::read_to_string(&file).map_err(|e| io(&file, e))?;
                let version = file
                    .file_stem()
                    .map_or_else(String::new, |s| s.to_string_lossy().into_owned());
                let name = file.display().to_string();
                let profile = RailProfile::parse(&name, &version, &text)?;
                let folder = rail_dir
                    .file_name()
                    .map_or_else(String::new, |s| s.to_string_lossy().into_owned());
                if profile.rail != folder {
                    return Err(ProfileError {
                        file: name,
                        detail: format!("rail \"{}\" is filed under \"{folder}\"", profile.rail),
                    });
                }
                if active_only && profile.status != "active" {
                    return Err(ProfileError {
                        file: name,
                        detail: "a draft profile cannot be loaded in production".to_owned(),
                    });
                }
                profiles.push(profile);
            }
        }
        Ok(ProfileSet { profiles })
    }

    pub fn from_profiles(profiles: Vec<RailProfile>) -> ProfileSet {
        ProfileSet { profiles }
    }

    /// The profile of `rail` in force on `date`: the one with the latest `effective_from`.
    pub fn at(&self, rail: &str, date: Date) -> Option<&RailProfile> {
        self.profiles
            .iter()
            .filter(|p| p.rail == rail && p.in_force(date))
            .max_by_key(|p| p.effective_from)
    }

    pub fn rails(&self) -> Vec<&str> {
        let mut rails: Vec<&str> = self.profiles.iter().map(|p| p.rail.as_str()).collect();
        rails.dedup();
        rails
    }

    pub fn all(&self) -> &[RailProfile] {
        &self.profiles
    }
}
