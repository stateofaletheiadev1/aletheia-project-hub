<script lang="ts">
  // The full national arms: the quartered shield beneath the radiant star, the laurel and
  // the motto VERITAS IN FOEDERE ("truth in covenant").
  let { height = 180 }: { height?: number } = $props();
  const ratio = 1602 / 1972;
</script>

<img
  src="/brand/arms-{height <= 180 ? 180 : 360}.png"
  srcset="/brand/arms-180.png 146w, /brand/arms-360.png 292w, /brand/arms-720.png 585w"
  sizes="{Math.round(height * ratio)}px"
  width={Math.round(height * ratio)}
  {height}
  alt="Coat of arms of the Sovereign Covenant State of Aletheia, with the motto Veritas in Foedere"
  decoding="async"
/>

<style>
  img {
    display: block;
    height: auto;
    max-width: 100%;
    filter: drop-shadow(0 18px 30px rgb(3 12 58 / 0.45));
  }
</style>
