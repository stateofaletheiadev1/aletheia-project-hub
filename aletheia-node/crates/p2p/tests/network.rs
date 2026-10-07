//! The network service: peering, priority delivery, scoring, bans and connection limits
//! (spec Section 36; Phase 4 "DoS limits tested").

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::net::SocketAddr;
use std::time::Duration;

use aletheia_core::{ChainId, Hash32, Height, NetworkIdentity, NetworkKind};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use aletheia_p2p::limits::MAX_PENDING_HANDSHAKES;
use aletheia_p2p::network::start;
use aletheia_p2p::{
    Channel, DialTarget, Frame, LocalNode, Message, NetworkCommand, NetworkConfig, NetworkEvent,
    NetworkHandle, PeerConnection, PeerExpectation, TransportCertificate,
};
use tokio::io::AsyncReadExt;

const TIP: (Height, Hash32) = (Height::GENESIS, Hash32::ZERO);

fn local(seed: u8) -> LocalNode {
    LocalNode {
        network: NetworkIdentity::new(
            ChainId::new(7771),
            NetworkKind::Devnet,
            Hash32::from_bytes([3; 32]),
        ),
        versions: (1, 1),
        node_key: Ed25519SigningKey::from_seed(&Secret::new([seed; 32])),
        certificate: TransportCertificate::generate().unwrap(),
    }
}

fn id(seed: u8) -> [u8; 32] {
    Ed25519SigningKey::from_seed(&Secret::new([seed; 32]))
        .public_key()
        .to_bytes()
}

async fn node(seed: u8, dial: Vec<SocketAddr>) -> NetworkHandle {
    let config = NetworkConfig {
        listen: "127.0.0.1:0".parse().unwrap(),
        dial: dial
            .into_iter()
            .map(|address| DialTarget {
                address,
                expect: PeerExpectation::default(),
            })
            .collect(),
    };
    start(config, local(seed), TIP).await.unwrap()
}

async fn next_event(handle: &mut NetworkHandle) -> NetworkEvent {
    tokio::time::timeout(Duration::from_secs(10), handle.events.recv())
        .await
        .expect("event within 10 s")
        .expect("network running")
}

async fn wait_connected(handle: &mut NetworkHandle, count: usize) -> Vec<[u8; 32]> {
    let mut peers = Vec::new();
    while peers.len() < count {
        if let NetworkEvent::Connected { peer, .. } = next_event(handle).await {
            peers.push(peer);
        }
    }
    peers
}

#[tokio::test]
async fn peers_connect_and_receive_broadcasts_and_direct_messages() {
    let mut a = node(1, vec![]).await;
    let mut b = node(2, vec![a.local_addr]).await;
    let mut c = node(3, vec![a.local_addr]).await;
    let mut seen = wait_connected(&mut a, 2).await;
    seen.sort();
    let mut expected = vec![id(2), id(3)];
    expected.sort();
    assert_eq!(seen, expected);
    wait_connected(&mut b, 1).await;
    wait_connected(&mut c, 1).await;

    a.commands
        .send(NetworkCommand::Broadcast(Message::Ping { nonce: 5 }))
        .await
        .unwrap();
    for handle in [&mut b, &mut c] {
        assert_eq!(
            next_event(handle).await,
            NetworkEvent::Message {
                peer: id(1),
                message: Message::Ping { nonce: 5 }
            }
        );
    }
    b.commands
        .send(NetworkCommand::Send {
            peer: id(1),
            message: Message::Pong { nonce: 5 },
        })
        .await
        .unwrap();
    assert_eq!(
        next_event(&mut a).await,
        NetworkEvent::Message {
            peer: id(2),
            message: Message::Pong { nonce: 5 }
        }
    );
}

#[tokio::test]
async fn a_simultaneous_dial_settles_on_one_connection() {
    // Each node dials the other; both keep the connection dialed by the lower node key.
    let listener_a = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address_a = listener_a.local_addr().unwrap();
    drop(listener_a);
    let mut b = node(2, vec![address_a]).await;
    let config_a = NetworkConfig {
        listen: address_a,
        dial: vec![DialTarget {
            address: b.local_addr,
            expect: PeerExpectation::default(),
        }],
    };
    let mut a = start(config_a, local(1), TIP).await.unwrap();

    tokio::time::sleep(Duration::from_secs(3)).await;
    for handle in [&mut a, &mut b] {
        let mut open = 0i32;
        while let Ok(event) = handle.events.try_recv() {
            match event {
                NetworkEvent::Connected { .. } => open += 1,
                NetworkEvent::Disconnected { .. } => open -= 1,
                NetworkEvent::Message { .. } => {}
            }
        }
        assert_eq!(open, 1, "exactly one live connection");
    }
    a.commands
        .send(NetworkCommand::Send {
            peer: id(2),
            message: Message::Ping { nonce: 1 },
        })
        .await
        .unwrap();
    assert_eq!(
        next_event(&mut b).await,
        NetworkEvent::Message {
            peer: id(1),
            message: Message::Ping { nonce: 1 }
        }
    );
}

#[tokio::test]
async fn an_invalid_message_bans_the_peer_and_the_ban_holds_on_reconnect() {
    let mut a = node(1, vec![]).await;
    let attacker = local(9);
    let mut connection =
        PeerConnection::connect(a.local_addr, &attacker, TIP, PeerExpectation::default())
            .await
            .unwrap();
    wait_connected(&mut a, 1).await;
    // A message type that does not exist on the block channel.
    connection
        .send(&Frame {
            channel: Channel::BlockProp,
            msg_type: 99,
            request_id: 0,
            payload: vec![],
        })
        .await
        .unwrap();
    match next_event(&mut a).await {
        NetworkEvent::Disconnected { peer, reason } => {
            assert_eq!(peer, id(9));
            assert!(reason.contains("banned"), "{reason}");
        }
        other => panic!("expected a ban, got {other:?}"),
    }

    // The handshake still completes (it happens before the supervisor sees the peer), but the
    // banned node is never registered and its connection is closed.
    let mut again =
        PeerConnection::connect(a.local_addr, &attacker, TIP, PeerExpectation::default())
            .await
            .unwrap();
    assert!(
        tokio::time::timeout(Duration::from_secs(5), again.recv())
            .await
            .unwrap()
            .is_err(),
        "connection closed"
    );
    assert!(
        a.events.try_recv().is_err(),
        "no Connected event for a banned peer"
    );
}

#[tokio::test]
async fn flooding_a_channel_past_its_budget_gets_the_peer_banned() {
    let mut a = node(1, vec![]).await;
    let flooder = local(8);
    let mut connection =
        PeerConnection::connect(a.local_addr, &flooder, TIP, PeerExpectation::default())
            .await
            .unwrap();
    wait_connected(&mut a, 1).await;
    for nonce in 0..200 {
        if connection
            .send(&Message::Ping { nonce }.to_frame(0))
            .await
            .is_err()
        {
            break;
        }
    }
    let reason = loop {
        match next_event(&mut a).await {
            NetworkEvent::Disconnected { reason, .. } => break reason,
            NetworkEvent::Message { .. } | NetworkEvent::Connected { .. } => {}
        }
    };
    assert!(reason.contains("rate limit exceeded on Mgmt"), "{reason}");
}

#[tokio::test]
async fn connections_beyond_the_pending_handshake_cap_are_closed_at_once() {
    let a = node(1, vec![]).await;
    let mut idle = Vec::new();
    for _ in 0..MAX_PENDING_HANDSHAKES {
        idle.push(tokio::net::TcpStream::connect(a.local_addr).await.unwrap());
    }
    tokio::time::sleep(Duration::from_millis(200)).await;
    let mut extra = tokio::net::TcpStream::connect(a.local_addr).await.unwrap();
    let mut buffer = [0u8; 1];
    let read = tokio::time::timeout(Duration::from_secs(2), extra.read(&mut buffer))
        .await
        .expect("closed promptly, not left hanging");
    assert!(
        matches!(read, Ok(0) | Err(_)),
        "the extra connection is closed"
    );
    drop(idle);
}
