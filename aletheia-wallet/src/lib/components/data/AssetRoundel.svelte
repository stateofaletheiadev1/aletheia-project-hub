<script lang="ts">
  // Numismatic roundels for the two native assets (wallet prompt 5.6; DDR-0003). AEY: beaded rim
  // and a rosette ring, as on a coin of account. ALnT: an octagonal inner frame, as on a token.
  import { ringPaths } from "$lib/design/guilloche/guilloche";
  import type { AssetCode } from "$lib/stablechain/assets/assets";

  let { asset, size = 48 }: { asset: AssetCode; size?: number } = $props();
  const c = $derived(size / 2);
  const beads = $derived(
    Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * Math.PI * 2;
      return { i, x: c + size * 0.455 * Math.cos(a), y: c + size * 0.455 * Math.sin(a) };
    }),
  );
  const rosette = $derived(ringPaths(c, c, size * 0.29, size * 0.39, 4, 14, asset === "AEY" ? 1 : 2));
  const octagon = $derived(
    Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return `${c + size * 0.36 * Math.cos(a)},${c + size * 0.36 * Math.sin(a)}`;
    }).join(" "),
  );
</script>

<svg class="roundel {asset}" viewBox="0 0 {size} {size}" width={size} height={size} aria-hidden="true">
  <circle class="field" cx={c} cy={c} r={size * 0.49} />
  {#each beads as b (b.i)}<circle class="bead" cx={b.x} cy={b.y} r={size * 0.012} />{/each}
  {#if asset === "AEY"}
    <g class="rosette"
      >{#each rosette as d, i (i)}<path {d} />{/each}</g
    >
  {:else}
    <polygon class="frame" points={octagon} />
  {/if}
  <text x={c} y={c + size * 0.07} text-anchor="middle" class="glyph" font-size={size * (asset === "AEY" ? 0.2 : 0.17)}
    >{asset}</text
  >
</svg>

<style>
  .roundel {
    flex: none;
  }

  .field {
    fill: var(--surface-sheet);
    stroke: var(--rule-control);
    stroke-width: 0.75;
  }

  .AEY .field {
    stroke: var(--accent-seal);
  }

  .bead {
    fill: var(--rule-control);
  }

  .AEY .bead {
    fill: var(--accent-seal);
  }

  .rosette path {
    fill: none;
    stroke: var(--guilloche-ink);
    stroke-width: 0.35;
    opacity: 0.8;
  }

  .frame {
    fill: none;
    stroke: var(--rule-strong);
    stroke-width: 0.6;
  }

  .glyph {
    fill: var(--ink-heading);
    font-weight: 700;
    letter-spacing: 0.04em;
  }
</style>
