//! The application handshake that follows TLS (spec Section 36).
//!
//! ```text
//! Hello  = chain_id u32 | network_kind u8 | genesis_id Hash32 | min_version u16 | max_version u16
//!        | node_key [32] (Ed25519) | tip_height u64 | tip_hash Hash32
//! signed = H_domain("ALETHEIA/P2P-HANDSHAKE/v1", tls_exporter[32] || role u8 || ace(Hello))
//! Sent on the Mgmt channel as msg_type 0: ace(Hello) || signature [64]
//! ```
//!
//! The TLS exporter value is unique to one TLS session, so a hello cannot be relayed into a
//! different connection; the role byte (0 dialer, 1 listener) stops a peer from reflecting our
//! own hello back at us.

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ChainId, DomainTag, ErrorCode,
    Hash32, Height, NetworkIdentity, NetworkKind,
};
use aletheia_crypto::{Ed25519PublicKey, Ed25519Signature, Ed25519SigningKey};

use crate::frame::{Channel, Frame};

pub const HELLO_MSG_TYPE: u16 = 0;
pub const EXPORTER_LABEL: &[u8] = b"EXPORTER-aletheia-p2p-handshake-v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Dialer,
    Listener,
}

impl Role {
    const fn code(self) -> u8 {
        match self {
            Role::Dialer => 0,
            Role::Listener => 1,
        }
    }

    pub const fn opposite(self) -> Role {
        match self {
            Role::Dialer => Role::Listener,
            Role::Listener => Role::Dialer,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hello {
    pub chain_id: ChainId,
    pub network_kind: NetworkKind,
    pub genesis_id: Hash32,
    pub min_version: u16,
    pub max_version: u16,
    pub node_key: [u8; 32],
    pub tip_height: Height,
    pub tip_hash: Hash32,
}

impl AceEncode for Hello {
    fn encode(&self, out: &mut AceWriter) {
        self.chain_id.encode(out);
        self.network_kind.encode(out);
        self.genesis_id.encode(out);
        out.u16(self.min_version);
        out.u16(self.max_version);
        out.fixed(&self.node_key);
        self.tip_height.encode(out);
        self.tip_hash.encode(out);
    }
}

impl AceDecode for Hello {
    fn decode(input: &mut AceReader<'_>) -> Result<Hello, AletheiaError> {
        Ok(Hello {
            chain_id: ChainId::decode(input)?,
            network_kind: NetworkKind::decode(input)?,
            genesis_id: Hash32::decode(input)?,
            min_version: input.u16()?,
            max_version: input.u16()?,
            node_key: input.array()?,
            tip_height: Height::decode(input)?,
            tip_hash: Hash32::decode(input)?,
        })
    }
}

fn digest(network: &NetworkIdentity, exporter: &[u8; 32], role: Role, hello: &Hello) -> Hash32 {
    let mut hasher = network.domain_hasher(DomainTag::P2pHandshake);
    hasher
        .update(exporter)
        .update(&[role.code()])
        .update(&hello.to_ace_bytes());
    hasher.finalize()
}

/// Our hello for this session, signed.
pub fn signed_hello_frame(
    network: &NetworkIdentity,
    exporter: &[u8; 32],
    role: Role,
    hello: &Hello,
    key: &Ed25519SigningKey,
) -> Frame {
    let signature = key.sign(&digest(network, exporter, role, hello));
    let mut payload = hello.to_ace_bytes();
    payload.extend_from_slice(&signature.to_bytes());
    Frame {
        channel: Channel::Mgmt,
        msg_type: HELLO_MSG_TYPE,
        request_id: 0,
        payload,
    }
}

fn failed(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::P2pHandshakeFailed, detail)
}

/// Verifies the peer's hello: right message, same network and genesis, overlapping protocol
/// versions, a valid signature over this session from the key it claims, and that key equal
/// to `expected_key` when the peer is a registered validator.
pub fn verify_peer_hello(
    network: &NetworkIdentity,
    exporter: &[u8; 32],
    peer_role: Role,
    frame: &Frame,
    our_versions: (u16, u16),
    expected_key: Option<[u8; 32]>,
) -> Result<(Hello, Ed25519PublicKey), AletheiaError> {
    if (frame.channel, frame.msg_type) != (Channel::Mgmt, HELLO_MSG_TYPE) {
        return Err(failed(format!(
            "expected a hello, got {:?} message {}",
            frame.channel, frame.msg_type
        )));
    }
    let mut reader = AceReader::new(&frame.payload);
    let hello = Hello::decode(&mut reader)
        .map_err(|e| failed(format!("hello does not decode: {}", e.detail())))?;
    let signature: [u8; 64] = reader
        .array()
        .map_err(|_| failed("hello has no signature".to_owned()))?;
    reader
        .finish()
        .map_err(|e| failed(format!("hello: {}", e.detail())))?;

    if hello.chain_id != network.chain_id()
        || hello.network_kind != network.network_kind()
        || hello.genesis_id != network.genesis_id()
    {
        return Err(AletheiaError::new(
            ErrorCode::P2pWrongNetwork,
            format!(
                "peer is on chain {} ({}, genesis {}); we are on chain {} ({}, genesis {})",
                hello.chain_id,
                hello.network_kind,
                hello.genesis_id,
                network.chain_id(),
                network.network_kind(),
                network.genesis_id()
            ),
        ));
    }
    if hello.min_version > hello.max_version
        || hello.max_version < our_versions.0
        || hello.min_version > our_versions.1
    {
        return Err(AletheiaError::new(
            ErrorCode::P2pVersionMismatch,
            format!(
                "peer supports protocol versions {}-{}; we support {}-{}",
                hello.min_version, hello.max_version, our_versions.0, our_versions.1
            ),
        ));
    }
    let key = Ed25519PublicKey::from_bytes(&hello.node_key)
        .map_err(|e| failed(format!("peer node key: {}", e.detail())))?;
    key.verify(
        &digest(network, exporter, peer_role, &hello),
        &Ed25519Signature::from_bytes(signature),
    )
    .map_err(|_| failed("hello signature does not verify for this session".to_owned()))?;
    if let Some(expected) = expected_key
        && expected != hello.node_key
    {
        return Err(failed(
            "peer's node key is not the one registered for it".to_owned(),
        ));
    }
    Ok((hello, key))
}
