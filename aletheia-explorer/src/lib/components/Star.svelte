<script lang="ts">
  // The eight-pointed star of the national flag. On this site it marks finality: a block or
  // transaction carries it once it is final, and nothing else does.
  let { size = 12, label, hole = "var(--brand-navy)" }: { size?: number; label?: string; hole?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="156 132 264 264"
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
>
  <polygon
    fill="var(--brand-gold)"
    points="288,132 309,213.2 381.3,170.7 338.8,243 420,264 338.8,285 381.3,357.3 309,314.8 288,396 267,314.8 194.7,357.3 237.2,285 156,264 237.2,243 194.7,170.7 267,213.2"
  />
  <circle cx="288" cy="264" r="30" fill={hole} />
</svg>

<style>
  svg {
    display: inline-block;
    flex: none;
    vertical-align: -0.1em;
  }
</style>
