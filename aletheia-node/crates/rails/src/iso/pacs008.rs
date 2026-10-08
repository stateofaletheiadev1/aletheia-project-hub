//! `pacs.008` (FI to FI customer credit transfer) to and from the canonical payment. The
//! message version must be the one the rail profile names. Rendering is pure: the same
//! payments, profile and creation time give the same bytes.

use aletheia_rails_model::{
    AccountRef, AgentRef, Amount, Bic, CanonicalPayment, ChargeBearer, CountryCode, CurrencyCode,
    Date, Direction, Iban, Lei, Max16Text, Max35Text, Max70Text, Max140Text, Party, PostalAddress,
    Remittance, Settlement, Uetr,
};

use crate::iso::xml::{Element, Writer, parse};
use crate::layers::RailRejection;
use crate::profile::RailProfile;

const NAMESPACE: &str = "urn:iso:std:iso:20022:tech:xsd:";

fn missing(field: &'static str) -> RailRejection {
    RailRejection {
        layer: 1,
        reason: "FF01",
        field,
        detail: "a required element is missing".to_owned(),
    }
}

fn invalid(field: &'static str, detail: impl core::fmt::Display) -> RailRejection {
    RailRejection {
        layer: 1,
        reason: "FF01",
        field,
        detail: detail.to_string(),
    }
}

fn required<'a>(
    node: &'a Element,
    path: &str,
    field: &'static str,
) -> Result<&'a str, RailRejection> {
    node.text_at(path)
        .filter(|t| !t.is_empty())
        .ok_or_else(|| missing(field))
}

/// The message's own version, checked against the profile.
pub(crate) fn document<'a>(
    root: &'a Element,
    expected: &str,
) -> Result<&'a Element, RailRejection> {
    // A Business Application Header envelope carries `AppHdr` and `Document` side by side.
    let doc = if root.name == "Document" {
        root
    } else {
        root.child("Document").ok_or_else(|| missing("Document"))?
    };
    let namespace = doc.attr("xmlns").unwrap_or_default();
    let version = namespace.strip_prefix(NAMESPACE).unwrap_or(namespace);
    if version != expected {
        return Err(invalid(
            "Document/@xmlns",
            format!("message version \"{version}\"; this rail's profile uses \"{expected}\""),
        ));
    }
    Ok(doc)
}

/// A UETR for a payment that arrived without one, on a rail where it is optional: derived from
/// what identifies the payment, so a redelivery derives the same one. Never replaces a UETR
/// the message carries.
pub fn derived_uetr(
    rail: &str,
    message_id: &str,
    end_to_end_id: &str,
    instruction_id: &str,
) -> Result<Uetr, RailRejection> {
    let mut hasher = blake3::Hasher::new_derive_key("ALETHEIA/RAIL-UETR/v1");
    for part in [rail, message_id, end_to_end_id, instruction_id] {
        hasher.update(&u64::try_from(part.len()).unwrap_or(u64::MAX).to_le_bytes());
        hasher.update(part.as_bytes());
    }
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(hasher.finalize().as_bytes().get(..16).unwrap_or(&[0; 16]));
    if let Some(b) = bytes.get_mut(6) {
        *b = (*b & 0x0f) | 0x40;
    }
    if let Some(b) = bytes.get_mut(8) {
        *b = (*b & 0x3f) | 0x80;
    }
    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    let text = format!(
        "{}-{}-{}-{}-{}",
        hex.get(0..8).unwrap_or_default(),
        hex.get(8..12).unwrap_or_default(),
        hex.get(12..16).unwrap_or_default(),
        hex.get(16..20).unwrap_or_default(),
        hex.get(20..32).unwrap_or_default()
    );
    Uetr::new(&text).map_err(|e| invalid("PmtId/UETR", e))
}

fn party(node: Option<&Element>, field: &'static str) -> Result<Party, RailRejection> {
    let node = node.ok_or_else(|| missing(field))?;
    let name = Max140Text::new(required(node, "Nm", field)?).map_err(|e| invalid(field, e))?;
    let postal_address = match node.child("PstlAdr") {
        None => None,
        Some(a) => {
            let opt = |path: &str| a.text_at(path).filter(|t| !t.is_empty());
            Some(PostalAddress {
                street_name: opt("StrtNm")
                    .map(Max70Text::new)
                    .transpose()
                    .map_err(|e| invalid(field, e))?,
                building_number: opt("BldgNb")
                    .map(Max16Text::new)
                    .transpose()
                    .map_err(|e| invalid(field, e))?,
                post_code: opt("PstCd")
                    .map(Max16Text::new)
                    .transpose()
                    .map_err(|e| invalid(field, e))?,
                town_name: opt("TwnNm")
                    .map(Max35Text::new)
                    .transpose()
                    .map_err(|e| invalid(field, e))?,
                country: opt("Ctry")
                    .map(CountryCode::new)
                    .transpose()
                    .map_err(|e| invalid(field, e))?,
                address_lines: a
                    .children_named("AdrLine")
                    .map(|l| Max70Text::new(l.text.trim()))
                    .collect::<Result<_, _>>()
                    .map_err(|e| invalid(field, e))?,
            })
        }
    };
    let lei = node
        .text_at("Id/OrgId/LEI")
        .map(Lei::new)
        .transpose()
        .map_err(|e| invalid(field, e))?;
    let country_of_residence = node
        .text_at("CtryOfRes")
        .map(CountryCode::new)
        .transpose()
        .map_err(|e| invalid(field, e))?;
    Ok(Party {
        name,
        postal_address,
        lei,
        country_of_residence,
    })
}

fn account(node: Option<&Element>, field: &'static str) -> Result<AccountRef, RailRejection> {
    let id = node
        .and_then(|n| n.child("Id"))
        .ok_or_else(|| missing(field))?;
    if let Some(iban) = id.text_at("IBAN") {
        return Iban::new(iban)
            .map(AccountRef::Iban)
            .map_err(|e| invalid(field, e));
    }
    let other = id.child("Othr").ok_or_else(|| missing(field))?;
    let value = required(other, "Id", field)?;
    let scheme = other
        .text_at("SchmeNm/Prtry")
        .or_else(|| other.text_at("SchmeNm/Cd"))
        .unwrap_or("BBAN");
    let id = Max35Text::new(value).map_err(|e| invalid(field, e))?;
    Ok(if scheme == "AAN" {
        AccountRef::Aan(id)
    } else {
        AccountRef::Other {
            scheme: Max35Text::new(scheme).map_err(|e| invalid(field, e))?,
            id,
        }
    })
}

fn agent(node: Option<&Element>, field: &'static str) -> Result<AgentRef, RailRejection> {
    let fin = node
        .and_then(|n| n.child("FinInstnId"))
        .ok_or_else(|| missing(field))?;
    if let Some(bic) = fin.text_at("BICFI") {
        return Bic::new(bic)
            .map(AgentRef::Bic)
            .map_err(|e| invalid(field, e));
    }
    if let Some(member) = fin.text_at("ClrSysMmbId/MmbId") {
        let system = fin.text_at("ClrSysMmbId/ClrSysId/Cd").unwrap_or("OTHR");
        return Ok(AgentRef::ClearingMember {
            system: Max35Text::new(system).map_err(|e| invalid(field, e))?,
            member: Max35Text::new(member).map_err(|e| invalid(field, e))?,
        });
    }
    if let Some(lei) = fin.text_at("LEI") {
        return Lei::new(lei)
            .map(AgentRef::Lei)
            .map_err(|e| invalid(field, e));
    }
    if let Some(aic) = fin.text_at("Othr/Id") {
        return Max16Text::new(aic)
            .map(AgentRef::Aic)
            .map_err(|e| invalid(field, e));
    }
    Err(missing(field))
}

/// Parses a `pacs.008` into one canonical payment per `CdtTrfTxInf` (layer 1).
pub fn parse_pacs008(
    bytes: &[u8],
    profile: &RailProfile,
) -> Result<Vec<CanonicalPayment>, RailRejection> {
    let expected = profile
        .messages
        .get("credit_transfer")
        .map(String::as_str)
        .unwrap_or_default();
    let root = parse(bytes)?;
    let doc = document(&root, expected)?;
    let body = doc
        .child("FIToFICstmrCdtTrf")
        .ok_or_else(|| missing("FIToFICstmrCdtTrf"))?;
    let header = body.child("GrpHdr").ok_or_else(|| missing("GrpHdr"))?;
    let message_id = required(header, "MsgId", "GrpHdr/MsgId")?;
    let declared: usize = required(header, "NbOfTxs", "GrpHdr/NbOfTxs")?
        .parse()
        .map_err(|_| invalid("GrpHdr/NbOfTxs", "not a number"))?;
    let transactions: Vec<&Element> = body.children_named("CdtTrfTxInf").collect();
    if transactions.is_empty() || transactions.len() != declared {
        return Err(invalid(
            "GrpHdr/NbOfTxs",
            format!(
                "declares {declared} transactions; the message has {}",
                transactions.len()
            ),
        ));
    }
    transactions
        .into_iter()
        .map(|tx| transaction(tx, message_id, profile))
        .collect()
}

fn transaction(
    tx: &Element,
    message_id: &str,
    profile: &RailProfile,
) -> Result<CanonicalPayment, RailRejection> {
    let end_to_end_id = required(tx, "PmtId/EndToEndId", "PmtId/EndToEndId")?;
    let instruction_id = tx.text_at("PmtId/InstrId").filter(|t| !t.is_empty());
    let uetr = match tx.text_at("PmtId/UETR") {
        Some(u) => Uetr::new(u).map_err(|e| invalid("PmtId/UETR", e))?,
        None if profile.fields.uetr == "required" => return Err(missing("PmtId/UETR")),
        None => derived_uetr(
            &profile.rail,
            message_id,
            end_to_end_id,
            instruction_id.unwrap_or(""),
        )?,
    };
    let amount_node = tx
        .child("IntrBkSttlmAmt")
        .ok_or_else(|| missing("IntrBkSttlmAmt"))?;
    let currency = CurrencyCode::new(amount_node.attr("Ccy").unwrap_or_default())
        .map_err(|e| invalid("IntrBkSttlmAmt/@Ccy", e))?;
    let amount = Amount::parse(
        amount_node.text.trim(),
        currency,
        profile.currency.minor_units,
    )
    .map_err(|e| invalid("IntrBkSttlmAmt", e))?;
    let date = tx
        .text_at("IntrBkSttlmDt")
        .map(Date::parse)
        .transpose()
        .map_err(|e| invalid("IntrBkSttlmDt", e))?;
    let charge_bearer = ChargeBearer::from_code(required(tx, "ChrgBr", "ChrgBr")?)
        .ok_or_else(|| invalid("ChrgBr", "not DEBT, CRED, SHAR or SLEV"))?;
    let remittance = match tx.child("RmtInf") {
        None => Remittance::None,
        Some(r) => match r.text_at("Strd/CdtrRefInf/Ref") {
            Some(reference) => Remittance::Structured {
                creditor_reference: Max35Text::new(reference)
                    .map_err(|e| invalid("RmtInf/Strd", e))?,
            },
            None => Remittance::Unstructured(
                r.children_named("Ustrd")
                    .map(|l| Max140Text::new(l.text.trim()))
                    .collect::<Result<_, _>>()
                    .map_err(|e| invalid("RmtInf/Ustrd", e))?,
            ),
        },
    };
    let mut intermediaries = Vec::new();
    for name in ["IntrmyAgt1", "IntrmyAgt2", "IntrmyAgt3"] {
        if let Some(node) = tx.child(name) {
            intermediaries.push(agent(Some(node), "IntrmyAgt")?);
        }
    }
    Ok(CanonicalPayment {
        uetr,
        end_to_end_id: Max35Text::new(end_to_end_id).map_err(|e| invalid("PmtId/EndToEndId", e))?,
        instruction_id: instruction_id
            .map(Max35Text::new)
            .transpose()
            .map_err(|e| invalid("PmtId/InstrId", e))?,
        message_id: Max35Text::new(message_id).map_err(|e| invalid("GrpHdr/MsgId", e))?,
        rail: profile.rail.clone(),
        profile_version: profile.version.clone(),
        direction: Direction::Inbound,
        settlement: Settlement { amount, date },
        charge_bearer,
        debtor: party(tx.child("Dbtr"), "Dbtr")?,
        debtor_account: account(tx.child("DbtrAcct"), "DbtrAcct")?,
        debtor_agent: agent(tx.child("DbtrAgt"), "DbtrAgt")?,
        creditor: party(tx.child("Cdtr"), "Cdtr")?,
        creditor_account: account(tx.child("CdtrAcct"), "CdtrAcct")?,
        creditor_agent: agent(tx.child("CdtrAgt"), "CdtrAgt")?,
        intermediaries,
        purpose: tx.text_at("Purp/Cd").map(str::to_owned),
        remittance,
    })
}

fn write_party(w: &mut Writer, tag: &'static str, party: &Party) {
    w.open(tag, &[]);
    w.leaf("Nm", &[], party.name.as_str());
    if let Some(a) = &party.postal_address {
        w.open("PstlAdr", &[]);
        if let Some(v) = &a.street_name {
            w.leaf("StrtNm", &[], v.as_str());
        }
        if let Some(v) = &a.building_number {
            w.leaf("BldgNb", &[], v.as_str());
        }
        if let Some(v) = &a.post_code {
            w.leaf("PstCd", &[], v.as_str());
        }
        if let Some(v) = &a.town_name {
            w.leaf("TwnNm", &[], v.as_str());
        }
        if let Some(v) = &a.country {
            w.leaf("Ctry", &[], v.as_str());
        }
        for line in &a.address_lines {
            w.leaf("AdrLine", &[], line.as_str());
        }
        w.close();
    }
    if let Some(lei) = &party.lei {
        w.open("Id", &[]);
        w.open("OrgId", &[]);
        w.leaf("LEI", &[], lei.as_str());
        w.close();
        w.close();
    }
    if let Some(c) = &party.country_of_residence {
        w.leaf("CtryOfRes", &[], c.as_str());
    }
    w.close();
}

fn write_account(w: &mut Writer, tag: &'static str, account: &AccountRef) {
    w.open(tag, &[]);
    w.open("Id", &[]);
    match account {
        AccountRef::Iban(iban) => w.leaf("IBAN", &[], iban.as_str()),
        AccountRef::Aan(aan) => {
            w.open("Othr", &[]);
            w.leaf("Id", &[], aan.as_str());
            w.open("SchmeNm", &[]);
            w.leaf("Prtry", &[], "AAN");
            w.close();
            w.close();
        }
        AccountRef::Other { scheme, id } => {
            w.open("Othr", &[]);
            w.leaf("Id", &[], id.as_str());
            w.open("SchmeNm", &[]);
            w.leaf("Prtry", &[], scheme.as_str());
            w.close();
            w.close();
        }
        AccountRef::Proxy(proxy) => {
            w.open("Othr", &[]);
            w.leaf("Id", &[], proxy.as_str());
            w.open("SchmeNm", &[]);
            w.leaf("Prtry", &[], "PROXY");
            w.close();
            w.close();
        }
    }
    w.close();
    w.close();
}

fn write_agent(w: &mut Writer, tag: &'static str, agent: &AgentRef) {
    w.open(tag, &[]);
    w.open("FinInstnId", &[]);
    match agent {
        AgentRef::Bic(bic) => w.leaf("BICFI", &[], bic.as_str()),
        AgentRef::ClearingMember { system, member } => {
            w.open("ClrSysMmbId", &[]);
            w.open("ClrSysId", &[]);
            w.leaf("Cd", &[], system.as_str());
            w.close();
            w.leaf("MmbId", &[], member.as_str());
            w.close();
        }
        AgentRef::Lei(lei) => w.leaf("LEI", &[], lei.as_str()),
        AgentRef::Aic(aic) => {
            w.open("Othr", &[]);
            w.leaf("Id", &[], aic.as_str());
            w.close();
        }
    }
    w.close();
    w.close();
}

/// Renders payments that share a `MsgId` as one `pacs.008` in the profile's version.
/// `created_at` is the ISO 8601 creation time; `settlement_method` is e.g. `CLRG` or `INDA`.
pub fn render_pacs008(
    payments: &[CanonicalPayment],
    profile: &RailProfile,
    created_at: &str,
    settlement_method: &str,
) -> Result<String, RailRejection> {
    let first = payments
        .first()
        .ok_or_else(|| invalid("CdtTrfTxInf", "nothing to render"))?;
    if payments.iter().any(|p| p.message_id != first.message_id) {
        return Err(invalid(
            "GrpHdr/MsgId",
            "payments in one message share its MsgId",
        ));
    }
    let version = profile.messages.get("credit_transfer").ok_or_else(|| {
        invalid(
            "Document/@xmlns",
            "the profile names no credit transfer message",
        )
    })?;
    let namespace = format!("{NAMESPACE}{version}");
    let exponent = profile.currency.minor_units;
    let mut w = Writer::new();
    w.open("Document", &[("xmlns", &namespace)]);
    w.open("FIToFICstmrCdtTrf", &[]);
    w.open("GrpHdr", &[]);
    w.leaf("MsgId", &[], first.message_id.as_str());
    w.leaf("CreDtTm", &[], created_at);
    w.leaf("NbOfTxs", &[], &payments.len().to_string());
    w.open("SttlmInf", &[]);
    w.leaf("SttlmMtd", &[], settlement_method);
    w.close();
    w.close();
    for p in payments {
        w.open("CdtTrfTxInf", &[]);
        w.open("PmtId", &[]);
        if let Some(id) = &p.instruction_id {
            w.leaf("InstrId", &[], id.as_str());
        }
        w.leaf("EndToEndId", &[], p.end_to_end_id.as_str());
        w.leaf("UETR", &[], p.uetr.as_str());
        w.close();
        w.leaf(
            "IntrBkSttlmAmt",
            &[("Ccy", p.settlement.amount.currency.as_str())],
            &p.settlement.amount.render(exponent),
        );
        if let Some(date) = p.settlement.date {
            w.leaf("IntrBkSttlmDt", &[], &date.to_string());
        }
        w.leaf("ChrgBr", &[], p.charge_bearer.code());
        for (tag, agent) in ["IntrmyAgt1", "IntrmyAgt2", "IntrmyAgt3"]
            .into_iter()
            .zip(&p.intermediaries)
        {
            write_agent(&mut w, tag, agent);
        }
        write_party(&mut w, "Dbtr", &p.debtor);
        write_account(&mut w, "DbtrAcct", &p.debtor_account);
        write_agent(&mut w, "DbtrAgt", &p.debtor_agent);
        write_agent(&mut w, "CdtrAgt", &p.creditor_agent);
        write_party(&mut w, "Cdtr", &p.creditor);
        write_account(&mut w, "CdtrAcct", &p.creditor_account);
        if let Some(purpose) = &p.purpose {
            w.open("Purp", &[]);
            w.leaf("Cd", &[], purpose);
            w.close();
        }
        match &p.remittance {
            Remittance::None => {}
            Remittance::Unstructured(lines) => {
                w.open("RmtInf", &[]);
                for line in lines {
                    w.leaf("Ustrd", &[], line.as_str());
                }
                w.close();
            }
            Remittance::Structured { creditor_reference } => {
                w.open("RmtInf", &[]);
                w.open("Strd", &[]);
                w.open("CdtrRefInf", &[]);
                w.leaf("Ref", &[], creditor_reference.as_str());
                w.close();
                w.close();
                w.close();
            }
        }
        w.close();
    }
    Ok(w.finish())
}
