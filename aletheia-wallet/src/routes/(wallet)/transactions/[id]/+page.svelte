<script lang="ts">
  // The transaction record (wallet prompt 8): S-5 rule at the top, every field the node reports,
  // the receipt, and the Explorer link. Read from the node; a transfer the node has not finalized
  // is shown from this wallet's own record as pending, never as final.
  import { page } from "$app/state";
  import StatusStation from "$lib/components/data/StatusStation.svelte";
  import Identifier from "$lib/components/data/Identifier.svelte";
  import Denomination from "$lib/components/data/Denomination.svelte";
  import Timestamp from "$lib/components/data/Timestamp.svelte";
  import RuledSkeleton from "$lib/components/feedback/RuledSkeleton.svelte";
  import ErrorSheet from "$lib/components/feedback/ErrorSheet.svelte";
  import EmptyState from "$lib/components/feedback/EmptyState.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import { config, explorer } from "$lib/config";
  import { parseTxId } from "$lib/stablechain/addresses/identifiers";
  import { ChainError, describeChainError, describeProtocolName } from "$lib/stablechain/rpc/errors";
  import type { FinalizedTransaction, Receipt } from "$lib/stablechain/rpc/types";
  import { groupWhole } from "$lib/formatting/amount";
  import { chain } from "$lib/state/chain";
  import { ledger, assetDecimals } from "$lib/state/ledger.svelte";
  import { prefs } from "$lib/state/prefs.svelte";

  const id = $derived(page.params.id ?? "");
  const valid = $derived.by(() => {
    try {
      parseTxId(id, config.network);
      return true;
    } catch {
      return false;
    }
  });
  const local = $derived(ledger.activity.find((r) => r.txId === id) ?? null);

  let tx = $state<FinalizedTransaction | null>(null);
  let receipt = $state<Receipt | null>(null);
  let missing = $state(false);
  let problem = $state<ReturnType<typeof describeChainError> | null>(null);
  let loading = $state(true);

  async function load(txId: string) {
    loading = true;
    problem = null;
    try {
      tx = await chain.transaction(txId);
      missing = false;
      receipt = await chain.receipt(txId).catch(() => null);
    } catch (error) {
      if (error instanceof ChainError && error.info.kind === "NotFound") missing = true;
      else problem = describeChainError(error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (valid) void load(id);
    else loading = false;
  });

  // While pending, look again when the local record changes state.
  $effect(() => {
    if (missing && local && local.status !== "submitted") void load(id);
  });

  const station = $derived(
    tx ? 4 : local?.status === "submitted" ? 3 : local?.status === "expired" ? 2 : local?.status === "rejected" ? 1 : 0,
  );
  const tone = $derived(
    tx
      ? tx.receipt?.status === "SUCCESS"
        ? "finalized"
        : "rejected"
      : local?.status === "expired"
        ? "expired"
        : local?.status === "rejected"
          ? "rejected"
          : "progress",
  );
</script>

<svelte:head><title>Transaction · Aletheia Wallet</title></svelte:head>

<div class="record">
  <header class="settle">
    <p class="eyebrow">Transaction record</p>
    <h1>{tx?.transfer ? "Transfer" : local ? "Transfer" : "Transaction"}</h1>
    {#if valid}<Identifier value={id} label="Transaction id" />{/if}
  </header>

  {#if !valid}
    <EmptyState scene="marker" title="Not a transaction id"
      >AletheiaChain transaction ids begin with alt:T followed by 64 characters, written in their checksummed form.</EmptyState
    >
  {:else if loading && !tx}
    <RuledSkeleton rows={6} label="Reading the transaction" />
  {:else if problem}
    <ErrorSheet title={problem.title} body={problem.body} technical={problem.technical}>
      {#snippet actions()}<Button variant="quiet" onclick={() => load(id)}>Try again</Button>{/snippet}
    </ErrorSheet>
  {:else if tx || local}
    <section class="rule-wrap">
      <StatusStation
        {station}
        {tone}
        note={tx && tx.receipt && tx.receipt.status !== "SUCCESS"
          ? (describeProtocolName(tx.receipt.errorName) ?? "Included but failed on chain; the fee was charged.")
          : !tx && local?.status === "submitted"
            ? "Submitted to the network and awaiting finality."
            : null}
      />
    </section>

    <dl class="fields">
      <div>
        <dt class="eyebrow">Amount</dt>
        <dd>
          {#if tx?.transfer}<Denomination
              units={BigInt(tx.transfer.amount)}
              decimals={assetDecimals(tx.transfer.asset)}
              code={tx.transfer.asset}
              size="title"
              precision="full"
            />
          {:else if local}<Denomination
              units={BigInt(local.amount)}
              decimals={assetDecimals(local.asset)}
              code={local.asset}
              size="title"
              precision="full"
            />{/if}
        </dd>
      </div>
      <div>
        <dt class="eyebrow">From</dt>
        <dd>
          <Identifier
            value={tx?.sender ?? local?.sender ?? ""}
            label="From"
            href={explorer.address(tx?.sender ?? local?.sender ?? "")}
          />
        </dd>
      </div>
      <div>
        <dt class="eyebrow">To</dt>
        <dd>
          <Identifier
            value={tx?.transfer?.recipient ?? local?.recipient ?? ""}
            label="To"
            href={explorer.address(tx?.transfer?.recipient ?? local?.recipient ?? "")}
          />
        </dd>
      </div>
      {#if local?.memo}<div>
          <dt class="eyebrow">Memo</dt>
          <dd>{local.memo}</dd>
        </div>{/if}
      {#if tx}
        <div>
          <dt class="eyebrow">Block</dt>
          <dd class="numerals">
            {groupWhole(tx.block.height, prefs.locale)} · slot {groupWhole(tx.block.slot, prefs.locale)} · position {tx
              .block.index}
          </dd>
        </div>
        <div>
          <dt class="eyebrow">Block id</dt>
          <dd><Identifier value={tx.block.id} label="Block id" truncate /></dd>
        </div>
        <div>
          <dt class="eyebrow">Sequence</dt>
          <dd class="numerals">Nonce {tx.nonce}</dd>
        </div>
        <div>
          <dt class="eyebrow">Fee</dt>
          <dd>
            {#if tx.receipt}<Denomination
                units={BigInt(tx.receipt.feeCharged)}
                decimals={assetDecimals(tx.fee.asset)}
                code={tx.fee.asset}
                precision="full"
              />
              <span class="micro">
                · {groupWhole(tx.receipt.euUsed, prefs.locale)} of {groupWhole(tx.fee.euLimit, prefs.locale)} execution units</span
              >{/if}
          </dd>
        </div>
        <div>
          <dt class="eyebrow">Valid</dt>
          <dd class="numerals">
            Slots {groupWhole(tx.validFromSlot, prefs.locale)} – {groupWhole(tx.expirySlot, prefs.locale)}
          </dd>
        </div>
        {#if receipt}
          <div>
            <dt class="eyebrow">Receipt</dt>
            <dd>
              {receipt.status === "SUCCESS" ? "Success" : receipt.errorName || receipt.status} · {receipt.fee.display ??
                receipt.fee.amount}
              {receipt.fee.asset} charged
            </dd>
          </div>
        {/if}
      {:else if local}
        <div>
          <dt class="eyebrow">Submitted</dt>
          <dd><Timestamp ms={local.seenAt} /></dd>
        </div>
        <div>
          <dt class="eyebrow">Valid until</dt>
          <dd class="numerals">Slot {local.expirySlot !== null ? groupWhole(local.expirySlot, prefs.locale) : "—"}</dd>
        </div>
      {/if}
      {#if local?.finalizedAt}<div>
          <dt class="eyebrow">Seen final</dt>
          <dd><Timestamp ms={local.finalizedAt} /></dd>
        </div>{/if}
    </dl>

    <div class="actions">
      {#if tx}<Button variant="quiet" href={explorer.tx(id)} target="_blank" rel="noopener noreferrer" icon="external"
          >View on the Explorer</Button
        >{/if}
      <Button variant="plain" href="/activity">Back to activity</Button>
    </div>
  {:else if missing}
    <EmptyState scene="marker" title="Not found on the network">
      The node has no finalized transaction with this id. If it was sent moments ago it may not be final yet.
      {#snippet actions()}<Button variant="quiet" onclick={() => load(id)}>Look again</Button>{/snippet}
    </EmptyState>
  {/if}
</div>

<style>
  .record {
    display: grid;
    gap: var(--space-8);
  }

  header {
    display: grid;
    gap: var(--space-2);
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  .rule-wrap {
    padding: var(--space-6) 0;
    border-top: var(--hairline) solid var(--rule-strong);
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  .fields > div {
    display: grid;
    grid-template-columns: 14ch minmax(0, 1fr);
    gap: var(--space-4);
    align-items: baseline;
    min-height: var(--row-height);
    padding: var(--space-3) 0;
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  dd {
    margin: 0;
    min-width: 0;
    font-size: var(--type-data);
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .fields > div {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-1);
    }
  }
</style>
