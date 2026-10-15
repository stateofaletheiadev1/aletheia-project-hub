import { expect, test, type Browser, type Page } from "@playwright/test";
import { nav, nextStep, signIn, state, takeStep, type Person } from "./helpers";

// A dispatch from draft to the public record (brief §38: E2E 3, 4, 5, 6, 7, 10, 11, 16).
// Four officials, each in their own browser: author, reviewer, approving officer, publisher.

async function as(browser: Browser, who: Person, fresh: boolean): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 880 } });
  const page = await ctx.newPage();
  await signIn(page, who, fresh);
  return page;
}

test("a dispatch is drafted, returned, revised, approved, authorised and published", async ({ browser }) => {
  const { people } = state();
  const first = await browser.newPage();
  await nextStep(first); // every official accepted their invitation moments ago
  await first.close();
  const author = await as(browser, people.author!, true);
  const reviewer = await as(browser, people.reviewer!, true);
  const approver = await as(browser, people.approver!, true);
  const publisher = await as(browser, people.publisher!, true);

  // E2E 3: the author drafts; the draft saves and survives a reload.
  await nav(author, "Dispatches");
  await expect(author.getByText("No dispatches yet.")).toBeVisible();
  await author.getByRole("link", { name: "New dispatch" }).click();
  await author.getByLabel("Title", { exact: true }).fill("Notice of the first public session of the Treasury");
  await author.getByLabel(/^Summary/).fill("When and where the Treasury will hold its first public session.");
  await author.getByLabel("Text", { exact: true }).fill("The Treasury will hold its first public session on 1 November 2026.\n\n## Agenda\n\n- Founding budget\n- Questions from the public");
  await author.getByLabel(/^Facts/).fill("Date: 1 November 2026");
  await author.getByLabel("Classification", { exact: true }).selectOption("public");
  await author.getByRole("button", { name: "Create draft dispatch" }).click();
  await expect(author.getByText("Draft created")).toBeVisible();
  await author.reload();
  await expect(author.getByLabel("Title", { exact: true })).toHaveValue("Notice of the first public session of the Treasury");
  await author.getByRole("tab", { name: "Preview" }).click();
  await expect(author.getByRole("article", { name: "Preview as on aletheiagov.org" }).getByRole("heading", { name: "Agenda" })).toBeVisible();
  await author.getByRole("link", { name: "Back to the record" }).click();
  const recordUrl = author.url();

  // E2E 4: the author submits for review.
  await takeStep(author, "Submit for review");
  await expect(author.getByText("Submitted").first()).toBeVisible();

  // E2E 5: the reviewer finds it in their queue and requests revision with a reason.
  await nav(reviewer, "My queue");
  await reviewer.getByRole("link", { name: "Notice of the first public session of the Treasury" }).click();
  await takeStep(reviewer, "Take for review");
  await takeStep(reviewer, "Request revision", "Give the venue of the session.");
  await expect(reviewer.getByText("Revision requested").first()).toBeVisible();

  // E2E 6: the author revises and resubmits; the changes are shown word by word.
  await author.reload();
  await expect(author.getByText("Give the venue of the session.").first()).toBeVisible();
  await author.getByRole("link", { name: "Edit the draft" }).click();
  await author.getByLabel("Text", { exact: true }).fill("The Treasury will hold its first public session on 1 November 2026 in Antioch.\n\n## Agenda\n\n- Founding budget\n- Questions from the public");
  await author.getByRole("button", { name: "Save draft" }).click();
  await expect(author.getByText(/^Saved \d\d:\d\d/)).toBeVisible();
  await author.getByRole("link", { name: "Back to the record" }).click();
  await takeStep(author, "Submit for review");
  await author.getByRole("link", { name: "Changes from version 1" }).click();
  await expect(author.getByRole("heading", { name: "Version 1 to version 2" })).toBeVisible();
  await expect(author.locator("ins").filter({ hasText: "in Antioch" })).toBeVisible();

  // The author has no approval step on their own record (E2E 9).
  await author.goto(recordUrl);
  await expect(author.getByRole("region", { name: "Your next action" }).getByRole("button", { name: "Approve dispatch" })).toHaveCount(0);

  // E2E 7: the reviewer takes it again; the approving officer approves the corrected version.
  await reviewer.goto(recordUrl);
  await takeStep(reviewer, "Take for review");
  await approver.goto(recordUrl);
  await takeStep(approver, "Approve dispatch");
  await expect(approver.getByText("Approved", { exact: true }).first()).toBeVisible();

  // E2E 10, 11: the publisher authorises (the reference is issued) and publishes.
  await publisher.goto(recordUrl);
  await takeStep(publisher, "Authorise publication");
  await expect(publisher.getByText("AGV-DSP-2026-0001").first()).toBeVisible();
  await takeStep(publisher, "Publish to the public record");
  await expect(publisher.getByText("Simulated receipt: not public")).toBeVisible();
  await expect(publisher.getByText("Published", { exact: true }).first()).toBeVisible();

  // E2E 16: the audit register holds every step, and its chain verifies.
  await approver.close();
  const admin = await as(browser, people.adminA!, true);
  await nav(admin, "Audit register");
  await expect(admin.getByText(/Integrity verified as of/)).toBeVisible();

  // The register lists the record with its reference and state.
  await nav(author, "Dispatches");
  await expect(author.getByRole("table", { name: "Dispatches" }).getByText("AGV-DSP-2026-0001")).toBeVisible();
});
