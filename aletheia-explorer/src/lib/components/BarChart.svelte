<script lang="ts">
  import { grouped } from "$lib/format/display";

  // A hand-drawn bar chart: gold bars on gilt baselines, a light grid, labelled axes, the
  // exact value on hover, and the same data as a table one click away.
  type Bar = { label: string; value: number; title?: string };
  let {
    bars,
    unit,
    caption,
    height = 200,
  }: { bars: readonly Bar[]; unit: string; caption: string; height?: number } = $props();

  let showData = $state(false);
  const W = 1000;
  const PAD_L = 52;
  const PAD_B = 28;
  const PAD_T = 12;
  const max = $derived(Math.max(1, ...bars.map((b) => b.value)));
  // A round top for the axis: 1, 2 or 5 times a power of ten.
  const top = $derived.by(() => {
    const p = 10 ** Math.floor(Math.log10(max));
    return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= max) ?? max;
  });
  const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f)));
  const step = $derived((W - PAD_L) / Math.max(1, bars.length));
  const y = (v: number) => PAD_T + (height - PAD_T - PAD_B) * (1 - v / top);
  const labelEvery = $derived(Math.max(1, Math.ceil(bars.length / 8)));
</script>

<figure class="chart">
  <figcaption class="head">
    <span class="caption">{caption}</span>
    <button type="button" class="toggle" onclick={() => (showData = !showData)} aria-expanded={showData}>
      {showData ? "Show chart" : "Show data"}
    </button>
  </figcaption>

  {#if !showData}
    <div class="plot" style:height="{height}px">
      <!-- Axis labels are HTML so they stay crisp while the bars stretch to the width. -->
      <div class="y-axis" aria-hidden="true">
        {#each ticks as tick (tick)}
          <span style:top="{(y(tick) / height) * 100}%">{grouped(tick)}</span>
        {/each}
      </div>
      <svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" role="img" aria-label={caption}>
        {#each ticks as tick (tick)}
          <line x1={PAD_L} x2={W} y1={y(tick)} y2={y(tick)} class="grid" />
        {/each}
        {#each bars as bar, i (bar.label + i)}
          {@const h = Math.max(bar.value > 0 ? 1.5 : 0, y(0) - y(bar.value))}
          <rect x={PAD_L + i * step + step * 0.16} y={y(0) - h} width={step * 0.68} height={h} rx="1.5" class="bar">
            <title>{bar.title ?? bar.label}: {grouped(bar.value)} {unit}</title>
          </rect>
        {/each}
        <line x1={PAD_L} x2={W} y1={y(0)} y2={y(0)} class="base" />
      </svg>
      <div class="x-axis" aria-hidden="true">
        {#each bars as bar, i (bar.label + i)}
          {#if i % labelEvery === 0}
            <span style:left="{((PAD_L + i * step + step / 2) / W) * 100}%">{bar.label}</span>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <div class="table">
      <table class="scan">
        <thead><tr><th>Period</th><th class="r">{unit}</th></tr></thead>
        <tbody>
          {#each bars as bar, i (bar.label + i)}
            <tr><td>{bar.title ?? bar.label}</td><td class="r num">{grouped(bar.value)}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</figure>

<style>
  .chart {
    margin: 0;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.6rem;
  }
  .caption {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-soft);
  }
  .toggle {
    padding: 0.25rem 0.65rem;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.45);
    border-radius: 0.4rem;
    cursor: pointer;
  }
  .toggle:hover {
    border-color: var(--brand-gold);
  }
  .plot {
    position: relative;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .y-axis span,
  .x-axis span {
    position: absolute;
    font-size: var(--fs-2xs);
    font-weight: 600;
    color: var(--text-faint);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .y-axis span {
    left: 0;
    width: calc(5.2% - 0.5rem);
    text-align: right;
    transform: translateY(-50%);
  }
  .x-axis span {
    bottom: 0.1rem;
    transform: translateX(-50%);
  }
  .grid {
    stroke: rgb(255 255 255 / 0.08);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .base {
    stroke: rgb(196 154 78 / 0.7);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .bar {
    fill: var(--brand-gold);
    transition: fill var(--quick) var(--ease);
  }
  .bar:hover {
    fill: var(--brand-gold-bright);
  }
  .table {
    max-height: 16rem;
    overflow: auto;
  }
  .table .scan {
    min-width: 0;
  }
</style>
