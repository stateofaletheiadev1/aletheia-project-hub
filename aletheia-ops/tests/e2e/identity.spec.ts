import { expect, test, type Page } from "@playwright/test";
import { Secret, TOTP } from "otpauth";

// Identity end to end, through the interface only (brief §38: E2E 1, 2, 19, 20).
// Either INVITATION_URL (an unused administrator invitation from scripts/admin-bootstrap.ts), or
// ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_KEY (the authenticator key) of an active administrator.

const invitation = process.env.INVITATION_URL;
const admin = process.env.ADMIN_KEY ? { email: process.env.ADMIN_EMAIL ?? "second.admin@example.org", key: process.env.ADMIN_KEY, password: process.env.ADMIN_PASSWORD } : null;
const PASSWORD = "harbour lantern quiet evening";
const stamp = Date.now().toString(36);

function code(secret: string, at = Date.now()): string {
  return new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30, algorithm: "SHA1" }).generate({ timestamp: at });
}

/** Waits until the next 30-second step, so a code is never a replay of the last one used. */
async function nextStep(page: Page): Promise<void> {
  const wait = 30_000 - (Date.now() % 30_000) + 1_000;
  await page.waitForTimeout(wait);
}

async function signIn(page: Page, email: string, password: string, key: string, alreadyOnPage = false): Promise<void> {
  if (!alreadyOnPage) {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
  }
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
  await nextStep(page);
  await page.getByLabel("Six-digit code").fill(code(key));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Requires your action")).toBeVisible();
}

async function acceptInvitation(page: Page, link: string): Promise<string> {
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
  // A weak password is refused with the reason.
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

test("an invited administrator joins, invites an official, signs out and back in; the official's access is limited", async ({ page, browser }) => {
  test.skip(!invitation && !admin, "set INVITATION_URL, or ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_KEY");

  // E2E 2: nothing is reachable without signing in.
  await page.goto("/officials");
  await expect(page).toHaveURL(/\/sign-in/);

  // E2E 1: accept the invitation, choose a password, enrol an authenticator (or sign in).
  let adminKey: string;
  const adminPassword = admin?.password ?? PASSWORD;
  if (invitation) {
    adminKey = await acceptInvitation(page, invitation);
    console.log(`Administrator authenticator key (local test account only): ${adminKey}`);
  } else {
    adminKey = admin!.key;
    await signIn(page, admin!.email, adminPassword, adminKey);
  }
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/\d{4}/);

  // Invite an official with one ordinary role and one privileged role.
  await page.getByRole("navigation", { name: "Workbench" }).getByRole("link", { name: "Officials and access" }).click();
  await page.getByRole("link", { name: "Invite an official" }).click();
  await page.getByLabel("Full name").fill("Tobias Aldridge");
  await page.getByLabel("Email address").fill(`tobias.${stamp}@example.org`);
  await page.getByLabel("Role 1").selectOption("author");
  await page.locator("#institution-0").selectOption("treasury");
  await page.getByRole("button", { name: "Add another role" }).click();
  await page.getByLabel("Role 2").selectOption("publishing_officer");
  await page.locator("#institution-1").selectOption("treasury");
  await page.locator("#clearance-1").selectOption("public");
  await page.getByLabel("Reason").fill("Founding author and publishing officer for the Treasury (end-to-end test)");
  await page.getByRole("button", { name: "Create the invitation" }).click();
  await expect(page.getByText("One privileged role waits for a second administrator")).toBeVisible();
  const officialLink = (await page.locator(".ref").first().innerText()).trim();

  // The proposer sees the change waiting, and cannot confirm it.
  await page.getByRole("link", { name: "Back to officials and access" }).click();
  await expect(page.getByText("Waiting for a second administrator")).toBeVisible();
  await expect(page.getByText("You proposed this. Another administrator must decide it.").first()).toBeVisible();

  // The audit register has every step, and its chain verifies.
  await page.getByRole("navigation", { name: "Workbench" }).getByRole("link", { name: "Audit register" }).click();
  await expect(page.getByText(/Integrity verified as of/)).toBeVisible();
  await expect(page.getByText("Privileged role change proposed: Tobias Aldridge").first()).toBeVisible();

  // Sign out; the workbench is closed again.
  await page.locator("header summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);

  // A wrong password is refused without saying which part was wrong.
  const email = "second.admin@example.org";
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("not the right password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Those details were not accepted");

  // Password, then a fresh authenticator code.
  await signIn(page, email, adminPassword, adminKey, true);
  await expect(page.getByText("Requires your action")).toBeVisible();

  // The invited official joins in a separate browser, and has only the ordinary role.
  const other = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const tobias = await other.newPage();
  await acceptInvitation(tobias, officialLink);
  await expect(tobias.getByRole("navigation", { name: "Workbench" }).getByRole("link", { name: "Officials and access" })).toHaveCount(0);
  const denied = await tobias.goto("/officials");
  expect(denied?.status()).toBe(404);
  await tobias.goto("/account");
  await expect(tobias.getByRole("listitem").filter({ hasText: "Author, Treasury and Public Finance (Internal clearance)" })).toBeVisible();
  await expect(tobias.getByRole("listitem").filter({ hasText: "Publishing officer" })).toHaveCount(0);
  await other.close();
});
