//! Payment URIs (spec Section 41): `aletheia:alt:…?asset=AEY&amount=125.000000000000000000&memo=…`.
//! The amount is the decimal display form with exactly the asset's decimals or fewer; it is
//! converted to base units exactly or refused.

use aletheia_core::{Address, AssetId, NetworkKind};

use crate::WalletError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentUri {
    pub recipient: Address,
    pub asset: AssetId,
    /// Base units.
    pub amount: Option<u128>,
    pub memo: Option<String>,
}

/// Display decimals of an asset (Section 18.3): AEY 18, ALnT 3 (1 ALnT = 1,000 Mites). Other
/// assets are written in base units.
pub fn asset_decimals(asset: AssetId) -> u8 {
    match asset {
        AssetId::AEY => 18,
        AssetId::ALNT => 3,
        _ => 0,
    }
}

/// `"125.5"` with 18 decimals → base units, exactly.
pub fn parse_amount(text: &str, decimals: u8) -> Result<u128, WalletError> {
    let bad = || {
        WalletError(format!(
            "\"{text}\" is not an amount with at most {decimals} decimals"
        ))
    };
    let (whole, fraction) = text.split_once('.').unwrap_or((text, ""));
    if whole.is_empty()
        || !whole.bytes().all(|b| b.is_ascii_digit())
        || !fraction.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(bad());
    }
    if fraction.len() > usize::from(decimals) || (text.contains('.') && fraction.is_empty()) {
        return Err(bad());
    }
    let scale = 10u128.checked_pow(u32::from(decimals)).ok_or_else(bad)?;
    let pad = 10u128
        .checked_pow(
            u32::from(decimals).saturating_sub(u32::try_from(fraction.len()).unwrap_or(u32::MAX)),
        )
        .ok_or_else(bad)?;
    let whole: u128 = whole.parse().map_err(|_| bad())?;
    let fraction: u128 = if fraction.is_empty() {
        0
    } else {
        fraction.parse().map_err(|_| bad())?
    };
    whole
        .checked_mul(scale)
        .and_then(|w| fraction.checked_mul(pad).and_then(|f| w.checked_add(f)))
        .ok_or_else(bad)
}

/// Base units → `"125.500000000000000000"`.
pub fn format_amount(amount: u128, decimals: u8) -> String {
    let scale = 10u128.checked_pow(u32::from(decimals)).unwrap_or(1);
    format!(
        "{}.{:0width$}",
        amount.checked_div(scale).unwrap_or(0),
        amount.checked_rem(scale).unwrap_or(0),
        width = usize::from(decimals)
    )
}

fn asset_name(asset: AssetId) -> String {
    match asset {
        AssetId::AEY => "AEY".to_owned(),
        AssetId::ALNT => "ALnT".to_owned(),
        other => other.get().to_string(),
    }
}

fn parse_asset(text: &str) -> Result<AssetId, WalletError> {
    match text {
        "AEY" => Ok(AssetId::AEY),
        "ALnT" => Ok(AssetId::ALNT),
        other => other
            .parse::<u32>()
            .map(AssetId::new)
            .map_err(|_| WalletError(format!("\"{other}\" is not an asset"))),
    }
}

fn encode(text: &str) -> String {
    text.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                char::from(b).to_string()
            }
            other => format!("%{other:02X}"),
        })
        .collect()
}

fn decode(text: &str) -> Result<String, WalletError> {
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut i = 0usize;
    while let Some(&b) = bytes.get(i) {
        if b == b'%' {
            let hex = bytes
                .get(i.saturating_add(1)..i.saturating_add(3))
                .and_then(|h| core::str::from_utf8(h).ok())
                .and_then(|h| u8::from_str_radix(h, 16).ok())
                .ok_or_else(|| WalletError("a malformed %-escape in the URI".to_owned()))?;
            out.push(hex);
            i = i.saturating_add(3);
        } else {
            out.push(b);
            i = i.saturating_add(1);
        }
    }
    String::from_utf8(out).map_err(|_| WalletError("the URI is not UTF-8".to_owned()))
}

impl PaymentUri {
    pub fn format(&self, network: NetworkKind, decimals: u8) -> String {
        let mut out = format!(
            "aletheia:{}?asset={}",
            self.recipient.to_text(network),
            asset_name(self.asset)
        );
        if let Some(amount) = self.amount {
            out.push_str(&format!("&amount={}", format_amount(amount, decimals)));
        }
        if let Some(memo) = &self.memo {
            out.push_str(&format!("&memo={}", encode(memo)));
        }
        out
    }

    /// Parses a URI for `network`: a recipient of another network is refused (the address
    /// checksum carries the network).
    pub fn parse(
        text: &str,
        network: NetworkKind,
        decimals: u8,
    ) -> Result<PaymentUri, WalletError> {
        let rest = text
            .strip_prefix("aletheia:")
            .ok_or_else(|| WalletError("a payment URI starts with \"aletheia:\"".to_owned()))?;
        let (address, query) = rest.split_once('?').unwrap_or((rest, ""));
        let recipient = Address::parse(address, network)
            .map_err(|e| WalletError(format!("recipient: {}", e.detail())))?;
        let mut uri = PaymentUri {
            recipient,
            asset: AssetId::AEY,
            amount: None,
            memo: None,
        };
        for pair in query.split('&').filter(|p| !p.is_empty()) {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            let value = decode(value)?;
            match key {
                "asset" => uri.asset = parse_asset(&value)?,
                "amount" => uri.amount = Some(parse_amount(&value, decimals)?),
                "memo" => uri.memo = Some(value),
                other => return Err(WalletError(format!("unknown URI parameter \"{other}\""))),
            }
        }
        Ok(uri)
    }
}
