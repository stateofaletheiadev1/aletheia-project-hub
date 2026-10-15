import { expect, test, type Page } from "@playwright/test";
import { code, nav, signIn, state } from "./helpers";

// Identity end to end, through the interface only (brief §38: E2E 1, 2, 19, 20).

const PASSWORD = "harbour lantern quiet evening";

async function acceptInvitation(page: Page, link: string): Promise<string> {
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
  await page.getByLabel("Choose a password").fill("short");
  await page.getByLabel("Enter it again").fill("short");
  await page.getByRole("button", { name: "Save password and continue" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("at least 12 characters");
  await page.getByLabel("Choose a password").fill(PASSWORD);
  await page.getByLabel("Enter it again").fill(PASSWORD);
  await page.getByRole("button", { name: "Save password and continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible();
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  const key = (await page.locator("p.select-all").innerText()).replace(/\s+/g, "");
  await page.getByLabel("Six-digit code from the app").fill(code(key));
  await page.getByRole("button", { name: "Confirm and sign in" }).click();
  await expect(page.getByText("Your account is active")).toBeVisible();
  return key;
}

test("an invited administrator joins, invites an official, signs out and back in; access is limited and revocable", async ({ page, browser }) => {
  const s = state();

  // E2E 2: nothing is reachable without signing in.
  await page.goto("/officials");
  await expect(page).toHaveURL(/\/sign-in/);

  // E2E 1: accept the invitation, choose a password, enrol an authenticator.
  const key = await acceptInvitation(page, s.adminInvitation);
  const me = { name: "Cleo Founder", email: "cleo@e2e.example", password: PASSWORD, totp: key };

  // Invite an official with one ordinary role and one privileged role.
  await nav(page, "Officials and access");
  await page.getByRole("link", { name: "Invite an official" }).click();
  await page.getByLabel("Full name").fill("Søren Østergaard-Ekwueme");
  await page.getByLabel("Email address").fill("soren@e2e.example");
  await page.getByLabel("Role 1").selectOption("author");
  await page.locator("#institution-0").selectOption("treasury");
  await page.getByRole("button", { name: "Add another role" }).click();
  await page.getByLabel("Role 2").selectOption("publishing_officer");
  await page.locator("#institution-1").selectOption("treasury");
  await page.locator("#clearance-1").selectOption("public");
  await page.getByLabel("Reason").fill("Founding author and publishing officer for the Treasury");
  await page.getByRole("button", { name: "Create the invitation" }).click();
  // A founder's grants take effect at once (ADR 0009).
  await expect(page.getByText("Invitation created.")).toBeVisible();
  const link = (await page.locator(".ref").first().innerText()).trim();

  await nav(page, "Audit register");
  await expect(page.getByText(/Integrity verified as of/)).toBeVisible();
  await expect(page.getByText("Official invited: Søren Østergaard-Ekwueme").first()).toBeVisible();

  // Sign out; the workbench is closed again.
  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);

  // A wrong password is refused without saying which part was wrong.
  await page.getByLabel("Email address").fill(me.email);
  await page.getByLabel("Password").fill("not the right password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Those details were not accepted");
  await signIn(page, me);

  // The official joins with both roles. (The two-person rule between ordinary administrators is
  // covered by the unit tests.)
  const third = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const soren = await third.newPage();
  await acceptInvitation(soren, link);
  await expect(soren.getByRole("navigation", { name: "Workbench" }).getByRole("link", { name: "Officials and access" })).toHaveCount(0);
  expect((await soren.goto("/officials"))?.status()).toBe(404);
  await soren.goto("/account");
  await expect(soren.getByRole("listitem").filter({ hasText: "Publishing officer, Treasury and Public Finance" })).toBeVisible();

  // E2E 19: suspension stops the official's very next request.
  await nav(page, "Officials and access");
  await page.getByRole("link", { name: "Søren Østergaard-Ekwueme" }).click();
  await page.locator("#state-reason").fill("End-to-end test of suspension");
  await page.getByRole("button", { name: "Suspend this official" }).click();
  await expect(page.getByText("Suspended. Their sessions have ended.")).toBeVisible();
  await soren.goto("/account");
  await expect(soren).toHaveURL(/\/sign-in/);
  await third.close();
});
