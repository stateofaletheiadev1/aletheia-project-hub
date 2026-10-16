import { expect, test } from "@playwright/test";
import { nav, signIn, state, takeStep } from "./helpers";

// Posting a job and applying for it: a founder publishes an opportunity with its kind and closing
// date; the portal shows it with an Apply button; an applicant applies with a CV, recorded
// against the position.

// A minimal well-formed PDF (header, one empty page, trailer, %%EOF), with no scripts.
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

test("a founder posts a position and a person applies for it", async ({ browser }) => {
  const { people } = state();
  const founderCtx = await browser.newContext({ viewport: { width: 1360, height: 880 } });
  const founder = await founderCtx.newPage();
  await signIn(founder, people.adminA!);

  await nav(founder, "Opportunities and applications");
  await founder.getByRole("link", { name: "New opportunity" }).click();
  await founder.getByLabel("Title", { exact: true }).fill("Founding coordinator, seasteading working group");
  await founder.getByLabel("Text", { exact: true }).fill("Bring together the people from our online communities who want to help build a seastead.\n\n## What you will do\n\n- Organise the working group\n- Report to the Founding Government");
  await founder.getByLabel("Classification", { exact: true }).selectOption("public");
  await founder.getByLabel("Institution", { exact: true }).selectOption("founding-government");
  await founder.getByLabel("Kind of position").selectOption("volunteer");
  await founder.getByLabel("Closing date").fill("2099-11-30");
  await founder.getByRole("button", { name: "Create draft opportunity" }).click();
  await expect(founder.getByText("Draft created")).toBeVisible();
  await founder.getByRole("link", { name: "Back to the record" }).click();
  for (const step of ["Submit for review", "Take for review", "Approve opportunity", "Authorise publication", "Publish to the public record"]) await takeStep(founder, step);
  await expect(founder.getByText("Publication receipt")).toBeVisible();
  const reference = (await founder.locator("dd.ref").first().innerText()).trim();
  expect(reference).toMatch(/^AGV-OPP-2026-\d{4}$/);

  // A correction: the closing date moves; the same reference is republished as version 2.
  const recordUrl = founder.url();
  await takeStep(founder, "Start a correction", "Closing date extended");
  await founder.goto(`${recordUrl.replace(/\/edit.*$/, "").replace(/\?.*$/, "")}/edit`);
  await founder.getByLabel("Closing date").fill("2099-12-30");
  await founder.getByRole("button", { name: "Save draft" }).click();
  await expect(founder.getByText(/^Saved /)).toBeVisible();
  await founder.reload();
  await expect(founder.getByLabel("Closing date")).toHaveValue("2099-12-30");
  await founder.goto(recordUrl.replace(/\/edit.*$/, "").replace(/\?.*$/, ""));
  for (const step of ["Submit for review", "Take for review", "Approve opportunity", "Authorise publication", "Publish to the public record"]) await takeStep(founder, step);
  await expect(founder.getByText("Publication receipt")).toBeVisible();
  expect((await founder.locator("dd.ref").first().innerText()).trim()).toBe(reference);

  // The public page: kind, closing date, and Apply.
  const site = await browser.newPage();
  await site.goto(`http://localhost:3220/opportunities/${reference.toLowerCase()}`);
  await expect(site.getByRole("heading", { name: "Founding coordinator, seasteading working group" })).toBeVisible();
  await expect(site.getByText("Volunteer roles")).toBeVisible();
  await expect(site.getByText("30 December 2099").first()).toBeVisible();
  await site.getByRole("link", { name: "Apply for this position" }).click();

  // The application form knows the position.
  await expect(site.getByRole("heading", { name: "Apply for a position" })).toBeVisible();
  await expect(site.getByText(reference).first()).toBeVisible();
  await site.waitForTimeout(3_500); // the form refuses submissions faster than a person could type
  await site.locator("#interest-fullName").fill("Ada Seasteader");
  await site.locator("#interest-email").fill("ada.seasteader@example.org");
  await expect(site.getByRole("checkbox", { name: /Volunteer roles/ })).toBeChecked();
  await site.locator("#interest-expertise").selectOption("Maritime affairs");
  await site.locator('input[name="cv"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await site.locator("#interest-consent").check();
  await site.locator('form button[type="submit"]').click();
  await expect(site.getByText("Thank you. Your interest is recorded.")).toBeVisible();
  await expect(site.getByText(/AGV-EOI-2026-\d{4}/)).toBeVisible();
  const application = ((await site.getByText(/AGV-EOI-2026-\d{4}/).first().innerText()).match(/AGV-EOI-2026-\d{4}/) ?? [""])[0];

  // The workbench reads the application from the portal (ADR 0011), filtered by the position.
  await nav(founder, "Applications");
  await founder.getByLabel("Position applied for").fill(reference);
  await founder.getByRole("button", { name: "Apply filters" }).click();
  await expect(founder.getByText("Showing 1 of 1 application")).toBeVisible();
  await founder.getByRole("link", { name: application }).first().click();
  await expect(founder.getByRole("heading", { name: "Ada Seasteader" })).toBeVisible();
  await expect(founder.getByText("Received; not changed since")).toBeVisible();

  // The CV comes through the workbench, from the portal.
  const cv = await founder.request.get(await founder.getByRole("link", { name: "Download PDF" }).getAttribute("href").then((h) => `http://localhost:3310${h}`));
  expect(cv.status()).toBe(200);
  expect((await cv.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // A status set here is the portal's status: the page is drawn from the portal again on reload.
  await founder.getByLabel("Shortlisted").check();
  await founder.getByRole("button", { name: "Save status" }).click();
  await expect(founder.getByText("Status set to Shortlisted, on aletheiagov.org as well.")).toBeVisible();
  await founder.reload();
  await expect(founder.getByText(/Ada Founder · in the workbench/)).toBeVisible();
  await expect(founder.getByLabel("Shortlisted")).toBeChecked();
  await founderCtx.close();
});
