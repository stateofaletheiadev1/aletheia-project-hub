<script lang="ts">
  import type { Snippet } from "svelte";

  // One line of a PolygonScan-style overview: a label with its explanation on hover, then the value.
  let { label, hint = "", children }: { label: string; hint?: string; children: Snippet } = $props();
</script>

<div class="row">
  <dt>
    {#if hint}<span class="hint" title={hint} aria-label={hint}>?</span>{/if}
    {label}:
  </dt>
  <dd>{@render children()}</dd>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 15rem minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    padding: 0.8rem 0;
  }
  dt {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-faint);
  }
  .hint {
    display: inline-grid;
    place-items: center;
    width: 1rem;
    height: 1rem;
    flex: none;
    font-size: 0.625rem;
    font-weight: 800;
    color: var(--brand-gold-bright);
    border: 1px solid rgb(196 154 78 / 0.6);
    border-radius: 50%;
    cursor: help;
  }
  dd {
    margin: 0;
    min-width: 0;
    font-size: var(--fs-sm);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  @media (max-width: 44rem) {
    .row {
      grid-template-columns: 1fr;
      gap: 0.35rem;
    }
  }
</style>
