<script lang="ts">
  import type { Snippet } from "svelte";

  // Small status badges. "final" is navy with gold, "ok" laurel, "fail" red, "plain" neutral.
  let { tone = "plain", children }: { tone?: "final" | "ok" | "fail" | "plain"; children: Snippet } = $props();
</script>

<span class="badge {tone}">{@render children()}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.55rem;
    font-size: var(--fs-xs);
    font-weight: 700;
    border-radius: 0.4rem;
    border: 1px solid;
    white-space: nowrap;
  }
  .final {
    color: var(--brand-cream);
    background: var(--brand-navy);
    border-color: rgb(196 154 78 / 0.6);
  }
  .ok {
    color: var(--brand-laurel-bright);
    background: #1d4a39;
    border-color: rgb(143 214 173 / 0.45);
  }
  .fail {
    color: var(--fail);
    background: rgb(255 194 187 / 0.08);
    border-color: rgb(255 194 187 / 0.45);
  }
  .plain {
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.05);
    border-color: rgb(255 255 255 / 0.16);
  }
</style>
