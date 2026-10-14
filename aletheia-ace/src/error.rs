//! Operational errors. Every failure an operator can meet has its own variant, a message that
//! names what was being done and with what, and a documented exit status (docs/CLI.md).

use std::path::PathBuf;

/// Exit statuses of the `ace` binary. Stable: workflows and scripts branch on them.
pub mod exit {
    pub const OK: u8 = 0;
    /// Anything not classified below (I/O on ACE's own files, internal inconsistencies).
    pub const FAILURE: u8 = 1;
    /// Wrong command line (clap prints the usage).
    pub const USAGE: u8 = 2;
    /// The ACE configuration or the node configuration was refused.
    pub const CONFIG: u8 = 3;
    /// Preflight found the environment unsuitable.
    pub const PREFLIGHT: u8 = 4;
    /// Fetching or verifying the StableChain source failed.
    pub const SOURCE: u8 = 5;
    /// Compilation failed or exceeded its budget.
    pub const BUILD: u8 = 6;
    /// A binary or artifact did not match its recorded hash or expected behaviour.
    pub const VERIFY: u8 = 7;
    /// The node process failed to start, stopped unexpectedly, or needs an operator.
    pub const NODE: u8 = 8;
    /// The RPC listener is disabled, unreachable, or does not speak the expected protocol.
    pub const RPC: u8 = 9;
    /// A checkpoint failed validation, or restoring it was refused.
    pub const SNAPSHOT: u8 = 10;
    /// The requested operation needs durable storage and none is available.
    pub const PERSISTENCE: u8 = 11;
    /// The public tunnel could not be established or verified.
    pub const TUNNEL: u8 = 12;
    /// Another ACE supervisor already manages this node.
    pub const BUSY: u8 = 13;
}

#[derive(Debug, thiserror::Error)]
pub enum AceError {
    #[error("cannot {action} {}: {source}", path.display())]
    Io {
        action: &'static str,
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("configuration refused: {0}")]
    Config(String),
    #[error("node configuration refused: {0}")]
    NodeConfig(String),
    #[error("preflight: {0}")]
    Preflight(String),
    #[error("source: {0}")]
    Source(String),
    #[error("build: {0}")]
    Build(String),
    #[error("verification failed: {0}")]
    Verify(String),
    #[error("node: {0}")]
    Node(String),
    #[error("rpc: {0}")]
    Rpc(String),
    #[error("checkpoint: {0}")]
    Snapshot(String),
    #[error("persistence unavailable: {0}")]
    Persistence(String),
    #[error("tunnel: {0}")]
    Tunnel(String),
    #[error("busy: {0}")]
    Busy(String),
    #[error("{0}")]
    Other(String),
}

impl AceError {
    pub fn io(action: &'static str, path: impl Into<PathBuf>, source: std::io::Error) -> AceError {
        AceError::Io {
            action,
            path: path.into(),
            source,
        }
    }

    pub fn exit_code(&self) -> u8 {
        match self {
            AceError::Io { .. } | AceError::Other(_) => exit::FAILURE,
            AceError::Config(_) | AceError::NodeConfig(_) => exit::CONFIG,
            AceError::Preflight(_) => exit::PREFLIGHT,
            AceError::Source(_) => exit::SOURCE,
            AceError::Build(_) => exit::BUILD,
            AceError::Verify(_) => exit::VERIFY,
            AceError::Node(_) => exit::NODE,
            AceError::Rpc(_) => exit::RPC,
            AceError::Snapshot(_) => exit::SNAPSHOT,
            AceError::Persistence(_) => exit::PERSISTENCE,
            AceError::Tunnel(_) => exit::TUNNEL,
            AceError::Busy(_) => exit::BUSY,
        }
    }
}

pub type Result<T> = std::result::Result<T, AceError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_class_has_a_distinct_exit_status() {
        let errors = [
            AceError::Config(String::new()),
            AceError::Preflight(String::new()),
            AceError::Source(String::new()),
            AceError::Build(String::new()),
            AceError::Verify(String::new()),
            AceError::Node(String::new()),
            AceError::Rpc(String::new()),
            AceError::Snapshot(String::new()),
            AceError::Persistence(String::new()),
            AceError::Tunnel(String::new()),
            AceError::Busy(String::new()),
            AceError::Other(String::new()),
        ];
        let mut codes: Vec<u8> = errors.iter().map(AceError::exit_code).collect();
        codes.sort_unstable();
        codes.dedup();
        assert_eq!(codes.len(), errors.len());
        assert!(!codes.contains(&exit::OK));
        assert!(!codes.contains(&exit::USAGE));
    }
}
