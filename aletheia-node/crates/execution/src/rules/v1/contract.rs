//! Arno contracts, protocol version 1: `ContractDeploy` (32) and `ContractCall` (33)
//! (spec Sections 11, 15, 27-29).
//!
//! ```text
//! deploy  verify the package, derive the address from (deployer, nonce, code hash), store
//!         code (namespace 48, by code hash) and meta (49), run the constructor if any
//! call    load the package, find the entry or view routine by name, decode the arguments
//!         by its parameter types, hand over attached coins, run it under the remaining EU
//! ```
//!
//! The contract's coins live in its own native balance; its vaults record how much of that
//! each holds (ADR-047). Every balance the contract moves is reported for the supply check
//! after the block, because the recipients are known only at run time. A trap reverts the
//! transaction's payload; the fee is still charged.

use aletheia_core::monetary::{Attachment, ContractCall, ContractDeploy};
use aletheia_core::{
    AceDecode, AceEncode, AceReader, Address, AletheiaError, AssetId, ErrorCode, Hash32,
};
use aletheia_crypto::{Ed25519PublicKey, Ed25519Signature};
use aletheia_state::StateOverlay;
use aletheia_vm::package::{FLAG_CONSTRUCTOR, FLAG_ENTRY, FLAG_VIEW};
use aletheia_vm::{ChainInfo, Host, Package, Trap, TypeDef, Value, cost};

use crate::context::{BlockContext, Meter, OutOfEu};
use crate::model::{ContractMeta, Records};
use crate::receipt::{Event, event_type};
use crate::rules::v1::Touched;
use crate::rules::v1::balances::{credit, debit};
use crate::stateless::VerifiedTransaction;

type Step = Result<Result<(), OutOfEu>, AletheiaError>;

/// Largest value stored under one contract storage key (Section 15).
pub const MAX_STORAGE_VALUE: usize = 16 * 1024;

fn fail(code: ErrorCode, detail: String) -> AletheiaError {
    AletheiaError::new(code, detail)
}

/// The node side of a running contract: its storage, coins and events, on the overlay.
struct OverlayHost<'a, 'o> {
    records: &'a Records,
    overlay: &'a mut StateOverlay<'o>,
    contract: Address,
    chain: ChainInfo,
    event_names: Vec<String>,
    events: Vec<Event>,
    touched: &'a mut Touched,
}

fn host_error(error: &AletheiaError) -> Trap {
    if error.is_fail_stop() {
        Trap::Internal("state read failed")
    } else {
        Trap::Host(error.code())
    }
}

impl Host for OverlayHost<'_, '_> {
    fn chain(&self) -> ChainInfo {
        self.chain
    }

    fn storage_contains(&mut self, slot: u16, key: &[u8]) -> Result<bool, Trap> {
        let state_key = self.records.contract_storage_key(&self.contract, slot, key);
        self.overlay
            .get(&state_key)
            .map(|v| v.is_some())
            .map_err(|e| host_error(&e))
    }

    fn storage_read(&mut self, slot: u16, key: &[u8]) -> Result<Option<Vec<u8>>, Trap> {
        let state_key = self.records.contract_storage_key(&self.contract, slot, key);
        self.overlay.get(&state_key).map_err(|e| host_error(&e))
    }

    fn storage_write(&mut self, slot: u16, key: &[u8], value: Option<&[u8]>) -> Result<(), Trap> {
        let state_key = self.records.contract_storage_key(&self.contract, slot, key);
        match value {
            Some(bytes) if bytes.len() > MAX_STORAGE_VALUE => {
                return Err(Trap::StorageValueTooLarge);
            }
            Some(bytes) => self.overlay.put(state_key, bytes.to_vec()),
            None => self.overlay.delete(state_key),
        }
        Ok(())
    }

    fn transfer(&mut self, asset: u32, amount: u128, to: &[u8; 33]) -> Result<(), Trap> {
        let recipient =
            Address::from_ace_bytes(to).map_err(|_| Trap::Host(ErrorCode::AddrMalformed))?;
        let asset = AssetId::new(asset);
        debit(self.records, self.overlay, &self.contract, asset, amount)
            .map_err(|e| host_error(&e))?;
        credit(self.records, self.overlay, &recipient, asset, amount)
            .map_err(|e| host_error(&e))?;
        self.touched.push((self.contract, asset));
        self.touched.push((recipient, asset));
        Ok(())
    }

    fn emit(&mut self, event: u16, data: Vec<u8>) -> Result<(), Trap> {
        let name = self
            .event_names
            .get(usize::from(event))
            .cloned()
            .ok_or(Trap::Internal("event out of range"))?;
        self.events.push(Event {
            emitter: self.contract,
            event_type: event_type(&format!("arno.{name}")),
            topics: Vec::new(),
            data,
        });
        Ok(())
    }

    fn verify_ed25519(&self, key: &[u8; 32], digest: &[u8; 32], signature: &[u8; 64]) -> bool {
        Ed25519PublicKey::from_bytes(key)
            .and_then(|k| {
                k.verify(
                    &Hash32::from_bytes(*digest),
                    &Ed25519Signature::from_bytes(*signature),
                )
            })
            .is_ok()
    }
}

/// Calls routine `index` of `package`, deployed at `contract`.
#[allow(
    clippy::too_many_arguments,
    reason = "the full context of one contract invocation"
)]
fn invoke(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    package: &Package,
    contract: Address,
    index: usize,
    args: &[u8],
    attach: Option<Attachment>,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
    touched: &mut Touched,
) -> Step {
    let sender = verified.transaction().body.sender;
    let f = package.functions.get(index).ok_or_else(|| {
        fail(
            ErrorCode::TxRoutineUnknown,
            "routine index out of range".to_owned(),
        )
    })?;
    let types: Vec<&TypeDef> = f
        .registers
        .iter()
        .take(usize::from(f.params))
        .map(|ty| package.types.get(usize::from(*ty)))
        .collect::<Option<_>>()
        .ok_or_else(|| fail(ErrorCode::VmInternal, "parameter type missing".to_owned()))?;
    let coins_params = types.iter().filter(|t| t.is_coins()).count();
    if coins_params > 1 {
        return Err(fail(
            ErrorCode::TxAttachmentInvalid,
            "a routine called from a transaction takes at most one Coins parameter".to_owned(),
        ));
    }
    let mut values = Vec::with_capacity(types.len());
    let mut input = AceReader::new(args);
    for (position, ty) in types.iter().enumerate() {
        let value = match ty {
            TypeDef::Signer if position == 0 => Value::Signer(
                sender
                    .to_ace_bytes()
                    .try_into()
                    .map_err(|_| fail(ErrorCode::VmInternal, "address width".to_owned()))?,
            ),
            TypeDef::Coins { asset } => {
                let Some(attach) = attach else {
                    return Err(fail(
                        ErrorCode::TxAttachmentInvalid,
                        "this routine takes coins; attach them".to_owned(),
                    ));
                };
                if attach.asset.get() != *asset || attach.amount == 0 {
                    return Err(fail(
                        ErrorCode::TxAttachmentInvalid,
                        format!(
                            "this routine takes asset {asset}; attached {} of asset {}",
                            attach.amount, attach.asset
                        ),
                    ));
                }
                debit(records, overlay, &sender, attach.asset, attach.amount)?;
                credit(records, overlay, &contract, attach.asset, attach.amount)?;
                touched.push((sender, attach.asset));
                touched.push((contract, attach.asset));
                Value::Coins {
                    asset: *asset,
                    amount: attach.amount,
                }
            }
            _ => {
                let ty_index = f.registers.get(position).copied().unwrap_or(u16::MAX);
                aletheia_vm::value::decode(package, ty_index, &mut input).map_err(|_| {
                    fail(
                        ErrorCode::TxArgsInvalid,
                        format!("argument {position} does not decode as its parameter type"),
                    )
                })?
            }
        };
        values.push(value);
    }
    input.finish().map_err(|_| {
        fail(
            ErrorCode::TxArgsInvalid,
            "the arguments have bytes left over".to_owned(),
        )
    })?;
    if coins_params == 0 && attach.is_some() {
        return Err(fail(
            ErrorCode::TxAttachmentInvalid,
            "this routine does not take coins".to_owned(),
        ));
    }

    let mut host = OverlayHost {
        records,
        overlay,
        contract,
        chain: ChainInfo {
            height: ctx.height.get(),
            slot: ctx.slot.get(),
            epoch: ctx.epoch.get(),
            protocol_time_ms: ctx.protocol_time_ms,
            tx_id: verified.tx_id().hash().into_bytes(),
        },
        event_names: package
            .events
            .iter()
            .map(|e| package.text(e.name).unwrap_or("?").to_owned())
            .collect(),
        events: Vec::new(),
        touched,
    };
    let function = u8::try_from(index).map_err(|_| {
        fail(
            ErrorCode::TxRoutineUnknown,
            "routine index out of range".to_owned(),
        )
    })?;
    let result = aletheia_vm::run(package, function, values, &mut host, meter.remaining());
    let produced = core::mem::take(&mut host.events);
    match result {
        Ok(outcome) => {
            if meter.charge(outcome.eu_used).is_err() {
                return Ok(Err(OutOfEu));
            }
            events.extend(produced);
            Ok(Ok(()))
        }
        Err(failure) => {
            let _ = meter.charge(failure.eu_used);
            match failure.trap {
                Trap::OutOfEu => Ok(Err(OutOfEu)),
                Trap::Internal(what) => Err(fail(
                    ErrorCode::VmInternal,
                    format!("VM internal error: {what}"),
                )),
                Trap::Abort(error) => {
                    let (name, message) =
                        package
                            .errors
                            .get(usize::from(error))
                            .map_or(("?", "?"), |e| {
                                (
                                    package.text(e.name).unwrap_or("?"),
                                    package.text(e.message).unwrap_or("?"),
                                )
                            });
                    Err(fail(
                        ErrorCode::VmContractAborted,
                        format!("{name}: {message}"),
                    ))
                }
                trap => Err(fail(trap.code(), format!("contract trapped: {trap:?}"))),
            }
        }
    }
}

#[allow(clippy::too_many_arguments, reason = "the payload runner's context")]
pub(crate) fn deploy(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    deploy: &ContractDeploy,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
    touched: &mut Touched,
) -> Step {
    let len = u64::try_from(deploy.package.len()).unwrap_or(u64::MAX);
    if meter
        .charge(
            cost::CONTRACT_CREATE.saturating_add(len.saturating_mul(cost::CONTRACT_CREATE_BYTE)),
        )
        .is_err()
    {
        return Ok(Err(OutOfEu));
    }
    let package = aletheia_vm::verify_bytes(&deploy.package)?;
    let body = &verified.transaction().body;
    let code_hash = package.code_hash();
    let contract = aletheia_crypto::address::contract_account(
        records.network(),
        &body.sender,
        body.nonce,
        &code_hash,
    );
    if records.contract_meta(overlay, &contract)?.is_some() {
        return Err(fail(
            ErrorCode::TxFieldOutOfRange,
            format!(
                "a contract already exists at {}",
                contract.to_text(records.network().network_kind())
            ),
        ));
    }
    let code_key = records.contract_code_key(&code_hash);
    if overlay.get(&code_key)?.is_none() {
        overlay.put(code_key, deploy.package.clone());
    }
    let meta = ContractMeta {
        code_hash,
        deployer: body.sender,
        arno_version: package.arno_version,
        storage_root_hint: Hash32::ZERO,
    };
    overlay.put(records.contract_meta_key(&contract), meta.to_ace_bytes());
    let mut data = contract.to_ace_bytes();
    data.extend_from_slice(code_hash.as_bytes());
    events.push(Event {
        emitter: crate::model::module_address(4),
        event_type: event_type("aletheia.contract.deployed.v1"),
        topics: vec![contract.account_hash(), code_hash],
        data,
    });
    match package
        .functions
        .iter()
        .position(|f| f.flags & FLAG_CONSTRUCTOR != 0)
    {
        Some(index) => invoke(
            records,
            overlay,
            verified,
            &package,
            contract,
            index,
            &deploy.args,
            deploy.attach,
            ctx,
            meter,
            events,
            touched,
        ),
        None if deploy.args.is_empty() && deploy.attach.is_none() => Ok(Ok(())),
        None => Err(fail(
            ErrorCode::TxArgsInvalid,
            "the contract has no constructor to take arguments or coins".to_owned(),
        )),
    }
}

#[allow(clippy::too_many_arguments, reason = "the payload runner's context")]
pub(crate) fn call(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    verified: &VerifiedTransaction,
    call: &ContractCall,
    ctx: &BlockContext,
    meter: &mut Meter,
    events: &mut Vec<Event>,
    touched: &mut Touched,
) -> Step {
    let meta = records
        .contract_meta(overlay, &call.contract)?
        .ok_or_else(|| {
            fail(
                ErrorCode::TxContractUnknown,
                format!(
                    "no contract at {}",
                    call.contract.to_text(records.network().network_kind())
                ),
            )
        })?;
    let bytes = overlay
        .get(&records.contract_code_key(&meta.code_hash))?
        .ok_or_else(|| {
            fail(
                ErrorCode::StoCorrupt,
                format!("code {} of a deployed contract is missing", meta.code_hash),
            )
        })?;
    let read_cost =
        cost::STORAGE_READ.saturating_add(u64::try_from(bytes.len()).unwrap_or(u64::MAX));
    if meter.charge(read_cost).is_err() {
        return Ok(Err(OutOfEu));
    }
    // Verified at deployment; decoding checks the code hash again.
    let package = Package::from_bytes(&bytes).map_err(|e| {
        fail(
            ErrorCode::StoCorrupt,
            format!("stored code does not decode: {}", e.detail()),
        )
    })?;
    let index = package
        .functions
        .iter()
        .position(|f| {
            f.flags & (FLAG_ENTRY | FLAG_VIEW) != 0
                && package
                    .text(f.name)
                    .is_some_and(|name| name.eq_ignore_ascii_case(&call.routine))
        })
        .ok_or_else(|| {
            fail(
                ErrorCode::TxRoutineUnknown,
                format!(
                    "the contract has no entry or view routine '{}'",
                    call.routine
                ),
            )
        })?;
    invoke(
        records,
        overlay,
        verified,
        &package,
        call.contract,
        index,
        &call.args,
        call.attach,
        ctx,
        meter,
        events,
        touched,
    )
}
