<script lang="ts">
  // The Network Seal (wallet prompt 5.6, M-10): chain ID and network in an engraved circular band.
  // One segment of the band lights per finalized block the wallet observes; if heights stop, the
  // band stops and the seal turns amber with words. Motion here is information.
  import { config } from "$lib/config";
  import { networkLabel } from "$lib/stablechain/network/kind";
  import { groupWhole } from "$lib/formatting/amount";
  import { network } from "$lib/state/network.svelte";
  import { prefs } from "$lib/state/prefs.svelte";
  import { onMount } from "svelte";

  let { size = 200, compact = false, live = true }: { size?: number; compact?: boolean; live?: boolean } = $props();

  onMount(() => (live ? network.use() : undefined));

  const SEGMENTS = 60;
  const c = $derived(size / 2);
  const segments = $derived(
    Array.from({ length: SEGMENTS }, (_, i) => {
      const angle = (i / SEGMENTS) * Math.PI * 2 - Math.PI / 2;
      const r1 = size * (compact ? 0.4 : 0.43);
      const r2 = size * (compact ? 0.47 : 0.475);
      return {
        i,
        x1: c + r1 * Math.cos(angle),
        y1: c + r1 * Math.sin(angle),
        x2: c + r2 * Math.cos(angle),
        y2: c + r2 * Math.sin(angle),
      };
    }),
  );
  const lit = $derived(network.ticks % SEGMENTS);
  const health = $derived(network.health);
  const height = $derived(network.status?.finalizedHeight ?? null);
  const label = $derived(networkLabel(config.network));
  const ringText = $derived(`ALETHEIACHAIN · ${label.toUpperCase()} · CHAIN ${config.chainId} · VERITAS IN FOEDERE · `);
  const textRadius = $derived(size * 0.355);
  const statusWord = $derived(
    health === "live"
      ? "Finalized"
      : health === "stalled"
        ? "Stalled"
        : health === "connecting"
          ? "Connecting"
          : health === "wrong-network"
            ? "Different network"
            : "Unreachable",
  );
  const description = $derived(
    health === "live" && height !== null
      ? `${label}, chain ${config.chainId}. Latest finalized block ${groupWhole(height, prefs.locale)}.`
      : `${label}, chain ${config.chainId}. ${statusWord}.`,
  );
</script>

<figure class="seal {health}" class:compact style:--size="{size}px" style="view-transition-name: seal">
  <svg viewBox="0 0 {size} {size}" width={size} height={size} role="img" aria-label={description}>
    <circle class="rim" cx={c} cy={c} r={size * 0.49} />
    <g class="band">
      {#each segments as s (s.i)}
        <line
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          class:on={health === "live" ? s.i <= lit : health === "stalled" ? s.i <= lit : false}
        />
      {/each}
    </g>
    {#if !compact}
      <circle class="inner" cx={c} cy={c} r={size * 0.3} />
      <defs><path id="seal-ring-{size}" d="M {c} {c - textRadius} a {textRadius} {textRadius} 0 1 1 -0.01 0" /></defs>
      <text class="ring-text"
        ><textPath href="#seal-ring-{size}" textLength={2 * Math.PI * textRadius - 4}>{ringText}</textPath></text
      >
      <text class="eyebrow-text" x={c} y={c - size * 0.1} text-anchor="middle">{statusWord.toUpperCase()}</text>
      <text class="height numerals" x={c} y={c + size * 0.045} text-anchor="middle"
        >{height !== null ? groupWhole(height, prefs.locale) : "—"}</text
      >
      <text class="chain" x={c} y={c + size * 0.15} text-anchor="middle">CHAIN {config.chainId}</text>
    {:else}
      <text class="compact-id numerals" x={c} y={c + size * 0.07} text-anchor="middle">{config.chainId}</text>
    {/if}
  </svg>
</figure>

<style>
  .seal {
    margin: 0;
    width: var(--size);
    height: var(--size);
    flex: none;
    color: var(--seal-ink);
  }

  svg {
    overflow: visible;
  }

  .rim,
  .inner {
    fill: none;
    stroke: var(--rule-control);
    stroke-width: 0.75;
  }

  .inner {
    stroke: var(--rule-hairline);
  }

  .band line {
    stroke: var(--rule-hairline);
    stroke-width: 1.4;
    stroke-linecap: square;
    transition: stroke var(--dur-quick) var(--ease-ink);
  }

  .band line.on {
    stroke: var(--seal-band);
  }

  .stalled .band line.on {
    stroke: var(--state-pending);
  }

  .stalled,
  .stalled .eyebrow-text {
    color: var(--state-pending);
  }

  .unreachable .eyebrow-text,
  .wrong-network .eyebrow-text {
    fill: var(--state-rejected);
  }

  .ring-text {
    fill: var(--ink-secondary);
    font-size: calc(var(--size) * 0.052);
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .eyebrow-text {
    fill: currentColor;
    font-size: calc(var(--size) * 0.05);
    font-weight: 700;
    letter-spacing: 0.16em;
  }

  .stalled .eyebrow-text {
    fill: var(--state-pending);
  }

  .height {
    fill: var(--ink-heading);
    font-size: calc(var(--size) * 0.105);
    font-weight: 400;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums lining-nums;
  }

  .chain {
    fill: var(--ink-muted);
    font-size: calc(var(--size) * 0.045);
    font-weight: 600;
    letter-spacing: 0.14em;
  }

  .compact-id {
    fill: var(--ink-heading);
    font-size: calc(var(--size) * 0.2);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .compact .band line {
    stroke-width: 1.2;
  }
</style>
