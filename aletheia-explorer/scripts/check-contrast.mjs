// WCAG 2.2 AA contrast for every text/surface pair the Explorer uses. Colours are read from
// the custom properties in src/app.css, the single colour source: nobody types a hex value
// into a component, so checking app.css checks the whole UI.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const css = readFileSync(`${root}src/app.css`, "utf8");
const palette = Object.fromEntries(
  [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, name, hex]) => [name, hex]),
);

const REQUIRED = { body: 4.5, large: 3 };
// [text, surface, size]: "large" is 18.66 px bold / 24 px regular and up, or a non-text mark.
const PAIRS = [
  ["text", "bg", "body"],
  ["text", "surface", "body"],
  ["text", "surface-raised", "body"],
  ["text-soft", "bg", "body"],
  ["text-soft", "surface", "body"],
  ["text-soft", "surface-raised", "body"],
  ["text-faint", "bg", "body"],
  ["text-faint", "surface", "body"],
  ["text-faint", "surface-raised", "body"],
  ["accent", "surface-raised", "body"],
  ["accent", "surface", "body"],
  ["ok", "surface-raised", "body"],
  ["ok", "surface", "body"],
  ["warn", "surface", "body"],
  ["fail", "surface-raised", "body"],
  ["gold", "surface", "body"],
  ["gold", "surface-raised", "body"],
  ["brand-gold-bright", "surface", "body"],
  ["brand-gold-bright", "brand-navy", "body"],
  ["brand-cream", "brand-navy", "body"],
  ["brand-laurel-bright", "surface-raised", "body"],
  ["brand-gold", "bg", "large"],
  ["text-soft", "bg-deep", "body"],
  ["text-faint", "bg-deep", "body"],
  ["button-text", "button", "body"],
  ["focus", "bg", "large"],
  ["focus", "surface-raised", "large"],
];

function channel(hex, offset) {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

let failures = 0;
for (const [text, surface, size] of PAIRS) {
  if (!palette[text] || !palette[surface]) {
    console.error(`FAIL missing colour --${palette[text] ? surface : text} in src/app.css`);
    failures += 1;
    continue;
  }
  const ratio = contrast(palette[text], palette[surface]);
  const ok = ratio >= REQUIRED[size];
  if (!ok) failures += 1;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${text.padEnd(13)} on ${surface.padEnd(15)} ${ratio.toFixed(2)}:1 (needs ${REQUIRED[size]}:1, ${size})`,
  );
}
if (failures > 0) {
  console.error(`contrast: ${failures} pair(s) below WCAG 2.2 AA`);
  process.exit(1);
}
console.log("contrast: ok");
