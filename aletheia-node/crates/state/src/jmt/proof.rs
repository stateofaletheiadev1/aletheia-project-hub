//! State proofs (spec Section 16.3, Appendix R.5).
//!
//! ```text
//! StateProof = list<ProofLevel> (root first) | ProofTerminal
//! ProofLevel = u16 sibling_bitmap | Hash32 per set bit (ascending nibble)
//! ProofTerminal: u8 tag; 0 Empty | 1 Leaf { key Hash32, value_hash Hash32 }
//! ```
//!
//! A level lists the non-empty siblings of the path's child; the path child itself is never in
//! the bitmap. The terminal is what the path ends in: nothing (the key is absent), the key's
//! own leaf (inclusion), or another key's leaf sharing every nibble so far (also absence,
//! because a lone leaf sits as high as it can).
//!
//! Light clients verify `FinalityProof → header.state_root → StateProof → value`. The
//! verifier lives here until `crates/verify` (no_std, WASM) is created in Phase 12; it uses
//! nothing beyond hashing so it moves unchanged.

use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, ErrorCode, Hash32, NetworkIdentity,
};

use crate::jmt::node::ChildRef;
use crate::jmt::{KEY_NIBBLES, PLACEHOLDER, internal_hash, leaf_hash, value_hash};
use crate::key::StateKey;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProofLevel {
    bitmap: u16,
    siblings: Vec<Hash32>,
}

impl ProofLevel {
    pub(crate) fn from_children(children: &[Option<ChildRef>; 16], path_nibble: u8) -> ProofLevel {
        let mut bitmap = 0u16;
        let mut siblings = Vec::new();
        for (nibble, child) in (0u8..).zip(children) {
            if nibble != path_nibble
                && let Some(child) = child
            {
                bitmap |= 1u16 << nibble;
                siblings.push(child.hash);
            }
        }
        ProofLevel { bitmap, siblings }
    }

    /// All 16 child hashes with `current` in the path slot, or None if the bitmap claims the
    /// path slot or disagrees with the sibling count.
    fn children_with(&self, path_nibble: u8, current: Hash32) -> Option<[Hash32; 16]> {
        if self.bitmap & (1u16 << path_nibble) != 0
            || usize::try_from(self.bitmap.count_ones()).ok()? != self.siblings.len()
        {
            return None;
        }
        let mut children = [PLACEHOLDER; 16];
        let mut siblings = self.siblings.iter();
        for (nibble, slot) in (0u8..).zip(children.iter_mut()) {
            if nibble == path_nibble {
                *slot = current;
            } else if self.bitmap & (1u16 << nibble) != 0 {
                *slot = *siblings.next()?;
            }
        }
        Some(children)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProofTerminal {
    Empty,
    Leaf { key: StateKey, value_hash: Hash32 },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StateProof {
    pub levels: Vec<ProofLevel>,
    pub terminal: ProofTerminal,
}

impl StateProof {
    /// Checks that `key` has `value` (or, for `None`, is absent) in the tree with `root`.
    pub fn verify(
        &self,
        network: &NetworkIdentity,
        root: &Hash32,
        key: &StateKey,
        value: Option<&[u8]>,
    ) -> Result<(), AletheiaError> {
        let invalid = |reason: String| {
            AletheiaError::new(
                ErrorCode::ProofInvalid,
                format!("state proof for {}: {reason}", key.hash()),
            )
        };
        let depth = self.levels.len();
        if depth > KEY_NIBBLES {
            return Err(invalid(format!(
                "{depth} levels exceed the {KEY_NIBBLES}-nibble key"
            )));
        }

        let mut current = match (self.terminal, value) {
            (
                ProofTerminal::Leaf {
                    key: leaf_key,
                    value_hash: leaf_value,
                },
                Some(expected),
            ) => {
                if leaf_key != *key {
                    return Err(invalid(
                        "proof ends at a different key's leaf, so the key is absent".to_owned(),
                    ));
                }
                if leaf_value != value_hash(expected) {
                    return Err(invalid("leaf holds a different value".to_owned()));
                }
                leaf_hash(network, &leaf_key, &leaf_value)
            }
            (
                ProofTerminal::Leaf {
                    key: leaf_key,
                    value_hash: leaf_value,
                },
                None,
            ) => {
                if leaf_key == *key {
                    return Err(invalid("proof shows the key present".to_owned()));
                }
                if (0..depth).any(|i| leaf_key.nibble(i) != key.nibble(i)) {
                    return Err(invalid("terminal leaf is not on the key's path".to_owned()));
                }
                leaf_hash(network, &leaf_key, &leaf_value)
            }
            (ProofTerminal::Empty, Some(_)) => {
                return Err(invalid("proof shows the key absent".to_owned()));
            }
            (ProofTerminal::Empty, None) => PLACEHOLDER,
        };

        for (level_depth, level) in self.levels.iter().enumerate().rev() {
            let nibble = key.nibble(level_depth);
            let children = level
                .children_with(nibble, current)
                .ok_or_else(|| invalid(format!("level {level_depth} is malformed")))?;
            current = internal_hash(network, &children);
        }
        if current != *root {
            return Err(invalid(format!(
                "recomputed root {current} differs from {root}"
            )));
        }
        Ok(())
    }
}

impl AceEncode for ProofLevel {
    fn encode(&self, out: &mut AceWriter) {
        out.u16(self.bitmap);
        for sibling in &self.siblings {
            sibling.encode(out);
        }
    }
}

impl AceDecode for ProofLevel {
    fn decode(input: &mut AceReader<'_>) -> Result<ProofLevel, AletheiaError> {
        let bitmap = input.u16()?;
        let siblings = (0..bitmap.count_ones())
            .map(|_| Hash32::decode(input))
            .collect::<Result<_, _>>()?;
        Ok(ProofLevel { bitmap, siblings })
    }
}

impl AceEncode for StateProof {
    fn encode(&self, out: &mut AceWriter) {
        out.list(&self.levels);
        match self.terminal {
            ProofTerminal::Empty => out.u8(0),
            ProofTerminal::Leaf { key, value_hash } => {
                out.u8(1);
                key.hash().encode(out);
                value_hash.encode(out);
            }
        }
    }
}

impl AceDecode for StateProof {
    fn decode(input: &mut AceReader<'_>) -> Result<StateProof, AletheiaError> {
        let levels = input.list(u32::try_from(KEY_NIBBLES).unwrap_or(64))?;
        let offset = input.position();
        let terminal = match input.u8()? {
            0 => ProofTerminal::Empty,
            1 => ProofTerminal::Leaf {
                key: StateKey::from_hash(Hash32::decode(input)?),
                value_hash: Hash32::decode(input)?,
            },
            other => {
                return Err(AletheiaError::new(
                    ErrorCode::DecodeNonCanonical,
                    format!("proof terminal tag {other} at offset {offset}"),
                ));
            }
        };
        Ok(StateProof { levels, terminal })
    }
}
