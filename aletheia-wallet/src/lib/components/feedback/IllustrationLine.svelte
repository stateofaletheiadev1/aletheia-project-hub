<script lang="ts">
  // Engraved line illustrations for empty states and guidance (wallet prompt 9), drawn for this
  // wallet: an open ledger, a folded certificate, a survey marker.
  let { scene }: { scene: "ledger" | "certificate" | "marker" | "vault" } = $props();
</script>

<svg class="illustration" viewBox="0 0 240 150" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    {#if scene === "ledger"}
      <path
        d="M20 118 C60 108 100 108 120 116 C140 108 180 108 220 118 L220 40 C180 30 140 30 120 38 C100 30 60 30 20 40 Z"
      />
      <path d="M120 38 V116" />
      {#each [52, 62, 72, 82, 92] as y (y)}<path d="M34 {y} C60 {y - 6} 92 {y - 6} 108 {y - 2}" opacity="0.7" />{/each}
      {#each [52, 62, 72] as y (y)}<path d="M132 {y - 2} C150 {y - 6} 180 {y - 6} 206 {y}" opacity="0.7" />{/each}
      <path d="M132 86 C150 82 170 82 186 84" stroke-dasharray="2 4" opacity="0.6" />
      <circle cx="196" cy="98" r="9" class="gold" />
      <path d="M191 98 l3.5 3.5 6-7" class="gold" />
    {:else if scene === "certificate"}
      <rect x="40" y="22" width="160" height="108" rx="3" />
      <rect x="48" y="30" width="144" height="92" rx="2" stroke-dasharray="1 3" />
      {#each [50, 64, 78, 92] as y (y)}<path d="M64 {y} H118 M130 {y} H176" opacity="0.7" />{/each}
      <circle cx="170" cy="112" r="14" class="gold" />
      <circle cx="170" cy="112" r="9" class="gold" stroke-dasharray="1.5 2" />
    {:else if scene === "marker"}
      <path d="M10 120 C50 100 90 126 130 108 C170 92 200 112 230 100" opacity="0.6" />
      <path d="M10 134 C60 116 100 140 140 122 C180 106 210 126 230 116" opacity="0.4" />
      <path d="M120 112 V44" />
      <path d="M120 44 L156 54 L120 64" class="gold" />
      <circle cx="120" cy="114" r="4" />
      <path d="M96 114 a24 8 0 1 0 48 0 a24 8 0 1 0 -48 0" stroke-dasharray="2 3" opacity="0.7" />
    {:else}
      <rect x="62" y="40" width="116" height="90" rx="4" />
      <path d="M90 40 V28 a30 30 0 0 1 60 0 V40" />
      <circle cx="120" cy="80" r="16" class="gold" />
      <path d="M120 74 v12 M114 80 h12" class="gold" />
      <path d="M74 120 H166" stroke-dasharray="2 4" opacity="0.6" />
    {/if}
  </g>
</svg>

<style>
  .illustration {
    width: 100%;
    max-width: 240px;
    color: var(--ink-secondary);
  }

  .gold {
    stroke: var(--accent-seal);
  }
</style>
