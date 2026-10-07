//! One authenticated peer connection: TCP, then TLS 1.3, then the signed hello exchange.
//!
//! The whole sequence is bounded by [`HANDSHAKE_TIMEOUT`]; a peer that stalls mid-handshake
//! is dropped (slowloris defence together with the pending-handshake cap in the listener).

use std::net::SocketAddr;
use std::time::Duration;

use aletheia_core::{AletheiaError, ErrorCode, Hash32, Height, NetworkIdentity};
use aletheia_crypto::{Ed25519PublicKey, Ed25519SigningKey};
use rustls::pki_types::ServerName;
use tokio::io::{AsyncReadExt, AsyncWriteExt, ReadHalf, WriteHalf};
use tokio::net::TcpStream;
use tokio_rustls::{TlsAcceptor, TlsConnector, TlsStream};

use crate::frame::{Frame, FrameDecoder};
use crate::handshake::{EXPORTER_LABEL, Hello, Role, signed_hello_frame, verify_peer_hello};
use crate::tls::{PEER_SERVER_NAME, TransportCertificate, certificate_hash, client_config};

pub const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(5);
const READ_CHUNK_BYTES: usize = 64 * 1024;

/// What this node says about itself in every handshake.
pub struct LocalNode {
    pub network: NetworkIdentity,
    pub versions: (u16, u16),
    pub node_key: Ed25519SigningKey,
    pub certificate: TransportCertificate,
}

impl core::fmt::Debug for LocalNode {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("LocalNode")
            .field("network", &self.network)
            .field("versions", &self.versions)
            .field("node_key", &self.node_key.public_key())
            .field("certificate", &self.certificate)
            .finish()
    }
}

/// What we require of a specific peer (registered validators); empty for open peering.
#[derive(Debug, Clone, Copy, Default)]
pub struct PeerExpectation {
    pub node_key: Option<[u8; 32]>,
    pub cert_hash: Option<Hash32>,
}

/// The authenticated identity of the other side.
#[derive(Debug, Clone)]
pub struct PeerIdentity {
    pub address: SocketAddr,
    pub node_key: Ed25519PublicKey,
    pub cert_hash: Hash32,
    pub hello: Hello,
}

impl PeerIdentity {
    /// Short form for logs: the first 8 hex digits of the node key.
    pub fn short_id(&self) -> String {
        aletheia_core::base16::encode(&self.node_key.to_bytes())
            .chars()
            .take(8)
            .collect()
    }
}

fn io_failure(action: &str, error: &std::io::Error) -> AletheiaError {
    AletheiaError::new(ErrorCode::P2pHandshakeFailed, format!("{action}: {error}"))
}

fn timed_out() -> AletheiaError {
    AletheiaError::new(
        ErrorCode::P2pHandshakeFailed,
        format!(
            "handshake did not finish within {} s",
            HANDSHAKE_TIMEOUT.as_secs()
        ),
    )
}

pub struct PeerConnection {
    stream: TlsStream<TcpStream>,
    decoder: FrameDecoder,
    peer: PeerIdentity,
}

impl core::fmt::Debug for PeerConnection {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("PeerConnection")
            .field("peer", &self.peer.short_id())
            .finish_non_exhaustive()
    }
}

fn local_hello(local: &LocalNode, tip: (Height, Hash32)) -> Hello {
    Hello {
        chain_id: local.network.chain_id(),
        network_kind: local.network.network_kind(),
        genesis_id: local.network.genesis_id(),
        min_version: local.versions.0,
        max_version: local.versions.1,
        node_key: local.node_key.public_key().to_bytes(),
        tip_height: tip.0,
        tip_hash: tip.1,
    }
}

async fn write_frame(
    stream: &mut TlsStream<TcpStream>,
    frame: &Frame,
) -> Result<(), AletheiaError> {
    let bytes = frame.encode()?;
    stream
        .write_all(&bytes)
        .await
        .map_err(|e| io_failure("send", &e))?;
    stream.flush().await.map_err(|e| io_failure("flush", &e))
}

async fn read_frame<R: AsyncReadExt + Unpin>(
    stream: &mut R,
    decoder: &mut FrameDecoder,
) -> Result<Frame, AletheiaError> {
    let mut chunk = vec![0u8; READ_CHUNK_BYTES];
    loop {
        if let Some(frame) = decoder.next_frame()? {
            return Ok(frame);
        }
        let read = stream
            .read(&mut chunk)
            .await
            .map_err(|e| io_failure("receive", &e))?;
        if read == 0 {
            return Err(AletheiaError::new(
                ErrorCode::P2pHandshakeFailed,
                "peer closed the connection".to_owned(),
            ));
        }
        decoder.push(chunk.get(..read).unwrap_or_default());
    }
}

impl PeerConnection {
    /// Dials `address`.
    pub async fn connect(
        address: SocketAddr,
        local: &LocalNode,
        tip: (Height, Hash32),
        expect: PeerExpectation,
    ) -> Result<PeerConnection, AletheiaError> {
        tokio::time::timeout(HANDSHAKE_TIMEOUT, async {
            let tcp = TcpStream::connect(address)
                .await
                .map_err(|e| io_failure(&format!("connect to {address}"), &e))?;
            tcp.set_nodelay(true)
                .map_err(|e| io_failure("set TCP_NODELAY", &e))?;
            let connector =
                TlsConnector::from(client_config(&local.certificate, expect.cert_hash)?);
            let name = ServerName::try_from(PEER_SERVER_NAME)
                .map_err(|e| AletheiaError::new(ErrorCode::P2pHandshakeFailed, e.to_string()))?;
            let tls = connector
                .connect(name, tcp)
                .await
                .map_err(|e| io_failure("TLS handshake", &e))?;
            let connection = tls.get_ref().1;
            let exporter = connection
                .export_keying_material([0u8; 32], EXPORTER_LABEL, None)
                .map_err(|e| {
                    AletheiaError::new(ErrorCode::P2pHandshakeFailed, format!("TLS exporter: {e}"))
                })?;
            let cert_hash = connection
                .peer_certificates()
                .and_then(|c| c.first())
                .map(|c| certificate_hash(c))
                .unwrap_or(Hash32::ZERO);
            PeerConnection::exchange(
                TlsStream::Client(tls),
                address,
                cert_hash,
                exporter,
                Role::Dialer,
                local,
                tip,
                expect.node_key,
            )
            .await
        })
        .await
        .map_err(|_| timed_out())?
    }

    /// Completes an inbound connection.
    pub async fn accept(
        tcp: TcpStream,
        acceptor: &TlsAcceptor,
        local: &LocalNode,
        tip: (Height, Hash32),
    ) -> Result<PeerConnection, AletheiaError> {
        let address = tcp
            .peer_addr()
            .map_err(|e| io_failure("peer address", &e))?;
        tokio::time::timeout(HANDSHAKE_TIMEOUT, async {
            tcp.set_nodelay(true)
                .map_err(|e| io_failure("set TCP_NODELAY", &e))?;
            let tls = acceptor
                .accept(tcp)
                .await
                .map_err(|e| io_failure("TLS handshake", &e))?;
            let connection = tls.get_ref().1;
            let exporter = connection
                .export_keying_material([0u8; 32], EXPORTER_LABEL, None)
                .map_err(|e| {
                    AletheiaError::new(ErrorCode::P2pHandshakeFailed, format!("TLS exporter: {e}"))
                })?;
            let cert_hash = connection
                .peer_certificates()
                .and_then(|c| c.first())
                .map(|c| certificate_hash(c))
                .unwrap_or(Hash32::ZERO);
            PeerConnection::exchange(
                TlsStream::Server(tls),
                address,
                cert_hash,
                exporter,
                Role::Listener,
                local,
                tip,
                None,
            )
            .await
        })
        .await
        .map_err(|_| timed_out())?
    }

    async fn exchange(
        mut stream: TlsStream<TcpStream>,
        address: SocketAddr,
        cert_hash: Hash32,
        exporter: [u8; 32],
        role: Role,
        local: &LocalNode,
        tip: (Height, Hash32),
        expected_key: Option<[u8; 32]>,
    ) -> Result<PeerConnection, AletheiaError> {
        let hello = local_hello(local, tip);
        write_frame(
            &mut stream,
            &signed_hello_frame(&local.network, &exporter, role, &hello, &local.node_key),
        )
        .await?;
        let mut decoder = FrameDecoder::new();
        let frame = read_frame(&mut stream, &mut decoder).await?;
        let (peer_hello, node_key) = verify_peer_hello(
            &local.network,
            &exporter,
            role.opposite(),
            &frame,
            local.versions,
            expected_key,
        )?;
        if node_key == local.node_key.public_key() {
            return Err(AletheiaError::new(
                ErrorCode::P2pHandshakeFailed,
                "connected to ourselves".to_owned(),
            ));
        }
        Ok(PeerConnection {
            stream,
            decoder,
            peer: PeerIdentity {
                address,
                node_key,
                cert_hash,
                hello: peer_hello,
            },
        })
    }

    pub fn peer(&self) -> &PeerIdentity {
        &self.peer
    }

    pub async fn send(&mut self, frame: &Frame) -> Result<(), AletheiaError> {
        write_frame(&mut self.stream, frame).await
    }

    pub async fn recv(&mut self) -> Result<Frame, AletheiaError> {
        read_frame(&mut self.stream, &mut self.decoder).await
    }

    /// Splits into independently owned read and write sides for the peer task.
    pub fn split(self) -> (PeerReader, WriteHalf<TlsStream<TcpStream>>, PeerIdentity) {
        let (read, write) = tokio::io::split(self.stream);
        (
            PeerReader {
                read,
                decoder: self.decoder,
            },
            write,
            self.peer,
        )
    }
}

/// The receiving side of a split connection.
pub struct PeerReader {
    read: ReadHalf<TlsStream<TcpStream>>,
    decoder: FrameDecoder,
}

impl core::fmt::Debug for PeerReader {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("PeerReader")
            .field("buffered", &self.decoder.buffered())
            .finish()
    }
}

impl PeerReader {
    pub async fn recv(&mut self) -> Result<Frame, AletheiaError> {
        read_frame(&mut self.read, &mut self.decoder).await
    }
}
