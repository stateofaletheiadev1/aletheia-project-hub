//! Execution-unit costs, protocol version 1 (spec Section 29; devnet defaults, calibrated on
//! reference hardware before version 1 is frozen). Changing any of them is a protocol change.

/// Every instruction.
pub const BASE: u64 = 1;
/// UInt128 multiplication, division, remainder and MulDiv, on top of the base cost.
pub const WIDE_MUL_DIV: u64 = 4;
/// Storage read: per read, plus per byte read.
pub const STORAGE_READ: u64 = 200;
pub const STORAGE_READ_BYTE: u64 = 1;
/// Storage write to a key that did not exist, or to one that did; plus per byte written.
pub const STORAGE_WRITE_NEW: u64 = 5_000;
pub const STORAGE_WRITE_EXISTING: u64 = 1_500;
pub const STORAGE_WRITE_BYTE: u64 = 10;
/// Removing a key (no refund in v0.1).
pub const STORAGE_DELETE: u64 = 500;
/// Deploying a contract: per deployment plus per code byte.
pub const CONTRACT_CREATE: u64 = 20_000;
pub const CONTRACT_CREATE_BYTE: u64 = 50;
/// An event: per event plus per encoded byte.
pub const EVENT: u64 = 300;
pub const EVENT_BYTE: u64 = 5;
/// Memory growth, per 32 bytes (rounded up).
pub const MEMORY_PER_32_BYTES: u64 = 3;
/// A call to another routine of the same contract.
pub const NESTED_CALL: u64 = 700;
/// BLAKE3: per hash plus per 64 bytes (rounded up).
pub const BLAKE3: u64 = 30;
pub const BLAKE3_PER_64_BYTES: u64 = 1;
pub const ED25519_VERIFY: u64 = 3_000;
/// A coins transfer out of a contract, priced like a native transfer.
pub const TRANSFER: u64 = 2_000;

/// A call frame's registers up to this many bytes are covered by the call's base cost; beyond
/// it, building the frame (zero values and argument copies) costs memory like any other value.
pub const FREE_FRAME_BYTES: u64 = 1024;
/// Comparing values larger than [`FREE_COMPARE_BYTES`] (lists, records, byte strings) costs
/// this per 32 bytes of the larger operand; scalars, addresses and hashes stay at the base
/// cost.
pub const COMPARE_PER_32_BYTES: u64 = 1;
pub const FREE_COMPARE_BYTES: u64 = 64;

/// Memory limits (Section 28).
pub const MAX_CALL_MEMORY: u64 = 4 * 1024 * 1024;
pub const MAX_TX_MEMORY: u64 = 32 * 1024 * 1024;

/// `per` for each started `unit` of `bytes`.
pub fn per_unit(bytes: u64, unit: u64, per: u64) -> u64 {
    bytes.div_ceil(unit.max(1)).saturating_mul(per)
}
