//! Mandatory determinism test (spec Section 53).
//!
//! ```text
//! Same genesis + same transactions + same protocol version
//!   => identical block hashes, state roots, receipt roots, event roots and full state dumps
//! ```
//!
//! [`run_corpus`] builds a seeded workload on the single-node harness and returns one line per
//! block plus a hash of the complete final state. The test compares it with the golden file
//! checked in under `golden/`; changing the golden requires a protocol-version decision or an
//! ADR (Section 53 item 5). CI runs it on every supported architecture; outputs must match
//! byte for byte.
//!
//! The corpus uses its own xorshift generator rather than a `rand` crate so the workload
//! itself can never change underneath the golden file with a dependency update.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects,
    clippy::as_conversions,
    clippy::cast_possible_truncation,
    reason = "test-only corpus driver"
)]

use std::collections::BTreeMap;
use std::fmt::Write as _;

use aletheia_core::{
    Address, AddressType, AssetId, Hash32, Payload, SignedTransaction, TransferLeg,
};
use aletheia_state::JellyfishMerkleTree;
use aletheia_test_harness::{Devnet, EU_PRICE_AEY, ONE_AEY, ONE_ALNT};

pub const CORPUS_SEED: u64 = 0x416c_6574_6865_6961; // "Aletheia"
pub const CORPUS_BLOCKS: u64 = 200;
const ACCOUNTS: usize = 8;

/// xorshift64*: tiny, fixed, and enough to vary a workload.
struct Corpus(u64);

impl Corpus {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
}

fn fresh_recipient(corpus: &mut Corpus) -> Address {
    let mut bytes = [0u8; 32];
    for chunk in bytes.chunks_mut(8) {
        chunk.copy_from_slice(&corpus.next().to_le_bytes());
    }
    Address::new(AddressType::Ed25519Account, Hash32::from_bytes(bytes))
}

fn generate_block(
    net: &Devnet,
    corpus: &mut Corpus,
    nonces: &mut BTreeMap<usize, u64>,
) -> Vec<SignedTransaction> {
    let count = corpus.below(12);
    let mut txs = Vec::new();
    for _ in 0..count {
        let from = corpus.below(ACCOUNTS as u64) as usize;
        let nonce = *nonces.entry(from).or_insert_with(|| net.next_nonce(from));
        let recipient = if corpus.below(3) == 0 {
            fresh_recipient(corpus)
        } else {
            net.address(corpus.below(ACCOUNTS as u64) as usize)
        };
        let asset = if corpus.below(2) == 0 {
            AssetId::AEY
        } else {
            AssetId::ALNT
        };
        let amount = match corpus.below(10) {
            0 => u128::MAX >> 8, // far beyond any balance: the payload fails, the fee is paid
            1 => 1,
            _ => {
                u128::from(corpus.below(1_000))
                    * if asset == AssetId::AEY {
                        ONE_AEY / 1_000
                    } else {
                        1
                    }
            }
        }
        .max(1);
        let payload = if corpus.below(5) == 0 {
            let legs = (0..1 + corpus.below(4))
                .map(|_| TransferLeg {
                    recipient: net.address(corpus.below(ACCOUNTS as u64) as usize),
                    asset,
                    amount,
                })
                .collect();
            Payload::BatchTransfer(legs)
        } else {
            Payload::Transfer(TransferLeg {
                recipient,
                asset,
                amount,
            })
        };
        let mut body = net.body(from, nonce, payload);
        if corpus.below(2) == 0 {
            body.fee.fee_asset = AssetId::AEY;
            body.fee.max_fee = u128::from(body.fee.eu_limit) * EU_PRICE_AEY;
        }
        if corpus.below(8) == 0 {
            body.fee.eu_limit = 1_500; // below the 2,000 EU transfer cost: OUT_OF_EU
            body.fee.max_fee = u128::from(body.fee.eu_limit)
                * if body.fee.fee_asset == AssetId::AEY {
                    EU_PRICE_AEY
                } else {
                    1
                };
        }
        body.memo = corpus.next().to_le_bytes().to_vec();
        nonces.insert(from, nonce + 1);
        txs.push(net.sign(from, body));
    }
    txs
}

/// Runs the corpus from genesis. Returns one line per block and a final state-dump line.
pub fn run_corpus(seed: u64, blocks: u64) -> String {
    let mut net = Devnet::new(ACCOUNTS, 1_000_000 * ONE_AEY, 1_000_000_000 * ONE_ALNT);
    let mut corpus = Corpus(seed);
    let mut nonces = BTreeMap::new();
    let mut out = String::new();
    let genesis_hash = net.head.block_hash(&net.network);
    writeln!(
        out,
        "genesis {} {} {}",
        net.network.genesis_id(),
        genesis_hash,
        net.head.state_root
    )
    .unwrap();
    for _ in 0..blocks {
        let txs = generate_block(&net, &mut corpus, &mut nonces);
        let (proposal, executed) = net.produce(txs).unwrap();
        let header = &proposal.block.header;
        let statuses: String = executed
            .receipts
            .iter()
            .map(|r| char::from(b'0' + r.status.code()))
            .collect();
        writeln!(
            out,
            "{} {} state={} receipts={} events={} txs={} eu={} status={}",
            header.height,
            header.block_hash(&net.network),
            header.state_root,
            header.receipt_root,
            header.event_root,
            header.tx_count,
            header.eu_used,
            statuses
        )
        .unwrap();
    }
    writeln!(out, "state-dump {}", state_dump_hash(&net)).unwrap();
    out
}

/// BLAKE3 over every live (key, value) pair at the head, in key order.
fn state_dump_hash(net: &Devnet) -> Hash32 {
    let tree = JellyfishMerkleTree::new(&net.store, net.network);
    let mut hasher = blake3::Hasher::new();
    let mut after = None;
    loop {
        let page = tree
            .live_entries(net.head.height.get(), after.as_ref(), 1_000)
            .unwrap();
        let Some(last) = page.last() else { break };
        after = Some(last.0);
        for (key, value) in &page {
            hasher.update(key.as_bytes());
            hasher.update(&(value.len() as u64).to_le_bytes());
            hasher.update(value);
        }
    }
    Hash32::from_bytes(*hasher.finalize().as_bytes())
}
