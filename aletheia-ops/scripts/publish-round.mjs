// Enters and publishes a recruitment round through the live workbench, in the founder's own
// session: it opens a browser at the sign-in page and waits for the founder to sign in
// themselves (the script never sees a password or code). It then uses only the workbench's
// own screens and steps, exactly as a person would, so every action is the founder's own and
// lands in the audit register. Nothing is written to any database directly.
//
//   node scripts/publish-round.mjs docs/recruitment/2026-round-1.mjs [--drafts-only]
//
// Results (references, receipts, URLs) are written next to the round as <round>.result.json.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const OPS = "https://ops.aletheiagov.org";
const PORTAL = "https://www.aletheiagov.org";
const roundFile = path.resolve(process.argv[2] ?? "");
const draftsOnly = process.argv.includes("--drafts-only");
const { ROUND } = await import(pathToFileURL(roundFile).href);

// Applications close 30 days after publication, which is today.
const close = new Date();
close.setDate(close.getDate() + 30);
const closingDate = `${close.getFullYear()}-${String(close.getMonth() + 1).padStart(2, "0")}-${String(close.getDate()).padStart(2, "0")}`;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch({ headless: false, executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
page.setDefaultTimeout(30_000);

await page.goto(`${OPS}/sign-in`);
log("Waiting for the founder to sign in in the browser window (up to 15 minutes)…");
await page.getByRole("navigation", { name: "Workbench" }).waitFor({ timeout: 15 * 60_000 });
log("Signed in.");

async function step(label) {
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: label }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("button", { name: label }).click();
  await dialog.waitFor({ state: "hidden" });
  log(`  ${label}: done`);
}

const results = [];
for (const p of ROUND) {
  const r = { key: p.key, title: p.title, expected: p.expected, closingDate };
  results.push(r);
  try {
    // No duplicates: look for the title in the register first.
    await page.goto(`${OPS}/records/opportunities?q=${encodeURIComponent(p.title)}`);
    if (await page.getByRole("link", { name: p.title, exact: true }).count()) {
      r.status = "skipped: a record with this title already exists";
      log(p.key, r.status);
      continue;
    }

    log(p.key, p.title);
    await page.goto(`${OPS}/records/opportunities/new`);
    await page.getByLabel("Title", { exact: true }).fill(p.title);
    await page.getByLabel("Summary").fill(p.summary);
    await page.getByLabel("Text", { exact: true }).fill(p.text);
    await page.getByLabel("Classification", { exact: true }).selectOption("public");
    await page.getByLabel("Institution", { exact: true }).selectOption("founding-government");
    await page.getByLabel("Kind of position").selectOption(p.positionType);
    await page.getByLabel("Closing date").fill(closingDate);
    await page.getByLabel("Facts").fill(p.facts);
    await page.getByRole("button", { name: "Create draft opportunity" }).click();
    await page.getByText("Draft created").waitFor();
    await page.getByRole("link", { name: "Back to the record" }).click();
    r.workbenchUrl = page.url();
    r.status = "Draft";
    log("  draft:", r.workbenchUrl);
    if (draftsOnly) continue;

    for (const s of ["Submit for review", "Take for review", "Approve opportunity", "Authorise publication", "Publish to the public record"]) await step(s);
    await page.getByText("Publication receipt").waitFor({ timeout: 90_000 });
    r.reference = (await page.locator("dd.ref").first().innerText()).trim();
    r.publicUrl = `${PORTAL}/opportunities/${r.reference.toLowerCase()}`;
    r.applyUrl = `${PORTAL}/register-interest?opportunity=${r.reference}`;
    r.status = "Published";
    r.publishedSeenAt = new Date().toISOString();
    log("  published:", r.reference, r.reference === p.expected ? "" : `(expected ${p.expected})`);
  } catch (e) {
    r.status = `failed at ${r.status ?? "drafting"}: ${e.message.split("\n")[0]}`;
    log(p.key, r.status);
  }
}

writeFileSync(roundFile.replace(/\.mjs$/, ".result.json"), JSON.stringify({ ranAt: new Date().toISOString(), closingDate, results }, null, 2));
log("Results written. The browser stays open for you to look; close it when done.");
await page.goto(`${OPS}/records/opportunities`);
await new Promise((resolve) => browser.on("disconnected", resolve));
