<script lang="ts">
  import { sealLayers, TICK_COUNT } from "$lib/seal/guilloche";

  // The block's own seal (spec 41A.6): rose-engine line-work from the block hash, engraved
  // as on a banknote. Ornament and recognition, never proof.
  let { id, size = 128 }: { id: string; size?: number } = $props();

  const bytes = $derived.by(() => {
    const hex = id.replace(/^alt:B/, "");
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
    return out;
  });
  const layers = $derived(sealLayers(bytes));
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const a = (i * 3 * Math.PI) / 180;
    const long = i % 10 === 0;
    return { x1: Math.cos(a) * (long ? 44.6 : 45.5), y1: Math.sin(a) * (long ? 44.6 : 45.5), x2: Math.cos(a) * 47, y2: Math.sin(a) * 47 };
  });
</script>

<svg class="seal" width={size} height={size} viewBox="-50 -50 100 100" fill="none" aria-hidden="true">
  <circle r="49.2" class="rim" />
  <circle r="47.6" class="rim thin" />
  {#each ticks as t, i (i)}<line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />{/each}
  {#each layers as layer, i (i)}<path d={layer.d} opacity={layer.opacity} />{/each}
</svg>

<style>
  .seal {
    display: block;
    flex: none;
    stroke: var(--brand-gold-bright);
    stroke-width: 0.55;
  }
  .rim {
    stroke-width: 0.8;
  }
  .rim.thin {
    stroke-width: 0.35;
  }
  line {
    stroke-width: 0.4;
  }
</style>
