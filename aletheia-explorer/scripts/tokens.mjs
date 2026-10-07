// Generates src/styles/tokens.css from design/tokens.json (spec 41A.18).
//   node scripts/tokens.mjs           write the CSS
//   node scripts/tokens.mjs --check   fail if the committed CSS is stale
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tokens = JSON.parse(readFileSync(`${root}design/tokens.json`, "utf8"));
const target = `${root}src/styles/tokens.css`;

function block(selector, colors, extra = {}) {
  const lines = Object.entries(colors).map(([name, { value }]) => `  --${name}: ${value};`);
  for (const [name, value] of Object.entries(extra)) lines.push(`  --${name}: ${value};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

const { light, dark } = tokens.color;
const highContrast = tokens.color["high-contrast"];
const css = [
  "/* Generated from design/tokens.json by scripts/tokens.mjs. Do not edit by hand. */",
  "",
  block(":root", light, {
    radius: tokens.shape.radius,
    hairline: tokens.shape.hairline,
    "grain-opacity": tokens.grain.light,
  }),
  "",
  "/* Night ledger: warm, low glare, never neon. Follows the system unless the reader chose. */",
  "@media (prefers-color-scheme: dark) {",
  block(':root:not([data-theme="light"])', dark, { "grain-opacity": tokens.grain.dark })
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n"),
  "}",
  "",
  block(':root[data-theme="dark"]', dark, { "grain-opacity": tokens.grain.dark }),
  "",
  "@media (prefers-contrast: more) {",
  block(":root", highContrast, { "grain-opacity": tokens.grain["high-contrast"] })
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n"),
  "}",
  "",
].join("\n");

if (process.argv.includes("--check")) {
  const committed = readFileSync(target, "utf8").replace(/\r\n/g, "\n");
  if (committed !== css) {
    console.error("tokens: src/styles/tokens.css is stale; run `npm run tokens` and commit the result");
    process.exit(1);
  }
  console.log("tokens: ok");
} else {
  writeFileSync(target, css);
  console.log(`tokens: wrote ${target}`);
}
