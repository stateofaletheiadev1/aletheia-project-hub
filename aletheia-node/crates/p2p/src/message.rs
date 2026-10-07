//! Typed messages per channel (spec Section 36). Payloads are ACE; `msg_type` values are
//! protocol and scoped to their channel.
//!
//! ```text
//! Mgmt      1 Ping { nonce u64 }   2 Pong { nonce u64 }   3 Status { tip_height u64, tip_hash Hash32 }
//! BlockProp 1 NewBlock { height u64, hash Hash32 }
//!           2 GetBlocks { from u64, count u16 (1..=64) }   3 Blocks { list<Proposal> (<= 64) }
//! TxGossip  1 TxAnnounce { list<Hash32> (<= 1024) }       2 GetTxs { list<Hash32> (<= 1024) }
//!           3 Txs { list<SignedTransaction> (<= 512) }
//! ```
//!
//! The handshake (`Hello`) has its own module because it is signed and bound to the TLS
//! session; consensus messages arrive with DSP in Phase 5.

use aletheia_core::block::Proposal;
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32, Height,
    SignedTransaction,
};

use crate::frame::{Channel, Frame};

pub const MAX_BLOCKS_PER_REQUEST: u16 = 64;
pub const MAX_TX_IDS: u32 = 1024;
pub const MAX_TXS: u32 = 512;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Message {
    Ping {
        nonce: u64,
    },
    Pong {
        nonce: u64,
    },
    Status {
        tip_height: Height,
        tip_hash: Hash32,
    },
    NewBlock {
        height: Height,
        hash: Hash32,
    },
    GetBlocks {
        from: Height,
        count: u16,
    },
    Blocks(Vec<Proposal>),
    TxAnnounce(Vec<Hash32>),
    GetTxs(Vec<Hash32>),
    Txs(Vec<SignedTransaction>),
}

fn malformed(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::P2pMalformedMessage, detail)
}

impl Message {
    pub fn channel(&self) -> Channel {
        match self {
            Message::Ping { .. } | Message::Pong { .. } | Message::Status { .. } => Channel::Mgmt,
            Message::NewBlock { .. } | Message::GetBlocks { .. } | Message::Blocks(_) => {
                Channel::BlockProp
            }
            Message::TxAnnounce(_) | Message::GetTxs(_) | Message::Txs(_) => Channel::TxGossip,
        }
    }

    pub fn msg_type(&self) -> u16 {
        match self {
            Message::Ping { .. } | Message::NewBlock { .. } | Message::TxAnnounce(_) => 1,
            Message::Pong { .. } | Message::GetBlocks { .. } | Message::GetTxs(_) => 2,
            Message::Status { .. } | Message::Blocks(_) | Message::Txs(_) => 3,
        }
    }

    pub fn to_frame(&self, request_id: u32) -> Frame {
        let mut out = AceWriter::new();
        match self {
            Message::Ping { nonce } | Message::Pong { nonce } => out.u64(*nonce),
            Message::Status {
                tip_height: height,
                tip_hash: hash,
            }
            | Message::NewBlock { height, hash } => {
                height.encode(&mut out);
                hash.encode(&mut out);
            }
            Message::GetBlocks { from, count } => {
                from.encode(&mut out);
                out.u16(*count);
            }
            Message::Blocks(blocks) => out.list(blocks),
            Message::TxAnnounce(ids) | Message::GetTxs(ids) => out.list(ids),
            Message::Txs(txs) => out.list(txs),
        }
        Frame {
            channel: self.channel(),
            msg_type: self.msg_type(),
            request_id,
            payload: out.into_bytes(),
        }
    }

    /// Decodes and bounds-checks a frame. Anything that does not decode exactly is
    /// malformed; the caller scores the peer for it.
    pub fn from_frame(frame: &Frame) -> Result<Message, AletheiaError> {
        let mut input = AceReader::new(&frame.payload);
        let message = match (frame.channel, frame.msg_type) {
            (Channel::Mgmt, 1) => Message::Ping {
                nonce: input.u64()?,
            },
            (Channel::Mgmt, 2) => Message::Pong {
                nonce: input.u64()?,
            },
            (Channel::Mgmt, 3) => Message::Status {
                tip_height: Height::decode(&mut input)?,
                tip_hash: Hash32::decode(&mut input)?,
            },
            (Channel::BlockProp, 1) => Message::NewBlock {
                height: Height::decode(&mut input)?,
                hash: Hash32::decode(&mut input)?,
            },
            (Channel::BlockProp, 2) => {
                let from = Height::decode(&mut input)?;
                let count = input.u16()?;
                if count == 0 || count > MAX_BLOCKS_PER_REQUEST {
                    return Err(malformed(format!(
                        "GetBlocks count {count} outside 1..={MAX_BLOCKS_PER_REQUEST}"
                    )));
                }
                Message::GetBlocks { from, count }
            }
            (Channel::BlockProp, 3) => {
                Message::Blocks(input.list(u32::from(MAX_BLOCKS_PER_REQUEST))?)
            }
            (Channel::TxGossip, 1) => Message::TxAnnounce(input.list(MAX_TX_IDS)?),
            (Channel::TxGossip, 2) => Message::GetTxs(input.list(MAX_TX_IDS)?),
            (Channel::TxGossip, 3) => Message::Txs(input.list(MAX_TXS)?),
            (channel, msg_type) => {
                return Err(malformed(format!(
                    "message type {msg_type} is not defined on the {channel:?} channel"
                )));
            }
        };
        input
            .finish()
            .map_err(|e| malformed(format!("{:?} message: {}", frame.channel, e.detail())))?;
        Ok(message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_message_round_trips_through_a_frame() {
        for message in [
            Message::Ping { nonce: 9 },
            Message::Pong { nonce: 9 },
            Message::Status {
                tip_height: Height::new(5),
                tip_hash: Hash32::from_bytes([1; 32]),
            },
            Message::NewBlock {
                height: Height::new(6),
                hash: Hash32::from_bytes([2; 32]),
            },
            Message::GetBlocks {
                from: Height::new(1),
                count: 64,
            },
            Message::Blocks(Vec::new()),
            Message::TxAnnounce(vec![Hash32::from_bytes([3; 32])]),
            Message::GetTxs(vec![]),
            Message::Txs(vec![]),
        ] {
            let frame = message.to_frame(1);
            assert_eq!(Message::from_frame(&frame).unwrap(), message);
        }
    }

    #[test]
    fn request_sizes_and_unknown_types_are_refused() {
        let mut frame = Message::GetBlocks {
            from: Height::new(1),
            count: 1,
        }
        .to_frame(0);
        frame.payload[8..10].copy_from_slice(&65u16.to_le_bytes());
        assert_eq!(
            Message::from_frame(&frame).unwrap_err().code(),
            ErrorCode::P2pMalformedMessage
        );
        let unknown = Frame {
            channel: Channel::Consensus,
            msg_type: 1,
            request_id: 0,
            payload: vec![],
        };
        assert_eq!(
            Message::from_frame(&unknown).unwrap_err().code(),
            ErrorCode::P2pMalformedMessage
        );
        let mut trailing = Message::Ping { nonce: 1 }.to_frame(0);
        trailing.payload.push(0);
        assert_eq!(
            Message::from_frame(&trailing).unwrap_err().code(),
            ErrorCode::P2pMalformedMessage
        );
    }
}
