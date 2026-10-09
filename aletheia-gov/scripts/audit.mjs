// Release audit against a running build: for every public route and width, reports
// horizontal overflow, console errors (including CSP violations), failed requests,
// missing h1 / multiple h1, and the JavaScript transferred.
// Usage: node scripts/audit.mjs [baseUrl]
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3200";
const ROUTES = [
  "/", "/government", "/institutions", "/institutions/monetary-authority", "/founding-programme", "/projects",
  "/projects/stablechain", "/opportunities", "/appointments", "/directory", "/documents", "/decisions",
  "/dispatches", "/public-finance", "/events", "/development", "/build-aletheia", "/search", "/search?q=treasury",
  "/contact", "/privacy", "/terms", "/accessibility", "/image-credits", "/sign-in", "/no-such-page",
];
const WIDTHS = [390, 768, 1280, 1728];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let problems = 0;
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const route of ROUTES) {
    const errors = [];
    let js = 0;
    const expected404 = route === "/no-such-page";
    const onConsole = (m) => {
      if (m.type() !== "error") return;
      if (expected404 && m.text().includes("404")) return;
      errors.push(m.text().slice(0, 160));
    };
    // Prefetches cancelled by the next navigation are not failures.
    const onFail = (r) => !r.failure()?.errorText.includes("ERR_ABORTED") && errors.push(`request failed ${r.url().slice(0, 100)}`);
    const onResponse = async (r) => {
      if (r.request().resourceType() === "script") js += Number(r.headers()["content-length"] ?? 0) || (await r.body().catch(() => Buffer.alloc(0))).length;
      if (r.status() >= 400 && !r.url().includes("no-such-page")) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`);
    };
    page.on("console", onConsole);
    page.on("requestfailed", onFail);
    page.on("response", onResponse);
    await page.goto(base + route, { waitUntil: "networkidle" });
    const facts = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1: document.querySelectorAll("h1").length,
    }));
    page.off("console", onConsole);
    page.off("requestfailed", onFail);
    page.off("response", onResponse);
    const issues = [];
    if (facts.overflow > 0) issues.push(`overflow ${facts.overflow}px`);
    if (facts.h1 !== 1) issues.push(`${facts.h1} h1`);
    issues.push(...errors);
    if (issues.length) {
      problems += issues.length;
      console.log(`✗ ${width} ${route}: ${issues.join(" | ")}`);
    } else if (width === 1280) {
      console.log(`✓ ${route}  js≈${(js / 1024).toFixed(0)} KB`);
    }
  }
  await page.close();
}
await browser.close();
console.log(problems ? `${problems} problem(s)` : "no problems");
process.exit(problems ? 1 : 0);
