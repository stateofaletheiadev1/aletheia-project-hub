<script lang="ts">
  // The national flag of the Sovereign Covenant State of Aletheia, redrawn from the official artwork
  // (1800 × 1200): navy field, a cream Nordic cross fimbriated in gold, and the gold
  // eight-pointed star in the canton.
  let { width = 48, label = "Flag of the Sovereign Covenant State of Aletheia" }: { width?: number; label?: string } = $props();
</script>

<svg {width} height={(width * 2) / 3} viewBox="0 0 1800 1200" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : "true"}>
  <rect width="1800" height="1200" fill="#15294a" />
  <rect x="552" width="336" height="1200" fill="#c49a4e" />
  <rect y="432" width="1800" height="336" fill="#c49a4e" />
  <rect x="600" width="240" height="1200" fill="#f4eedf" />
  <rect y="480" width="1800" height="240" fill="#f4eedf" />
  <polygon
    fill="#c49a4e"
    points="288,132 309,213.2 381.3,170.7 338.8,243 420,264 338.8,285 381.3,357.3 309,314.8 288,396 267,314.8 194.7,357.3 237.2,285 156,264 237.2,243 194.7,170.7 267,213.2"
  />
  <circle cx="288" cy="264" r="26" fill="#15294a" />
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
