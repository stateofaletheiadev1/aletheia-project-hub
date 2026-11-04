<script lang="ts">
  // Plain-language reason with the technical detail behind a disclosure (wallet prompt 9).
  import type { Snippet } from "svelte";
  import InlineStatus from "./InlineStatus.svelte";

  let {
    title,
    body,
    technical = null,
    actions,
  }: { title: string; body: string; technical?: string | null; actions?: Snippet } = $props();
</script>

<div class="error-sheet">
  <InlineStatus tone="rejected" {title}>{body}</InlineStatus>
  {#if technical}
    <details>
      <summary class="micro">Technical details</summary>
      <code class="numerals">{technical}</code>
    </details>
  {/if}
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
  .error-sheet {
    display: grid;
    gap: var(--space-3);
  }

  details {
    padding-inline-start: var(--space-4);
  }

  summary {
    cursor: pointer;
    min-height: var(--target-min);
  }

  code {
    display: block;
    margin-top: var(--space-2);
    font-family: var(--font-sans);
    font-size: var(--type-micro);
    color: var(--ink-secondary);
    word-break: break-word;
  }

  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
</style>
