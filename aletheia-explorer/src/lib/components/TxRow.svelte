<script lang="ts">
  import Amount from "./Amount.svelte";
  import Blazon from "./Blazon.svelte";
  import Icon from "./Icon.svelte";
  import Ident from "./Ident.svelte";
  import { grouped, typeLabel } from "$lib/format/display";
  import type { TxLine } from "$lib/types";

  let { tx, fresh = false }: { tx: TxLine; fresh?: boolean } = $props();
</script>

<a class="row" class:fresh class:failed={!tx.ok} href="/tx/{encodeURIComponent(tx.txId)}">
  <!-- The sender's shield on a navy plate; the recipient's shield is set at its corner. -->
  <span class="parties" aria-hidden="true">
    <Blazon address={tx.sender} size={20} />
    {#if tx.recipient}<span class="to"><Blazon address={tx.recipient} size={13} /></span>{/if}
  </span>
  <span class="main">
    <span class="id"><Ident value={tx.txId} /></span>
    <span class="route">
      <Ident value={tx.sender} head={4} tail={4} />
      <Icon name="arrowRight" size={11} stroke={2} />
      {#if tx.recipient}<Ident value={tx.recipient} head={4} tail={4} />{:else}<span>{typeLabel(tx.type)}</span>{/if}
    </span>
  </span>
  <span class="side">
    {#if tx.amount !== null && tx.asset !== null}
      <span class="value"><Amount units={tx.amount} asset={tx.asset} /></span>
    {:else}
      <span class="value kind">{typeLabel(tx.type)}</span>
    {/if}
    <span class="block num">{#if !tx.ok}<span class="fail-word">Failed</span>{/if}Block <span class="hash-sign">#</span>{grouped(tx.height)}</span>
  </span>
</a>

<style>
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 1rem;
    min-height: 4.75rem;
    padding: 0.75rem 1rem;
    background: rgb(255 255 255 / 0.035);
    border: 1px solid rgb(255 255 255 / 0.085);
    border-radius: var(--radius);
    box-shadow: var(--edge);
    transition:
      background var(--quick) var(--ease),
      border-color var(--quick) var(--ease);
  }
  .row:hover {
    background: rgb(255 255 255 / 0.06);
    border-color: rgb(196 154 78 / 0.5);
  }
  .fresh {
    animation: ink-in 420ms var(--ease);
  }
  .parties {
    position: relative;
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.7rem;
    background: linear-gradient(170deg, var(--brand-navy), var(--brand-navy-deep));
    border: 1px solid rgb(196 154 78 / 0.5);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
  }
  .to {
    position: absolute;
    right: -0.4rem;
    bottom: -0.4rem;
    display: grid;
    place-items: center;
    width: 1.45rem;
    height: 1.45rem;
    border-radius: 50%;
    background: var(--brand-navy-deep);
    border: 1px solid rgb(196 154 78 / 0.5);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .id {
    font-size: var(--fs-sm);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .route {
    display: flex;
    align-items: center;
    gap: 0.4rem;
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
  .value {
    font-size: var(--fs-base);
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .kind {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-soft);
  }
  .block {
    display: inline-flex;
    gap: 0.25rem;
    padding: 0.1rem 0.45rem;
    font-size: var(--fs-2xs);
    font-weight: 700;
    color: var(--text-soft);
    background: rgb(15 31 58 / 0.45);
    border: 1px solid rgb(196 154 78 / 0.32);
    border-radius: 0.375rem;
    white-space: nowrap;
  }
  .hash-sign {
    margin-right: -0.15rem;
    color: var(--brand-gold);
  }
  .fail-word {
    margin-right: 0.15rem;
    color: var(--fail);
  }
  .failed {
    border-color: rgb(255 194 187 / 0.3);
  }
  .failed .block {
    border-color: rgb(255 194 187 / 0.4);
  }
</style>
