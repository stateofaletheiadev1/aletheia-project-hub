// Generates the wallet's own contour fields (wallet prompt 4.2, 5.7): new terrain in the
// Operations language. Deterministic: a seeded height field, marching squares, joined and
// simplified lines. Output is a single-colour SVG used as a CSS mask, so the theme colours it.
//   node scripts/generate-contours.mjs

import { writeFileSync, mkdirSync } from "node:fs";

const W = 1600;
const H = 1000;
const CELL = 8;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A height field from soft hills and long ridges, so the land reads as surveyed terrain. */
function field(seed, hills, ridges) {
  const random = rng(seed);
  const peaks = Array.from({ length: hills }, () => ({
    x: random() * W,
    y: random() * H,
    r: 120 + random() * 340,
    h: (random() < 0.78 ? 1 : -0.6) * (0.5 + random()),
  }));
  const lines = Array.from({ length: ridges }, () => ({
    angle: random() * Math.PI,
    offset: random() * W,
    width: 160 + random() * 260,
    h: 0.35 + random() * 0.5,
    wave: 0.002 + random() * 0.003,
    phase: random() * Math.PI * 2,
  }));
  // Multi-octave value noise gives the small irregularity real survey lines have.
  const lattice = new Float64Array(64 * 64).map(() => random() * 2 - 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = smooth(x - xi),
      yf = smooth(y - yi);
    const v = (i, j) => lattice[((j & 63) << 6) | (i & 63)];
    const top = v(xi, yi) + (v(xi + 1, yi) - v(xi, yi)) * xf;
    const bottom = v(xi, yi + 1) + (v(xi + 1, yi + 1) - v(xi, yi + 1)) * xf;
    return top + (bottom - top) * yf;
  };
  const fbm = (x, y) =>
    noise(x / 420, y / 420) * 0.55 + noise(x / 190 + 11, y / 190 + 7) * 0.28 + noise(x / 85 + 31, y / 85 + 3) * 0.12;
  return (x, y) => {
    let z = fbm(x, y);
    for (const p of peaks) {
      const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
      z += p.h * Math.exp(-d2 / (2 * p.r * p.r));
    }
    for (const l of lines) {
      const along = x * Math.cos(l.angle) + y * Math.sin(l.angle);
      const across = -x * Math.sin(l.angle) + y * Math.cos(l.angle) + l.offset - W / 2;
      const bend = Math.sin(along * l.wave + l.phase) * 90;
      z += l.h * Math.exp(-((across + bend) ** 2) / (2 * l.width * l.width));
    }
    return z;
  };
}

function sample(f) {
  const cols = Math.ceil(W / CELL) + 1;
  const rows = Math.ceil(H / CELL) + 1;
  const grid = new Float64Array(cols * rows);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const v = f(i * CELL, j * CELL);
      grid[j * cols + i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  return { grid, cols, rows, min, max };
}

/** Marching squares at one level → line segments. */
function segments({ grid, cols, rows }, level) {
  const out = [];
  const at = (i, j) => grid[j * cols + i];
  const lerp = (a, b, va, vb) => a + ((level - va) / (vb - va)) * (b - a);
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const a = at(i, j),
        b = at(i + 1, j),
        c = at(i + 1, j + 1),
        d = at(i, j + 1);
      const code = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const x = i * CELL,
        y = j * CELL;
      const top = [lerp(x, x + CELL, a, b), y];
      const right = [x + CELL, lerp(y, y + CELL, b, c)];
      const bottom = [lerp(x, x + CELL, d, c), y + CELL];
      const left = [x, lerp(y, y + CELL, a, d)];
      const table = {
        1: [[left, bottom]],
        2: [[bottom, right]],
        3: [[left, right]],
        4: [[top, right]],
        5: [
          [left, top],
          [bottom, right],
        ],
        6: [[top, bottom]],
        7: [[left, top]],
        8: [[left, top]],
        9: [[top, bottom]],
        10: [
          [left, bottom],
          [top, right],
        ],
        11: [[top, right]],
        12: [[left, right]],
        13: [[bottom, right]],
        14: [[left, bottom]],
      };
      for (const s of table[code]) out.push(s);
    }
  return out;
}

/** Joins segments that share endpoints into polylines. */
function join(segs) {
  const key = (p) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
  const ends = new Map();
  segs.forEach((s, idx) => {
    for (const p of s) {
      const k = key(p);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(idx);
    }
  });
  const used = new Uint8Array(segs.length);
  const lines = [];
  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue;
    used[start] = 1;
    const line = [segs[start][0], segs[start][1]];
    for (const forward of [true, false]) {
      for (;;) {
        const tip = forward ? line[line.length - 1] : line[0];
        const next = (ends.get(key(tip)) ?? []).find((idx) => !used[idx]);
        if (next === undefined) break;
        used[next] = 1;
        const [p, q] = segs[next];
        const far = key(p) === key(tip) ? q : p;
        if (forward) line.push(far);
        else line.unshift(far);
      }
    }
    lines.push(line);
  }
  return lines;
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let index = -1;
  let worst = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [a, b];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

function path(points) {
  const r = (n) => Math.round(n);
  return `M${points.map((p) => `${r(p[0])} ${r(p[1])}`).join("L")}`;
}

function render({ seed, hills, ridges, levels, tolerance, name }) {
  const s = sample(field(seed, hills, ridges));
  const paths = [];
  for (let k = 1; k <= levels; k++) {
    const level = s.min + ((s.max - s.min) * k) / (levels + 1);
    const lines = join(segments(s, level))
      .map((line) => simplify(line, tolerance))
      .filter((line) => line.length > 3);
    if (!lines.length) continue;
    // Every fifth line is an index contour, drawn heavier, as on a survey map.
    const weight = k % 5 === 0 ? 1.6 : 0.9;
    paths.push(`<path stroke-width="${weight}" d="${lines.map(path).join("")}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#000" stroke-linejoin="round" stroke-linecap="round">${paths.join("")}</g></svg>`;
  mkdirSync(new URL("../static/contours/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`../static/contours/${name}.svg`, import.meta.url), svg);
  // The landing field is also inlined so its lines can draw themselves in (S-1).
  mkdirSync(new URL("../src/lib/design/contours/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`../src/lib/design/contours/${name}.svg`, import.meta.url), svg);
  console.log(`${name}.svg  ${(svg.length / 1024).toFixed(1)} KB  ${paths.length} levels`);
}

// Landing: broad coastal plain rising to an inland range. Wallet: quieter, low relief.
// Ceremony: one tall summit with concentric rings, behind the certificate and the seal.
render({ name: "landing", seed: 7770, hills: 9, ridges: 2, levels: 26, tolerance: 0.9 });
render({ name: "wallet", seed: 41771, hills: 6, ridges: 1, levels: 18, tolerance: 1.0 });
render({ name: "ceremony", seed: 1793, hills: 4, ridges: 1, levels: 24, tolerance: 0.9 });
