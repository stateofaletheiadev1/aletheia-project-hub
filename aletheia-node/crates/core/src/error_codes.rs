//! Protocol error codes (APS-0038).
//!
//! The registry `docs/aps/APS-0038-error-codes.toml` is the source of truth. This table must
//! match it row for row; `error_codes_match_registry` below enforces that, so adding a code
//! means editing both files in the same change.

/// What the node does after an error of this code.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorClass {
    /// The input is refused; the node continues.
    Reject,
    /// The node stops after durable safety state is written (Section 46.3).
    FailStop,
}

macro_rules! error_codes {
    ($( $variant:ident = $code:literal, $name:literal, $class:ident; )+) => {
        /// A stable protocol error code. Codes are never reused (Section 57).
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
        #[non_exhaustive]
        pub enum ErrorCode {
            $( $variant, )+
        }

        impl ErrorCode {
            /// Every code, in registry order.
            pub const ALL: &'static [ErrorCode] = &[ $( ErrorCode::$variant, )+ ];

            /// The numeric code, as written into receipts and RPC errors.
            pub const fn get(self) -> u32 {
                match self { $( ErrorCode::$variant => $code, )+ }
            }

            /// The stable symbolic name used in RPC errors, e.g. `TX_NONCE_TOO_LOW`.
            pub const fn name(self) -> &'static str {
                match self { $( ErrorCode::$variant => $name, )+ }
            }

            pub const fn class(self) -> ErrorClass {
                match self { $( ErrorCode::$variant => ErrorClass::$class, )+ }
            }

            /// Looks up a numeric code, for decoding receipts and RPC errors.
            pub const fn from_code(code: u32) -> Option<ErrorCode> {
                match code { $( $code => Some(ErrorCode::$variant), )+ _ => None }
            }
        }
    };
}

error_codes! {
    DecodeNonCanonical = 1001, "DECODE_NON_CANONICAL", Reject;
    DecodeLengthExceeded = 1002, "DECODE_LENGTH_EXCEEDED", Reject;
    DecodeTrailingBytes = 1003, "DECODE_TRAILING_BYTES", Reject;
    EncPrefixedHexRejected = 1101, "ENC_PREFIXED_HEX_REJECTED", Reject;
    EncUppercaseHex = 1102, "ENC_UPPERCASE_HEX", Reject;
    EncOddLength = 1103, "ENC_ODD_LENGTH", Reject;
    EncWrongLength = 1104, "ENC_WRONG_LENGTH", Reject;
    EncInvalidCharacter = 1105, "ENC_INVALID_CHARACTER", Reject;
    AddrMalformed = 1201, "ADDR_MALFORMED", Reject;
    AddrWrongNetwork = 1202, "ADDR_WRONG_NETWORK", Reject;
    AddrNonCanonical = 1203, "ADDR_NON_CANONICAL", Reject;
    IdMalformed = 1211, "ID_MALFORMED", Reject;
    IdWrongNetwork = 1212, "ID_WRONG_NETWORK", Reject;
    IdNonCanonical = 1213, "ID_NON_CANONICAL", Reject;
    NetworkKindUnknown = 1301, "NETWORK_KIND_UNKNOWN", Reject;
    TxTooLarge = 2001, "TX_TOO_LARGE", Reject;
    TxVersionUnsupported = 2002, "TX_VERSION_UNSUPPORTED", Reject;
    TxNonceTooLow = 2003, "TX_NONCE_TOO_LOW", Reject;
    TxWrongChain = 2004, "TX_WRONG_CHAIN", Reject;
    TxWrongNetwork = 2005, "TX_WRONG_NETWORK", Reject;
    TxFieldOutOfRange = 2006, "TX_FIELD_OUT_OF_RANGE", Reject;
    TxValidityWindowInvalid = 2007, "TX_VALIDITY_WINDOW_INVALID", Reject;
    TxAuthMalformed = 2008, "TX_AUTH_MALFORMED", Reject;
    TxThresholdNotMet = 2009, "TX_THRESHOLD_NOT_MET", Reject;
    TxNonceTooHigh = 2010, "TX_NONCE_TOO_HIGH", Reject;
    TxKeyMismatch = 2011, "TX_KEY_MISMATCH", Reject;
    TxExpired = 2012, "TX_EXPIRED", Reject;
    TxNotYetValid = 2013, "TX_NOT_YET_VALID", Reject;
    TxFeeUnaffordable = 2014, "TX_FEE_UNAFFORDABLE", Reject;
    TxMaxFeeInsufficient = 2015, "TX_MAX_FEE_INSUFFICIENT", Reject;
    TxAssetUnknown = 2016, "TX_ASSET_UNKNOWN", Reject;
    TxContractUnknown = 2017, "TX_CONTRACT_UNKNOWN", Reject;
    TxRoutineUnknown = 2018, "TX_ROUTINE_UNKNOWN", Reject;
    TxAttachmentInvalid = 2019, "TX_ATTACHMENT_INVALID", Reject;
    TxTypeNotActive = 2020, "TX_TYPE_NOT_ACTIVE", Reject;
    TxArgsInvalid = 2021, "TX_ARGS_INVALID", Reject;
    BlkNotCanonicalOrder = 3001, "BLK_NOT_CANONICAL_ORDER", Reject;
    BlkVersionMismatch = 3002, "BLK_VERSION_MISMATCH", Reject;
    BlkLimitExceeded = 3003, "BLK_LIMIT_EXCEEDED", Reject;
    BlkRootMismatch = 3004, "BLK_ROOT_MISMATCH", Reject;
    BlkParentMismatch = 3005, "BLK_PARENT_MISMATCH", Reject;
    BlkTimeMismatch = 3006, "BLK_TIME_MISMATCH", Reject;
    BlkInvalidTransaction = 3007, "BLK_INVALID_TRANSACTION", Reject;
    BlkValidatorSetMismatch = 3008, "BLK_VALIDATOR_SET_MISMATCH", Reject;
    SigInvalid = 4001, "SIG_INVALID", Reject;
    SigMalformed = 4002, "SIG_MALFORMED", Reject;
    KeyMalformed = 4003, "KEY_MALFORMED", Reject;
    KeyWeak = 4004, "KEY_WEAK", Reject;
    BlsPopInvalid = 4010, "BLS_POP_INVALID", Reject;
    BlsAggregateEmpty = 4011, "BLS_AGGREGATE_EMPTY", Reject;
    CryptoAlgorithmUnsupported = 4020, "CRYPTO_ALGORITHM_UNSUPPORTED", Reject;
    KeyGenerationFailed = 4030, "KEY_GENERATION_FAILED", Reject;
    ProofInvalid = 4040, "PROOF_INVALID", Reject;
    StateNoCheckpoint = 5001, "STATE_NO_CHECKPOINT", FailStop;
    PayDuplicate = 6010, "PAY_DUPLICATE", Reject;
    StoIo = 7001, "STO_IO", FailStop;
    StoCorrupt = 7002, "STO_CORRUPT", FailStop;
    StoWalChecksum = 7003, "STO_WAL_CHECKSUM", FailStop;
    StoWalSequenceGap = 7004, "STO_WAL_SEQUENCE_GAP", FailStop;
    StoDataDirWrongChain = 7010, "STO_DATA_DIR_WRONG_CHAIN", FailStop;
    StoDataDirTooNew = 7011, "STO_DATA_DIR_TOO_NEW", FailStop;
    StoDataDirLocked = 7012, "STO_DATA_DIR_LOCKED", FailStop;
    StoDataDirMissing = 7013, "STO_DATA_DIR_MISSING", FailStop;
    StoArchiveMismatch = 7020, "STO_ARCHIVE_MISMATCH", FailStop;
    StoMigrationFailed = 7030, "STO_MIGRATION_FAILED", FailStop;
    P2pFrameTooLarge = 8001, "P2P_FRAME_TOO_LARGE", Reject;
    P2pUnknownChannel = 8002, "P2P_UNKNOWN_CHANNEL", Reject;
    P2pMalformedMessage = 8003, "P2P_MALFORMED_MESSAGE", Reject;
    P2pHandshakeFailed = 8004, "P2P_HANDSHAKE_FAILED", Reject;
    P2pWrongNetwork = 8005, "P2P_WRONG_NETWORK", Reject;
    P2pVersionMismatch = 8006, "P2P_VERSION_MISMATCH", Reject;
    P2pRateLimited = 8007, "P2P_RATE_LIMITED", Reject;
    P2pPeerBanned = 8008, "P2P_PEER_BANNED", Reject;
    P2pConnectionLimit = 8009, "P2P_CONNECTION_LIMIT", Reject;
    ArithmeticOverflow = 9001, "ARITHMETIC_OVERFLOW", Reject;
    InsufficientBalance = 9002, "INSUFFICIENT_BALANCE", Reject;
    ArithmeticDivisionByZero = 9003, "ARITHMETIC_DIVISION_BY_ZERO", Reject;
    MonetaryInvariantViolated = 9010, "MONETARY_INVARIANT_VIOLATED", Reject;
    MonetaryInvariantViolatedFinalized = 9011, "MONETARY_INVARIANT_VIOLATED_FINALIZED", FailStop;
    MonetaryAuthorizationInvalid = 9020, "MONETARY_AUTHORIZATION_INVALID", Reject;
    MintAuthorizationConsumed = 9021, "MINT_AUTHORIZATION_CONSUMED", Reject;
    MintAuthorizationExpired = 9022, "MINT_AUTHORIZATION_EXPIRED", Reject;
    MonetaryCapacityExceeded = 9023, "MONETARY_CAPACITY_EXCEEDED", Reject;
    EpochIssuanceCapExceeded = 9024, "EPOCH_ISSUANCE_CAP_EXCEEDED", Reject;
    ReserveAttestationStale = 9025, "RESERVE_ATTESTATION_STALE", Reject;
    ReserveRatioInsufficient = 9026, "RESERVE_RATIO_INSUFFICIENT", Reject;
    AssetNotIssuable = 9027, "ASSET_NOT_ISSUABLE", Reject;
    InsufficientLocked = 9028, "INSUFFICIENT_LOCKED", Reject;
    AttestationRejected = 9029, "ATTESTATION_REJECTED", Reject;
    FinalizeOutOfOrder = 11001, "FINALIZE_OUT_OF_ORDER", FailStop;
    FinalizeParentMismatch = 11002, "FINALIZE_PARENT_MISMATCH", FailStop;
    FinalizeStateDiverged = 11003, "FINALIZE_STATE_DIVERGED", FailStop;
    ProtocolVersionUnsupported = 12001, "PROTOCOL_VERSION_UNSUPPORTED", Reject;
    ProtocolUpgradeRequired = 12002, "PROTOCOL_UPGRADE_REQUIRED", FailStop;
    VmPackageMalformed = 13001, "VM_PACKAGE_MALFORMED", Reject;
    VmVerifyFailed = 13002, "VM_VERIFY_FAILED", Reject;
    VmOutOfEu = 13100, "VM_OUT_OF_EU", Reject;
    VmOverflow = 13101, "VM_OVERFLOW", Reject;
    VmDivisionByZero = 13102, "VM_DIVISION_BY_ZERO", Reject;
    VmIndexOutOfRange = 13103, "VM_INDEX_OUT_OF_RANGE", Reject;
    VmListFull = 13104, "VM_LIST_FULL", Reject;
    VmNothingToUnwrap = 13105, "VM_NOTHING_TO_UNWRAP", Reject;
    VmConversionOutOfRange = 13106, "VM_CONVERSION_OUT_OF_RANGE", Reject;
    VmLoopBoundExceeded = 13107, "VM_LOOP_BOUND_EXCEEDED", Reject;
    VmInsufficientVault = 13108, "VM_INSUFFICIENT_VAULT", Reject;
    VmInsufficientCoins = 13109, "VM_INSUFFICIENT_COINS", Reject;
    VmMemoryLimit = 13110, "VM_MEMORY_LIMIT", Reject;
    VmContractAborted = 13111, "VM_CONTRACT_ABORTED", Reject;
    VmInternal = 13112, "VM_INTERNAL", FailStop;
    VmStorageValueTooLarge = 13113, "VM_STORAGE_VALUE_TOO_LARGE", Reject;
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    #[derive(serde::Deserialize)]
    struct Registry {
        code: Vec<RegistryRow>,
    }

    #[derive(serde::Deserialize)]
    struct RegistryRow {
        code: u32,
        name: String,
        variant: String,
        class: String,
    }

    const REGISTRY: &str = include_str!("../../../docs/aps/APS-0038-error-codes.toml");

    #[test]
    fn error_codes_match_registry() {
        let registry: Registry = toml::from_str(REGISTRY).expect("registry parses");
        assert_eq!(
            registry.code.len(),
            ErrorCode::ALL.len(),
            "row count differs from Rust table"
        );
        for (row, &code) in registry.code.iter().zip(ErrorCode::ALL) {
            assert_eq!(row.code, code.get(), "{}", row.name);
            assert_eq!(row.name, code.name());
            assert_eq!(row.variant, format!("{code:?}"));
            let class = match code.class() {
                ErrorClass::Reject => "reject",
                ErrorClass::FailStop => "fail-stop",
            };
            assert_eq!(row.class, class, "{}", row.name);
        }
    }

    #[test]
    fn codes_and_names_are_unique() {
        let numbers: BTreeSet<u32> = ErrorCode::ALL.iter().map(|c| c.get()).collect();
        let names: BTreeSet<&str> = ErrorCode::ALL.iter().map(|c| c.name()).collect();
        assert_eq!(numbers.len(), ErrorCode::ALL.len());
        assert_eq!(names.len(), ErrorCode::ALL.len());
    }

    #[test]
    fn from_code_inverts_get() {
        for &code in ErrorCode::ALL {
            assert_eq!(ErrorCode::from_code(code.get()), Some(code));
        }
        assert_eq!(ErrorCode::from_code(0), None);
    }
}
