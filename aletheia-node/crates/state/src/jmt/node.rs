//! JMT node storage format.
//!
//! ```text
//! NodeKey (JmtNodes column family key): u64_be(version) || u8 path_len || packed nibbles
//! Node: u8 tag
//!   0 Null      - the root of an empty tree
//!   1 Internal  - u16 child bitmap, then per present child (ascending nibble):
//!                 u64 version | Hash32 hash | bool is_leaf
//!   2 Leaf      - Hash32 key | Hash32 value_hash
//! ```
//!
//! Big-endian version first means all nodes of one version are contiguous, which makes
//! pruning a range delete.

use aletheia_core::{AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32};

use crate::jmt::KEY_NIBBLES;
use crate::key::StateKey;

/// A path from the root: up to 64 nibbles.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct NibblePath {
    nibbles: Vec<u8>,
}

impl NibblePath {
    pub fn root() -> NibblePath {
        NibblePath::default()
    }

    /// The first `depth` nibbles of `key`.
    pub fn of_key(key: &StateKey, depth: usize) -> NibblePath {
        NibblePath {
            nibbles: (0..depth.min(KEY_NIBBLES)).map(|i| key.nibble(i)).collect(),
        }
    }

    pub fn depth(&self) -> usize {
        self.nibbles.len()
    }

    pub fn child(&self, nibble: u8) -> NibblePath {
        let mut nibbles = self.nibbles.clone();
        nibbles.push(nibble & 0x0f);
        NibblePath { nibbles }
    }

    fn packed(&self) -> Vec<u8> {
        self.nibbles
            .chunks(2)
            .map(|pair| match pair {
                [high, low] => (high << 4) | low,
                [high] => high << 4,
                _ => 0,
            })
            .collect()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct NodeKey {
    pub version: u64,
    pub path: NibblePath,
}

impl NodeKey {
    pub fn new(version: u64, path: NibblePath) -> NodeKey {
        NodeKey { version, path }
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(9usize.saturating_add(self.path.depth().div_ceil(2)));
        bytes.extend_from_slice(&self.version.to_be_bytes());
        bytes.push(u8::try_from(self.path.depth()).unwrap_or(u8::MAX));
        bytes.extend_from_slice(&self.path.packed());
        bytes
    }
}

/// A reference from an internal node to one child.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ChildRef {
    /// Version at which the child node was written; its key is `(version, parent_path + nibble)`.
    pub version: u64,
    pub hash: Hash32,
    pub is_leaf: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[expect(
    clippy::large_enum_variant,
    reason = "nodes are short-lived decode results on the stack; boxing would add an allocation per node read"
)]
pub enum Node {
    Null,
    Internal { children: [Option<ChildRef>; 16] },
    Leaf { key: StateKey, value_hash: Hash32 },
}

impl AceEncode for Node {
    fn encode(&self, out: &mut AceWriter) {
        match self {
            Node::Null => out.u8(0),
            Node::Internal { children } => {
                out.u8(1);
                let bitmap = children
                    .iter()
                    .enumerate()
                    .filter(|(_, child)| child.is_some())
                    .fold(0u16, |bits, (nibble, _)| bits | (1u16 << nibble));
                out.u16(bitmap);
                for child in children.iter().flatten() {
                    out.u64(child.version);
                    child.hash.encode(out);
                    out.bool(child.is_leaf);
                }
            }
            Node::Leaf { key, value_hash } => {
                out.u8(2);
                key.hash().encode(out);
                value_hash.encode(out);
            }
        }
    }
}

impl AceDecode for Node {
    fn decode(input: &mut AceReader<'_>) -> Result<Node, AletheiaError> {
        let offset = input.position();
        match input.u8()? {
            0 => Ok(Node::Null),
            1 => {
                let bitmap = input.u16()?;
                if bitmap.count_ones() < 1 {
                    return Err(AletheiaError::new(
                        ErrorCode::DecodeNonCanonical,
                        "internal JMT node with no children".to_owned(),
                    ));
                }
                let mut children = [None; 16];
                for (nibble, slot) in children.iter_mut().enumerate() {
                    if bitmap & (1u16 << nibble) != 0 {
                        *slot = Some(ChildRef {
                            version: input.u64()?,
                            hash: Hash32::decode(input)?,
                            is_leaf: input.bool()?,
                        });
                    }
                }
                Ok(Node::Internal { children })
            }
            2 => Ok(Node::Leaf {
                key: StateKey::from_hash(Hash32::decode(input)?),
                value_hash: Hash32::decode(input)?,
            }),
            other => Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!("JMT node tag {other} at offset {offset}"),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_keys_sort_by_version_then_path() {
        let key = StateKey::from_hash(Hash32::from_bytes([0xab; 32]));
        let a = NodeKey::new(1, NibblePath::of_key(&key, 3)).to_bytes();
        let b = NodeKey::new(2, NibblePath::root()).to_bytes();
        assert!(a < b);
        assert_eq!(&a[..8], &1u64.to_be_bytes());
        assert_eq!(a[8], 3);
        assert_eq!(&a[9..], &[0xab, 0xa0]);
    }

    #[test]
    fn nodes_round_trip() {
        let mut children = [None; 16];
        children[3] = Some(ChildRef {
            version: 7,
            hash: Hash32::from_bytes([1; 32]),
            is_leaf: true,
        });
        children[15] = Some(ChildRef {
            version: 9,
            hash: Hash32::from_bytes([2; 32]),
            is_leaf: false,
        });
        for node in [
            Node::Null,
            Node::Internal { children },
            Node::Leaf {
                key: StateKey::from_hash(Hash32::from_bytes([3; 32])),
                value_hash: Hash32::from_bytes([4; 32]),
            },
        ] {
            assert_eq!(Node::from_ace_bytes(&node.to_ace_bytes()), Ok(node));
        }
    }
}
