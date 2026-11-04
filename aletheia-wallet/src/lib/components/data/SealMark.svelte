<script lang="ts">
  // S-3 The Seal: a gold roundel pressed into the sheet as the guilloché ring completes; on unlock
  // it breaks into two halves that slide apart. `state` is driven by real events (Argon2id done,
  // keystore opened), never by a timer.
  import { ringPaths } from "$lib/design/guilloche/guilloche";

  let { state = "idle", size = 168 }: { state?: "idle" | "working" | "sealed" | "broken"; size?: number } = $props();
  const c = $derived(size / 2);
  const ring = $derived(ringPaths(c, c, size * 0.37, size * 0.48, 9, 24, 2));
  const circumference = $derived(2 * Math.PI * size * 0.43);
</script>

<div class="seal-mark {state}" style:--size="{size}px" aria-hidden="true">
  <svg viewBox="0 0 {size} {size}" width={size} height={size} class="ring">
    <g class="guilloche"
      >{#each ring as d, i (i)}<path {d} />{/each}</g
    >
    <circle
      class="trace"
      cx={c}
      cy={c}
      r={size * 0.43}
      style:stroke-dasharray={circumference}
      style:--circ={circumference}
    />
  </svg>
  <div class="halves">
    <svg viewBox="0 0 {size} {size}" width={size} height={size} class="half left">
      <defs><clipPath id="seal-left-{size}"><rect x="0" y="0" width={c} height={size} /></clipPath></defs>
      <g clip-path="url(#seal-left-{size})">
        <circle class="wax" cx={c} cy={c} r={size * 0.3} />
        <circle class="wax-rim" cx={c} cy={c} r={size * 0.255} />
        <text x={c} y={c + size * 0.055} text-anchor="middle" class="monogram" font-size={size * 0.16}>Æ</text>
      </g>
    </svg>
    <svg viewBox="0 0 {size} {size}" width={size} height={size} class="half right">
      <defs><clipPath id="seal-right-{size}"><rect x={c} y="0" width={c} height={size} /></clipPath></defs>
      <g clip-path="url(#seal-right-{size})">
        <circle class="wax" cx={c} cy={c} r={size * 0.3} />
        <circle class="wax-rim" cx={c} cy={c} r={size * 0.255} />
        <text x={c} y={c + size * 0.055} text-anchor="middle" class="monogram" font-size={size * 0.16}>Æ</text>
      </g>
    </svg>
  </div>
</div>

<style>
  .seal-mark {
    position: relative;
    width: var(--size);
    height: var(--size);
  }

  .ring,
  .halves,
  .half {
    position: absolute;
    inset: 0;
  }

  .guilloche path {
    fill: none;
    stroke: var(--guilloche-ink);
    stroke-width: 0.4;
    opacity: 0.25;
    transition: opacity var(--dur-considered) var(--ease-ink);
  }

  .sealed .guilloche path,
  .broken .guilloche path {
    opacity: 0.85;
  }

  .trace {
    fill: none;
    stroke: var(--accent-seal);
    stroke-width: 1.2;
    stroke-dashoffset: var(--circ);
    transform: rotate(-90deg);
    transform-origin: center;
  }

  .working .trace {
    animation: trace 2.4s var(--ease-paper) infinite;
  }

  .sealed .trace,
  .broken .trace {
    stroke-dashoffset: 0;
    transition: stroke-dashoffset var(--dur-ceremony) var(--ease-paper);
  }

  @keyframes trace {
    50% {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: calc(var(--circ) * -1);
    }
  }

  .wax {
    fill: var(--accent-seal);
  }

  .wax-rim {
    fill: none;
    stroke: var(--surface-sheet);
    stroke-width: 0.8;
    opacity: 0.55;
  }

  .monogram {
    fill: var(--surface-sheet);
    font-weight: 700;
    opacity: 0.9;
  }

  .halves {
    opacity: 0;
    transform: scale(1.3);
  }

  .sealed .halves,
  .broken .halves {
    opacity: 1;
    transform: scale(1);
    transition:
      transform 620ms var(--ease-seal),
      opacity 200ms var(--ease-ink);
  }

  .half {
    transition:
      transform 640ms var(--ease-paper),
      opacity 640ms var(--ease-paper);
  }

  .broken .left {
    transform: translateX(-28%) rotate(-8deg);
    opacity: 0;
  }

  .broken .right {
    transform: translateX(28%) rotate(8deg);
    opacity: 0;
  }

  :global(:root[data-motion="reduce"]) .seal-mark * {
    transition-duration: 150ms !important;
    animation: none !important;
  }
</style>
