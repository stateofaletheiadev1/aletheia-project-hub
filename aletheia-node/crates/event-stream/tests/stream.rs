//! The Finalized Event Stream over a devnet's finalized blocks (APS-0058): order, resumption
//! at any cursor, filters, proofs, back-pressure and the consumer's checks.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use std::collections::BTreeSet;

use aletheia_core::{AssetId, NetworkIdentity};
use aletheia_event_stream::{
    Consumer, Cursor, Envelope, FinalizedBlock, FinalizedSource, Message, StreamRequest,
    Subscription, Verdict, verify_envelope,
};
use aletheia_test_harness::{Devnet, ONE_AEY, ONE_ALNT};

struct Chain<'a>(&'a Devnet);

impl FinalizedSource for Chain<'_> {
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

/// Five blocks, each with two transfers (one event each) and fees.
fn devnet() -> Devnet {
    let mut net = Devnet::new(4, 100 * ONE_AEY, 1_000 * ONE_ALNT);
    for round in 0..5u64 {
        let txs = (0..2)
            .map(|from| {
                let nonce = net.next_nonce(from);
                let to = net.address(3);
                net.transfer(from, nonce, to, AssetId::AEY, ONE_AEY + u128::from(round))
            })
            .collect();
        net.produce(txs).unwrap();
    }
    net
}

fn drain(sub: &mut Subscription) -> Vec<Envelope> {
    let mut out = Vec::new();
    while let Some(message) = sub.next_message() {
        if let Message::Event(envelope) = message {
            out.push(*envelope);
        }
    }
    out
}

fn all(net: &Devnet, after: Option<Cursor>, proofs: bool) -> Vec<Envelope> {
    let request = StreamRequest {
        after,
        kinds: BTreeSet::new(),
        with_proofs: proofs,
    };
    let mut sub = Subscription::new(request, net.network, 10_000);
    sub.pump(&Chain(net));
    drain(&mut sub)
}

#[test]
fn events_arrive_in_cursor_order_linked_and_provable() {
    let net = devnet();
    let events = all(&net, None, true);
    assert_eq!(events.len(), 10, "two transfer events per block");
    for pair in events.windows(2) {
        assert!(pair[0].cursor < pair[1].cursor);
        assert_eq!(pair[1].previous, Some(pair[0].cursor));
    }
    assert_eq!(events[0].previous, None);
    assert!(events.iter().all(|e| e.kind == 1), "asset transfers");
    let network: NetworkIdentity = net.network;
    for envelope in &events {
        let root = net.blocks[usize::try_from(envelope.cursor.height - 1).unwrap()]
            .0
            .block
            .header
            .event_root;
        verify_envelope(&network, envelope, &root).unwrap();
        // A changed event no longer verifies.
        let mut forged = envelope.clone();
        forged.event.data.push(0);
        assert!(verify_envelope(&network, &forged, &root).is_err());
    }
}

#[test]
fn a_kind_filter_keeps_only_those_kinds() {
    let net = devnet();
    let request = StreamRequest {
        after: None,
        kinds: [100u16].into_iter().collect(),
        with_proofs: false,
    };
    let mut sub = Subscription::new(request, net.network, 100);
    sub.pump(&Chain(&net));
    assert!(
        drain(&mut sub).is_empty(),
        "no APN payments in these blocks"
    );
}

#[test]
fn a_slow_subscriber_is_disconnected_not_waited_for() {
    let net = devnet();
    let request = StreamRequest {
        after: None,
        kinds: BTreeSet::new(),
        with_proofs: false,
    };
    let mut sub = Subscription::new(request, net.network, 3);
    sub.pump(&Chain(&net));
    assert!(sub.is_disconnected());
    assert_eq!(
        sub.next_message(),
        Some(Message::Disconnect {
            code: "STREAM_CONSUMER_TOO_SLOW"
        })
    );
}

#[test]
fn the_consumer_drops_resends_stops_on_gaps_and_skips_unknown_kinds() {
    let net = devnet();
    let events = all(&net, None, false);
    let mut consumer = Consumer::new(None, &[1]);
    for e in &events[..4] {
        assert_eq!(consumer.judge(e), Verdict::Apply);
        consumer.commit(e.cursor);
    }
    // The server resends something already applied.
    assert_eq!(consumer.judge(&events[2]), Verdict::Duplicate);
    // One envelope lost on the way: the next one's `previous` does not match.
    assert_eq!(consumer.judge(&events[5]), Verdict::Gap);
    consumer.reset();
    // Resuming from the committed cursor works.
    let resumed = all(&net, consumer.committed(), false);
    assert_eq!(resumed[0].cursor, events[4].cursor);
    let mut consumer = Consumer::new(consumer.committed(), &[1]);
    assert_eq!(consumer.judge(&resumed[0]), Verdict::Apply);
    // A consumer that does not know kind 1 records and skips it.
    let mut other = Consumer::new(None, &[100]);
    assert_eq!(other.judge(&events[0]), Verdict::Skip);
}

proptest::proptest! {
    #![proptest_config(proptest::prelude::ProptestConfig::with_cases(32))]

    /// Resuming after any cursor yields exactly the events after it (APS-0058 rule 2).
    #[test]
    fn resume_at_any_cursor_gives_exactly_the_rest(cut in 0usize..10) {
        let net = devnet();
        let everything = all(&net, None, false);
        let after = everything[cut].cursor;
        let rest = all(&net, Some(after), false);
        let expected: Vec<Cursor> = everything[cut + 1..].iter().map(|e| e.cursor).collect();
        let got: Vec<Cursor> = rest.iter().map(|e| e.cursor).collect();
        proptest::prop_assert_eq!(got, expected);
        // The events are the same events.
        for (a, b) in rest.iter().zip(&everything[cut + 1..]) {
            proptest::prop_assert_eq!(&a.event, &b.event);
        }
    }
}
