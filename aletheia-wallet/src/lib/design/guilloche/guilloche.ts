// Deterministic guilloché (wallet prompt 5.7): banknote security-printing line work, generated
// as SVG paths. Used only on the recovery certificate, the signing review and the finality seal.

const round = (n: number) => Math.round(n * 10) / 10;

/** Interfering waves across a band of `width` × `height`. */
export function bandPaths(width: number, height: number, strands = 9, seed = 3): string[] {
  const out: string[] = [];
  const mid = height / 2;
  for (let s = 0; s < strands; s++) {
    const phase = (s / strands) * Math.PI * 2 + seed;
    const points: string[] = [];
    for (let x = 0; x <= width; x += 3) {
      const t = x / width;
      const y =
        mid +
        Math.sin(t * Math.PI * 2 * 7 + phase) * (height * 0.28) +
        Math.sin(t * Math.PI * 2 * 17 - phase * 1.7) * (height * 0.12) +
        Math.sin(t * Math.PI * 2 * 2 + phase * 0.5) * (height * 0.06);
      points.push(`${round(x)} ${round(y)}`);
    }
    out.push(`M${points.join("L")}`);
  }
  return out;
}

/** A rosette ring between radii `inner` and `outer` around (cx, cy). */
export function ringPaths(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  strands = 12,
  lobes = 18,
  seed = 1,
): string[] {
  const out: string[] = [];
  const mean = (inner + outer) / 2;
  const amplitude = (outer - inner) / 2;
  for (let s = 0; s < strands; s++) {
    const phase = (s / strands) * ((Math.PI * 2) / lobes) * 2 + seed;
    const points: string[] = [];
    const steps = lobes * 16;
    for (let k = 0; k <= steps; k++) {
      const theta = (k / steps) * Math.PI * 2;
      const r =
        mean + amplitude * (0.72 * Math.sin(lobes * theta + phase) + 0.28 * Math.sin(lobes * 3 * theta - phase * 2));
      points.push(`${round(cx + r * Math.cos(theta))} ${round(cy + r * Math.sin(theta))}`);
    }
    out.push(`M${points.join("L")}Z`);
  }
  return out;
}
