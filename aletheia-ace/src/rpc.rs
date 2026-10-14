//! RPC discovery and validation. The listener is never assumed: it comes from the node
//! configuration, is confirmed against the daemon's own start-up line and the host's socket
//! table, and counts as RPC only after a JSON-RPC 2.0 call to the route the daemon registers
//! (`POST /rpc/v1`) returns a well-formed `getNetworkStatus` result for the expected chain.
//!
//! An open port proves nothing: the P2P listener accepts TCP too. Method names are those of
//! `aletheia-node/crates/rpc/src/service.rs` (`METHODS`), not Ethereum's.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::time::Duration;

use serde::Serialize;
use serde_json::{Value, json};

use crate::error::{AceError, Result};
use crate::nodecfg::{JSON_RPC_PATH, NodePlan, REST_PREFIX};
use crate::sockets::{self, Holder};

/// The read-only method ACE uses as its health check. It takes no parameters and reports the
/// chain identity and finalized height.
pub const HEALTH_METHOD: &str = "getNetworkStatus";

/// Methods this node offers at the audited commit (`aletheia_rpc::METHODS`).
pub const NODE_METHODS: &[&str] = &[
    "getNetworkStatus",
    "getChainHead",
    "getFinalizedHead",
    "getChainParams",
    "getBlock",
    "getBlockByHeight",
    "getFinalityProof",
    "submitTransaction",
    "simulateTransaction",
    "getTransaction",
    "getReceipt",
    "getAccount",
    "getBalance",
    "getAssets",
    "getMonetarySupply",
    "getValidatorSet",
];

/// Methods that change node state. Exposing them publicly is a policy decision recorded in
/// docs/SECURITY.md; the node has no administrative methods to hide.
pub const STATE_CHANGING_METHODS: &[&str] = &["submitTransaction"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct NetworkStatus {
    pub chain_id: u32,
    pub network: String,
    pub protocol_version: u64,
    pub finalized_height: u64,
    pub finalized_block: String,
    /// As reported. At the audited commit the node always reports `false`
    /// (`crates/node/src/rpc.rs`), so ACE never treats it as evidence of being in sync.
    pub syncing: bool,
    /// As reported; `None` at the audited commit (peer counts are not implemented).
    pub peers: Option<u64>,
}

/// Where to connect to reach a listener bound to `listen` (a wildcard bind is reached on
/// loopback).
pub fn connect_address(listen: SocketAddr) -> SocketAddr {
    match listen.ip() {
        IpAddr::V4(ip) if ip.is_unspecified() => {
            SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), listen.port())
        }
        IpAddr::V6(ip) if ip.is_unspecified() => {
            SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), listen.port())
        }
        _ => listen,
    }
}

pub fn url_for(address: SocketAddr, path: &str) -> String {
    format!("http://{address}{path}")
}

fn agent(timeout: Duration) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(timeout)
        .timeout(timeout)
        .redirects(0)
        .build()
}

/// Validates a `getNetworkStatus` response body against the request id.
pub fn parse_status(body: &str, id: u64) -> Result<NetworkStatus> {
    let value: Value = serde_json::from_str(body)
        .map_err(|e| AceError::Rpc(format!("response is not JSON: {e}")))?;
    let object = value
        .as_object()
        .ok_or_else(|| AceError::Rpc("response is not a JSON object".to_owned()))?;
    if object.get("jsonrpc").and_then(Value::as_str) != Some("2.0") {
        return Err(AceError::Rpc(
            "response lacks \"jsonrpc\": \"2.0\"".to_owned(),
        ));
    }
    if object.get("id").and_then(Value::as_u64) != Some(id) {
        return Err(AceError::Rpc(format!(
            "response id does not match request id {id}"
        )));
    }
    if let Some(error) = object.get("error") {
        return Err(AceError::Rpc(format!(
            "{HEALTH_METHOD} returned an error: {error}"
        )));
    }
    let result = object
        .get("result")
        .and_then(Value::as_object)
        .ok_or_else(|| AceError::Rpc("response has no result object".to_owned()))?;
    let field = |name: &str| {
        result
            .get(name)
            .ok_or_else(|| AceError::Rpc(format!("result lacks \"{name}\"")))
    };
    let uint = |name: &str| -> Result<u64> {
        field(name)?
            .as_u64()
            .ok_or_else(|| AceError::Rpc(format!("result \"{name}\" is not a whole number")))
    };
    let chain_id = u32::try_from(uint("chainId")?)
        .map_err(|_| AceError::Rpc("result \"chainId\" exceeds 32 bits".to_owned()))?;
    let network = field("network")?
        .as_str()
        .ok_or_else(|| AceError::Rpc("result \"network\" is not a string".to_owned()))?
        .to_owned();
    let finalized_block = field("finalizedBlock")?
        .as_str()
        .ok_or_else(|| AceError::Rpc("result \"finalizedBlock\" is not a string".to_owned()))?
        .to_owned();
    if !finalized_block.starts_with("AL:B") {
        return Err(AceError::Rpc(format!(
            "result \"finalizedBlock\" is not an AL:B block id: {finalized_block}"
        )));
    }
    let syncing = field("syncing")?
        .as_bool()
        .ok_or_else(|| AceError::Rpc("result \"syncing\" is not a boolean".to_owned()))?;
    let peers =
        match result.get("peers") {
            None | Some(Value::Null) => None,
            Some(v) => Some(v.as_u64().ok_or_else(|| {
                AceError::Rpc("result \"peers\" is not a whole number".to_owned())
            })?),
        };
    Ok(NetworkStatus {
        chain_id,
        network,
        protocol_version: uint("protocolVersion")?,
        finalized_height: uint("finalizedHeight")?,
        finalized_block,
        syncing,
        peers,
    })
}

/// One JSON-RPC call to `url`. Returns the raw body of a 200 response.
pub fn call(url: &str, method: &str, params: Value, id: u64, timeout: Duration) -> Result<String> {
    let request = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
    match agent(timeout)
        .post(url)
        .set("Content-Type", "application/json")
        .send_string(&request.to_string())
    {
        Ok(response) => response
            .into_string()
            .map_err(|e| AceError::Rpc(format!("{url}: reading the response failed: {e}"))),
        Err(ureq::Error::Status(429, _)) => Err(AceError::Rpc(format!(
            "{url}: rate limited (HTTP 429); the node's per-IP budget is exhausted"
        ))),
        Err(ureq::Error::Status(code, _)) => Err(AceError::Rpc(format!(
            "{url}: HTTP {code}; this is not the StableChain JSON-RPC route"
        ))),
        Err(ureq::Error::Transport(t)) => Err(AceError::Rpc(format!("{url}: {t}"))),
    }
}

/// Calls the health method at `url` and validates the answer.
pub fn status_at(url: &str, timeout: Duration) -> Result<NetworkStatus> {
    let id = 1;
    let body = call(url, HEALTH_METHOD, json!({}), id, timeout)?;
    parse_status(&body, id)
}

/// A finalized block as `getBlockByHeight` summarizes it (`crates/rpc/src/encode.rs`
/// `block_summary`): the fields ACE uses to tie a checkpoint to the running chain.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BlockSummary {
    pub id: String,
    pub height: u64,
    /// Unprefixed lowercase base16.
    pub state_root: String,
}

/// JSON-RPC code the node uses for "no finalized block there" (`RpcError::not_found`).
const NOT_FOUND: i64 = -32002;

pub fn parse_block(body: &str, height: u64) -> Result<Option<BlockSummary>> {
    let value: Value = serde_json::from_str(body)
        .map_err(|e| AceError::Rpc(format!("getBlockByHeight: response is not JSON: {e}")))?;
    if let Some(error) = value.get("error") {
        if error.get("code").and_then(Value::as_i64) == Some(NOT_FOUND) {
            return Ok(None);
        }
        return Err(AceError::Rpc(format!("getBlockByHeight {height}: {error}")));
    }
    let result = value
        .get("result")
        .ok_or_else(|| AceError::Rpc("getBlockByHeight: no result".to_owned()))?;
    let text = |name: &str| {
        result
            .get(name)
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| AceError::Rpc(format!("getBlockByHeight: result lacks \"{name}\"")))
    };
    let summary = BlockSummary {
        id: text("id")?,
        height: result
            .get("height")
            .and_then(Value::as_u64)
            .ok_or_else(|| AceError::Rpc("getBlockByHeight: result lacks \"height\"".to_owned()))?,
        state_root: text("stateRoot")?,
    };
    if summary.height != height || !summary.id.starts_with("AL:B") {
        return Err(AceError::Rpc(format!(
            "getBlockByHeight {height} answered block {} at height {}",
            summary.id, summary.height
        )));
    }
    Ok(Some(summary))
}

/// The finalized block at `height`; `None` if the node does not have it.
pub fn block_at(url: &str, height: u64, timeout: Duration) -> Result<Option<BlockSummary>> {
    let body = call(
        url,
        "getBlockByHeight",
        json!({ "height": height }),
        2,
        timeout,
    )?;
    parse_block(&body, height)
}

/// Checks a status against what the deployment expects.
pub fn check_identity(status: &NetworkStatus, network: &str, chain_id: u32) -> Result<()> {
    if status.chain_id != chain_id || status.network != network {
        return Err(AceError::Rpc(format!(
            "the RPC answers for chain {} on {}, the deployment expects chain {chain_id} on {network}",
            status.chain_id, status.network
        )));
    }
    Ok(())
}

/// What the daemon's start-up lines say (aletheiad `oplog` format at the audited commit).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct LogFacts {
    pub network: Option<String>,
    pub chain_id: Option<u32>,
    pub genesis_id: Option<String>,
    pub rpc_listen: Option<SocketAddr>,
    pub rpc_routes_announced: bool,
    pub p2p_listen: Option<SocketAddr>,
    pub resumed_height: Option<u64>,
    pub stopped_cleanly_height: Option<u64>,
    pub stopped_cleanly_state_root: Option<String>,
}

fn key_value<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let needle = format!("{key}=");
    line.split_whitespace()
        .find_map(|w| w.strip_prefix(needle.as_str()))
}

/// Reads the facts from the daemon's log. Later lines win, so after a restart the facts
/// describe the latest run.
pub fn log_facts(log: &str) -> LogFacts {
    let mut facts = LogFacts::default();
    for line in log.lines() {
        if line.contains("aletheiad info configuration loaded ") {
            facts.network = key_value(line, "network").map(str::to_owned);
            facts.chain_id = key_value(line, "chain_id").and_then(|v| v.parse().ok());
            facts.genesis_id = key_value(line, "genesis_id").map(str::to_owned);
            // A new run: forget the previous run's listeners and stop.
            facts.rpc_listen = None;
            facts.rpc_routes_announced = false;
            facts.p2p_listen = None;
            facts.resumed_height = None;
            facts.stopped_cleanly_height = None;
            facts.stopped_cleanly_state_root = None;
        } else if let Some(rest) = line.strip_prefix("aletheiad info rpc listening on ") {
            facts.rpc_listen = rest.split_whitespace().next().and_then(|a| a.parse().ok());
            facts.rpc_routes_announced =
                rest.contains(&format!("JSON-RPC {JSON_RPC_PATH}")) && rest.contains(REST_PREFIX);
        } else if line.starts_with("aletheiad info following ") {
            facts.p2p_listen = key_value(line, "listen").and_then(|a| a.parse().ok());
            facts.resumed_height = key_value(line, "finalized_height").and_then(|h| h.parse().ok());
        } else if line.starts_with("aletheiad info stopped cleanly finalized_height=") {
            facts.stopped_cleanly_height =
                key_value(line, "finalized_height").and_then(|h| h.parse().ok());
            facts.stopped_cleanly_state_root = key_value(line, "state_root").map(str::to_owned);
        }
    }
    facts
}

#[derive(Debug, Clone, Serialize)]
pub struct RpcReport {
    pub enabled: bool,
    pub configured_listen: Option<SocketAddr>,
    pub effective_listen: Option<SocketAddr>,
    pub json_rpc_url: Option<String>,
    pub rest_prefix: Option<&'static str>,
    pub loopback_only: Option<bool>,
    pub announced_by_daemon: bool,
    pub socket_holder: Option<Holder>,
    pub p2p_listen: SocketAddr,
    pub p2p_effective: Option<SocketAddr>,
    pub p2p_is_not_rpc: Option<bool>,
    pub status: Option<NetworkStatus>,
    pub problem: Option<String>,
}

impl RpcReport {
    /// RPC is usable: enabled, served by the node, and answering for the expected chain.
    pub fn healthy(&self) -> bool {
        self.enabled && self.status.is_some() && self.problem.is_none()
    }
}

/// Discovers and validates the RPC of a node started with `plan`. `pid` is the daemon's
/// process id when ACE knows it; `log` its log so far.
pub fn inspect(
    plan: &NodePlan,
    pid: Option<u32>,
    log: &str,
    network: &str,
    chain_id: u32,
    timeout: Duration,
) -> RpcReport {
    let facts = log_facts(log);
    let mut report = RpcReport {
        enabled: plan.rpc.is_some(),
        configured_listen: plan.rpc.as_ref().map(|r| r.listen),
        effective_listen: None,
        json_rpc_url: None,
        rest_prefix: plan.rpc.as_ref().map(|r| r.rest_prefix),
        loopback_only: plan.rpc.as_ref().map(|r| r.loopback_only),
        announced_by_daemon: facts.rpc_listen.is_some() && facts.rpc_routes_announced,
        socket_holder: None,
        p2p_listen: plan.p2p_listen,
        p2p_effective: facts.p2p_listen,
        p2p_is_not_rpc: None,
        status: None,
        problem: None,
    };
    let Some(rpc) = &plan.rpc else {
        report.problem = Some(
            "RPC is disabled: the node configuration has no [rpc] section, so there is nothing to discover or expose".to_owned(),
        );
        return report;
    };
    // Port 0 means "any": only the daemon's own line says which port it got.
    let effective = match (rpc.listen.port(), facts.rpc_listen) {
        (0, Some(bound)) => bound,
        (0, None) => {
            report.problem = Some(
                "[rpc] listen uses port 0 and the daemon has not announced its port yet".to_owned(),
            );
            return report;
        }
        (_, Some(bound)) if bound != rpc.listen => {
            report.problem = Some(format!(
                "the daemon announced RPC on {bound} but the configuration says {}; refusing to guess",
                rpc.listen
            ));
            return report;
        }
        _ => rpc.listen,
    };
    report.effective_listen = Some(effective);
    let holder = sockets::holder(pid, effective);
    report.socket_holder = Some(holder.clone());
    if holder == Holder::Other && pid.is_some() {
        report.problem = Some(format!(
            "another process, not the node, is listening on {effective}"
        ));
        return report;
    }
    if holder == Holder::Nobody {
        report.problem = Some(format!("nothing is listening on {effective}"));
        return report;
    }
    let url = url_for(connect_address(effective), rpc.json_rpc_path);
    report.json_rpc_url = Some(url.clone());
    match status_at(&url, timeout).and_then(|s| check_identity(&s, network, chain_id).map(|()| s)) {
        Ok(status) => report.status = Some(status),
        Err(e) => report.problem = Some(e.to_string()),
    }
    // The P2P listener must not answer as RPC (it speaks TLS); if it did, the two would be
    // confused by anything that only looks at ports.
    let p2p = facts.p2p_listen.unwrap_or(plan.p2p_listen);
    if p2p.port() != 0 {
        let p2p_url = url_for(connect_address(p2p), JSON_RPC_PATH);
        report.p2p_is_not_rpc = Some(status_at(&p2p_url, Duration::from_secs(2)).is_err());
    }
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    // As the node answered at the audited commit.
    const REAL: &str = r#"{"id":1,"jsonrpc":"2.0","result":{"chainId":7771,"finalizedBlock":"AL:B6hsp2k39refk7w750hu9jymysv5eltle5t8lv00794pekruez2yq0mrvke","finalizedHeight":8,"network":"devnet","peers":null,"protocolVersion":1,"syncing":false}}"#;

    #[test]
    fn a_real_response_is_accepted() {
        let s = parse_status(REAL, 1).unwrap();
        assert_eq!((s.chain_id, s.finalized_height, s.peers), (7771, 8, None));
        assert!(check_identity(&s, "devnet", 7771).is_ok());
        assert!(check_identity(&s, "devnet", 1).is_err());
        assert!(check_identity(&s, "mainnet", 7771).is_err());
    }

    #[test]
    fn malformed_and_foreign_responses_are_refused() {
        assert!(parse_status(REAL, 2).is_err(), "id mismatch");
        assert!(parse_status("not json", 1).is_err());
        assert!(
            parse_status(r#"{"jsonrpc":"2.0","id":1,"result":"0x10"}"#, 1).is_err(),
            "ethereum-shaped"
        );
        let error =
            r#"{"error":{"code":-32601,"message":"Method not found"},"id":1,"jsonrpc":"2.0"}"#;
        assert!(parse_status(error, 1).is_err());
        let no_height = REAL.replace("\"finalizedHeight\":8,", "");
        assert!(parse_status(&no_height, 1).is_err());
        let bad_block = REAL.replace("AL:B6hsp", "0xabcd");
        assert!(parse_status(&bad_block, 1).is_err());
    }

    #[test]
    fn daemon_lines_are_read_and_a_restart_resets_them() {
        let log = "aletheiad info configuration loaded path=node.toml network=devnet chain_id=7771 genesis_id=9164487f5f211839f5796c6b2193e17d289a285d9eebce6bbc592f26a4c7719e\n\
aletheiad info rpc listening on 127.0.0.1:27781 (REST /api/v1, JSON-RPC /rpc/v1)\n\
aletheiad info following data_dir=./fresh listen=127.0.0.1:27771 finalized_height=36 hash=AL:B5 state_root=cd0e\n\
aletheiad info stopped cleanly finalized_height=42 state_root=cd0e\n";
        let f = log_facts(log);
        assert_eq!(f.chain_id, Some(7771));
        assert_eq!(f.rpc_listen, Some("127.0.0.1:27781".parse().unwrap()));
        assert!(f.rpc_routes_announced);
        assert_eq!(f.p2p_listen, Some("127.0.0.1:27771".parse().unwrap()));
        assert_eq!(
            (f.resumed_height, f.stopped_cleanly_height),
            (Some(36), Some(42))
        );
        let restarted = format!(
            "{log}aletheiad info configuration loaded path=x network=devnet chain_id=7771 genesis_id=ab\n"
        );
        let f = log_facts(&restarted);
        assert_eq!((f.rpc_listen, f.stopped_cleanly_height), (None, None));
    }

    #[test]
    fn wildcard_binds_are_reached_on_loopback() {
        assert_eq!(
            connect_address("0.0.0.0:7781".parse().unwrap()),
            "127.0.0.1:7781".parse().unwrap()
        );
        assert_eq!(
            connect_address("[::]:7781".parse().unwrap()),
            "[::1]:7781".parse().unwrap()
        );
        assert_eq!(
            connect_address("10.0.0.2:7781".parse().unwrap()),
            "10.0.0.2:7781".parse().unwrap()
        );
    }

    #[test]
    fn block_summaries_and_absent_blocks_are_told_apart() {
        let found = r#"{"jsonrpc":"2.0","id":2,"result":{"id":"AL:Bxyz","height":3,"stateRoot":"cd0e","parent":"AL:Bw"}}"#;
        let b = parse_block(found, 3).unwrap().unwrap();
        assert_eq!((b.id.as_str(), b.state_root.as_str()), ("AL:Bxyz", "cd0e"));
        assert!(parse_block(found, 4).is_err(), "height mismatch");
        let absent = r#"{"jsonrpc":"2.0","id":2,"error":{"code":-32002,"message":"Not found"}}"#;
        assert_eq!(parse_block(absent, 9).unwrap(), None);
        let other =
            r#"{"jsonrpc":"2.0","id":2,"error":{"code":-32602,"message":"Invalid params"}}"#;
        assert!(parse_block(other, 9).is_err());
    }
}
