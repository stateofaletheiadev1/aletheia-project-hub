import { expect, test, type Page } from "@playwright/test";
import { code, state } from "./helpers";

// The aletheiagov.org staff area (test portal on port 3220): two-step sign-in is off until the
// officer turns it on, and they can turn it off again at any time.

const PORTAL = "http://localhost:3220";
const PASSWORD = "lantern quay morning tide";

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${PORTAL}/sign-in`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page.getByText("You are signed out.")).toBeVisible();
}

test("a portal officer turns two-step sign-in on, uses it, and turns it off again", async ({ page }) => {
  const { portalStaff } = state();

  // First sign-in: password only, then the officer chooses their own password.
  await signIn(page, portalStaff.email, portalStaff.password);
  await expect(page).toHaveURL(/\/workbench\/account\?first=1/);
  await page.getByLabel("Current password").fill(portalStaff.password);
  await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Repeat new password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/workbench\?welcome=1/);

  // Off by default, and the officer is told it can be turned on at any time.
  await expect(page.getByText("You can turn on two-step sign-in at any time in")).toBeVisible();
  await page.getByRole("link", { name: "Account and security" }).first().click();
  await expect(page.getByText(/you can turn on two-step sign-in at any time/)).toBeVisible();

  // Turn it on: scan (here, read the key) and confirm with a code.
  await page.getByRole("button", { name: "Turn on two-step sign-in" }).click();
  await expect(page.getByRole("heading", { name: "Set up two-step sign-in" })).toBeVisible();
  await page.getByText("Cannot scan? Enter this key instead").click();
  const secret = (await page.locator("details p.t-ref").innerText()).replace(/\s+/g, "");
  await page.getByLabel("Six-digit code").fill(code(secret));
  await page.getByRole("button", { name: "Turn on two-step sign-in" }).click();
  await expect(page.getByText("Two-step sign-in is on.")).toBeVisible();
  await expect(page.getByText(/You can turn it off at any time/)).toBeVisible();

  // Signing in now asks for the code (the next one: a code is accepted once only).
  await signOut(page);
  await signIn(page, portalStaff.email, PASSWORD);
  await expect(page.getByRole("heading", { name: "Authenticator code" })).toBeVisible();
  await page.getByLabel("Six-digit code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That code is not right.")).toBeVisible();
  await page.getByLabel("Six-digit code").fill(code(secret, Date.now() + 30_000));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workbench$/);
  await expect(page.getByText("Two-step sign-in is on", { exact: false }).first()).toBeVisible();

  // Turn it off again, with the password; the next sign-in is password only.
  await page.goto(`${PORTAL}/workbench/account#two-step`);
  await page.locator("summary", { hasText: "Turn two-step sign-in off" }).click();
  await page.getByLabel("Your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Turn two-step sign-in off" }).click();
  await expect(page.getByText(/Two-step sign-in is off\. You sign in with your password only\. You can turn it on again at any time\./)).toBeVisible();
  await page.goto(`${PORTAL}/workbench`);
  await signOut(page);
  await signIn(page, portalStaff.email, PASSWORD);
  await expect(page).toHaveURL(/\/workbench$/);
});
