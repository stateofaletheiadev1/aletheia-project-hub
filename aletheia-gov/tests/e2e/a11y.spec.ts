import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES } from "./routes";

// WCAG 2.2 AA via axe (brief §17, §19): zero serious or critical violations on every public route.
for (const route of PUBLIC_ROUTES) {
  test(`axe: ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });
    // Audit the settled page: finish every scroll reveal first so nothing is mid-transition.
    await page.evaluate(() => {
      document.querySelectorAll("[data-reveal]").forEach((e) => e.setAttribute("data-reveal", "shown"));
      document.querySelectorAll("[data-clip]").forEach((e) => e.setAttribute("data-clip", "shown"));
    });
    await page.waitForTimeout(1300);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const summary = results.violations.map(
      (v) => `[${v.impact}] ${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`,
    );
    if (summary.length) console.log(`${route}\n  ${summary.join("\n  ")}`);
    expect(blocking, summary.join("\n")).toEqual([]);
  });
}
