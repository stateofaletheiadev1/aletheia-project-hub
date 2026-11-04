<script lang="ts">
  import Arms from "$lib/components/foundations/Arms.svelte";
  let { href = "/", size = 36, descriptor = true }: { href?: string; size?: number; descriptor?: boolean } = $props();
</script>

<a class="wordmark" {href} aria-label="Aletheia Wallet, home">
  <Arms {size} decorative />
  <span class="words">
    <span class="name">Aletheia Wallet</span>
    {#if descriptor}<span class="descriptor">The Private Ledger</span>{/if}
  </span>
</a>

<style>
  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    text-decoration: none;
    color: var(--ink-heading);
  }

  .words {
    display: grid;
    line-height: 1.15;
  }

  .name {
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: -0.005em;
  }

  .descriptor {
    font-size: var(--type-micro);
    font-weight: 500;
    font-style: italic;
    color: var(--ink-secondary);
  }
</style>
