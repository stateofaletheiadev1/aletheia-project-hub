//! The address book (ADR-070): node keys and the address each accepts connections at, owned by
//! the network supervisor.
//!
//! An address learned from a live connection (one we dialed, or an inbound peer's announced
//! listening port) is authoritative; an address heard from another peer is a hint and never
//! replaces it. The book is bounded; when full, the entry heard of longest ago goes first.
//! Nothing here is trusted: a connection to any address still completes the signed handshake.

use std::collections::BTreeMap;
use std::net::SocketAddr;

use crate::message::PeerAddress;
use crate::network::PeerId;

/// Most node keys kept.
pub const MAX_BOOK_ENTRIES: usize = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Entry {
    address: SocketAddr,
    /// Learned from a connection to this node itself, not from another peer.
    live: bool,
    /// Order of the last time the entry was learned or confirmed; larger is more recent.
    seen: u64,
}

#[derive(Debug, Default)]
pub struct PeerBook {
    entries: BTreeMap<PeerId, Entry>,
    clock: u64,
}

impl PeerBook {
    fn tick(&mut self) -> u64 {
        self.clock = self.clock.saturating_add(1);
        self.clock
    }

    fn evict(&mut self) {
        while self.entries.len() > MAX_BOOK_ENTRIES {
            let oldest = self
                .entries
                .iter()
                .min_by_key(|(_, entry)| (entry.live, entry.seen))
                .map(|(key, _)| *key);
            match oldest {
                Some(key) => {
                    self.entries.remove(&key);
                }
                None => break,
            }
        }
    }

    /// An address this node reached the peer at, or the peer announced for its own connection.
    pub fn learn_live(&mut self, node_key: PeerId, address: SocketAddr) {
        let seen = self.tick();
        self.entries.insert(
            node_key,
            Entry {
                address,
                live: true,
                seen,
            },
        );
        self.evict();
    }

    /// An address another peer told us about. Never replaces an address learned live, and our
    /// own key is never stored.
    pub fn learn_hint(&mut self, own_key: &PeerId, hint: PeerAddress) {
        if &hint.node_key == own_key || hint.address.port() == 0 {
            return;
        }
        if self.entries.get(&hint.node_key).is_some_and(|e| e.live) {
            return;
        }
        let seen = self.tick();
        self.entries.insert(
            hint.node_key,
            Entry {
                address: hint.address,
                live: false,
                seen,
            },
        );
        self.evict();
    }

    pub fn address(&self, node_key: &PeerId) -> Option<SocketAddr> {
        self.entries.get(node_key).map(|entry| entry.address)
    }

    /// Up to `limit` entries for a `Peers` answer, most recently learned first, without the
    /// peer asking.
    pub fn answer(&self, limit: usize, asking: &PeerId) -> Vec<PeerAddress> {
        let mut entries: Vec<(&PeerId, &Entry)> = self
            .entries
            .iter()
            .filter(|(key, _)| *key != asking)
            .collect();
        entries.sort_by(|a, b| b.1.seen.cmp(&a.1.seen));
        entries
            .into_iter()
            .take(limit)
            .map(|(key, entry)| PeerAddress {
                node_key: *key,
                address: entry.address,
            })
            .collect()
    }

    /// Node keys known, most recently learned first.
    pub fn known(&self) -> Vec<PeerId> {
        let mut entries: Vec<(&PeerId, &Entry)> = self.entries.iter().collect();
        entries.sort_by(|a, b| b.1.seen.cmp(&a.1.seen));
        entries.into_iter().map(|(key, _)| *key).collect()
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(port: u16) -> SocketAddr {
        SocketAddr::from(([127, 0, 0, 1], port))
    }

    fn hint(key: u8, port: u16) -> PeerAddress {
        PeerAddress {
            node_key: [key; 32],
            address: at(port),
        }
    }

    #[test]
    fn a_hint_never_replaces_a_live_address_and_our_own_key_is_never_stored() {
        let mut book = PeerBook::default();
        let me = [9; 32];
        book.learn_live([1; 32], at(7771));
        book.learn_hint(&me, hint(1, 6666));
        assert_eq!(book.address(&[1; 32]), Some(at(7771)));
        book.learn_hint(&me, hint(9, 7000));
        assert_eq!(book.address(&me), None);
        book.learn_hint(&me, hint(2, 0));
        assert_eq!(book.address(&[2; 32]), None, "port 0 is never an address");
        book.learn_hint(&me, hint(2, 7772));
        book.learn_hint(&me, hint(2, 7773));
        assert_eq!(
            book.address(&[2; 32]),
            Some(at(7773)),
            "a newer hint replaces a hint"
        );
    }

    #[test]
    fn answers_are_newest_first_bounded_and_leave_out_the_asker() {
        let mut book = PeerBook::default();
        let me = [0; 32];
        for key in 1..=5u8 {
            book.learn_hint(&me, hint(key, 7000 + u16::from(key)));
        }
        let answer = book.answer(3, &[5; 32]);
        let keys: Vec<u8> = answer.iter().map(|p| p.node_key[0]).collect();
        assert_eq!(keys, vec![4, 3, 2]);
    }

    #[test]
    fn the_book_is_bounded_and_drops_hints_before_live_addresses() {
        let mut book = PeerBook::default();
        let me = [0; 32];
        book.learn_live([1; 32], at(1));
        for i in 0..(MAX_BOOK_ENTRIES + 10) {
            let mut key = [0u8; 32];
            key[..8].copy_from_slice(&(u64::try_from(i).unwrap() + 100).to_le_bytes());
            book.learn_hint(
                &me,
                PeerAddress {
                    node_key: key,
                    address: at(2),
                },
            );
        }
        assert_eq!(book.len(), MAX_BOOK_ENTRIES);
        assert_eq!(
            book.address(&[1; 32]),
            Some(at(1)),
            "the live entry survives"
        );
    }
}
