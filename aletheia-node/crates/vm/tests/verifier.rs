//! The deploy-time verifier (spec Section 27): a valid package passes, and each rule the
//! spec lists rejects a package that breaks it, with the change confined to that rule.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::panic
)]

use aletheia_core::{ErrorCode, Hash32};
use aletheia_vm::package::{
    EFFECT_CHANGES_STORAGE, EFFECT_RECEIVES_COINS, EFFECT_SENDS_COINS, ErrorDef, FLAG_ENTRY,
    StorageSlot,
};
use aletheia_vm::{Constant, FunctionDef, Instr, Op, Package, TypeDef, verify, verify_bytes};

// Type indices used by the fixture.
const T_U64: u16 = 0;
const T_BOOL: u16 = 1;
const T_COINS: u16 = 2;
const T_VAULT: u16 = 3;
const T_SIGNER: u16 = 4;
const T_ADDR: u16 = 5;
const T_U128: u16 = 6;

fn code(instrs: &[Instr]) -> Vec<u8> {
    instrs.iter().flat_map(|i| i.encode()).collect()
}

fn function(
    name: u16,
    params: u8,
    registers: Vec<u16>,
    returns: Option<u16>,
    flags: u8,
    effects: u8,
) -> FunctionDef {
    FunctionDef {
        name,
        params,
        returns,
        flags,
        effects,
        registers,
        code_offset: 0,
        code_len: 0,
    }
}

/// Lays out the functions' code back to back.
fn package(functions: Vec<(FunctionDef, Vec<Instr>)>) -> Package {
    let mut all = Vec::new();
    let mut defs = Vec::new();
    for (mut f, instrs) in functions {
        let bytes = code(&instrs);
        f.code_offset = u32::try_from(all.len()).unwrap();
        f.code_len = u32::try_from(bytes.len()).unwrap();
        all.extend(bytes);
        defs.push(f);
    }
    Package {
        arno_version: 0x0001,
        compiler: "test".to_owned(),
        source_hash: Hash32::ZERO,
        name: 0,
        constants: vec![
            Constant::Text(b"T".to_vec()),
            Constant::Text(b"f".to_vec()),
            Constant::Text(b"Safe".to_vec()),
            Constant::Text(b"Oops".to_vec()),
            Constant::Text(b"Something went wrong.".to_vec()),
            Constant::Int(7),
        ],
        types: vec![
            TypeDef::U64,
            TypeDef::Bool,
            TypeDef::Coins { asset: 1 },
            TypeDef::Vault { asset: 1 },
            TypeDef::Signer,
            TypeDef::Address,
            TypeDef::U128,
        ],
        functions: defs,
        storage: vec![
            StorageSlot {
                name: 2,
                ty: T_VAULT,
            },
            StorageSlot { name: 2, ty: T_U64 },
        ],
        errors: vec![ErrorDef {
            name: 3,
            message: 4,
        }],
        events: Vec::new(),
        code: all,
    }
}

/// `f(): UInt64 = 7 + 1`.
fn arithmetic() -> (FunctionDef, Vec<Instr>) {
    (
        function(1, 0, vec![T_U64, T_U64], Some(T_U64), 0, 0),
        vec![
            Instr::abx(Op::LoadK, 0, 5),
            Instr::abx(Op::LoadI, 1, 1),
            Instr::abc(Op::Add, 0, 0, 1),
            Instr::abc(Op::Ret, 0, 0, 0),
        ],
    )
}

/// An entry that deposits the coins it receives: R0 signer, R1 coins.
fn deposit() -> (FunctionDef, Vec<Instr>) {
    (
        function(
            1,
            2,
            vec![T_SIGNER, T_COINS],
            None,
            FLAG_ENTRY,
            EFFECT_CHANGES_STORAGE | EFFECT_RECEIVES_COINS,
        ),
        vec![
            Instr::abc(Op::VDeposit, 1, 0, 0),
            Instr::abc(Op::RetV, 0, 0, 0),
        ],
    )
}

fn rejected(p: &Package) -> String {
    let error = verify(p).expect_err("must be rejected");
    assert_eq!(error.code(), ErrorCode::VmVerifyFailed, "{error}");
    error.detail().to_owned()
}

#[test]
fn valid_packages_pass_and_survive_encoding() {
    let p = package(vec![arithmetic(), deposit()]);
    verify(&p).unwrap();
    let decoded = verify_bytes(&p.to_bytes()).unwrap();
    assert_eq!(decoded, p);
}

#[test]
fn framing_is_checked_before_anything_else() {
    let bytes = package(vec![arithmetic()]).to_bytes();
    let mut wrong_magic = bytes.clone();
    wrong_magic[0] = b'X';
    assert_eq!(
        verify_bytes(&wrong_magic).unwrap_err().code(),
        ErrorCode::VmPackageMalformed
    );
    let mut tampered = bytes.clone();
    let last = tampered.len() - 1;
    tampered[last] ^= 1;
    assert_eq!(
        verify_bytes(&tampered).unwrap_err().code(),
        ErrorCode::VmPackageMalformed
    );
}

#[test]
fn unknown_opcodes_and_out_of_range_operands_are_rejected() {
    let mut p = package(vec![arithmetic()]);
    p.code[3] = 0xEE; // the opcode byte of the first word
    assert!(rejected(&p).contains("unknown opcode"));

    let (f, mut instrs) = arithmetic();
    instrs[2] = Instr::abc(Op::Add, 0, 0, 9);
    assert!(rejected(&package(vec![(f, instrs)])).contains("register 9"));

    let (f, mut instrs) = arithmetic();
    instrs[0] = Instr::abx(Op::LoadK, 0, 99);
    assert!(rejected(&package(vec![(f, instrs)])).contains("constant 99"));
}

#[test]
fn operand_types_must_fit_the_opcode() {
    let (mut f, instrs) = arithmetic();
    f.registers[1] = T_BOOL;
    let detail = rejected(&package(vec![(f, instrs)]));
    assert!(
        detail.contains("does not fit") || detail.contains("different types"),
        "{detail}"
    );
}

#[test]
fn jumps_go_forward_and_loops_have_constant_bounds() {
    // A backward JMP.
    let (f, mut instrs) = arithmetic();
    instrs[1] = Instr::abx(Op::Jmp, 0, 0);
    assert!(rejected(&package(vec![(f, instrs)])).contains("forward"));

    // A bounded loop: counter R1 loaded from a constant, counted down by LOOP.
    let looped = (
        function(1, 0, vec![T_U64, T_U64, T_BOOL], Some(T_U64), 0, 0),
        vec![
            Instr::abx(Op::LoadI, 0, 0),    // 0: acc := 0
            Instr::abx(Op::LoadI, 1, 10),   // 1: counter := 10
            Instr::abc(Op::Add, 0, 0, 0),   // 2: body
            Instr::abc(Op::Lt, 2, 0, 0),    // 3: cond (always false here)
            Instr::abx(Op::JmpIfNot, 2, 6), // 4: leave the loop
            Instr::abx(Op::Loop, 1, 2),     // 5: back while the bound lasts
            Instr::abc(Op::Ret, 0, 0, 0),   // 6
        ],
    );
    verify(&package(vec![looped.clone()])).unwrap();

    // The same loop with its counter computed at run time: unbounded.
    let (f, mut instrs) = looped;
    instrs[1] = Instr::abc(Op::Add, 1, 0, 0);
    assert!(rejected(&package(vec![(f, instrs)])).contains("loop counter"));
}

#[test]
fn a_function_cannot_run_past_its_end() {
    let (f, mut instrs) = arithmetic();
    instrs.pop();
    let detail = rejected(&package(vec![(f, instrs)]));
    assert!(detail.contains("last instruction"), "{detail}");
}

#[test]
fn coins_cannot_be_lost_duplicated_or_used_empty() {
    // Returning with the coins still held.
    let (f, _) = deposit();
    let leak = (f.clone(), vec![Instr::abc(Op::RetV, 0, 0, 0)]);
    assert!(rejected(&package(vec![leak])).contains("still hold coins"));

    // Depositing twice.
    let twice = (
        f.clone(),
        vec![
            Instr::abc(Op::VDeposit, 1, 0, 0),
            Instr::abc(Op::VDeposit, 1, 0, 0),
            Instr::abc(Op::RetV, 0, 0, 0),
        ],
    );
    assert!(rejected(&package(vec![twice])).contains("holds no coins"));

    // Copying coins with MOV.
    let mut registers = f.registers.clone();
    registers.push(T_COINS);
    let mut copy_f = f.clone();
    copy_f.registers = registers;
    let copied = (
        copy_f,
        vec![
            Instr::abc(Op::Mov, 2, 1, 0),
            Instr::abc(Op::VDeposit, 1, 0, 0),
            Instr::abc(Op::RetV, 0, 0, 0),
        ],
    );
    assert!(rejected(&package(vec![copied])).contains("MOVE"));

    // Moved on one branch only: the paths disagree where they meet.
    let mut branch_f = f;
    branch_f.registers.push(T_BOOL);
    let branched = (
        branch_f,
        vec![
            Instr::abx(Op::JmpIf, 2, 2),
            Instr::abc(Op::VDeposit, 1, 0, 0),
            Instr::abc(Op::RetV, 0, 0, 0),
        ],
    );
    let detail = rejected(&package(vec![branched]));
    assert!(
        detail.contains("different coins") || detail.contains("still hold coins"),
        "{detail}"
    );
}

#[test]
fn effects_must_be_declared() {
    let (mut f, instrs) = deposit();
    f.effects = EFFECT_RECEIVES_COINS;
    assert!(rejected(&package(vec![(f, instrs)])).contains("does not declare"));

    // Sending coins without 'sends coins'.
    let send = (
        function(
            1,
            3,
            vec![T_SIGNER, T_COINS, T_ADDR],
            None,
            FLAG_ENTRY,
            EFFECT_RECEIVES_COINS,
        ),
        vec![
            Instr::abc(Op::Transfer, 1, 2, 0),
            Instr::abc(Op::RetV, 0, 0, 0),
        ],
    );
    assert!(rejected(&package(vec![send.clone()])).contains("TRANSFER"));
    let (mut f, instrs) = send;
    f.effects |= EFFECT_SENDS_COINS;
    verify(&package(vec![(f, instrs)])).unwrap();
}

#[test]
fn callers_declare_their_callees_effects() {
    let writer = (
        function(1, 0, vec![T_U64], None, 0, EFFECT_CHANGES_STORAGE),
        vec![
            Instr::abx(Op::LoadI, 0, 1),
            Instr::abx(Op::SStore, 0, 1),
            Instr::abc(Op::RetV, 0, 0, 0),
        ],
    );
    let caller = (
        function(1, 0, vec![T_U64], None, 0, 0),
        vec![Instr::abc(Op::Call, 0, 0, 0), Instr::abc(Op::RetV, 0, 0, 0)],
    );
    assert!(rejected(&package(vec![writer, caller])).contains("does not declare"));
}

#[test]
fn recursion_and_deep_call_chains_are_rejected() {
    let selfish = (
        function(1, 0, vec![T_U64], None, 0, 0),
        vec![Instr::abc(Op::Call, 0, 0, 0), Instr::abc(Op::RetV, 0, 0, 0)],
    );
    assert!(rejected(&package(vec![selfish])).contains("cycle"));

    // f0 -> f1 -> ... -> f16: 17 frames.
    let chain: Vec<_> = (0..17u8)
        .map(|i| {
            let mut instrs = Vec::new();
            if i < 16 {
                instrs.push(Instr::abc(Op::Call, 0, i + 1, 0));
            }
            instrs.push(Instr::abc(Op::RetV, 0, 0, 0));
            (function(1, 0, vec![T_U64], None, 0, 0), instrs)
        })
        .collect();
    assert!(rejected(&package(chain)).contains("call depth"));
}

#[test]
fn storage_never_holds_coins_and_entries_take_a_signer() {
    let mut p = package(vec![arithmetic()]);
    p.storage[1].ty = T_COINS;
    assert!(rejected(&p).contains("storage slot 1"));

    let (mut f, instrs) = deposit();
    f.registers[0] = T_U128;
    assert!(rejected(&package(vec![(f, instrs)])).contains("Signer"));
}

proptest::proptest! {
    /// Arbitrary bytes never panic the decoder or verifier.
    #[test]
    fn arbitrary_bytes_are_rejected_not_panicked(bytes in proptest::collection::vec(proptest::num::u8::ANY, 0..512)) {
        let _ = verify_bytes(&bytes);
    }

    /// Arbitrary instruction words in a valid frame never panic the verifier.
    #[test]
    fn arbitrary_code_is_rejected_not_panicked(words in proptest::collection::vec(proptest::num::u32::ANY, 1..64)) {
        let mut p = package(vec![arithmetic()]);
        p.code = words.iter().flat_map(|w| w.to_le_bytes()).collect();
        p.functions[0].code_len = u32::try_from(p.code.len()).unwrap();
        let _ = verify(&p);
    }
}

#[test]
fn types_whose_zero_value_exceeds_a_calls_memory_are_refused() {
    // 300,000 UInt128 elements: about 4.8 MB of zero value, over the 4 MiB a call may use.
    let mut p = package(vec![arithmetic()]);
    p.types.push(TypeDef::Array {
        len: 300_000,
        elem: T_U128,
    });
    assert!(
        rejected(&p).contains("zero value exceeds"),
        "{}",
        rejected(&p)
    );

    // Nesting multiplies: each level alone is small, together they are not.
    let mut p = package(vec![arithmetic()]);
    let inner = u16::try_from(p.types.len()).unwrap();
    p.types.push(TypeDef::Array {
        len: 1_000,
        elem: T_U64,
    });
    p.types.push(TypeDef::Array {
        len: 1_000,
        elem: inner,
    });
    assert!(rejected(&p).contains("zero value exceeds"));

    // A modest array is fine.
    let mut p = package(vec![arithmetic()]);
    p.types.push(TypeDef::Array {
        len: 1_000,
        elem: T_U64,
    });
    verify(&p).unwrap();
}

#[test]
fn a_function_whose_registers_start_too_large_is_refused() {
    let mut p = package(vec![arithmetic()]);
    let big = u16::try_from(p.types.len()).unwrap();
    // About 1.6 MB each: allowed alone, not three to a frame.
    p.types.push(TypeDef::Array {
        len: 100_000,
        elem: T_U128,
    });
    verify(&p).unwrap();
    p.functions[0].registers.extend([big, big, big]);
    assert!(
        rejected(&p).contains("registers start larger"),
        "{}",
        rejected(&p)
    );
}

#[test]
fn sizing_deeply_nested_types_takes_linear_time() {
    // Each record holds two of the previous one: 2^4000 zero-value bytes if expanded, which
    // must be sized (and refused) without being expanded.
    let mut p = package(vec![arithmetic()]);
    for _ in 0..4_000 {
        let previous = u16::try_from(p.types.len() - 1).unwrap();
        p.types.push(TypeDef::Record {
            name: 0,
            fields: vec![(1, previous), (1, previous)],
        });
    }
    let started = std::time::Instant::now();
    let detail = rejected(&p);
    assert!(detail.contains("zero value exceeds"), "{detail}");
    assert!(started.elapsed() < std::time::Duration::from_secs(2));
}
