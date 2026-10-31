// Performance budgets (brief §16), measured with Lighthouse's default mobile profile
// (simulated slow 4G, 4x CPU slowdown) against a running production build.
// Usage: node scripts/lighthouse.mjs [baseUrl]   (CHROMIUM_PATH optional)
// Build with APP_ENV=production first, or the SEO crawlability audit fails by design
// (non-production builds disallow all crawlers).
import { mkdirSync, writeFileSync } from "node:fs";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const base = process.argv[2] ?? "http://localhost:3200";
const PAGES = ["/", "/government", "/institutions", "/projects/aletheiachain", "/opportunities", "/search?q=treasury"];

const BUDGET = {
  performance: 0.95,
  accessibility: 1,
  "best-practices": 0.95,
  seo: 1,
  lcpMs: 2000,
  cls: 0.05,
  tbtMs: 200, // lab proxy for INP, which Lighthouse cannot measure without interaction
};

const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROMIUM_PATH || undefined,
  chromeFlags: ["--headless=new", "--no-sandbox"],
});

const rows = [];
let failures = 0;
try {
  for (const path of PAGES) {
    // Warm the server's image cache so the run measures the site, not first-time AVIF encoding.
    await lighthouse(base + path, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] });
    const { lhr } = await lighthouse(base + path, { port: chrome.port, output: "json", logLevel: "error" });
    const score = (k) => lhr.categories[k].score;
    const audit = (k) => lhr.audits[k].numericValue;
    const r = {
      path,
      performance: score("performance"),
      accessibility: score("accessibility"),
      "best-practices": score("best-practices"),
      seo: score("seo"),
      lcpMs: Math.round(audit("largest-contentful-paint")),
      cls: Number(audit("cumulative-layout-shift").toFixed(3)),
      tbtMs: Math.round(audit("total-blocking-time")),
    };
    const lcpNode = lhr.audits["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node;
    r.lcpElement = lcpNode ? `${lcpNode.nodeLabel ?? ""} <${(lcpNode.snippet ?? "").slice(0, 70)}>` : "unknown";
    const lcpPhases = lhr.audits["largest-contentful-paint-element"]?.details?.items?.[1]?.items;
    if (lcpPhases) r.lcpPhases = Object.fromEntries(lcpPhases.map((p) => [p.phase, Math.round(p.timing)]));
    const misses = [];
    for (const k of ["performance", "accessibility", "best-practices", "seo"]) if (r[k] < BUDGET[k]) misses.push(`${k} ${r[k]}`);
    if (r.lcpMs > BUDGET.lcpMs) misses.push(`LCP ${r.lcpMs}ms`);
    if (r.cls > BUDGET.cls) misses.push(`CLS ${r.cls}`);
    if (r.tbtMs > BUDGET.tbtMs) misses.push(`TBT ${r.tbtMs}ms`);
    if (misses.length) {
      failures += misses.length;
      // Name the failing audits so the report is actionable.
      for (const [id, a] of Object.entries(lhr.audits)) {
        if (a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable") misses.push(`· ${id}`);
      }
    }
    rows.push({ ...r, misses });
    console.log(`${misses.length ? "✗" : "✓"} ${path}  perf ${r.performance} a11y ${r.accessibility} bp ${r["best-practices"]} seo ${r.seo}  LCP ${r.lcpMs}ms CLS ${r.cls} TBT ${r.tbtMs}ms ${misses.join(" ")}`);
    if (process.env.LH_VERBOSE) console.log(`    LCP element: ${r.lcpElement}  phases: ${JSON.stringify(r.lcpPhases ?? {})}`);
  }
} finally {
  await chrome.kill();
}

mkdirSync("test-results", { recursive: true });
writeFileSync("test-results/lighthouse.json", JSON.stringify({ budget: BUDGET, rows }, null, 2));
process.exit(failures ? 1 : 0);
