use crate::error_codes::{ErrorClass, ErrorCode};

/// The error type of every consensus-path operation (ADR-001).
///
/// `code` is protocol: stable, versioned, allowed into receipts. `detail` is for people:
/// it may change between releases and MUST NOT enter any hashed structure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AletheiaError {
    code: ErrorCode,
    detail: String,
}

impl AletheiaError {
    pub fn new(code: ErrorCode, detail: String) -> AletheiaError {
        AletheiaError { code, detail }
    }

    pub fn code(&self) -> ErrorCode {
        self.code
    }

    pub fn detail(&self) -> &str {
        &self.detail
    }

    /// True for errors after which the node must stop rather than continue (Section 46.3):
    /// invariant violations, storage corruption, finality conflicts.
    pub fn is_fail_stop(&self) -> bool {
        self.code.class() == ErrorClass::FailStop
    }
}

impl core::fmt::Display for AletheiaError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(
            f,
            "{} ({}): {}",
            self.code.name(),
            self.code.get(),
            self.detail
        )
    }
}

impl std::error::Error for AletheiaError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_carries_name_number_and_detail() {
        let error = AletheiaError::new(ErrorCode::TxNonceTooLow, "nonce 4 below 7".to_owned());
        assert_eq!(
            error.to_string(),
            "TX_NONCE_TOO_LOW (2003): nonce 4 below 7"
        );
    }

    #[test]
    fn fail_stop_follows_the_code_class() {
        let finality = AletheiaError::new(ErrorCode::FinalizeParentMismatch, String::new());
        let decode = AletheiaError::new(ErrorCode::DecodeTrailingBytes, String::new());
        assert!(finality.is_fail_stop());
        assert!(!decode.is_fail_stop());
    }
}
