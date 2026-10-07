//! Arno bytecode v1 instructions (spec Section 27, ADR-046).
//!
//! A register machine with 32-bit little-endian instruction words:
//!
//! ```text
//!  31        24 23      16 15       8 7        0
//! ┌───────────┬──────────┬──────────┬──────────┐
//! │  opcode   │    A     │    B     │    C     │     ABC form
//! ├───────────┼──────────┴──────────┴──────────┤
//! │  opcode   │    A     │       Bx (u16)      │     ABx form
//! └───────────┴──────────┴─────────────────────┘
//! ```
//!
//! Operand widths come from the register types each function declares, so one `ADD` serves
//! every integer type; the verifier checks that all its operands share one type. Jump
//! targets are instruction indices within the function. Ordinary jumps go forward only; the
//! one way back is `LOOP`, which counts down a register that only constants may set, so
//! every loop has a bound the verifier can see.

/// One decoded instruction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Instr {
    pub op: Op,
    pub a: u8,
    pub b: u8,
    pub c: u8,
}

impl Instr {
    pub const fn abc(op: Op, a: u8, b: u8, c: u8) -> Instr {
        Instr { op, a, b, c }
    }

    pub const fn abx(op: Op, a: u8, bx: u16) -> Instr {
        let [high, low] = bx.to_be_bytes();
        Instr {
            op,
            a,
            b: high,
            c: low,
        }
    }

    /// The 16-bit operand of the ABx form.
    pub const fn bx(self) -> u16 {
        u16::from_be_bytes([self.b, self.c])
    }

    pub fn encode(self) -> [u8; 4] {
        u32::from_be_bytes([self.op.code(), self.a, self.b, self.c]).to_le_bytes()
    }

    /// `None` for an unknown opcode.
    pub fn decode(word: [u8; 4]) -> Option<Instr> {
        let [op, a, b, c] = u32::from_le_bytes(word).to_be_bytes();
        Some(Instr {
            op: Op::from_code(op)?,
            a,
            b,
            c,
        })
    }
}

macro_rules! opcodes {
    ($($name:ident = $code:literal, $mnemonic:literal;)*) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub enum Op {
            $($name,)*
        }

        impl Op {
            pub const ALL: &'static [Op] = &[$(Op::$name,)*];

            pub const fn code(self) -> u8 {
                match self {
                    $(Op::$name => $code,)*
                }
            }

            pub const fn mnemonic(self) -> &'static str {
                match self {
                    $(Op::$name => $mnemonic,)*
                }
            }

            pub fn from_code(code: u8) -> Option<Op> {
                match code {
                    $($code => Some(Op::$name),)*
                    _ => None,
                }
            }
        }
    };
}

opcodes! {
    Nop = 0x00, "NOP";
    // Data movement.
    Mov = 0x01, "MOV";               // R[A] := R[B]             (copyable types)
    LoadK = 0x02, "LOADK";           // R[A] := K[Bx]
    LoadI = 0x03, "LOADI";           // R[A] := Bx               (integer, enum or Boolean)
    LoadNothing = 0x04, "LOADNOTHING"; // R[A] := Nothing        (optional)
    Move = 0x05, "MOVE";             // R[A] := R[B]; R[B] emptied (coins)
    // Checked arithmetic: all operands one integer type; overflow and /0 trap.
    Add = 0x10, "ADD";
    Sub = 0x11, "SUB";
    Mul = 0x12, "MUL";
    Div = 0x13, "DIV";
    Mod = 0x14, "MOD";
    Neg = 0x15, "NEG";               // R[A] := -R[B]            (Int64)
    MulDiv = 0x16, "MULDIV";         // R[A] := R[B]*R[B+1]/R[B+2], rounded down (UInt128)
    MulDivUp = 0x17, "MULDIVUP";     // the same, rounded up
    // Boolean logic.
    And = 0x18, "AND";
    Or = 0x19, "OR";
    Xor = 0x1A, "XOR";
    Not = 0x1B, "NOT";
    Min = 0x1C, "MIN";
    Max = 0x1D, "MAX";
    // Comparisons: R[A] is Boolean, R[B] and R[C] one type.
    Eq = 0x20, "EQ";
    Ne = 0x21, "NE";
    Lt = 0x22, "LT";
    Le = 0x23, "LE";
    Conv = 0x28, "CONV";             // R[A] := R[B] in R[A]'s type, range-checked
    // Control.
    Jmp = 0x30, "JMP";               // forward to Bx
    JmpIf = 0x31, "JMPIF";           // forward to Bx if R[A]
    JmpIfNot = 0x32, "JMPIFNOT";     // forward to Bx unless R[A]
    Loop = 0x33, "LOOP";             // back to Bx while the counter R[A] lasts; traps at 0
    Call = 0x34, "CALL";             // call function B with args R[A..]; result to R[C]
    Ret = 0x35, "RET";               // return R[A]
    RetV = 0x36, "RETV";             // return with no value
    Abort = 0x37, "ABORT";           // abort with error Bx
    Assert = 0x38, "ASSERT";         // abort with error Bx unless R[A]
    // Storage: slot B or Bx.
    SLoad = 0x40, "SLOAD";           // R[A] := storage[Bx]
    SStore = 0x41, "SSTORE";         // storage[Bx] := R[A]
    MGet = 0x42, "MGET";             // R[A] := map B at key R[C], as an optional
    MPut = 0x43, "MPUT";             // map B at key R[C] := R[A]
    MDel = 0x44, "MDEL";             // remove key R[C] from map B
    MHas = 0x45, "MHAS";             // R[A] := map B has key R[C]
    // Aggregates.
    New = 0x50, "NEW";               // R[A] := the zero value of its type
    GetF = 0x51, "GETF";             // R[A] := R[B].field C
    SetF = 0x52, "SETF";             // R[A].field B := R[C]
    GetI = 0x53, "GETI";             // R[A] := R[B][R[C]]       (1-based; traps out of range)
    SetI = 0x54, "SETI";             // R[A][R[B]] := R[C]
    Len = 0x55, "LEN";               // R[A] := length of R[B]
    Push = 0x56, "PUSH";             // append R[B] to list R[A]; traps when full
    Some = 0x57, "SOME";             // R[A] := Some(R[B])
    IsSome = 0x58, "ISSOME";         // R[A] := R[B] holds a value
    Unwrap = 0x59, "UNWRAP";         // R[A] := the value in R[B]; traps on Nothing
    // Coins and vaults (vaults are storage slots).
    VDeposit = 0x60, "VDEPOSIT";     // vault B += coins R[A]    (empties R[A])
    VWithdraw = 0x61, "VWITHDRAW";   // R[A] := R[C] units from vault B
    VWithdrawAll = 0x62, "VWITHDRAWALL"; // R[A] := everything in vault B
    VBalance = 0x63, "VBALANCE";     // R[A] := balance of vault B
    VEmpty = 0x64, "VEMPTY";         // storage[Bx] := an empty vault
    CValue = 0x65, "CVALUE";         // R[A] := value of coins R[B]
    CSplit = 0x66, "CSPLIT";         // R[A] := R[C] units taken from coins R[B]
    CJoin = 0x67, "CJOIN";           // coins R[A] += coins R[B] (empties R[B])
    Transfer = 0x68, "TRANSFER";     // send coins R[A] to address R[B] (empties R[A])
    SignerAddr = 0x69, "SIGNERADDR"; // R[A] := address of signer R[B]
    // Events and host calls.
    Emit = 0x70, "EMIT";             // event B with fields R[A..A+C)
    Host = 0x71, "HOST";             // host function Bx: result R[A], arguments R[A+1..]
}

/// Host functions (`HOST A Bx`), with their argument count. The table is versioned with the
/// bytecode format; each entry has a fixed EU cost in the VM (Section 29).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum HostFn {
    ChainHeight,
    ChainSlot,
    ChainEpoch,
    ChainProtocolTime,
    ChainTxId,
    Blake3,
    VerifyEd25519,
}

impl HostFn {
    pub const ALL: [HostFn; 7] = [
        HostFn::ChainHeight,
        HostFn::ChainSlot,
        HostFn::ChainEpoch,
        HostFn::ChainProtocolTime,
        HostFn::ChainTxId,
        HostFn::Blake3,
        HostFn::VerifyEd25519,
    ];

    pub const fn id(self) -> u16 {
        match self {
            HostFn::ChainHeight => 1,
            HostFn::ChainSlot => 2,
            HostFn::ChainEpoch => 3,
            HostFn::ChainProtocolTime => 4,
            HostFn::ChainTxId => 5,
            HostFn::Blake3 => 16,
            HostFn::VerifyEd25519 => 17,
        }
    }

    pub fn from_id(id: u16) -> Option<HostFn> {
        HostFn::ALL.into_iter().find(|f| f.id() == id)
    }

    pub const fn arity(self) -> u8 {
        match self {
            HostFn::ChainHeight
            | HostFn::ChainSlot
            | HostFn::ChainEpoch
            | HostFn::ChainProtocolTime
            | HostFn::ChainTxId => 0,
            HostFn::Blake3 => 1,
            HostFn::VerifyEd25519 => 3,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_opcode_round_trips_and_codes_are_unique() {
        let mut codes = std::collections::BTreeSet::new();
        for op in Op::ALL {
            assert!(codes.insert(op.code()), "{op:?} reuses a code");
            let instr = Instr::abc(*op, 1, 2, 3);
            assert_eq!(Instr::decode(instr.encode()), Some(instr));
        }
        assert_eq!(Instr::decode([0, 0, 0, 0xEE]), None, "unknown opcode");
    }

    #[test]
    fn the_wide_operand_spans_b_and_c() {
        let instr = Instr::abx(Op::LoadK, 7, 0x1234);
        assert_eq!(instr.bx(), 0x1234);
        assert_eq!((instr.b, instr.c), (0x12, 0x34));
        assert_eq!(Instr::decode(instr.encode()).map(Instr::bx), Some(0x1234));
    }
}
