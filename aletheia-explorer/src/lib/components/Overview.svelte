<script lang="ts">
  import type { Snippet } from "svelte";

  // The overview card: rows in groups, groups divided by a gold hairline as on PolygonScan.
  let { children }: { children: Snippet } = $props();
</script>

<dl class="overview">{@render children()}</dl>

<style>
  .overview {
    margin: 0;
  }
  .overview :global(hr) {
    margin: 0.4rem 0;
    border: 0;
    border-top: 1px solid rgb(196 154 78 / 0.25);
  }
</style>
