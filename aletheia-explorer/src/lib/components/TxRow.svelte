<script lang="ts">
  import Icon from "./Icon.svelte";
  import { amountText, grouped, short, typeLabel } from "$lib/format/display";
  import type { TxLine } from "$lib/types";

  let { tx, fresh = false }: { tx: TxLine; fresh?: boolean } = $props();
  const value = $derived(tx.amount !== null && tx.asset !== null ? amountText(tx.amount, tx.asset) : null);
</script>

<a class="row" class:fresh class:failed={!tx.ok} href="/tx/{encodeURIComponent(tx.txId)}">
  <span class="badge" aria-hidden="true"><Icon name="swap" size={16} /></span>
  <span class="main">
    <span class="id mono" title={tx.txId}>{short(tx.txId, 14, 8)}</span>
    <span class="route mono">
      <span title={tx.sender}>{short(tx.sender, 8, 4)}</span>
      <Icon name="arrowRight" size={12} />
      <span title={tx.recipient ?? ""}>{tx.recipient ? short(tx.recipient, 8, 4) : typeLabel(tx.type)}</span>
    </span>
  </span>
  <span class="side">
    {#if value}
      <span class="amount num" title="{value.exact} {tx.asset}">{value.text} <span class="asset">{tx.asset}</span></span>
    {:else}
      <span class="amount kind">{typeLabel(tx.type)}</span>
    {/if}
    <span class="block num">{tx.ok ? "" : "Failed · "}Block #{grouped(tx.height)}</span>
  </span>
</a>

<style>
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    background: rgb(255 255 255 / 0.045);
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: var(--radius);
    transition:
      background var(--quick) var(--ease),
      border-color var(--quick) var(--ease),
      transform var(--quick) var(--ease);
  }
  .row:hover {
    background: rgb(255 255 255 / 0.075);
    border-color: rgb(196 154 78 / 0.5);
    transform: translateX(2px);
  }
  .fresh {
    animation: ink-in 420ms var(--ease);
  }
  /* Settled value carries the laurel of the arms. */
  .badge {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.6rem;
    color: var(--brand-laurel-bright);
    background: linear-gradient(160deg, #1d4a39, #15382b);
    border: 1px solid rgb(143 214 173 / 0.4);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
  }
  .failed .badge {
    color: var(--fail);
    background: rgb(255 194 187 / 0.09);
    border-color: rgb(255 194 187 / 0.35);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .id {
    font-size: var(--fs-sm);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .route {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--fs-xs);
    color: var(--text-faint);
    white-space: nowrap;
    overflow: hidden;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.3rem;
  }
  .amount {
    font-size: var(--fs-base);
    font-weight: 800;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .asset {
    font-size: var(--fs-xs);
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--gold);
  }
  .kind {
    font-size: var(--fs-sm);
    color: var(--text-soft);
  }
  .block {
    padding: 0.12rem 0.5rem;
    font-size: var(--fs-2xs);
    font-weight: 700;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.45);
    border-radius: 0.375rem;
    white-space: nowrap;
  }
  .failed .block {
    color: var(--fail);
    border-color: rgb(255 194 187 / 0.4);
  }
</style>
