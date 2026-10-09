import { chromium } from "playwright";
// Layout audit: reports elements that cause horizontal page scroll.
// Usage: W=390 node scripts/layout-audit.mjs <url>
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1440), height: 900 } });
await page.goto(process.argv[2], { waitUntil: "networkidle" });
const res = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && r.width > 0) {
      let p = el.parentElement, clipped = false;
      while (p) { const s = getComputedStyle(p); if (s.overflowX !== "visible" || s.overflow === "hidden") { clipped = true; break; } p = p.parentElement; }
      if (!clipped || r.width > vw + 1) out.push(`${el.tagName}.${(el.className?.baseVal ?? el.className).toString().slice(0, 90)} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
    }
  }
  return { vw, sw: document.documentElement.scrollWidth, out: out.slice(0, 15) };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
