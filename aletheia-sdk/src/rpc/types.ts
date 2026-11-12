// Response shapes of the node's methods (`crates/rpc/src/service.rs`, `encode.rs`), checked at
// runtime. Field names are exactly the node's; nothing here is assumed beyond the source.

import {
  array,
  boolean,
  count,
  literal,
  nullable,
  object,
  optional,
  string,
  units,
  type Infer,
} from "../util/schema.js";

export const METHODS = [
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
  "getAccountHistory",
  "getStateProof",
] as const;
export type Method = (typeof METHODS)[number];

export const NetworkStatus = object({
  chainId: count,
  network: string,
  protocolVersion: count,
  syncing: boolean,
  finalizedHeight: count,
  finalizedBlock: string,
});
export type NetworkStatus = Infer<typeof NetworkStatus>;

export const BlockSummary = object({
  id: string,
  height: count,
  slot: count,
  epoch: count,
  protocolTimeMs: count,
  protocolVersion: count,
  parent: string,
  txCount: count,
  euUsed: count,
  transactions: array(string),
});
export type BlockSummary = Infer<typeof BlockSummary>;

export const ChainParams = object({ chainId: count, protocolVersion: count, feeAssets: array(string) });

export const Account = object({
  address: string,
  exists: boolean,
  nonce: count,
  authScheme: optional(count),
  flags: optional(count),
});
export type Account = Infer<typeof Account>;

export const Balance = object({
  address: string,
  asset: string,
  available: units,
  locked: units,
  display: nullable(string),
  height: count,
});
export type Balance = Infer<typeof Balance>;

export const AssetInfo = object({ id: count, name: string, decimals: count, transferable: boolean });
export type AssetInfo = Infer<typeof AssetInfo>;

export const Supply = object({
  asset: string,
  height: count,
  issuedTotal: units,
  burnedTotal: units,
  circulating: units,
  locked: units,
});
export type Supply = Infer<typeof Supply>;

const Amount = object({ asset: string, amount: units, display: nullable(string) });

export const ReceiptStatus = literal("SUCCESS", "FAILED_EXECUTION", "OUT_OF_EU", "FAILED");
export type ReceiptStatus = Infer<typeof ReceiptStatus>;

export const Simulation = object({
  euUsed: count,
  fee: Amount,
  receipt: object({ status: ReceiptStatus, errorCode: count, errorName: string, euUsed: count }),
});
export type Simulation = Infer<typeof Simulation>;

export const Submitted = object({ txId: string, status: literal("ACCEPTED") });

export const FinalizedTransaction = object({
  txId: string,
  status: literal("FINALIZED"),
  block: object({ height: count, id: string, slot: count, index: count }),
  sender: string,
  nonce: count,
  type: string,
  txType: count,
  fee: object({ asset: string, maxFee: units, euLimit: count }),
  validFromSlot: count,
  expirySlot: count,
  transfer: optional(object({ recipient: string, asset: string, amount: units, display: nullable(string) })),
  receipt: optional(
    object({
      status: ReceiptStatus,
      errorCode: count,
      errorName: string,
      euUsed: count,
      feeCharged: units,
      events: count,
    }),
  ),
});
export type FinalizedTransaction = Infer<typeof FinalizedTransaction>;

export const AccountHistory = object({
  address: string,
  transactions: array(FinalizedTransaction),
  next: nullable(string),
});
export type AccountHistory = Infer<typeof AccountHistory>;

export const Receipt = object({
  txId: string,
  height: count,
  index: count,
  status: ReceiptStatus,
  errorCode: count,
  errorName: string,
  euUsed: count,
  fee: Amount,
  block: string,
});
export type Receipt = Infer<typeof Receipt>;

/** `getStateProof` (node ADR-065): check it with `verifyStateProof` against a trusted root. */
export const StateProofAnswer = object({
  record: literal("account", "balance", "supply"),
  height: count,
  block: string,
  stateRoot: string,
  key: string,
  value: nullable(string),
  proof: string,
});
export type StateProofAnswer = Infer<typeof StateProofAnswer>;
