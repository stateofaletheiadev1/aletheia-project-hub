//! Wire framing (spec Section 36, APS-0029).
//!
//! ```text
//! Frame: u32 length | u16 channel | u16 msg_type | u32 request_id | payload
//! length counts every byte after itself (8 header bytes + payload), little-endian like ACE.
//! ```
//!
//! Size limits are per channel and enforced from the header alone: a frame that announces
//! more than its channel allows is refused before any of its payload is buffered, so a peer
//! cannot make the node allocate by lying about a length.

use aletheia_core::{AletheiaError, ErrorCode};

/// Bytes after the length field that every frame carries before its payload.
pub const HEADER_AFTER_LENGTH: usize = 8;
/// Length field plus header.
pub const FRAME_OVERHEAD: usize = 4 + HEADER_AFTER_LENGTH;

pub const MAX_FRAME_CONSENSUS_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_FRAME_SYNC_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_FRAME_TX_GOSSIP_BYTES: usize = 256 * 1024;
/// Peer exchange, pings and the handshake are small; 64 KiB leaves room for a peer list.
pub const MAX_FRAME_MGMT_BYTES: usize = 64 * 1024;

/// Channels, each with its own queue, priority and budget. Values are protocol.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Channel {
    Consensus,
    BlockProp,
    TxGossip,
    StateSync,
    SnapshotSync,
    Mgmt,
}

impl Channel {
    pub const ALL: [Channel; 6] = [
        Channel::Consensus,
        Channel::BlockProp,
        Channel::TxGossip,
        Channel::StateSync,
        Channel::SnapshotSync,
        Channel::Mgmt,
    ];

    pub const fn code(self) -> u16 {
        match self {
            Channel::Consensus => 0,
            Channel::BlockProp => 1,
            Channel::TxGossip => 2,
            Channel::StateSync => 3,
            Channel::SnapshotSync => 4,
            Channel::Mgmt => 5,
        }
    }

    pub fn from_code(code: u16) -> Option<Channel> {
        Channel::ALL
            .into_iter()
            .find(|channel| channel.code() == code)
    }

    /// Largest payload this channel accepts. Block propagation carries whole blocks
    /// (4 MiB maximum) and shares the consensus limit.
    pub const fn max_payload(self) -> usize {
        match self {
            Channel::Consensus | Channel::BlockProp => MAX_FRAME_CONSENSUS_BYTES,
            Channel::StateSync | Channel::SnapshotSync => MAX_FRAME_SYNC_BYTES,
            Channel::TxGossip => MAX_FRAME_TX_GOSSIP_BYTES,
            Channel::Mgmt => MAX_FRAME_MGMT_BYTES,
        }
    }

    /// Send priority: lower is sent first. Consensus has strict priority.
    pub const fn priority(self) -> u8 {
        match self {
            Channel::Consensus => 0,
            Channel::BlockProp => 1,
            Channel::TxGossip => 2,
            Channel::Mgmt => 3,
            Channel::StateSync | Channel::SnapshotSync => 4,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    pub channel: Channel,
    pub msg_type: u16,
    pub request_id: u32,
    pub payload: Vec<u8>,
}

impl Frame {
    pub fn encode(&self) -> Result<Vec<u8>, AletheiaError> {
        if self.payload.len() > self.channel.max_payload() {
            return Err(too_large(self.channel, self.payload.len()));
        }
        let length = u32::try_from(self.payload.len().saturating_add(HEADER_AFTER_LENGTH))
            .map_err(|_| too_large(self.channel, self.payload.len()))?;
        let mut bytes = Vec::with_capacity(self.payload.len().saturating_add(FRAME_OVERHEAD));
        bytes.extend_from_slice(&length.to_le_bytes());
        bytes.extend_from_slice(&self.channel.code().to_le_bytes());
        bytes.extend_from_slice(&self.msg_type.to_le_bytes());
        bytes.extend_from_slice(&self.request_id.to_le_bytes());
        bytes.extend_from_slice(&self.payload);
        Ok(bytes)
    }
}

fn too_large(channel: Channel, payload: usize) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::P2pFrameTooLarge,
        format!(
            "{payload}-byte payload exceeds the {channel:?} channel limit of {}",
            channel.max_payload()
        ),
    )
}

/// Incremental decoder for one connection's inbound byte stream.
#[derive(Debug, Default)]
pub struct FrameDecoder {
    buffer: Vec<u8>,
}

fn read_u16(bytes: &[u8], at: usize) -> Option<u16> {
    bytes
        .get(at..at.checked_add(2)?)
        .and_then(|s| s.try_into().ok())
        .map(u16::from_le_bytes)
}

fn read_u32(bytes: &[u8], at: usize) -> Option<u32> {
    bytes
        .get(at..at.checked_add(4)?)
        .and_then(|s| s.try_into().ok())
        .map(u32::from_le_bytes)
}

impl FrameDecoder {
    pub fn new() -> FrameDecoder {
        FrameDecoder { buffer: Vec::new() }
    }

    /// Bytes received but not yet returned as frames.
    pub fn buffered(&self) -> usize {
        self.buffer.len()
    }

    pub fn push(&mut self, bytes: &[u8]) {
        self.buffer.extend_from_slice(bytes);
    }

    /// The next complete frame, `None` if more bytes are needed, or an error that ends the
    /// connection. Limits are checked as soon as the 12-byte header is available.
    pub fn next_frame(&mut self) -> Result<Option<Frame>, AletheiaError> {
        let (Some(length), Some(channel_code), Some(msg_type), Some(request_id)) = (
            read_u32(&self.buffer, 0),
            read_u16(&self.buffer, 4),
            read_u16(&self.buffer, 6),
            read_u32(&self.buffer, 8),
        ) else {
            return Ok(None);
        };
        let channel = Channel::from_code(channel_code).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::P2pUnknownChannel,
                format!("frame names unknown channel {channel_code}"),
            )
        })?;
        let length = usize::try_from(length).map_err(|_| too_large(channel, usize::MAX))?;
        let payload_len = length.checked_sub(HEADER_AFTER_LENGTH).ok_or_else(|| {
            AletheiaError::new(
                ErrorCode::P2pMalformedMessage,
                format!("frame length {length} is shorter than its header"),
            )
        })?;
        if payload_len > channel.max_payload() {
            return Err(too_large(channel, payload_len));
        }
        let total = payload_len.saturating_add(FRAME_OVERHEAD);
        let Some(payload) = self.buffer.get(FRAME_OVERHEAD..total) else {
            return Ok(None);
        };
        let frame = Frame {
            channel,
            msg_type,
            request_id,
            payload: payload.to_vec(),
        };
        self.buffer.drain(..total);
        Ok(Some(frame))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn frame(channel: Channel, payload: Vec<u8>) -> Frame {
        Frame {
            channel,
            msg_type: 7,
            request_id: 42,
            payload,
        }
    }

    #[test]
    fn header_layout_is_little_endian_with_length_after_itself() {
        let bytes = frame(Channel::Mgmt, vec![0xaa, 0xbb]).encode().unwrap();
        assert_eq!(
            &bytes[..4],
            &10u32.to_le_bytes(),
            "8 header bytes + 2 payload bytes"
        );
        assert_eq!(&bytes[4..6], &5u16.to_le_bytes());
        assert_eq!(&bytes[6..8], &7u16.to_le_bytes());
        assert_eq!(&bytes[8..12], &42u32.to_le_bytes());
        assert_eq!(&bytes[12..], &[0xaa, 0xbb]);
    }

    #[test]
    fn frames_split_across_reads_reassemble() {
        let bytes = frame(Channel::TxGossip, vec![1, 2, 3, 4, 5])
            .encode()
            .unwrap();
        let mut decoder = FrameDecoder::new();
        for chunk in bytes.chunks(3) {
            decoder.push(chunk);
        }
        assert_eq!(
            decoder.next_frame().unwrap(),
            Some(frame(Channel::TxGossip, vec![1, 2, 3, 4, 5]))
        );
        assert_eq!(decoder.next_frame().unwrap(), None);
        assert_eq!(decoder.buffered(), 0);
    }

    #[test]
    fn an_oversized_announcement_is_refused_from_the_header_alone() {
        let mut header = Vec::new();
        header.extend_from_slice(
            &u32::try_from(MAX_FRAME_TX_GOSSIP_BYTES + 9)
                .unwrap()
                .to_le_bytes(),
        );
        header.extend_from_slice(&Channel::TxGossip.code().to_le_bytes());
        header.extend_from_slice(&[0; 6]);
        let mut decoder = FrameDecoder::new();
        decoder.push(&header);
        assert_eq!(
            decoder.next_frame().unwrap_err().code(),
            ErrorCode::P2pFrameTooLarge
        );
    }

    #[test]
    fn unknown_channels_and_short_lengths_are_refused() {
        let mut decoder = FrameDecoder::new();
        decoder.push(&[8, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0]);
        assert_eq!(
            decoder.next_frame().unwrap_err().code(),
            ErrorCode::P2pUnknownChannel
        );
        let mut decoder = FrameDecoder::new();
        decoder.push(&[3, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0]);
        assert_eq!(
            decoder.next_frame().unwrap_err().code(),
            ErrorCode::P2pMalformedMessage
        );
    }

    #[test]
    fn encoding_refuses_payloads_over_the_channel_limit() {
        let error = frame(Channel::Mgmt, vec![0; MAX_FRAME_MGMT_BYTES + 1])
            .encode()
            .unwrap_err();
        assert_eq!(error.code(), ErrorCode::P2pFrameTooLarge);
    }

    #[test]
    fn consensus_has_strict_priority() {
        let first = Channel::ALL
            .into_iter()
            .min_by_key(|c| c.priority())
            .unwrap();
        assert_eq!(first, Channel::Consensus);
    }

    proptest! {
        #[test]
        fn sequences_of_frames_round_trip_through_arbitrary_chunking(
            payloads in proptest::collection::vec(proptest::collection::vec(any::<u8>(), 0..300), 1..8),
            chunk in 1usize..64,
        ) {
            let frames: Vec<Frame> = payloads.into_iter().enumerate()
                .map(|(i, p)| Frame { channel: Channel::ALL[i % 6], msg_type: u16::try_from(i).unwrap(), request_id: u32::try_from(i).unwrap(), payload: p })
                .collect();
            let wire: Vec<u8> = frames.iter().flat_map(|f| f.encode().unwrap()).collect();
            let mut decoder = FrameDecoder::new();
            let mut decoded = Vec::new();
            for piece in wire.chunks(chunk) {
                decoder.push(piece);
                while let Some(frame) = decoder.next_frame().unwrap() {
                    decoded.push(frame);
                }
            }
            prop_assert_eq!(decoded, frames);
        }

        #[test]
        fn arbitrary_bytes_never_panic_or_over_buffer(bytes in proptest::collection::vec(any::<u8>(), 0..2048)) {
            let mut decoder = FrameDecoder::new();
            decoder.push(&bytes);
            loop {
                match decoder.next_frame() {
                    Ok(Some(_)) => continue,
                    Ok(None) | Err(_) => break,
                }
            }
            prop_assert!(decoder.buffered() <= bytes.len());
        }
    }
}
