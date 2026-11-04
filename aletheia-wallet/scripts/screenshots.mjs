// The visual QA loop (wallet prompt 18.4): screenshots of every principal screen at 1440 / 1024 /
// 390 in both themes. Public pages are captured as they are; wallet screens from a fresh wallet on
// the devnet server (scripts expect `npx vite dev --port 5181` with the devnet env, as in README).
//   node scripts/screenshots.mjs [baseUrl] [outDir]

import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:5181";
const OUT = process.argv[3] ?? "test-results/screens";
mkdirSync(OUT, { recursive: true });
const WIDTHS = [1440, 1024, 390];
const THEMES = ["light", "dark"];
const PASSWORD = "screenshot password 2026";

const browser = await chromium.launch({ channel: "chrome" });

async function shoot(page, name) {
  await page.waitForTimeout(1600);
  for (const theme of THEMES) {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/${name}-${width}-${theme}.png`, fullPage: true });
    }
  }
  await page.evaluate(() => delete document.documentElement.dataset.theme);
  await page.setViewportSize({ width: 1440, height: 1000 });
}

const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
for (const [name, path] of [["landing", "/"], ["about", "/about"], ["security-public", "/security"], ["help", "/help"], ["network", "/network"]]) {
  await page.goto(BASE + path);
  await shoot(page, name);
}

await page.goto(`${BASE}/create`);
await shoot(page, "create-understand");
for (const box of await page.getByRole("checkbox").all()) await box.check();
await page.getByRole("button", { name: "I understand" }).click();
await page.getByRole("button", { name: "Generate 24 words" }).click();
await page.getByRole("button", { name: "Reveal words" }).click();
await shoot(page, "create-certificate");
const words = await page.locator(".certificate .ink").allTextContents();
await page.getByRole("button", { name: "Confirm without holding" }).click();
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "I have written this down" }).click();
await shoot(page, "create-verify");
for (let i = 0; i < 4; i++) {
  const place = Number(await page.locator(".verify li.next .n").textContent());
  await page.locator(".bank .chip", { hasText: new RegExp(`^${words[place - 1]}$`) }).first().click();
}
await page.getByRole("button", { name: "Continue" }).click();
await shoot(page, "create-seal");
await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
await page.getByLabel("Repeat password", { exact: true }).fill(PASSWORD);
await page.getByRole("button", { name: "Seal wallet" }).click();
await page.waitForURL(/dashboard/, { timeout: 60_000 });

const nav = (name) => page.locator('nav[aria-label="Wallet index"]').getByRole("link", { name, exact: true }).click();
await shoot(page, "dashboard");
for (const [name, link] of [["send", "Send"], ["receive", "Receive"], ["activity", "Activity"], ["assets", "Assets"], ["accounts", "Accounts"], ["address-book", "Address book"], ["security", "Security"], ["settings", "Settings"]]) {
  await nav(link);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await shoot(page, name);
}
await page.getByRole("button", { name: "Lock wallet" }).click();
await page.waitForURL(/unlock/);
await shoot(page, "unlock");

await browser.close();
console.log(`screens in ${OUT}`);
