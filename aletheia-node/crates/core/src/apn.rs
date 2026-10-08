//! Aletheia Payment Network: identifiers and on-chain payloads (spec Sections 40B, 40D.5).
//!
//! ```text
//! 128 Payment         129 BatchPayment     137 PaymentReturn    138 RecallRequest
//! 139 RecallResponse  140 MessageAnchor    141 AanAssign        142 ProxyRegister
//! 143 ProxyRemove
//! ```
//!
//! AIC (institution code, 8 or 11 characters, BIC-shaped) and AAN (account number, `ALX` +
//! 2 check digits + 16 digits, ISO 7064 MOD 97-10) are validated here because consensus
//! checks them.

use crate::ace::{AceDecode, AceEncode, AceReader, AceWriter};
use crate::address::Address;
use crate::error::AletheiaError;
use crate::error_codes::ErrorCode;
use crate::network::{DomainTag, NetworkIdentity};
use crate::types::Hash32;

pub const MAX_BATCH_LEGS: u32 = 1_000;

fn bad(code: ErrorCode, detail: String) -> AletheiaError {
    AletheiaError::new(code, detail)
}

/// Aletheia Institution Code: `AAAA CC LL [BBB]`, upper-case letters and digits, 8 or 11
/// characters; stored as 11 (an 8-character code is the same as with branch `XXX`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Aic([u8; 11]);

impl Aic {
    pub fn parse(text: &str) -> Result<Aic, AletheiaError> {
        let bytes = text.as_bytes();
        let shape_ok = matches!(bytes.len(), 8 | 11)
            && bytes
                .iter()
                .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
            && bytes
                .get(..4)
                .is_some_and(|i| i.iter().all(u8::is_ascii_uppercase))
            && bytes
                .get(4..6)
                .is_some_and(|c| c.iter().all(u8::is_ascii_uppercase));
        if !shape_ok {
            return Err(bad(
                ErrorCode::ApnAicMalformed,
                format!(
                    "\"{text}\" is not an AIC (4 letters, 2-letter territory, 2 location characters, optional 3-character branch)"
                ),
            ));
        }
        let mut raw = *b"XXXXXXXXXXX";
        if let Some(target) = raw.get_mut(..bytes.len()) {
            target.copy_from_slice(bytes);
        }
        Ok(Aic(raw))
    }

    pub fn as_bytes(&self) -> &[u8; 11] {
        &self.0
    }

    pub fn text(&self) -> String {
        String::from_utf8_lossy(&self.0).into_owned()
    }
}

impl AceEncode for Aic {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.0);
    }
}

impl AceDecode for Aic {
    fn decode(input: &mut AceReader<'_>) -> Result<Aic, AletheiaError> {
        let raw: [u8; 11] = input.array()?;
        let text = core::str::from_utf8(&raw)
            .map_err(|_| bad(ErrorCode::ApnAicMalformed, "AIC is not ASCII".to_owned()))?;
        let parsed = Aic::parse(text)?;
        if parsed.0 != raw {
            return Err(bad(
                ErrorCode::DecodeNonCanonical,
                "AIC is not in its 11-character form".to_owned(),
            ));
        }
        Ok(parsed)
    }
}

/// Aletheia Account Number, electronic form (21 ASCII bytes): `ALX` + 2 check digits + 16
/// digits whose first four are the participant's routing code (Section 40B.3.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Aan([u8; 21]);

/// ISO 7064 MOD 97-10 over the rearranged number, digit by digit (IBAN arithmetic): the
/// first five characters move to the end and letters become two digits (A = 10 … Z = 35).
fn mod97(aan: &[u8]) -> u32 {
    aan.get(5..)
        .unwrap_or_default()
        .iter()
        .chain(aan.get(..5).unwrap_or_default())
        .fold(0u32, |rem, &c| {
            if c.is_ascii_digit() {
                rem.saturating_mul(10)
                    .saturating_add(u32::from(c.saturating_sub(b'0')))
                    .checked_rem(97)
                    .unwrap_or(0)
            } else {
                rem.saturating_mul(100)
                    .saturating_add(u32::from(c.saturating_sub(b'A')))
                    .saturating_add(10)
                    .checked_rem(97)
                    .unwrap_or(0)
            }
        })
}

impl Aan {
    /// Accepts spaces (people paste grouped numbers); nothing else is forgiven.
    pub fn parse(input: &str) -> Result<Aan, AletheiaError> {
        let compact: Vec<u8> = input.bytes().filter(|b| *b != b' ').collect();
        let shape_ok = compact.len() == 21
            && compact.get(..3) == Some(&b"ALX"[..])
            && compact
                .get(3..)
                .is_some_and(|d| d.iter().all(u8::is_ascii_digit));
        if !shape_ok {
            return Err(bad(
                ErrorCode::ApnAanMalformed,
                format!("\"{input}\" is not an AAN (expected ALX + 18 digits)"),
            ));
        }
        if mod97(&compact) != 1 {
            return Err(bad(
                ErrorCode::ApnAanCheckDigits,
                format!(
                    "the check digits of {} do not match",
                    String::from_utf8_lossy(&compact)
                ),
            ));
        }
        let mut raw = [0u8; 21];
        raw.copy_from_slice(&compact);
        Ok(Aan(raw))
    }

    /// The AAN for a 16-digit account body, with its check digits computed.
    pub fn from_body(body: &[u8; 16]) -> Result<Aan, AletheiaError> {
        if !body.iter().all(u8::is_ascii_digit) {
            return Err(bad(
                ErrorCode::ApnAanMalformed,
                "an account body is 16 digits".to_owned(),
            ));
        }
        let mut raw = [0u8; 21];
        raw[..3].copy_from_slice(b"ALX");
        raw[3..5].copy_from_slice(b"00");
        raw[5..].copy_from_slice(body);
        let check = 98u32.saturating_sub(mod97(&raw));
        raw[3] = b'0'.saturating_add(u8::try_from(check.checked_div(10).unwrap_or(0)).unwrap_or(0));
        raw[4] = b'0'.saturating_add(u8::try_from(check.checked_rem(10).unwrap_or(0)).unwrap_or(0));
        Ok(Aan(raw))
    }

    /// The first four digits of the account body: which participant's range it is in.
    pub fn routing_code(&self) -> u16 {
        self.0[5..9].iter().fold(0u16, |acc, d| {
            acc.saturating_mul(10)
                .saturating_add(u16::from(d.saturating_sub(b'0')))
        })
    }

    pub fn as_str(&self) -> &str {
        core::str::from_utf8(&self.0).unwrap_or("")
    }

    /// Printed form: groups of four after the prefix.
    pub fn display(&self) -> String {
        let s = self.as_str();
        let (head, rest) = s.split_at(5.min(s.len()));
        let mut out = format!(
            "{} {}",
            head.get(..3).unwrap_or(""),
            head.get(3..).unwrap_or("")
        );
        for chunk in rest.as_bytes().chunks(4) {
            out.push(' ');
            out.push_str(core::str::from_utf8(chunk).unwrap_or(""));
        }
        out
    }
}

impl AceEncode for Aan {
    fn encode(&self, out: &mut AceWriter) {
        out.fixed(&self.0);
    }
}

impl AceDecode for Aan {
    fn decode(input: &mut AceReader<'_>) -> Result<Aan, AletheiaError> {
        let raw: [u8; 21] = input.array()?;
        Aan::parse(
            core::str::from_utf8(&raw)
                .map_err(|_| bad(ErrorCode::ApnAanMalformed, "AAN is not ASCII".to_owned()))?,
        )
    }
}

/// One credit in a payment: the payment's on-chain fields (Section 40B.7).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PaymentLeg {
    pub creditor: Address,
    pub amount: u128,
    pub creditor_agent: Aic,
    pub uetr_hash: Hash32,
    pub remittance_hash: Hash32,
}

impl AceEncode for PaymentLeg {
    fn encode(&self, out: &mut AceWriter) {
        self.creditor.encode(out);
        out.u128(self.amount);
        self.creditor_agent.encode(out);
        self.uetr_hash.encode(out);
        self.remittance_hash.encode(out);
    }
}

impl AceDecode for PaymentLeg {
    fn decode(input: &mut AceReader<'_>) -> Result<PaymentLeg, AletheiaError> {
        Ok(PaymentLeg {
            creditor: Address::decode(input)?,
            amount: input.u128()?,
            creditor_agent: Aic::decode(input)?,
            uetr_hash: Hash32::decode(input)?,
            remittance_hash: Hash32::decode(input)?,
        })
    }
}

/// Identifies an earlier payment leg: what the de-duplication key covers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PaymentRef {
    pub debtor_agent: Aic,
    pub uetr_hash: Hash32,
    pub leg: u8,
}

impl AceEncode for PaymentRef {
    fn encode(&self, out: &mut AceWriter) {
        self.debtor_agent.encode(out);
        self.uetr_hash.encode(out);
        out.u8(self.leg);
    }
}

impl AceDecode for PaymentRef {
    fn decode(input: &mut AceReader<'_>) -> Result<PaymentRef, AletheiaError> {
        Ok(PaymentRef {
            debtor_agent: Aic::decode(input)?,
            uetr_hash: Hash32::decode(input)?,
            leg: input.u8()?,
        })
    }
}

impl PaymentRef {
    /// `H_domain("ALETHEIA/PAYDEDUP/v1", debtor_agent_aic ‖ uetr_hash ‖ leg u8)` (40D.5).
    pub fn dedup_key(&self, network: &NetworkIdentity) -> Hash32 {
        let mut out = AceWriter::new();
        self.encode(&mut out);
        network.domain_hash(DomainTag::PaymentDedup, out.as_bytes())
    }
}

/// A participant's role (Section 40B.2).
pub mod role {
    pub const DIRECT_PARTICIPANT: u8 = 1;
    pub const INDIRECT_PARTICIPANT: u8 = 2;
    pub const GATEWAY_OPERATOR: u8 = 3;
    pub const EXTERNAL_RAIL_OPERATOR: u8 = 4;
    pub const FX_PROVIDER: u8 = 5;
    pub const GOVERNMENT_AGENCY: u8 = 6;
    pub const LIQUIDITY_PROVIDER: u8 = 7;
    pub const TECHNICAL_SERVICE_PROVIDER: u8 = 8;
}

/// A participant's status (Section 40B.2).
pub mod status {
    pub const APPLIED: u8 = 1;
    pub const CERTIFIED: u8 = 2;
    pub const ACTIVE: u8 = 3;
    pub const SUSPENDED: u8 = 4;
    pub const TERMINATED: u8 = 5;
}

/// A messaging key with its validity window.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessagingKey {
    pub alg: u8,
    pub public_key: Vec<u8>,
    pub valid_from_epoch: u64,
    pub valid_to_epoch: u64,
}

impl AceEncode for MessagingKey {
    fn encode(&self, out: &mut AceWriter) {
        out.u8(self.alg);
        out.bytes(&self.public_key);
        out.u64(self.valid_from_epoch);
        out.u64(self.valid_to_epoch);
    }
}

impl AceDecode for MessagingKey {
    fn decode(input: &mut AceReader<'_>) -> Result<MessagingKey, AletheiaError> {
        Ok(MessagingKey {
            alg: input.u8()?,
            public_key: input.bytes(64)?.to_vec(),
            valid_from_epoch: input.u64()?,
            valid_to_epoch: input.u64()?,
        })
    }
}

/// Per-payment and daily limits in AEY base units.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limits {
    pub per_payment_max: u128,
    pub daily_out_max: u128,
    pub daily_in_max: u128,
}

impl AceEncode for Limits {
    fn encode(&self, out: &mut AceWriter) {
        out.u128(self.per_payment_max);
        out.u128(self.daily_out_max);
        out.u128(self.daily_in_max);
    }
}

impl AceDecode for Limits {
    fn decode(input: &mut AceReader<'_>) -> Result<Limits, AletheiaError> {
        Ok(Limits {
            per_payment_max: input.u128()?,
            daily_out_max: input.u128()?,
            daily_in_max: input.u128()?,
        })
    }
}

/// A participant as governance approves it (Section 40B.2). The legal record stays off
/// chain; `legal_name_hash` commits to it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParticipantSpec {
    pub aic: Aic,
    pub legal_name_hash: Hash32,
    pub lei: Option<[u8; 20]>,
    pub bic: Option<[u8; 11]>,
    pub role: u8,
    pub sponsor: Option<Aic>,
    pub settlement_address: Address,
    /// First four digits of the AANs this participant may assign.
    pub routing_code: u16,
    pub messaging_keys: Vec<MessagingKey>,
    /// Bit `n` set: certified for APN scheme `n`.
    pub schemes: u32,
    pub limits: Limits,
}

impl AceEncode for ParticipantSpec {
    fn encode(&self, out: &mut AceWriter) {
        self.aic.encode(out);
        self.legal_name_hash.encode(out);
        out.option(self.lei.as_ref());
        out.option(self.bic.as_ref());
        out.u8(self.role);
        out.option(self.sponsor.as_ref());
        self.settlement_address.encode(out);
        out.u16(self.routing_code);
        out.list(&self.messaging_keys);
        out.u32(self.schemes);
        self.limits.encode(out);
    }
}

impl AceDecode for ParticipantSpec {
    fn decode(input: &mut AceReader<'_>) -> Result<ParticipantSpec, AletheiaError> {
        Ok(ParticipantSpec {
            aic: Aic::decode(input)?,
            legal_name_hash: Hash32::decode(input)?,
            lei: input.option()?,
            bic: input.option()?,
            role: input.u8()?,
            sponsor: input.option()?,
            settlement_address: Address::decode(input)?,
            routing_code: input.u16()?,
            messaging_keys: input.list(8)?,
            schemes: input.u32()?,
            limits: Limits::decode(input)?,
        })
    }
}

/// How often a mandate may be debited (Section 40B.7). Periods are calendar periods of the
/// UTC day of protocol time.
pub mod frequency {
    pub const ONCE: u8 = 0;
    pub const WEEKLY: u8 = 1;
    pub const MONTHLY: u8 = 2;
    pub const QUARTERLY: u8 = 3;
    pub const YEARLY: u8 = 4;
    pub const ON_DEMAND: u8 = 5;
}

/// The id of a payment request: `H_domain("ALETHEIA/APN-REQUEST/v1", payee ‖ nonce)`.
pub fn request_id(network: &NetworkIdentity, payee: &Address, nonce: u64) -> Hash32 {
    let mut out = AceWriter::new();
    payee.encode(&mut out);
    out.u64(nonce);
    network.domain_hash(DomainTag::PaymentRequest, out.as_bytes())
}

/// The id of a mandate: `H_domain("ALETHEIA/APN-MANDATE/v1", debtor ‖ nonce)`. The debtor's
/// signature on the creating transaction is the mandate's signature.
pub fn mandate_id(network: &NetworkIdentity, debtor: &Address, nonce: u64) -> Hash32 {
    let mut out = AceWriter::new();
    debtor.encode(&mut out);
    out.u64(nonce);
    network.domain_hash(DomainTag::Mandate, out.as_bytes())
}

/// The id of a scheduled payment: `H_domain("ALETHEIA/APN-SCHEDULE/v1", debtor ‖ nonce)`.
pub fn schedule_id(network: &NetworkIdentity, debtor: &Address, nonce: u64) -> Hash32 {
    let mut out = AceWriter::new();
    debtor.encode(&mut out);
    out.u64(nonce);
    network.domain_hash(DomainTag::ScheduledPayment, out.as_bytes())
}

/// The Monetary Authority's standing authorization for a gateway to mint AEY against
/// confirmed inbound credits on partner nostro accounts, up to `max_total` over its life
/// (Section 40C.7, R2). Signed once by M of N authority keys; every inbound credit carries it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StandingAuthorization {
    pub authorization_id: Hash32,
    pub gateway: Aic,
    pub max_total: u128,
    pub valid_until_epoch: u64,
    pub signatures: Vec<crate::monetary::IndexedSignature>,
}

impl StandingAuthorization {
    fn encode_fields(&self, out: &mut AceWriter) {
        self.authorization_id.encode(out);
        self.gateway.encode(out);
        out.u128(self.max_total);
        out.u64(self.valid_until_epoch);
    }

    /// What each authority key signs.
    pub fn digest(&self, network: &NetworkIdentity) -> Hash32 {
        let mut out = AceWriter::new();
        self.encode_fields(&mut out);
        network.domain_hash(DomainTag::StandingAuthorization, out.as_bytes())
    }
}

impl AceEncode for StandingAuthorization {
    fn encode(&self, out: &mut AceWriter) {
        self.encode_fields(out);
        out.list(&self.signatures);
    }
}

impl AceDecode for StandingAuthorization {
    fn decode(input: &mut AceReader<'_>) -> Result<StandingAuthorization, AletheiaError> {
        Ok(StandingAuthorization {
            authorization_id: Hash32::decode(input)?,
            gateway: Aic::decode(input)?,
            max_total: input.u128()?,
            valid_until_epoch: input.u64()?,
            signatures: crate::monetary::decode_signatures(input)?,
        })
    }
}

/// APN payloads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApnOp {
    /// 128: one credit transfer from the sender (the debtor).
    Payment {
        debtor_agent: Aic,
        leg: PaymentLeg,
        purpose: [u8; 4],
        scheme: u8,
    },
    /// 129: up to 1,000 credits from one debtor; `atomic` reverts all on any failure,
    /// otherwise failing legs are skipped and reported.
    BatchPayment {
        debtor_agent: Aic,
        legs: Vec<PaymentLeg>,
        purpose: [u8; 4],
        atomic: bool,
    },
    /// 130: the payee (sender) asks `payer` to pay; settles only when the payer accepts.
    PaymentRequest {
        payer: Address,
        amount: u128,
        creditor_agent: Aic,
        uetr_hash: Hash32,
        remittance_hash: Hash32,
        expires_day: u64,
    },
    /// 131: the payer answers; accepting pays the request as a credit transfer through
    /// `debtor_agent`.
    PaymentRequestResponse {
        request_id: Hash32,
        accept: bool,
        debtor_agent: Aic,
    },
    /// 132: the debtor (sender) authorizes `creditor` to debit it, within limits.
    MandateCreate {
        creditor: Address,
        creditor_agent: Aic,
        debtor_agent: Aic,
        max_amount: u128,
        frequency: u8,
        first_day: u64,
        final_day: u64,
    },
    /// 133: the debtor changes the maximum, the final day, or suspends or resumes.
    MandateAmend {
        mandate_id: Hash32,
        max_amount: u128,
        final_day: u64,
        suspended: bool,
    },
    /// 134: the debtor or the creditor ends the mandate for good.
    MandateCancel { mandate_id: Hash32 },
    /// 135: the creditor (sender) collects under a mandate.
    DirectDebit {
        mandate_id: Hash32,
        amount: u128,
        uetr_hash: Hash32,
        remittance_hash: Hash32,
    },
    /// 136: the debtor (sender) schedules a credit transfer; the protocol executes it on
    /// `execute_day` (a future UTC day of protocol time) if it passes every payment check.
    ScheduledPayment {
        debtor_agent: Aic,
        leg: PaymentLeg,
        purpose: [u8; 4],
        execute_day: u64,
    },
    /// 137: the original creditor (the sender) sends money back, linked to the original.
    PaymentReturn {
        original: PaymentRef,
        amount: u128,
        reason: [u8; 4],
    },
    /// 138: the original debtor asks for its money back; finality stands.
    RecallRequest {
        original: PaymentRef,
        reason: [u8; 4],
    },
    /// 139: the original creditor answers; accepting returns the full amount.
    RecallResponse {
        original: PaymentRef,
        accept: bool,
        reason: [u8; 4],
    },
    /// 140: a participant anchors a batch of APN message envelope hashes.
    MessageAnchor {
        batch_id: Hash32,
        merkle_root: Hash32,
        count: u32,
    },
    /// 141: a participant assigns an account number in its routing range.
    AanAssign { aan: Aan, address: Address },
    /// 142: a participant registers a proxy alias: `H(salt ‖ normalized alias)` → address.
    ProxyRegister { proxy: Hash32, address: Address },
    /// 143: the registering participant removes a proxy alias.
    ProxyRemove { proxy: Hash32 },
    /// 144: a participant (the sender's settlement account) moves AEY into escrow for a
    /// payment leaving on an external rail through `gateway`.
    ExternalLegLock {
        leg_id: Hash32,
        amount: u128,
        uetr_hash: Hash32,
        rail: u16,
        profile_hash: Hash32,
        gateway: Aic,
        expiry_day: u64,
    },
    /// 145: the gateway reports definitive external acceptance; the escrow is burned as a
    /// redemption against the partner nostro.
    ExternalLegSettle { leg_id: Hash32, msg_id_hash: Hash32 },
    /// 146: the gateway reports definitive rejection (or a confirmed not-settled
    /// investigation); the escrow returns to the sender.
    ExternalLegRelease { leg_id: Hash32, reason: [u8; 4] },
    /// 147: the gateway mints AEY to a creditor against a confirmed inbound credit.
    ExternalInboundCredit {
        rail: u16,
        uetr_hash: Hash32,
        msg_id_hash: Hash32,
        amount: u128,
        creditor: Address,
        creditor_agent: Aic,
        standing: StandingAuthorization,
    },
}

impl ApnOp {
    pub const TX_TYPES: [u16; 20] = [
        128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145,
        146, 147,
    ];

    pub const fn tx_type(&self) -> u16 {
        match self {
            ApnOp::Payment { .. } => 128,
            ApnOp::BatchPayment { .. } => 129,
            ApnOp::PaymentRequest { .. } => 130,
            ApnOp::PaymentRequestResponse { .. } => 131,
            ApnOp::MandateCreate { .. } => 132,
            ApnOp::MandateAmend { .. } => 133,
            ApnOp::MandateCancel { .. } => 134,
            ApnOp::DirectDebit { .. } => 135,
            ApnOp::ScheduledPayment { .. } => 136,
            ApnOp::PaymentReturn { .. } => 137,
            ApnOp::RecallRequest { .. } => 138,
            ApnOp::RecallResponse { .. } => 139,
            ApnOp::MessageAnchor { .. } => 140,
            ApnOp::AanAssign { .. } => 141,
            ApnOp::ProxyRegister { .. } => 142,
            ApnOp::ProxyRemove { .. } => 143,
            ApnOp::ExternalLegLock { .. } => 144,
            ApnOp::ExternalLegSettle { .. } => 145,
            ApnOp::ExternalLegRelease { .. } => 146,
            ApnOp::ExternalInboundCredit { .. } => 147,
        }
    }

    pub fn encode_content(&self, out: &mut AceWriter) {
        match self {
            ApnOp::Payment {
                debtor_agent,
                leg,
                purpose,
                scheme,
            } => {
                debtor_agent.encode(out);
                leg.encode(out);
                out.fixed(purpose);
                out.u8(*scheme);
            }
            ApnOp::BatchPayment {
                debtor_agent,
                legs,
                purpose,
                atomic,
            } => {
                debtor_agent.encode(out);
                out.list(legs);
                out.fixed(purpose);
                out.bool(*atomic);
            }
            ApnOp::PaymentRequest {
                payer,
                amount,
                creditor_agent,
                uetr_hash,
                remittance_hash,
                expires_day,
            } => {
                payer.encode(out);
                out.u128(*amount);
                creditor_agent.encode(out);
                uetr_hash.encode(out);
                remittance_hash.encode(out);
                out.u64(*expires_day);
            }
            ApnOp::PaymentRequestResponse {
                request_id,
                accept,
                debtor_agent,
            } => {
                request_id.encode(out);
                out.bool(*accept);
                debtor_agent.encode(out);
            }
            ApnOp::MandateCreate {
                creditor,
                creditor_agent,
                debtor_agent,
                max_amount,
                frequency,
                first_day,
                final_day,
            } => {
                creditor.encode(out);
                creditor_agent.encode(out);
                debtor_agent.encode(out);
                out.u128(*max_amount);
                out.u8(*frequency);
                out.u64(*first_day);
                out.u64(*final_day);
            }
            ApnOp::MandateAmend {
                mandate_id,
                max_amount,
                final_day,
                suspended,
            } => {
                mandate_id.encode(out);
                out.u128(*max_amount);
                out.u64(*final_day);
                out.bool(*suspended);
            }
            ApnOp::MandateCancel { mandate_id } => mandate_id.encode(out),
            ApnOp::DirectDebit {
                mandate_id,
                amount,
                uetr_hash,
                remittance_hash,
            } => {
                mandate_id.encode(out);
                out.u128(*amount);
                uetr_hash.encode(out);
                remittance_hash.encode(out);
            }
            ApnOp::ScheduledPayment {
                debtor_agent,
                leg,
                purpose,
                execute_day,
            } => {
                debtor_agent.encode(out);
                leg.encode(out);
                out.fixed(purpose);
                out.u64(*execute_day);
            }
            ApnOp::PaymentReturn {
                original,
                amount,
                reason,
            } => {
                original.encode(out);
                out.u128(*amount);
                out.fixed(reason);
            }
            ApnOp::RecallRequest { original, reason } => {
                original.encode(out);
                out.fixed(reason);
            }
            ApnOp::RecallResponse {
                original,
                accept,
                reason,
            } => {
                original.encode(out);
                out.bool(*accept);
                out.fixed(reason);
            }
            ApnOp::MessageAnchor {
                batch_id,
                merkle_root,
                count,
            } => {
                batch_id.encode(out);
                merkle_root.encode(out);
                out.u32(*count);
            }
            ApnOp::AanAssign { aan, address } => {
                aan.encode(out);
                address.encode(out);
            }
            ApnOp::ProxyRegister { proxy, address } => {
                proxy.encode(out);
                address.encode(out);
            }
            ApnOp::ProxyRemove { proxy } => proxy.encode(out),
            ApnOp::ExternalLegLock {
                leg_id,
                amount,
                uetr_hash,
                rail,
                profile_hash,
                gateway,
                expiry_day,
            } => {
                leg_id.encode(out);
                out.u128(*amount);
                uetr_hash.encode(out);
                out.u16(*rail);
                profile_hash.encode(out);
                gateway.encode(out);
                out.u64(*expiry_day);
            }
            ApnOp::ExternalLegSettle {
                leg_id,
                msg_id_hash,
            } => {
                leg_id.encode(out);
                msg_id_hash.encode(out);
            }
            ApnOp::ExternalLegRelease { leg_id, reason } => {
                leg_id.encode(out);
                out.fixed(reason);
            }
            ApnOp::ExternalInboundCredit {
                rail,
                uetr_hash,
                msg_id_hash,
                amount,
                creditor,
                creditor_agent,
                standing,
            } => {
                out.u16(*rail);
                uetr_hash.encode(out);
                msg_id_hash.encode(out);
                out.u128(*amount);
                creditor.encode(out);
                creditor_agent.encode(out);
                standing.encode(out);
            }
        }
    }

    pub fn decode_content(
        tx_type: u16,
        input: &mut AceReader<'_>,
    ) -> Option<Result<ApnOp, AletheiaError>> {
        let op = || -> Result<ApnOp, AletheiaError> {
            Ok(match tx_type {
                128 => ApnOp::Payment {
                    debtor_agent: Aic::decode(input)?,
                    leg: PaymentLeg::decode(input)?,
                    purpose: input.array()?,
                    scheme: input.u8()?,
                },
                129 => {
                    let debtor_agent = Aic::decode(input)?;
                    let legs: Vec<PaymentLeg> = input.list(MAX_BATCH_LEGS)?;
                    if legs.is_empty() {
                        return Err(bad(
                            ErrorCode::TxFieldOutOfRange,
                            "a batch payment has at least one leg".to_owned(),
                        ));
                    }
                    ApnOp::BatchPayment {
                        debtor_agent,
                        legs,
                        purpose: input.array()?,
                        atomic: input.bool()?,
                    }
                }
                130 => ApnOp::PaymentRequest {
                    payer: Address::decode(input)?,
                    amount: input.u128()?,
                    creditor_agent: Aic::decode(input)?,
                    uetr_hash: Hash32::decode(input)?,
                    remittance_hash: Hash32::decode(input)?,
                    expires_day: input.u64()?,
                },
                131 => ApnOp::PaymentRequestResponse {
                    request_id: Hash32::decode(input)?,
                    accept: input.bool()?,
                    debtor_agent: Aic::decode(input)?,
                },
                132 => ApnOp::MandateCreate {
                    creditor: Address::decode(input)?,
                    creditor_agent: Aic::decode(input)?,
                    debtor_agent: Aic::decode(input)?,
                    max_amount: input.u128()?,
                    frequency: input.u8()?,
                    first_day: input.u64()?,
                    final_day: input.u64()?,
                },
                133 => ApnOp::MandateAmend {
                    mandate_id: Hash32::decode(input)?,
                    max_amount: input.u128()?,
                    final_day: input.u64()?,
                    suspended: input.bool()?,
                },
                134 => ApnOp::MandateCancel {
                    mandate_id: Hash32::decode(input)?,
                },
                135 => ApnOp::DirectDebit {
                    mandate_id: Hash32::decode(input)?,
                    amount: input.u128()?,
                    uetr_hash: Hash32::decode(input)?,
                    remittance_hash: Hash32::decode(input)?,
                },
                136 => ApnOp::ScheduledPayment {
                    debtor_agent: Aic::decode(input)?,
                    leg: PaymentLeg::decode(input)?,
                    purpose: input.array()?,
                    execute_day: input.u64()?,
                },
                137 => ApnOp::PaymentReturn {
                    original: PaymentRef::decode(input)?,
                    amount: input.u128()?,
                    reason: input.array()?,
                },
                138 => ApnOp::RecallRequest {
                    original: PaymentRef::decode(input)?,
                    reason: input.array()?,
                },
                139 => ApnOp::RecallResponse {
                    original: PaymentRef::decode(input)?,
                    accept: input.bool()?,
                    reason: input.array()?,
                },
                140 => ApnOp::MessageAnchor {
                    batch_id: Hash32::decode(input)?,
                    merkle_root: Hash32::decode(input)?,
                    count: input.u32()?,
                },
                141 => ApnOp::AanAssign {
                    aan: Aan::decode(input)?,
                    address: Address::decode(input)?,
                },
                142 => ApnOp::ProxyRegister {
                    proxy: Hash32::decode(input)?,
                    address: Address::decode(input)?,
                },
                143 => ApnOp::ProxyRemove {
                    proxy: Hash32::decode(input)?,
                },
                144 => ApnOp::ExternalLegLock {
                    leg_id: Hash32::decode(input)?,
                    amount: input.u128()?,
                    uetr_hash: Hash32::decode(input)?,
                    rail: input.u16()?,
                    profile_hash: Hash32::decode(input)?,
                    gateway: Aic::decode(input)?,
                    expiry_day: input.u64()?,
                },
                145 => ApnOp::ExternalLegSettle {
                    leg_id: Hash32::decode(input)?,
                    msg_id_hash: Hash32::decode(input)?,
                },
                146 => ApnOp::ExternalLegRelease {
                    leg_id: Hash32::decode(input)?,
                    reason: input.array()?,
                },
                147 => ApnOp::ExternalInboundCredit {
                    rail: input.u16()?,
                    uetr_hash: Hash32::decode(input)?,
                    msg_id_hash: Hash32::decode(input)?,
                    amount: input.u128()?,
                    creditor: Address::decode(input)?,
                    creditor_agent: Aic::decode(input)?,
                    standing: StandingAuthorization::decode(input)?,
                },
                _ => {
                    return Err(bad(
                        ErrorCode::DecodeNonCanonical,
                        "not an APN type".to_owned(),
                    ));
                }
            })
        };
        ApnOp::TX_TYPES.contains(&tx_type).then(op)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aan_check_digits_round_trip_and_catch_typos() {
        let aan = Aan::from_body(b"1234567890123456").unwrap();
        assert_eq!(Aan::parse(aan.as_str()).unwrap(), aan);
        assert_eq!(
            Aan::parse(&aan.display()).unwrap(),
            aan,
            "spaces are forgiven"
        );
        assert_eq!(aan.routing_code(), 1234);
        // One wrong digit, or two swapped digits, fails the check.
        let mut typo = aan.as_str().as_bytes().to_vec();
        typo[10] = if typo[10] == b'9' { b'8' } else { typo[10] + 1 };
        assert_eq!(
            Aan::parse(core::str::from_utf8(&typo).unwrap())
                .unwrap_err()
                .code(),
            ErrorCode::ApnAanCheckDigits
        );
        let mut swapped = aan.as_str().as_bytes().to_vec();
        swapped.swap(7, 8);
        if swapped != aan.as_str().as_bytes() {
            assert!(Aan::parse(core::str::from_utf8(&swapped).unwrap()).is_err());
        }
    }

    #[test]
    fn an_aan_is_never_an_iban_and_malformed_ones_are_named() {
        assert_eq!(
            Aan::parse("AL47212110090000000235698741")
                .unwrap_err()
                .code(),
            ErrorCode::ApnAanMalformed,
            "an Albanian IBAN"
        );
        assert_eq!(
            Aan::parse("ALX12").unwrap_err().code(),
            ErrorCode::ApnAanMalformed
        );
    }

    #[test]
    fn aics_are_bic_shaped() {
        assert_eq!(Aic::parse("ALETXLAA").unwrap().text(), "ALETXLAAXXX");
        assert_eq!(Aic::parse("ALETXLAA001").unwrap().text(), "ALETXLAA001");
        for bad in ["ALET", "alet1laa", "AL3TXLAA", "ALETX1AA", "ALETXLAA0"] {
            assert!(Aic::parse(bad).is_err(), "{bad}");
        }
    }
}
