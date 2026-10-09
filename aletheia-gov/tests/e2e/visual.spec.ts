import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES } from "./routes";

// Visual regression (brief §6.8, §19). Baselines live in tests/visual/ and are
// per-platform: fonts rasterise differently on Windows and Linux, so CI keeps its own.
// Update after an intended design change: npx playwright test visual --update-snapshots

// Full pages load every image; a cold image cache needs time to encode AVIF.
test.describe.configure({ timeout: 90_000 });

const STATIC_ROUTES = PUBLIC_ROUTES.filter((r) => !r.includes("?"));

for (const route of STATIC_ROUTES) {
  test(`visual: ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      // Settle the page: every reveal finished, every lazy image loaded, parallax at rest.
      document.querySelectorAll("[data-reveal]").forEach((e) => e.setAttribute("data-reveal", "shown"));
      document.querySelectorAll("[data-clip]").forEach((e) => e.setAttribute("data-clip", "shown"));
      document.querySelectorAll<HTMLImageElement>("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
      await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((e) => (e.style.transform = "none"));
    });
    // Decorative layers are not layout: the contour fields drift with parallax and the
    // paper grain is noise. Hiding both keeps diffs meaningful and baselines small.
    await page.addStyleTag({
      content: '.contour-field{visibility:hidden!important} body,.ledger,.ledger-pale{background-image:none!important}',
    });
    await page.waitForTimeout(1600);
    await expect(page).toHaveScreenshot(`${route === "/" ? "home" : route.slice(1).replace(/\//g, "_")}.png`, {
      fullPage: true,
      // Photographs are content, not layout. The colophon's edition date changes every build.
      mask: [page.locator("img:not(.contour-field)"), page.getByText(/^Edition of /)],
    });
  });
}
