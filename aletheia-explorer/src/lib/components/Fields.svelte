<script lang="ts">
  import type { Snippet } from "svelte";

  // A ruled definition list: label column, value column.
  let { children }: { children: Snippet } = $props();
</script>

<dl class="fields">{@render children()}</dl>

<style>
  .fields {
    margin: 0;
    display: grid;
  }
  .fields :global(> div) {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr);
    gap: 1.25rem;
    align-items: center;
    min-height: 3rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid rgb(255 255 255 / 0.07);
  }
  .fields :global(> div:last-child) {
    border-bottom: 0;
  }
  .fields :global(dt) {
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .fields :global(dd) {
    margin: 0;
    min-width: 0;
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  @media (max-width: 40rem) {
    .fields :global(> div) {
      grid-template-columns: 1fr;
      gap: 0.3rem;
    }
  }
</style>
