//! The `aletheia-signer` wire protocol (spec Section 19.2, APS-0043, Appendix R.10).
//!
//! The consensus key and its high-water marks live in the signer daemon; `aletheiad` asks it
//! to sign over a local stream (a Unix socket in production). The daemon checks every request
//! against its marks exactly as [`LocalSigner`] does in process, so a compromised node can get
//! nothing signed that could equivocate, and never sees the key.
//!
//! ```text
//! frame    = u32_le(length) || ace(message)          length <= MAX_FRAME
//! Request  = u8 1 Hello
//!          | u8 2 Proposal  round u64, digest Hash32
//!          | u8 3 Vote      round u64, block_hash Hash32, digest Hash32
//!          | u8 4 Timeout   round u64, digest Hash32
//! Response = u8 1 Hello     public_key [48], state SignerState
//!          | u8 2 Signature [96]
//!          | u8 3 Refused   detail bytes (UTF-8, at most 512)
//! ```
//!
//! A request whose answer was lost may be sent again: the signer signs an identical request
//! again (BLS is deterministic) and refuses a different one, so a retry cannot equivocate.
//! The client verifies every signature against the key the daemon announced before handing
//! it to consensus.

use std::io::{self, Read, Write};
use std::sync::Mutex;

use aletheia_consensus::ConsensusSigner;
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32, Slot,
};
use aletheia_crypto::bls::{BlsPublicKey, BlsSignature};

use crate::{LocalSigner, SignerState};

/// Largest frame either side accepts.
pub const MAX_FRAME: u32 = 1024;
const MAX_DETAIL: u32 = 512;
const MAX_DETAIL_LEN: usize = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Request {
    Hello,
    Proposal {
        round: Slot,
        digest: Hash32,
    },
    Vote {
        round: Slot,
        block_hash: Hash32,
        digest: Hash32,
    },
    Timeout {
        round: Slot,
        digest: Hash32,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Response {
    Hello {
        public_key: [u8; 48],
        state: SignerState,
    },
    Signature([u8; 96]),
    Refused(String),
}

fn malformed(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::DecodeNonCanonical, detail)
}

impl AceEncode for Request {
    fn encode(&self, out: &mut AceWriter) {
        match self {
            Request::Hello => out.u8(1),
            Request::Proposal { round, digest } => {
                out.u8(2);
                round.encode(out);
                digest.encode(out);
            }
            Request::Vote {
                round,
                block_hash,
                digest,
            } => {
                out.u8(3);
                round.encode(out);
                block_hash.encode(out);
                digest.encode(out);
            }
            Request::Timeout { round, digest } => {
                out.u8(4);
                round.encode(out);
                digest.encode(out);
            }
        }
    }
}

impl AceDecode for Request {
    fn decode(input: &mut AceReader<'_>) -> Result<Request, AletheiaError> {
        match input.u8()? {
            1 => Ok(Request::Hello),
            2 => Ok(Request::Proposal {
                round: Slot::decode(input)?,
                digest: Hash32::decode(input)?,
            }),
            3 => Ok(Request::Vote {
                round: Slot::decode(input)?,
                block_hash: Hash32::decode(input)?,
                digest: Hash32::decode(input)?,
            }),
            4 => Ok(Request::Timeout {
                round: Slot::decode(input)?,
                digest: Hash32::decode(input)?,
            }),
            tag => Err(malformed(format!("unknown signer request tag {tag}"))),
        }
    }
}

impl AceEncode for Response {
    fn encode(&self, out: &mut AceWriter) {
        match self {
            Response::Hello { public_key, state } => {
                out.u8(1);
                public_key.encode(out);
                state.encode(out);
            }
            Response::Signature(signature) => {
                out.u8(2);
                signature.encode(out);
            }
            Response::Refused(detail) => {
                out.u8(3);
                out.bytes(clip(detail).as_bytes());
            }
        }
    }
}

impl AceDecode for Response {
    fn decode(input: &mut AceReader<'_>) -> Result<Response, AletheiaError> {
        match input.u8()? {
            1 => Ok(Response::Hello {
                public_key: input.array()?,
                state: SignerState::decode(input)?,
            }),
            2 => Ok(Response::Signature(input.array()?)),
            3 => {
                let bytes = input.bytes(MAX_DETAIL)?;
                let detail = String::from_utf8(bytes.to_vec())
                    .map_err(|_| malformed("signer refusal is not UTF-8".to_owned()))?;
                Ok(Response::Refused(detail))
            }
            tag => Err(malformed(format!("unknown signer response tag {tag}"))),
        }
    }
}

/// `detail` cut to at most [`MAX_DETAIL`] bytes on a character boundary.
fn clip(detail: &str) -> &str {
    let mut end = detail.len().min(MAX_DETAIL_LEN);
    while !detail.is_char_boundary(end) {
        end = end.saturating_sub(1);
    }
    detail.get(..end).unwrap_or_default()
}

pub fn write_frame<W: Write>(out: &mut W, message: &impl AceEncode) -> io::Result<()> {
    let bytes = message.to_ace_bytes();
    let length = u32::try_from(bytes.len())
        .ok()
        .filter(|length| *length <= MAX_FRAME)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "signer frame too large"))?;
    out.write_all(&length.to_le_bytes())?;
    out.write_all(&bytes)?;
    out.flush()
}

/// The next frame, or `None` when the peer closed the stream between frames.
pub fn read_frame<R: Read>(input: &mut R) -> io::Result<Option<Vec<u8>>> {
    let mut length = [0u8; 4];
    match input.read_exact(&mut length) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(error) => return Err(error),
    }
    let length = u32::from_le_bytes(length);
    if length > MAX_FRAME {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("signer frame of {length} bytes is over the limit"),
        ));
    }
    let mut body = vec![0u8; usize::try_from(length).unwrap_or(usize::MAX)];
    input.read_exact(&mut body)?;
    Ok(Some(body))
}

/// Why a connection ended other than by the peer closing it.
#[derive(Debug)]
pub enum ServeError {
    /// The stream failed; the daemon drops this connection and carries on.
    Io(io::Error),
    /// The signer could not make its state durable, or its lock is poisoned. The daemon must
    /// stop: a signer that cannot persist its marks must not sign.
    Fatal(AletheiaError),
}

/// Answers requests on one connection until the peer closes it. A refusal is an answer, not
/// an error.
pub fn serve_connection<S: Read + Write>(
    signer: &Mutex<LocalSigner>,
    stream: &mut S,
) -> Result<(), ServeError> {
    while let Some(body) = read_frame(stream).map_err(ServeError::Io)? {
        let response = match Request::from_ace_bytes(&body) {
            Err(error) => Response::Refused(format!("malformed request: {}", error.detail())),
            Ok(request) => {
                let mut guard = signer.lock().map_err(|_| {
                    ServeError::Fatal(AletheiaError::new(
                        ErrorCode::StoIo,
                        "the signer lock is poisoned".to_owned(),
                    ))
                })?;
                match answer(&mut guard, request) {
                    Ok(response) => response,
                    Err(error) if error.code() == ErrorCode::SigInvalid => {
                        Response::Refused(error.detail().to_owned())
                    }
                    Err(error) => {
                        let _ = write_frame(
                            stream,
                            &Response::Refused(
                                "the signer stopped: its state is not durable".to_owned(),
                            ),
                        );
                        return Err(ServeError::Fatal(error));
                    }
                }
            }
        };
        write_frame(stream, &response).map_err(ServeError::Io)?;
    }
    Ok(())
}

fn answer(signer: &mut LocalSigner, request: Request) -> Result<Response, AletheiaError> {
    Ok(match request {
        Request::Hello => Response::Hello {
            public_key: signer.public_key(),
            state: signer.state(),
        },
        Request::Proposal { round, digest } => {
            Response::Signature(signer.sign_proposal(round, &digest)?)
        }
        Request::Vote {
            round,
            block_hash,
            digest,
        } => Response::Signature(signer.sign_vote(round, &block_hash, &digest)?),
        Request::Timeout { round, digest } => {
            Response::Signature(signer.sign_timeout(round, &digest)?)
        }
    })
}

/// A byte stream to the signer daemon.
pub trait Transport: Read + Write + Send {}

impl<T: Read + Write + Send> Transport for T {}

/// Opens a fresh stream to the daemon.
pub type Connector = Box<dyn FnMut() -> io::Result<Box<dyn Transport>> + Send>;

fn unavailable(detail: String) -> AletheiaError {
    // A reject, not a fail-stop: consensus misses this vote and asks again next round.
    AletheiaError::new(ErrorCode::SigInvalid, detail)
}

/// The node's side of the protocol: a [`ConsensusSigner`] whose key lives in the daemon.
pub struct RemoteSigner {
    connect: Connector,
    stream: Option<Box<dyn Transport>>,
    public_key: BlsPublicKey,
}

impl core::fmt::Debug for RemoteSigner {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("RemoteSigner")
            .field("connected", &self.stream.is_some())
            .finish_non_exhaustive()
    }
}

impl RemoteSigner {
    /// Connects and learns the daemon's public key.
    pub fn connect(mut connect: Connector) -> Result<RemoteSigner, AletheiaError> {
        let mut stream =
            connect().map_err(|e| unavailable(format!("cannot reach the signer: {e}")))?;
        let response = exchange(&mut stream, &Request::Hello)
            .map_err(|e| unavailable(format!("signer hello failed: {e}")))?;
        let Response::Hello { public_key, .. } = response else {
            return Err(unavailable(format!(
                "the signer answered hello with {response:?}"
            )));
        };
        Ok(RemoteSigner {
            connect,
            stream: Some(stream),
            public_key: BlsPublicKey::from_bytes(&public_key)?,
        })
    }

    /// Connects to the daemon's Unix socket at `path`.
    #[cfg(unix)]
    pub fn unix(
        path: std::path::PathBuf,
        timeout: std::time::Duration,
    ) -> Result<RemoteSigner, AletheiaError> {
        let shown = path.display().to_string();
        RemoteSigner::connect(Box::new(move || {
            let stream = std::os::unix::net::UnixStream::connect(&path)?;
            stream.set_read_timeout(Some(timeout))?;
            stream.set_write_timeout(Some(timeout))?;
            let stream: Box<dyn Transport> = Box::new(stream);
            Ok(stream)
        }))
        .map_err(|e| unavailable(format!("{shown}: {}", e.detail())))
    }

    pub fn public_key(&self) -> [u8; 48] {
        self.public_key.to_bytes()
    }

    /// The daemon's current high-water marks.
    pub fn state(&mut self) -> Result<SignerState, AletheiaError> {
        match self.call(Request::Hello)? {
            Response::Hello { public_key, state } if public_key == self.public_key() => Ok(state),
            Response::Hello { .. } => Err(unavailable(
                "the signer now holds a different consensus key".to_owned(),
            )),
            other => Err(unavailable(format!(
                "the signer answered hello with {other:?}"
            ))),
        }
    }

    /// One exchange, retried once on a fresh connection if the stream failed.
    fn call(&mut self, request: Request) -> Result<Response, AletheiaError> {
        let mut last = String::new();
        for _ in 0..2 {
            let stream = match self.stream.as_mut() {
                Some(stream) => stream,
                None => match (self.connect)() {
                    Ok(stream) => self.stream.insert(stream),
                    Err(error) => {
                        last = format!("cannot reach the signer: {error}");
                        continue;
                    }
                },
            };
            match exchange(stream, &request) {
                Ok(response) => return Ok(response),
                Err(error) => {
                    self.stream = None;
                    last = format!("signer connection failed: {error}");
                }
            }
        }
        Err(unavailable(last))
    }

    fn sign(&mut self, request: Request, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        match self.call(request)? {
            Response::Signature(bytes) => {
                let signature = BlsSignature::from_bytes(&bytes)?;
                self.public_key.verify(digest, &signature).map_err(|_| {
                    unavailable("the signer returned a signature that does not verify".to_owned())
                })?;
                Ok(bytes)
            }
            Response::Refused(detail) => Err(AletheiaError::new(ErrorCode::SigInvalid, detail)),
            Response::Hello { .. } => Err(unavailable(
                "the signer answered a signing request with hello".to_owned(),
            )),
        }
    }
}

fn exchange(stream: &mut Box<dyn Transport>, request: &Request) -> io::Result<Response> {
    write_frame(stream, request)?;
    let body = read_frame(stream)?.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "the signer closed the connection",
        )
    })?;
    Response::from_ace_bytes(&body)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.detail().to_owned()))
}

impl ConsensusSigner for RemoteSigner {
    fn sign_proposal(&mut self, round: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        self.sign(
            Request::Proposal {
                round,
                digest: *digest,
            },
            digest,
        )
    }

    fn sign_vote(
        &mut self,
        round: Slot,
        block_hash: &Hash32,
        digest: &Hash32,
    ) -> Result<[u8; 96], AletheiaError> {
        self.sign(
            Request::Vote {
                round,
                block_hash: *block_hash,
                digest: *digest,
            },
            digest,
        )
    }

    fn sign_timeout(&mut self, round: Slot, digest: &Hash32) -> Result<[u8; 96], AletheiaError> {
        self.sign(
            Request::Timeout {
                round,
                digest: *digest,
            },
            digest,
        )
    }
}
