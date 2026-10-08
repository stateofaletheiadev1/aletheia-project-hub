//! The ledger: the finalize path and crash recovery (spec Sections 20, 24).
//!
//! Finalizing block `h` (Section 24.2 fsync policy):
//!
//! ```text
//! 1. WAL FINALIZE_BEGIN(h, hash)                          synced
//! 2. archive append                                       synced
//! 3. one KV batch: JMT nodes + values, receipts, tx and   synced
//!    block index, Meta last_finalized
//! 4. WAL FINALIZE_COMMITTED(h, hash)                      synced
//! ```
//!
//! Recovery (Section 24.3, single node): lock the directory, verify the WAL (torn tail
//! truncated, anything else refuses), read `last_finalized`, re-verify its archived block and
//! its JMT root, then reconcile an unfinished finalize: if the KV commit landed, record
//! FINALIZE_COMMITTED; if only the archive append landed, re-execute the archived block and
//! commit it; if neither, the block was never finalized here and consensus will deliver it
//! again. A node never continues from state it has not verified.
//!
//! Speculative execution (Section 19.3): under DSP a block is executed, voted on and built
//! upon before it is final. Its results are kept in memory, keyed by block hash, with the JMT
//! nodes it would write held in a batch. A child executes through a [`LayeredStore`] of the
//! base store and its uncommitted ancestors' batches. Finalizing re-applies the block to the
//! real store through the path above, so nothing speculative ever reaches disk unverified.
//!
//! Consensus safety data (Section 24.2) is a synced `SAFETY_DATA` WAL record, written before
//! the vote or timeout it authorizes is sent. Recovery restores the last one; every checkpoint
//! is followed by a fresh copy so pruning old segments can never lose it. A finality proof is
//! committed in the same KV batch as the block it finalizes.

use std::path::Path;

use aletheia_consensus::{FinalityProof, SafetyData};
use aletheia_core::block::Proposal;
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32, Height,
    NetworkIdentity,
};
use aletheia_execution::continuity::rules_for_height;
use aletheia_execution::model::{ValidatorRecord, validator_records_hash};
use aletheia_execution::{
    BlockContext, ExecutedBlock, GenesisState, Records, StatelessValidator, VerifiedTransaction,
    check_header_results, execute_block,
};
use aletheia_state::{JellyfishMerkleTree, StateKey, StateValue, StateView};
use aletheia_storage::archive::{ArchiveConfig, BlockArchive, index_entries};
use aletheia_storage::datadir::{DataDir, DataDirManifest, LastFinalized, StartupAction, decide};
use aletheia_storage::wal::{RecordType, Wal, WalConfig};
use aletheia_storage::{ColumnFamily, KvStore, LayeredStore, WriteBatch};

const META_LAST_FINALIZED: &[u8] = b"last_finalized";
const RELEASE: &str = concat!("aletheiad ", env!("CARGO_PKG_VERSION"));

/// Where a test may simulate a crash inside the finalize path.
#[cfg(feature = "fault-injection")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CrashPoint {
    AfterFinalizeBegin,
    AfterArchiveAppend,
    AfterKvCommit,
}

/// What recovery found and did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Reconciled {
    Clean,
    /// The KV commit had landed; FINALIZE_COMMITTED was recorded.
    CommitRecorded(Height),
    /// Only the archive append had landed; the block was re-executed and committed.
    ReExecuted(Height),
    /// Nothing durable beyond the WAL record; the block was not finalized here.
    Abandoned(Height),
}

fn finalize_payload(height: Height, hash: &Hash32) -> Vec<u8> {
    let mut out = AceWriter::new();
    height.encode(&mut out);
    hash.encode(&mut out);
    out.into_bytes()
}

fn parse_finalize_payload(payload: &[u8]) -> Result<(Height, Hash32), AletheiaError> {
    let mut reader = AceReader::new(payload);
    let parsed = (Height::decode(&mut reader)?, Hash32::decode(&mut reader)?);
    reader.finish()?;
    Ok(parsed)
}

fn receipt_key(height: Height, index: u32) -> [u8; 12] {
    let mut key = [0u8; 12];
    key[..8].copy_from_slice(&height.get().to_be_bytes());
    key[8..].copy_from_slice(&index.to_be_bytes());
    key
}

/// Reads committed state at one version.
struct VersionView<'a> {
    tree: JellyfishMerkleTree<'a>,
    version: u64,
}

impl StateView for VersionView<'_> {
    fn get(&self, key: &StateKey) -> Result<Option<StateValue>, AletheiaError> {
        self.tree.get(key, self.version)
    }
}

/// A block executed on a parent that is not final yet.
#[derive(Debug, Clone)]
struct Speculative {
    proposal: Proposal,
    executed: ExecutedBlock,
    /// The JMT nodes and values this block writes, read by its descendants.
    nodes: WriteBatch,
}

/// Where a new block attaches: the parent's height, hash and the protocol-time slot it was
/// built in.
#[derive(Debug, Clone, Copy)]
struct Parent {
    height: Height,
    hash: Hash32,
}

/// Header fields chosen by consensus for a block this node builds.
#[derive(Debug, Clone)]
pub struct BuildParams {
    pub slot: aletheia_core::Slot,
    pub epoch: aletheia_core::Epoch,
    pub proposer: aletheia_core::ValidatorIndex,
    /// Certifies the parent; the parent is `parent_qc.block_hash`.
    pub parent_qc: aletheia_core::block::QuorumCertificate,
    pub timeout_cert: Option<aletheia_core::block::TimeoutCertificate>,
}

pub struct Ledger<S: KvStore> {
    datadir: DataDir,
    store: S,
    archive: BlockArchive,
    wal: Wal,
    network: NetworkIdentity,
    tip: LastFinalized,
    speculative: std::collections::BTreeMap<Hash32, Speculative>,
    /// The last safety data made durable, restored from the WAL at start-up.
    safety: Option<SafetyData>,
    #[cfg(feature = "fault-injection")]
    crash_at: Option<CrashPoint>,
}

impl<S: KvStore> core::fmt::Debug for Ledger<S> {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Ledger")
            .field("network", &self.network)
            .field("tip", &self.tip)
            .finish_non_exhaustive()
    }
}

fn fail_stop(code: ErrorCode, detail: String) -> AletheiaError {
    AletheiaError::new(code, detail)
}

impl<S: KvStore> Ledger<S> {
    /// Creates a new data directory from genesis and commits height 0.
    pub fn init(root: &Path, genesis: &GenesisState, store: S) -> Result<Ledger<S>, AletheiaError> {
        let network = genesis.network();
        let datadir = DataDir::create(root, DataDirManifest::new(&network, RELEASE))?;
        let tree = JellyfishMerkleTree::new(&store, network);
        let mut batch = store.batch();
        let state_root = tree.apply(None, 0, &genesis.initial_changes()?, &mut batch)?;
        let header = genesis.header(state_root);
        let hash = header.block_hash(&network);
        let proposal = Proposal {
            block: aletheia_core::block::Block {
                header,
                body: aletheia_core::block::BlockBody {
                    transactions: Vec::new(),
                },
            },
            proposer_signature: [0; 96],
        };
        let mut archive = BlockArchive::open(
            &datadir.path("blocks"),
            network,
            ArchiveConfig::default(),
            None,
        )?;
        let location = archive.append(&proposal)?;
        index_entries(&mut batch, Height::GENESIS, &hash, location);
        let tip = LastFinalized {
            height: Height::GENESIS,
            hash,
            state_root,
        };
        batch.put(ColumnFamily::Meta, META_LAST_FINALIZED, &tip.to_ace_bytes());
        store.write_sync(batch)?;
        let (mut wal, _) = Wal::open(&datadir.path("wal"), WalConfig::default())?;
        wal.append(
            RecordType::Checkpoint,
            &finalize_payload(tip.height, &tip.hash),
        )?;
        wal.sync()?;
        Ok(Ledger {
            datadir,
            store,
            archive,
            wal,
            network,
            tip,
            speculative: std::collections::BTreeMap::new(),
            safety: None,
            #[cfg(feature = "fault-injection")]
            crash_at: None,
        })
    }

    /// Opens an existing directory and recovers to a verified finalized tip.
    pub fn open(
        root: &Path,
        genesis: &GenesisState,
        store: S,
    ) -> Result<(Ledger<S>, Reconciled), AletheiaError> {
        let network = genesis.network();
        let datadir = DataDir::open(root)?;
        match decide(
            datadir.manifest(),
            &network,
            aletheia_storage::datadir::BINARY_STORAGE_SCHEMA,
        )? {
            StartupAction::Recover | StartupAction::OpenNewer { .. } => {}
            StartupAction::Migrate { from, to } => {
                return Err(fail_stop(
                    ErrorCode::StoMigrationFailed,
                    format!(
                        "storage schema {from} needs migration to {to}; no steps are registered yet"
                    ),
                ));
            }
            StartupAction::ResumeMigration(migration) => {
                return Err(fail_stop(
                    ErrorCode::StoMigrationFailed,
                    format!(
                        "interrupted migration {}->{} must be resumed first",
                        migration.from, migration.to
                    ),
                ));
            }
        }
        let (wal, recovery) = Wal::open(&datadir.path("wal"), WalConfig::default())?;

        let stored = store
            .get(ColumnFamily::Meta, META_LAST_FINALIZED)?
            .ok_or_else(|| {
                fail_stop(
                    ErrorCode::StoCorrupt,
                    "state database has no last_finalized marker".to_owned(),
                )
            })?;
        let tip = LastFinalized::from_ace_bytes(&stored).map_err(|e| {
            fail_stop(
                ErrorCode::StoCorrupt,
                format!("last_finalized marker: {}", e.detail()),
            )
        })?;
        // The archive must know which record is finalized before it decides what a torn tail is.
        let tip_location = store
            .get(
                ColumnFamily::BlockIndex,
                &aletheia_storage::archive::height_key(tip.height),
            )?
            .map(|bytes| aletheia_storage::archive::ArchiveLocation::from_ace_bytes(&bytes))
            .transpose()
            .map_err(|e| {
                fail_stop(
                    ErrorCode::StoCorrupt,
                    format!("block index entry: {}", e.detail()),
                )
            })?;
        let archive = BlockArchive::open(
            &datadir.path("blocks"),
            network,
            ArchiveConfig::default(),
            tip_location,
        )?;

        let mut ledger = Ledger {
            datadir,
            store,
            archive,
            wal,
            network,
            tip,
            speculative: std::collections::BTreeMap::new(),
            safety: None,
            #[cfg(feature = "fault-injection")]
            crash_at: None,
        };
        ledger.verify_tip()?;

        // Step 7: the last FINALIZE_BEGIN without a matching FINALIZE_COMMITTED.
        let mut open_finalize: Option<(Height, Hash32)> = None;
        for record in &recovery.records {
            match record.kind {
                RecordType::SafetyData => {
                    ledger.safety =
                        Some(SafetyData::from_ace_bytes(&record.payload).map_err(|e| {
                            fail_stop(
                                ErrorCode::StoCorrupt,
                                format!("WAL safety data: {}", e.detail()),
                            )
                        })?);
                }
                RecordType::FinalizeBegin => {
                    open_finalize = Some(parse_finalize_payload(&record.payload)?)
                }
                RecordType::FinalizeCommitted => {
                    let committed = parse_finalize_payload(&record.payload)?;
                    if open_finalize == Some(committed) {
                        open_finalize = None;
                    }
                }
                _ => {}
            }
        }
        let reconciled = match open_finalize {
            None => Reconciled::Clean,
            Some((height, hash)) if height == ledger.tip.height && hash == ledger.tip.hash => {
                ledger.wal.append(
                    RecordType::FinalizeCommitted,
                    &finalize_payload(height, &hash),
                )?;
                Reconciled::CommitRecorded(height)
            }
            Some((height, hash)) if Some(height) == ledger.tip.height.next().ok() => {
                match ledger.archive.find(height)? {
                    Some(location) => {
                        let proposal = ledger.archive.read(location, height)?;
                        if proposal.block.header.block_hash(&network) != hash {
                            return Err(fail_stop(
                                ErrorCode::StoArchiveMismatch,
                                format!(
                                    "archived block at height {height} is not the one the WAL began finalizing"
                                ),
                            ));
                        }
                        let executed = ledger.execute(&proposal)?;
                        ledger.commit(&proposal, &executed, location, None)?;
                        Reconciled::ReExecuted(height)
                    }
                    None => {
                        ledger.wal.append(
                            RecordType::Checkpoint,
                            &finalize_payload(ledger.tip.height, &ledger.tip.hash),
                        )?;
                        if let Some(safety) = ledger.safety {
                            ledger
                                .wal
                                .append(RecordType::SafetyData, &safety.to_ace_bytes())?;
                        }
                        Reconciled::Abandoned(height)
                    }
                }
            }
            Some((height, _)) => {
                return Err(fail_stop(
                    ErrorCode::FinalizeOutOfOrder,
                    format!(
                        "WAL began finalizing height {height}, but the state database is at {}",
                        ledger.tip.height
                    ),
                ));
            }
        };
        ledger.wal.sync()?;
        Ok((ledger, reconciled))
    }

    /// Steps 5 and 6: the tip's archived block hashes to the recorded hash and the JMT root at
    /// its height equals the recorded state root.
    fn verify_tip(&self) -> Result<(), AletheiaError> {
        let height = self.tip.height;
        let location = self
            .store
            .get(
                ColumnFamily::BlockIndex,
                &aletheia_storage::archive::height_key(height),
            )?
            .ok_or_else(|| {
                fail_stop(
                    ErrorCode::StoCorrupt,
                    format!("block index has no entry for finalized height {height}"),
                )
            })?;
        let location = aletheia_storage::archive::ArchiveLocation::from_ace_bytes(&location)
            .map_err(|e| {
                fail_stop(
                    ErrorCode::StoCorrupt,
                    format!("block index entry: {}", e.detail()),
                )
            })?;
        let proposal = self.archive.read(location, height)?;
        if proposal.block.header.block_hash(&self.network) != self.tip.hash
            || proposal.block.header.state_root != self.tip.state_root
        {
            return Err(fail_stop(
                ErrorCode::StoArchiveMismatch,
                format!(
                    "archived block at finalized height {height} disagrees with last_finalized"
                ),
            ));
        }
        let root = JellyfishMerkleTree::new(&self.store, self.network).root_hash(height.get())?;
        if root != self.tip.state_root {
            return Err(fail_stop(
                ErrorCode::StoCorrupt,
                format!(
                    "JMT root at height {height} is {root}, last_finalized says {}",
                    self.tip.state_root
                ),
            ));
        }
        self.verify_supply()
    }

    /// Finalized supply ledgers satisfy I1-I8 (Section 18.4). A violation here should be
    /// impossible, since every block was checked before it was finalized, so it is a
    /// fail-stop and the node never repairs balances itself.
    fn verify_supply(&self) -> Result<(), AletheiaError> {
        let records = Records::new(self.network);
        let view = self.tip_view();
        for asset in [aletheia_core::AssetId::AEY, aletheia_core::AssetId::ALNT] {
            if let Some(ledger) = records.supply_ledger(&view, asset)? {
                ledger.check(asset).map_err(|error| {
                    fail_stop(
                        ErrorCode::MonetaryInvariantViolatedFinalized,
                        format!(
                            "finalized state at height {}: {}",
                            self.tip.height,
                            error.detail()
                        ),
                    )
                })?;
            }
        }
        Ok(())
    }

    pub fn tip(&self) -> LastFinalized {
        self.tip
    }

    pub fn network(&self) -> &NetworkIdentity {
        &self.network
    }

    pub fn store(&self) -> &S {
        &self.store
    }

    #[cfg(feature = "fault-injection")]
    pub fn crash_at(&mut self, point: CrashPoint) {
        self.crash_at = Some(point);
    }

    #[cfg(feature = "fault-injection")]
    fn maybe_crash(&self, point: CrashPoint) -> Result<(), AletheiaError> {
        if self.crash_at == Some(point) {
            return Err(AletheiaError::new(
                ErrorCode::StoIo,
                format!("simulated crash {point:?}"),
            ));
        }
        Ok(())
    }

    /// The uncommitted ancestors of `parent` (inclusive), oldest first, ending at the tip.
    /// `None` when `parent` is neither the tip nor a block speculatively executed on it.
    fn lineage(&self, parent: &Hash32) -> Option<(Parent, Vec<&Speculative>)> {
        let mut chain = Vec::new();
        let mut cursor = *parent;
        while cursor != self.tip.hash {
            let block = self.speculative.get(&cursor)?;
            chain.push(block);
            cursor = block.proposal.block.header.parent_hash;
        }
        chain.reverse();
        let attach = match chain.last() {
            Some(last) => Parent {
                height: last.proposal.block.header.height,
                hash: *parent,
            },
            None => Parent {
                height: self.tip.height,
                hash: self.tip.hash,
            },
        };
        Some((attach, chain))
    }

    /// Validator path: stateless checks, re-execution on the parent's state, header
    /// comparison. Returns the result and the JMT writes it implies.
    fn execute_on(
        &self,
        store: &dyn KvStore,
        parent: Parent,
        proposal: &Proposal,
    ) -> Result<(ExecutedBlock, WriteBatch), AletheiaError> {
        let header = &proposal.block.header;
        if header.height != parent.height.next()? || header.parent_hash != parent.hash {
            return Err(fail_stop(
                ErrorCode::BlkParentMismatch,
                format!(
                    "block at height {} does not extend height {} ({})",
                    header.height, parent.height, parent.hash
                ),
            ));
        }
        let records = Records::new(self.network);
        let view = VersionView {
            tree: JellyfishMerkleTree::new(store, self.network),
            version: parent.height.get(),
        };
        let (rules, entry) = rules_for_height(&records, &view, header.height)?;
        if header.version.get() != entry.protocol_version {
            return Err(fail_stop(
                ErrorCode::BlkVersionMismatch,
                format!(
                    "header version {} at height {}; schedule says {}",
                    header.version, header.height, entry.protocol_version
                ),
            ));
        }
        let timing = records.chain_timing(&view)?;
        if header.protocol_time_ms != timing.protocol_time_ms(header.slot)? {
            return Err(fail_stop(
                ErrorCode::BlkTimeMismatch,
                format!(
                    "protocol time {} does not match slot {}",
                    header.protocol_time_ms, header.slot
                ),
            ));
        }
        let set_hash = self.validator_set_hash(&view, header.epoch)?;
        if header.validator_set_hash != set_hash || header.next_validator_set_hash != set_hash {
            return Err(fail_stop(
                ErrorCode::BlkValidatorSetMismatch,
                format!(
                    "block at height {} commits to validator set {}, state has {set_hash}",
                    header.height, header.validator_set_hash
                ),
            ));
        }
        let validator = StatelessValidator::new(self.network, rules);
        let verified = proposal
            .block
            .body
            .transactions
            .iter()
            .map(|tx| validator.validate(&tx.to_ace_bytes()))
            .collect::<Result<Vec<_>, _>>()?;
        let ctx = BlockContext {
            height: header.height,
            slot: header.slot,
            epoch: header.epoch,
            protocol_time_ms: header.protocol_time_ms,
            proposer: header.proposer,
            parent_hash: header.parent_hash,
            protocol_version: header.version,
        };
        let executed = execute_block(rules, &records, &view, &ctx, &verified)?;
        let mut nodes = WriteBatch::new();
        let state_root = JellyfishMerkleTree::new(store, self.network).apply(
            Some(parent.height.get()),
            header.height.get(),
            &executed.changes,
            &mut nodes,
        )?;
        check_header_results(&self.network, header, &executed, &state_root)?;
        Ok((executed, nodes))
    }

    /// `validator_set_hash` for `epoch` as state records it; zero for a chain without
    /// validators (the devnet producer).
    fn validator_set_hash(
        &self,
        view: &dyn StateView,
        epoch: aletheia_core::Epoch,
    ) -> Result<Hash32, AletheiaError> {
        Ok(Records::new(self.network)
            .validator_set(view, epoch.get())?
            .map_or(Hash32::ZERO, |members| {
                validator_records_hash(&self.network, epoch, &members)
            }))
    }

    /// Validator path on the finalized tip.
    pub fn execute(&self, proposal: &Proposal) -> Result<ExecutedBlock, AletheiaError> {
        let parent = Parent {
            height: self.tip.height,
            hash: self.tip.hash,
        };
        self.execute_on(&self.store, parent, proposal)
            .map(|(executed, _)| executed)
    }

    /// Executes a block on its parent, which may itself be speculative, and keeps the result
    /// for finalization and for descendants. An unknown parent is an ordinary error: consensus
    /// only hands out blocks whose ancestors it holds, so this means they diverged.
    pub fn execute_speculative(&mut self, proposal: &Proposal) -> Result<(), AletheiaError> {
        let hash = proposal.block.header.block_hash(&self.network);
        if self.speculative.contains_key(&hash) {
            return Ok(());
        }
        let parent_hash = proposal.block.header.parent_hash;
        let (parent, chain) = self.lineage(&parent_hash).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::BlkParentMismatch,
                format!("block {hash} extends {parent_hash}, which this node has not executed"),
            )
        })?;
        let layered = LayeredStore::new(&self.store, chain.iter().map(|b| &b.nodes).collect());
        let (executed, nodes) = self.execute_on(&layered, parent, proposal)?;
        self.speculative.insert(
            hash,
            Speculative {
                proposal: proposal.clone(),
                executed,
                nodes,
            },
        );
        Ok(())
    }

    /// Finalizes a block executed with [`Ledger::execute_speculative`]; it must extend the
    /// tip. `proof` is stored with it (consensus passes it for the last block of each finalized
    /// run). Speculative blocks that no longer descend from the new tip are dropped.
    pub fn finalize_speculative(
        &mut self,
        hash: &Hash32,
        proof: Option<&FinalityProof>,
    ) -> Result<(), AletheiaError> {
        let block = self.speculative.remove(hash).ok_or_else(|| {
            fail_stop(
                ErrorCode::FinalizeParentMismatch,
                format!("consensus finalized {hash}, which this node never executed"),
            )
        })?;
        self.finalize_with_proof(&block.proposal, &block.executed, proof)?;
        self.prune_speculative();
        Ok(())
    }

    fn prune_speculative(&mut self) {
        let tip = self.tip;
        self.speculative
            .retain(|_, block| block.proposal.block.header.height > tip.height);
        loop {
            let orphaned: Vec<Hash32> = self
                .speculative
                .iter()
                .filter(|(_, block)| {
                    let parent = block.proposal.block.header.parent_hash;
                    parent != tip.hash && !self.speculative.contains_key(&parent)
                })
                .map(|(hash, _)| *hash)
                .collect();
            if orphaned.is_empty() {
                break;
            }
            for hash in orphaned {
                self.speculative.remove(&hash);
            }
        }
    }

    /// Blocks executed but not final.
    pub fn speculative_len(&self) -> usize {
        self.speculative.len()
    }

    /// Finalizes a block that [`Ledger::execute`] accepted.
    pub fn finalize(
        &mut self,
        proposal: &Proposal,
        executed: &ExecutedBlock,
    ) -> Result<(), AletheiaError> {
        self.finalize_with_proof(proposal, executed, None)
    }

    /// Finalizes and, under consensus, commits the block's finality proof with it.
    fn finalize_with_proof(
        &mut self,
        proposal: &Proposal,
        executed: &ExecutedBlock,
        proof: Option<&FinalityProof>,
    ) -> Result<(), AletheiaError> {
        let header = &proposal.block.header;
        if header.height != self.tip.height.next()? {
            return Err(fail_stop(
                ErrorCode::FinalizeOutOfOrder,
                format!(
                    "finalize height {} after {}",
                    header.height, self.tip.height
                ),
            ));
        }
        if header.parent_hash != self.tip.hash {
            return Err(fail_stop(
                ErrorCode::FinalizeParentMismatch,
                format!("block {} does not extend {}", header.height, self.tip.hash),
            ));
        }
        let hash = header.block_hash(&self.network);
        self.wal.append(
            RecordType::FinalizeBegin,
            &finalize_payload(header.height, &hash),
        )?;
        #[cfg(feature = "fault-injection")]
        self.maybe_crash(CrashPoint::AfterFinalizeBegin)?;
        let location = self.archive.append(proposal)?;
        #[cfg(feature = "fault-injection")]
        self.maybe_crash(CrashPoint::AfterArchiveAppend)?;
        self.commit(proposal, executed, location, proof)
    }

    fn commit(
        &mut self,
        proposal: &Proposal,
        executed: &ExecutedBlock,
        location: aletheia_storage::archive::ArchiveLocation,
        proof: Option<&FinalityProof>,
    ) -> Result<(), AletheiaError> {
        let header = &proposal.block.header;
        let hash = header.block_hash(&self.network);
        let mut batch = self.store.batch();
        if let Some(proof) = proof {
            batch.put(
                ColumnFamily::FinalityProofs,
                &header.height.get().to_be_bytes(),
                &proof.to_ace_bytes(),
            );
        }
        let state_root = JellyfishMerkleTree::new(&self.store, self.network).apply(
            Some(self.tip.height.get()),
            header.height.get(),
            &executed.changes,
            &mut batch,
        )?;
        if state_root != header.state_root {
            return Err(fail_stop(
                ErrorCode::FinalizeStateDiverged,
                format!(
                    "height {}: computed state root {state_root}, header {}",
                    header.height, header.state_root
                ),
            ));
        }
        for (index, receipt) in (0u32..).zip(&executed.receipts) {
            batch.put(
                ColumnFamily::Receipts,
                &receipt_key(header.height, index),
                &receipt.to_ace_bytes(),
            );
            let mut position = header.height.to_ace_bytes();
            position.extend_from_slice(&index.to_le_bytes());
            batch.put(ColumnFamily::TxIndex, receipt.tx_id.as_bytes(), &position);
        }
        index_entries(&mut batch, header.height, &hash, location);
        let tip = LastFinalized {
            height: header.height,
            hash,
            state_root,
        };
        batch.put(ColumnFamily::Meta, META_LAST_FINALIZED, &tip.to_ace_bytes());
        self.store.write_sync(batch)?;
        #[cfg(feature = "fault-injection")]
        self.maybe_crash(CrashPoint::AfterKvCommit)?;
        self.wal.append(
            RecordType::FinalizeCommitted,
            &finalize_payload(header.height, &hash),
        )?;
        self.tip = tip;
        Ok(())
    }

    fn tip_view(&self) -> VersionView<'_> {
        VersionView {
            tree: JellyfishMerkleTree::new(&self.store, self.network),
            version: self.tip.height.get(),
        }
    }

    /// Start-up step 6 (Section 46A.2): this binary must support the protocol version the
    /// schedule assigns to `tip + 1`, or the node stops cleanly with exit status 75.
    pub fn check_next_height_supported(&self) -> Result<(), AletheiaError> {
        let records = Records::new(self.network);
        rules_for_height(&records, &self.tip_view(), self.tip.height.next()?).map(|_| ())
    }

    /// A finalized block by height, read and verified from the archive (block sync serves
    /// these to peers).
    pub fn read_block(&self, height: Height) -> Result<Option<Proposal>, AletheiaError> {
        if height > self.tip.height {
            return Ok(None);
        }
        let Some(bytes) = self.store.get(
            ColumnFamily::BlockIndex,
            &aletheia_storage::archive::height_key(height),
        )?
        else {
            return Ok(None);
        };
        let location =
            aletheia_storage::archive::ArchiveLocation::from_ace_bytes(&bytes).map_err(|e| {
                fail_stop(
                    ErrorCode::StoCorrupt,
                    format!("block index entry at {height}: {}", e.detail()),
                )
            })?;
        self.archive.read(location, height).map(Some)
    }

    /// Mempool admission (Section 21): stateless validation under the rules of the next height,
    /// then the sender's next nonce from the tip so the mempool can tell ready from future.
    pub fn admit(&self, bytes: &[u8]) -> Result<(VerifiedTransaction, u64), AletheiaError> {
        let records = Records::new(self.network);
        let view = self.tip_view();
        let (rules, _) = rules_for_height(&records, &view, self.tip.height.next()?)?;
        let verified = StatelessValidator::new(self.network, rules).validate(bytes)?;
        let body = &verified.transaction().body;
        let next_nonce = records
            .account(&view, &body.sender)?
            .map_or(0, |account| account.next_nonce);
        if body.nonce < next_nonce {
            return Err(AletheiaError::new(
                ErrorCode::TxNonceTooLow,
                format!("nonce {} is below next nonce {next_nonce}", body.nonce),
            ));
        }
        Ok((verified, next_nonce))
    }

    /// The sender's next nonce at the tip.
    pub fn next_nonce(&self, sender: &aletheia_core::Address) -> Result<u64, AletheiaError> {
        Ok(Records::new(self.network)
            .account(&self.tip_view(), sender)?
            .map_or(0, |account| account.next_nonce))
    }

    /// Builds a block on the tip at `slot` from candidate transactions, for the single-node
    /// devnet producer: genesis QC, proposer 0, zero signature.
    pub fn propose(
        &self,
        candidates: Vec<VerifiedTransaction>,
        slot: aletheia_core::Slot,
    ) -> Result<(Proposal, ExecutedBlock), AletheiaError> {
        let params = BuildParams {
            slot,
            epoch: aletheia_core::Epoch::new(0),
            proposer: aletheia_core::ValidatorIndex::new(0),
            parent_qc: aletheia_core::block::QuorumCertificate::genesis(),
            timeout_cert: None,
        };
        let parent = Parent {
            height: self.tip.height,
            hash: self.tip.hash,
        };
        self.build_on(&self.store, parent, candidates, params)
    }

    /// Builds an unsigned block for consensus on `params.parent_qc.block_hash`, which may be
    /// speculative. Consensus signs it and hands it back for execution like any proposal.
    pub fn build(
        &self,
        candidates: Vec<VerifiedTransaction>,
        params: BuildParams,
    ) -> Result<Proposal, AletheiaError> {
        let parent_hash = params.parent_qc.block_hash;
        let (parent, chain) = self.lineage(&parent_hash).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::BlkParentMismatch,
                format!("cannot build on {parent_hash}: this node has not executed it"),
            )
        })?;
        let layered = LayeredStore::new(&self.store, chain.iter().map(|b| &b.nodes).collect());
        self.build_on(&layered, parent, candidates, params)
            .map(|(proposal, _)| proposal)
    }

    fn build_on(
        &self,
        store: &dyn KvStore,
        parent: Parent,
        candidates: Vec<VerifiedTransaction>,
        params: BuildParams,
    ) -> Result<(Proposal, ExecutedBlock), AletheiaError> {
        let records = Records::new(self.network);
        let view = VersionView {
            tree: JellyfishMerkleTree::new(store, self.network),
            version: parent.height.get(),
        };
        let height = parent.height.next()?;
        let (rules, entry) = rules_for_height(&records, &view, height)?;
        let timing = records.chain_timing(&view)?;
        let ctx = BlockContext {
            height,
            slot: params.slot,
            epoch: params.epoch,
            protocol_time_ms: timing.protocol_time_ms(params.slot)?,
            proposer: params.proposer,
            parent_hash: parent.hash,
            protocol_version: aletheia_core::ProtocolVersion::new(entry.protocol_version),
        };
        let included =
            aletheia_execution::builder::select(rules, &records, &view, &ctx, candidates)?;
        let executed = execute_block(rules, &records, &view, &ctx, &included)?;
        let mut scratch = WriteBatch::new();
        let state_root = JellyfishMerkleTree::new(store, self.network).apply(
            Some(parent.height.get()),
            height.get(),
            &executed.changes,
            &mut scratch,
        )?;
        let set_hash = self.validator_set_hash(&view, params.epoch)?;
        let header = aletheia_core::block::BlockHeader {
            version: ctx.protocol_version,
            chain_id: self.network.chain_id(),
            height,
            epoch: ctx.epoch,
            slot: params.slot,
            protocol_time_ms: ctx.protocol_time_ms,
            proposer: ctx.proposer,
            parent_hash: parent.hash,
            parent_qc: params.parent_qc,
            timeout_cert: params.timeout_cert,
            tx_root: executed.tx_root,
            receipt_root: executed.receipt_root,
            state_root,
            event_root: executed.event_root,
            validator_set_hash: set_hash,
            next_validator_set_hash: set_hash,
            monetary_root: Hash32::ZERO,
            eu_used: executed.eu_used,
            tx_count: executed.tx_count,
            extensions: Vec::new(),
        };
        let body = aletheia_core::block::BlockBody {
            transactions: included.iter().map(|tx| tx.transaction().clone()).collect(),
        };
        Ok((
            Proposal {
                block: aletheia_core::block::Block { header, body },
                proposer_signature: [0; 96],
            },
            executed,
        ))
    }

    /// Validates and finalizes in one step (single-node operation until consensus exists).
    pub fn apply(&mut self, proposal: &Proposal) -> Result<ExecutedBlock, AletheiaError> {
        self.apply_with_proof(proposal, None)
    }

    /// Block sync under consensus: a block proven final by a peer, re-executed on the tip.
    pub fn apply_with_proof(
        &mut self,
        proposal: &Proposal,
        proof: Option<&FinalityProof>,
    ) -> Result<ExecutedBlock, AletheiaError> {
        let executed = self.execute(proposal)?;
        self.finalize_with_proof(proposal, &executed, proof)?;
        self.prune_speculative();
        Ok(executed)
    }

    /// Makes consensus safety data durable (synced) before what it authorizes is sent.
    pub fn persist_safety(&mut self, safety: &SafetyData) -> Result<(), AletheiaError> {
        self.wal
            .append(RecordType::SafetyData, &safety.to_ace_bytes())?;
        self.wal.sync()?;
        self.safety = Some(*safety);
        Ok(())
    }

    /// The safety data restored at start-up or last persisted.
    pub fn safety(&self) -> Option<SafetyData> {
        self.safety
    }

    /// The round (slot) of the finalized tip block, where consensus resumes.
    pub fn tip_round(&self) -> Result<aletheia_core::Slot, AletheiaError> {
        let block = self.read_block(self.tip.height)?.ok_or_else(|| {
            fail_stop(
                ErrorCode::StoCorrupt,
                format!("finalized tip {} is not in the archive", self.tip.height),
            )
        })?;
        Ok(block.block.header.slot)
    }

    /// The validator set of `epoch` as of the finalized tip.
    pub fn validator_records(
        &self,
        epoch: u64,
    ) -> Result<Option<Vec<ValidatorRecord>>, AletheiaError> {
        Records::new(self.network).validator_set(&self.tip_view(), epoch)
    }

    /// A finalized block by hash (fetches from peers that lag behind).
    pub fn read_block_by_hash(&self, hash: &Hash32) -> Result<Option<Proposal>, AletheiaError> {
        let Some(bytes) = self.store.get(
            ColumnFamily::BlockIndex,
            &aletheia_storage::archive::hash_key(hash),
        )?
        else {
            return Ok(None);
        };
        let height = Height::from_ace_bytes(&bytes).map_err(|e| {
            fail_stop(
                ErrorCode::StoCorrupt,
                format!("block index entry for {hash}: {}", e.detail()),
            )
        })?;
        self.read_block(height)
    }

    /// The stored finality proof for the block at `height`, if consensus finalized a run
    /// ending there.
    pub fn finality_proof(&self, height: Height) -> Result<Option<FinalityProof>, AletheiaError> {
        self.store
            .get(ColumnFamily::FinalityProofs, &height.get().to_be_bytes())?
            .map(|bytes| {
                FinalityProof::from_ace_bytes(&bytes).map_err(|e| {
                    fail_stop(
                        ErrorCode::StoCorrupt,
                        format!("finality proof at {height}: {}", e.detail()),
                    )
                })
            })
            .transpose()
    }

    // ---- reads for the public RPC (Section 37): finalized data only ----

    /// Where a finalized transaction is: its height and index in the block.
    pub fn tx_position(&self, tx_id: &Hash32) -> Result<Option<(Height, u32)>, AletheiaError> {
        let Some(bytes) = self.store.get(ColumnFamily::TxIndex, tx_id.as_bytes())? else {
            return Ok(None);
        };
        let corrupt = || {
            fail_stop(
                ErrorCode::StoCorrupt,
                format!("transaction index entry for {tx_id}"),
            )
        };
        let height =
            Height::from_ace_bytes(bytes.get(..8).ok_or_else(corrupt)?).map_err(|_| corrupt())?;
        let index = bytes
            .get(8..12)
            .and_then(|b| <[u8; 4]>::try_from(b).ok())
            .map(u32::from_le_bytes)
            .ok_or_else(corrupt)?;
        Ok(Some((height, index)))
    }

    /// The receipt of the transaction at `(height, index)`.
    pub fn receipt_at(
        &self,
        height: Height,
        index: u32,
    ) -> Result<Option<aletheia_execution::Receipt>, AletheiaError> {
        self.store
            .get(ColumnFamily::Receipts, &receipt_key(height, index))?
            .map(|bytes| {
                aletheia_execution::Receipt::from_ace_bytes(&bytes).map_err(|e| {
                    fail_stop(
                        ErrorCode::StoCorrupt,
                        format!("receipt at {height}/{index}: {}", e.detail()),
                    )
                })
            })
            .transpose()
    }

    /// The account record at the tip.
    pub fn account_at_tip(
        &self,
        address: &aletheia_core::Address,
    ) -> Result<Option<aletheia_execution::model::Account>, AletheiaError> {
        Records::new(self.network).account(&self.tip_view(), address)
    }

    pub fn balance_at_tip(
        &self,
        address: &aletheia_core::Address,
        asset: aletheia_core::AssetId,
    ) -> Result<aletheia_execution::model::Balance, AletheiaError> {
        Records::new(self.network).balance(&self.tip_view(), address, asset)
    }

    pub fn asset_at_tip(
        &self,
        asset: aletheia_core::AssetId,
    ) -> Result<Option<aletheia_execution::model::AssetConfig>, AletheiaError> {
        Records::new(self.network).asset(&self.tip_view(), asset)
    }

    pub fn supply_at_tip(
        &self,
        asset: aletheia_core::AssetId,
    ) -> Result<Option<aletheia_monetary::SupplyLedger>, AletheiaError> {
        Records::new(self.network).supply_ledger(&self.tip_view(), asset)
    }

    /// The protocol version in force at the tip.
    pub fn tip_version(&self) -> Result<u16, AletheiaError> {
        let records = Records::new(self.network);
        let (_, entry) = rules_for_height(&records, &self.tip_view(), self.tip.height.next()?)?;
        Ok(entry.protocol_version)
    }

    /// Executes a signed transaction as the first transaction of the next block, against the
    /// tip, without committing anything (`simulateTransaction`).
    pub fn simulate(&self, bytes: &[u8]) -> Result<aletheia_execution::Receipt, AletheiaError> {
        let records = Records::new(self.network);
        let view = self.tip_view();
        let height = self.tip.height.next()?;
        let (rules, entry) = rules_for_height(&records, &view, height)?;
        let verified = StatelessValidator::new(self.network, rules).validate(bytes)?;
        let (slot, epoch) = match self.read_block(self.tip.height)? {
            Some(tip) => (
                tip.block.header.slot.get().saturating_add(1),
                tip.block.header.epoch,
            ),
            None => (1, aletheia_core::Epoch::new(0)),
        };
        let slot = aletheia_core::Slot::new(slot);
        let timing = records.chain_timing(&view)?;
        let ctx = BlockContext {
            height,
            slot,
            epoch,
            protocol_time_ms: timing.protocol_time_ms(slot)?,
            proposer: aletheia_core::ValidatorIndex::new(0),
            parent_hash: self.tip.hash,
            protocol_version: aletheia_core::ProtocolVersion::new(entry.protocol_version),
        };
        let mut overlay = aletheia_state::StateOverlay::new(&view);
        rules
            .apply_transaction(&records, &mut overlay, &verified, &ctx, 0)
            .map(|(receipt, _)| receipt)
    }

    /// Clean shutdown: a checkpoint at the tip and the tip recorded in DATADIR (Section 44.5).
    pub fn shutdown(mut self) -> Result<(), AletheiaError> {
        self.wal.append(
            RecordType::Checkpoint,
            &finalize_payload(self.tip.height, &self.tip.hash),
        )?;
        if let Some(safety) = self.safety {
            self.wal
                .append(RecordType::SafetyData, &safety.to_ace_bytes())?;
        }
        self.wal.sync()?;
        let mut manifest = self.datadir.manifest().clone();
        manifest.last_finalized = Some(self.tip);
        manifest.last_writer_release = RELEASE.to_owned();
        self.datadir.write_manifest(manifest)
    }
}
