// Procedural bathymetric contour fields (brief §6.5.3).
// A seeded fractal noise field is traced with marching squares, the segments are
// joined into polylines and smoothed, and the result is written as static SVG to
// public/contours/. Clearly abstract: no coastline or real place is modelled.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(rand, size) {
  const lattice = Array.from({ length: (size + 1) * (size + 1) }, rand);
  const at = (x, y) => lattice[y * (size + 1) + x];
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function field(seed, cols, rows) {
  const rand = mulberry32(seed);
  const octaves = [valueNoise(rand, 16), valueNoise(rand, 16), valueNoise(rand, 32)];
  const domes = Array.from({ length: 3 }, () => ({ x: rand(), y: rand(), r: 0.18 + rand() * 0.22, h: 0.5 + rand() * 0.6 }));
  const grid = new Float64Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const u = i / cols, v = j / rows;
      let f = octaves[0](u * 3, v * 3 * (rows / cols) + 1) * 0.6 + octaves[1](u * 6 + 2, v * 6 * (rows / cols) + 2) * 0.25 + octaves[2](u * 12, v * 12 * (rows / cols)) * 0.1;
      for (const d of domes) {
        const dx = (u - d.x) * (cols / rows) * 0.6, dy = v - d.y;
        f += d.h * Math.exp(-(dx * dx + dy * dy) / (d.r * d.r));
      }
      grid[j * (cols + 1) + i] = f;
    }
  }
  return grid;
}

// Marching squares with segment joining. Edge points are keyed by the edge they lie on,
// so neighbouring cells share keys and chains can be walked.
function trace(grid, cols, rows, level, cell) {
  const val = (i, j) => grid[j * (cols + 1) + i];
  const pts = new Map();
  const adj = new Map();
  const point = (key, x, y) => {
    if (!pts.has(key)) pts.set(key, [x * cell, y * cell]);
    return key;
  };
  const edge = (side, i, j) => {
    // side: 0 top, 1 right, 2 bottom, 3 left
    const [a, b, ax, ay, bx, by, key] =
      side === 0 ? [val(i, j), val(i + 1, j), i, j, i + 1, j, `h${i},${j}`]
      : side === 1 ? [val(i + 1, j), val(i + 1, j + 1), i + 1, j, i + 1, j + 1, `v${i + 1},${j}`]
      : side === 2 ? [val(i, j + 1), val(i + 1, j + 1), i, j + 1, i + 1, j + 1, `h${i},${j + 1}`]
      : [val(i, j), val(i, j + 1), i, j, i, j + 1, `v${i},${j}`];
    const t = (level - a) / (b - a);
    return point(key, ax + (bx - ax) * t, ay + (by - ay) * t);
  };
  const link = (p, q) => {
    (adj.get(p) ?? adj.set(p, []).get(p)).push(q);
    (adj.get(q) ?? adj.set(q, []).get(q)).push(p);
  };
  const TABLE = { 1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[3, 0], [2, 1]], 6: [[0, 2]], 7: [[3, 0]], 8: [[3, 0]], 9: [[0, 2]], 10: [[3, 2], [0, 1]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]] };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const c = (val(i, j) > level ? 8 : 0) | (val(i + 1, j) > level ? 4 : 0) | (val(i + 1, j + 1) > level ? 2 : 0) | (val(i, j + 1) > level ? 1 : 0);
      for (const [s1, s2] of TABLE[c] ?? []) link(edge(s1, i, j), edge(s2, i, j));
    }
  }
  const seen = new Set();
  const lines = [];
  const walk = (start) => {
    const chain = [start];
    seen.add(start);
    let cur = start;
    for (;;) {
      const next = (adj.get(cur) ?? []).find((k) => !seen.has(k));
      if (!next) break;
      seen.add(next);
      chain.push(next);
      cur = next;
    }
    return chain;
  };
  // Open chains first (start at endpoints), then closed loops.
  for (const [k, n] of adj) if (n.length === 1 && !seen.has(k)) lines.push(walk(k));
  for (const k of adj.keys()) if (!seen.has(k)) {
    const chain = walk(k);
    chain.push(chain[0]);
    lines.push(chain);
  }
  return lines.map((chain) => chain.map((k) => pts.get(k)));
}

function chaikin(points, rounds = 2) {
  let p = points;
  const closed = p.length > 2 && p[0] === p[p.length - 1];
  for (let r = 0; r < rounds; r++) {
    const out = closed ? [] : [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, y0] = p[i], [x1, y1] = p[i + 1];
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    if (closed) out.push(out[0]);
    else out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

function svg({ seed, width = 1600, height = 1000, cell = 20, levels = 18, stroke }) {
  const cols = width / cell, rows = height / cell;
  const grid = field(seed, cols, rows);
  let min = Infinity, max = -Infinity;
  for (const v of grid) { if (v < min) min = v; if (v > max) max = v; }
  const paths = [];
  for (let l = 1; l <= levels; l++) {
    const level = min + ((max - min) * l) / (levels + 1);
    const d = trace(grid, cols, rows, level, cell)
      .filter((line) => line.length > 4)
      .map((line) => {
        const s = chaikin(line);
        return "M" + s.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L");
      })
      .join("");
    if (d) paths.push(`<path d="${d}" stroke-width="${l % 5 === 0 ? 1.6 : 0.8}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="${stroke}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke">${paths.join("")}</g></svg>\n`;
}

const out = path.join(root, "public", "contours");
mkdirSync(out, { recursive: true });
const variants = [
  { name: "field-a", seed: 1607 },
  { name: "field-b", seed: 2026 },
  { name: "field-c", seed: 4419 },
];
for (const v of variants) {
  for (const [tone, stroke] of [["light", "#F4EEDF"], ["gold", "#C49A4E"], ["ink", "#15294A"]]) {
    const file = path.join(out, `${v.name}-${tone}.svg`);
    const body = svg({ seed: v.seed, stroke });
    writeFileSync(file, body);
    if (tone === "light") console.log(`${v.name}: ${(body.length / 1024).toFixed(1)} KB`);
  }
}
