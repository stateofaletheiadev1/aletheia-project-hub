//! ISO 20022 status and return reasons, mapped to APN lifecycle states and customer text
//! (Section 40C.10). `docs/apn/mappings/status-reasons.md` is generated from this table and
//! a test keeps the two equal. Customer text is in English here; the other official
//! languages are added as translations of these sentences.

/// The APN lifecycle state a reason leads to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApnState {
    Rejected,
    /// Rejected before settlement, or returned after it, depending on when it arrives.
    RejectedOrReturned,
    /// Outcome unknown (an instant-scheme time-out): the money is held until a definitive
    /// status (Section 40C.7, I15).
    Investigating,
}

impl ApnState {
    pub const fn name(self) -> &'static str {
        match self {
            ApnState::Rejected => "REJECTED",
            ApnState::RejectedOrReturned => "REJECTED / RETURNED",
            ApnState::Investigating => "INVESTIGATING",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IsoReason {
    /// The ISO `ExternalStatusReason1Code` / `ExternalReturnReason1Code` value.
    pub code: &'static str,
    pub meaning: &'static str,
    pub state: ApnState,
    /// What the customer is told.
    pub customer_en: &'static str,
}

const fn r(
    code: &'static str,
    meaning: &'static str,
    state: ApnState,
    customer_en: &'static str,
) -> IsoReason {
    IsoReason {
        code,
        meaning,
        state,
        customer_en,
    }
}

/// Sorted by code.
pub const REASONS: &[IsoReason] = &[
    r(
        "AB05",
        "Time-out at the creditor agent",
        ApnState::Investigating,
        "Your bank is confirming whether this payment arrived. Your money is held safely until it is confirmed.",
    ),
    r(
        "AB06",
        "Time-out at the instructed agent",
        ApnState::Investigating,
        "Your bank is confirming whether this payment arrived. Your money is held safely until it is confirmed.",
    ),
    r(
        "AC01",
        "Incorrect account number",
        ApnState::Rejected,
        "The receiving account number is not valid. No money left your account.",
    ),
    r(
        "AC03",
        "Invalid creditor account number",
        ApnState::Rejected,
        "The receiving account number is not valid. No money left your account.",
    ),
    r(
        "AC04",
        "Closed account",
        ApnState::RejectedOrReturned,
        "The receiving account is closed.",
    ),
    r(
        "AC06",
        "Blocked account",
        ApnState::RejectedOrReturned,
        "The receiving account is blocked.",
    ),
    r(
        "AG01",
        "Transaction forbidden on this account",
        ApnState::Rejected,
        "The receiving account cannot accept this kind of payment.",
    ),
    r(
        "AM01",
        "Zero amount",
        ApnState::Rejected,
        "The payment amount is zero.",
    ),
    r(
        "AM02",
        "Amount above the allowed maximum",
        ApnState::Rejected,
        "The amount is above the maximum this payment type allows.",
    ),
    r(
        "AM03",
        "Currency not allowed",
        ApnState::Rejected,
        "This payment type does not carry that currency.",
    ),
    r(
        "AM04",
        "Insufficient funds",
        ApnState::Rejected,
        "There was not enough money for this payment.",
    ),
    r(
        "AM05",
        "Duplication",
        ApnState::Rejected,
        "This payment was already sent.",
    ),
    r(
        "BE01",
        "Inconsistent with the end customer",
        ApnState::Rejected,
        "The receiver's name does not match the account.",
    ),
    r(
        "CUST",
        "Requested by the customer",
        ApnState::RejectedOrReturned,
        "The payment was cancelled at the customer's request.",
    ),
    r(
        "DT01",
        "Invalid date",
        ApnState::Rejected,
        "The payment date is not valid for this payment type.",
    ),
    r(
        "DUPL",
        "Duplicate payment",
        ApnState::Rejected,
        "This payment was already sent.",
    ),
    r(
        "FF01",
        "Invalid file format",
        ApnState::Rejected,
        "The payment message was not in a form the receiving system accepts. No money left your account.",
    ),
    r(
        "FOCR",
        "Following a cancellation request",
        ApnState::RejectedOrReturned,
        "The payment was returned after a cancellation request.",
    ),
    r(
        "MS03",
        "Reason not specified",
        ApnState::RejectedOrReturned,
        "The receiving bank declined this payment without giving a reason.",
    ),
    r(
        "NARR",
        "Narrative reason",
        ApnState::RejectedOrReturned,
        "The receiving bank declined this payment; see the explanation provided.",
    ),
    r(
        "RC01",
        "Bank identifier incorrect",
        ApnState::Rejected,
        "The receiving bank's identifier is not valid. No money left your account.",
    ),
    r(
        "RR04",
        "Regulatory reason",
        ApnState::Rejected,
        "The receiving bank declined this payment for regulatory reasons.",
    ),
];

/// The reason with this code.
pub fn reason(code: &str) -> Option<&'static IsoReason> {
    REASONS.iter().find(|r| r.code == code)
}

/// The mapping table as committed in `docs/apn/mappings/status-reasons.md`.
pub fn render_markdown() -> String {
    let mut out = String::from(
        "# ISO 20022 status and return reasons\n\n\
         Generated from `crates/rails/src/reasons.rs` (spec Section 40C.10); a test keeps this \
         file equal to the table. Do not edit by hand.\n\n\
         | ISO code | Meaning | APN state | Customer text (en) |\n\
         | --- | --- | --- | --- |\n",
    );
    for reason in REASONS {
        out.push_str(&format!(
            "| `{}` | {} | {} | {} |\n",
            reason.code,
            reason.meaning,
            reason.state.name(),
            reason.customer_en
        ));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_sorted_unique_and_four_characters() {
        for pair in REASONS.windows(2) {
            assert!(
                pair[0].code < pair[1].code,
                "{} then {}",
                pair[0].code,
                pair[1].code
            );
        }
        assert!(REASONS.iter().all(|r| r.code.len() == 4));
    }

    #[test]
    fn a_time_out_is_never_a_failure() {
        for code in ["AB05", "AB06"] {
            assert_eq!(reason(code).unwrap().state, ApnState::Investigating);
        }
    }

    #[test]
    fn the_committed_table_matches() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../docs/apn/mappings/status-reasons.md"
        );
        if std::env::var_os("ALETHEIA_WRITE_DOCS").is_some() {
            std::fs::create_dir_all(std::path::Path::new(path).parent().unwrap()).unwrap();
            std::fs::write(path, render_markdown()).unwrap();
        }
        let committed = std::fs::read_to_string(path)
            .unwrap_or_default()
            .replace("\r\n", "\n");
        assert_eq!(
            committed,
            render_markdown(),
            "regenerate with ALETHEIA_WRITE_DOCS=1 cargo test -p aletheia-rails"
        );
    }
}
