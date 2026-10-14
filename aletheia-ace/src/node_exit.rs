//! What an `aletheiad` exit means and whether restarting can help.
//!
//! The statuses are those of `aletheia-node/apps/aletheiad/src/main.rs` and
//! `docs/operations/exit-codes.md` at the audited commit: 0 clean stop, 64 usage, 70 fail-stop,
//! 75 protocol upgrade required, 78 configuration. One refinement comes from the source rather
//! than the table: a P2P listener that cannot bind is reported through the fail-stop path
//! (`crates/p2p/src/network.rs`, error `P2pConnectionLimit`, "listen on …"), so a status of 70
//! whose log names a failed listen is an environment problem that a restart only repeats.

use serde::{Deserialize, Serialize};

pub const CLEAN_STOP: i32 = 0;
pub const USAGE: i32 = 64;
pub const FAIL_STOP: i32 = 70;
pub const UPGRADE_REQUIRED: i32 = 75;
pub const CONFIG: i32 = 78;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum NodeExit {
    CleanStop,
    Usage,
    /// Recovery runs at the next start; restarting is the documented remedy.
    FailStop {
        detail: Option<String>,
    },
    /// A listener could not bind: another process holds the port.
    PortUnavailable {
        detail: String,
    },
    /// The data directory belongs to a different chain. Never "fixed" by ACE.
    WrongChain {
        detail: String,
    },
    /// Another process holds the data directory lock.
    DataDirLocked {
        detail: String,
    },
    UpgradeRequired {
        detail: Option<String>,
    },
    Config {
        detail: Option<String>,
    },
    Signal {
        signal: i32,
    },
    Unknown {
        code: i32,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RestartAdvice {
    /// The node may be restarted (with backoff and resource checks).
    Restart,
    /// Restarting cannot help; an operator must act.
    Operator,
    /// The node stopped because it was asked to.
    None,
}

/// The last line of the log that carries a reason, for the exit report.
fn last_matching(log_tail: &str, needles: &[&str]) -> Option<String> {
    log_tail
        .lines()
        .rev()
        .find(|l| needles.iter().any(|n| l.contains(n)))
        .map(|l| l.trim().to_owned())
}

/// Classifies an exit. `code` is `None` when the process died from a signal (`signal`).
pub fn classify(code: Option<i32>, signal: Option<i32>, log_tail: &str) -> NodeExit {
    match (code, signal) {
        (Some(CLEAN_STOP), _) => NodeExit::CleanStop,
        (Some(USAGE), _) => NodeExit::Usage,
        (Some(FAIL_STOP), _) => {
            let detail = last_matching(log_tail, &["fail-stop:"]);
            let text = detail.clone().unwrap_or_default();
            if text.contains("listen on ") {
                NodeExit::PortUnavailable { detail: text }
            } else if text.contains("STO_DATA_DIR_WRONG_CHAIN") {
                NodeExit::WrongChain { detail: text }
            } else if text.contains("STO_DATA_DIR_LOCKED")
                // A second daemon fails on RocksDB's own lock before it reaches the data
                // directory lock, and that is reported as plain STO_IO.
                || (text.contains("RocksDB open") && text.contains("lock file"))
            {
                NodeExit::DataDirLocked { detail: text }
            } else {
                NodeExit::FailStop { detail }
            }
        }
        (Some(UPGRADE_REQUIRED), _) => NodeExit::UpgradeRequired {
            detail: last_matching(log_tail, &["stopped cleanly:", "protocol version"]),
        },
        (Some(CONFIG), _) => {
            let detail = last_matching(
                log_tail,
                &["configuration refused:", "cannot listen for rpc"],
            );
            match detail {
                Some(text) if text.contains("cannot listen for rpc") => {
                    NodeExit::PortUnavailable { detail: text }
                }
                detail => NodeExit::Config { detail },
            }
        }
        (Some(code), _) => NodeExit::Unknown { code },
        (None, Some(signal)) => NodeExit::Signal { signal },
        (None, None) => NodeExit::Unknown { code: -1 },
    }
}

impl NodeExit {
    /// `requested`: ACE itself asked the node to stop.
    pub fn advice(&self, requested: bool) -> RestartAdvice {
        match self {
            NodeExit::CleanStop if requested => RestartAdvice::None,
            // A clean stop nobody asked for: someone signalled the node directly.
            NodeExit::CleanStop => RestartAdvice::Operator,
            NodeExit::FailStop { .. } => RestartAdvice::Restart,
            NodeExit::Signal { .. } if requested => RestartAdvice::None,
            // Killed from outside (OOM killer, kill -9): recovery runs at start-up.
            NodeExit::Signal { .. } => RestartAdvice::Restart,
            NodeExit::Usage
            | NodeExit::PortUnavailable { .. }
            | NodeExit::WrongChain { .. }
            | NodeExit::DataDirLocked { .. }
            | NodeExit::UpgradeRequired { .. }
            | NodeExit::Config { .. }
            | NodeExit::Unknown { .. } => RestartAdvice::Operator,
        }
    }

    pub fn summary(&self) -> String {
        match self {
            NodeExit::CleanStop => "stopped cleanly (exit 0)".to_owned(),
            NodeExit::Usage => {
                "usage error (exit 64): the command line ACE built was refused".to_owned()
            }
            NodeExit::FailStop { detail } => format!(
                "fail-stop (exit 70): {}",
                detail.as_deref().unwrap_or("no fail-stop line in the log")
            ),
            NodeExit::PortUnavailable { detail } => {
                format!("a listener could not bind; another process holds the port: {detail}")
            }
            NodeExit::WrongChain { detail } => format!(
                "the data directory belongs to another chain; ACE never re-initializes it: {detail}"
            ),
            NodeExit::DataDirLocked { detail } => {
                format!("the data directory is locked by another process: {detail}")
            }
            NodeExit::UpgradeRequired { detail } => format!(
                "protocol upgrade required (exit 75); install a release supporting it: {}",
                detail.as_deref().unwrap_or("see the node log")
            ),
            NodeExit::Config { detail } => format!(
                "configuration refused (exit 78): {}",
                detail.as_deref().unwrap_or("see the node log")
            ),
            NodeExit::Signal { signal } => format!("killed by signal {signal}"),
            NodeExit::Unknown { code } => format!("undocumented exit status {code}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documented_statuses_are_classified() {
        assert_eq!(classify(Some(0), None, ""), NodeExit::CleanStop);
        assert_eq!(classify(Some(64), None, ""), NodeExit::Usage);
        assert!(matches!(
            classify(Some(75), None, ""),
            NodeExit::UpgradeRequired { .. }
        ));
        assert!(matches!(
            classify(Some(78), None, ""),
            NodeExit::Config { .. }
        ));
        assert_eq!(classify(None, Some(9), ""), NodeExit::Signal { signal: 9 });
        assert_eq!(classify(Some(3), None, ""), NodeExit::Unknown { code: 3 });
    }

    #[test]
    fn a_p2p_bind_failure_is_not_a_restartable_fail_stop() {
        let log = "aletheiad info configuration loaded\naletheiad error fail-stop: P2P_CONNECTION_LIMIT (8009): listen on 127.0.0.1:7771: Address already in use (os error 98) - recovery runs on restart\n";
        let exit = classify(Some(70), None, log);
        assert!(matches!(exit, NodeExit::PortUnavailable { .. }), "{exit:?}");
        assert_eq!(exit.advice(false), RestartAdvice::Operator);
    }

    #[test]
    fn an_rpc_bind_failure_is_a_port_problem() {
        let log = "aletheiad error cannot listen for rpc on 127.0.0.1:7781: Address already in use (os error 98)\n";
        assert!(matches!(
            classify(Some(78), None, log),
            NodeExit::PortUnavailable { .. }
        ));
    }

    #[test]
    fn an_ordinary_fail_stop_is_restarted_and_other_exits_are_not() {
        let log = "aletheiad error fail-stop: STO_CORRUPT (1): checksum\n";
        assert_eq!(
            classify(Some(70), None, log).advice(false),
            RestartAdvice::Restart
        );
        assert_eq!(
            classify(Some(75), None, "").advice(false),
            RestartAdvice::Operator
        );
        assert_eq!(
            classify(Some(78), None, "").advice(false),
            RestartAdvice::Operator
        );
        assert_eq!(
            classify(Some(64), None, "").advice(false),
            RestartAdvice::Operator
        );
        assert_eq!(
            classify(None, Some(9), "").advice(false),
            RestartAdvice::Restart
        );
        assert_eq!(
            classify(None, Some(15), "").advice(true),
            RestartAdvice::None
        );
        assert_eq!(
            classify(Some(0), None, "").advice(true),
            RestartAdvice::None
        );
        assert_eq!(
            classify(Some(0), None, "").advice(false),
            RestartAdvice::Operator
        );
    }

    #[test]
    fn wrong_chain_and_lock_are_operator_problems() {
        // Lines as aletheiad printed them at the audited commit.
        let log = "aletheiad error fail-stop: STO_DATA_DIR_WRONG_CHAIN (7010): data directory is for chain 7771 (devnet, genesis 9164); this node is configured for chain 7771 (devnet, genesis ee6e) - recovery runs on restart\n";
        let exit = classify(Some(70), None, log);
        assert!(matches!(exit, NodeExit::WrongChain { .. }), "{exit:?}");
        assert_eq!(exit.advice(false), RestartAdvice::Operator);
        let log = "aletheiad error fail-stop: STO_IO (7001): RocksDB open ./fresh/state: IO error: While lock file: ./fresh/state/LOCK: Resource temporarily unavailable - recovery runs on restart\n";
        assert!(matches!(
            classify(Some(70), None, log),
            NodeExit::DataDirLocked { .. }
        ));
        let log = "aletheiad error fail-stop: STO_DATA_DIR_LOCKED (7012): /x/LOCK is locked by another process; is aletheiad already running?\n";
        assert!(matches!(
            classify(Some(70), None, log),
            NodeExit::DataDirLocked { .. }
        ));
    }
}
