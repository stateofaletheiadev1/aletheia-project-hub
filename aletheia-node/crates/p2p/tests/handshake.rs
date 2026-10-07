//! TLS 1.3 mutual authentication and the signed application handshake (spec Section 36).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic
)]

use std::net::SocketAddr;

use aletheia_core::{ChainId, ErrorCode, Hash32, Height, NetworkIdentity, NetworkKind};
use aletheia_crypto::{Ed25519SigningKey, Secret};
use aletheia_p2p::tls::server_config;
use aletheia_p2p::{LocalNode, Message, PeerConnection, PeerExpectation, TransportCertificate};
use tokio::net::TcpListener;
use tokio_rustls::TlsAcceptor;

fn network(genesis_byte: u8) -> NetworkIdentity {
    NetworkIdentity::new(
        ChainId::new(7771),
        NetworkKind::Devnet,
        Hash32::from_bytes([genesis_byte; 32]),
    )
}

fn node(seed: u8, network: NetworkIdentity, versions: (u16, u16)) -> LocalNode {
    LocalNode {
        network,
        versions,
        node_key: Ed25519SigningKey::from_seed(&Secret::new([seed; 32])),
        certificate: TransportCertificate::generate().unwrap(),
    }
}

const TIP: (Height, Hash32) = (Height::GENESIS, Hash32::ZERO);

/// Accepts one connection on an ephemeral port, returning the address and the accept result.
async fn listen_once(
    local: LocalNode,
) -> (
    SocketAddr,
    tokio::task::JoinHandle<Result<PeerConnection, aletheia_core::AletheiaError>>,
) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let acceptor = TlsAcceptor::from(server_config(&local.certificate).unwrap());
    let task = tokio::spawn(async move {
        let (tcp, _) = listener.accept().await.unwrap();
        PeerConnection::accept(tcp, &acceptor, &local, TIP).await
    });
    (address, task)
}

#[tokio::test]
async fn two_nodes_authenticate_each_other_and_exchange_messages() {
    let listener_node = node(1, network(9), (1, 1));
    let listener_key = listener_node.node_key.public_key();
    let dialer = node(2, network(9), (1, 2));
    let (address, accepted) = listen_once(listener_node).await;

    let mut outbound = PeerConnection::connect(
        address,
        &dialer,
        TIP,
        PeerExpectation {
            node_key: Some(listener_key.to_bytes()),
            cert_hash: None,
        },
    )
    .await
    .unwrap();
    let mut inbound = accepted.await.unwrap().unwrap();
    assert_eq!(outbound.peer().node_key, listener_key);
    assert_eq!(inbound.peer().node_key, dialer.node_key.public_key());
    assert_eq!(inbound.peer().cert_hash, dialer.certificate.hash());

    outbound
        .send(&Message::Ping { nonce: 77 }.to_frame(1))
        .await
        .unwrap();
    let frame = inbound.recv().await.unwrap();
    assert_eq!(
        Message::from_frame(&frame).unwrap(),
        Message::Ping { nonce: 77 }
    );
}

#[tokio::test]
async fn a_peer_on_another_genesis_is_refused() {
    let (address, accepted) = listen_once(node(1, network(9), (1, 1))).await;
    let error = PeerConnection::connect(
        address,
        &node(2, network(8), (1, 1)),
        TIP,
        PeerExpectation::default(),
    )
    .await
    .unwrap_err();
    assert_eq!(error.code(), ErrorCode::P2pWrongNetwork);
    assert!(accepted.await.unwrap().is_err());
}

#[tokio::test]
async fn non_overlapping_protocol_versions_are_refused() {
    let (address, _accepted) = listen_once(node(1, network(9), (3, 4))).await;
    let error = PeerConnection::connect(
        address,
        &node(2, network(9), (1, 2)),
        TIP,
        PeerExpectation::default(),
    )
    .await
    .unwrap_err();
    assert_eq!(error.code(), ErrorCode::P2pVersionMismatch);
}

#[tokio::test]
async fn a_peer_with_an_unregistered_node_key_is_refused() {
    let (address, _accepted) = listen_once(node(1, network(9), (1, 1))).await;
    let wrong = Ed25519SigningKey::from_seed(&Secret::new([5; 32]))
        .public_key()
        .to_bytes();
    let error = PeerConnection::connect(
        address,
        &node(2, network(9), (1, 1)),
        TIP,
        PeerExpectation {
            node_key: Some(wrong),
            cert_hash: None,
        },
    )
    .await
    .unwrap_err();
    assert_eq!(error.code(), ErrorCode::P2pHandshakeFailed);
}

#[tokio::test]
async fn a_certificate_that_is_not_the_pinned_one_fails_tls() {
    let (address, _accepted) = listen_once(node(1, network(9), (1, 1))).await;
    let pin = PeerExpectation {
        node_key: None,
        cert_hash: Some(Hash32::from_bytes([7; 32])),
    };
    let error = PeerConnection::connect(address, &node(2, network(9), (1, 1)), TIP, pin)
        .await
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::P2pHandshakeFailed);
    assert!(error.detail().contains("TLS"), "{error}");
}

#[tokio::test]
async fn connecting_to_ourselves_is_refused() {
    let (address, _accepted) = listen_once(node(1, network(9), (1, 1))).await;
    let error = PeerConnection::connect(
        address,
        &node(1, network(9), (1, 1)),
        TIP,
        PeerExpectation::default(),
    )
    .await
    .unwrap_err();
    assert!(error.detail().contains("ourselves"), "{error}");
}

#[tokio::test]
async fn a_peer_that_never_answers_is_dropped_after_the_handshake_timeout() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let silent = tokio::spawn(async move {
        let (tcp, _) = listener.accept().await.unwrap();
        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
        drop(tcp);
    });
    let started = std::time::Instant::now();
    let error = PeerConnection::connect(
        address,
        &node(2, network(9), (1, 1)),
        TIP,
        PeerExpectation::default(),
    )
    .await
    .unwrap_err();
    assert!(error.detail().contains("within 5 s"), "{error}");
    assert!(started.elapsed() < std::time::Duration::from_secs(7));
    silent.abort();
}
