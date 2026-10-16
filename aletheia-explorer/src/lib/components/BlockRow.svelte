<script lang="ts">
  import Ident from "./Ident.svelte";
  import Star from "./Star.svelte";
  import { grouped, timeUtc } from "$lib/format/display";
  import type { BlockSummary } from "$lib/types";

  let { block, fresh = false }: { block: BlockSummary; fresh?: boolean } = $props();
</script>

<a class="row" class:fresh href="/blocks/{block.height}">
  <span class="height num"><span class="hash-sign">#</span>{grouped(block.height)}</span>
  <span class="main">
    <span class="id"><Ident value={block.id} /></span>
    <span class="meta">
      <span class="word">Proposed by</span> <strong>Validator {block.proposer}</strong>
      <span class="sep" aria-hidden="true"></span>
      <span class="num" class:none={block.txCount === 0}>{block.txCount === 0 ? "No" : block.txCount} {block.txCount === 1 ? "transaction" : "transactions"}</span>
    </span>
  </span>
  <span class="side">
    <span class="time num">{timeUtc(block.protocolTimeMs).replace(" UTC", "")}<span class="zone">UTC</span></span>
    <span class="final"><Star size={10} hole="var(--surface)" /> Finalized</span>
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
      border-color var(--quick) var(--ease),
      transform var(--quick) var(--ease);
  }
  .row:hover {
    background: rgb(255 255 255 / 0.06);
    border-color: rgb(196 154 78 / 0.5);
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
    letter-spacing: -0.01em;
    color: var(--brand-cream);
    background: linear-gradient(170deg, var(--brand-navy), var(--brand-navy-deep));
    border: 1px solid rgb(196 154 78 / 0.6);
    border-radius: 0.6rem;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
  }
  .hash-sign {
    margin-right: 0.08em;
    font-weight: 600;
    color: var(--brand-gold);
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
    width: 3px;
    height: 3px;
    margin-inline: 0.2rem;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.6;
  }
  .none {
    opacity: 0.75;
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
    letter-spacing: 0.01em;
  }
  .zone {
    margin-left: 0.3em;
    font-size: var(--fs-2xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }
  /* Finality carries the flag's eight-pointed star. */
  .final {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--fs-2xs);
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--brand-gold-bright);
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
