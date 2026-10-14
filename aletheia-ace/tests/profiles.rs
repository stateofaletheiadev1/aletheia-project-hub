//! The deployment profiles shipped in deploy/ must load and validate.

#![allow(clippy::unwrap_used)]

use std::path::Path;

use ace::settings::{Deployment, PersistenceMode, Role};

fn load(path: &str) -> Deployment {
    Deployment::load(&Path::new(env!("CARGO_MANIFEST_DIR")).join(path)).unwrap()
}

#[test]
fn the_devnet_profile_is_valid_and_pinned() {
    let d = load("deploy/devnet/ace.toml");
    assert_eq!(d.config.node.role, Role::DevnetProducer);
    assert_eq!(d.config.persistence.mode, PersistenceMode::Ephemeral);
    assert!(d.config.node.expected_genesis_id.is_some());
    assert!(d.node_working_dir().ends_with("work/src/aletheia-node"));
    let node = std::fs::read_to_string(d.node_config()).unwrap();
    assert!(
        node.contains("data_dir = \"./"),
        "one-component data_dir fails in aletheiad"
    );
    assert!(!node.contains("8545"));
}

#[test]
fn the_persistent_host_profile_is_valid_and_absolute() {
    let d = load("deploy/persistent-host/ace.toml");
    assert_eq!(d.config.persistence.mode, PersistenceMode::PersistentHost);
    assert_eq!(d.node_config(), Path::new("/etc/ace/node.toml"));
    assert_eq!(d.state_dir(), Path::new("/var/lib/ace/run"));
    let devnet = load("deploy/devnet/ace.toml");
    assert_eq!(
        d.config.source.commit, devnet.config.source.commit,
        "profiles pin the same commit"
    );
}
