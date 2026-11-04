<script lang="ts">
  import { bandPaths, ringPaths } from "$lib/design/guilloche/guilloche";

  let {
    variant = "band",
    width = 640,
    height = 28,
    size = 120,
    seed = 3,
    class: className = "",
  }: {
    variant?: "band" | "ring";
    width?: number;
    height?: number;
    size?: number;
    seed?: number;
    class?: string;
  } = $props();

  const paths = $derived(
    variant === "band"
      ? bandPaths(width, height, 9, seed)
      : ringPaths(size / 2, size / 2, size * 0.36, size * 0.49, 10, 22, seed),
  );
</script>

{#if variant === "band"}
  <svg class="guilloche band {className}" viewBox="0 0 {width} {height}" preserveAspectRatio="none" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="0.5" vector-effect="non-scaling-stroke">
      {#each paths as d, i (i)}<path {d} />{/each}
    </g>
  </svg>
{:else}
  <svg class="guilloche ring {className}" viewBox="0 0 {size} {size}" width={size} height={size} aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="0.45">
      {#each paths as d, i (i)}<path {d} />{/each}
    </g>
  </svg>
{/if}

<style>
  .guilloche {
    color: var(--guilloche-ink);
    pointer-events: none;
  }

  .band {
    opacity: 0.62;
    width: 100%;
    height: var(--band-height, 28px);
  }
</style>
