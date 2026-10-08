<script lang="ts">
  // The State's flag with the hexagon cross, redrawn from the official artwork
  // (1800 × 1200): navy field, a cream band between gold stripes, and at its centre the
  // gold-rimmed navy hexagon bearing the cream cross, ringed by eight gold roundels.
  let { width = 48, label = "Flag of the Sovereign Covenant State of Aletheia with the hexagon cross" }: { width?: number; label?: string } = $props();
  const roundels: [number, number][] = [
    [900, 350],
    [1095, 424],
    [1176, 600],
    [1095, 776],
    [900, 849],
    [705, 776],
    [624, 600],
    [705, 424],
  ];
</script>

<svg {width} height={(width * 2) / 3} viewBox="0 0 1800 1200" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : "true"}>
  <rect width="1800" height="1200" fill="#15294a" />
  <rect y="276" width="1800" height="648" fill="#c49a4e" />
  <rect y="300" width="1800" height="600" fill="#f4eedf" />
  <polygon points="900,375 1095,488 1095,712 900,825 705,712 705,488" fill="#c49a4e" />
  <polygon points="900,394 1079,497 1079,703 900,806 721,703 721,497" fill="#15294a" />
  <polygon points="900,413 1061,506 1061,694 900,787 739,694 739,506" fill="none" stroke="#c49a4e" stroke-width="6" />
  <rect x="881" y="481" width="38" height="238" fill="#f4eedf" />
  <rect x="822" y="537" width="156" height="37" fill="#f4eedf" />
  {#each roundels as [cx, cy] (`${cx},${cy}`)}
    <circle {cx} {cy} r="17" fill="#c49a4e" />
  {/each}
</svg>

<style>
  svg {
    display: block;
    flex: none;
    border-radius: 3px;
    box-shadow:
      0 0 0 1px rgb(255 255 255 / 0.18),
      0 6px 14px -8px rgb(3 12 58 / 0.7);
  }
</style>
