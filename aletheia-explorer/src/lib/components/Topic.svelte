<script lang="ts">
  import type { Snippet } from "svelte";

  // One numbered section of an explanatory page, in a gilt-edged panel.
  let { n, title, wide = false, children }: { n: number; title: string; wide?: boolean; children: Snippet } = $props();
</script>

<section class="panel topic" class:wide>
  <h2><span class="n">{String(n).padStart(2, "0")}</span> {title}</h2>
  {@render children()}
</section>

<style>
  .topic {
    display: grid;
    gap: 1rem;
    align-content: start;
    padding: 1.6rem 1.75rem;
  }
  .wide {
    grid-column: 1 / -1;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding-bottom: 0.9rem;
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.02em;
    border-bottom: 1px solid rgb(196 154 78 / 0.28);
  }
  .n {
    display: inline-grid;
    place-items: center;
    min-width: 2rem;
    height: 2rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.55);
    border-radius: 0.5rem;
  }
  .topic :global(p) {
    font-size: var(--fs-base);
    line-height: 1.7;
    color: var(--text-soft);
  }
  .topic :global(p strong) {
    color: var(--text);
  }
  @media (max-width: 40rem) {
    .topic {
      padding: 1.25rem 1.1rem;
    }
  }
</style>
