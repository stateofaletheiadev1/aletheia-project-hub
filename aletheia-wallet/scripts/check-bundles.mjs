// Enforces the performance budget (wallet prompt 16) and the trust boundary (10.2) on the built
// client: every route's statically loaded JS is measured gzipped, and public routes must not load
// any wallet cryptography. Fails the build on a breach.
//   node scripts/check-bundles.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const OUT = ".svelte-kit/output/client";
const manifest = JSON.parse(readFileSync(join(OUT, ".vite/manifest.json"), "utf8"));
const NODES = ".svelte-kit/generated/client-optimized/nodes";

const KB = 1024;
// The prompt sets 60 KB for the landing; other public pages carry a little more (identifiers, time).
const BUDGET = { landing: 60 * KB, public: 75 * KB, wallet: 150 * KB, font: 70 * KB, contour: 40 * KB };
// Code that only the wallet's keys need. Its appearance in a public route's closure is a breach.
const CRYPTO_MARKERS = ["ed25519 seed", "xchacha20poly1305", "mnemonicToSeed", "argon2id", "TXSIG"];
const PUBLIC_ROUTES = ["src/routes/+page.svelte", "src/routes/(public)/"];

function closure(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const next of manifest[key]?.imports ?? []) closure(next, seen);
  return seen;
}

function gz(file) {
  return gzipSync(readFileSync(join(OUT, file))).length;
}

const routeOf = {};
for (const name of readdirSync(NODES)) {
  const text = readFileSync(join(NODES, name), "utf8");
  const match = /from "(?:\.\.\/)+(src\/routes\/[^"]+\.svelte)"/.exec(text);
  routeOf[`${NODES}/${name}`.replace(/\\/g, "/")] = match ? match[1] : null;
}

const shared = closure("node_modules/@sveltejs/kit/src/runtime/client/entry.js");
closure(".svelte-kit/generated/client-optimized/app.js", shared);
closure(`${NODES}/0.js`, shared); // root layout
const layoutOf = (route) =>
  Object.keys(routeOf).filter(
    (k) =>
      routeOf[k] && route.startsWith(routeOf[k].replace("+layout.svelte", "")) && routeOf[k].endsWith("+layout.svelte"),
  );

let failed = 0;
const rows = [];
for (const [key, route] of Object.entries(routeOf)) {
  if (!route || !route.endsWith("+page.svelte") || route.includes("/dev/")) continue;
  const keys = new Set(shared);
  for (const layout of layoutOf(route)) closure(layout, keys);
  closure(key, keys);
  const files = [...keys].map((k) => manifest[k]?.file).filter(Boolean);
  const size = files.reduce((sum, file) => sum + gz(file), 0);
  const isPublic = PUBLIC_ROUTES.some((p) => route === p || route.startsWith(p));
  const budget = route === "src/routes/+page.svelte" ? BUDGET.landing : isPublic ? BUDGET.public : BUDGET.wallet;
  const text = files.map((file) => readFileSync(join(OUT, file), "utf8")).join("\n");
  const leaks = isPublic ? CRYPTO_MARKERS.filter((marker) => text.includes(marker)) : [];
  const ok = size <= budget && leaks.length === 0;
  if (!ok) failed++;
  rows.push(
    `${ok ? "ok  " : "FAIL"} ${(size / KB).toFixed(1).padStart(6)} KB / ${budget / KB} KB  ${isPublic ? "public" : "wallet"}  ${route.replace("src/routes", "")}${leaks.length ? `  wallet crypto: ${leaks.join(", ")}` : ""}`,
  );
}

const fontBytes = ["fonts/manrope-latin-wght-normal.woff2"].reduce((s, f) => s + statSync(join("static", f)).size, 0);
rows.push(
  `${fontBytes <= BUDGET.font ? "ok  " : "FAIL"} ${(fontBytes / KB).toFixed(1).padStart(6)} KB / ${BUDGET.font / KB} KB  font    preloaded Manrope`,
);
if (fontBytes > BUDGET.font) failed++;
for (const file of readdirSync("static/contours")) {
  const size = statSync(join("static/contours", file)).size;
  rows.push(
    `${size <= BUDGET.contour ? "ok  " : "FAIL"} ${(size / KB).toFixed(1).padStart(6)} KB / ${BUDGET.contour / KB} KB  contour ${file}`,
  );
  if (size > BUDGET.contour) failed++;
}

console.log(rows.sort().join("\n"));
if (failed) {
  console.error(`\n${failed} budget or boundary breach(es)`);
  process.exit(1);
}
