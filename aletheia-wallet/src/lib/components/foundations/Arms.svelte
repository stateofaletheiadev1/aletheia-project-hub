<script lang="ts">
  // The arms of the State, from the official asset (never redrawn, wallet prompt 4.2).
  let {
    size = 64,
    decorative = false,
    class: className = "",
  }: { size?: number; decorative?: boolean; class?: string } = $props();
  const height = $derived(Math.round(size * (886 / 720)));
</script>

<img
  class="arms {className}"
  src="/brand/arms-360.png"
  srcset="/brand/arms-180.png 146w, /brand/arms-360.png 292w, /brand/arms-720.png 720w"
  sizes="{size}px"
  width={size}
  {height}
  alt={decorative ? "" : "Arms of the Sovereign Covenant State of Aletheia"}
  decoding="async"
/>

<style>
  .arms {
    height: auto;
    user-select: none;
    -webkit-user-drag: none;
  }
</style>
