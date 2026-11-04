// Checks every text/UI colour pair of both themes against WCAG 2.2 AA (wallet prompt 5.2) and
// prints the table recorded in docs/DESIGN_SYSTEM.md. Exits non-zero if any pair fails.
//   node scripts/check-contrast.mjs [--markdown]

import { readFileSync } from "node:fs";

const primitives = readFileSync(new URL("../src/lib/design/tokens/primitives.css", import.meta.url), "utf8");
const semantic = readFileSync(new URL("../src/lib/design/tokens/semantic.css", import.meta.url), "utf8");

const vars = (text) =>
  Object.fromEntries([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const prim = vars(primitives);
const block = (selector) => {
  const start = semantic.indexOf(selector);
  const open = semantic.indexOf("{", start);
  return vars(semantic.slice(open, semantic.indexOf("}", open)));
};
const themes = { light: block(':root[data-theme="light"]'), dark: block(':root[data-theme="dark"]') };

function resolve(theme, name) {
  let value = themes[theme][name] ?? prim[name];
  for (let i = 0; i < 5 && value?.startsWith("var("); i++) {
    const ref = value.slice(6, -1);
    value = themes[theme][ref] ?? prim[ref];
  }
  if (!value?.startsWith("#")) throw new Error(`${theme} --${name} does not resolve to a hex colour (${value})`);
  return value;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const BODY = 4.5;
const UI = 3;
const pairs = [
  ["ink-primary", "surface-page", BODY],
  ["ink-primary", "surface-sheet", BODY],
  ["ink-primary", "surface-sunken", BODY],
  ["ink-heading", "surface-page", BODY],
  ["ink-heading", "surface-sunken", BODY],
  ["ink-secondary", "surface-page", BODY],
  ["ink-secondary", "surface-sheet", BODY],
  ["ink-secondary", "surface-sunken", BODY],
  ["ink-muted", "surface-page", BODY],
  ["ink-muted", "surface-sheet", BODY],
  ["ink-muted", "surface-sunken", BODY],
  ["accent-seal-ink", "surface-page", BODY],
  ["accent-seal-ink", "surface-sheet", BODY],
  ["state-verified", "surface-page", BODY],
  ["state-verified", "surface-sheet", BODY],
  ["state-pending", "surface-page", BODY],
  ["state-pending", "surface-sheet", BODY],
  ["state-rejected", "surface-page", BODY],
  ["state-rejected", "surface-sheet", BODY],
  ["ink-on-accent", "accent-authority", BODY],
  ["rule-control", "surface-page", UI],
  ["rule-control", "surface-sheet", UI],
  ["focus-ring", "surface-page", UI],
  ["focus-ring", "surface-sheet", UI],
  ["accent-seal", "surface-page", 1],
];

let failed = 0;
const rows = [];
for (const theme of Object.keys(themes)) {
  for (const [fg, bg, need] of pairs) {
    const value = ratio(resolve(theme, fg), resolve(theme, bg));
    const ok = value >= need;
    if (!ok) failed++;
    rows.push(
      `| ${theme} | \`--${fg}\` | \`--${bg}\` | ${value.toFixed(2)}:1 | ${need === 1 ? "decorative" : `${need}:1`} | ${ok ? "pass" : "**FAIL**"} |`,
    );
  }
}

console.log(
  "| Theme | Foreground | Background | Ratio | Needs | Result |\n|---|---|---|---|---|---|\n" + rows.join("\n"),
);
if (failed) {
  console.error(`\n${failed} pair(s) below WCAG 2.2 AA`);
  process.exit(1);
}
