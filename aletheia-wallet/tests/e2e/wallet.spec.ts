// The whole life of a wallet in a real browser against a real devnet node (wallet prompt 18.3):
// create → certificate → verify → seal → funded → balance → receive → price → sign → submit →
// finalized → lock → unlock. Plus accessibility on every screen visited.
import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PASSWORD = "ledger of the covenant 2026";
const DEV_ACCOUNT = "alt:724bDE8dbDF8BFBc8D0B628Ae08214e88c8E418F"; // seed [0xA2; 32], devnet genesis

async function axe(page: Page, label: string) {
  // Let entrance motion settle so contrast is measured on the final ink.
  await page.waitForTimeout(1200);
  const results = await new AxeBuilder({ page: page as never })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(
    serious.map(
      (v) =>
        `${label}: ${v.id} — ${v.nodes.map((n) => `${n.target.join(" ")} [${n.any[0]?.message ?? ""}]`).join(", ")}`,
    ),
  ).toEqual([]);
}

/** In-app navigation: a full reload locks the wallet by design. */
async function nav(page: Page, name: string) {
  await page.locator('nav[aria-label="Wallet index"]').getByRole("link", { name, exact: true }).click();
}

function fund(address: string) {
  execFileSync("npx", ["vitest", "run", "--config", "vitest.fund.config.ts"], {
    env: { ...process.env, FUND_TO: address },
    stdio: "pipe",
    shell: true,
  });
}

test("landing is accessible and reads the live network", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Aletheia Wallet" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Latest finalized block/ })).toBeVisible();
  await axe(page, "landing");
  for (const path of ["/about", "/security", "/help", "/network"]) {
    await page.goto(path);
    await axe(page, path);
  }
});

test("create, fund, send to finality, lock and unlock", async ({ page }) => {
  await page.goto("/create");
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "I understand" }).click();
  await page.getByRole("button", { name: "Generate 24 words" }).click();
  await page.getByRole("button", { name: "Reveal words" }).click();
  await axe(page, "certificate");
  const words = await page.locator(".certificate .ink").allTextContents();
  expect(words).toHaveLength(24);

  await page.getByRole("button", { name: "Confirm without holding" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "I have written this down" }).click();

  for (let i = 0; i < 4; i++) {
    const place = Number(await page.locator(".verify li.next .n").textContent());
    await page
      .locator(".bank .chip", { hasText: new RegExp(`^${words[place - 1]}$`) })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Repeat password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Seal wallet" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });

  const address = (await page.locator(".identity .value").getAttribute("title"))!;
  expect(address).toMatch(/^alt:[0-9a-fA-F]{40}$/);
  await expect(page.getByText("No transfers yet")).toBeVisible();
  await axe(page, "dashboard empty");

  fund(address);
  // The helper regenerates .svelte-kit, so the dev server reloads the page; a reload locks the
  // wallet by design. Unlock again if that happened.
  await page.waitForTimeout(1500);
  if (page.url().includes("/unlock")) {
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  }
  await expect(page.getByText("Received from").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".secondary .visually-hidden").first()).toContainText("250.000");

  await nav(page, "Receive");
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  await axe(page, "receive");

  await nav(page, "Send");
  await page.getByLabel("To", { exact: true }).fill(DEV_ACCOUNT);
  await page.getByRole("textbox", { name: /^Amount/ }).fill("12.5");
  await page.getByLabel("Memo (optional)", { exact: true }).fill("e2e return");
  await page.getByRole("button", { name: "Price this transfer" }).click();
  await expect(page.getByText("Decoded from the bytes to sign")).toBeVisible({ timeout: 30_000 });
  await axe(page, "send review");
  await page.getByRole("button", { name: "Confirm without holding" }).click();
  await page.getByRole("checkbox", { name: /I have read the details/ }).check();
  await page.getByRole("button", { name: "Hold to sign and send" }).click();
  await expect(page.getByText(/Signed locally · digest/)).toBeVisible();
  await expect(page.getByText(/Finalized at block/)).toBeVisible({ timeout: 30_000 });

  await nav(page, "Activity");
  await expect(page.getByText("Sent to").first()).toBeVisible();
  await axe(page, "activity");

  await page.getByRole("button", { name: "Lock wallet" }).click();
  await expect(page).toHaveURL(/\/unlock/);
  await page.getByLabel("Password", { exact: true }).fill("not the password");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("That password does not open this wallet.")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
});
