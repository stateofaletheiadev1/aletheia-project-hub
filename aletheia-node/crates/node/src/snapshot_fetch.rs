//! Fetching a snapshot from peers (ADR-073) for a node whose data directory is new and whose
//! configuration says `restore_snapshot = "peers"`.
//!
//! 1. Every connected peer is asked which snapshot it serves (`GetSnapshotOffer`). Offers are
//!    collected until every peer asked has answered, or for [`OFFER_WAIT`] after the first.
//! 2. Offers are tried from the highest height down. One is accepted only when its anchor and
//!    manifest verify against the genesis file ([`crate::bootstrap::verify`]); peers whose
//!    offer did not verify are never used. Every peer offering the same manifest is a source.
//! 3. Each chunk is fetched in parts of at most 4 MiB from one source, and checked against
//!    its manifest hash as soon as it is complete; a source that times out, disconnects,
//!    answers out of order or sends a bad chunk is dropped and the chunk is fetched from the
//!    next. Chunks already on disk that check out are kept, so a restart resumes.
//! 4. The manifest and anchor are written last. The caller restores from the directory, which
//!    verifies everything again.
//!
//! Nothing a peer sends is believed before it is checked, and no peer is waited on forever.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

use aletheia_core::{AceDecode, AletheiaError, ErrorCode};
use aletheia_execution::GenesisState;
use aletheia_p2p::{Message, NetworkCommand, NetworkEvent, NetworkHandle, PeerId};
use aletheia_state::snapshot::{self, MAX_COMPRESSED_CHUNK_BYTES, SnapshotManifest};
use tokio::time::Instant;

use crate::bootstrap::{SnapshotAnchor, write_anchor};
use crate::consensus::operator_note;

/// Where a download is assembled, inside the new data directory; removed after the restore.
pub(crate) const DOWNLOAD_DIR: &str = "snapshot-download";
/// After the first offer, how long other peers have to answer.
pub(crate) const OFFER_WAIT: Duration = Duration::from_secs(5);
/// How long the node looks for a peer that offers a snapshot before it gives up (and, under
/// systemd, is started again).
pub(crate) const FIND_LIMIT: Duration = Duration::from_secs(600);
/// How long one part may take to arrive.
pub(crate) const PART_TIMEOUT: Duration = Duration::from_secs(30);

/// `at + after`, or a day out when that overflows (a deadline that far away never matters).
fn later(at: Instant, after: Duration) -> Instant {
    at.checked_add(after)
        .or_else(|| at.checked_add(Duration::from_secs(86_400)))
        .unwrap_or(at)
}

fn peer_text(peer: &PeerId) -> String {
    aletheia_core::base16::encode(peer)
}

fn unavailable(detail: String) -> AletheiaError {
    AletheiaError::new(ErrorCode::StoIo, format!("snapshot from peers: {detail}"))
}

struct Offer {
    peer: PeerId,
    height: u64,
    manifest: Vec<u8>,
    anchor: Vec<u8>,
}

/// A verified offer and the peers serving it.
struct Target {
    manifest: SnapshotManifest,
    anchor: SnapshotAnchor,
    sources: Vec<PeerId>,
}

async fn send(network: &NetworkHandle, peer: PeerId, message: Message) {
    let _ = network
        .commands
        .send(NetworkCommand::Send { peer, message })
        .await;
}

/// Fetches and checks a snapshot into `download/<height>` and returns that directory.
pub(crate) async fn fetch(
    network: &mut NetworkHandle,
    genesis: &GenesisState,
    download: &Path,
) -> Result<PathBuf, AletheiaError> {
    fetch_with(network, genesis, download, FIND_LIMIT, PART_TIMEOUT).await
}

pub(crate) async fn fetch_with(
    network: &mut NetworkHandle,
    genesis: &GenesisState,
    download: &Path,
    find_limit: Duration,
    part_timeout: Duration,
) -> Result<PathBuf, AletheiaError> {
    operator_note("info looking for a snapshot to start from (restore_snapshot = \"peers\")");
    let mut refused: BTreeSet<PeerId> = BTreeSet::new();
    loop {
        let offers = collect_offers(network, find_limit, &refused).await?;
        let Some(target) = choose(genesis, offers, &mut refused) else {
            operator_note(
                "warn no offered snapshot verified against the genesis file; asking again",
            );
            continue;
        };
        let height = target.manifest.height;
        operator_note(&format!(
            "info fetching snapshot height={height} chunks={} from {} peer(s)",
            target.manifest.chunk_hashes.len(),
            target.sources.len()
        ));
        let dir = download.join(height.to_string());
        clear_other_downloads(download, &dir);
        match download_all(network, &target, &dir, part_timeout).await {
            Ok(()) => {
                snapshot::write_manifest(&dir, &target.manifest)?;
                write_anchor(&dir, &target.anchor)?;
                snapshot::sync_dir(&dir)?;
                operator_note(&format!(
                    "info snapshot height={height} fetched and checked"
                ));
                return Ok(dir);
            }
            // Every source failed: ask again; snapshots that check out stay on disk.
            Err(error) => operator_note(&format!(
                "warn snapshot height={height}: {}; asking peers again",
                error.detail()
            )),
        }
    }
}

fn clear_other_downloads(download: &Path, keep: &Path) {
    if let Ok(entries) = std::fs::read_dir(download) {
        for entry in entries.filter_map(Result::ok) {
            if entry.path() != keep {
                let _ = std::fs::remove_dir_all(entry.path());
            }
        }
    }
}

/// Asks every connected peer (and every peer that connects) for its offer.
async fn collect_offers(
    network: &mut NetworkHandle,
    find_limit: Duration,
    refused: &BTreeSet<PeerId>,
) -> Result<Vec<Offer>, AletheiaError> {
    let started = Instant::now();
    let mut asked: BTreeSet<PeerId> = BTreeSet::new();
    let mut answered: BTreeSet<PeerId> = BTreeSet::new();
    let mut offers: Vec<Offer> = Vec::new();
    let mut first_offer: Option<Instant> = None;
    // Peers connected before this call are asked again by a fresh round of requests: the
    // network reports each connection once, so ask whoever is heard from.
    let mut ask_again = tokio::time::interval(Duration::from_secs(30));
    loop {
        let until = match first_offer {
            Some(at) => later(at, OFFER_WAIT),
            None => later(started, find_limit),
        };
        if first_offer.is_some() && !asked.is_empty() && answered.is_superset(&asked) {
            return Ok(offers);
        }
        tokio::select! {
            event = network.events.recv() => {
                let Some(event) = event else {
                    return Err(unavailable("the network stopped".to_owned()));
                };
                match event {
                    NetworkEvent::Connected { peer, .. } => {
                        if !refused.contains(&peer) && asked.insert(peer) {
                            send(network, peer, Message::GetSnapshotOffer).await;
                        }
                    }
                    NetworkEvent::Disconnected { peer, .. } => {
                        asked.remove(&peer);
                        answered.remove(&peer);
                    }
                    NetworkEvent::Message { peer, message } => match message {
                        Message::SnapshotOffer { height, manifest, anchor } => {
                            if !asked.contains(&peer) {
                                continue;
                            }
                            answered.insert(peer);
                            if height > 0 {
                                first_offer.get_or_insert_with(Instant::now);
                                offers.retain(|offer| offer.peer != peer);
                                offers.push(Offer { peer, height, manifest, anchor });
                            }
                        }
                        // Any other traffic shows a live peer that may not have been asked.
                        _ => {
                            if !refused.contains(&peer) && asked.insert(peer) {
                                send(network, peer, Message::GetSnapshotOffer).await;
                            }
                        }
                    },
                }
            }
            _ = ask_again.tick() => {
                for peer in asked.difference(&answered).copied().collect::<Vec<_>>() {
                    send(network, peer, Message::GetSnapshotOffer).await;
                }
            }
            () = tokio::time::sleep_until(until) => {
                if !offers.is_empty() {
                    return Ok(offers);
                }
                return Err(unavailable(format!(
                    "no peer offered a snapshot within {} s; check [[peers]] and that they run a release that serves snapshots",
                    find_limit.as_secs()
                )));
            }
        }
    }
}

/// The highest offer that verifies against genesis, with every peer offering the same
/// manifest. Peers whose offer failed are added to `refused`.
fn choose(
    genesis: &GenesisState,
    mut offers: Vec<Offer>,
    refused: &mut BTreeSet<PeerId>,
) -> Option<Target> {
    offers.sort_by(|a, b| b.height.cmp(&a.height));
    let mut tried: Vec<Vec<u8>> = Vec::new();
    for offer in &offers {
        if tried.contains(&offer.manifest) {
            continue;
        }
        tried.push(offer.manifest.clone());
        let same: Vec<PeerId> = offers
            .iter()
            .filter(|other| other.manifest == offer.manifest && other.anchor == offer.anchor)
            .map(|other| other.peer)
            .collect();
        let checked = SnapshotManifest::from_ace_bytes(&offer.manifest).and_then(|manifest| {
            let anchor = SnapshotAnchor::from_ace_bytes(&offer.anchor)?;
            crate::bootstrap::verify(genesis, &anchor, &manifest)?;
            if manifest.height != offer.height {
                return Err(AletheiaError::new(
                    ErrorCode::ProofInvalid,
                    format!(
                        "offer says height {} for a manifest of height {}",
                        offer.height, manifest.height
                    ),
                ));
            }
            Ok((manifest, anchor))
        });
        match checked {
            Ok((manifest, anchor)) => {
                return Some(Target {
                    manifest,
                    anchor,
                    sources: same,
                });
            }
            Err(error) => {
                for peer in &same {
                    operator_note(&format!(
                        "warn peer {} offered a snapshot at height {} that does not verify: {}",
                        peer_text(peer),
                        offer.height,
                        error.detail()
                    ));
                    refused.insert(*peer);
                }
            }
        }
    }
    None
}

async fn download_all(
    network: &mut NetworkHandle,
    target: &Target,
    dir: &Path,
    part_timeout: Duration,
) -> Result<(), AletheiaError> {
    std::fs::create_dir_all(dir)
        .map_err(|e| unavailable(format!("create {}: {e}", dir.display())))?;
    let mut sources = target.sources.clone();
    let count = target.manifest.chunk_hashes.len();
    for (index, expected) in target.manifest.chunk_hashes.iter().enumerate() {
        let path = dir.join(snapshot::chunk_file_name(index));
        let kept = std::fs::read(&path)
            .ok()
            .is_some_and(|bytes| snapshot::check_chunk(&bytes, expected, index).is_ok());
        if kept {
            continue;
        }
        loop {
            // Spread chunks over the sources; the next one takes over when one fails.
            let pick = index.checked_rem(sources.len()).unwrap_or(0);
            let Some(&peer) = sources.get(pick) else {
                return Err(unavailable(format!(
                    "no peer serving it is left (at chunk {index} of {count})"
                )));
            };
            match download_chunk(network, peer, target, index, part_timeout).await {
                Ok(bytes) => {
                    snapshot::write_chunk(dir, index, &bytes)?;
                    break;
                }
                Err(error) => {
                    operator_note(&format!(
                        "warn snapshot chunk {index} from peer {}: {}; trying another peer",
                        peer_text(&peer),
                        error.detail()
                    ));
                    sources.retain(|source| *source != peer);
                }
            }
        }
        let done = index.saturating_add(1);
        if done.is_multiple_of(16) || done == count {
            operator_note(&format!(
                "info snapshot height={} chunks {done}/{count}",
                target.manifest.height
            ));
        }
    }
    Ok(())
}

/// One chunk from one peer, part by part, checked against the manifest.
async fn download_chunk(
    network: &mut NetworkHandle,
    peer: PeerId,
    target: &Target,
    index: usize,
    part_timeout: Duration,
) -> Result<Vec<u8>, AletheiaError> {
    let height = target.manifest.height;
    let chunk = u32::try_from(index).map_err(|_| unavailable("chunk index".to_owned()))?;
    let expected = target
        .manifest
        .chunk_hashes
        .get(index)
        .ok_or_else(|| unavailable(format!("chunk {index} is not in the manifest")))?;
    let mut bytes: Vec<u8> = Vec::new();
    let mut total: Option<u64> = None;
    loop {
        let offset = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
        send(
            network,
            peer,
            Message::GetSnapshotPart {
                height,
                chunk,
                offset,
            },
        )
        .await;
        let deadline = later(Instant::now(), part_timeout);
        let (part_total, data) = loop {
            let event = tokio::time::timeout_at(deadline, network.events.recv())
                .await
                .map_err(|_| unavailable(format!("no answer within {} s", part_timeout.as_secs())))?
                .ok_or_else(|| unavailable("the network stopped".to_owned()))?;
            match event {
                NetworkEvent::Disconnected { peer: gone, .. } if gone == peer => {
                    return Err(unavailable("the peer disconnected".to_owned()));
                }
                NetworkEvent::Message {
                    peer: from,
                    message:
                        Message::SnapshotPart {
                            height: h,
                            chunk: c,
                            offset: o,
                            total: t,
                            data,
                        },
                } if from == peer && h == height && c == chunk && o == offset => break (t, data),
                _ => {}
            }
        };
        if part_total == 0 {
            return Err(unavailable(
                "the peer no longer serves this snapshot".to_owned(),
            ));
        }
        if part_total > u64::try_from(MAX_COMPRESSED_CHUNK_BYTES).unwrap_or(u64::MAX)
            || total.is_some_and(|known| known != part_total)
            || data.is_empty()
            || offset.saturating_add(u64::try_from(data.len()).unwrap_or(u64::MAX)) > part_total
        {
            return Err(AletheiaError::new(
                ErrorCode::ProofInvalid,
                format!("chunk {index}: the peer's parts do not add up"),
            ));
        }
        total = Some(part_total);
        bytes.extend_from_slice(&data);
        if u64::try_from(bytes.len()).unwrap_or(u64::MAX) == part_total {
            snapshot::check_chunk(&bytes, expected, index)?;
            return Ok(bytes);
        }
    }
}
