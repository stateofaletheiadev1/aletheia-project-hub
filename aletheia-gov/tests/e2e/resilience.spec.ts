import { expect, test } from "@playwright/test";

// Progressive enhancement and reduced motion (brief §6.7, §17).

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("all homepage content is visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2500); // CSS entrance animations finish
    const hidden = await page.evaluate(
      () =>
        [...document.querySelectorAll("main h1, main h2, main p, main li")].filter((el) => {
          const s = getComputedStyle(el);
          return s.visibility === "hidden" || Number(s.opacity) < 0.99;
        }).length,
    );
    expect(hidden).toBe(0);
    await expect(page.getByText("No founding roles are open at this time.")).toBeVisible();
  });

  test("search still works as a plain form", async ({ page }) => {
    await page.goto("/search");
    await page.getByLabel(/Institutions, programmes/).fill("treasury");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("link", { name: /Treasury and Public Finance/ })).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing waits on a scroll reveal", async ({ page }) => {
    await page.goto("/");
    await page.mouse.wheel(0, 2400);
    await page.waitForTimeout(400);
    const transforms = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-reveal], [data-parallax]")].map((el) => getComputedStyle(el).transform),
    );
    for (const t of transforms) expect(t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
  });
});
