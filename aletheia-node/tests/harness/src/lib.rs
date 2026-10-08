//! NON-PRODUCTION single-node devnet driver.
//!
//! Builds a genesis with funded Ed25519 accounts, signs transactions, puts them in canonical
//! order, executes blocks on a memory store, computes every root and commits. It stands in
//! for consensus (blocks carry the genesis QC and no signatures) so execution, determinism
//! and recovery can be tested before Phase 5. Never linked into a release binary.

#![allow(
    clippy::expect_used,
    clippy::panic,
    clippy::unwrap_used,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects,
    clippy::as_conversions,
    clippy::cast_possible_truncation,
    missing_debug_implementations,
    reason = "test-only driver"
)]

use aletheia_core::block::{Block, BlockBody, BlockHeader, Proposal, QuorumCertificate};
use aletheia_core::tx::TX_BODY_VERSION_1;
use aletheia_core::{
    AceEncode, Address, AletheiaError, AssetId, AuthScheme, Authorization, Epoch, Fee, Hash32,
    Height, NetworkIdentity, Payload, PublicKeyEntry, SignatureEntry, SignedTransaction, Slot,
    TransactionBody, TransferLeg, ValidatorIndex,
};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use aletheia_execution::continuity::rules_for_height;
use aletheia_execution::model::{Account, Balance};
use aletheia_execution::ordering::canonical_order;
use aletheia_execution::{
    BlockContext, ExecutedBlock, GenesisConfig, GenesisState, Records, StatelessValidator,
    VerifiedTransaction, execute_block,
};
use aletheia_state::{JellyfishMerkleTree, StateKey, StateValue, StateView};
use aletheia_storage::{KvStore, MemoryKvStore};

/// AEY base units per EU and Mites per EU in the harness genesis.
pub const EU_PRICE_AEY: u128 = 1_000_000_000;
pub const EU_PRICE_ALNT: u128 = 1;
pub const ONE_AEY: u128 = 1_000_000_000_000_000_000;
pub const ONE_ALNT: u128 = 1_000;
pub const GENESIS_TIME_MS: u64 = 1_767_225_600_000;
pub const SLOT_MS: u64 = 500;

/// Reads committed state at one version.
pub struct VersionView<'a> {
    tree: JellyfishMerkleTree<'a>,
    version: u64,
}

impl StateView for VersionView<'_> {
    fn get(&self, key: &StateKey) -> Result<Option<StateValue>, AletheiaError> {
        self.tree.get(key, self.version)
    }
}

pub struct Devnet {
    pub genesis: GenesisState,
    pub network: NetworkIdentity,
    pub store: MemoryKvStore,
    pub head: BlockHeader,
    pub keys: Vec<Ed25519SigningKey>,
    pub blocks: Vec<(Proposal, ExecutedBlock)>,
    /// State writes merged into the next block's commit: a stand-in for governance
    /// transactions (UpgradePlan, Phase 10) so upgrades can be tested now.
    pub injected: Vec<(StateKey, Option<StateValue>)>,
    /// The epoch of the blocks produced next (epoch transitions are not modelled yet).
    pub epoch: Epoch,
    /// The slot of the next block, when it skips ahead (empty slots, Section 19).
    pub jump_to: Option<Slot>,
}

pub fn seed(index: usize) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes[..8].copy_from_slice(&(index as u64).wrapping_add(0x5eed).to_le_bytes());
    bytes
}

/// The harness's deterministic signing keys (secret keys are not `Clone`; rebuild them).
pub fn keys(count: usize) -> Vec<Ed25519SigningKey> {
    (0..count)
        .map(|i| Ed25519SigningKey::from_seed(&Secret::new(seed(i))))
        .collect()
}

impl Devnet {
    /// `accounts` funded accounts, each with `aey` and `alnt` base units.
    pub fn new(accounts: usize, aey: u128, alnt: u128) -> Devnet {
        Devnet::with_genesis_extra(accounts, aey, alnt, "")
    }

    /// As [`Devnet::new`], with `extra` appended to the genesis TOML (for example a
    /// `[monetary]` section).
    pub fn with_genesis_extra(accounts: usize, aey: u128, alnt: u128, extra: &str) -> Devnet {
        let keys = keys(accounts);
        // Addresses depend only on chain id and network kind, not on genesis_id.
        let provisional = NetworkIdentity::new(
            aletheia_core::ChainId::new(7771),
            aletheia_core::NetworkKind::Devnet,
            Hash32::ZERO,
        );
        let mut toml = format!(
            "[chain]\nchain_id = 7771\nnetwork = \"devnet\"\nprotocol_version = 1\ngenesis_time_ms = {GENESIS_TIME_MS}\nslot_duration_ms = {SLOT_MS}\n\n[fees]\neu_price_aey = \"{EU_PRICE_AEY}\"\neu_price_alnt = \"{EU_PRICE_ALNT}\"\n"
        );
        for key in &keys {
            let address =
                aletheia_crypto::address::ed25519_account(&provisional, &key.public_key())
                    .to_text(aletheia_core::NetworkKind::Devnet);
            for (asset, units) in [("AEY", aey), ("ALnT", alnt)] {
                if units > 0 {
                    toml.push_str(&format!("\n[[allocations]]\naddress = \"{address}\"\nasset = \"{asset}\"\nunits = \"{units}\"\n"));
                }
            }
        }
        toml.push_str(extra);
        Devnet::from_genesis(
            GenesisConfig::from_toml(&toml).unwrap().to_state().unwrap(),
            keys,
        )
    }

    pub fn from_genesis(genesis: GenesisState, keys: Vec<Ed25519SigningKey>) -> Devnet {
        let network = genesis.network();
        let store = MemoryKvStore::new();
        let tree = JellyfishMerkleTree::new(&store, network);
        let mut batch = store.batch();
        let root = tree
            .apply(None, 0, &genesis.initial_changes().unwrap(), &mut batch)
            .unwrap();
        store.write_sync(batch).unwrap();
        let head = genesis.header(root);
        Devnet {
            genesis,
            network,
            store,
            head,
            keys,
            blocks: Vec::new(),
            injected: Vec::new(),
            epoch: Epoch::new(0),
            jump_to: None,
        }
    }

    pub fn records(&self) -> Records {
        Records::new(self.network)
    }

    pub fn view(&self) -> VersionView<'_> {
        VersionView {
            tree: JellyfishMerkleTree::new(&self.store, self.network),
            version: self.head.height.get(),
        }
    }

    pub fn address(&self, index: usize) -> Address {
        aletheia_crypto::address::ed25519_account(&self.network, &self.keys[index].public_key())
    }

    pub fn balance(&self, address: &Address, asset: AssetId) -> Balance {
        self.records()
            .balance(&self.view(), address, asset)
            .unwrap()
    }

    pub fn account(&self, address: &Address) -> Option<Account> {
        self.records().account(&self.view(), address).unwrap()
    }

    pub fn next_nonce(&self, index: usize) -> u64 {
        self.account(&self.address(index))
            .map_or(0, |a| a.next_nonce)
    }

    pub fn next_slot(&self) -> Slot {
        self.jump_to
            .filter(|slot| slot.get() > self.head.slot.get())
            .unwrap_or(Slot::new(self.head.slot.get() + 1))
    }

    /// Produces an empty block `slots` slots after the head, as when the slots between had
    /// no block: protocol time moves on by that much.
    pub fn skip_slots(&mut self, slots: u64) {
        self.jump_to = Some(Slot::new(self.head.slot.get() + slots));
        self.produce(Vec::new()).unwrap();
        self.jump_to = None;
    }

    /// An unsigned body from account `from`; the caller adjusts fields, then [`Devnet::sign`].
    pub fn body(&self, from: usize, nonce: u64, payload: Payload) -> TransactionBody {
        TransactionBody {
            version: TX_BODY_VERSION_1,
            chain_id: self.network.chain_id(),
            network_kind: self.network.network_kind(),
            sender: self.address(from),
            nonce,
            fee: Fee {
                fee_asset: AssetId::ALNT,
                max_fee: 10_000,
                eu_limit: 10_000,
            },
            valid_from_slot: Slot::new(0),
            expiry_slot: Slot::new(7_000),
            memo: Vec::new(),
            payload,
        }
    }

    pub fn sign(&self, from: usize, body: TransactionBody) -> SignedTransaction {
        let key = &self.keys[from];
        let signature = key.sign(&body.signing_digest(&self.network));
        SignedTransaction {
            body,
            authorization: Authorization {
                scheme: AuthScheme::Ed25519,
                threshold: 1,
                public_keys: vec![PublicKeyEntry {
                    alg_id: 1,
                    key: key.public_key().to_bytes().to_vec(),
                }],
                signatures: vec![SignatureEntry {
                    signer_index: 0,
                    alg_id: 1,
                    signature: signature.to_bytes().to_vec(),
                }],
            },
        }
    }

    pub fn transfer(
        &self,
        from: usize,
        nonce: u64,
        to: Address,
        asset: AssetId,
        amount: u128,
    ) -> SignedTransaction {
        self.sign(
            from,
            self.body(
                from,
                nonce,
                Payload::Transfer(TransferLeg {
                    recipient: to,
                    asset,
                    amount,
                }),
            ),
        )
    }

    /// Stateless validation under the rules of the next height.
    pub fn verify(
        &self,
        txs: &[SignedTransaction],
    ) -> Result<Vec<VerifiedTransaction>, AletheiaError> {
        let height = Height::new(self.head.height.get() + 1);
        let (rules, _) = rules_for_height(&self.records(), &self.view(), height)?;
        let validator = StatelessValidator::new(self.network, rules);
        txs.iter()
            .map(|tx| validator.validate(&tx.to_ace_bytes()))
            .collect()
    }

    /// Executes `tx` as the next block's first transaction without committing anything: the
    /// `/transactions/simulate` a submitter calls before signing for real (Section 40D.4).
    pub fn simulate(
        &self,
        tx: &SignedTransaction,
    ) -> Result<aletheia_execution::Receipt, AletheiaError> {
        let verified = self.verify(core::slice::from_ref(tx))?;
        let verified = verified.into_iter().next().ok_or_else(|| {
            AletheiaError::new(
                aletheia_core::ErrorCode::TxFieldOutOfRange,
                "nothing to simulate".to_owned(),
            )
        })?;
        let height = Height::new(self.head.height.get() + 1);
        let records = self.records();
        let view = self.view();
        let slot = self.next_slot();
        let (rules, entry) = rules_for_height(&records, &view, height)?;
        let timing = records.chain_timing(&view)?;
        let ctx = BlockContext {
            height,
            slot,
            epoch: self.epoch,
            protocol_time_ms: timing.protocol_time_ms(slot)?,
            proposer: ValidatorIndex::new(0),
            parent_hash: self.head.block_hash(&self.network),
            protocol_version: aletheia_core::ProtocolVersion::new(entry.protocol_version),
        };
        let mut overlay = aletheia_state::StateOverlay::new(&view);
        rules
            .apply_transaction(&records, &mut overlay, &verified, &ctx, 0)
            .map(|(receipt, _)| receipt)
    }

    /// Schedules `version` to activate at `activation_height`, committed with the next block.
    pub fn schedule_upgrade(&mut self, version: u16, activation_height: u64) {
        let entry = aletheia_execution::model::ProtocolScheduleEntry {
            protocol_version: version,
            activation_height,
            activation_epoch: 0,
            upgrade_id: Hash32::from_bytes([version as u8; 32]),
            binary_hashes: Vec::new(),
            migration_id: None,
            recorded_at_height: self.head.height.get() + 1,
        };
        let records = self.records();
        self.injected
            .push((records.schedule_key(version), Some(entry.to_ace_bytes())));
    }

    /// Verifies, orders canonically, executes and commits the next block.
    pub fn produce(
        &mut self,
        txs: Vec<SignedTransaction>,
    ) -> Result<(Proposal, ExecutedBlock), AletheiaError> {
        let verified = self.verify(&txs)?;
        let parent_hash = self.head.block_hash(&self.network);
        let records = self.records();
        let order = {
            let view = self.view();
            canonical_order(&self.network, &parent_hash, &verified, &mut |sender| {
                Ok(records.account(&view, sender)?.map_or(0, |a| a.next_nonce))
            })?
        };
        let ordered: Vec<VerifiedTransaction> =
            order.iter().map(|&i| verified[i].clone()).collect();
        self.execute_ordered(ordered)
    }

    /// Executes transactions in exactly the given order (to test order enforcement).
    pub fn execute_ordered(
        &mut self,
        ordered: Vec<VerifiedTransaction>,
    ) -> Result<(Proposal, ExecutedBlock), AletheiaError> {
        let height = Height::new(self.head.height.get() + 1);
        let records = self.records();
        let parent_hash = self.head.block_hash(&self.network);
        let slot = self.next_slot();
        let (rules, entry) = rules_for_height(&records, &self.view(), height)?;
        let timing = records.chain_timing(&self.view())?;
        let ctx = BlockContext {
            height,
            slot,
            epoch: self.epoch,
            protocol_time_ms: timing.protocol_time_ms(slot)?,
            proposer: ValidatorIndex::new(0),
            parent_hash,
            protocol_version: aletheia_core::ProtocolVersion::new(entry.protocol_version),
        };
        let mut executed = execute_block(rules, &records, &self.view(), &ctx, &ordered)?;
        if !self.injected.is_empty() {
            let mut merged: std::collections::BTreeMap<StateKey, Option<StateValue>> =
                executed.changes.into_iter().collect();
            merged.extend(self.injected.drain(..));
            executed.changes = merged.into_iter().collect();
        }
        let tree = JellyfishMerkleTree::new(&self.store, self.network);
        let mut batch = self.store.batch();
        let state_root = tree.apply(
            Some(self.head.height.get()),
            height.get(),
            &executed.changes,
            &mut batch,
        )?;
        let header = BlockHeader {
            version: ctx.protocol_version,
            chain_id: self.network.chain_id(),
            height,
            epoch: ctx.epoch,
            slot,
            protocol_time_ms: ctx.protocol_time_ms,
            proposer: ctx.proposer,
            parent_hash,
            parent_qc: QuorumCertificate::genesis(),
            timeout_cert: None,
            tx_root: executed.tx_root,
            receipt_root: executed.receipt_root,
            state_root,
            event_root: executed.event_root,
            validator_set_hash: Hash32::ZERO,
            next_validator_set_hash: Hash32::ZERO,
            monetary_root: Hash32::ZERO,
            eu_used: executed.eu_used,
            tx_count: executed.tx_count,
            extensions: Vec::new(),
        };
        self.store.write_sync(batch)?;
        let proposal = Proposal {
            block: Block {
                header: header.clone(),
                body: BlockBody {
                    transactions: ordered.iter().map(|v| v.transaction().clone()).collect(),
                },
            },
            proposer_signature: [0; 96],
        };
        self.head = header;
        self.blocks.push((proposal.clone(), executed.clone()));
        Ok((proposal, executed))
    }
}
