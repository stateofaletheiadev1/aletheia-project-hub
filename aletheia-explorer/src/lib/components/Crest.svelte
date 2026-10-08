<script lang="ts">
  // The shield of the national arms, simplified for small sizes: gold border, quarters of
  // navy and cream divided by the gold-edged cream cross, and the central hexagon with the
  // cross. The full arms (Arms.svelte) are used wherever there is room for them.
  let { size = 34 }: { size?: number } = $props();
</script>

<svg width={(size * 30) / 34} height={size} viewBox="0 0 30 34" aria-hidden="true">
  <defs>
    <clipPath id="crest-field">
      <path d="M3 3h24v13.2c0 6.6-4.9 11.4-12 14.4C7.9 27.6 3 22.8 3 16.2V3Z" />
    </clipPath>
  </defs>
  <path d="M1.2 1.2h27.6v15.1c0 7.6-5.7 13.3-13.8 16.5C6.9 29.6 1.2 23.9 1.2 16.3V1.2Z" fill="#c49a4e" />
  <g clip-path="url(#crest-field)">
    <rect x="3" y="3" width="24" height="28" fill="#f4eedf" />
    <rect x="3" y="3" width="10.4" height="9.6" fill="#15294a" />
    <rect x="16.6" y="15.8" width="10.4" height="16" fill="#15294a" />
    <rect x="13.4" y="3" width="0.7" height="28" fill="#c49a4e" />
    <rect x="15.9" y="3" width="0.7" height="28" fill="#c49a4e" />
    <rect x="3" y="12.6" width="24" height="0.7" fill="#c49a4e" />
    <rect x="3" y="15.1" width="24" height="0.7" fill="#c49a4e" />
    <!-- Tower and ship, in miniature. -->
    <path d="M6.6 11.6V6.4h1.2V5.2h1v1.2h1.2v5.2H9.3V9.7a.75.75 0 0 0-1.5 0v1.9Z" fill="#f4eedf" />
    <path d="M18.8 24.6h6.4l-1.2 1.6h-4Z M21.7 19.2h.5v5h-.5Z M20 20h3.8l.2 3.2h-4.2Z" fill="#f4eedf" />
  </g>
  <polygon points="15,9.4 19.1,11.8 19.1,16.6 15,19 10.9,16.6 10.9,11.8" fill="#c49a4e" />
  <polygon points="15,10.5 18.2,12.35 18.2,16.05 15,17.9 11.8,16.05 11.8,12.35" fill="#15294a" />
  <rect x="14.45" y="11.6" width="1.1" height="5.4" fill="#f4eedf" />
  <rect x="13.1" y="12.9" width="3.8" height="1.05" fill="#f4eedf" />
</svg>

<style>
  svg {
    display: block;
    flex: none;
    filter: drop-shadow(0 4px 8px rgb(3 12 58 / 0.45));
  }
</style>
