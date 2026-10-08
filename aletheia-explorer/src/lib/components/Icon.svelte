<script lang="ts" module>
  // One hand-drawn line icon set: 24-unit grid, 1.6 stroke, round joins. No icon library.
  const PATHS = {
    block: "M12 2.8 3.8 7.4v9.2L12 21.2l8.2-4.6V7.4L12 2.8Z M3.8 7.4 12 12l8.2-4.6 M12 12v9.2",
    activity: "M2.8 12.2h3.9l2.6-6.4 5.2 12.6 2.6-6.2h4.1",
    shield: "M12 2.8 19.4 6v5.3c0 4.6-3.1 8.4-7.4 9.9-4.3-1.5-7.4-5.3-7.4-9.9V6L12 2.8Z M8.6 12.1l2.4 2.4 4.5-4.7",
    vault: "M3 9.2 12 4l9 5.2 M5.2 9.6v7.6 M9.7 9.6v7.6 M14.3 9.6v7.6 M18.8 9.6v7.6 M3 20.2h18",
    search: "M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6Z M15.8 15.8 20.4 20.4",
    swap: "M6.5 7.5h12l-3.2-3.2 M17.5 16.5h-12l3.2 3.2",
    arrowRight: "M4.5 12h15 M13.5 6l6 6-6 6",
    chevronLeft: "M14.5 5.5 8 12l6.5 6.5",
    chevronRight: "M9.5 5.5 16 12l-6.5 6.5",
    copy: "M9 9h10.2v10.2H9z M15 9V4.8H4.8V15H9",
    check: "M5 12.5l4.4 4.4L19 7.3",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.2V12l3.2 2",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20.5c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4",
    network: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z",
    close: "M6 6l12 12 M18 6 6 18",
    layers: "M12 3.5 2.8 8.2 12 13l9.2-4.8L12 3.5Z M2.8 12.2 12 17l9.2-4.8 M2.8 16.2 12 21l9.2-4.8",
    seal: "M12 3l2.1 1.6 2.6-.3 1 2.4 2.4 1-.3 2.6L21 12l-1.6 2.1.3 2.6-2.4 1-1 2.4-2.6-.3L12 21l-2.1-1.6-2.6.3-1-2.4-2.4-1 .3-2.6L3 12l1.6-2.1-.3-2.6 2.4-1 1-2.4 2.6.3L12 3Z M8.7 12.2l2.2 2.2 4.4-4.6",
    alert: "M12 3.5 21.5 20h-19L12 3.5Z M12 10v4.5 M12 17.4v.1",
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 18, stroke = 1.6, label }: { name: IconName; size?: number; stroke?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
>
  <path d={PATHS[name]} />
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
