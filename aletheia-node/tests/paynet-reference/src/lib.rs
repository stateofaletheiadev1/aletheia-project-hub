//! TEST-ONLY reference PayNet (spec Section 40D): a thin operator that uses every chain
//! interface the real PayNet uses, by the rules it must follow.
//!
//! - Settlement submission (40D.4): one submitter per settlement account with sequential
//!   nonces kept in PayNet's own store and reconciled with the chain on start; an HSM policy
//!   per key (allowed types, per-transaction and per-hour value limits, a second approval
//!   above a threshold); every payment simulated before it is signed and submitted.
//! - Finality (40D.3, 40D.4): a payment becomes SETTLED only when the Finalized Event Stream
//!   delivers its settlement event with a proof that verifies; a submission acknowledgement
//!   never does.
//! - Exactly-once effects: the stream cursor is committed together with the effects, so a
//!   restart at any point resumes without double effects.
//! - Reconciliation R4-R7 (40D.6).
//!
//! The "database" is the [`Store`] value: cloning it is a durable snapshot, and restarting is
//! building a new [`PayNet`] from one.

// Test-only crate: never in a release image.
#![allow(clippy::arithmetic_side_effects, clippy::expect_used)]

pub mod setup;

use std::collections::{BTreeMap, BTreeSet};

use aletheia_core::apn::{Aic, ApnOp, PaymentLeg, PaymentRef};
use aletheia_core::{Address, AletheiaError, AssetId, ErrorCode, Hash32, Payload, Slot};
use aletheia_crypto::merkle;
use aletheia_event_stream::{
    Consumer, Cursor, FinalizedBlock, FinalizedSource, Message, StreamRequest, Subscription,
    verify_envelope,
};
use aletheia_execution::{Receipt, ReceiptStatus};
use aletheia_test_harness::Devnet;

/// Kind codes this PayNet understands (from the stream's registry).
pub const KIND_PAYMENT_SETTLED: u16 = 100;
pub const KIND_MESSAGES_ANCHORED: u16 = 105;
pub const KIND_EXTERNAL_LOCKED: u16 = 120;

/// The finalized chain, read from the devnet's committed blocks.
#[allow(missing_debug_implementations)]
pub struct ChainSource<'a>(pub &'a Devnet);

impl FinalizedSource for ChainSource<'_> {
    fn finalized_height(&self) -> u64 {
        self.0.head.height.get()
    }
    fn block(&self, height: u64) -> Option<FinalizedBlock> {
        let index = usize::try_from(height.checked_sub(1)?).ok()?;
        let (proposal, executed) = self.0.blocks.get(index)?;
        let header = &proposal.block.header;
        Some(FinalizedBlock {
            height,
            block_hash: header.block_hash(&self.0.network),
            block_time_ms: header.protocol_time_ms,
            protocol_version: header.version.get(),
            event_root: header.event_root,
            receipts: executed.receipts.clone(),
        })
    }
}

/// Per-key HSM policy (40D.4).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HsmPolicy {
    pub allowed_types: BTreeSet<u16>,
    pub per_transaction_max: u128,
    pub per_hour_max: u128,
    /// Above this, a second approval key must co-sign.
    pub dual_control_above: u128,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum PaymentState {
    Initiated,
    /// Simulated, signed and in a block; not final until the stream says so.
    Submitted,
    Settled,
    Failed(u32),
    Refused,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentRecord {
    pub uetr_hash: Hash32,
    pub creditor: Address,
    pub amount: u128,
    pub state: PaymentState,
    pub tx_id: Option<Hash32>,
    /// The dedup key the settlement event carries as its first topic.
    pub dedup_key: Hash32,
}

/// Everything PayNet keeps durably.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Store {
    pub payments: BTreeMap<Hash32, PaymentRecord>,
    /// The next nonce of the settlement account, as PayNet believes it.
    pub nonce: u64,
    pub cursor: Option<Cursor>,
    /// Value submitted per protocol hour, for the per-hour HSM limit.
    pub hourly: BTreeMap<u64, u128>,
    /// Anchored message batches: batch id → the message hashes PayNet stored.
    pub messages: BTreeMap<Hash32, Vec<Hash32>>,
    /// Batch roots seen on chain.
    pub anchored: BTreeMap<Hash32, Hash32>,
    /// AEY held for customers but not yet submitted (40D.6 R4).
    pub holds: u128,
    /// Escrow legs this PayNet locked: UETR hash → whether a gateway case or outbox item is live.
    pub escrows: BTreeMap<Hash32, bool>,
    /// What PayNet's ledger says the settlement account holds (AEY base units).
    pub ledger_balance: u128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refusal {
    Policy(String),
    Simulation(u32),
}

/// One PayNet instance operating one direct participant's settlement account.
#[derive(Debug)]
pub struct PayNet {
    pub agent: Aic,
    /// The settlement account's index in the devnet's keys (its "HSM").
    pub account: usize,
    pub policy: HsmPolicy,
    pub store: Store,
    consumer: Consumer,
    network: aletheia_core::NetworkIdentity,
}

fn hour_of(protocol_time_ms: u64) -> u64 {
    protocol_time_ms / 3_600_000
}

impl PayNet {
    /// Starts (or restarts) from a stored snapshot, reconciling the nonce with the chain:
    /// a nonce the chain already used is never reused.
    pub fn start(
        agent: Aic,
        account: usize,
        policy: HsmPolicy,
        mut store: Store,
        net: &Devnet,
    ) -> PayNet {
        store.nonce = store.nonce.max(net.next_nonce(account));
        let consumer = Consumer::new(
            store.cursor,
            &[
                KIND_PAYMENT_SETTLED,
                KIND_MESSAGES_ANCHORED,
                KIND_EXTERNAL_LOCKED,
            ],
        );
        PayNet {
            agent,
            account,
            policy,
            store,
            consumer,
            network: net.network,
        }
    }

    fn sign_and_submit(
        &mut self,
        net: &mut Devnet,
        op: ApnOp,
        value: u128,
        second_approval: bool,
    ) -> Result<Receipt, Refusal> {
        let tx_type = op.tx_type();
        if !self.policy.allowed_types.contains(&tx_type) {
            return Err(Refusal::Policy(format!(
                "transaction type {tx_type} is not allowed for this key"
            )));
        }
        if value > self.policy.per_transaction_max {
            return Err(Refusal::Policy(
                "above the per-transaction limit".to_owned(),
            ));
        }
        if value > self.policy.dual_control_above && !second_approval {
            return Err(Refusal::Policy("needs a second approval".to_owned()));
        }
        let now = net
            .records()
            .chain_timing(&net.view())
            .and_then(|t| t.protocol_time_ms(net.next_slot()))
            .unwrap_or(0);
        let hour = hour_of(now);
        let used = self.store.hourly.get(&hour).copied().unwrap_or(0);
        if used + value > self.policy.per_hour_max {
            return Err(Refusal::Policy("above the per-hour limit".to_owned()));
        }
        let mut body = net.body(self.account, self.store.nonce, Payload::Apn(Box::new(op)));
        body.fee.eu_limit = 100_000;
        body.fee.max_fee = 100_000;
        body.valid_from_slot = net.next_slot();
        body.expiry_slot = Slot::new(net.next_slot().get() + 7_000);
        let tx = net.sign(self.account, body);
        // Simulate first; a payment that would fail is never signed into a block.
        let simulated = net
            .simulate(&tx)
            .map_err(|e| Refusal::Simulation(e.code().get()))?;
        if simulated.status != ReceiptStatus::Success {
            return Err(Refusal::Simulation(simulated.error_code));
        }
        let (_, executed) = net
            .produce(vec![tx])
            .map_err(|e| Refusal::Simulation(e.code().get()))?;
        self.store.nonce += 1;
        *self.store.hourly.entry(hour).or_insert(0) += value;
        executed
            .receipts
            .first()
            .cloned()
            .ok_or_else(|| Refusal::Simulation(ErrorCode::TxFieldOutOfRange.get()))
    }

    /// A payment from the settlement account to `creditor`, served by `creditor_agent`.
    #[allow(clippy::too_many_arguments)]
    pub fn pay(
        &mut self,
        net: &mut Devnet,
        creditor: Address,
        creditor_agent: Aic,
        amount: u128,
        uetr_hash: Hash32,
        second_approval: bool,
    ) -> Result<PaymentState, Refusal> {
        let dedup_key = PaymentRef {
            debtor_agent: self.agent,
            uetr_hash,
            leg: 0,
        }
        .dedup_key(&net.network);
        self.store
            .payments
            .entry(uetr_hash)
            .or_insert(PaymentRecord {
                uetr_hash,
                creditor,
                amount,
                state: PaymentState::Initiated,
                tx_id: None,
                dedup_key,
            });
        let op = ApnOp::Payment {
            debtor_agent: self.agent,
            leg: PaymentLeg {
                creditor,
                amount,
                creditor_agent,
                uetr_hash,
                remittance_hash: Hash32::ZERO,
            },
            purpose: *b"GDSV",
            scheme: 0,
        };
        let outcome = self.sign_and_submit(net, op, amount, second_approval);
        let state = match &outcome {
            Ok(receipt) if receipt.status == ReceiptStatus::Success => PaymentState::Submitted,
            Ok(receipt) => PaymentState::Failed(receipt.error_code),
            Err(_) => PaymentState::Refused,
        };
        if let Some(record) = self.store.payments.get_mut(&uetr_hash) {
            // A settled payment stays settled whatever a retry does.
            if record.state != PaymentState::Settled {
                record.state = state;
                record.tx_id = outcome.as_ref().ok().map(|r| r.tx_id).or(record.tx_id);
            }
        }
        outcome.map(|_| state)
    }

    /// Anchors a batch of APN message hashes (tx 140), keeping the messages for R6.
    pub fn anchor(
        &mut self,
        net: &mut Devnet,
        batch_id: Hash32,
        messages: Vec<Hash32>,
    ) -> Result<(), Refusal> {
        let root = merkle::root(
            &net.network,
            &messages.iter().map(|m| m.into_bytes()).collect::<Vec<_>>(),
        );
        let count = u32::try_from(messages.len()).unwrap_or(u32::MAX);
        self.store.messages.insert(batch_id, messages);
        let receipt = self.sign_and_submit(
            net,
            ApnOp::MessageAnchor {
                batch_id,
                merkle_root: root,
                count,
            },
            0,
            false,
        )?;
        if receipt.status == ReceiptStatus::Success {
            Ok(())
        } else {
            Err(Refusal::Simulation(receipt.error_code))
        }
    }

    /// Reads the Finalized Event Stream from the committed cursor and applies what it learns,
    /// committing the cursor with each effect. `capacity` bounds the subscription buffer; a
    /// disconnect just ends this round (the next round resumes from the cursor).
    pub fn sync(
        &mut self,
        source: &dyn FinalizedSource,
        capacity: usize,
    ) -> Result<(), AletheiaError> {
        let request = StreamRequest {
            after: self.store.cursor,
            kinds: BTreeSet::new(),
            with_proofs: true,
        };
        let net_identity = self.network;
        let mut sub = Subscription::new(request, net_identity, capacity);
        sub.pump(source);
        self.consumer.reset();
        while let Some(message) = sub.next_message() {
            let envelope = match message {
                Message::Event(envelope) => envelope,
                Message::Heartbeat { .. } => continue,
                Message::Disconnect { .. } => return Ok(()),
            };
            match self.consumer.judge(&envelope) {
                aletheia_event_stream::Verdict::Duplicate => continue,
                aletheia_event_stream::Verdict::Gap => return Ok(()),
                aletheia_event_stream::Verdict::Skip => {}
                aletheia_event_stream::Verdict::Apply => {
                    // Verify against the header root PayNet trusts (finalized header).
                    let root = source
                        .block(envelope.cursor.height)
                        .map(|b| b.event_root)
                        .ok_or_else(|| {
                            AletheiaError::new(ErrorCode::ProofInvalid, "unknown block".to_owned())
                        })?;
                    verify_envelope(&net_identity, &envelope, &root)?;
                    self.apply(&envelope);
                }
            }
            self.consumer.commit(envelope.cursor);
            self.store.cursor = self.consumer.committed();
        }
        Ok(())
    }

    fn apply(&mut self, envelope: &aletheia_event_stream::Envelope) {
        match envelope.kind {
            KIND_PAYMENT_SETTLED => {
                let Some(dedup) = envelope.event.topics.first() else {
                    return;
                };
                if let Some(record) = self
                    .store
                    .payments
                    .values_mut()
                    .find(|r| r.dedup_key == *dedup)
                    && record.state != PaymentState::Settled
                {
                    record.state = PaymentState::Settled;
                    record.tx_id = envelope.tx_id;
                    self.store.ledger_balance =
                        self.store.ledger_balance.saturating_sub(record.amount);
                }
            }
            KIND_MESSAGES_ANCHORED => {
                if let (Some(batch), Some(root)) =
                    (envelope.event.topics.first(), envelope.event.topics.get(1))
                {
                    self.store.anchored.insert(*batch, *root);
                }
            }
            _ => {}
        }
    }

    pub fn state(&self, uetr_hash: &Hash32) -> Option<PaymentState> {
        self.store.payments.get(uetr_hash).map(|r| r.state)
    }

    /// A durable snapshot of the store.
    pub fn snapshot(&self) -> Store {
        self.store.clone()
    }
}

/// A reconciliation break (40D.6).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Break {
    /// R4: ledger balance and chain balance (less unsubmitted holds) disagree.
    BalanceMismatch {
        ledger: u128,
        chain: u128,
        holds: u128,
    },
    /// R5: a SETTLED payment without exactly one matching finalized transaction, or an
    /// on-chain payment from the account with no ledger entry.
    SettlementMismatch { uetr_hash: Hash32 },
    /// R6: an anchored root does not recompute from the stored messages.
    AnchorMismatch { batch_id: Hash32 },
    /// R7: a LOCKED escrow from this PayNet with no live case or outbox item.
    OrphanEscrow { uetr_hash: Hash32 },
}

/// R4-R7 for one PayNet against the finalized chain.
pub fn reconcile(paynet: &PayNet, net: &Devnet) -> Vec<Break> {
    let mut breaks = Vec::new();
    let store = &paynet.store;
    let address = net.address(paynet.account);

    // R4.
    let chain = net.balance(&address, AssetId::AEY).available;
    if store.ledger_balance != chain.saturating_sub(store.holds) {
        breaks.push(Break::BalanceMismatch {
            ledger: store.ledger_balance,
            chain,
            holds: store.holds,
        });
    }

    // R5: settlement events in finalized blocks for payments from this account.
    let source = ChainSource(net);
    let settled_event = aletheia_execution::receipt::event_type("aletheia.apn.payment.settled.v1");
    let mut on_chain: BTreeMap<Hash32, u32> = BTreeMap::new();
    for height in 1..=source.finalized_height() {
        let Some(block) = source.block(height) else {
            continue;
        };
        for receipt in &block.receipts {
            for event in &receipt.events {
                if event.event_type == settled_event
                    && event.topics.get(1) == Some(&address.account_hash())
                    && let Some(dedup) = event.topics.first()
                {
                    *on_chain.entry(*dedup).or_insert(0) += 1;
                }
            }
        }
    }
    for record in store.payments.values() {
        let count = on_chain.get(&record.dedup_key).copied().unwrap_or(0);
        if (record.state == PaymentState::Settled) != (count == 1) || count > 1 {
            breaks.push(Break::SettlementMismatch {
                uetr_hash: record.uetr_hash,
            });
        }
    }
    for dedup in on_chain.keys() {
        if !store.payments.values().any(|r| r.dedup_key == *dedup) {
            breaks.push(Break::SettlementMismatch { uetr_hash: *dedup });
        }
    }

    // R6.
    for (batch, root) in &store.anchored {
        let recomputed = store.messages.get(batch).map(|m| {
            merkle::root(
                &net.network,
                &m.iter().map(|h| h.into_bytes()).collect::<Vec<_>>(),
            )
        });
        if recomputed != Some(*root) {
            breaks.push(Break::AnchorMismatch { batch_id: *batch });
        }
    }

    // R7.
    for (uetr_hash, live) in &store.escrows {
        if !live {
            breaks.push(Break::OrphanEscrow {
                uetr_hash: *uetr_hash,
            });
        }
    }
    breaks
}
