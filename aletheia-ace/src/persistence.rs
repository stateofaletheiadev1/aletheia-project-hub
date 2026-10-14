//! How long chain data outlives the process, as far as ACE can establish it.
//!
//! ACE cannot prove that a disk is durable; it can prove that some are not. A GitHub-hosted
//! runner is discarded with its job, and tmpfs or ramfs lose everything at reboot. Anything
//! else is durable only if the operator says so (`[persistence] mode = "persistent-host"`),
//! and the report says that it was declared, not measured.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::host::{self, ComputeKind};
use crate::settings::PersistenceMode;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "class", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Persistence {
    /// Chain data lives as long as this host or job and no longer.
    EphemeralMode { reason: String },
    /// The operator declared durable storage and nothing ACE can check contradicts it.
    PersistentDeclared { filesystem: Option<String> },
    /// Durable storage was required and cannot be had here.
    PersistenceUnavailable { reason: String },
}

impl Persistence {
    pub fn is_durable(&self) -> bool {
        matches!(self, Persistence::PersistentDeclared { .. })
    }
}

const VOLATILE_FILESYSTEMS: [&str; 3] = ["tmpfs", "ramfs", "overlay-tmpfs"];

pub fn classify(mode: PersistenceMode, data_dir: &Path) -> Persistence {
    classify_from(
        mode,
        host::compute_kind(),
        data_dir
            .ancestors()
            .find(|p| p.exists())
            .and_then(host::filesystem_type),
    )
}

pub fn classify_from(
    mode: PersistenceMode,
    compute: ComputeKind,
    filesystem: Option<String>,
) -> Persistence {
    let volatile_fs = filesystem
        .as_deref()
        .is_some_and(|fs| VOLATILE_FILESYSTEMS.contains(&fs));
    match mode {
        PersistenceMode::Ephemeral => Persistence::EphemeralMode {
            reason: match compute {
                ComputeKind::GithubHostedRunner => {
                    "GitHub-hosted runner: the disk is discarded when the job ends".to_owned()
                }
                _ => "the deployment declares ephemeral storage".to_owned(),
            },
        },
        PersistenceMode::PersistentHost if compute == ComputeKind::GithubHostedRunner => {
            Persistence::PersistenceUnavailable {
                reason: "persistent-host was requested on a GitHub-hosted runner, whose disk is discarded when the job ends".to_owned(),
            }
        }
        PersistenceMode::PersistentHost if volatile_fs => Persistence::PersistenceUnavailable {
            reason: format!(
                "persistent-host was requested but the data directory is on {}, which does not survive a reboot",
                filesystem.unwrap_or_default()
            ),
        },
        PersistenceMode::PersistentHost => Persistence::PersistentDeclared { filesystem },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_hosted_runner_is_never_durable() {
        let p = classify_from(
            PersistenceMode::PersistentHost,
            ComputeKind::GithubHostedRunner,
            Some("ext4".into()),
        );
        assert!(matches!(p, Persistence::PersistenceUnavailable { .. }));
        let p = classify_from(
            PersistenceMode::Ephemeral,
            ComputeKind::GithubHostedRunner,
            Some("ext4".into()),
        );
        assert!(matches!(p, Persistence::EphemeralMode { .. }));
    }

    #[test]
    fn tmpfs_is_never_durable() {
        let p = classify_from(
            PersistenceMode::PersistentHost,
            ComputeKind::Host,
            Some("tmpfs".into()),
        );
        assert!(!p.is_durable());
    }

    #[test]
    fn a_declared_host_disk_is_reported_as_declared() {
        let p = classify_from(
            PersistenceMode::PersistentHost,
            ComputeKind::Host,
            Some("ext4".into()),
        );
        assert_eq!(
            p,
            Persistence::PersistentDeclared {
                filesystem: Some("ext4".into())
            }
        );
        assert!(p.is_durable());
    }
}
