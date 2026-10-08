//! Why a value could not be built. Messages name the field and the rule, in plain English.

/// A value that does not fit its type.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelError {
    /// What was being built, e.g. `"IBAN"` or `"Max35Text"`.
    pub what: &'static str,
    pub detail: String,
}

impl ModelError {
    pub fn new(what: &'static str, detail: impl Into<String>) -> ModelError {
        ModelError {
            what,
            detail: detail.into(),
        }
    }
}

impl core::fmt::Display for ModelError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}: {}", self.what, self.detail)
    }
}

impl std::error::Error for ModelError {}
