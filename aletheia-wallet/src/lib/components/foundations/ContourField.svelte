<script lang="ts">
  // Contour fields (wallet prompt 5.7, M-01). By default the field is a CSS mask coloured by the
  // theme. `plot` inlines the landing field so its lines can draw themselves in (S-1).
  import { onMount } from "svelte";

  type Field = "landing" | "wallet" | "ceremony";
  let { field = "wallet", plot = false, drift = true }: { field?: Field; plot?: boolean; drift?: boolean } = $props();

  // The inline field loads only when the survey is to be drawn, so other pages do not carry it.
  let plotted = $state<{ width: number; d: string; i: number }[]>([]);
  $effect(() => {
    if (!plot || field !== "landing") {
      plotted = [];
      return;
    }
    void import("$lib/design/contours/landing.svg?raw").then(({ default: raw }) => {
      plotted = [...raw.matchAll(/<path stroke-width="([\d.]+)" d="([^"]+)"\/>/g)].map((m, i) => ({
        width: Number(m[1]),
        d: m[2]!,
        i,
      }));
    });
  });

  let parallax = $state(0);
  onMount(() => {
    if (!drift) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => (parallax = Math.min(12, window.scrollY * 0.03)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  });
</script>

<div class="field" class:drift aria-hidden="true" style:--parallax="{parallax}px">
  {#if plotted.length}
    <svg class="plot" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      <g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">
        {#each plotted as line (line.i)}
          <path d={line.d} stroke-width={line.width} pathLength="1" style:--line={line.i} />
        {/each}
      </g>
    </svg>
  {:else}
    <div class="mask" style:--field="url(/contours/{field}.svg)"></div>
  {/if}
</div>

<style>
  .field {
    position: absolute;
    inset: -24px;
    z-index: var(--z-contour);
    pointer-events: none;
    color: var(--contour-ink);
    opacity: var(--contour-opacity);
    overflow: hidden;
    transform: translateY(calc(var(--parallax, 0px) * -1));
    transition: opacity var(--dur-considered) var(--ease-ink);
  }

  .mask,
  .plot {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .mask {
    background: currentColor;
    mask: var(--field) center / cover no-repeat;
    -webkit-mask: var(--field) center / cover no-repeat;
  }

  .drift .mask,
  .drift .plot {
    animation: contour-drift 64s var(--ease-paper) infinite alternate;
  }

  @keyframes contour-drift {
    to {
      transform: translate3d(-28px, 14px, 0) rotate(0.35deg);
    }
  }

  .plot path {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: survey 1200ms var(--ease-paper) forwards;
    animation-delay: calc(var(--line) * 22ms);
  }

  @keyframes survey {
    to {
      stroke-dashoffset: 0;
    }
  }

  :global(:root[data-motion="reduce"]) .mask,
  :global(:root[data-motion="reduce"]) .plot {
    animation: none;
  }

  :global(:root[data-motion="reduce"]) .plot path {
    animation: none;
    stroke-dashoffset: 0;
  }

  :global(:root[data-motion="reduce"]) .field {
    transform: none;
  }
</style>
