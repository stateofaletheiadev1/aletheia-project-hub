// Design review (brief §6.8): full-page screenshots of public routes at four widths.
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir] [route ...]
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base = "http://localhost:3200", outDir = "docs/design/review", ...only] = process.argv.slice(2);
const WIDTHS = (process.env.WIDTHS ?? "390,768,1280,1728").split(",").map(Number);
const ROUTES = only.length
  ? only
  : [
      "/", "/government", "/institutions", "/institutions/monetary-authority", "/founding-programme", "/projects",
      "/projects/aletheiachain", "/opportunities", "/appointments", "/directory", "/documents", "/decisions",
      "/dispatches", "/public-finance", "/events", "/development", "/build-aletheia", "/search", "/contact",
      "/privacy", "/terms", "/accessibility", "/image-credits", "/sign-in", "/this-page-does-not-exist",
    ];

mkdirSync(outDir, { recursive: true });
// CHROMIUM_PATH lets the review reuse an already-installed Chromium.
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: width < 800 ? 844 : 900 }, deviceScaleFactor: 1 });
  for (const route of ROUTES) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    // Scroll through so every reveal fires, then return to the top.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
      // Review the finished state: every reveal as it ends up after scrolling.
      document.querySelectorAll("[data-reveal]").forEach((e) => e.setAttribute("data-reveal", "shown"));
      document.querySelectorAll("[data-clip]").forEach((e) => e.setAttribute("data-clip", "shown"));
      await new Promise((r) => setTimeout(r, 2600));
    });
    await page
      .waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 })
      .catch(() => console.warn(`images still loading on ${route}`));
    await page.waitForTimeout(400);
    const name = (route === "/" ? "home" : route.slice(1).replace(/\//g, "_")) + `@${width}.png`;
    await page.screenshot({ path: path.join(outDir, name), fullPage: true });
    console.log(name);
  }
  await page.close();
}
await browser.close();
