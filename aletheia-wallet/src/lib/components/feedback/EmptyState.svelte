<script lang="ts">
  import type { Snippet } from "svelte";
  import IllustrationLine from "./IllustrationLine.svelte";

  let {
    scene = "ledger",
    title,
    children,
    actions,
  }: {
    scene?: "ledger" | "certificate" | "marker" | "vault";
    title: string;
    children?: Snippet;
    actions?: Snippet;
  } = $props();
</script>

<section class="empty settle">
  <IllustrationLine {scene} />
  <h2>{title}</h2>
  {#if children}<div class="body">{@render children()}</div>{/if}
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</section>

<style>
  .empty {
    display: grid;
    justify-items: start;
    gap: var(--space-4);
    padding: var(--space-10) 0;
    max-width: 52ch;
  }

  h2 {
    font-size: var(--type-title);
    font-weight: 500;
    letter-spacing: var(--type-title-track);
  }

  .body {
    color: var(--ink-secondary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
</style>
