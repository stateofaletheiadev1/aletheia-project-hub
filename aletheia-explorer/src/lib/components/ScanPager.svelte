<script lang="ts">
  import Icon from "./Icon.svelte";
  import { grouped } from "$lib/format/display";

  // PolygonScan's pager: First ‹ Page n of N › Last. `pages` is null when the total is not
  // known (no index yet): then the pager shows the page number alone and no Last.
  let {
    page,
    pages = null,
    first,
    prev,
    next,
    last = null,
  }: { page: number; pages?: number | null; first: string | null; prev: string | null; next: string | null; last?: string | null } = $props();
</script>

<nav class="pager" aria-label="Pages">
  {#if first}<a href={first}>First</a>{:else}<span class="off">First</span>{/if}
  {#if prev}<a href={prev} aria-label="Previous page"><Icon name="chevronLeft" size={14} stroke={2.2} /></a>{:else}<span class="off"><Icon name="chevronLeft" size={14} stroke={2.2} /></span>{/if}
  <span class="where num">Page {grouped(page)}{pages !== null ? ` of ${grouped(pages)}` : ""}</span>
  {#if next}<a href={next} aria-label="Next page"><Icon name="chevronRight" size={14} stroke={2.2} /></a>{:else}<span class="off"><Icon name="chevronRight" size={14} stroke={2.2} /></span>{/if}
  {#if pages !== null}{#if last}<a href={last}>Last</a>{:else}<span class="off">Last</span>{/if}{/if}
</nav>

<style>
  .pager {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  a,
  .off,
  .where {
    display: inline-flex;
    align-items: center;
    height: 1.9rem;
    padding: 0 0.6rem;
    font-size: var(--fs-xs);
    font-weight: 700;
    border-radius: 0.4rem;
    border: 1px solid rgb(196 154 78 / 0.4);
    background: var(--brand-navy);
    color: var(--brand-cream);
    white-space: nowrap;
  }
  a {
    transition:
      border-color var(--quick) var(--ease),
      color var(--quick) var(--ease);
  }
  a:hover {
    border-color: var(--brand-gold);
    color: var(--brand-gold-bright);
  }
  .off {
    opacity: 0.4;
  }
  .where {
    background: transparent;
    border-color: transparent;
    color: var(--text-soft);
  }
</style>
