//! The persistent, versioned JMT over a [`KvStore`].
//!
//! [`JellyfishMerkleTree::apply`] turns one block's sorted write set into new nodes for the
//! next version. It reads only nodes of earlier versions and writes only into the caller's
//! batch, so the finalize path commits nodes, values and the block index in one atomic write
//! (Section 20). Nodes it replaces are recorded in `StaleJmtNodes` under the version that
//! replaced them, for the background pruner (Section 42.4).
//!
//! Values live in `StateValues` under `state_key || u64_be(u64::MAX - version)`, so the newest
//! value at or below a version is the first key of a short forward range.

use aletheia_core::{AceDecode, AceEncode, AletheiaError, ErrorCode, Hash32, NetworkIdentity};
use aletheia_storage::{ColumnFamily, KvStore, WriteBatch};

use crate::jmt::node::{ChildRef, NibblePath, Node, NodeKey};
use crate::jmt::proof::{ProofLevel, ProofTerminal, StateProof};
use crate::jmt::{PLACEHOLDER, internal_hash, leaf_hash, value_hash};
use crate::key::{MAX_STATE_VALUE_BYTES, StateKey, StateValue};

/// A subtree as the update recursion sees it.
#[derive(Debug, Clone, Copy)]
enum Child {
    Empty,
    /// Unchanged node of an earlier version at this position.
    Existing {
        version: u64,
        hash: Hash32,
        is_leaf: bool,
    },
    /// A leaf whose final position is decided by the caller (it may move up).
    NewLeaf {
        key: StateKey,
        value_hash: Hash32,
        hash: Hash32,
    },
    /// An internal node already written at this position under the new version.
    NewInternal {
        hash: Hash32,
    },
}

impl Child {
    fn is_empty(&self) -> bool {
        matches!(self, Child::Empty)
    }
}

pub struct JellyfishMerkleTree<'s> {
    store: &'s dyn KvStore,
    network: NetworkIdentity,
}

impl core::fmt::Debug for JellyfishMerkleTree<'_> {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("JellyfishMerkleTree")
            .field("network", &self.network)
            .finish_non_exhaustive()
    }
}

/// The in-progress write of one version.
struct VersionWriter<'b> {
    version: u64,
    batch: &'b mut WriteBatch,
}

impl VersionWriter<'_> {
    fn put_node(&mut self, path: &NibblePath, node: &Node) {
        let key = NodeKey::new(self.version, path.clone()).to_bytes();
        self.batch
            .put(ColumnFamily::JmtNodes, &key, &node.to_ace_bytes());
    }

    fn mark_stale(&mut self, replaced: &NodeKey) {
        let mut key = self.version.to_be_bytes().to_vec();
        key.extend_from_slice(&replaced.to_bytes());
        self.batch.put(ColumnFamily::StaleJmtNodes, &key, &[]);
    }
}

/// Where the value of `key` written at `version` is stored in `StateValues`: the key then the
/// inverted version, so a range read from `(key, version)` finds the newest value at or
/// below it. Public for storage tools and fault-injection tests.
pub fn value_key(key: &StateKey, version: u64) -> Vec<u8> {
    let mut bytes = key.as_bytes().to_vec();
    bytes.extend_from_slice(&u64::MAX.saturating_sub(version).to_be_bytes());
    bytes
}

fn subset(
    updates: &[(StateKey, Option<Hash32>)],
    depth: usize,
    nibble: u8,
) -> Vec<(StateKey, Option<Hash32>)> {
    updates
        .iter()
        .filter(|(key, _)| key.nibble(depth) == nibble)
        .copied()
        .collect()
}

impl<'s> JellyfishMerkleTree<'s> {
    pub fn new(store: &'s dyn KvStore, network: NetworkIdentity) -> JellyfishMerkleTree<'s> {
        JellyfishMerkleTree { store, network }
    }

    fn load(&self, key: &NodeKey) -> Result<Node, AletheiaError> {
        let bytes = self
            .store
            .get(ColumnFamily::JmtNodes, &key.to_bytes())?
            .ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    format!(
                        "JMT node at version {} depth {} is missing",
                        key.version,
                        key.path.depth()
                    ),
                )
            })?;
        Node::from_ace_bytes(&bytes).map_err(|error| {
            AletheiaError::new(
                ErrorCode::StoCorrupt,
                format!("JMT node at version {}: {}", key.version, error.detail()),
            )
        })
    }

    fn node_hash(&self, node: &Node) -> Hash32 {
        match node {
            Node::Null => PLACEHOLDER,
            Node::Leaf { key, value_hash } => leaf_hash(&self.network, key, value_hash),
            Node::Internal { children } => internal_hash(
                &self.network,
                &children.map(|child| child.map_or(PLACEHOLDER, |c| c.hash)),
            ),
        }
    }

    /// Root hash of the tree at `version`. Errors if that version was never written or has
    /// been pruned.
    pub fn root_hash(&self, version: u64) -> Result<Hash32, AletheiaError> {
        let root = self.load(&NodeKey::new(version, NibblePath::root()))?;
        Ok(self.node_hash(&root))
    }

    /// The value of `key` as of `version`.
    pub fn get(&self, key: &StateKey, version: u64) -> Result<Option<StateValue>, AletheiaError> {
        let mut upper = key.as_bytes().to_vec();
        upper.extend_from_slice(&[0xff; 9]);
        let found = self.store.range(
            ColumnFamily::StateValues,
            &value_key(key, version),
            &upper,
            1,
        )?;
        match found.into_iter().next() {
            Some((stored_key, value)) if stored_key.get(..32) == Some(&key.as_bytes()[..]) => {
                match value.split_first() {
                    Some((1, bytes)) => Ok(Some(bytes.to_vec())),
                    Some((0, [])) => Ok(None),
                    _ => Err(AletheiaError::new(
                        ErrorCode::StoCorrupt,
                        format!("state value for {} is malformed", key.hash()),
                    )),
                }
            }
            _ => Ok(None),
        }
    }

    /// Live `(key, value)` pairs as of `version`, ascending, strictly after `after`, at most
    /// `limit`. Snapshots page through the whole state with this.
    pub fn live_entries(
        &self,
        version: u64,
        after: Option<&StateKey>,
        limit: usize,
    ) -> Result<Vec<(StateKey, StateValue)>, AletheiaError> {
        const ROWS_PER_READ: usize = 1024;
        let mut cursor =
            after.map_or_else(Vec::new, |key| [&key.as_bytes()[..], &[0xff; 9]].concat());
        let end = [0xffu8; 42];
        let mut live = Vec::new();
        let mut current: Option<[u8; 32]> = after.map(|key| *key.as_bytes());
        let mut current_resolved = after.is_some();
        while live.len() < limit {
            let rows = self
                .store
                .range(ColumnFamily::StateValues, &cursor, &end, ROWS_PER_READ)?;
            let Some((last, _)) = rows.last() else { break };
            cursor = [&last[..], &[0]].concat();
            for (stored_key, value) in &rows {
                let (Some(key_bytes), Some(inverted)) = (
                    stored_key
                        .get(..32)
                        .and_then(|k| <[u8; 32]>::try_from(k).ok()),
                    stored_key
                        .get(32..40)
                        .and_then(|v| <[u8; 8]>::try_from(v).ok()),
                ) else {
                    return Err(AletheiaError::new(
                        ErrorCode::StoCorrupt,
                        "state value key is malformed".to_owned(),
                    ));
                };
                if current != Some(key_bytes) {
                    current = Some(key_bytes);
                    current_resolved = false;
                }
                // Rows of one key run newest first; the first at or below `version` decides it.
                let row_version = u64::MAX.saturating_sub(u64::from_be_bytes(inverted));
                if current_resolved || row_version > version {
                    continue;
                }
                current_resolved = true;
                match value.split_first() {
                    Some((1, bytes)) => {
                        live.push((
                            StateKey::from_hash(Hash32::from_bytes(key_bytes)),
                            bytes.to_vec(),
                        ));
                        if live.len() >= limit {
                            return Ok(live);
                        }
                    }
                    Some((0, [])) => {}
                    _ => {
                        return Err(AletheiaError::new(
                            ErrorCode::StoCorrupt,
                            "state value is malformed".to_owned(),
                        ));
                    }
                }
            }
        }
        Ok(live)
    }

    /// Deletes JMT nodes replaced at or before `up_to_version`, at most `max_nodes` per call so
    /// the background pruner can rate-limit itself (Section 42.4). Returns how many it removed.
    /// The caller must keep every version it still serves proofs for above `up_to_version`.
    pub fn prune_stale(
        &self,
        up_to_version: u64,
        max_nodes: usize,
        batch: &mut WriteBatch,
    ) -> Result<usize, AletheiaError> {
        let end = up_to_version.saturating_add(1).to_be_bytes();
        let markers = self
            .store
            .range(ColumnFamily::StaleJmtNodes, &[], &end, max_nodes)?;
        for (marker, _) in &markers {
            let node_key = marker.get(8..).ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    "stale-node marker is malformed".to_owned(),
                )
            })?;
            batch.delete(ColumnFamily::JmtNodes, node_key);
            batch.delete(ColumnFamily::StaleJmtNodes, marker);
        }
        Ok(markers.len())
    }

    /// Writes version `version` on top of `previous` (None for the first version). `changes`
    /// must be strictly ascending by key - [`crate::overlay::StateOverlay::into_changes`]
    /// produces exactly that. Returns the new root hash.
    pub fn apply(
        &self,
        previous: Option<u64>,
        version: u64,
        changes: &[(StateKey, Option<StateValue>)],
        batch: &mut WriteBatch,
    ) -> Result<Hash32, AletheiaError> {
        if previous.is_some_and(|p| p >= version) {
            return Err(AletheiaError::new(
                ErrorCode::FinalizeOutOfOrder,
                format!("JMT version {version} does not follow {previous:?}"),
            ));
        }
        if let Some(index) = changes
            .windows(2)
            .position(|pair| !matches!(pair, [a, b] if a.0 < b.0))
        {
            return Err(AletheiaError::new(
                ErrorCode::DecodeNonCanonical,
                format!(
                    "state changes are not strictly ascending at index {}",
                    index.saturating_add(1)
                ),
            ));
        }
        let mut writer = VersionWriter { version, batch };
        let mut updates = Vec::with_capacity(changes.len());
        for (key, value) in changes {
            match value {
                Some(bytes) => {
                    if bytes.len() > MAX_STATE_VALUE_BYTES {
                        return Err(AletheiaError::new(
                            ErrorCode::DecodeLengthExceeded,
                            format!(
                                "state value of {} bytes exceeds {MAX_STATE_VALUE_BYTES}",
                                bytes.len()
                            ),
                        ));
                    }
                    let mut stored = Vec::with_capacity(bytes.len().saturating_add(1));
                    stored.push(1);
                    stored.extend_from_slice(bytes);
                    writer
                        .batch
                        .put(ColumnFamily::StateValues, &value_key(key, version), &stored);
                    updates.push((*key, Some(value_hash(bytes))));
                }
                None => {
                    writer
                        .batch
                        .put(ColumnFamily::StateValues, &value_key(key, version), &[0]);
                    updates.push((*key, None));
                }
            }
        }

        let root_path = NibblePath::root();
        let existing_root = match previous {
            None => Child::Empty,
            Some(previous) => {
                let key = NodeKey::new(previous, root_path.clone());
                let node = self.load(&key)?;
                writer.mark_stale(&key);
                match node {
                    Node::Null => Child::Empty,
                    Node::Leaf { .. } => Child::Existing {
                        version: previous,
                        hash: self.node_hash(&node),
                        is_leaf: true,
                    },
                    Node::Internal { .. } => Child::Existing {
                        version: previous,
                        hash: self.node_hash(&node),
                        is_leaf: false,
                    },
                }
            }
        };

        let result = self.update(&mut writer, &root_path, existing_root, &updates)?;
        match result {
            Child::Empty => {
                writer.put_node(&root_path, &Node::Null);
                Ok(PLACEHOLDER)
            }
            Child::NewLeaf {
                key,
                value_hash,
                hash,
            } => {
                writer.put_node(&root_path, &Node::Leaf { key, value_hash });
                Ok(hash)
            }
            Child::Existing {
                version: old, hash, ..
            } => {
                // Nothing changed: the new version's root is a copy of the old one.
                let node = self.load(&NodeKey::new(old, root_path.clone()))?;
                writer.put_node(&root_path, &node);
                Ok(hash)
            }
            Child::NewInternal { hash } => Ok(hash),
        }
    }

    fn update(
        &self,
        writer: &mut VersionWriter<'_>,
        path: &NibblePath,
        existing: Child,
        updates: &[(StateKey, Option<Hash32>)],
    ) -> Result<Child, AletheiaError> {
        if updates.is_empty() {
            return Ok(existing);
        }
        match existing {
            Child::Empty => self.build(writer, path, &inserts(updates)),
            Child::Existing {
                version,
                is_leaf: true,
                ..
            } => {
                let key = NodeKey::new(version, path.clone());
                let Node::Leaf {
                    key: leaf_key,
                    value_hash,
                } = self.load(&key)?
                else {
                    return Err(corrupt_kind(&key, "leaf"));
                };
                writer.mark_stale(&key);
                let mut merged: Vec<(StateKey, Option<Hash32>)> = updates.to_vec();
                if !merged.iter().any(|(k, _)| *k == leaf_key) {
                    merged.push((leaf_key, Some(value_hash)));
                    merged.sort_by(|a, b| a.0.cmp(&b.0));
                }
                self.build(writer, path, &inserts(&merged))
            }
            Child::Existing {
                version,
                is_leaf: false,
                ..
            } => {
                let key = NodeKey::new(version, path.clone());
                let Node::Internal { children } = self.load(&key)? else {
                    return Err(corrupt_kind(&key, "internal"));
                };
                writer.mark_stale(&key);
                let depth = path.depth();
                let mut results = [Child::Empty; 16];
                for (nibble, (result, child)) in (0u8..).zip(results.iter_mut().zip(children)) {
                    let existing_child = child.map_or(Child::Empty, |c| Child::Existing {
                        version: c.version,
                        hash: c.hash,
                        is_leaf: c.is_leaf,
                    });
                    *result = self.update(
                        writer,
                        &path.child(nibble),
                        existing_child,
                        &subset(updates, depth, nibble),
                    )?;
                }
                self.finalize(writer, path, results)
            }
            Child::NewLeaf { .. } | Child::NewInternal { .. } => Err(AletheiaError::new(
                ErrorCode::StoCorrupt,
                "JMT update reached a node written in the same version".to_owned(),
            )),
        }
    }

    fn build(
        &self,
        writer: &mut VersionWriter<'_>,
        path: &NibblePath,
        entries: &[(StateKey, Hash32)],
    ) -> Result<Child, AletheiaError> {
        match entries {
            [] => Ok(Child::Empty),
            [(key, value_hash)] => Ok(Child::NewLeaf {
                key: *key,
                value_hash: *value_hash,
                hash: leaf_hash(&self.network, key, value_hash),
            }),
            _ => {
                let depth = path.depth();
                let mut results = [Child::Empty; 16];
                for (nibble, result) in (0u8..).zip(results.iter_mut()) {
                    let part: Vec<(StateKey, Hash32)> = entries
                        .iter()
                        .filter(|(k, _)| k.nibble(depth) == nibble)
                        .copied()
                        .collect();
                    *result = self.build(writer, &path.child(nibble), &part)?;
                }
                self.finalize(writer, path, results)
            }
        }
    }

    /// Writes an internal node for `children`, or collapses: no children is empty, and a lone
    /// leaf moves up to this position.
    fn finalize(
        &self,
        writer: &mut VersionWriter<'_>,
        path: &NibblePath,
        children: [Child; 16],
    ) -> Result<Child, AletheiaError> {
        let present: Vec<(u8, Child)> = (0u8..)
            .zip(children)
            .filter(|(_, child)| !child.is_empty())
            .collect();
        match present.as_slice() {
            [] => return Ok(Child::Empty),
            [(_, leaf @ Child::NewLeaf { .. })] => return Ok(*leaf),
            [
                (
                    nibble,
                    Child::Existing {
                        version,
                        is_leaf: true,
                        ..
                    },
                ),
            ] => {
                let key = NodeKey::new(*version, path.child(*nibble));
                let Node::Leaf {
                    key: leaf_key,
                    value_hash,
                } = self.load(&key)?
                else {
                    return Err(corrupt_kind(&key, "leaf"));
                };
                writer.mark_stale(&key);
                return Ok(Child::NewLeaf {
                    key: leaf_key,
                    value_hash,
                    hash: leaf_hash(&self.network, &leaf_key, &value_hash),
                });
            }
            _ => {}
        }
        let mut refs: [Option<ChildRef>; 16] = [None; 16];
        for (nibble, child) in present {
            let slot = refs.get_mut(usize::from(nibble)).ok_or_else(|| {
                AletheiaError::new(
                    ErrorCode::StoCorrupt,
                    format!("nibble {nibble} out of range"),
                )
            })?;
            *slot = Some(match child {
                Child::NewLeaf {
                    key,
                    value_hash,
                    hash,
                } => {
                    writer.put_node(&path.child(nibble), &Node::Leaf { key, value_hash });
                    ChildRef {
                        version: writer.version,
                        hash,
                        is_leaf: true,
                    }
                }
                Child::NewInternal { hash } => ChildRef {
                    version: writer.version,
                    hash,
                    is_leaf: false,
                },
                Child::Existing {
                    version,
                    hash,
                    is_leaf,
                } => ChildRef {
                    version,
                    hash,
                    is_leaf,
                },
                Child::Empty => continue,
            });
        }
        let node = Node::Internal { children: refs };
        writer.put_node(path, &node);
        Ok(Child::NewInternal {
            hash: self.node_hash(&node),
        })
    }

    /// Inclusion or non-inclusion proof for `key` against the root at `version`.
    pub fn prove(&self, key: &StateKey, version: u64) -> Result<StateProof, AletheiaError> {
        let mut path = NibblePath::root();
        let mut node = self.load(&NodeKey::new(version, path.clone()))?;
        let mut levels = Vec::new();
        loop {
            match node {
                Node::Null => {
                    return Ok(StateProof {
                        levels,
                        terminal: ProofTerminal::Empty,
                    });
                }
                Node::Leaf {
                    key: leaf_key,
                    value_hash,
                } => {
                    return Ok(StateProof {
                        levels,
                        terminal: ProofTerminal::Leaf {
                            key: leaf_key,
                            value_hash,
                        },
                    });
                }
                Node::Internal { children } => {
                    let nibble = key.nibble(path.depth());
                    levels.push(ProofLevel::from_children(&children, nibble));
                    match children.get(usize::from(nibble)).copied().flatten() {
                        None => {
                            return Ok(StateProof {
                                levels,
                                terminal: ProofTerminal::Empty,
                            });
                        }
                        Some(child) => {
                            path = path.child(nibble);
                            node = self.load(&NodeKey::new(child.version, path.clone()))?;
                        }
                    }
                }
            }
        }
    }
}

fn inserts(updates: &[(StateKey, Option<Hash32>)]) -> Vec<(StateKey, Hash32)> {
    updates
        .iter()
        .filter_map(|(key, value)| value.map(|v| (*key, v)))
        .collect()
}

fn corrupt_kind(key: &NodeKey, expected: &str) -> AletheiaError {
    AletheiaError::new(
        ErrorCode::StoCorrupt,
        format!(
            "JMT node at version {} depth {} is not the {expected} its parent says",
            key.version,
            key.path.depth()
        ),
    )
}
