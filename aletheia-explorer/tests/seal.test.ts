import { test } from "node:test";
import assert from "node:assert/strict";
import { sealLayers, sealSvg } from "../src/lib/seal/guilloche.ts";

const hash = (seed: number) => Uint8Array.from({ length: 32 }, (_, i) => (seed + i * 37) & 0xff);

function points(d: string): Array<[number, number]> {
  return [...d.matchAll(/[ML](-?\d+\.\d{2}) (-?\d+\.\d{2})/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

test("the same hash always draws the same seal", () => {
  assert.deepEqual(sealLayers(hash(1)), sealLayers(hash(1)));
});

test("different hashes draw different seals", () => {
  const seals = new Set(Array.from({ length: 64 }, (_, i) => sealLayers(hash(i)).map((l) => l.d).join("|")));
  assert.equal(seals.size, 64);
});

test("three layers inside their radii, closed, at most ~2,200 points each", () => {
  const layers = sealLayers(hash(7));
  assert.equal(layers.length, 3);
  for (const [index, layer] of layers.entries()) {
    const radius = [44, 31, 17][index] ?? 0;
    const coords = points(layer.d);
    assert.ok(coords.length > 100 && coords.length <= 2_200, `layer ${index}: ${coords.length} points`);
    for (const [x, y] of coords) assert.ok(Math.hypot(x, y) <= radius + 0.01, `layer ${index} leaves its ring`);
    assert.ok(layer.d.endsWith("Z"));
  }
});

test("coordinates are rounded to 0.01 seal units", () => {
  assert.match(sealLayers(hash(3))[0]!.d, /^M-?\d+\.\d{2} -?\d+\.\d{2}L/);
});

test("a hash of the wrong length is refused", () => {
  assert.throws(() => sealLayers(new Uint8Array(31)), RangeError);
});

test("standalone SVG has the frame, 120 ticks and three layers", () => {
  const svg = sealSvg(hash(9), 240);
  assert.equal((svg.match(/<line /g) ?? []).length, 120);
  assert.equal((svg.match(/<path /g) ?? []).length, 3);
  assert.equal((svg.match(/<circle /g) ?? []).length, 2);
});
