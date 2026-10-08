//! The devnet the reference PayNet runs against: a council (accounts 0-2), bank A (3, operated
//! by PayNet), bank B (4) and a merchant (5) who banks with B.

use aletheia_core::apn::{Aan, Aic, ApnOp, Limits, ParticipantSpec, role};
use aletheia_core::registry::{GovAction, RegistryOp, proposal_id};
use aletheia_core::{ChainId, Hash32, NetworkIdentity, NetworkKind, Payload, Slot};
use aletheia_execution::{Receipt, ReceiptStatus};
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT, keys};

pub const BANK_A: usize = 3;
pub const BANK_B: usize = 4;
pub const MERCHANT: usize = 5;
const EPOCH_SLOTS: u64 = 4;

pub fn bank_a() -> Aic {
    Aic::parse("BANKXLAA").expect("a valid AIC")
}

pub fn bank_b() -> Aic {
    Aic::parse("BNKBXLBB").expect("a valid AIC")
}

/// Submits from `from` and returns the receipt; the block must be valid.
pub fn submit(net: &mut Devnet, from: usize, payload: Payload) -> Option<Receipt> {
    let nonce = net.next_nonce(from);
    let mut body = net.body(from, nonce, payload);
    body.fee.eu_limit = 100_000;
    body.fee.max_fee = 100_000;
    body.valid_from_slot = net.next_slot();
    body.expiry_slot = Slot::new(net.next_slot().get() + 7_000);
    let tx = net.sign(from, body);
    net.produce(vec![tx])
        .ok()
        .and_then(|(_, executed)| executed.receipts.first().cloned())
}

fn ok(receipt: Option<Receipt>) -> bool {
    receipt.is_some_and(|r| r.status == ReceiptStatus::Success)
}

fn govern(net: &mut Devnet, action: GovAction) -> bool {
    let nonce = net.next_nonce(0);
    let id = proposal_id(&net.network, &net.address(0), nonce, &action);
    let proposed = ok(submit(
        net,
        0,
        Payload::Registry(Box::new(RegistryOp::GovPropose {
            action: action.clone(),
        })),
    ));
    let voted = ok(submit(
        net,
        1,
        Payload::Registry(Box::new(RegistryOp::GovVote {
            proposal_id: id,
            approve: true,
        })),
    ));
    for _ in 0..(action.timelock_epochs() + 1) * EPOCH_SLOTS {
        if net.produce(Vec::new()).is_err() {
            return false;
        }
    }
    proposed
        && voted
        && ok(submit(
            net,
            2,
            Payload::Registry(Box::new(RegistryOp::GovExecute { proposal_id: id })),
        ))
}

fn participant(net: &Devnet, aic: Aic, account: usize, routing: u16) -> ParticipantSpec {
    ParticipantSpec {
        aic,
        legal_name_hash: Hash32::from_bytes([1; 32]),
        lei: None,
        bic: None,
        role: role::DIRECT_PARTICIPANT,
        sponsor: None,
        settlement_address: net.address(account),
        routing_code: routing,
        messaging_keys: Vec::new(),
        schemes: 1,
        limits: Limits {
            per_payment_max: 50 * ONE_AEY,
            daily_out_max: 1_000 * ONE_AEY,
            daily_in_max: 1_000 * ONE_AEY,
        },
    }
}

/// The network ready for payments; `None` if setup failed.
pub fn devnet() -> Option<Devnet> {
    let provisional = NetworkIdentity::new(ChainId::new(7771), NetworkKind::Devnet, Hash32::ZERO);
    let council: Vec<String> = keys(3)
        .iter()
        .map(|k| {
            format!(
                "\"{}\"",
                aletheia_crypto::address::ed25519_account(&provisional, &k.public_key())
                    .to_text(NetworkKind::Devnet)
            )
        })
        .collect();
    let extra = format!(
        "\n[governance]\ncouncil = [{}]\nthreshold = 2\nepoch_slots = {EPOCH_SLOTS}\nvoting_epochs = 3\nexecution_window_epochs = 5\nmax_aey_capacity_increase = \"{}\"\n",
        council.join(", "),
        10 * ONE_AEY
    );
    let mut net = Devnet::with_genesis_extra(6, 100 * ONE_AEY, 1_000 * ONE_ALNT, &extra);
    let a = participant(&net, bank_a(), BANK_A, 1001);
    let b = participant(&net, bank_b(), BANK_B, 2002);
    if !govern(&mut net, GovAction::UpsertParticipant(Box::new(a)))
        || !govern(&mut net, GovAction::UpsertParticipant(Box::new(b)))
    {
        return None;
    }
    let merchant = net.address(MERCHANT);
    let aan = Aan::from_body(b"2002000000000005").ok()?;
    ok(submit(
        &mut net,
        BANK_B,
        Payload::Apn(Box::new(ApnOp::AanAssign {
            aan,
            address: merchant,
        })),
    ))
    .then_some(net)
}
