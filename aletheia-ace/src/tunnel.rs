//! Optional public HTTPS route to the node's RPC, through Cloudflare Tunnel (`cloudflared`).
//!
//! Topology: client → https://<public hostname> → Cloudflare → cloudflared (this host) →
//! the RPC listener ACE discovered and verified → aletheiad. The tunnel is started only while
//! the node is serving and stopped the moment the RPC check fails. The public endpoint is
//! reported up only after a request from this host through the public URL returns the same
//! chain, a height at or beyond the local one, and the same block id at a common height.
//!
//! The tunnel token comes from `TUNNEL_TOKEN` in the environment (cloudflared reads it there;
//! it never appears on a command line). With a remotely managed tunnel the origin service is
//! set in the Cloudflare dashboard, which ACE cannot read: point it at the address `ace
//! inspect-rpc` reports. The identity check above catches a dashboard that points elsewhere.

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use crate::error::{AceError, Result};
use crate::oplog::{self, Category};
use crate::rpc;
use crate::settings::{TunnelProvider, TunnelSection};

#[derive(Debug)]
pub struct Tunnel {
    provider: TunnelProvider,
    public_url: String,
    log: PathBuf,
    child: Option<Child>,
    origin: Option<SocketAddr>,
}

impl Tunnel {
    pub fn new(section: &TunnelSection, state_dir: &Path) -> Tunnel {
        Tunnel {
            provider: section.provider,
            public_url: section.public_url.clone().unwrap_or_default(),
            log: state_dir.join("tunnel.log"),
            child: None,
            origin: None,
        }
    }

    pub fn public_url(&self) -> &str {
        &self.public_url
    }

    /// Starts cloudflared towards `origin` unless it already runs towards it.
    pub fn ensure(&mut self, origin: SocketAddr) -> Result<()> {
        if self.provider == TunnelProvider::None {
            return Ok(());
        }
        if let Some(child) = self.child.as_mut() {
            match child.try_wait() {
                Ok(None) if self.origin == Some(origin) => return Ok(()),
                Ok(None) => self.stop(),
                Ok(Some(status)) => {
                    oplog::error(
                        Category::Public,
                        &format!(
                            "cloudflared exited with {status}; see {}",
                            self.log.display()
                        ),
                    );
                    self.child = None;
                }
                Err(e) => return Err(AceError::Tunnel(format!("cloudflared: {e}"))),
            }
        }
        if std::env::var("TUNNEL_TOKEN")
            .map(|t| t.is_empty())
            .unwrap_or(true)
        {
            return Err(AceError::Tunnel(
                "TUNNEL_TOKEN is not set; the tunnel cannot be opened".to_owned(),
            ));
        }
        let log = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log)
            .map_err(|e| AceError::io("open", &self.log, e))?;
        let log_err = log
            .try_clone()
            .map_err(|e| AceError::io("open", &self.log, e))?;
        let child = Command::new("cloudflared")
            .args(["tunnel", "--no-autoupdate", "run", "--url"])
            .arg(format!("http://{origin}"))
            .stdin(Stdio::null())
            .stdout(Stdio::from(log))
            .stderr(Stdio::from(log_err))
            .spawn()
            .map_err(|e| {
                AceError::Tunnel(format!("cannot start cloudflared (is it installed?): {e}"))
            })?;
        oplog::info(
            Category::Public,
            &format!(
                "cloudflared started pid={} origin=http://{origin} public={}",
                child.id(),
                self.public_url
            ),
        );
        self.child = Some(child);
        self.origin = Some(origin);
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
            oplog::info(
                Category::Public,
                "cloudflared stopped: the public endpoint is offline",
            );
        }
        self.origin = None;
    }

    pub fn running(&mut self) -> bool {
        self.child
            .as_mut()
            .is_some_and(|c| matches!(c.try_wait(), Ok(None)))
    }
}

impl Drop for Tunnel {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Checks from this host that the public URL reaches a node of the expected chain that is
/// at least at `local_height`, and that both agree on the block at that height.
pub fn verify_public(
    public_url: &str,
    chain_id: u32,
    network: &str,
    local_height: Option<u64>,
) -> Result<rpc::NetworkStatus> {
    if !public_url.starts_with("https://") {
        return Err(AceError::Tunnel(format!(
            "{public_url} is not an https URL"
        )));
    }
    let url = format!(
        "{}{}",
        public_url.trim_end_matches('/'),
        crate::nodecfg::JSON_RPC_PATH
    );
    let timeout = Duration::from_secs(15);
    let status = rpc::status_at(&url, timeout)
        .map_err(|e| AceError::Tunnel(format!("public check: {e}")))?;
    rpc::check_identity(&status, network, chain_id).map_err(|e| AceError::Tunnel(e.to_string()))?;
    if let Some(local) = local_height
        && status.finalized_height < local
    {
        return Err(AceError::Tunnel(format!(
            "the public endpoint is at height {} behind this node's {local}; it reaches a different node",
            status.finalized_height
        )));
    }
    Ok(status)
}

/// Compares one block through both routes: same chain, same history.
pub fn same_history(local_url: &str, public_url: &str, height: u64) -> Result<()> {
    let timeout = Duration::from_secs(15);
    let public = format!(
        "{}{}",
        public_url.trim_end_matches('/'),
        crate::nodecfg::JSON_RPC_PATH
    );
    let a = rpc::block_at(local_url, height, timeout)?;
    let b = rpc::block_at(&public, height, timeout).map_err(|e| AceError::Tunnel(e.to_string()))?;
    match (a, b) {
        (Some(a), Some(b)) if a.id == b.id => Ok(()),
        (a, b) => Err(AceError::Tunnel(format!(
            "block {height} differs: local {:?}, public {:?}",
            a.map(|x| x.id),
            b.map(|x| x.id)
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_plain_http_public_url_is_refused() {
        assert!(verify_public("http://rpc.example", 1, "devnet", None).is_err());
    }

    #[test]
    fn an_unreachable_public_endpoint_is_reported_offline() {
        // Nothing listens on port 9 of the loopback address; an https URL to it must fail.
        let error = verify_public("https://127.0.0.1:9", 7771, "devnet", None).unwrap_err();
        assert!(error.to_string().contains("public check"), "{error}");
    }

    #[test]
    fn without_a_token_the_tunnel_does_not_start() {
        if std::env::var("TUNNEL_TOKEN").is_ok() {
            return;
        }
        let section = TunnelSection {
            provider: TunnelProvider::Cloudflared,
            public_url: Some("https://rpc.example".to_owned()),
        };
        let dir = tempfile::tempdir().unwrap();
        let mut tunnel = Tunnel::new(&section, dir.path());
        assert!(tunnel.ensure("127.0.0.1:7781".parse().unwrap()).is_err());
        assert!(!tunnel.running());
    }
}
