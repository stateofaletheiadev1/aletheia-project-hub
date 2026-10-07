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

use std::path::Path;

use aletheia_core::block::Proposal;
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32, Height,
    NetworkIdentity,
};
use aletheia_execution::continuity::rules_for_height;
use aletheia_execution::{
    BlockContext, ExecutedBlock, GenesisState, Records, StatelessValidator, check_header_results,
    execute_block,
};
use aletheia_state::{JellyfishMerkleTree, StateKey, StateValue, StateView};
use aletheia_storage::archive::{ArchiveConfig, BlockArchive, index_entries};
use aletheia_storage::datadir::{DataDir, DataDirManifest, LastFinalized, StartupAction, decide};
use aletheia_storage::wal::{RecordType, Wal, WalConfig};
use aletheia_storage::{ColumnFamily, KvStore, WriteBatch};

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

pub struct Ledger<S: KvStore> {
    datadir: DataDir,
    store: S,
    archive: BlockArchive,
    wal: Wal,
    network: NetworkIdentity,
    tip: LastFinalized,
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
            #[cfg(feature = "fault-injection")]
            crash_at: None,
        };
        ledger.verify_tip()?;

        // Step 7: the last FINALIZE_BEGIN without a matching FINALIZE_COMMITTED.
        let mut open_finalize: Option<(Height, Hash32)> = None;
        for record in &recovery.records {
            match record.kind {
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
                        ledger.commit(&proposal, &executed, location)?;
                        Reconciled::ReExecuted(height)
                    }
                    None => {
                        ledger.wal.append(
                            RecordType::Checkpoint,
                            &finalize_payload(ledger.tip.height, &ledger.tip.hash),
                        )?;
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

    /// Validator path: stateless checks, re-execution on the tip, header comparison.
    pub fn execute(&self, proposal: &Proposal) -> Result<ExecutedBlock, AletheiaError> {
        let header = &proposal.block.header;
        let expected_height = self.tip.height.next()?;
        if header.height != expected_height || header.parent_hash != self.tip.hash {
            return Err(fail_stop(
                ErrorCode::BlkParentMismatch,
                format!(
                    "block at height {} does not extend finalized height {} ({})",
                    header.height, self.tip.height, self.tip.hash
                ),
            ));
        }
        let records = Records::new(self.network);
        let view = VersionView {
            tree: JellyfishMerkleTree::new(&self.store, self.network),
            version: self.tip.height.get(),
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
        let mut scratch = WriteBatch::new();
        let state_root = JellyfishMerkleTree::new(&self.store, self.network).apply(
            Some(self.tip.height.get()),
            header.height.get(),
            &executed.changes,
            &mut scratch,
        )?;
        check_header_results(&self.network, header, &executed, &state_root)?;
        Ok(executed)
    }

    /// Finalizes a block that [`Ledger::execute`] accepted.
    pub fn finalize(
        &mut self,
        proposal: &Proposal,
        executed: &ExecutedBlock,
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
        self.commit(proposal, executed, location)
    }

    fn commit(
        &mut self,
        proposal: &Proposal,
        executed: &ExecutedBlock,
        location: aletheia_storage::archive::ArchiveLocation,
    ) -> Result<(), AletheiaError> {
        let header = &proposal.block.header;
        let hash = header.block_hash(&self.network);
        let mut batch = self.store.batch();
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

    /// Validates and finalizes in one step (single-node operation until consensus exists).
    pub fn apply(&mut self, proposal: &Proposal) -> Result<ExecutedBlock, AletheiaError> {
        let executed = self.execute(proposal)?;
        self.finalize(proposal, &executed)?;
        Ok(executed)
    }

    /// Clean shutdown: a checkpoint at the tip and the tip recorded in DATADIR (Section 44.5).
    pub fn shutdown(mut self) -> Result<(), AletheiaError> {
        self.wal.append(
            RecordType::Checkpoint,
            &finalize_payload(self.tip.height, &self.tip.hash),
        )?;
        self.wal.sync()?;
        let mut manifest = self.datadir.manifest().clone();
        manifest.last_finalized = Some(self.tip);
        manifest.last_writer_release = RELEASE.to_owned();
        self.datadir.write_manifest(manifest)
    }
}
