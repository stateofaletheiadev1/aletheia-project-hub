//! NON-PRODUCTION deterministic network simulator for DSP (spec Sections 19.8, 52).
//!
//! Every validator runs the real [`Engine`] with real BLS keys. The simulator owns time (a
//! virtual millisecond clock), the network (per-message delay, loss and partitions, all drawn
//! from one seeded generator) and execution (a stub that rejects blocks built to be invalid).
//! A run is a pure function of its seed and scenario, so any failure reproduces exactly.
//!
//! After every run [`Simulation::check_safety`] asserts the invariant that matters most: no
//! two honest validators finalize different blocks at the same height, and every finalized
//! chain links parent to child.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects,
    clippy::as_conversions,
    clippy::cast_possible_truncation,
    missing_debug_implementations,
    reason = "test-only simulator"
)]

use std::collections::{BTreeMap, BTreeSet};

use aletheia_consensus::schedule::{LeaderSchedule, seed};
use aletheia_consensus::{
    ConsensusMessage, ConsensusSigner, Engine, Evidence, FinalizedTip, Input, Output, SafetyData,
    ValidatorInfo, ValidatorSet, Vote,
};
use aletheia_core::block::{Block, BlockBody, BlockHeader, Proposal, QuorumCertificate};
use aletheia_core::{
    AletheiaError, ChainId, Epoch, Hash32, Height, NetworkIdentity, NetworkKind, ProtocolVersion,
    Slot, ValidatorIndex,
};
use aletheia_crypto::{BlsSecretKey, Secret};

/// What a validator does.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Behaviour {
    Honest,
    /// Receives nothing, sends nothing (crashed or partitioned forever).
    Silent,
    /// As leader, signs two different blocks for its round and sends each to half the peers.
    EquivocatingProposer,
    /// Signs a vote for every proposal it sees, including conflicting ones in one round.
    DoubleVoter,
    /// As leader, builds blocks that fail execution.
    InvalidProposer,
}

#[derive(Debug, Clone)]
pub struct Scenario {
    pub behaviours: Vec<Behaviour>,
    /// Simulated duration in milliseconds.
    pub duration_ms: u64,
    pub min_delay_ms: u64,
    pub max_delay_ms: u64,
    /// Per-message loss before stabilization, in parts per thousand.
    pub drop_permille: u64,
    /// After this time no message is lost (global stabilization time).
    pub stable_after_ms: u64,
    /// Time windows during which the validators are split into the given groups.
    pub partitions: Vec<(u64, u64, Vec<BTreeSet<usize>>)>,
}

impl Scenario {
    pub fn honest(n: usize) -> Scenario {
        Scenario {
            behaviours: vec![Behaviour::Honest; n],
            duration_ms: 30_000,
            min_delay_ms: 5,
            max_delay_ms: 60,
            drop_permille: 0,
            stable_after_ms: 0,
            partitions: Vec::new(),
        }
    }
}

/// xorshift64*: fixed so a seed means the same run forever.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    fn range(&mut self, low: u64, high: u64) -> u64 {
        if high <= low {
            low
        } else {
            low + self.next() % (high - low + 1)
        }
    }
}

/// Software signer; the simulator also holds every key to forge Byzantine messages.
struct SimSigner {
    key: BlsSecretKey,
}

impl ConsensusSigner for SimSigner {
    fn sign_proposal(&mut self, _: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        Ok(self.key.sign(digest).to_bytes())
    }
    fn sign_vote(
        &mut self,
        _: Slot,
        _: &Hash32,
        digest: &Hash32,
    ) -> Result<[u8; 96], AletheiaError> {
        Ok(self.key.sign(digest).to_bytes())
    }
    fn sign_timeout(&mut self, _: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        Ok(self.key.sign(digest).to_bytes())
    }
}

enum Event {
    Deliver {
        to: usize,
        message: ConsensusMessage,
    },
    Executed {
        node: usize,
        block_hash: Hash32,
        valid: bool,
    },
    Timer {
        node: usize,
        round: Slot,
    },
}

pub struct Outcome {
    /// Per node: finalized height -> block hash.
    pub finalized: Vec<BTreeMap<Height, Hash32>>,
    pub evidence: Vec<Evidence>,
    pub messages_delivered: u64,
}

pub struct Simulation {
    network: NetworkIdentity,
    scenario: Scenario,
    rng: Rng,
    keys: Vec<BlsSecretKey>,
    engines: Vec<Engine<SimSigner>>,
    now: u64,
    sequence: u64,
    queue: BTreeMap<(u64, u64), Event>,
    /// Every block any node built, for parent lookups when building.
    blocks: BTreeMap<Hash32, BlockHeader>,
    invalid: BTreeSet<Hash32>,
    /// Every signed proposal that went onto the network, for answering block fetches.
    published: BTreeMap<Hash32, Proposal>,
    genesis_hash: Hash32,
    outcome: Outcome,
}

impl Simulation {
    pub fn new(seed_value: u64, scenario: Scenario) -> Simulation {
        let network = NetworkIdentity::new(
            ChainId::new(7771),
            NetworkKind::Regtest,
            Hash32::from_bytes([7; 32]),
        );
        let n = scenario.behaviours.len();
        let keys: Vec<BlsSecretKey> = (0..n).map(key_for).collect();
        let members: Vec<ValidatorInfo> = keys
            .iter()
            .enumerate()
            .map(|(i, key)| ValidatorInfo {
                consensus_key: key
                    .public_key()
                    .prove_possession(&network, &key.prove_possession(&network))
                    .unwrap(),
                node_key: [i as u8; 32],
                voting_power: 1,
            })
            .collect();
        let set = ValidatorSet::new(Epoch::new(0), members).unwrap();
        let genesis_hash = Hash32::from_bytes([1; 32]);
        let schedule = LeaderSchedule::new(
            Epoch::new(0),
            &seed(&network, Epoch::new(0), &network.genesis_id()),
            set.len(),
        );
        let tip = FinalizedTip {
            hash: genesis_hash,
            height: Height::GENESIS,
            round: Slot::new(0),
        };
        let engines = keys
            .iter()
            .enumerate()
            .map(|(i, _)| {
                // KeyGen is deterministic: the engine's signer and the simulator's forging copy
                // are the same key without ever exporting secret bytes.
                let signer = SimSigner { key: key_for(i) };
                Engine::new(
                    network,
                    set.clone(),
                    schedule.clone(),
                    Some(ValidatorIndex::new(i as u16)),
                    signer,
                    SafetyData::genesis(Epoch::new(0)),
                    tip,
                )
            })
            .collect();
        Simulation {
            network,
            rng: Rng(seed_value.wrapping_mul(0x9e37_79b9_7f4a_7c15) | 1),
            scenario,
            keys,
            engines,
            now: 0,
            sequence: 0,
            queue: BTreeMap::new(),
            blocks: BTreeMap::new(),
            invalid: BTreeSet::new(),
            published: BTreeMap::new(),
            genesis_hash,
            outcome: Outcome {
                finalized: vec![BTreeMap::new(); n],
                evidence: Vec::new(),
                messages_delivered: 0,
            },
        }
    }

    fn honest(&self, node: usize) -> bool {
        self.scenario.behaviours[node] != Behaviour::Silent
    }

    fn schedule(&mut self, at: u64, event: Event) {
        self.sequence += 1;
        self.queue.insert((at, self.sequence), event);
    }

    fn connected(&self, from: usize, to: usize, at: u64) -> bool {
        self.scenario
            .partitions
            .iter()
            .filter(|(start, end, _)| (*start..*end).contains(&at))
            .all(|(_, _, groups)| {
                groups
                    .iter()
                    .any(|group| group.contains(&from) && group.contains(&to))
            })
    }

    fn send(&mut self, from: usize, to: usize, message: ConsensusMessage) {
        if !self.honest(to) || !self.connected(from, to, self.now) {
            return;
        }
        if self.now < self.scenario.stable_after_ms
            && self.rng.range(0, 999) < self.scenario.drop_permille
        {
            return;
        }
        let delay = self
            .rng
            .range(self.scenario.min_delay_ms, self.scenario.max_delay_ms);
        self.schedule(self.now + delay, Event::Deliver { to, message });
    }

    fn broadcast(&mut self, from: usize, message: &ConsensusMessage) {
        for to in 0..self.engines.len() {
            if to != from {
                self.send(from, to, message.clone());
            }
        }
    }

    fn build(
        &mut self,
        node: usize,
        round: Slot,
        parent_qc: QuorumCertificate,
        tc: Option<aletheia_core::block::TimeoutCertificate>,
        variant: u8,
    ) -> Proposal {
        let parent_height = if parent_qc.block_hash == self.genesis_hash {
            Height::GENESIS
        } else {
            self.blocks
                .get(&parent_qc.block_hash)
                .map(|h| h.height)
                .unwrap_or(Height::GENESIS)
        };
        let mut state = [variant; 32];
        state[..8].copy_from_slice(&round.get().to_le_bytes());
        let header = BlockHeader {
            version: ProtocolVersion::new(1),
            chain_id: self.network.chain_id(),
            height: parent_height.next().unwrap(),
            epoch: Epoch::new(0),
            slot: round,
            protocol_time_ms: round.get() * 500,
            proposer: ValidatorIndex::new(node as u16),
            parent_hash: parent_qc.block_hash,
            parent_qc,
            timeout_cert: tc,
            tx_root: Hash32::ZERO,
            receipt_root: Hash32::ZERO,
            state_root: Hash32::from_bytes(state),
            event_root: Hash32::ZERO,
            validator_set_hash: Hash32::ZERO,
            next_validator_set_hash: Hash32::ZERO,
            monetary_root: Hash32::ZERO,
            eu_used: 0,
            tx_count: 0,
            extensions: Vec::new(),
        };
        self.blocks
            .insert(header.block_hash(&self.network), header.clone());
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

    fn signed(&self, node: usize, mut proposal: Proposal) -> Proposal {
        let hash = proposal.block.header.block_hash(&self.network);
        proposal.proposer_signature = self.keys[node]
            .sign(&Proposal::signing_digest(&self.network, &hash))
            .to_bytes();
        proposal
    }

    fn input(&mut self, node: usize, input: Input) {
        if !self.honest(node) {
            return;
        }
        let outputs = match self.engines[node].handle(input) {
            Ok(outputs) => outputs,
            Err(error) => panic!("node {node} fail-stop at {} ms: {error}", self.now),
        };
        for output in outputs {
            self.carry_out(node, output);
        }
    }

    fn carry_out(&mut self, node: usize, output: Output) {
        let behaviour = self.scenario.behaviours[node];
        match output {
            Output::PersistSafety(_) => {}
            Output::Broadcast(ConsensusMessage::Proposal(proposal))
                if behaviour == Behaviour::EquivocatingProposer =>
            {
                // Half the peers get the real block, half a different one for the same round.
                let header = &proposal.block.header;
                let twin = self.build(
                    node,
                    header.slot,
                    header.parent_qc.clone(),
                    header.timeout_cert.clone(),
                    0xee,
                );
                let twin = self.signed(node, twin);
                self.published
                    .insert(twin.block.header.block_hash(&self.network), twin.clone());
                self.published
                    .insert(header.block_hash(&self.network), (*proposal).clone());
                let n = self.engines.len();
                for to in (0..n).filter(|&to| to != node) {
                    if self.scenario.behaviours[to] == Behaviour::DoubleVoter {
                        // Collusion: the double voter gets both twins so it can sign both.
                        self.send(node, to, ConsensusMessage::Proposal(proposal.clone()));
                        self.send(node, to, ConsensusMessage::Proposal(Box::new(twin.clone())));
                        continue;
                    }
                    let message = if to % 2 == 0 {
                        ConsensusMessage::Proposal(proposal.clone())
                    } else {
                        ConsensusMessage::Proposal(Box::new(twin.clone()))
                    };
                    self.send(node, to, message);
                }
            }
            Output::Broadcast(message) => {
                if let ConsensusMessage::Proposal(proposal) = &message {
                    self.published.insert(
                        proposal.block.header.block_hash(&self.network),
                        (**proposal).clone(),
                    );
                }
                self.broadcast(node, &message);
            }
            Output::FetchBlock { block_hash } => {
                // Answered by some other node over the same lossy, partitionable network.
                if let Some(proposal) = self.published.get(&block_hash).cloned() {
                    let n = self.engines.len();
                    let from = (node + 1 + self.rng.range(0, n as u64 - 2) as usize) % n;
                    if self.honest(from) {
                        self.send(from, node, ConsensusMessage::Proposal(Box::new(proposal)));
                    }
                }
            }
            Output::Execute(proposal) => {
                let hash = proposal.block.header.block_hash(&self.network);
                let valid = !self.invalid.contains(&hash);
                let delay = self.rng.range(1, 20);
                self.schedule(
                    self.now + delay,
                    Event::Executed {
                        node,
                        block_hash: hash,
                        valid,
                    },
                );
            }
            Output::BuildProposal {
                round,
                parent_qc,
                timeout_cert,
            } => {
                let proposal = self.build(
                    node,
                    round,
                    *parent_qc,
                    timeout_cert.map(|tc| *tc),
                    node as u8,
                );
                if behaviour == Behaviour::InvalidProposer {
                    self.invalid
                        .insert(proposal.block.header.block_hash(&self.network));
                }
                self.input(node, Input::Built(Box::new(proposal)));
            }
            Output::ArmTimer { round, after_ms } => {
                self.schedule(self.now + after_ms, Event::Timer { node, round })
            }
            Output::Finalize { blocks, proof } => {
                for block in &blocks {
                    let hash = block.block.header.block_hash(&self.network);
                    self.outcome.finalized[node].insert(block.block.header.height, hash);
                }
                assert_eq!(
                    blocks
                        .last()
                        .map(|b| b.block.header.block_hash(&self.network)),
                    Some(proof.block_hash)
                );
            }
            Output::Evidence(evidence) => self.outcome.evidence.push(*evidence),
        }
    }

    /// Adversarial votes: a double voter signs every proposal it sees.
    fn adversary_on_delivery(&mut self, node: usize, message: &ConsensusMessage) {
        if self.scenario.behaviours[node] != Behaviour::DoubleVoter {
            return;
        }
        if let ConsensusMessage::Proposal(proposal) = message {
            let header = &proposal.block.header;
            let hash = header.block_hash(&self.network);
            let digest =
                QuorumCertificate::vote_digest(&self.network, header.slot, &hash, header.epoch);
            let vote = Vote {
                round: header.slot,
                block_hash: hash,
                epoch: header.epoch,
                voter: ValidatorIndex::new(node as u16),
                signature: self.keys[node].sign(&digest).to_bytes(),
            };
            self.broadcast(node, &ConsensusMessage::Vote(vote));
        }
    }

    pub fn run(mut self) -> Outcome {
        for node in 0..self.engines.len() {
            self.input(node, Input::Start);
        }
        while let Some(((at, _), event)) = self.queue.pop_first() {
            if at > self.scenario.duration_ms {
                break;
            }
            self.now = at;
            match event {
                Event::Deliver { to, message } => {
                    self.outcome.messages_delivered += 1;
                    self.adversary_on_delivery(to, &message);
                    self.input(to, Input::Message(message));
                }
                Event::Executed {
                    node,
                    block_hash,
                    valid,
                } => self.input(
                    node,
                    Input::Executed {
                        block_hash,
                        valid,
                        reason: "simulated execution".to_owned(),
                    },
                ),
                Event::Timer { node, round } => self.input(node, Input::RoundTimer(round)),
            }
        }
        let silent: Vec<usize> = (0..self.engines.len())
            .filter(|&n| !self.honest(n))
            .collect();
        for node in silent {
            self.outcome.finalized[node].clear();
        }
        self.outcome
    }
}

fn key_for(index: usize) -> BlsSecretKey {
    let mut material = [0u8; 32];
    material[..8].copy_from_slice(&(index as u64 + 1).to_le_bytes());
    BlsSecretKey::from_key_material(&Secret::new(material)).unwrap()
}

impl Outcome {
    /// No two nodes finalized different blocks at the same height.
    pub fn check_safety(&self) {
        let mut agreed: BTreeMap<Height, (usize, Hash32)> = BTreeMap::new();
        for (node, chain) in self.finalized.iter().enumerate() {
            for (height, hash) in chain {
                if let Some((other, theirs)) = agreed.get(height) {
                    assert_eq!(
                        hash, theirs,
                        "SAFETY VIOLATION: nodes {other} and {node} finalized different blocks at height {height}"
                    );
                } else {
                    agreed.insert(*height, (node, *hash));
                }
            }
            let heights: Vec<u64> = chain.keys().map(|h| h.get()).collect();
            for pair in heights.windows(2) {
                assert_eq!(
                    pair[1],
                    pair[0] + 1,
                    "node {node} finalized a non-contiguous chain: {heights:?}"
                );
            }
        }
    }

    /// The lowest finalized height among the given nodes.
    pub fn min_finalized(&self, nodes: impl IntoIterator<Item = usize>) -> u64 {
        nodes
            .into_iter()
            .map(|n| self.finalized[n].keys().next_back().map_or(0, |h| h.get()))
            .min()
            .unwrap_or(0)
    }
}
