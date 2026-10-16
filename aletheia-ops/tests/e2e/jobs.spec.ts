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

  // The public page: kind, closing date, and Apply.
  const site = await browser.newPage();
  await site.goto(`http://localhost:3220/opportunities/${reference.toLowerCase()}`);
  await expect(site.getByRole("heading", { name: "Founding coordinator, seasteading working group" })).toBeVisible();
  await expect(site.getByText("Volunteer roles")).toBeVisible();
  await expect(site.getByText("30 November 2099").first()).toBeVisible();
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
  await founderCtx.close();
});
