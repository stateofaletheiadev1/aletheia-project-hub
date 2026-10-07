//! The worker side of the executor protocol (spec Section 28.1): read an `Execute`, run it,
//! forward every host interaction to the node, report `Done`. Used by the
//! `aletheia-arno-exec` binary.
//!
//! The worker holds no state between calls and touches nothing but its two pipes. It
//! verifies each package again before running it, so a corrupted request cannot make it run
//! unverified code.

use std::io::{Read, Write};

use crate::interp::{ChainInfo, Host, run};
use crate::trap::Trap;
use crate::wire::{Execute, HostReply, WorkerMessage, read_frame, write_frame};

struct PipeHost<'a, R: Read, W: Write> {
    reader: &'a mut R,
    writer: &'a mut W,
    chain: ChainInfo,
}

const LINK_LOST: Trap = Trap::Internal("the link to the node failed");

impl<R: Read, W: Write> PipeHost<'_, R, W> {
    fn ask(&mut self, message: WorkerMessage) -> Result<HostReply, Trap> {
        write_frame(self.writer, &message).map_err(|_| LINK_LOST)?;
        match read_frame::<_, HostReply>(self.reader) {
            Ok(Some(HostReply::Refused(trap))) => Err(trap),
            Ok(Some(reply)) => Ok(reply),
            _ => Err(LINK_LOST),
        }
    }
}

impl<R: Read, W: Write> Host for PipeHost<'_, R, W> {
    fn chain(&self) -> ChainInfo {
        self.chain
    }

    fn storage_contains(&mut self, slot: u16, key: &[u8]) -> Result<bool, Trap> {
        match self.ask(WorkerMessage::Contains {
            slot,
            key: key.to_vec(),
        })? {
            HostReply::Bool(v) => Ok(v),
            _ => Err(LINK_LOST),
        }
    }

    fn storage_read(&mut self, slot: u16, key: &[u8]) -> Result<Option<Vec<u8>>, Trap> {
        match self.ask(WorkerMessage::Read {
            slot,
            key: key.to_vec(),
        })? {
            HostReply::Bytes(v) => Ok(v),
            _ => Err(LINK_LOST),
        }
    }

    fn storage_write(&mut self, slot: u16, key: &[u8], value: Option<&[u8]>) -> Result<(), Trap> {
        let message = WorkerMessage::Write {
            slot,
            key: key.to_vec(),
            value: value.map(<[u8]>::to_vec),
        };
        match self.ask(message)? {
            HostReply::Unit => Ok(()),
            _ => Err(LINK_LOST),
        }
    }

    fn transfer(&mut self, asset: u32, amount: u128, to: &[u8; 33]) -> Result<(), Trap> {
        match self.ask(WorkerMessage::Transfer {
            asset,
            amount,
            to: *to,
        })? {
            HostReply::Unit => Ok(()),
            _ => Err(LINK_LOST),
        }
    }

    fn emit(&mut self, event: u16, data: Vec<u8>) -> Result<(), Trap> {
        match self.ask(WorkerMessage::Emit { event, data })? {
            HostReply::Unit => Ok(()),
            _ => Err(LINK_LOST),
        }
    }

    fn verify_ed25519(&self, key: &[u8; 32], digest: &[u8; 32], signature: &[u8; 64]) -> bool {
        // Pure and deterministic (strict verification), so computed here, not asked for.
        aletheia_crypto::Ed25519PublicKey::from_bytes(key)
            .and_then(|k| {
                k.verify(
                    &aletheia_core::Hash32::from_bytes(*digest),
                    &aletheia_crypto::Ed25519Signature::from_bytes(*signature),
                )
            })
            .is_ok()
    }
}

/// Serves calls until the node closes the pipe. Returns when the stream ends or breaks.
pub fn serve<R: Read, W: Write>(reader: &mut R, writer: &mut W) -> std::io::Result<()> {
    while let Some(request) = read_frame::<_, Execute>(reader)? {
        let result = match crate::package::Package::from_bytes(&request.package)
            .and_then(|p| crate::verifier::verify(&p).map(|()| p))
        {
            Err(_) => Err((Trap::Internal("the node sent an unverifiable package"), 0)),
            Ok(package) => {
                let mut host = PipeHost {
                    reader,
                    writer,
                    chain: request.chain,
                };
                match run(
                    &package,
                    request.function,
                    request.args,
                    &mut host,
                    request.eu_limit,
                ) {
                    Ok(outcome) => Ok((outcome.returned, outcome.eu_used)),
                    Err(failure) => Err((failure.trap, failure.eu_used)),
                }
            }
        };
        write_frame(writer, &WorkerMessage::Done(result))?;
    }
    Ok(())
}
