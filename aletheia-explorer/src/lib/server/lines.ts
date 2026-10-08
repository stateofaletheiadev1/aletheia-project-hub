import type { TransactionView, TxLine } from "$lib/types";

/** One transaction as a stream or list line: who, to whom, how much, and whether it worked. */
export function txLine(tx: TransactionView, timeMs: number): TxLine {
  const legs = tx.transfers ?? (tx.transfer ? [tx.transfer] : []);
  const first = legs[0];
  return {
    txId: tx.txId,
    height: tx.block.height,
    timeMs,
    type: tx.type,
    sender: tx.sender,
    recipient: first?.recipient ?? null,
    asset: first?.asset ?? null,
    amount: legs.length === 0 ? null : legs.reduce((sum, leg) => sum + BigInt(leg.amount), 0n).toString(),
    legs: legs.length,
    ok: (tx.receipt?.status ?? "SUCCESS") === "SUCCESS",
    fee: tx.receipt?.feeCharged ?? "0",
    feeAsset: tx.fee.asset,
    nonce: tx.nonce,
  };
}
