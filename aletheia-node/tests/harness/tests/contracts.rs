//! Arno contracts on the chain (spec Sections 11, 15, 27-29): deployed and called by
//! transactions, holding and paying out coins, metered, and reverted on failure. Every block
//! here also passes the supply check, including the coins contracts move at run time.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_core::monetary::{Attachment, ContractCall, ContractDeploy};
use aletheia_core::{AceEncode, Address, AssetId, ErrorCode, Payload, Slot};
use aletheia_execution::{Receipt, ReceiptStatus};
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};

fn escrow_package() -> Vec<u8> {
    let path = format!(
        "{}/../../examples/arno/escrow.arno",
        env!("CARGO_MANIFEST_DIR")
    );
    let file =
        aletheia_arno::SourceFile::new("escrow.arno", std::fs::read_to_string(path).unwrap());
    aletheia_arno::compile(&file).unwrap()
}

trait Submit {
    fn submit_with(&mut self, from: usize, payload: Payload, eu_limit: u64) -> Receipt;
    fn submit(&mut self, from: usize, payload: Payload) -> Receipt {
        self.submit_with(from, payload, 2_000_000)
    }
}

impl Submit for Devnet {
    fn submit_with(&mut self, from: usize, payload: Payload, eu_limit: u64) -> Receipt {
        let nonce = self.next_nonce(from);
        let mut body = self.body(from, nonce, payload);
        body.fee.eu_limit = eu_limit;
        body.fee.max_fee = u128::from(eu_limit);
        let tx = self.sign(from, body);
        let (_, executed) = self.produce(vec![tx]).expect("the block is valid");
        executed.receipts[0].clone()
    }
}

struct World {
    net: Devnet,
    contract: Address,
}

const BUYER: usize = 0;
const SELLER: usize = 1;
const ARBITER: usize = 2;

fn deployed() -> World {
    let mut net = Devnet::new(3, 100 * ONE_AEY, 10_000 * ONE_ALNT);
    let package = escrow_package();
    let code_hash = aletheia_vm::Package::from_bytes(&package)
        .unwrap()
        .code_hash();
    let mut args = net.address(SELLER).to_ace_bytes();
    args.extend(net.address(ARBITER).to_ace_bytes());
    args.extend(Slot::new(50).to_ace_bytes());
    let nonce = net.next_nonce(BUYER);
    let receipt = net.submit(
        BUYER,
        Payload::ContractDeploy(Box::new(ContractDeploy {
            package,
            args,
            attach: None,
        })),
    );
    assert_eq!(receipt.status, ReceiptStatus::Success, "{receipt:?}");
    assert!(receipt.eu_used > 20_000, "deployment pays per code byte");
    let contract = aletheia_crypto::address::contract_account(
        &net.network,
        &net.address(BUYER),
        nonce,
        &code_hash,
    );
    World { net, contract }
}

fn call(contract: Address, routine: &str, attach: Option<u128>) -> Payload {
    Payload::ContractCall(Box::new(ContractCall {
        contract,
        routine: routine.to_owned(),
        args: Vec::new(),
        attach: attach.map(|amount| Attachment {
            asset: AssetId::AEY,
            amount,
        }),
    }))
}

fn aey(net: &Devnet, address: &Address) -> u128 {
    net.balance(address, AssetId::AEY).available
}

#[test]
fn an_escrow_holds_coins_and_pays_the_seller() {
    let World { mut net, contract } = deployed();
    let r = net.submit(BUYER, call(contract, "Fund", Some(5 * ONE_AEY)));
    assert_eq!(r.status, ReceiptStatus::Success, "{r:?}");
    assert_eq!(
        aey(&net, &contract),
        5 * ONE_AEY,
        "the contract account holds the vault's coins"
    );
    assert_eq!(aey(&net, &net.address(BUYER)), 95 * ONE_AEY);
    assert_eq!(r.events.len(), 1, "EscrowFunded, emitted by the contract");
    assert_eq!(r.events[0].emitter, contract);

    let r = net.submit(ARBITER, call(contract, "Release", None));
    assert_eq!(r.status, ReceiptStatus::Success, "{r:?}");
    assert_eq!(aey(&net, &contract), 0);
    assert_eq!(
        aey(&net, &net.address(SELLER)),
        105 * ONE_AEY,
        "paid by the contract"
    );
}

#[test]
fn a_contract_refusal_reverts_everything_but_the_fee() {
    let World { mut net, contract } = deployed();
    // The seller is not the buyer: aborted, and the attached coins never leave.
    let before = aey(&net, &net.address(SELLER));
    let r = net.submit(SELLER, call(contract, "Fund", Some(ONE_AEY)));
    assert_eq!(r.status, ReceiptStatus::FailedExecution);
    assert_eq!(r.error_code, ErrorCode::VmContractAborted.get());
    assert!(r.fee_amount > 0);
    assert_eq!(aey(&net, &net.address(SELLER)), before);
    assert_eq!(aey(&net, &contract), 0);

    // Releasing an unfunded escrow is the wrong phase.
    let r = net.submit(ARBITER, call(contract, "Release", None));
    assert_eq!(r.error_code, ErrorCode::VmContractAborted.get());
}

#[test]
fn running_out_of_eu_reverts_the_call() {
    let World { mut net, contract } = deployed();
    let r = net.submit_with(BUYER, call(contract, "Fund", Some(ONE_AEY)), 3_000);
    assert_eq!(r.status, ReceiptStatus::OutOfEu);
    assert_eq!(r.eu_used, 3_000, "the whole limit is paid");
    assert_eq!(aey(&net, &contract), 0);
    assert_eq!(aey(&net, &net.address(BUYER)), 100 * ONE_AEY);
}

#[test]
fn malformed_calls_are_refused_with_their_reason() {
    let World { mut net, contract } = deployed();
    let r = net.submit(BUYER, call(contract, "Steal", None));
    assert_eq!(r.error_code, ErrorCode::TxRoutineUnknown.get());
    let r = net.submit(BUYER, call(net.address(SELLER), "Fund", None));
    assert_eq!(r.error_code, ErrorCode::TxContractUnknown.get());
    let r = net.submit(BUYER, call(contract, "Fund", None));
    assert_eq!(
        r.error_code,
        ErrorCode::TxAttachmentInvalid.get(),
        "Fund needs coins"
    );
    let r = net.submit(ARBITER, call(contract, "Release", Some(ONE_AEY)));
    assert_eq!(
        r.error_code,
        ErrorCode::TxAttachmentInvalid.get(),
        "Release takes none"
    );
    // The constructor cannot be called after deployment.
    let r = net.submit(BUYER, call(contract, "Create", None));
    assert_eq!(r.error_code, ErrorCode::TxRoutineUnknown.get());
}

#[test]
fn only_verified_packages_deploy() {
    let mut net = Devnet::new(1, ONE_AEY, 10_000 * ONE_ALNT);
    let mut package = escrow_package();
    let last = package.len() - 1;
    package[last] ^= 1;
    let r = net.submit(
        0,
        Payload::ContractDeploy(Box::new(ContractDeploy {
            package,
            args: Vec::new(),
            attach: None,
        })),
    );
    assert_eq!(r.status, ReceiptStatus::FailedExecution);
    assert_eq!(r.error_code, ErrorCode::VmPackageMalformed.get());
}

#[test]
fn view_routines_run_without_a_signer() {
    let World { mut net, contract } = deployed();
    let r = net.submit(SELLER, call(contract, "Status", None));
    assert_eq!(r.status, ReceiptStatus::Success, "{r:?}");
}
