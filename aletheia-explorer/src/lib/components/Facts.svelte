<script lang="ts">
  // A grid of labelled facts, each a short title and its explanation.
  let { items, columns = 2 }: { items: readonly (readonly [string, string])[]; columns?: number } = $props();
</script>

<div class="facts" style:--cols={columns}>
  {#each items as [title, text] (title)}
    <div class="fact"><strong>{title}</strong><span>{text}</span></div>
  {/each}
</div>

<style>
  .facts {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 0.7rem;
  }
  .fact {
    display: grid;
    gap: 0.35rem;
    align-content: start;
    padding: 0.95rem 1.05rem;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: var(--radius);
  }
  strong {
    color: var(--brand-gold-bright);
  }
  @media (max-width: 52rem) {
    .facts {
      grid-template-columns: 1fr;
    }
  }
</style>
