// The transfer state machine (wallet prompt 13.2). Pure: `transition` maps a state and an event
// to the next state, and refuses any event the state does not accept. "Submitted" is never
// "successful"; only a finalized transaction reported by the node is final (N5).

import { assertNever } from "$lib/types/brand";
import type { ReceiptStatus } from "../rpc/types";

export type FailureReason = { readonly title: string; readonly body: string; readonly technical: string };

export type TransferState =
  | { readonly status: "draft" }
  | { readonly status: "simulating" }
  | { readonly status: "simulationFailed"; readonly reason: FailureReason }
  | { readonly status: "awaitingApproval"; readonly simulatedAt: number }
  | { readonly status: "signing" }
  | { readonly status: "signed"; readonly txId: string; readonly digest: string }
  | { readonly status: "submitted"; readonly txId: string; readonly submittedAt: number }
  | { readonly status: "confirming"; readonly txId: string; readonly submittedAt: number; readonly delayed: boolean }
  | {
      readonly status: "finalized";
      readonly txId: string;
      readonly height: number;
      readonly receipt: ReceiptStatus;
      readonly errorName: string;
    }
  | { readonly status: "rejected"; readonly reason: FailureReason }
  | { readonly status: "expired"; readonly txId: string }
  | { readonly status: "failed"; readonly reason: FailureReason };

export type TransferEvent =
  | { readonly type: "simulate" }
  | { readonly type: "simulated"; readonly at: number }
  | { readonly type: "simulationFailed"; readonly reason: FailureReason }
  | { readonly type: "approve" }
  | { readonly type: "signed"; readonly txId: string; readonly digest: string }
  | { readonly type: "submitted"; readonly at: number }
  | { readonly type: "rejected"; readonly reason: FailureReason }
  | { readonly type: "tracking" }
  | { readonly type: "delayed" }
  | { readonly type: "finalized"; readonly height: number; readonly receipt: ReceiptStatus; readonly errorName: string }
  | { readonly type: "expired" }
  | { readonly type: "failed"; readonly reason: FailureReason }
  | { readonly type: "edit" };

export class TransitionError extends Error {
  override name = "TransitionError";
}

/** States after which nothing more will happen to this transfer. */
export function isTerminal(state: TransferState): boolean {
  switch (state.status) {
    case "finalized":
    case "rejected":
    case "expired":
    case "failed":
    case "simulationFailed":
      return true;
    case "draft":
    case "simulating":
    case "awaitingApproval":
    case "signing":
    case "signed":
    case "submitted":
    case "confirming":
      return false;
    default:
      return assertNever(state, "transfer state");
  }
}

/** The station on the finality rule (S-5): Signed → Submitted → Included → Finalized. */
export function stationOf(state: TransferState): 0 | 1 | 2 | 3 | 4 {
  switch (state.status) {
    case "draft":
    case "simulating":
    case "simulationFailed":
    case "awaitingApproval":
    case "signing":
      return 0;
    case "signed":
    case "rejected":
    case "failed":
      return 1;
    case "submitted":
    case "expired":
      return 2;
    case "confirming":
      return 3;
    case "finalized":
      return 4;
    default:
      return assertNever(state, "transfer state");
  }
}

export function transition(state: TransferState, event: TransferEvent): TransferState {
  const refuse = (): never => {
    throw new TransitionError(`event "${event.type}" is not accepted in state "${state.status}"`);
  };
  // A failure can end any non-terminal state.
  if (event.type === "failed") return isTerminal(state) ? refuse() : { status: "failed", reason: event.reason };
  switch (state.status) {
    case "draft":
      return event.type === "simulate" ? { status: "simulating" } : refuse();
    case "simulating":
      if (event.type === "simulated") return { status: "awaitingApproval", simulatedAt: event.at };
      if (event.type === "simulationFailed") return { status: "simulationFailed", reason: event.reason };
      if (event.type === "edit") return { status: "draft" };
      return refuse();
    case "simulationFailed":
      return event.type === "edit" ? { status: "draft" } : refuse();
    case "awaitingApproval":
      if (event.type === "approve") return { status: "signing" };
      if (event.type === "edit") return { status: "draft" };
      if (event.type === "simulate") return { status: "simulating" };
      return refuse();
    case "signing":
      if (event.type === "signed") return { status: "signed", txId: event.txId, digest: event.digest };
      if (event.type === "edit") return { status: "draft" };
      return refuse();
    case "signed":
      if (event.type === "submitted") return { status: "submitted", txId: state.txId, submittedAt: event.at };
      if (event.type === "rejected") return { status: "rejected", reason: event.reason };
      return refuse();
    case "submitted":
      if (event.type === "tracking")
        return { status: "confirming", txId: state.txId, submittedAt: state.submittedAt, delayed: false };
      if (event.type === "finalized")
        return {
          status: "finalized",
          txId: state.txId,
          height: event.height,
          receipt: event.receipt,
          errorName: event.errorName,
        };
      if (event.type === "expired") return { status: "expired", txId: state.txId };
      return refuse();
    case "confirming":
      if (event.type === "delayed") return { ...state, delayed: true };
      if (event.type === "tracking") return state;
      if (event.type === "finalized")
        return {
          status: "finalized",
          txId: state.txId,
          height: event.height,
          receipt: event.receipt,
          errorName: event.errorName,
        };
      if (event.type === "expired") return { status: "expired", txId: state.txId };
      return refuse();
    case "finalized":
    case "rejected":
    case "expired":
    case "failed":
      return refuse();
    default:
      return assertNever(state, "transfer state");
  }
}
