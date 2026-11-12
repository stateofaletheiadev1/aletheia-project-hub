// One error taxonomy for every node interaction (wallet prompt 12.4). The UI maps each kind to
// plain language in `describeChainError`; nothing else reaches people.

import { assertNever } from "../util/brand.js";

export type ChainErrorKind =
  | { kind: "NetworkUnreachable"; detail?: string }
  | { kind: "RateLimited" }
  | { kind: "NodeError"; code: number; name: string; detail: string }
  | { kind: "InvalidResponse"; detail: string }
  | { kind: "WrongNetwork"; detail: string }
  | { kind: "NotFound"; detail: string }
  | { kind: "Rejected"; code: number; name: string; detail: string };

export class ChainError extends Error {
  override name = "ChainError";
  constructor(readonly info: ChainErrorKind) {
    super(`${info.kind}${"detail" in info ? `: ${info.detail}` : ""}`);
  }
}

/**
 * Plain-language translations of protocol error names a transfer can meet. Every key is a name
 * from `crates/core/src/error_codes.rs`; unknown names fall back to generic copy.
 */
const PROTOCOL_NAMES: Record<string, string> = {
  TX_NONCE_TOO_LOW: "This transfer's sequence number was already used. Prepare it again.",
  TX_NONCE_TOO_HIGH: "An earlier transfer from this account has not settled yet. Wait for it, then try again.",
  TX_EXPIRED: "The transfer's validity window closed before the network included it.",
  TX_NOT_YET_VALID: "The transfer is not valid yet.",
  TX_VALIDITY_WINDOW_INVALID: "The transfer's validity window is not acceptable to the network.",
  INSUFFICIENT_BALANCE: "The account does not hold enough for this amount.",
  TX_FEE_UNAFFORDABLE: "The account does not hold enough of the fee asset to pay the fee.",
  TX_MAX_FEE_INSUFFICIENT: "The fee would be higher than the maximum this transfer allows.",
  VM_OUT_OF_EU: "The transfer needs more execution units than it allows.",
  TX_ASSET_UNKNOWN: "The network does not know this asset.",
  TX_KEY_MISMATCH: "This key does not control the sending account.",
  TX_AUTH_MALFORMED: "The transfer's authorization was not in the expected form. Nothing was sent.",
  SIG_INVALID: "The signature did not verify. Nothing was sent.",
  SIG_MALFORMED: "The signature was not in the expected form. Nothing was sent.",
  ADDR_WRONG_NETWORK: "That address belongs to another Aletheia network.",
  ADDR_MALFORMED: "That is not an AletheiaChain address.",
  ADDR_NON_CANONICAL: "The address is not written in its checksummed form.",
};

export function describeProtocolName(name: string): string | null {
  return PROTOCOL_NAMES[name] ?? null;
}

export function describeChainError(error: unknown): { title: string; body: string; technical: string } {
  if (!(error instanceof ChainError)) {
    return {
      title: "Something went wrong",
      body: "The wallet met an unexpected condition. Nothing was sent.",
      technical: String(error),
    };
  }
  const info = error.info;
  switch (info.kind) {
    case "NetworkUnreachable":
      return {
        title: "Network unreachable",
        body: "The wallet cannot reach AletheiaChain right now. Check the connection; nothing is lost.",
        technical: info.detail ?? "the request did not complete",
      };
    case "RateLimited":
      return {
        title: "The node asked us to slow down",
        body: "Too many requests in a short time. The wallet will retry.",
        technical: "HTTP 429 / -32001",
      };
    case "NotFound":
      return { title: "Not found", body: "The network has no finalized record of this yet.", technical: info.detail };
    case "WrongNetwork":
      return {
        title: "Different network",
        body: "The node answered for a different network than this wallet signs for. Signing is off.",
        technical: info.detail,
      };
    case "InvalidResponse":
      return {
        title: "Unexpected answer",
        body: "The node's answer did not have the expected shape, so the wallet did not use it.",
        technical: info.detail,
      };
    case "Rejected":
      return {
        title: "The network declined the transfer",
        body:
          describeProtocolName(info.name) ?? "The network refused this transfer. Nothing was taken from the account.",
        technical: `${info.name} (${info.code}) ${info.detail}`,
      };
    case "NodeError":
      return {
        title: "The node could not answer",
        body: describeProtocolName(info.name) ?? "The node reported a problem with this request.",
        technical: `${info.name || "error"} (${info.code}) ${info.detail}`,
      };
    default:
      return assertNever(info, "chain error");
  }
}
