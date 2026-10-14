//! The sandboxed executor (spec Section 28.1) against the real worker binary: identical
//! results to in-process execution, recovery from a crashed worker without doubled effects,
//! and fail-stop when a worker hangs or talks nonsense twice.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic
)]

use std::collections::BTreeMap;
use std::time::Duration;

use aletheia_execution::runner::{ContractRunner, InProcess};
use aletheia_executor::{ExecutorConfig, ProcessRunner};
use aletheia_vm::{ChainInfo, Host, Package, Trap, Value};

#[derive(Debug, Default, Clone, PartialEq, Eq)]
struct State {
    storage: BTreeMap<(u16, Vec<u8>), Vec<u8>>,
    transfers: Vec<(u32, u128, [u8; 20])>,
    events: Vec<(u16, Vec<u8>)>,
}

/// A host with attempt snapshots, like the node's overlay host.
#[derive(Debug, Default)]
struct MockHost {
    state: State,
    snapshot: Option<State>,
}

impl Host for MockHost {
    fn chain(&self) -> ChainInfo {
        ChainInfo {
            height: 3,
            slot: 9,
            epoch: 0,
            protocol_time_ms: 5,
            tx_id: [1; 32],
        }
    }
    fn storage_contains(&mut self, slot: u16, key: &[u8]) -> Result<bool, Trap> {
        Ok(self.state.storage.contains_key(&(slot, key.to_vec())))
    }
    fn storage_read(&mut self, slot: u16, key: &[u8]) -> Result<Option<Vec<u8>>, Trap> {
        Ok(self.state.storage.get(&(slot, key.to_vec())).cloned())
    }
    fn storage_write(&mut self, slot: u16, key: &[u8], value: Option<&[u8]>) -> Result<(), Trap> {
        match value {
            Some(v) => self.state.storage.insert((slot, key.to_vec()), v.to_vec()),
            None => self.state.storage.remove(&(slot, key.to_vec())),
        };
        Ok(())
    }
    fn transfer(&mut self, asset: u32, amount: u128, to: &[u8; 20]) -> Result<(), Trap> {
        self.state.transfers.push((asset, amount, *to));
        Ok(())
    }
    fn emit(&mut self, event: u16, data: Vec<u8>) -> Result<(), Trap> {
        self.state.events.push((event, data));
        Ok(())
    }
    fn verify_ed25519(&self, _: &[u8; 32], _: &[u8; 32], _: &[u8; 64]) -> bool {
        false
    }
    fn begin_attempt(&mut self) {
        self.snapshot = Some(self.state.clone());
    }
    fn commit_attempt(&mut self) {
        self.snapshot = None;
    }
    fn abandon_attempt(&mut self) {
        if let Some(snapshot) = self.snapshot.take() {
            self.state = snapshot;
        }
    }
}

fn escrow() -> (Package, Vec<u8>) {
    let path = format!(
        "{}/../../examples/arno/escrow.arno",
        env!("CARGO_MANIFEST_DIR")
    );
    let file =
        aletheia_arno::SourceFile::new("escrow.arno", std::fs::read_to_string(path).unwrap());
    let bytes = aletheia_arno::compile(&file).unwrap();
    (Package::from_bytes(&bytes).unwrap(), bytes)
}

fn runner(args: &[&str], timeout_ms: u64) -> ProcessRunner {
    ProcessRunner::new(ExecutorConfig {
        program: env!("CARGO_BIN_EXE_aletheia-arno-exec").into(),
        args: args.iter().map(|a| (*a).to_owned()).collect(),
        timeout: Duration::from_millis(timeout_ms),
        pool: 2,
    })
}

fn index(p: &Package, name: &str) -> u8 {
    u8::try_from(
        p.functions
            .iter()
            .position(|f| p.text(f.name) == Some(name))
            .unwrap(),
    )
    .unwrap()
}

/// The escrow lifecycle through a runner; returns each call's result and the final state.
type CallResult = Result<(Option<Value>, u64), (Trap, u64)>;

fn lifecycle(run: &dyn ContractRunner) -> (Vec<CallResult>, State) {
    let (p, bytes) = escrow();
    let (buyer, seller, arbiter) = ([1u8; 20], [2u8; 20], [3u8; 20]);
    let calls: Vec<(&str, Vec<Value>)> = vec![
        (
            "constructor",
            vec![
                Value::Signer(buyer),
                Value::Address(seller),
                Value::Address(arbiter),
                Value::Slot(100),
            ],
        ),
        (
            "fund",
            vec![
                Value::Signer(seller),
                Value::Coins {
                    asset: 1,
                    amount: 9,
                },
            ],
        ),
        (
            "fund",
            vec![
                Value::Signer(buyer),
                Value::Coins {
                    asset: 1,
                    amount: 500,
                },
            ],
        ),
        ("release", vec![Value::Signer(arbiter)]),
        ("status", vec![]),
    ];
    let mut host = MockHost::default();
    let mut results = Vec::new();
    for (name, args) in calls {
        let result = run.run(&p, &bytes, index(&p, name), args, &mut host, 1_000_000);
        results.push(
            result
                .map(|o| (o.returned, o.eu_used))
                .map_err(|f| (f.trap, f.eu_used)),
        );
    }
    (results, host.state)
}

#[test]
fn the_sandbox_gives_exactly_the_in_process_results() {
    let sandboxed = runner(&[], 10_000);
    let (a, state_a) = lifecycle(&sandboxed);
    let (b, state_b) = lifecycle(&InProcess);
    assert_eq!(a, b, "results and EU match call for call");
    assert_eq!(state_a, state_b, "storage, transfers and events match");
    assert_eq!(state_a.transfers, vec![(1, 500, [2; 20])]);
    assert!(
        sandboxed.spawned() <= 2,
        "workers are reused: {}",
        sandboxed.spawned()
    );
}

#[test]
fn a_crashed_worker_is_replaced_and_its_attempt_undone() {
    let marker = std::env::temp_dir().join(format!("arno-exec-crash-{}", std::process::id()));
    let _ = std::fs::remove_file(&marker);
    let flaky = runner(
        &["--fault", "crash-first", marker.to_str().unwrap()],
        10_000,
    );
    let (results, state) = lifecycle(&flaky);
    let (expected, expected_state) = lifecycle(&InProcess);
    assert_eq!(results, expected);
    assert_eq!(
        state, expected_state,
        "the failed attempt left nothing behind"
    );
    assert!(flaky.spawned() >= 2, "a fresh worker was started");
    let _ = std::fs::remove_file(&marker);
}

#[test]
fn a_hanging_worker_ends_in_a_fail_stop_after_one_retry() {
    let stuck = runner(&["--fault", "hang"], 300);
    let (p, bytes) = escrow();
    let mut host = MockHost::default();
    let failure = stuck
        .run(&p, &bytes, index(&p, "status"), vec![], &mut host, 1_000)
        .unwrap_err();
    assert!(matches!(failure.trap, Trap::Internal(_)), "{failure:?}");
    assert_eq!(failure.trap.code(), aletheia_core::ErrorCode::VmInternal);
    assert!(failure.trap.code().class() == aletheia_core::ErrorClass::FailStop);
    assert_eq!(stuck.spawned(), 2);
    assert_eq!(host.state, State::default());
}

#[test]
fn a_worker_speaking_nonsense_is_never_believed() {
    let liar = runner(&["--fault", "garbage"], 2_000);
    let (p, bytes) = escrow();
    let mut host = MockHost::default();
    let failure = liar
        .run(&p, &bytes, index(&p, "status"), vec![], &mut host, 1_000)
        .unwrap_err();
    assert!(matches!(failure.trap, Trap::Internal(_)), "{failure:?}");
}

/// On Linux the worker confines itself before its first request: it cannot read files, open
/// sockets or start processes. The debug-only probe tries all three and reports what got
/// through (bit 1 file, 2 socket, 4 process, 8 filesystem rule not enforced by this kernel).
#[cfg(target_os = "linux")]
#[test]
fn the_worker_cannot_reach_files_sockets_or_processes() {
    let status = std::process::Command::new(env!("CARGO_BIN_EXE_aletheia-arno-exec"))
        .args(["--fault", "probe-sandbox"])
        .env_clear()
        .status()
        .unwrap();
    let escaped = status.code().unwrap();
    assert_eq!(
        escaped & 0b0110,
        0,
        "socket or process escaped: {escaped:#06b}"
    );
    if escaped & 0b1000 == 0 {
        assert_eq!(
            escaped & 0b0001,
            0,
            "a file was read under Landlock: {escaped:#06b}"
        );
    }
}
