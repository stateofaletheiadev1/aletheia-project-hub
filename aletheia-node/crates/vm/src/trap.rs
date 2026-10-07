//! How a contract call can end other than by returning (spec Section 28).
//!
//! A trap reverts every state change of the transaction since its checkpoint; the fee is
//! still charged and the receipt records the trap's code. Running out of EU is reported
//! separately (receipt status `OutOfEu`).

use aletheia_core::ErrorCode;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Trap {
    /// `eu_used` would pass `eu_limit`; checked before the metered action.
    OutOfEu,
    Overflow,
    DivisionByZero,
    IndexOutOfRange,
    ListFull,
    NothingToUnwrap,
    ConversionOutOfRange,
    LoopBoundExceeded,
    InsufficientVault,
    InsufficientCoins,
    MemoryLimit,
    StorageValueTooLarge,
    /// The contract aborted with its error at this index (`require` / `fail`).
    Abort(u16),
    /// The host refused an operation (for example a transfer to an invalid address).
    Host(ErrorCode),
    /// A state the verifier rules out was reached anyway: a VM bug. Fail-stop.
    Internal(&'static str),
}

impl Trap {
    /// The receipt error code (APS-0038, 131xx).
    pub fn code(&self) -> ErrorCode {
        match self {
            Trap::OutOfEu => ErrorCode::VmOutOfEu,
            Trap::Overflow => ErrorCode::VmOverflow,
            Trap::DivisionByZero => ErrorCode::VmDivisionByZero,
            Trap::IndexOutOfRange => ErrorCode::VmIndexOutOfRange,
            Trap::ListFull => ErrorCode::VmListFull,
            Trap::NothingToUnwrap => ErrorCode::VmNothingToUnwrap,
            Trap::ConversionOutOfRange => ErrorCode::VmConversionOutOfRange,
            Trap::LoopBoundExceeded => ErrorCode::VmLoopBoundExceeded,
            Trap::InsufficientVault => ErrorCode::VmInsufficientVault,
            Trap::InsufficientCoins => ErrorCode::VmInsufficientCoins,
            Trap::MemoryLimit => ErrorCode::VmMemoryLimit,
            Trap::StorageValueTooLarge => ErrorCode::VmStorageValueTooLarge,
            Trap::Abort(_) => ErrorCode::VmContractAborted,
            Trap::Host(code) => *code,
            Trap::Internal(_) => ErrorCode::VmInternal,
        }
    }
}
