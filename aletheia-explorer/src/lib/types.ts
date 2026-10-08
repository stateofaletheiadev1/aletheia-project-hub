// What the Explorer shows, as the node's RPC (Section 37) returns it. Amounts and other
// u128 values stay decimal strings end to end; they become BigInt only for arithmetic.

export interface NetworkStatus {
  readonly chainId: number;
  readonly network: string;
  readonly protocolVersion: number;
  readonly finalizedHeight: number;
  readonly finalizedBlock: string;
  readonly syncing: boolean;
  readonly peers: number | null;
}

export interface BlockSummary {
  readonly id: string;
  readonly height: number;
  readonly slot: number;
  readonly epoch: number;
  readonly protocolTimeMs: number;
  readonly protocolVersion: number;
  readonly parent: string;
  readonly proposer: number;
  readonly stateRoot: string;
  readonly txRoot: string;
  readonly receiptRoot: string;
  readonly eventRoot: string;
  readonly euUsed: number;
  readonly txCount: number;
  readonly transactions: readonly string[];
}

export interface TransferLeg {
  readonly recipient: string;
  readonly asset: string;
  readonly amount: string;
}

export interface TransactionView {
  readonly txId: string;
  readonly status: string;
  readonly block: { readonly height: number; readonly id: string; readonly slot: number; readonly index: number };
  readonly sender: string;
  readonly nonce: number;
  readonly type: string;
  readonly txType: number;
  readonly fee: { readonly asset: string; readonly maxFee: string; readonly euLimit: number };
  readonly validFromSlot: number;
  readonly expirySlot: number;
  readonly transfer?: TransferLeg;
  readonly transfers?: readonly TransferLeg[];
  readonly receipt?: {
    readonly status: string;
    readonly errorCode: number;
    readonly errorName: string;
    readonly euUsed: number;
    readonly feeCharged: string;
    readonly events: number;
  };
}

export interface ReceiptEvent {
  readonly emitter: string;
  readonly eventType: string;
  readonly topics: readonly string[];
  readonly data: string;
}

export interface ReceiptView {
  readonly txId: string;
  readonly height: number;
  readonly index: number;
  readonly status: string;
  readonly errorCode: number;
  readonly errorName: string;
  readonly euUsed: number;
  readonly fee: { readonly asset: string; readonly amount: string };
  readonly writeSetHash: string;
  readonly events: readonly ReceiptEvent[];
  readonly block: string;
}

export interface Balance {
  readonly address: string;
  readonly asset: string;
  readonly available: string;
  readonly locked: string;
  readonly height: number;
}

export interface AccountView {
  readonly address: string;
  readonly exists: boolean;
  readonly nonce: number;
}

export interface Supply {
  readonly asset: string;
  readonly height: number;
  readonly issuedTotal: string;
  readonly burnedTotal: string;
  readonly redeemedTotal: string;
  readonly circulating: string;
  readonly locked: string;
  readonly reserved: string;
  readonly bridgeEscrow: string;
  readonly physicalCashOutstanding: string;
  readonly authorizedCapacity: string;
  readonly outstandingLiabilities: string;
}

export interface ValidatorSet {
  readonly epoch: number;
  readonly height: number;
  /** "validator-set" on networks with a recorded set; "single-producer" on a devnet run by one node. */
  readonly mode: "validator-set" | "single-producer";
  readonly totalVotingPower: string;
  readonly validators: readonly { readonly index: number; readonly consensusKey: string; readonly nodeKey: string; readonly votingPower: string }[];
}

/** One line of the live transaction stream. */
export interface TxLine {
  readonly txId: string;
  readonly height: number;
  readonly timeMs: number;
  readonly type: string;
  readonly sender: string;
  readonly recipient: string | null;
  readonly asset: string | null;
  readonly amount: string | null;
  readonly legs: number;
  readonly ok: boolean;
  /** Fee charged, in base units of `feeAsset` ("0" if no receipt is known yet). */
  readonly fee: string;
  readonly feeAsset: string;
  readonly nonce: number;
}

export interface Stats {
  readonly online: boolean;
  readonly network: string;
  readonly chainId: number;
  readonly protocolVersion: number;
  readonly height: number;
  readonly epoch: number;
  /** Transactions in blocks the Explorer has counted, and whether that reaches genesis. */
  readonly totalTxs: number;
  readonly countedFromGenesis: boolean;
  readonly avgBlockMs: number | null;
  /** Protocol time of the latest finalized block. */
  readonly latestTimeMs: number | null;
  /** Transactions in blocks finalized within the last minute of protocol time. */
  readonly txsLastMinute: number;
  readonly proposers: number;
  /** The recorded validator set's size and mode, from getValidatorSet. */
  readonly validators: number | null;
  readonly validatorMode: "validator-set" | "single-producer" | null;
  readonly aeyOutstanding: string | null;
  readonly alntOutstanding: string | null;
}

/** What the live stream sends: a snapshot on connect, then one message per new block. */
export type StreamMessage =
  | { readonly kind: "snapshot"; readonly stats: Stats; readonly blocks: readonly BlockSummary[]; readonly txs: readonly TxLine[] }
  | { readonly kind: "block"; readonly stats: Stats; readonly block: BlockSummary; readonly txs: readonly TxLine[] }
  | { readonly kind: "stats"; readonly stats: Stats };
