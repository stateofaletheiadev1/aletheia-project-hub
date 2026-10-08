//! `camt.053` (end-of-day statement) and `camt.052` / `camt.054` (intraday report and
//! notification) for a partner nostro account: balances and entries, for reconciliation
//! R1, R8 and R9 (Sections 40B.6, 40C.11).

use aletheia_rails_model::{Amount, CurrencyCode, Uetr};

use crate::iso::xml::{Element, Writer, parse};
use crate::layers::RailRejection;

const NAMESPACE: &str = "urn:iso:std:iso:20022:tech:xsd:";

fn invalid(field: &'static str, detail: impl Into<String>) -> RailRejection {
    RailRejection {
        layer: 1,
        reason: "FF01",
        field,
        detail: detail.into(),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Credit,
    Debit,
}

/// One booked movement on the nostro account.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    /// The bank's own reference for the entry, unique within the account.
    pub entry_ref: String,
    pub amount: Amount,
    pub direction: Direction,
    pub uetr: Option<Uetr>,
    pub end_to_end_id: Option<String>,
}

/// A statement or report: the account, opening and closing balances (signed in minor units),
/// and its entries.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Statement {
    pub message_id: String,
    pub account: String,
    pub currency: CurrencyCode,
    pub opening: Option<i128>,
    pub closing: Option<i128>,
    pub entries: Vec<Entry>,
}

fn signed(
    node: &Element,
    exponent: u32,
    field: &'static str,
) -> Result<(i128, CurrencyCode), RailRejection> {
    let amount_node = node
        .child("Amt")
        .ok_or_else(|| invalid(field, "a balance without an amount"))?;
    let currency = CurrencyCode::new(amount_node.attr("Ccy").unwrap_or_default())
        .map_err(|e| invalid(field, e.to_string()))?;
    let amount = Amount::parse(amount_node.text.trim(), currency, exponent)
        .map_err(|e| invalid(field, e.to_string()))?;
    let value = i128::try_from(amount.minor_units).map_err(|_| invalid(field, "too large"))?;
    Ok(match node.text_at("CdtDbtInd") {
        Some("DBIT") => (value.saturating_neg(), currency),
        _ => (value, currency),
    })
}

/// Parses a `camt.053`, `camt.052` or `camt.054`; `exponent` is the currency's minor digits.
pub fn parse_statement(bytes: &[u8], exponent: u32) -> Result<Statement, RailRejection> {
    let root = parse(bytes)?;
    let doc = if root.name == "Document" {
        &root
    } else {
        root.child("Document")
            .ok_or_else(|| invalid("Document", "a required element is missing"))?
    };
    let namespace = doc.attr("xmlns").unwrap_or_default();
    let version = namespace.strip_prefix(NAMESPACE).unwrap_or(namespace);
    let (body_name, item_name) = if version.starts_with("camt.053") {
        ("BkToCstmrStmt", "Stmt")
    } else if version.starts_with("camt.052") {
        ("BkToCstmrAcctRpt", "Rpt")
    } else if version.starts_with("camt.054") {
        ("BkToCstmrDbtCdtNtfctn", "Ntfctn")
    } else {
        return Err(invalid(
            "Document/@xmlns",
            format!("\"{version}\" is not a camt.052, camt.053 or camt.054"),
        ));
    };
    let body = doc
        .child(body_name)
        .ok_or_else(|| invalid("Document", "a required element is missing"))?;
    let message_id = body
        .text_at("GrpHdr/MsgId")
        .ok_or_else(|| invalid("GrpHdr/MsgId", "a required element is missing"))?
        .to_owned();
    let item = body
        .child(item_name)
        .ok_or_else(|| invalid("Stmt", "a required element is missing"))?;
    let account = item
        .text_at("Acct/Id/IBAN")
        .or_else(|| item.text_at("Acct/Id/Othr/Id"))
        .ok_or_else(|| invalid("Acct", "a required element is missing"))?
        .to_owned();
    let currency_code = item.text_at("Acct/Ccy").unwrap_or("EUR");
    let currency =
        CurrencyCode::new(currency_code).map_err(|e| invalid("Acct/Ccy", e.to_string()))?;
    let mut opening = None;
    let mut closing = None;
    for balance in item.children_named("Bal") {
        let (value, _) = signed(balance, exponent, "Bal")?;
        match balance.text_at("Tp/CdOrPrtry/Cd") {
            Some("OPBD" | "PRCD") => opening = Some(value),
            Some("CLBD" | "ITBD") => closing = Some(value),
            _ => {}
        }
    }
    let mut entries = Vec::new();
    for entry in item.children_named("Ntry") {
        let entry_ref = entry
            .text_at("NtryRef")
            .or_else(|| entry.text_at("AcctSvcrRef"))
            .ok_or_else(|| invalid("Ntry/NtryRef", "an entry without a reference"))?
            .to_owned();
        let amount_node = entry
            .child("Amt")
            .ok_or_else(|| invalid("Ntry/Amt", "an entry without an amount"))?;
        let entry_currency = CurrencyCode::new(amount_node.attr("Ccy").unwrap_or_default())
            .map_err(|e| invalid("Ntry/Amt", e.to_string()))?;
        let amount = Amount::parse(amount_node.text.trim(), entry_currency, exponent)
            .map_err(|e| invalid("Ntry/Amt", e.to_string()))?;
        let direction = match entry.text_at("CdtDbtInd") {
            Some("CRDT") => Direction::Credit,
            Some("DBIT") => Direction::Debit,
            _ => return Err(invalid("Ntry/CdtDbtInd", "neither CRDT nor DBIT")),
        };
        let refs = entry.at("NtryDtls/TxDtls/Refs");
        let uetr = refs
            .and_then(|r| r.text_at("UETR"))
            .map(Uetr::new)
            .transpose()
            .map_err(|e| invalid("Ntry/NtryDtls/TxDtls/Refs/UETR", e.to_string()))?;
        entries.push(Entry {
            entry_ref,
            amount,
            direction,
            uetr,
            end_to_end_id: refs
                .and_then(|r| r.text_at("EndToEndId"))
                .map(str::to_owned),
        });
    }
    Ok(Statement {
        message_id,
        account,
        currency,
        opening,
        closing,
        entries,
    })
}

/// Renders a `camt.053` (used by the rail simulator and tests).
pub fn render_camt053(statement: &Statement, exponent: u32, created_at: &str) -> String {
    let amount = |minor: i128| -> (String, &'static str) {
        let a = Amount {
            minor_units: minor.unsigned_abs(),
            currency: statement.currency,
        };
        (a.render(exponent), if minor < 0 { "DBIT" } else { "CRDT" })
    };
    let ccy = statement.currency.as_str();
    let mut w = Writer::new();
    w.open(
        "Document",
        &[("xmlns", "urn:iso:std:iso:20022:tech:xsd:camt.053.001.08")],
    );
    w.open("BkToCstmrStmt", &[]);
    w.open("GrpHdr", &[]);
    w.leaf("MsgId", &[], &statement.message_id);
    w.leaf("CreDtTm", &[], created_at);
    w.close();
    w.open("Stmt", &[]);
    w.leaf("Id", &[], &statement.message_id);
    w.open("Acct", &[]);
    w.open("Id", &[]);
    w.leaf("IBAN", &[], &statement.account);
    w.close();
    w.leaf("Ccy", &[], ccy);
    w.close();
    for (code, value) in [("OPBD", statement.opening), ("CLBD", statement.closing)] {
        if let Some(value) = value {
            let (text, sign) = amount(value);
            w.open("Bal", &[]);
            w.open("Tp", &[]);
            w.open("CdOrPrtry", &[]);
            w.leaf("Cd", &[], code);
            w.close();
            w.close();
            w.leaf("Amt", &[("Ccy", ccy)], &text);
            w.leaf("CdtDbtInd", &[], sign);
            w.close();
        }
    }
    for entry in &statement.entries {
        w.open("Ntry", &[]);
        w.leaf("NtryRef", &[], &entry.entry_ref);
        w.leaf(
            "Amt",
            &[("Ccy", entry.amount.currency.as_str())],
            &entry.amount.render(exponent),
        );
        w.leaf(
            "CdtDbtInd",
            &[],
            match entry.direction {
                Direction::Credit => "CRDT",
                Direction::Debit => "DBIT",
            },
        );
        w.leaf("Sts", &[], "BOOK");
        w.open("NtryDtls", &[]);
        w.open("TxDtls", &[]);
        w.open("Refs", &[]);
        if let Some(e2e) = &entry.end_to_end_id {
            w.leaf("EndToEndId", &[], e2e);
        }
        if let Some(uetr) = &entry.uetr {
            w.leaf("UETR", &[], uetr.as_str());
        }
        w.close();
        w.close();
        w.close();
        w.close();
    }
    w.finish()
}
