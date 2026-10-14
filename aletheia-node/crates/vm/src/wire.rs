//! The executor protocol (spec Section 28.1): what the node and an `aletheia-arno-exec`
//! worker say to each other.
//!
//! ```text
//! frame = u32 length (LE, ≤ MAX_FRAME) | ACE message
//! node → worker   Execute { package, function, args, eu_limit, chain }   then HostReply…
//! worker → node   HostCall…   then Done { result }
//! ```
//!
//! Every host interaction is a round trip: the worker computes, the node owns state. The node
//! treats everything the worker sends as untrusted; a frame that does not decode, a reply
//! out of turn or a worker that dies counts as a worker failure, never as a contract result.

use std::io::{Read, Write};

use aletheia_core::{AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode};

use crate::interp::ChainInfo;
use crate::trap::Trap;
use crate::value::ADDRESS_BYTES;
use crate::value::Value;

/// Largest frame either side accepts.
pub const MAX_FRAME: u32 = 8 * 1024 * 1024;
const MAX_LIST: u32 = 1 << 20;
const MAX_BYTES: u32 = MAX_FRAME;

fn bad(detail: &str) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::DecodeNonCanonical,
        format!("executor message: {detail}"),
    )
}

// ---- values: a self-describing encoding (registers hold values whose type the worker and
// node both know, but coins and signers have no storage encoding) ----

fn encode_value(value: &Value, out: &mut AceWriter) {
    match value {
        Value::Bool(v) => {
            out.u8(1);
            out.bool(*v);
        }
        Value::U8(v) => {
            out.u8(2);
            out.u8(*v);
        }
        Value::U16(v) => {
            out.u8(3);
            out.u16(*v);
        }
        Value::U32(v) => {
            out.u8(4);
            out.u32(*v);
        }
        Value::U64(v) => {
            out.u8(5);
            out.u64(*v);
        }
        Value::U128(v) => {
            out.u8(6);
            out.u128(*v);
        }
        Value::I64(v) => {
            out.u8(7);
            out.fixed(&v.to_le_bytes());
        }
        Value::Address(v) => {
            out.u8(8);
            out.fixed(v);
        }
        Value::Hash(v) => {
            out.u8(9);
            out.fixed(v);
        }
        Value::Height(v) => {
            out.u8(10);
            out.u64(*v);
        }
        Value::Slot(v) => {
            out.u8(11);
            out.u64(*v);
        }
        Value::Epoch(v) => {
            out.u8(12);
            out.u64(*v);
        }
        Value::Text(v) => {
            out.u8(13);
            out.bytes(v);
        }
        Value::Bytes(v) => {
            out.u8(14);
            out.bytes(v);
        }
        Value::Enum(v) => {
            out.u8(15);
            out.u16(*v);
        }
        Value::Record(items) | Value::Array(items) | Value::List(items) => {
            out.u8(match value {
                Value::Record(_) => 16,
                Value::Array(_) => 17,
                _ => 18,
            });
            out.u32(u32::try_from(items.len()).unwrap_or(u32::MAX));
            for item in items {
                encode_value(item, out);
            }
        }
        Value::Optional(inner) => {
            out.u8(19);
            match inner {
                None => out.u8(0),
                Some(inner) => {
                    out.u8(1);
                    encode_value(inner, out);
                }
            }
        }
        Value::Coins { asset, amount } => {
            out.u8(20);
            out.u32(*asset);
            out.u128(*amount);
        }
        Value::Signer(v) => {
            out.u8(21);
            out.fixed(v);
        }
        Value::Empty => out.u8(22),
    }
}

fn decode_value(input: &mut AceReader<'_>, depth: u32) -> Result<Value, AletheiaError> {
    if depth > 64 {
        return Err(bad("value nested too deeply"));
    }
    Ok(match input.u8()? {
        1 => Value::Bool(input.bool()?),
        2 => Value::U8(input.u8()?),
        3 => Value::U16(input.u16()?),
        4 => Value::U32(input.u32()?),
        5 => Value::U64(input.u64()?),
        6 => Value::U128(input.u128()?),
        7 => Value::I64(i64::from_le_bytes(input.array()?)),
        8 => Value::Address(input.array()?),
        9 => Value::Hash(input.array()?),
        10 => Value::Height(input.u64()?),
        11 => Value::Slot(input.u64()?),
        12 => Value::Epoch(input.u64()?),
        13 => Value::Text(input.bytes(MAX_BYTES)?.to_vec()),
        14 => Value::Bytes(input.bytes(MAX_BYTES)?.to_vec()),
        15 => Value::Enum(input.u16()?),
        tag @ 16..=18 => {
            let n = input.u32()?;
            if n > MAX_LIST {
                return Err(bad("list too long"));
            }
            let items = (0..n)
                .map(|_| decode_value(input, depth.saturating_add(1)))
                .collect::<Result<Vec<_>, _>>()?;
            match tag {
                16 => Value::Record(items),
                17 => Value::Array(items),
                _ => Value::List(items),
            }
        }
        19 => match input.u8()? {
            0 => Value::Optional(None),
            1 => Value::Optional(Some(Box::new(decode_value(
                input,
                depth.saturating_add(1),
            )?))),
            _ => return Err(bad("optional marker")),
        },
        20 => Value::Coins {
            asset: input.u32()?,
            amount: input.u128()?,
        },
        21 => Value::Signer(input.array()?),
        22 => Value::Empty,
        _ => return Err(bad("unknown value tag")),
    })
}

fn encode_option_value(value: Option<&Value>, out: &mut AceWriter) {
    match value {
        None => out.u8(0),
        Some(v) => {
            out.u8(1);
            encode_value(v, out);
        }
    }
}

fn decode_option_value(input: &mut AceReader<'_>) -> Result<Option<Value>, AletheiaError> {
    match input.u8()? {
        0 => Ok(None),
        1 => Ok(Some(decode_value(input, 0)?)),
        _ => Err(bad("option marker")),
    }
}

fn encode_trap(trap: &Trap, out: &mut AceWriter) {
    let (tag, extra): (u8, u32) = match trap {
        Trap::OutOfEu => (1, 0),
        Trap::Overflow => (2, 0),
        Trap::DivisionByZero => (3, 0),
        Trap::IndexOutOfRange => (4, 0),
        Trap::ListFull => (5, 0),
        Trap::NothingToUnwrap => (6, 0),
        Trap::ConversionOutOfRange => (7, 0),
        Trap::LoopBoundExceeded => (8, 0),
        Trap::InsufficientVault => (9, 0),
        Trap::InsufficientCoins => (10, 0),
        Trap::MemoryLimit => (11, 0),
        Trap::StorageValueTooLarge => (12, 0),
        Trap::Abort(index) => (13, u32::from(*index)),
        Trap::Host(code) => (14, code.get()),
        Trap::Internal(_) => (15, 0),
    };
    out.u8(tag);
    out.u32(extra);
}

fn decode_trap(input: &mut AceReader<'_>) -> Result<Trap, AletheiaError> {
    let tag = input.u8()?;
    let extra = input.u32()?;
    Ok(match tag {
        1 => Trap::OutOfEu,
        2 => Trap::Overflow,
        3 => Trap::DivisionByZero,
        4 => Trap::IndexOutOfRange,
        5 => Trap::ListFull,
        6 => Trap::NothingToUnwrap,
        7 => Trap::ConversionOutOfRange,
        8 => Trap::LoopBoundExceeded,
        9 => Trap::InsufficientVault,
        10 => Trap::InsufficientCoins,
        11 => Trap::MemoryLimit,
        12 => Trap::StorageValueTooLarge,
        13 => Trap::Abort(u16::try_from(extra).map_err(|_| bad("abort index"))?),
        14 => {
            Trap::Host(ErrorCode::from_code(extra).ok_or_else(|| bad("unknown host error code"))?)
        }
        15 => Trap::Internal("reported by the executor"),
        _ => return Err(bad("unknown trap tag")),
    })
}

/// Node → worker: start a call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Execute {
    pub package: Vec<u8>,
    pub function: u8,
    pub args: Vec<Value>,
    pub eu_limit: u64,
    pub chain: ChainInfo,
}

impl AceEncode for Execute {
    fn encode(&self, out: &mut AceWriter) {
        out.bytes(&self.package);
        out.u8(self.function);
        out.u32(u32::try_from(self.args.len()).unwrap_or(u32::MAX));
        for arg in &self.args {
            encode_value(arg, out);
        }
        out.u64(self.eu_limit);
        out.u64(self.chain.height);
        out.u64(self.chain.slot);
        out.u64(self.chain.epoch);
        out.u64(self.chain.protocol_time_ms);
        out.fixed(&self.chain.tx_id);
    }
}

impl AceDecode for Execute {
    fn decode(input: &mut AceReader<'_>) -> Result<Execute, AletheiaError> {
        let package = input.bytes(MAX_BYTES)?.to_vec();
        let function = input.u8()?;
        let n = input.u32()?;
        if n > 255 {
            return Err(bad("too many arguments"));
        }
        let args = (0..n)
            .map(|_| decode_value(input, 0))
            .collect::<Result<_, _>>()?;
        Ok(Execute {
            package,
            function,
            args,
            eu_limit: input.u64()?,
            chain: ChainInfo {
                height: input.u64()?,
                slot: input.u64()?,
                epoch: input.u64()?,
                protocol_time_ms: input.u64()?,
                tx_id: input.array()?,
            },
        })
    }
}

/// Worker → node: a host request, or the end of the call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WorkerMessage {
    Contains {
        slot: u16,
        key: Vec<u8>,
    },
    Read {
        slot: u16,
        key: Vec<u8>,
    },
    Write {
        slot: u16,
        key: Vec<u8>,
        value: Option<Vec<u8>>,
    },
    Transfer {
        asset: u32,
        amount: u128,
        to: [u8; ADDRESS_BYTES],
    },
    Emit {
        event: u16,
        data: Vec<u8>,
    },
    Done(Result<(Option<Value>, u64), (Trap, u64)>),
}

impl AceEncode for WorkerMessage {
    fn encode(&self, out: &mut AceWriter) {
        match self {
            WorkerMessage::Contains { slot, key } | WorkerMessage::Read { slot, key } => {
                out.u8(if matches!(self, WorkerMessage::Contains { .. }) {
                    1
                } else {
                    2
                });
                out.u16(*slot);
                out.bytes(key);
            }
            WorkerMessage::Write { slot, key, value } => {
                out.u8(3);
                out.u16(*slot);
                out.bytes(key);
                match value {
                    None => out.u8(0),
                    Some(v) => {
                        out.u8(1);
                        out.bytes(v);
                    }
                }
            }
            WorkerMessage::Transfer { asset, amount, to } => {
                out.u8(4);
                out.u32(*asset);
                out.u128(*amount);
                out.fixed(to);
            }
            WorkerMessage::Emit { event, data } => {
                out.u8(5);
                out.u16(*event);
                out.bytes(data);
            }
            WorkerMessage::Done(result) => {
                out.u8(7);
                match result {
                    Ok((value, eu)) => {
                        out.u8(0);
                        encode_option_value(value.as_ref(), out);
                        out.u64(*eu);
                    }
                    Err((trap, eu)) => {
                        out.u8(1);
                        encode_trap(trap, out);
                        out.u64(*eu);
                    }
                }
            }
        }
    }
}

impl AceDecode for WorkerMessage {
    fn decode(input: &mut AceReader<'_>) -> Result<WorkerMessage, AletheiaError> {
        Ok(match input.u8()? {
            1 => WorkerMessage::Contains {
                slot: input.u16()?,
                key: input.bytes(MAX_BYTES)?.to_vec(),
            },
            2 => WorkerMessage::Read {
                slot: input.u16()?,
                key: input.bytes(MAX_BYTES)?.to_vec(),
            },
            3 => {
                let slot = input.u16()?;
                let key = input.bytes(MAX_BYTES)?.to_vec();
                let value = match input.u8()? {
                    0 => None,
                    1 => Some(input.bytes(MAX_BYTES)?.to_vec()),
                    _ => return Err(bad("write marker")),
                };
                WorkerMessage::Write { slot, key, value }
            }
            4 => WorkerMessage::Transfer {
                asset: input.u32()?,
                amount: input.u128()?,
                to: input.array()?,
            },
            5 => WorkerMessage::Emit {
                event: input.u16()?,
                data: input.bytes(MAX_BYTES)?.to_vec(),
            },
            7 => match input.u8()? {
                0 => WorkerMessage::Done(Ok((decode_option_value(input)?, input.u64()?))),
                1 => WorkerMessage::Done(Err((decode_trap(input)?, input.u64()?))),
                _ => return Err(bad("result marker")),
            },
            _ => return Err(bad("unknown worker message")),
        })
    }
}

/// Node → worker: the answer to the last host request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostReply {
    Bool(bool),
    Bytes(Option<Vec<u8>>),
    Unit,
    Refused(Trap),
}

impl AceEncode for HostReply {
    fn encode(&self, out: &mut AceWriter) {
        match self {
            HostReply::Bool(v) => {
                out.u8(1);
                out.bool(*v);
            }
            HostReply::Bytes(v) => {
                out.u8(2);
                match v {
                    None => out.u8(0),
                    Some(bytes) => {
                        out.u8(1);
                        out.bytes(bytes);
                    }
                }
            }
            HostReply::Unit => out.u8(3),
            HostReply::Refused(trap) => {
                out.u8(4);
                encode_trap(trap, out);
            }
        }
    }
}

impl AceDecode for HostReply {
    fn decode(input: &mut AceReader<'_>) -> Result<HostReply, AletheiaError> {
        Ok(match input.u8()? {
            1 => HostReply::Bool(input.bool()?),
            2 => HostReply::Bytes(match input.u8()? {
                0 => None,
                1 => Some(input.bytes(MAX_BYTES)?.to_vec()),
                _ => return Err(bad("bytes marker")),
            }),
            3 => HostReply::Unit,
            4 => HostReply::Refused(decode_trap(input)?),
            _ => return Err(bad("unknown host reply")),
        })
    }
}

/// Writes one frame.
pub fn write_frame<W: Write, T: AceEncode>(writer: &mut W, message: &T) -> std::io::Result<()> {
    let body = message.to_ace_bytes();
    let len = u32::try_from(body.len())
        .ok()
        .filter(|l| *l <= MAX_FRAME)
        .ok_or_else(|| std::io::Error::other("frame too large"))?;
    writer.write_all(&len.to_le_bytes())?;
    writer.write_all(&body)?;
    writer.flush()
}

/// Reads one frame; `Ok(None)` at a clean end of stream.
pub fn read_frame<R: Read, T: AceDecode>(reader: &mut R) -> std::io::Result<Option<T>> {
    let mut len = [0u8; 4];
    match reader.read_exact(&mut len) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u32::from_le_bytes(len);
    if len > MAX_FRAME {
        return Err(std::io::Error::other("frame too large"));
    }
    let mut body = vec![0u8; usize::try_from(len).map_err(std::io::Error::other)?];
    reader.read_exact(&mut body)?;
    T::from_ace_bytes(&body)
        .map(Some)
        .map_err(|e| std::io::Error::other(e.detail().to_owned()))
}
