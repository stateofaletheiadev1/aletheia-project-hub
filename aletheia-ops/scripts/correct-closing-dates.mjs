// Moves the closing date of published opportunities through the workbench's own correction
// workflow, in the founder's own session (the founder signs in; the script never sees a password
// or code and writes nothing to any database directly). Each correction is republished under the
// same reference as a new version, and the new date is then checked on aletheiagov.org.
//
//   node scripts/correct-closing-dates.mjs <round>.result.json 2026-12-30 "Closing date extended to 30 December 2026"

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const OPS = "https://ops.aletheiagov.org";
const PORTAL = "https://www.aletheiagov.org";
const [resultFile, date, reason] = process.argv.slice(2);
if (!resultFile || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !reason) throw new Error("usage: <round>.result.json <YYYY-MM-DD> <reason>");
// The records published in that round, by reference and workbench address.
const records = JSON.parse(readFileSync(resultFile, "utf8")).results
  .filter((r) => r.status === "Published")
  .map((r) => ({ ref: r.reference, url: r.workbenchUrl.replace(/\/edit.*$/, "") }));
const shown = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// The highest version number the record page mentions (it also links "Changes from version N-1").
const latestVersion = (text) => Math.max(0, ...[...text.matchAll(/version\s+(\d+)/gi)].map((m) => Number(m[1])));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch({ headless: false, executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
page.setDefaultTimeout(30_000);

await page.goto(`${OPS}/sign-in`);
log("Waiting for the founder to sign in in the browser window (up to 15 minutes)…");
await page.getByRole("navigation", { name: "Workbench" }).waitFor({ timeout: 15 * 60_000 });
log("Signed in.");

async function step(label, why) {
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: label }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  if (why) await dialog.getByLabel(/Reason/).fill(why);
  await dialog.getByRole("button", { name: label }).click();
  await dialog.waitFor({ state: "hidden" });
}

for (const { ref, url: record } of records) {
  try {
    if (!record.startsWith(`${OPS}/records/opportunities/`)) throw new Error("unexpected record address");
    await page.goto(record);
    const before = latestVersion(await page.locator("main").innerText());

    await step("Start a correction", reason);
    await page.goto(`${record}/edit`);
    await page.getByLabel("Closing date").fill(date);
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText(/^Saved /).waitFor();
    await page.reload();
    if ((await page.getByLabel("Closing date").inputValue()) !== date) throw new Error("the new date was not saved");

    await page.goto(record);
    for (const s of ["Submit for review", "Take for review", "Approve opportunity", "Authorise publication", "Publish to the public record"]) await step(s);
    // Published again, at a newer version (the receipt arrives from aletheiagov.org).
    let text = "";
    for (let i = 0; i < 18; i++) {
      text = await page.locator("main").innerText();
      if (/Status:\s*Published/i.test(text) && latestVersion(text) > before) break;
      await page.waitForTimeout(5_000);
      await page.reload();
    }
    const after = latestVersion(text);
    const issued = (await page.locator("dd.ref").first().innerText()).trim();
    if (issued !== ref) throw new Error(`the reference changed to ${issued}`);
    if (after <= before) throw new Error(`still version ${after}`);
    log(ref, `published as version ${after}`);

    // The public page caches for up to a minute.
    let seen = false;
    for (let i = 0; i < 12 && !seen; i++) {
      const res = await page.request.get(`${PORTAL}/opportunities/${ref.toLowerCase()}`);
      seen = (await res.text()).includes(shown);
      if (!seen) await page.waitForTimeout(10_000);
    }
    log(ref, seen ? `aletheiagov.org shows the closing date ${shown}` : `NOT YET on aletheiagov.org after 2 minutes`);
  } catch (e) {
    log(ref, `failed: ${e.message.split("\n")[0]}`);
  }
}
log("Done. The browser stays open for you to look; close it when done.");
await new Promise((resolve) => browser.on("disconnected", resolve));
