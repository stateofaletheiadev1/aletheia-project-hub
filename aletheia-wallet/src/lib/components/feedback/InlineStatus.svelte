<script lang="ts">
  // Persistent inline status (wallet prompt 9: not toast). Colour never carries meaning alone:
  // every tone has an icon and words.
  import type { Snippet } from "svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import type { IconName } from "$lib/design/icons/paths";

  type Tone = "info" | "verified" | "pending" | "rejected" | "planned";
  let { tone = "info", title = null, children }: { tone?: Tone; title?: string | null; children?: Snippet } = $props();
  const ICON: Record<Tone, IconName> = {
    info: "info",
    verified: "seal",
    pending: "clock",
    rejected: "warning",
    planned: "pen",
  };
</script>

<div class="status {tone}" role={tone === "rejected" ? "alert" : "status"}>
  <Icon name={ICON[tone]} size={18} />
  <div class="text">
    {#if title}<p class="title">{title}</p>{/if}
    {#if children}<div class="body">{@render children()}</div>{/if}
  </div>
</div>

<style>
  .status {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-3);
    align-items: start;
    padding: var(--space-3) 0 var(--space-3) var(--space-4);
    border-inline-start: var(--rule-thick) solid currentColor;
    color: var(--ink-secondary);
  }

  .status :global(.icon) {
    margin-top: 2px;
  }

  .title {
    font-weight: 700;
    color: var(--ink-heading);
  }

  .body {
    color: var(--ink-secondary);
    font-size: 0.9375rem;
    max-width: var(--measure);
  }

  .verified {
    color: var(--state-verified);
  }

  .pending {
    color: var(--state-pending);
  }

  .rejected {
    color: var(--state-rejected);
  }

  .planned {
    color: var(--ink-muted);
  }

  .verified .title {
    color: var(--state-verified);
  }

  .pending .title {
    color: var(--state-pending);
  }

  .rejected .title {
    color: var(--state-rejected);
  }
</style>
