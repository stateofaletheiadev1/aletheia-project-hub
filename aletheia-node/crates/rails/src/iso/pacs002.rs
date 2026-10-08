//! `pacs.002` (FI to FI payment status report) to and from a list of transaction statuses.
//! A status the rail reports as pending or timed out is not a rejection (Section 40C.7).

use aletheia_rails_model::Uetr;

use crate::iso::pacs008::document;
use crate::iso::xml::{Writer, parse};
use crate::layers::RailRejection;
use crate::profile::RailProfile;

const NAMESPACE: &str = "urn:iso:std:iso:20022:tech:xsd:";

/// How the rail classifies a transaction's status (ISO `ExternalPaymentTransactionStatus1Code`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    /// `ACSC`, `ACCC`: settled; definitive acceptance.
    Settled,
    /// `ACCP`, `ACSP`, `ACTC`, `ACWC`, `ACWP`: accepted so far, not settled.
    InProgress,
    /// `PDNG`: pending; the outcome is not known yet.
    Pending,
    /// `RJCT`: definitive rejection.
    Rejected,
}

impl Outcome {
    pub fn from_code(code: &str) -> Option<Outcome> {
        Some(match code {
            "ACSC" | "ACCC" => Outcome::Settled,
            "ACCP" | "ACSP" | "ACTC" | "ACWC" | "ACWP" => Outcome::InProgress,
            "PDNG" => Outcome::Pending,
            "RJCT" => Outcome::Rejected,
            _ => return None,
        })
    }

    /// Whether this answer settles the question: only then may an escrow be settled or
    /// released (I15).
    pub fn is_definitive(self) -> bool {
        matches!(self, Outcome::Settled | Outcome::Rejected)
    }
}

/// One transaction's status, as reported.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransactionStatus {
    pub original_message_id: String,
    pub original_end_to_end_id: Option<String>,
    pub original_uetr: Option<Uetr>,
    /// The ISO status code as sent (`ACSC`, `RJCT`, ...).
    pub status: String,
    pub outcome: Outcome,
    /// The ISO reason code, if any (`AC04`, `AB05`, ...).
    pub reason: Option<String>,
}

fn invalid(field: &'static str, detail: impl Into<String>) -> RailRejection {
    RailRejection {
        layer: 1,
        reason: "FF01",
        field,
        detail: detail.into(),
    }
}

/// Parses a `pacs.002` into one status per `TxInfAndSts` (layer 1).
pub fn parse_pacs002(
    bytes: &[u8],
    profile: &RailProfile,
) -> Result<Vec<TransactionStatus>, RailRejection> {
    let expected = profile
        .messages
        .get("status_report")
        .map(String::as_str)
        .unwrap_or_default();
    let root = parse(bytes)?;
    let doc = document(&root, expected)?;
    let body = doc
        .child("FIToFIPmtStsRpt")
        .ok_or_else(|| invalid("FIToFIPmtStsRpt", "a required element is missing"))?;
    let group = body
        .child("OrgnlGrpInfAndSts")
        .ok_or_else(|| invalid("OrgnlGrpInfAndSts", "a required element is missing"))?;
    let original_message_id = group
        .text_at("OrgnlMsgId")
        .filter(|t| !t.is_empty())
        .ok_or_else(|| {
            invalid(
                "OrgnlGrpInfAndSts/OrgnlMsgId",
                "a required element is missing",
            )
        })?;
    let mut out = Vec::new();
    for tx in body.children_named("TxInfAndSts") {
        let status = tx
            .text_at("TxSts")
            .ok_or_else(|| invalid("TxInfAndSts/TxSts", "a required element is missing"))?;
        let outcome = Outcome::from_code(status).ok_or_else(|| {
            invalid(
                "TxInfAndSts/TxSts",
                format!("\"{status}\" is not a known status"),
            )
        })?;
        let original_uetr = tx
            .text_at("OrgnlUETR")
            .map(Uetr::new)
            .transpose()
            .map_err(|e| invalid("TxInfAndSts/OrgnlUETR", e.to_string()))?;
        out.push(TransactionStatus {
            original_message_id: original_message_id.to_owned(),
            original_end_to_end_id: tx.text_at("OrgnlEndToEndId").map(str::to_owned),
            original_uetr,
            status: status.to_owned(),
            outcome,
            reason: tx.text_at("StsRsnInf/Rsn/Cd").map(str::to_owned),
        });
    }
    if out.is_empty() {
        return Err(invalid(
            "TxInfAndSts",
            "the report carries no transaction status",
        ));
    }
    Ok(out)
}

/// Renders statuses for one original message as a `pacs.002` in the profile's version.
pub fn render_pacs002(
    message_id: &str,
    created_at: &str,
    statuses: &[TransactionStatus],
    profile: &RailProfile,
) -> Result<String, RailRejection> {
    let first = statuses
        .first()
        .ok_or_else(|| invalid("TxInfAndSts", "nothing to render"))?;
    let version = profile.messages.get("status_report").ok_or_else(|| {
        invalid(
            "Document/@xmlns",
            "the profile names no status report message",
        )
    })?;
    let namespace = format!("{NAMESPACE}{version}");
    let mut w = Writer::new();
    w.open("Document", &[("xmlns", &namespace)]);
    w.open("FIToFIPmtStsRpt", &[]);
    w.open("GrpHdr", &[]);
    w.leaf("MsgId", &[], message_id);
    w.leaf("CreDtTm", &[], created_at);
    w.close();
    w.open("OrgnlGrpInfAndSts", &[]);
    w.leaf("OrgnlMsgId", &[], &first.original_message_id);
    w.leaf("OrgnlMsgNmId", &[], "pacs.008");
    w.close();
    for s in statuses {
        w.open("TxInfAndSts", &[]);
        if let Some(e2e) = &s.original_end_to_end_id {
            w.leaf("OrgnlEndToEndId", &[], e2e);
        }
        if let Some(uetr) = &s.original_uetr {
            w.leaf("OrgnlUETR", &[], uetr.as_str());
        }
        w.leaf("TxSts", &[], &s.status);
        if let Some(reason) = &s.reason {
            w.open("StsRsnInf", &[]);
            w.open("Rsn", &[]);
            w.leaf("Cd", &[], reason);
            w.close();
            w.close();
        }
        w.close();
    }
    Ok(w.finish())
}
