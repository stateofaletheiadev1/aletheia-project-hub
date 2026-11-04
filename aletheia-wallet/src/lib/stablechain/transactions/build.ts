// Building a transfer body (wallet prompt 13.1 steps 1-3; `crates/wallet/src/flow.rs`).
//
// Fee terms must satisfy `available(fee asset) ≥ max_fee ≥ eu_limit × eu_price`
// (`crates/execution/src/rules/v1/mod.rs`). The node does not publish `eu_price`, so pricing is two
// passes: simulate with max_fee = the available fee balance, read price = fee ÷ eu_used exactly,
// then build the final body with a tight eu_limit and max_fee and simulate that.

import type { VerifiedNetwork } from "../network/gate";
import { TX_BODY_VERSION_1, type TransferBody } from "./body";

/** Defaults of `aletheia-cli transfer`. */
export const PRICING_EU_LIMIT = 10_000n;
export const VALIDITY_SLOTS = 1_000n;
/** Head room above the simulated EU so a slightly heavier execution still fits. */
export const EU_MARGIN_PERCENT = 25n;

export interface TransferDraft {
  readonly sender: Uint8Array;
  readonly recipient: Uint8Array;
  readonly asset: number;
  readonly amount: bigint;
  readonly memo: Uint8Array;
  readonly feeAsset: number;
}

export interface ChainFacts {
  readonly nonce: bigint;
  /** The finalized head's slot: the transfer is valid from here. */
  readonly slot: bigint;
}

export interface FeeTerms {
  readonly maxFee: bigint;
  readonly euLimit: bigint;
}

export function buildTransfer(
  draft: TransferDraft,
  network: VerifiedNetwork,
  facts: ChainFacts,
  fee: FeeTerms,
): TransferBody {
  if (draft.amount <= 0n) throw new Error("a transfer moves a positive amount");
  return {
    version: TX_BODY_VERSION_1,
    chainId: network.chainId,
    networkKind: network.kind,
    sender: draft.sender,
    nonce: facts.nonce,
    feeAsset: draft.feeAsset,
    maxFee: fee.maxFee,
    euLimit: fee.euLimit,
    validFromSlot: facts.slot,
    expirySlot: facts.slot + VALIDITY_SLOTS,
    memo: draft.memo,
    recipient: draft.recipient,
    asset: draft.asset,
    amount: draft.amount,
  };
}

/** Terms for the pricing pass: the whole available fee balance as the ceiling. */
export function pricingTerms(feeBalance: bigint): FeeTerms {
  return { maxFee: feeBalance, euLimit: PRICING_EU_LIMIT };
}

export class PricingError extends Error {
  override name = "PricingError";
}

/** Exact EU price from a simulation (fee = eu_used × price, spec Section 23). */
export function priceFrom(euUsed: bigint, fee: bigint): bigint {
  if (euUsed <= 0n) {
    if (fee === 0n) return 0n;
    throw new PricingError("the simulation charged a fee for no execution units");
  }
  if (fee % euUsed !== 0n) throw new PricingError("the simulated fee is not a whole multiple of the units used");
  return fee / euUsed;
}

/** Final terms: eu_limit = eu_used + margin (rounded up), max_fee = eu_limit × price. */
export function finalTerms(euUsed: bigint, price: bigint): FeeTerms {
  const euLimit = euUsed + (euUsed * EU_MARGIN_PERCENT + 99n) / 100n;
  return { euLimit: euLimit > 0n ? euLimit : 1n, maxFee: (euLimit > 0n ? euLimit : 1n) * price };
}
