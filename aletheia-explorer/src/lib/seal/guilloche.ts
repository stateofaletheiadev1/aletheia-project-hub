// Every finalized block gets its own seal (spec 41A.6). The curves are hypotrochoids - the
// path of a pen fixed to a circle rolling inside another circle, the same geometry as a
// rose-engine lathe. The fixed circle has 120 "teeth" because 120 has many divisors: the
// rolling-circle sizes below all close after at most 9 turns, which keeps each path under
// ~2,200 points. Pen ranges were chosen on printed proofs; outside them the line-work turns
// to moire at 96 px.
//
// The seal is ornament and recognition, never proof. It is deterministic to the pixel
// (coordinates rounded to 0.01), not to the bit; the Verify button is the proof (41A.12).

const FIXED_TEETH = 120;
const ROLLING_TEETH = [36, 45, 50, 54, 56, 64, 72] as const;

interface LayerSpec {
  readonly radius: number; // in seal units; the seal's viewBox is -50...50
  readonly penMin: number; // pen distance as a fraction of the rolling circle
  readonly penMax: number;
  readonly samplesPerTurn: number;
  readonly opacity: number;
}

const LAYERS: readonly LayerSpec[] = [
  { radius: 44, penMin: 0.55, penMax: 0.92, samplesPerTurn: 240, opacity: 1 },
  { radius: 31, penMin: 0.42, penMax: 0.85, samplesPerTurn: 200, opacity: 0.82 },
  { radius: 17, penMin: 0.3, penMax: 0.7, samplesPerTurn: 160, opacity: 0.68 },
];

/** Ticks on the outer frame: one every 3 degrees. */
export const TICK_COUNT = 120;

export interface SealLayer {
  readonly d: string;
  readonly opacity: number;
}

export function sealLayers(blockHash: Uint8Array): SealLayer[] {
  if (blockHash.length !== 32) {
    throw new RangeError(`a block hash is 32 bytes; got ${blockHash.length}`);
  }
  return LAYERS.map((layer, i) => {
    const teethByte = blockHash[i * 3] ?? 0;
    const penByte = blockHash[i * 3 + 1] ?? 0;
    const angleByte = blockHash[i * 3 + 2] ?? 0;
    const rolling = ROLLING_TEETH[teethByte % ROLLING_TEETH.length] ?? 0;
    const pen = rolling * (layer.penMin + (penByte / 255) * (layer.penMax - layer.penMin));
    const rotation = (angleByte / 256) * 2 * Math.PI;
    return {
      d: hypotrochoid(FIXED_TEETH, rolling, pen, rotation, layer.radius, layer.samplesPerTurn),
      opacity: layer.opacity,
    };
  });
}

/** The complete seal as standalone SVG, for Open Graph images, print and specimens. */
export function sealSvg(blockHash: Uint8Array, size = 96, color = "currentColor"): string {
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const angle = (i * 3 * Math.PI) / 180;
    const [x1, y1, x2, y2] = [45.5, 45.5, 47, 47].map((r, k) => (k % 2 === 0 ? Math.cos(angle) : Math.sin(angle)) * r) as [number, number, number, number];
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke-width="0.4"/>`;
  }).join("");
  const paths = sealLayers(blockHash)
    .map((layer) => `<path d="${layer.d}" opacity="${layer.opacity}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-50 -50 100 100" ` +
    `fill="none" stroke="${color}" stroke-width="0.6" aria-hidden="true">` +
    `<circle r="49"/><circle r="47.5"/>${ticks}${paths}</svg>`
  );
}

function hypotrochoid(
  fixed: number,
  rolling: number,
  pen: number,
  rotation: number,
  radius: number,
  samplesPerTurn: number,
): string {
  const turns = rolling / gcd(fixed, rolling);
  const ratio = (fixed - rolling) / rolling;
  const scale = radius / (fixed - rolling + pen);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const steps = turns * samplesPerTurn;

  const parts: string[] = [];
  for (let step = 0; step < steps; step++) {
    const t = (step / samplesPerTurn) * 2 * Math.PI;
    const x = (fixed - rolling) * Math.cos(t) + pen * Math.cos(ratio * t);
    const y = (fixed - rolling) * Math.sin(t) - pen * Math.sin(ratio * t);
    const px = scale * (x * cos - y * sin);
    const py = scale * (x * sin + y * cos);
    parts.push(`${step === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  parts.push("Z");
  return parts.join("");
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}
