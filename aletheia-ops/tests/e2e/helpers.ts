import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { Secret, TOTP } from "otpauth";

export type Person = { name: string; email: string; password: string; totp: string };
export type State = { database: string; people: Record<string, Person>; adminInvitation: string };

export function state(): State {
  return JSON.parse(readFileSync(path.join(__dirname, ".state.json"), "utf8")) as State;
}

export function code(secret: string, at = Date.now()): string {
  return new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30, algorithm: "SHA1" }).generate({ timestamp: at });
}

/** Waits for the next 30-second step, so no code repeats one already used. */
export async function nextStep(page: Page): Promise<void> {
  await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_000);
}

/** Signs in with password then a code. `fresh` skips waiting when the step is known to be new. */
export async function signIn(page: Page, who: Person, fresh = false): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
  if (!fresh) await nextStep(page);
  await page.getByLabel("Six-digit code").fill(code(who.totp));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Requires your action")).toBeVisible();
}

export async function nav(page: Page, name: string): Promise<void> {
  await page.getByRole("navigation", { name: "Workbench" }).getByRole("link", { name, exact: true }).click();
}

/** Takes a step from the folio's next-action panel, with a reason when the dialog asks for one. */
export async function takeStep(page: Page, label: string, reason?: string, typed?: string): Promise<void> {
  await page.getByRole("region", { name: "Your next action" }).getByRole("button", { name: label }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  if (reason) await dialog.getByLabel(/Reason/).fill(reason);
  if (typed) await dialog.getByLabel("Type the reference to confirm").fill(typed);
  await dialog.getByRole("button", { name: label }).click();
  await expect(dialog).toBeHidden();
}
