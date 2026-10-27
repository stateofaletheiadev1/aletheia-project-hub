//! The signer daemon protocol (spec Section 19.2, ADR-063): the node's `RemoteSigner` against
//! `serve_connection`, over loopback TCP so the test runs on every host (production uses a
//! Unix socket; the exchange is the same).

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::io;
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use aletheia_consensus::ConsensusSigner;
use aletheia_core::{AceDecode, AceEncode, ErrorCode, Hash32, Slot};
use aletheia_crypto::bls::{BlsPublicKey, BlsSignature};
use aletheia_crypto::{BlsSecretKey, Secret};
use aletheia_signer::protocol::{
    Connector, MAX_FRAME, Request, Response, Transport, read_frame, serve_connection, write_frame,
};
use aletheia_signer::{LocalSigner, Mark, RemoteSigner, SignerState};

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("aletheia-remote-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn key() -> BlsSecretKey {
    BlsSecretKey::from_key_material(&Secret::new([7; 32])).unwrap()
}

fn digest(byte: u8) -> Hash32 {
    Hash32::from_bytes([byte; 32])
}

/// A daemon on loopback serving `signer`; each connection is served on its own thread.
fn daemon(signer: Arc<Mutex<LocalSigner>>) -> std::net::SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let mut stream = stream.unwrap();
            let signer = Arc::clone(&signer);
            std::thread::spawn(move || {
                let _ = serve_connection(&signer, &mut stream);
            });
        }
    });
    address
}

fn connector(address: std::net::SocketAddr) -> Connector {
    Box::new(move || {
        let stream: Box<dyn Transport> = Box::new(TcpStream::connect(address)?);
        Ok(stream)
    })
}

fn local(name: &str) -> Arc<Mutex<LocalSigner>> {
    Arc::new(Mutex::new(
        LocalSigner::open(key(), &scratch(name)).unwrap(),
    ))
}

#[test]
fn messages_round_trip_and_unknown_tags_are_refused() {
    let requests = [
        Request::Hello,
        Request::Proposal {
            round: Slot::new(1),
            digest: digest(1),
        },
        Request::Vote {
            round: Slot::new(2),
            block_hash: digest(2),
            digest: digest(3),
        },
        Request::Timeout {
            round: Slot::new(4),
            digest: digest(4),
        },
    ];
    for request in requests {
        assert_eq!(
            Request::from_ace_bytes(&request.to_ace_bytes()).unwrap(),
            request
        );
    }
    let responses = [
        Response::Hello {
            public_key: key().public_key().to_bytes(),
            state: SignerState {
                proposal: None,
                vote: Some(Mark {
                    round: Slot::new(9),
                    digest: digest(9),
                }),
                timeout: None,
            },
        },
        Response::Signature([5; 96]),
        Response::Refused("no".to_owned()),
    ];
    for response in responses {
        assert_eq!(
            Response::from_ace_bytes(&response.to_ace_bytes()).unwrap(),
            response
        );
    }
    assert!(Request::from_ace_bytes(&[9]).is_err());
    assert!(Response::from_ace_bytes(&[9]).is_err());
    // Trailing bytes are not canonical.
    assert!(Request::from_ace_bytes(&[1, 0]).is_err());
}

#[test]
fn a_long_refusal_is_cut_to_fit_on_a_character_boundary() {
    let long = "é".repeat(400);
    let Response::Refused(detail) =
        Response::from_ace_bytes(&Response::Refused(long).to_ace_bytes()).unwrap()
    else {
        panic!("not a refusal");
    };
    assert_eq!(detail.len(), 512);
}

#[test]
fn oversized_frames_are_refused() {
    let mut bytes = (MAX_FRAME + 1).to_le_bytes().to_vec();
    bytes.extend(std::iter::repeat_n(0u8, 8));
    let error = read_frame(&mut io::Cursor::new(bytes)).unwrap_err();
    assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    // A clean close between frames is not an error.
    assert!(
        read_frame(&mut io::Cursor::new(Vec::new()))
            .unwrap()
            .is_none()
    );
}

#[test]
fn the_remote_signer_signs_verifiable_votes_and_refuses_equivocation() {
    let address = daemon(local("signs"));
    let mut remote = RemoteSigner::connect(connector(address)).unwrap();
    assert_eq!(remote.public_key(), key().public_key().to_bytes());

    let signature = remote
        .sign_vote(Slot::new(5), &digest(1), &digest(1))
        .unwrap();
    BlsPublicKey::from_bytes(&remote.public_key())
        .unwrap()
        .verify(&digest(1), &BlsSignature::from_bytes(&signature).unwrap())
        .unwrap();
    // The identical request again is safe and yields the same signature.
    assert_eq!(
        remote
            .sign_vote(Slot::new(5), &digest(1), &digest(1))
            .unwrap(),
        signature
    );

    let error = remote
        .sign_vote(Slot::new(5), &digest(2), &digest(2))
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::SigInvalid);
    assert!(
        error.detail().contains("different message for round 5"),
        "{error}"
    );
    let error = remote
        .sign_vote(Slot::new(4), &digest(3), &digest(3))
        .unwrap_err();
    assert!(
        error.detail().contains("below the high-water mark"),
        "{error}"
    );

    let state = remote.state().unwrap();
    assert_eq!(state.vote.map(|m| m.round), Some(Slot::new(5)));
    remote.sign_proposal(Slot::new(6), &digest(6)).unwrap();
    remote.sign_timeout(Slot::new(6), &digest(7)).unwrap();
}

#[test]
fn a_restarted_daemon_keeps_its_marks() {
    let dir = scratch("restart");
    {
        let signer = Arc::new(Mutex::new(LocalSigner::open(key(), &dir).unwrap()));
        let mut remote = RemoteSigner::connect(connector(daemon(Arc::clone(&signer)))).unwrap();
        remote
            .sign_vote(Slot::new(10), &digest(1), &digest(1))
            .unwrap();
        // The test's daemon thread keeps its handle; release the state lock as a restart would.
        drop(remote);
        let mut guard = signer.lock().unwrap();
        *guard = LocalSigner::open(key(), &scratch("restart-elsewhere")).unwrap();
    }
    let mut remote = RemoteSigner::connect(connector(daemon(Arc::new(Mutex::new(
        LocalSigner::open(key(), &dir).unwrap(),
    )))))
    .unwrap();
    assert_eq!(
        remote.state().unwrap().vote.map(|m| m.round),
        Some(Slot::new(10))
    );
    let error = remote
        .sign_vote(Slot::new(10), &digest(2), &digest(2))
        .unwrap_err();
    assert!(
        error.detail().contains("different message for round 10"),
        "{error}"
    );
}

#[test]
fn a_dropped_connection_is_replaced_transparently() {
    let signer = local("reconnect");
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        // The first connection answers hello and is then dropped; later ones are served.
        let (mut first, _) = listener.accept().unwrap();
        let body = read_frame(&mut first).unwrap().unwrap();
        assert_eq!(Request::from_ace_bytes(&body).unwrap(), Request::Hello);
        let state = signer.lock().unwrap().state();
        let public_key = signer.lock().unwrap().public_key();
        write_frame(&mut first, &Response::Hello { public_key, state }).unwrap();
        drop(first);
        for stream in listener.incoming() {
            let mut stream = stream.unwrap();
            let signer = Arc::clone(&signer);
            std::thread::spawn(move || {
                let _ = serve_connection(&signer, &mut stream);
            });
        }
    });
    let mut remote = RemoteSigner::connect(connector(address)).unwrap();
    remote
        .sign_vote(Slot::new(1), &digest(1), &digest(1))
        .unwrap();
}

#[test]
fn a_signature_that_does_not_verify_is_never_handed_to_consensus() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        while let Some(body) = read_frame(&mut stream).unwrap() {
            let response = match Request::from_ace_bytes(&body).unwrap() {
                Request::Hello => Response::Hello {
                    public_key: key().public_key().to_bytes(),
                    state: SignerState::default(),
                },
                // Signs the wrong digest.
                _ => Response::Signature(key().sign(&digest(99)).to_bytes()),
            };
            write_frame(&mut stream, &response).unwrap();
        }
    });
    let mut remote = RemoteSigner::connect(connector(address)).unwrap();
    let error = remote
        .sign_vote(Slot::new(1), &digest(1), &digest(1))
        .unwrap_err();
    assert!(error.detail().contains("does not verify"), "{error}");
}

#[test]
fn an_unreachable_signer_is_a_rejection_not_a_fail_stop() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    drop(listener);
    let error = RemoteSigner::connect(connector(address)).unwrap_err();
    assert_eq!(error.code(), ErrorCode::SigInvalid);
    assert!(!error.is_fail_stop());
}
