// Captures the design archetypes at the brief's breakpoints (brief §16) into
// docs/design/screenshots/. Usage: node scripts/screenshots.mjs [baseUrl] [route ...]
// CHROMIUM_PATH may point at a local Chromium when Playwright's own download is absent.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3300";
const routes = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["/sign-in", "/design", "/design/briefing", "/design/briefing?state=empty", "/design/register", "/design/register?state=empty", "/design/folio"];
const widths = [375, 768, 1280, 1600];
const out = path.resolve(import.meta.dirname, "../docs/design/screenshots");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const route of routes) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const name = `${route.replace(/^\//, "").replace(/[/?=]/g, "_") || "root"}@${width}.jpg`;
    await page.screenshot({ path: path.join(out, name), fullPage: true, type: "jpeg", quality: 78 });
    console.log(`${name}${overflow > 0 ? `  OVERFLOW ${overflow}px` : ""}${errors.length ? `  console errors: ${errors.length}` : ""}`);
    for (const e of errors.slice(0, 3)) console.log(`   ${e.slice(0, 200)}`);
    await page.close();
  }
}
await browser.close();
