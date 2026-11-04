<script lang="ts">
  import { ICONS, type IconName } from "./paths";

  let {
    name,
    size = 20,
    title,
    class: className = "",
  }: { name: IconName; size?: number; title?: string; class?: string } = $props();
</script>

<svg
  class="icon {className}"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.25"
  stroke-linecap="square"
  stroke-linejoin="miter"
  aria-hidden={title ? undefined : "true"}
  role={title ? "img" : undefined}
  focusable="false"
>
  {#if title}<title>{title}</title>{/if}
  <path d={ICONS[name].d} />
</svg>

<style>
  .icon {
    flex: none;
    vertical-align: middle;
    overflow: visible;
  }
</style>
