//! The mempool's fairness and its behaviour when full (spec Section 21).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use aletheia_core::{AssetId, SignedTransaction};
use aletheia_node::mempool::{Admitted, Mempool};
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};

fn transfer(devnet: &Devnet, from: usize, nonce: u64, max_fee: u128) -> SignedTransaction {
    let mut body = devnet.body(
        from,
        nonce,
        aletheia_core::Payload::Transfer(aletheia_core::TransferLeg {
            recipient: devnet.address(0),
            asset: AssetId::AEY,
            amount: 1,
        }),
    );
    body.fee.max_fee = max_fee;
    devnet.sign(from, body)
}

fn admit(pool: &mut Mempool, devnet: &Devnet, tx: SignedTransaction) -> Admitted {
    let verified = devnet.verify(&[tx]).unwrap().remove(0);
    pool.insert(verified).unwrap()
}

#[test]
fn candidates_take_turns_across_senders_highest_fee_first() {
    let devnet = Devnet::new(4, ONE_AEY, 1_000 * ONE_ALNT);
    let mut pool = Mempool::new();
    // Sender 1 queues three, sender 2 one with a higher fee, sender 3 one.
    for nonce in 0..3 {
        admit(&mut pool, &devnet, transfer(&devnet, 1, nonce, 10_000));
    }
    admit(&mut pool, &devnet, transfer(&devnet, 2, 0, 20_000));
    admit(&mut pool, &devnet, transfer(&devnet, 3, 0, 10_000));
    let senders: Vec<_> = pool
        .candidates(3)
        .iter()
        .map(|tx| tx.transaction().body.sender)
        .collect();
    assert_eq!(senders[0], devnet.address(2), "the highest fee goes first");
    assert!(senders.contains(&devnet.address(1)) && senders.contains(&devnet.address(3)));
    assert_eq!(
        senders.iter().filter(|s| **s == devnet.address(1)).count(),
        1,
        "one per sender per pass: a long queue cannot crowd others out"
    );
}

#[test]
fn a_full_pool_evicts_a_cheaper_tail_and_refuses_a_cheaper_newcomer() {
    let devnet = Devnet::new(4, ONE_AEY, 1_000 * ONE_ALNT);
    let one = devnet.verify(&[transfer(&devnet, 1, 0, 10_000)]).unwrap()[0].encoded_len();
    let mut pool = Mempool::with_max_bytes(one * 2 + one / 2);
    admit(&mut pool, &devnet, transfer(&devnet, 1, 0, 10_000));
    admit(&mut pool, &devnet, transfer(&devnet, 2, 0, 5_000));
    assert_eq!(pool.len(), 2);

    // Cheaper than everything held: refused.
    let cheap = devnet
        .verify(&[transfer(&devnet, 3, 0, 1_000)])
        .unwrap()
        .remove(0);
    assert!(pool.insert(cheap).is_err());

    // Pays more than the cheapest tail: takes its place.
    let rich = transfer(&devnet, 3, 0, 50_000);
    admit(&mut pool, &devnet, rich.clone());
    assert_eq!(pool.len(), 2);
    let senders: Vec<_> = pool
        .candidates(10)
        .iter()
        .map(|tx| tx.transaction().body.sender)
        .collect();
    assert!(
        !senders.contains(&devnet.address(2)),
        "the 5,000 one was evicted"
    );
    assert!(senders.contains(&devnet.address(3)));
}

#[test]
fn eviction_never_leaves_a_nonce_gap() {
    let devnet = Devnet::new(4, ONE_AEY, 1_000 * ONE_ALNT);
    let one = devnet.verify(&[transfer(&devnet, 1, 0, 10_000)]).unwrap()[0].encoded_len();
    let mut pool = Mempool::with_max_bytes(one * 2 + one / 2);
    // Sender 1's nonce 0 is cheap but not its last; nonce 1 is its tail.
    admit(&mut pool, &devnet, transfer(&devnet, 1, 0, 1_000));
    admit(&mut pool, &devnet, transfer(&devnet, 1, 1, 9_000));
    admit(&mut pool, &devnet, transfer(&devnet, 2, 0, 50_000));
    let nonces: Vec<u64> = pool
        .candidates(10)
        .iter()
        .filter(|tx| tx.transaction().body.sender == devnet.address(1))
        .map(|tx| tx.transaction().body.nonce)
        .collect();
    assert_eq!(nonces, vec![0], "the tail (nonce 1) went, not nonce 0");
}
