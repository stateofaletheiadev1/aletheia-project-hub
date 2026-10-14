//! Compiled contracts running on the VM (spec Sections 25-29), against an in-memory host.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::arithmetic_side_effects
)]

use std::collections::BTreeMap;

use aletheia_arno::{SourceFile, compile};
use aletheia_vm::{ChainInfo, Host, Package, Trap, Value, run};

#[derive(Debug, Default, Clone, PartialEq, Eq)]
struct MockHost {
    storage: BTreeMap<(u16, Vec<u8>), Vec<u8>>,
    transfers: Vec<(u32, u128, [u8; 20])>,
    events: Vec<(u16, Vec<u8>)>,
    slot: u64,
}

impl Host for MockHost {
    fn chain(&self) -> ChainInfo {
        ChainInfo {
            height: 10,
            slot: self.slot,
            epoch: 0,
            protocol_time_ms: 1_000,
            tx_id: [7; 32],
        }
    }
    fn storage_contains(&mut self, slot: u16, key: &[u8]) -> Result<bool, Trap> {
        Ok(self.storage.contains_key(&(slot, key.to_vec())))
    }
    fn storage_read(&mut self, slot: u16, key: &[u8]) -> Result<Option<Vec<u8>>, Trap> {
        Ok(self.storage.get(&(slot, key.to_vec())).cloned())
    }
    fn storage_write(&mut self, slot: u16, key: &[u8], value: Option<&[u8]>) -> Result<(), Trap> {
        match value {
            Some(v) => self.storage.insert((slot, key.to_vec()), v.to_vec()),
            None => self.storage.remove(&(slot, key.to_vec())),
        };
        Ok(())
    }
    fn transfer(&mut self, asset: u32, amount: u128, to: &[u8; 20]) -> Result<(), Trap> {
        self.transfers.push((asset, amount, *to));
        Ok(())
    }
    fn emit(&mut self, event: u16, data: Vec<u8>) -> Result<(), Trap> {
        self.events.push((event, data));
        Ok(())
    }
    fn verify_ed25519(&self, _: &[u8; 32], _: &[u8; 32], _: &[u8; 64]) -> bool {
        false
    }
}

const EU: u64 = 10_000_000;

fn package(source: &str) -> Package {
    let file = SourceFile::new("t.arno", source);
    let bytes = compile(&file).unwrap_or_else(|d| {
        panic!(
            "{}",
            d.iter()
                .map(|x| x.render(&file))
                .collect::<Vec<_>>()
                .join("\n")
        )
    });
    Package::from_bytes(&bytes).unwrap()
}

fn example(path: &str) -> Package {
    let full = format!("{}/../../{path}", env!("CARGO_MANIFEST_DIR"));
    package(&std::fs::read_to_string(full).unwrap())
}

fn function(p: &Package, name: &str) -> u8 {
    let index = p
        .functions
        .iter()
        .position(|f| p.text(f.name) == Some(name))
        .unwrap_or_else(|| panic!("no function {name}"));
    u8::try_from(index).unwrap()
}

fn error_index(p: &Package, name: &str) -> u16 {
    u16::try_from(
        p.errors
            .iter()
            .position(|e| p.text(e.name) == Some(name))
            .unwrap(),
    )
    .unwrap()
}

fn addr(byte: u8) -> [u8; 20] {
    [byte; 20]
}

fn call(
    p: &Package,
    host: &mut MockHost,
    name: &str,
    args: Vec<Value>,
) -> Result<Option<Value>, Trap> {
    run(p, function(p, name), args, host, EU)
        .map(|o| o.returned)
        .map_err(|f| f.trap)
}

#[test]
fn the_escrow_contract_runs_its_whole_lifecycle() {
    let p = example("examples/arno/escrow.arno");
    let (buyer, seller, arbiter) = (addr(1), addr(2), addr(3));
    let mut host = MockHost {
        slot: 5,
        ..MockHost::default()
    };
    call(
        &p,
        &mut host,
        "constructor",
        vec![
            Value::Signer(buyer),
            Value::Address(seller),
            Value::Address(arbiter),
            Value::Slot(100),
        ],
    )
    .unwrap();
    // Status is Open (variant 0).
    assert_eq!(
        call(&p, &mut host, "status", vec![]).unwrap(),
        Some(Value::Enum(0))
    );

    // Only the buyer may fund: the coins come back by the abort (the state reverts in the node).
    let stranger = call(
        &p,
        &mut host.clone(),
        "fund",
        vec![
            Value::Signer(seller),
            Value::Coins {
                asset: 1,
                amount: 500,
            },
        ],
    );
    assert_eq!(stranger, Err(Trap::Abort(error_index(&p, "NotTheBuyer"))));

    call(
        &p,
        &mut host,
        "fund",
        vec![
            Value::Signer(buyer),
            Value::Coins {
                asset: 1,
                amount: 500,
            },
        ],
    )
    .unwrap();
    assert_eq!(
        call(&p, &mut host, "status", vec![]).unwrap(),
        Some(Value::Enum(1)),
        "Funded"
    );
    assert_eq!(host.events.len(), 1, "EscrowFunded");

    // The buyer cannot release; a refund before the deadline is too early.
    assert_eq!(
        call(&p, &mut host.clone(), "release", vec![Value::Signer(buyer)]),
        Err(Trap::Abort(error_index(&p, "NotArbiter")))
    );
    assert_eq!(
        call(&p, &mut host.clone(), "refund", vec![Value::Signer(buyer)]),
        Err(Trap::Abort(error_index(&p, "TooEarly")))
    );

    call(&p, &mut host, "release", vec![Value::Signer(arbiter)]).unwrap();
    assert_eq!(
        host.transfers,
        vec![(1, 500, seller)],
        "the seller is paid everything in the vault"
    );
    assert_eq!(
        call(&p, &mut host, "status", vec![]).unwrap(),
        Some(Value::Enum(2)),
        "Released"
    );
    assert_eq!(host.events.len(), 2);
    // Nothing can happen twice.
    assert_eq!(
        call(
            &p,
            &mut host.clone(),
            "release",
            vec![Value::Signer(arbiter)]
        ),
        Err(Trap::Abort(error_index(&p, "WrongPhase")))
    );
}

#[test]
fn the_treasury_contract_pays_with_a_fee_and_rounds_up() {
    let p = example("tests/arno/ok/features.arno");
    let (owner, member) = (addr(1), addr(9));
    let mut host = MockHost::default();
    call(&p, &mut host, "constructor", vec![Value::Signer(owner)]).unwrap();
    // Role Spender (1), limit 1,000.
    call(
        &p,
        &mut host,
        "enrol",
        vec![
            Value::Signer(owner),
            Value::Address(member),
            Value::Enum(1),
            Value::U128(1_000),
        ],
    )
    .unwrap();
    call(
        &p,
        &mut host,
        "fund",
        vec![
            Value::Signer(owner),
            Value::Coins {
                asset: 1,
                amount: 10_000,
            },
        ],
    )
    .unwrap();

    call(
        &p,
        &mut host,
        "pay",
        vec![Value::Signer(member), Value::U128(1_000)],
    )
    .unwrap();
    // Fee: 1,000 × 25 / 10,000 = 2.5, rounded up to 3. The member receives 1,000.
    assert_eq!(host.transfers, vec![(1, 1_000, member)]);
    let over = call(
        &p,
        &mut host.clone(),
        "pay",
        vec![Value::Signer(member), Value::U128(1_001)],
    );
    assert_eq!(over, Err(Trap::Abort(error_index(&p, "TooMuch"))));
    let unknown = call(
        &p,
        &mut host.clone(),
        "pay",
        vec![Value::Signer(addr(5)), Value::U128(1)],
    );
    assert_eq!(unknown, Err(Trap::Abort(error_index(&p, "Unknown"))));

    // The owner sweeps both vaults: 10,000 - 1,003 left in Funds, plus the 3 in Fees.
    call(&p, &mut host, "sweep", vec![Value::Signer(owner)]).unwrap();
    assert_eq!(host.transfers.last(), Some(&(1, 9_000, owner)));

    assert_eq!(
        call(&p, &mut host, "describe", vec![Value::Enum(0)]).unwrap(),
        Some(Value::U8(1))
    );
    assert_eq!(
        call(&p, &mut host, "describe", vec![Value::Enum(2)]).unwrap(),
        Some(Value::U8(2))
    );
    // Countdown(25): Min(25, 10) = 10 steps down, then 10 × Describe(Admin) = 20: 30.
    assert_eq!(
        call(&p, &mut host, "countdown", vec![Value::U64(25)]).unwrap(),
        Some(Value::U64(30))
    );
}

fn traps(body: &str) -> Trap {
    let source = format!(
        "contract T {{ version 0.1;\nerror E \"e\";\nprivate List of UInt8 max 2 S;\n\
         private function P() changes storage {{\nUInt8 X; UInt64 Y; UInt128 Z; Optional of UInt8 N;\n{body}\n}} }}"
    );
    let p = package(&source);
    call(&p, &mut MockHost::default(), "P", vec![]).unwrap_err()
}

#[test]
fn every_runtime_failure_is_a_named_trap() {
    assert_eq!(traps("X = 255; X = X + 1;"), Trap::Overflow);
    assert_eq!(traps("Y = 0; Y = 5 div Y;"), Trap::DivisionByZero);
    assert_eq!(traps("Y = 0; Y = Y - 1;"), Trap::Overflow);
    assert_eq!(traps("Z = 300; X = UInt8(Z);"), Trap::ConversionOutOfRange);
    assert_eq!(
        traps("Y = 1; while Y > 0 at most 3 times { Y = Y + 1; }"),
        Trap::LoopBoundExceeded
    );
    assert_eq!(traps("S.add(1); S.add(2); S.add(3);"), Trap::ListFull);
    assert_eq!(traps("N = Nothing; X = N.value;"), Trap::NothingToUnwrap);
    assert_eq!(traps("Y = 0; X = S[Y];"), Trap::IndexOutOfRange);
    assert_eq!(traps("require 1 is 2 otherwise E;"), Trap::Abort(0));
    assert_eq!(traps("fail E;"), Trap::Abort(0));
}

#[test]
fn a_loop_may_run_exactly_its_bound() {
    let p = package(
        "contract T { version 0.1;\npublic view function F() returns UInt64 {\n  UInt64 y = 0;\n  while y < 3 at most 3 times { y = y + 1; }\n  for i from 1 to 5 { y = y + i; }\n  return y;\n} }",
    );
    assert_eq!(
        call(&p, &mut MockHost::default(), "F", vec![]).unwrap(),
        Some(Value::U64(18))
    );
}

#[test]
fn short_circuit_and_skips_a_trapping_right_side() {
    let p = package(
        "contract T { version 0.1;\npublic view function F(UInt64 d) returns Boolean {\n  return d > 0 and 10 div d > 2;\n} }",
    );
    assert_eq!(
        call(&p, &mut MockHost::default(), "F", vec![Value::U64(0)]).unwrap(),
        Some(Value::Bool(false))
    );
    assert_eq!(
        call(&p, &mut MockHost::default(), "F", vec![Value::U64(2)]).unwrap(),
        Some(Value::Bool(true))
    );
}

#[test]
fn execution_stops_exactly_at_the_eu_limit() {
    let p = package(
        "contract T { version 0.1;\nprivate UInt64 S;\nprivate function P() changes storage { S = 1; } }",
    );
    let full = run(&p, function(&p, "P"), vec![], &mut MockHost::default(), EU).unwrap();
    assert!(
        full.eu_used > 5_000,
        "a new storage key costs at least 5,000 EU: {}",
        full.eu_used
    );
    let limit = full.eu_used - 1;
    let failure = run(
        &p,
        function(&p, "P"),
        vec![],
        &mut MockHost::default(),
        limit,
    )
    .unwrap_err();
    assert_eq!(failure.trap, Trap::OutOfEu);
    assert_eq!(failure.eu_used, limit);
    // A second write to an existing key costs less than the first.
    let mut host = MockHost::default();
    let first = run(&p, function(&p, "P"), vec![], &mut host, EU)
        .unwrap()
        .eu_used;
    let second = run(&p, function(&p, "P"), vec![], &mut host, EU)
        .unwrap()
        .eu_used;
    assert_eq!(first - second, 5_000 - 1_500);
}

#[test]
fn runs_are_deterministic() {
    let p = example("tests/arno/ok/features.arno");
    let script = |host: &mut MockHost| -> Vec<u64> {
        let mut eu = Vec::new();
        for (name, args) in [
            ("constructor", vec![Value::Signer(addr(1))]),
            (
                "enrol",
                vec![
                    Value::Signer(addr(1)),
                    Value::Address(addr(9)),
                    Value::Enum(2),
                    Value::U128(50),
                ],
            ),
            (
                "fund",
                vec![
                    Value::Signer(addr(1)),
                    Value::Coins {
                        asset: 1,
                        amount: 77,
                    },
                ],
            ),
            ("pay", vec![Value::Signer(addr(9)), Value::U128(50)]),
        ] {
            eu.push(run(&p, function(&p, name), args, host, EU).unwrap().eu_used);
        }
        eu
    };
    let (mut a, mut b) = (MockHost::default(), MockHost::default());
    assert_eq!(script(&mut a), script(&mut b));
    assert_eq!(a, b, "identical storage, transfers and events");
}

/// A random well-typed statement (locals X, Y, I: UInt64; B: Boolean; storage S; list L).
fn statement(seed: &mut u64, depth: u32) -> String {
    let mut next = |n: u64| {
        *seed ^= *seed << 13;
        *seed ^= *seed >> 7;
        *seed ^= *seed << 17;
        *seed % n
    };
    let operand = |k: u64| {
        ["X", "Y", "S", "0", "1", "7", "18446744073709551615"][usize::try_from(k % 7).unwrap()]
    };
    let op = |k: u64| ["+", "-", "*", "div", "mod"][usize::try_from(k % 5).unwrap()];
    let cmp = |k: u64| ["is", "is not", "<", "<=", ">", ">="][usize::try_from(k % 6).unwrap()];
    let choice = if depth == 0 { next(7) } else { next(12) };
    let (a, b, c) = (next(7), next(6), next(7));
    match choice {
        0 => format!("X = {} {} {};", operand(a), op(b), operand(c)),
        1 => format!("Y = {};", operand(a)),
        2 => format!("S = {};", operand(a)),
        3 => format!("B = ({} {} {}) or B;", operand(a), cmp(b), operand(c)),
        4 => format!("L.add(UInt8({} mod 256));", operand(a)),
        5 => "if L.length > 0 { X = UInt64(L[L.length]); }".to_owned(),
        6 => format!(
            "require {} {} {} otherwise E;",
            operand(a),
            cmp(b),
            operand(c)
        ),
        7 => format!(
            "if {} {} {} {{ {} }} else {{ {} }}",
            operand(a),
            cmp(b),
            operand(c),
            statement(seed, depth - 1),
            statement(seed, depth - 1)
        ),
        8 => format!(
            "while Y < {} at most 5 times {{ Y = Y + 1; {} }}",
            operand(a),
            statement(seed, depth - 1)
        ),
        9 => format!("for I from 1 to 4 {{ {} }}", statement(seed, depth - 1)),
        10 => format!(
            "switch X {{ case 0 -> {} case 1, 2 -> Y = 2; default -> Y = 3; }}",
            statement(seed, depth - 1)
        ),
        _ => format!(
            "{{ {} {} }}",
            statement(seed, depth - 1),
            statement(seed, depth - 1)
        ),
    }
}

proptest::proptest! {
    #![proptest_config(proptest::prelude::ProptestConfig::with_cases(300))]

    /// Whatever a verified program does, the VM either returns or stops with a named trap:
    /// never an internal error (a state the verifier rules out). Two runs agree exactly.
    #[test]
    fn random_programs_never_reach_an_internal_error(seed in 1u64.., count in 1usize..8, eu in 1u64..200_000) {
        let mut state = seed;
        let body: Vec<String> = (0..count).map(|_| statement(&mut state, 3)).collect();
        let source = format!(
            "contract R {{ version 0.1;\nerror E \"e\";\nprivate UInt64 S; private List of UInt8 max 3 L;\n\
             private function P() changes storage {{\nUInt64 X, Y, I; Boolean B;\n{}\n}} }}",
            body.join("\n")
        );
        let p = package(&source);
        let (mut h1, mut h2) = (MockHost::default(), MockHost::default());
        let r1 = run(&p, 0, vec![], &mut h1, eu);
        let r2 = run(&p, 0, vec![], &mut h2, eu);
        if let Err(failure) = &r1 {
            proptest::prop_assert!(!matches!(failure.trap, Trap::Internal(_)), "{source}\n{failure:?}");
        }
        proptest::prop_assert_eq!(r1, r2);
        proptest::prop_assert_eq!(h1, h2);
    }
}
