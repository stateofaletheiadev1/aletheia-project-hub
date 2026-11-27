//! Validator registry and Council commands (ADR-069, protocol version 2).
//!
//! ```text
//! validator set      [--epoch N]
//! validator register --keystore op.json --consensus-key HEX --proof-of-possession HEX
//!                    --node-key HEX [--cert-hash HEX] [--licence AGV-EOI-…] --bond 10000
//! validator licence-hash AGV-EOI-…                  (offline)
//! validator withdraw --keystore op.json --node-key HEX
//! validator exit     --keystore op.json --node-key HEX
//! gov propose        --keystore council.json <action ...>
//! gov vote           --keystore council.json --proposal HEX (--approve | --reject)
//! gov execute        --keystore council.json --proposal HEX
//! ```
//!
//! The consensus key, its proof of possession and the node key come from
//! `aletheia-signer keygen` on the validator's own host; only public values are given here.
//! Every transaction is simulated first and refused before signing if it would fail.

use std::path::PathBuf;
use std::time::Duration;

use aletheia_core::registry::{GovAction, RegistryOp, proposal_id};
use aletheia_core::validator::{ValidatorApplication, ValidatorOp};
use aletheia_core::{Address, AssetId, Hash32, NetworkIdentity, Payload, base16};
use aletheia_wallet::{Account, FeeTerms, HttpRpc, Preview, Rpc, WalletError, parse_amount, send};
use clap::{Args, Subcommand};
use serde_json::{Value, json};

use crate::{checked_network, fail, open_account, out, rows, s, show_tx};

/// Fee terms shared by every registry and Council transaction.
#[derive(Debug, Args)]
pub(crate) struct Fees {
    #[arg(long, default_value = "ALnT")]
    fee_asset: String,
    #[arg(long, default_value_t = 20_000)]
    max_fee: u128,
    #[arg(long, default_value_t = 20_000)]
    eu_limit: u64,
    /// Sign without asking for confirmation.
    #[arg(long)]
    yes: bool,
}

#[derive(Debug, Subcommand)]
pub(crate) enum ValidatorCommand {
    /// The fingerprint of a licence application reference, as `register --licence` records it.
    /// Works offline; talks to no node.
    LicenceHash { reference: String },
    /// The validator set of an epoch (the current one by default) at the finalized tip.
    Set {
        #[arg(long)]
        epoch: Option<u64>,
    },
    /// Apply as a validator operator: locks the bond (ALnT) until the Council decides.
    Register {
        #[arg(long)]
        keystore: PathBuf,
        /// BLS consensus public key, 48 bytes hex (from `aletheia-signer keygen --kind consensus`).
        #[arg(long)]
        consensus_key: String,
        /// Its proof of possession, 96 bytes hex.
        #[arg(long)]
        proof_of_possession: String,
        /// Ed25519 node public key, 32 bytes hex (from `aletheia-signer keygen --kind node`).
        #[arg(long)]
        node_key: String,
        /// SHA-256 of the node's transport certificate, 32 bytes hex, as aletheiad logs it at
        /// start ("transport certificate sha256=..."). Other validators accept the node only
        /// with this certificate (ADR-071).
        #[arg(long)]
        cert_hash: Option<String>,
        /// Commitment to the off-chain licence record, 32 bytes hex. Never personal data.
        #[arg(long, conflicts_with = "licence")]
        metadata_hash: Option<String>,
        /// The licence application reference (AGV-EOI-YYYY-NNNN); its fingerprint becomes the
        /// metadata hash, so the Council can match the registration to the application.
        #[arg(long)]
        licence: Option<String>,
        /// Bond in ALnT, e.g. 10000.
        #[arg(long)]
        bond: String,
        #[command(flatten)]
        fees: Fees,
    },
    /// Withdraw an application the Council has not decided; the bond returns.
    Withdraw {
        #[arg(long)]
        keystore: PathBuf,
        #[arg(long)]
        node_key: String,
        #[command(flatten)]
        fees: Fees,
    },
    /// Leave the set at the end of the current epoch; the bond returns when the exit takes effect.
    Exit {
        #[arg(long)]
        keystore: PathBuf,
        #[arg(long)]
        node_key: String,
        #[command(flatten)]
        fees: Fees,
    },
}

#[derive(Debug, Subcommand)]
pub(crate) enum GovCommand {
    /// Propose a governance action as a Council member (counts as your approval).
    Propose {
        #[arg(long)]
        keystore: PathBuf,
        #[command(subcommand)]
        action: ProposeAction,
        #[command(flatten)]
        fees: Fees,
    },
    /// Vote on a proposal as a Council member.
    Vote {
        #[arg(long)]
        keystore: PathBuf,
        /// The proposal id, 32 bytes hex (printed by `gov propose`).
        #[arg(long)]
        proposal: String,
        #[arg(long, conflicts_with = "reject", required_unless_present = "reject")]
        approve: bool,
        #[arg(long)]
        reject: bool,
        #[command(flatten)]
        fees: Fees,
    },
    /// Execute an approved proposal once its timelock has passed (anyone may).
    Execute {
        #[arg(long)]
        keystore: PathBuf,
        #[arg(long)]
        proposal: String,
        #[command(flatten)]
        fees: Fees,
    },
}

#[derive(Debug, Subcommand)]
pub(crate) enum ProposeAction {
    /// Admit a registered validator; it joins when the epoch closes.
    ActivateValidator {
        #[arg(long)]
        node_key: String,
    },
    /// Refuse a registered application; the bond returns to the operator.
    RejectValidator {
        #[arg(long)]
        node_key: String,
    },
    /// Remove a validator from the set at once (no timelock); it keeps its bond.
    SuspendValidator {
        #[arg(long)]
        node_key: String,
    },
    /// Return a suspended validator to the set.
    ReinstateValidator {
        #[arg(long)]
        node_key: String,
    },
    /// Minimum bond (ALnT) and largest set.
    ValidatorPolicy {
        #[arg(long)]
        min_bond: String,
        #[arg(long)]
        max_validators: u16,
    },
    /// Reward period, pool payout per period (ALnT) and the state beneficiary (`none` to keep
    /// the state's share in the pools).
    RewardPolicy {
        /// Slots per period; 172800 is one day of 500 ms slots.
        #[arg(long)]
        period_slots: u64,
        #[arg(long)]
        pool_payout: String,
        #[arg(long)]
        beneficiary: String,
    },
    /// Schedule a protocol version to activate at a height.
    ScheduleUpgrade {
        #[arg(long)]
        version: u16,
        #[arg(long)]
        height: u64,
    },
}

fn hex<const N: usize>(what: &str, text: &str) -> Result<[u8; N], WalletError> {
    base16::decode_fixed::<N>(text.trim()).map_err(|e| {
        fail(format!(
            "{what}: {} ({N} bytes of hex expected)",
            e.detail()
        ))
    })
}

fn optional_hash(what: &str, text: Option<&str>) -> Result<Hash32, WalletError> {
    text.map_or(Ok(Hash32::ZERO), |text| {
        hex::<32>(what, text).map(Hash32::from_bytes)
    })
}

/// Context for licence fingerprints. Changing it changes every fingerprint: never edit it.
const LICENCE_CONTEXT: &str = "AletheiaChain 2026-11-26 validator licence v1";

/// The fingerprint of a licence application reference (`AGV-EOI-YYYY-NNNN`, any case).
fn licence_hash(reference: &str) -> Result<Hash32, WalletError> {
    let reference = reference.trim().to_ascii_uppercase();
    let parts: Vec<&str> = reference.split('-').collect();
    let valid = matches!(parts.as_slice(), ["AGV", "EOI", year, number]
        if year.len() == 4 && year.bytes().all(|b| b.is_ascii_digit())
            && number.len() >= 4 && number.bytes().all(|b| b.is_ascii_digit()));
    if !valid {
        return Err(fail(format!(
            "\"{reference}\" is not an application reference (AGV-EOI-YYYY-NNNN)"
        )));
    }
    Ok(Hash32::from_bytes(blake3::derive_key(
        LICENCE_CONTEXT,
        reference.as_bytes(),
    )))
}

fn alnt(text: &str) -> Result<u128, WalletError> {
    parse_amount(text, aletheia_wallet::asset_decimals(AssetId::ALNT))
}

fn terms(fees: &Fees) -> Result<FeeTerms, WalletError> {
    Ok(FeeTerms {
        fee_asset: crate::asset(&fees.fee_asset)?,
        max_fee: fees.max_fee,
        eu_limit: fees.eu_limit,
        validity_slots: 1_000,
    })
}

/// The confirmation prompt, shared with `transfer`: `what` describes the action.
fn confirm(json_out: bool, yes: bool, what: &str) -> impl FnOnce(&Preview) -> bool + '_ {
    move |preview: &Preview| {
        if json_out || yes {
            return yes;
        }
        out(&format!("{}\nAction           {what}", preview));
        crate::ask("Sign and send?")
    }
}

/// Sends one payload; returns the nonce it used and what the node reported.
async fn submit(
    rpc: &HttpRpc,
    account: &Account,
    fees: &Fees,
    json_out: bool,
    what: &str,
    payload: impl FnOnce(u64) -> Payload,
) -> Result<(u64, Value), WalletError> {
    let mut used = 0;
    let sent = send(
        rpc,
        account,
        &terms(fees)?,
        |nonce| {
            used = nonce;
            payload(nonce)
        },
        confirm(json_out, fees.yes, what),
        Duration::from_secs(60),
    )
    .await?;
    let shown = sent
        .finalized
        .unwrap_or_else(|| json!({ "txId": sent.tx_id, "status": "SUBMITTED" }));
    Ok((used, shown))
}

/// Prints a transaction as the node reported it.
fn report(json_out: bool, shown: &Value) {
    if json_out {
        out(&serde_json::to_string_pretty(shown).unwrap_or_default());
    } else if shown.get("status").and_then(Value::as_str) == Some("SUBMITTED") {
        out(&format!(
            "Submitted {}; not finalized yet: check with `tx show`.",
            s(shown, &["txId"])
        ));
    } else {
        out(&show_tx(shown));
    }
}

/// A finalized transaction whose payload failed is an error for the caller: the fee was
/// charged and nothing else happened (the simulation passed, but the chain moved on before
/// inclusion, e.g. past a deadline).
fn failed_on_chain(shown: &Value) -> Result<(), WalletError> {
    let status = s(shown, &["receipt", "status"]);
    if status.is_empty() || status == "SUCCESS" {
        return Ok(());
    }
    Err(fail(format!(
        "the transaction was finalized but failed: {} {}; only the fee was charged",
        status,
        s(shown, &["receipt", "errorName"])
    )))
}

/// Sends one payload, prints the outcome, and fails if it failed on chain.
async fn submit_and_report(
    rpc: &HttpRpc,
    account: &Account,
    fees: &Fees,
    json_out: bool,
    what: &str,
    payload: impl FnOnce(u64) -> Payload,
) -> Result<(), WalletError> {
    let (_, shown) = submit(rpc, account, fees, json_out, what, payload).await?;
    report(json_out, &shown);
    failed_on_chain(&shown)
}

pub(crate) async fn validator(
    rpc: &HttpRpc,
    expected: Option<&str>,
    json_out: bool,
    command: ValidatorCommand,
) -> Result<(), WalletError> {
    if let ValidatorCommand::LicenceHash { reference } = &command {
        let hash = base16::encode(licence_hash(reference)?.as_bytes());
        if json_out {
            out(&serde_json::to_string_pretty(&json!({ "reference": reference.trim().to_ascii_uppercase(), "metadataHash": hash })).unwrap_or_default());
        } else {
            out(&rows(&[
                ("Reference", reference.trim().to_ascii_uppercase()),
                ("Metadata hash", hash),
            ]));
        }
        return Ok(());
    }
    let network = checked_network(rpc, expected).await?;
    match command {
        ValidatorCommand::LicenceHash { .. } => {}
        ValidatorCommand::Set { epoch } => {
            let params = match epoch {
                Some(epoch) => json!({ "epoch": epoch }),
                None => json!({}),
            };
            let set = rpc.call("getValidatorSet", params).await?;
            if json_out {
                out(&serde_json::to_string_pretty(&set).unwrap_or_default());
                return Ok(());
            }
            let members = set
                .get("validators")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let mut text = rows(&[
                ("Epoch", s(&set, &["epoch"])),
                ("Validators", members.len().to_string()),
            ]);
            for (index, member) in members.iter().enumerate() {
                let node = s(member, &["nodeKey"]);
                text.push_str(&format!("\n  {index:<4} node {node}"));
            }
            out(&text);
        }
        ValidatorCommand::Register {
            keystore,
            consensus_key,
            proof_of_possession,
            node_key,
            cert_hash,
            metadata_hash,
            licence,
            bond,
            fees,
        } => {
            let metadata = match licence.as_deref() {
                Some(reference) => licence_hash(reference)?,
                None => optional_hash("--metadata-hash", metadata_hash.as_deref())?,
            };
            let application = ValidatorApplication {
                consensus_key: hex::<48>("--consensus-key", &consensus_key)?,
                proof_of_possession: hex::<96>("--proof-of-possession", &proof_of_possession)?,
                node_key: hex::<32>("--node-key", &node_key)?,
                transport_cert_hash: optional_hash("--cert-hash", cert_hash.as_deref())?,
                metadata_hash: metadata,
                bond: alnt(&bond)?,
            };
            check_possession(&network, &application)?;
            let account = open_account(&keystore, &network)?;
            let what = format!("register validator {node_key} with a bond of {bond} ALnT");
            submit_and_report(rpc, &account, &fees, json_out, &what, |_| {
                Payload::Validator(Box::new(ValidatorOp::Register(Box::new(application))))
            })
            .await?;
        }
        ValidatorCommand::Withdraw {
            keystore,
            node_key,
            fees,
        } => {
            let key = hex::<32>("--node-key", &node_key)?;
            let account = open_account(&keystore, &network)?;
            let what = format!("withdraw the application of validator {node_key}");
            submit_and_report(rpc, &account, &fees, json_out, &what, |_| {
                Payload::Validator(Box::new(ValidatorOp::WithdrawApplication { node_key: key }))
            })
            .await?;
        }
        ValidatorCommand::Exit {
            keystore,
            node_key,
            fees,
        } => {
            let key = hex::<32>("--node-key", &node_key)?;
            let account = open_account(&keystore, &network)?;
            let what = format!("validator {node_key} leaves the set at the end of the epoch");
            submit_and_report(rpc, &account, &fees, json_out, &what, |_| {
                Payload::Validator(Box::new(ValidatorOp::RequestExit { node_key: key }))
            })
            .await?;
        }
    }
    Ok(())
}

/// Checks the proof of possession locally, so a mistyped key never costs a fee.
fn check_possession(
    network: &NetworkIdentity,
    application: &ValidatorApplication,
) -> Result<(), WalletError> {
    let proof = aletheia_crypto::bls::BlsSignature::from_bytes(&application.proof_of_possession)
        .map_err(|e| fail(format!("--proof-of-possession: {}", e.detail())))?;
    aletheia_crypto::bls::BlsPublicKey::from_bytes(&application.consensus_key)
        .and_then(|key| key.prove_possession(network, &proof))
        .map(|_| ())
        .map_err(|e| {
            fail(format!(
                "the proof of possession does not match the consensus key for this chain: {}",
                e.detail()
            ))
        })
}

fn action(
    network: &NetworkIdentity,
    action: ProposeAction,
) -> Result<(GovAction, String), WalletError> {
    let kind = network.network_kind();
    Ok(match action {
        ProposeAction::ActivateValidator { node_key } => (
            GovAction::ActivateValidator {
                node_key: hex::<32>("--node-key", &node_key)?,
            },
            format!("activate validator {node_key}"),
        ),
        ProposeAction::RejectValidator { node_key } => (
            GovAction::RejectValidator {
                node_key: hex::<32>("--node-key", &node_key)?,
            },
            format!("reject validator {node_key}"),
        ),
        ProposeAction::SuspendValidator { node_key } => (
            GovAction::SuspendValidator {
                node_key: hex::<32>("--node-key", &node_key)?,
            },
            format!("suspend validator {node_key} (no timelock)"),
        ),
        ProposeAction::ReinstateValidator { node_key } => (
            GovAction::ReinstateValidator {
                node_key: hex::<32>("--node-key", &node_key)?,
            },
            format!("reinstate validator {node_key}"),
        ),
        ProposeAction::ValidatorPolicy {
            min_bond,
            max_validators,
        } => (
            GovAction::SetValidatorPolicy {
                min_bond: alnt(&min_bond)?,
                max_validators,
            },
            format!(
                "validator policy: minimum bond {min_bond} ALnT, at most {max_validators} validators"
            ),
        ),
        ProposeAction::RewardPolicy {
            period_slots,
            pool_payout,
            beneficiary,
        } => {
            let state_beneficiary = if beneficiary == "none" {
                None
            } else {
                Some(
                    Address::parse(&beneficiary, kind)
                        .map_err(|e| fail(format!("--beneficiary: {}", e.detail())))?,
                )
            };
            (
                GovAction::SetRewardPolicy {
                    period_slots,
                    pool_payout: alnt(&pool_payout)?,
                    state_beneficiary,
                },
                format!(
                    "reward policy: every {period_slots} slots, {pool_payout} ALnT from the pool plus fees; state share to {beneficiary}"
                ),
            )
        }
        ProposeAction::ScheduleUpgrade { version, height } => (
            GovAction::ScheduleUpgrade {
                protocol_version: version,
                activation_height: height,
            },
            format!("schedule protocol version {version} at height {height}"),
        ),
    })
}

pub(crate) async fn gov(
    rpc: &HttpRpc,
    expected: Option<&str>,
    json_out: bool,
    command: GovCommand,
) -> Result<(), WalletError> {
    let network = checked_network(rpc, expected).await?;
    match command {
        GovCommand::Propose {
            keystore,
            action: proposed,
            fees,
        } => {
            let (gov_action, what) = action(&network, proposed)?;
            let account = open_account(&keystore, &network)?;
            let sender = account.address();
            let encoded = gov_action.clone();
            let (nonce, shown) = submit(rpc, &account, &fees, json_out, &what, |_| {
                Payload::Registry(Box::new(RegistryOp::GovPropose { action: encoded }))
            })
            .await?;
            if let Err(error) = failed_on_chain(&shown) {
                report(json_out, &shown);
                return Err(error);
            }
            let id = proposal_id(&network, &sender, nonce, &gov_action);
            let timelock = gov_action.timelock_epochs();
            if json_out {
                out(&serde_json::to_string_pretty(&json!({
                    "proposalId": base16::encode(id.as_bytes()),
                    "timelockEpochs": timelock,
                    "transaction": shown,
                }))
                .unwrap_or_default());
            } else {
                report(false, &shown);
                out(&rows(&[
                    ("Proposal", base16::encode(id.as_bytes())),
                    (
                        "Timelock",
                        format!("{timelock} governance epochs after approval"),
                    ),
                    (
                        "Next",
                        "other members vote with `gov vote`; then `gov execute` once the timelock has passed"
                            .to_owned(),
                    ),
                ]));
            }
        }
        GovCommand::Vote {
            keystore,
            proposal,
            approve,
            reject,
            fees,
        } => {
            let id = Hash32::from_bytes(hex::<32>("--proposal", &proposal)?);
            let approve = approve && !reject;
            let account = open_account(&keystore, &network)?;
            let what = format!(
                "{} proposal {proposal}",
                if approve { "approve" } else { "reject" }
            );
            submit_and_report(rpc, &account, &fees, json_out, &what, |_| {
                Payload::Registry(Box::new(RegistryOp::GovVote {
                    proposal_id: id,
                    approve,
                }))
            })
            .await?;
        }
        GovCommand::Execute {
            keystore,
            proposal,
            fees,
        } => {
            let id = Hash32::from_bytes(hex::<32>("--proposal", &proposal)?);
            let account = open_account(&keystore, &network)?;
            let what = format!("execute proposal {proposal}");
            submit_and_report(rpc, &account, &fees, json_out, &what, |_| {
                Payload::Registry(Box::new(RegistryOp::GovExecute { proposal_id: id }))
            })
            .await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_licence_fingerprint_ignores_case_and_spacing_and_refuses_other_text() {
        let a = licence_hash("AGV-EOI-2026-0001").unwrap();
        assert_eq!(licence_hash(" agv-eoi-2026-0001 ").unwrap(), a);
        assert_ne!(licence_hash("AGV-EOI-2026-0002").unwrap(), a);
        assert!(licence_hash("AGV-OPP-2026-0001").is_err());
        assert!(licence_hash("AGV-EOI-26-0001").is_err());
    }
}
