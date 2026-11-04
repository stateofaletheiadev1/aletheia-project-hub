<script lang="ts">
  // An engraved QR code (wallet prompt 9): SVG modules, high error correction, a full quiet zone,
  // no mark over the centre. qrcode-generator computes the matrix; drawing is ours.
  import qrcode from "qrcode-generator";

  let { value, size = 240, label }: { value: string; size?: number; label: string } = $props();

  const QUIET = 4;
  const matrix = $derived.by(() => {
    const qr = qrcode(0, "H");
    qr.addData(value, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) cells.push({ x, y });
    return { n, cells };
  });
  const span = $derived(matrix.n + QUIET * 2);
  const path = $derived(matrix.cells.map(({ x, y }) => `M${x + QUIET} ${y + QUIET}h1v1h-1z`).join(""));
</script>

<svg
  class="qr"
  viewBox="0 0 {span} {span}"
  width={size}
  height={size}
  role="img"
  aria-label={label}
  shape-rendering="crispEdges"
>
  <rect width={span} height={span} class="paper" />
  <path d={path} class="ink" />
</svg>

<style>
  .qr {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .paper {
    fill: var(--qr-paper);
  }

  .ink {
    fill: var(--qr-ink);
  }
</style>
