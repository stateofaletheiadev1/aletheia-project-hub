// WCAG 2.2 AA contrast for every text/background pair in design/tokens.json, in light,
// dark and high-contrast themes (spec 41A.4: "checked in CI from the token file").
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tokens = JSON.parse(readFileSync(`${root}design/tokens.json`, "utf8"));
const REQUIRED = { body: 4.5, large: 3 };

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

const themes = {
  light: tokens.color.light,
  dark: { ...tokens.color.light, ...tokens.color.dark },
  "high-contrast": { ...tokens.color.light, ...tokens.color["high-contrast"] },
};

let failures = 0;
for (const [theme, palette] of Object.entries(themes)) {
  for (const { text, background, size } of tokens.contrast.pairs) {
    const ratio = contrast(palette[text].value, palette[background].value);
    const ok = ratio >= REQUIRED[size];
    if (!ok) failures += 1;
    console.log(`${ok ? "ok  " : "FAIL"} ${theme.padEnd(13)} ${text.padEnd(12)} on ${background.padEnd(7)} ${ratio.toFixed(2)}:1 (needs ${REQUIRED[size]}:1, ${size})`);
  }
}
if (failures > 0) {
  console.error(`contrast: ${failures} pair(s) below WCAG 2.2 AA`);
  process.exit(1);
}
console.log("contrast: ok");
