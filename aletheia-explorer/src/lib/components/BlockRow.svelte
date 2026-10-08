<script lang="ts">
  import Icon from "./Icon.svelte";
  import Star from "./Star.svelte";
  import { grouped, short, timeUtc } from "$lib/format/display";
  import type { BlockSummary } from "$lib/types";

  let { block, fresh = false }: { block: BlockSummary; fresh?: boolean } = $props();
</script>

<a class="row" class:fresh href="/blocks/{block.height}">
  <span class="height num">#{grouped(block.height)}</span>
  <span class="main">
    <span class="id mono" title={block.id}>{short(block.id, 14, 8)}</span>
    <span class="meta">
      <Icon name="user" size={13} />
      <span class="word">Proposer</span> <strong>Validator {block.proposer}</strong>
      <span class="sep">·</span>
      <span class="num">{block.txCount} {block.txCount === 1 ? "tx" : "txs"}</span>
    </span>
  </span>
  <span class="side">
    <span class="time num">{timeUtc(block.protocolTimeMs)}</span>
    <span class="final"><Star size={11} /> Finalized</span>
  </span>
</a>

<style>
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 1rem;
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
  /* The block number on a navy plate with a gold rim, in the flag's cream. */
  .height {
    min-width: 5.5rem;
    padding: 0.5rem 0.65rem;
    text-align: center;
    font-size: var(--fs-sm);
    font-weight: 800;
    color: var(--brand-cream);
    background: linear-gradient(160deg, var(--brand-navy), var(--brand-navy-deep));
    border: 1px solid rgb(196 154 78 / 0.6);
    border-radius: 0.6rem;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
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
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    overflow: hidden;
    font-size: var(--fs-xs);
    color: var(--text-faint);
    white-space: nowrap;
  }
  .meta strong {
    font-weight: 700;
    color: var(--text-soft);
  }
  .sep {
    opacity: 0.6;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.3rem;
  }
  .time {
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  /* Finality carries the flag's eight-pointed star. */
  .final {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.18rem 0.55rem 0.18rem 0.45rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.55);
    border-radius: 0.375rem;
  }
  @media (max-width: 30rem) {
    .meta .sep,
    .meta .num,
    .meta .word {
      display: none;
    }
    .height {
      min-width: 4.75rem;
      padding-inline: 0.5rem;
    }
  }
</style>
