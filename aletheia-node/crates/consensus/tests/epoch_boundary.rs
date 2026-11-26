//! Epoch boundaries in the engine (ADR-069): the closing block is the last block an epoch
//! finalizes, its child is an empty suffix block that is never final, nothing extends the suffix,
//! and the next epoch's engine, rooted on the closing block, carries on.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects,
    clippy::cast_possible_truncation,
    clippy::as_conversions
)]

use std::collections::{BTreeMap, VecDeque};

use aletheia_consensus::engine::closes_epoch;
use aletheia_consensus::schedule::LeaderSchedule;
use aletheia_consensus::{
    ConsensusSigner, Engine, FinalizedTip, Input, Output, SafetyData, ValidatorInfo, ValidatorSet,
};
use aletheia_core::block::{Block, BlockBody, BlockHeader, Proposal, QuorumCertificate};
use aletheia_core::{
    AletheiaError, ChainId, Epoch, Hash32, Height, NetworkIdentity, NetworkKind, ProtocolVersion,
    Slot, ValidatorIndex,
};
use aletheia_crypto::{BlsSecretKey, Secret};

fn network() -> NetworkIdentity {
    NetworkIdentity::new(
        ChainId::new(7770),
        NetworkKind::Mainnet,
        Hash32::from_bytes([4; 32]),
    )
}

const GENESIS: Hash32 = Hash32::from_bytes([9; 32]);
const SET_0: Hash32 = Hash32::from_bytes([10; 32]);
const SET_1: Hash32 = Hash32::from_bytes([11; 32]);

struct KeySigner(BlsSecretKey);

impl ConsensusSigner for KeySigner {
    fn sign_proposal(&mut self, _: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        Ok(self.0.sign(digest).to_bytes())
    }
    fn sign_vote(
        &mut self,
        _: Slot,
        _: &Hash32,
        digest: &Hash32,
    ) -> Result<[u8; 96], AletheiaError> {
        Ok(self.0.sign(digest).to_bytes())
    }
    fn sign_timeout(&mut self, _: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        Ok(self.0.sign(digest).to_bytes())
    }
}

fn key() -> BlsSecretKey {
    BlsSecretKey::from_key_material(&Secret::new([1; 32])).unwrap()
}

fn engine(epoch: u64, safety: SafetyData, finalized: FinalizedTip) -> Engine<KeySigner> {
    let key = key();
    let member = ValidatorInfo {
        consensus_key: key
            .public_key()
            .prove_possession(&network(), &key.prove_possession(&network()))
            .unwrap(),
        node_key: [0; 32],
        voting_power: 1,
    };
    let set = ValidatorSet::new(Epoch::new(epoch), vec![member]).unwrap();
    Engine::new(
        network(),
        set,
        LeaderSchedule::new(Epoch::new(epoch), &Hash32::ZERO, 1),
        Some(ValidatorIndex::new(0)),
        KeySigner(key),
        safety,
        finalized,
    )
}

/// Drives one validator: builds every block it is asked for, executes every block as valid,
/// and records what was built and finalized. The block at `close_at` closes the epoch.
struct Harness {
    engine: Engine<KeySigner>,
    epoch: u64,
    set_hash: Hash32,
    close_at: Option<u64>,
    heights: BTreeMap<Hash32, Height>,
    finalized: Vec<BlockHeader>,
    suffix_builds: usize,
    evidence: usize,
    executed: Vec<Hash32>,
    /// The build the engine asked for, delivered on the next tick (the node paces builds the
    /// same way; answering at once would let a single validator chain rounds forever).
    pending: Option<Proposal>,
}

impl Harness {
    fn new(engine: Engine<KeySigner>, epoch: u64, set_hash: Hash32, root: FinalizedTip) -> Self {
        let mut heights = BTreeMap::new();
        heights.insert(root.hash, root.height);
        Harness {
            engine,
            epoch,
            set_hash,
            close_at: None,
            heights,
            finalized: Vec::new(),
            suffix_builds: 0,
            evidence: 0,
            executed: Vec::new(),
            pending: None,
        }
    }

    fn header(&self, round: Slot, parent_qc: QuorumCertificate, closes: bool) -> BlockHeader {
        let height = self.heights[&parent_qc.block_hash].next().unwrap();
        BlockHeader {
            version: ProtocolVersion::new(2),
            chain_id: network().chain_id(),
            height,
            epoch: Epoch::new(self.epoch),
            slot: round,
            protocol_time_ms: round.get() * 500,
            proposer: ValidatorIndex::new(0),
            parent_hash: parent_qc.block_hash,
            parent_qc,
            timeout_cert: None,
            tx_root: Hash32::ZERO,
            receipt_root: Hash32::ZERO,
            state_root: Hash32::from_bytes([round.get() as u8; 32]),
            event_root: Hash32::ZERO,
            validator_set_hash: self.set_hash,
            next_validator_set_hash: if closes { SET_1 } else { self.set_hash },
            monetary_root: Hash32::ZERO,
            eu_used: 0,
            tx_count: 0,
            extensions: Vec::new(),
        }
    }

    fn proposal(header: BlockHeader) -> Proposal {
        Proposal {
            block: Block {
                header,
                body: BlockBody {
                    transactions: Vec::new(),
                },
            },
            proposer_signature: [0; 96],
        }
    }

    /// One step: the pending build if there is one, else the round timer.
    fn tick(&mut self) {
        match self.pending.take() {
            Some(proposal) => self.feed(Input::Built(Box::new(proposal))),
            None => {
                let round = self.engine.round();
                self.feed(Input::RoundTimer(round));
            }
        }
    }

    fn feed(&mut self, input: Input) {
        let mut inputs = VecDeque::from([input]);
        while let Some(input) = inputs.pop_front() {
            for output in self.engine.handle(input).unwrap() {
                match output {
                    Output::BuildProposal {
                        round,
                        parent_qc,
                        suffix,
                        ..
                    } => {
                        if suffix {
                            self.suffix_builds += 1;
                        }
                        let height = self.heights[&parent_qc.block_hash].next().unwrap();
                        let closes = self.close_at == Some(height.get());
                        let header = self.header(round, *parent_qc, closes);
                        self.pending = Some(Self::proposal(header));
                    }
                    Output::Execute(proposal) => {
                        let header = &proposal.block.header;
                        let hash = header.block_hash(&network());
                        self.heights.insert(hash, header.height);
                        self.executed.push(hash);
                        inputs.push_back(Input::Executed {
                            block_hash: hash,
                            valid: true,
                            reason: String::new(),
                        });
                    }
                    Output::Finalize { blocks, .. } => {
                        self.finalized
                            .extend(blocks.into_iter().map(|p| p.block.header));
                    }
                    Output::Evidence(_) => self.evidence += 1,
                    Output::ArmTimer { .. }
                    | Output::PersistSafety(_)
                    | Output::Broadcast(_)
                    | Output::FetchBlock { .. } => {}
                }
            }
        }
    }
}

fn genesis_tip() -> FinalizedTip {
    FinalizedTip {
        hash: GENESIS,
        height: Height::GENESIS,
        round: Slot::new(0),
    }
}

#[test]
fn without_a_set_change_the_single_validator_never_closes_its_epoch() {
    let mut h = Harness::new(
        engine(0, SafetyData::genesis(Epoch::new(0)), genesis_tip()),
        0,
        SET_0,
        genesis_tip(),
    );
    h.feed(Input::Start);
    // A single validator certifies and finalizes as it builds; time the rounds forward.
    for _ in 0..40 {
        h.tick();
    }
    assert!(h.finalized.len() > 20, "finalized {}", h.finalized.len());
    assert!(!h.engine.is_closed());
    assert_eq!(h.suffix_builds, 0);
    assert!(h.finalized.iter().all(|header| !closes_epoch(header)));
}

#[test]
fn the_closing_block_is_the_last_final_block_and_its_child_is_an_empty_suffix() {
    let mut h = Harness::new(
        engine(0, SafetyData::genesis(Epoch::new(0)), genesis_tip()),
        0,
        SET_0,
        genesis_tip(),
    );
    h.close_at = Some(5);
    h.feed(Input::Start);
    for _ in 0..40 {
        h.tick();
    }
    assert!(
        h.engine.is_closed(),
        "the engine closes once block 5 is final"
    );
    let last = h.finalized.last().unwrap();
    assert_eq!(last.height, Height::new(5));
    assert!(closes_epoch(last));
    assert_eq!(
        h.finalized.len(),
        5,
        "nothing above the closing block is final"
    );
    assert_eq!(
        h.suffix_builds, 1,
        "exactly one suffix block certifies the closing block"
    );
    // The suffix block was executed; nothing was built or executed above it.
    let highest = h.executed.iter().map(|hash| h.heights[hash]).max().unwrap();
    assert_eq!(highest, Height::new(6));
    // A closed engine ignores every input.
    assert!(h.engine.handle(Input::Start).unwrap().is_empty());
}

#[test]
fn a_suffix_block_that_closes_the_epoch_again_is_refused() {
    let mut h = Harness::new(
        engine(0, SafetyData::genesis(Epoch::new(0)), genesis_tip()),
        0,
        SET_0,
        genesis_tip(),
    );
    h.close_at = Some(2);
    h.feed(Input::Start);
    // Block 1, then the closing block 2; the engine now asks for the suffix block.
    h.tick();
    h.tick();
    assert_eq!(h.suffix_builds, 1);
    let mut suffix = h.pending.take().expect("a suffix build is pending");
    assert_eq!(suffix.block.header.height, Height::new(3));
    // A suffix that commits to yet another set is invalid: evidence, never executed.
    suffix.block.header.next_validator_set_hash = Hash32::from_bytes([12; 32]);
    let before = h.evidence;
    h.feed(Input::Built(Box::new(suffix)));
    assert_eq!(h.evidence, before + 1);
    assert!(h.heights.values().all(|height| height.get() <= 2));
    assert!(
        !h.engine.is_closed(),
        "the closing block is not final without its suffix QC"
    );
}

#[test]
fn the_next_epoch_engine_rooted_on_the_closing_block_carries_on() {
    // Epoch 0 closes at height 3.
    let mut first = Harness::new(
        engine(0, SafetyData::genesis(Epoch::new(0)), genesis_tip()),
        0,
        SET_0,
        genesis_tip(),
    );
    first.close_at = Some(3);
    first.feed(Input::Start);
    for _ in 0..20 {
        first.tick();
    }
    assert!(first.engine.is_closed());
    let closing = first.finalized.last().unwrap().clone();
    let closing_hash = closing.block_hash(&network());

    // Epoch 1 starts on the closing block, round = closing round + 1 (ADR-069 item 4), with the
    // safety data the first engine left.
    let root = FinalizedTip {
        hash: closing_hash,
        height: closing.height,
        round: closing.slot.next().unwrap(),
    };
    let safety = first.engine.safety();
    let mut second = Harness::new(engine(1, safety, root), 1, SET_1, root);
    second.feed(Input::Start);
    for _ in 0..20 {
        second.tick();
    }
    assert!(second.finalized.len() > 5, "epoch 1 finalizes blocks");
    let first_of_epoch = &second.finalized[0];
    assert_eq!(first_of_epoch.parent_hash, closing_hash);
    assert_eq!(first_of_epoch.height, closing.height.next().unwrap());
    assert_eq!(first_of_epoch.epoch, Epoch::new(1));
    assert_eq!(first_of_epoch.parent_qc.round, root.round);
    assert!(first_of_epoch.slot > root.round);
    assert!(!second.engine.is_closed());
}
