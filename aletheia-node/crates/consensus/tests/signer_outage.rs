//! A signer that cannot sign for a while must never stop consensus (Mainnet Beta, 2026-11-21:
//! one failed answer from the signer daemon ended the node's consensus for ten hours). The
//! engine abstains while the signer fails, retries its timeout identically, and finalizes again
//! once the signer answers; only a fail-stop error from the signer stops it.

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

use aletheia_consensus::schedule::LeaderSchedule;
use aletheia_consensus::{
    ConsensusSigner, Engine, FinalizedTip, Input, Output, SafetyData, ValidatorInfo, ValidatorSet,
};
use aletheia_core::block::{Block, BlockBody, BlockHeader, Proposal};
use aletheia_core::{
    AletheiaError, ChainId, Epoch, ErrorCode, Hash32, Height, NetworkIdentity, NetworkKind,
    ProtocolVersion, Slot, ValidatorIndex,
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

/// Fails `failures` signing requests (as the remote signer reports an unreachable daemon: a
/// reject), then signs; `fatal` makes the failures fail-stop instead.
struct FlakySigner {
    key: BlsSecretKey,
    failures: u32,
    fatal: bool,
}

impl FlakySigner {
    fn sign(&mut self, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        if self.failures > 0 {
            self.failures -= 1;
            let code = if self.fatal {
                ErrorCode::StoIo
            } else {
                ErrorCode::SigInvalid
            };
            return Err(AletheiaError::new(
                code,
                "signer connection failed: timed out".to_owned(),
            ));
        }
        Ok(self.key.sign(digest).to_bytes())
    }
}

impl ConsensusSigner for FlakySigner {
    fn sign_proposal(&mut self, _: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        self.sign(digest)
    }
    fn sign_vote(
        &mut self,
        _: Slot,
        _: &Hash32,
        digest: &Hash32,
    ) -> Result<[u8; 96], AletheiaError> {
        self.sign(digest)
    }
    fn sign_timeout(&mut self, _: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        self.sign(digest)
    }
}

fn engine(failures: u32, fatal: bool) -> Engine<FlakySigner> {
    let key = BlsSecretKey::from_key_material(&Secret::new([1; 32])).unwrap();
    let member = ValidatorInfo {
        consensus_key: key
            .public_key()
            .prove_possession(&network(), &key.prove_possession(&network()))
            .unwrap(),
        node_key: [0; 32],
        voting_power: 1,
    };
    let set = ValidatorSet::new(Epoch::new(0), vec![member]).unwrap();
    Engine::new(
        network(),
        set,
        LeaderSchedule::new(Epoch::new(0), &Hash32::ZERO, 1),
        Some(ValidatorIndex::new(0)),
        FlakySigner {
            key,
            failures,
            fatal,
        },
        SafetyData::genesis(Epoch::new(0)),
        FinalizedTip {
            hash: GENESIS,
            height: Height::GENESIS,
            round: Slot::new(0),
        },
    )
}

/// One validator: builds what it is asked for (one build per step, as the node paces it),
/// executes everything as valid, and counts finalized blocks.
struct Harness {
    engine: Engine<FlakySigner>,
    heights: BTreeMap<Hash32, Height>,
    pending: Option<Proposal>,
    finalized: usize,
}

impl Harness {
    fn new(engine: Engine<FlakySigner>) -> Harness {
        let mut heights = BTreeMap::new();
        heights.insert(GENESIS, Height::GENESIS);
        Harness {
            engine,
            heights,
            pending: None,
            finalized: 0,
        }
    }

    fn step(&mut self) -> Result<(), AletheiaError> {
        let input = match self.pending.take() {
            Some(proposal) => Input::Built(Box::new(proposal)),
            None => Input::RoundTimer(self.engine.round()),
        };
        self.feed(input)
    }

    fn feed(&mut self, input: Input) -> Result<(), AletheiaError> {
        let mut inputs = VecDeque::from([input]);
        while let Some(input) = inputs.pop_front() {
            for output in self.engine.handle(input)? {
                match output {
                    Output::BuildProposal {
                        round,
                        parent_qc,
                        timeout_cert,
                        ..
                    } => {
                        let height = self.heights[&parent_qc.block_hash].next().unwrap();
                        let header = BlockHeader {
                            version: ProtocolVersion::new(1),
                            chain_id: network().chain_id(),
                            height,
                            epoch: Epoch::new(0),
                            slot: round,
                            protocol_time_ms: round.get() * 500,
                            proposer: ValidatorIndex::new(0),
                            parent_hash: parent_qc.block_hash,
                            parent_qc: *parent_qc,
                            timeout_cert: timeout_cert.map(|tc| *tc),
                            tx_root: Hash32::ZERO,
                            receipt_root: Hash32::ZERO,
                            state_root: Hash32::from_bytes([round.get() as u8; 32]),
                            event_root: Hash32::ZERO,
                            validator_set_hash: Hash32::ZERO,
                            next_validator_set_hash: Hash32::ZERO,
                            monetary_root: Hash32::ZERO,
                            eu_used: 0,
                            tx_count: 0,
                            extensions: Vec::new(),
                        };
                        self.pending = Some(Proposal {
                            block: Block {
                                header,
                                body: BlockBody {
                                    transactions: Vec::new(),
                                },
                            },
                            proposer_signature: [0; 96],
                        });
                    }
                    Output::Execute(proposal) => {
                        let header = &proposal.block.header;
                        let hash = header.block_hash(&network());
                        self.heights.insert(hash, header.height);
                        inputs.push_back(Input::Executed {
                            block_hash: hash,
                            valid: true,
                            reason: String::new(),
                        });
                    }
                    Output::Finalize { blocks, .. } => self.finalized += blocks.len(),
                    _ => {}
                }
            }
        }
        Ok(())
    }
}

#[test]
fn a_signer_that_fails_for_a_while_never_stops_consensus() {
    for failures in [1, 2, 3, 5, 8, 13] {
        let mut h = Harness::new(engine(failures, false));
        h.feed(Input::Start).unwrap();
        for _ in 0..120 {
            h.step()
                .unwrap_or_else(|e| panic!("{failures} failures stopped the engine: {e}"));
        }
        assert!(
            h.finalized > 10,
            "after {failures} failed signatures the validator finalizes again (finalized {})",
            h.finalized
        );
    }
}

#[test]
fn a_failing_timeout_signature_is_retried_until_the_signer_answers() {
    // The first requests fail; the build in round 1 and every timeout until then get no
    // signature. The validator must still leave its round once the signer answers.
    let mut h = Harness::new(engine(4, false));
    h.feed(Input::Start).unwrap();
    // Drop the pending build so the round can only end by timing out.
    h.pending = None;
    let start = h.engine.round();
    for _ in 0..30 {
        h.pending = None;
        h.step().unwrap();
    }
    assert!(h.engine.round() > start, "the round advanced by timeout");
    // With the signer answering again, blocks are finalized.
    for _ in 0..40 {
        h.step().unwrap();
    }
    assert!(h.finalized > 5, "finalized {}", h.finalized);
}

#[test]
fn a_fail_stop_error_from_the_signer_still_stops_the_engine() {
    let mut h = Harness::new(engine(1, true));
    h.feed(Input::Start).unwrap();
    let mut stopped = None;
    for _ in 0..10 {
        if let Err(error) = h.step() {
            stopped = Some(error);
            break;
        }
    }
    assert!(stopped.is_some_and(|e| e.is_fail_stop()));
}
