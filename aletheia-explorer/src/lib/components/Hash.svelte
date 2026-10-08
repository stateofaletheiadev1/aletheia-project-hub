<script lang="ts">
  import CopyButton from "./CopyButton.svelte";

  // A full identifier: never shortened, wraps cleanly, copies exactly.
  let { value, href, tone = "text" }: { value: string; href?: string; tone?: "text" | "accent" | "faint" } = $props();
</script>

<span class="hash {tone}">
  {#if href}<a class="mono" {href}>{value}</a>{:else}<span class="mono">{value}</span>{/if}
  <CopyButton {value} label="Copy {value.startsWith('AL:') ? 'identifier' : 'hash'}" />
</span>

<style>
  .hash {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    max-width: 100%;
  }
  .mono {
    font-size: var(--fs-sm);
    font-weight: 500;
    overflow-wrap: anywhere;
    word-break: break-all;
  }
  a.mono {
    color: var(--accent);
    transition: color var(--quick) var(--ease);
  }
  a.mono:hover {
    color: var(--text);
  }
  .faint .mono {
    color: var(--text-soft);
  }
</style>
