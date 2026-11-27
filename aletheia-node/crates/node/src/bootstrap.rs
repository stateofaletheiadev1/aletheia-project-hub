//! Snapshot bootstrap (ADR-072, spec Section 42.4): a new node starts from a recent state
//! instead of re-executing every block since genesis, without trusting whoever handed it the
//! files.
//!
//! A snapshot directory holds the state chunks and manifest of `aletheia_state::snapshot` and
//! an anchor:
//!
//! ```text
//! anchor.ace = "ALANCH01" | ACE(SnapshotAnchor)
//! SnapshotAnchor = block Proposal                (the finalized block at the manifest height)
//!                | links list<EpochLink>         (every validator epoch change since genesis)
//! EpochLink      = closing BlockHeader | proof FinalityProof | next_set list<ValidatorRecord>
//! ```
//!
//! [`verify`] trusts only the genesis file: it starts from the genesis validator set, follows
//! each epoch change (the closing block is final under the set it closes, and the next set's
//! records hash to what that block committed), then checks the anchor block's finality proof
//! against the set of its epoch, its transactions against its header, and its state root
//! against the manifest. The restore then rebuilds the tree from the chunks and must arrive at
//! that root. Nothing in the directory is believed because of where it came from.

use std::collections::BTreeMap;
use std::path::Path;

use aletheia_consensus::FinalityProof;
use aletheia_core::block::{BlockHeader, MAX_VALIDATORS, Proposal};
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, Epoch, ErrorCode, Hash32,
    NetworkIdentity,
};
use aletheia_execution::model::{ValidatorRecord, validator_records_hash};
use aletheia_execution::{GenesisState, Records};
use aletheia_state::snapshot::SnapshotManifest;
use aletheia_state::{StateKey, StateValue, StateView};

pub const ANCHOR_FILE: &str = "anchor.ace";
const ANCHOR_MAGIC: &[u8; 8] = b"ALANCH01";
/// Epoch changes happen only when validators join or leave; this bound is far beyond any
/// real chain and only stops a hostile file from asking for unbounded memory.
const MAX_EPOCH_LINKS: u32 = 1 << 20;

/// One validator epoch change: the block that closed the epoch, its finality proof under the
/// set it closed, and the records of the set that followed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EpochLink {
    pub closing: BlockHeader,
    pub proof: FinalityProof,
    pub next_set: Vec<ValidatorRecord>,
}

impl AceEncode for EpochLink {
    fn encode(&self, out: &mut AceWriter) {
        self.closing.encode(out);
        self.proof.encode(out);
        out.list(&self.next_set);
    }
}

impl AceDecode for EpochLink {
    fn decode(input: &mut AceReader<'_>) -> Result<EpochLink, AletheiaError> {
        Ok(EpochLink {
            closing: BlockHeader::decode(input)?,
            proof: FinalityProof::decode(input)?,
            next_set: input.list(u32::from(MAX_VALIDATORS))?,
        })
    }
}

/// What binds a snapshot to the chain, beside its manifest.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotAnchor {
    pub block: Proposal,
    pub links: Vec<EpochLink>,
}

impl AceEncode for SnapshotAnchor {
    fn encode(&self, out: &mut AceWriter) {
        self.block.encode(out);
        out.list(&self.links);
    }
}

impl AceDecode for SnapshotAnchor {
    fn decode(input: &mut AceReader<'_>) -> Result<SnapshotAnchor, AletheiaError> {
        Ok(SnapshotAnchor {
            block: Proposal::decode(input)?,
            links: input.list(MAX_EPOCH_LINKS)?,
        })
    }
}

fn io(action: &str, path: &Path, error: &std::io::Error) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoIo,
        format!("{action} {}: {error}", path.display()),
    )
}

/// Writes `anchor.ace` into `dir`, synced.
pub fn write_anchor(dir: &Path, anchor: &SnapshotAnchor) -> Result<(), AletheiaError> {
    use std::io::Write;
    let path = dir.join(ANCHOR_FILE);
    let mut bytes = ANCHOR_MAGIC.to_vec();
    bytes.extend_from_slice(&anchor.to_ace_bytes());
    let mut file = std::fs::File::create(&path).map_err(|e| io("create", &path, &e))?;
    file.write_all(&bytes).map_err(|e| io("write", &path, &e))?;
    file.sync_all().map_err(|e| io("sync", &path, &e))
}

pub fn read_anchor(dir: &Path) -> Result<SnapshotAnchor, AletheiaError> {
    let path = dir.join(ANCHOR_FILE);
    let bytes = std::fs::read(&path).map_err(|e| io("read", &path, &e))?;
    let body = bytes.strip_prefix(&ANCHOR_MAGIC[..]).ok_or_else(|| {
        AletheiaError::new(
            ErrorCode::ProofInvalid,
            format!("{}: not a snapshot anchor (wrong magic)", path.display()),
        )
    })?;
    SnapshotAnchor::from_ace_bytes(body).map_err(|e| {
        AletheiaError::new(
            ErrorCode::ProofInvalid,
            format!("{}: {}", path.display(), e.detail()),
        )
    })
}

/// Genesis state as a plain map: enough to read the epoch-0 validator set without a tree.
struct GenesisView(BTreeMap<StateKey, StateValue>);

impl StateView for GenesisView {
    fn get(&self, key: &StateKey) -> Result<Option<StateValue>, AletheiaError> {
        Ok(self.0.get(key).cloned())
    }
}

fn invalid(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::ProofInvalid, format!("snapshot: {detail}"))
}

/// The consensus set an epoch's records describe (every proof of possession re-verified).
fn consensus_set(
    network: &NetworkIdentity,
    epoch: Epoch,
    records: &[ValidatorRecord],
) -> Result<aletheia_consensus::ValidatorSet, AletheiaError> {
    crate::consensus::validator_set(network, epoch, records)
}

/// Checks the anchor and manifest against the genesis file alone. Returns the anchor block's
/// finality proof, which the restored node stores with the block.
pub fn verify(
    genesis: &GenesisState,
    anchor: &SnapshotAnchor,
    manifest: &SnapshotManifest,
) -> Result<FinalityProof, AletheiaError> {
    let network = genesis.network();
    let mut entries = BTreeMap::new();
    for (key, value) in genesis.initial_changes()? {
        if let Some(value) = value {
            entries.insert(key, value);
        }
    }
    let genesis_view = GenesisView(entries);
    let records = Records::new(network)
        .validator_set(&genesis_view, 0)?
        .ok_or_else(|| {
            invalid(
                "this genesis has no validators, so no block of its chain carries a finality proof"
                    .to_owned(),
            )
        })?;
    let mut set = consensus_set(&network, Epoch::new(0), &records)?;
    let mut last_height = 0u64;

    for link in &anchor.links {
        let header = &link.closing;
        let at = header.height;
        if header.chain_id != network.chain_id() {
            return Err(invalid(format!(
                "epoch change at height {at} belongs to chain {}",
                header.chain_id
            )));
        }
        if header.height.get() <= last_height {
            return Err(invalid(format!(
                "epoch changes are out of order at height {at}"
            )));
        }
        if header.epoch != set.epoch() || header.validator_set_hash != set.hash(&network) {
            return Err(invalid(format!(
                "the block at height {at} is not in epoch {} under its set",
                set.epoch()
            )));
        }
        if !aletheia_consensus::engine::closes_epoch(header) {
            return Err(invalid(format!(
                "the block at height {at} does not close its epoch"
            )));
        }
        if link.proof.block_hash != header.block_hash(&network) {
            return Err(invalid(format!(
                "the finality proof for height {at} is for another block"
            )));
        }
        link.proof.verify(&network, &set)?;
        let next = Epoch::new(set.epoch().get().checked_add(1).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::ArithmeticOverflow,
                "validator epoch overflows".to_owned(),
            )
        })?);
        if validator_records_hash(&network, next, &link.next_set) != header.next_validator_set_hash
        {
            return Err(invalid(format!(
                "the set given for epoch {next} is not the one the block at height {at} committed"
            )));
        }
        set = consensus_set(&network, next, &link.next_set)?;
        last_height = header.height.get();
    }

    let header = &anchor.block.block.header;
    let at = header.height;
    if header.chain_id != network.chain_id() {
        return Err(invalid(format!(
            "the anchor block belongs to chain {}",
            header.chain_id
        )));
    }
    if header.height.get() <= last_height {
        return Err(invalid(format!(
            "the anchor block at height {at} precedes its last epoch change"
        )));
    }
    if header.epoch != set.epoch() || header.validator_set_hash != set.hash(&network) {
        return Err(invalid(format!(
            "the anchor block at height {at} is not in epoch {} under its set",
            set.epoch()
        )));
    }
    let proof = FinalityProof::from_ace_bytes(&manifest.finality_proof)
        .map_err(|e| invalid(format!("the manifest's finality proof: {}", e.detail())))?;
    if proof.block_hash != header.block_hash(&network) {
        return Err(invalid(format!(
            "the manifest's finality proof is not for the anchor block at height {at}"
        )));
    }
    proof.verify(&network, &set)?;
    // The header is final; its body must be the one it committed to.
    let witnesses: Vec<[u8; 32]> = anchor
        .block
        .block
        .body
        .transactions
        .iter()
        .map(|tx| tx.witness_hash(&network).into_bytes())
        .collect();
    if aletheia_crypto::merkle::root(&network, &witnesses) != header.tx_root
        || usize::try_from(header.tx_count).ok() != Some(witnesses.len())
    {
        return Err(invalid(format!(
            "the anchor block's transactions do not match its header at height {at}"
        )));
    }
    if manifest.height != header.height.get() || manifest.state_root != header.state_root {
        return Err(invalid(format!(
            "the manifest (height {}, root {}) does not describe the anchor block at height {at} (root {})",
            manifest.height, manifest.state_root, header.state_root
        )));
    }
    Ok(proof)
}

/// Where a snapshot's epoch chain is read from on the serving node: block headers, finality
/// proofs and validator sets at past heights.
pub(crate) trait History {
    fn header_by_hash(&self, hash: &Hash32) -> Result<Option<BlockHeader>, AletheiaError>;
    fn finality_proof_at(&self, height: u64) -> Result<Option<FinalityProof>, AletheiaError>;
    /// `opened_after` of the validator epoch state at `version`.
    fn opened_after(&self, version: u64) -> Result<Hash32, AletheiaError>;
    fn set_at(
        &self,
        version: u64,
        epoch: u64,
    ) -> Result<Option<Vec<ValidatorRecord>>, AletheiaError>;
}

/// The epoch chain from genesis to the epoch of the block at `height`, oldest first: each
/// epoch's closing block is found from the next epoch's `opened_after`.
pub(crate) fn epoch_links(
    history: &dyn History,
    height: u64,
) -> Result<Vec<EpochLink>, AletheiaError> {
    let missing = |what: String| {
        AletheiaError::new(
            ErrorCode::StoCorrupt,
            format!("cannot prove a snapshot at height {height}: {what}"),
        )
    };
    let mut links = Vec::new();
    let mut cursor = history.opened_after(height)?;
    let mut below = height;
    while cursor != Hash32::ZERO {
        let closing = history
            .header_by_hash(&cursor)?
            .ok_or_else(|| missing(format!("the epoch-closing block {cursor} is not here")))?;
        let at = closing.height.get();
        // Each step goes strictly back, so a damaged store cannot loop here.
        if at >= below {
            return Err(missing(format!(
                "the epoch-closing block at height {at} is not below height {below}"
            )));
        }
        below = at;
        let proof = history
            .finality_proof_at(at)?
            .ok_or_else(|| missing(format!("no finality proof is stored at height {at}")))?;
        let next = closing.epoch.get().checked_add(1).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::ArithmeticOverflow,
                "validator epoch overflows".to_owned(),
            )
        })?;
        let next_set = history
            .set_at(at, next)?
            .ok_or_else(|| missing(format!("state at height {at} has no set for epoch {next}")))?;
        let previous = history.opened_after(at)?;
        if links.len() >= usize::try_from(MAX_EPOCH_LINKS).unwrap_or(usize::MAX) {
            return Err(missing("too many epoch changes".to_owned()));
        }
        links.push(EpochLink {
            closing,
            proof,
            next_set,
        });
        cursor = previous;
    }
    links.reverse();
    Ok(links)
}
