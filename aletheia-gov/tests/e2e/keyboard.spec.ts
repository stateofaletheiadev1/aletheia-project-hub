import { expect, test } from "@playwright/test";

// The manual keyboard pass of docs/accessibility-review.md, automated where it can be.

test("skip link is the first stop and moves focus to main", async ({ page }) => {
  await page.goto("/government");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("every focusable element shows a visible focus outline", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "none";
      const s = getComputedStyle(el);
      return `${s.outlineStyle} ${s.outlineWidth}`;
    });
    expect(outline, `focus stop ${i + 1}`).not.toMatch(/^none|0px$/);
  }
});

test("navigating moves focus to the new page heading", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop navigation");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Institutions" }).click();
  await expect(page).toHaveURL(/\/institutions$/);
  await expect(page.locator("#page-title")).toBeFocused();
});

test("record menu opens from the keyboard and closes on Escape", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop navigation");
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Record" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.locator("#record-menu");
  await expect(menu.getByRole("link", { name: /Decisions/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu.getByRole("link", { name: /Decisions/ })).toBeHidden();
});

test("mobile drawer contains focus, closes on Escape and returns focus", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile navigation");
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Menu" });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Site menu" });
  await expect(drawer).toBeVisible();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog") || document.activeElement === document.body)).toBe(true);
  }
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
});

test("search works from the keyboard", async ({ page }) => {
  await page.goto("/search");
  await page.getByLabel(/Institutions, programmes/).fill("reserve bank");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=reserve/);
  await expect(page.getByRole("link", { name: /Reserve Bank of Aletheia/ }).first()).toBeVisible();
});

test("programme rail scrolls with its buttons", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop rail");
  await page.goto("/");
  const next = page.getByRole("button", { name: "Next programme" });
  await next.scrollIntoViewIfNeeded();
  const prev = page.getByRole("button", { name: "Previous programme" });
  await expect(prev).toBeDisabled();
  await next.click();
  await expect(prev).toBeEnabled();
});
