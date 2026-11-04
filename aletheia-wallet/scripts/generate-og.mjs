// Renders the Open Graph card (wallet prompt 17): arms, the landing contour field and the wordmark
// on Night Ink, 1200 × 630, into static/og.png. No account data, ever.
//   node scripts/generate-og.mjs

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const font = readFileSync("static/fonts/manrope-latin-wght-normal.woff2").toString("base64");
const arms = readFileSync("static/brand/arms-360.png").toString("base64");
const field = readFileSync("static/contours/landing.svg", "utf8").replace('stroke="#000"', 'stroke="#E6C183"');

const html = `<!doctype html><html><head><style>
@font-face { font-family: Manrope; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 200 800; }
body { margin: 0; width: 1200px; height: 630px; background: #0B1628; font-family: Manrope; overflow: hidden; position: relative; }
.field { position: absolute; inset: 0; opacity: .09; }
.field svg { width: 100%; height: 100%; }
.card { position: absolute; inset: 0; display: flex; align-items: center; gap: 56px; padding: 0 96px; }
img { width: 168px; }
.eyebrow { color: #D6AD66; font-size: 18px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
h1 { margin: 16px 0 8px; color: #FBF8F1; font-size: 92px; font-weight: 300; letter-spacing: -.035em; line-height: 1; }
p { margin: 0; color: #C9C0AD; font-size: 34px; font-weight: 300; font-style: italic; }
.rule { position: absolute; left: 96px; right: 96px; bottom: 64px; height: 1px; background: #C49A4E; opacity: .7; }
.motto { position: absolute; right: 96px; bottom: 28px; color: #D9BC7E; font-size: 18px; font-style: italic; }
</style></head><body><div class="field">${field}</div><div class="card"><img src="data:image/png;base64,${arms}">
<div><div class="eyebrow">Sovereign Covenant State of Aletheia</div><h1>Aletheia Wallet</h1><p>The Private Ledger · AletheiaChain</p></div></div>
<div class="rule"></div><div class="motto">Veritas in Foedere</div></body></html>`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: "static/og.png" });
await browser.close();
console.log("static/og.png");
