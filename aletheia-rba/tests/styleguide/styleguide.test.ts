import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WIDTHS = [375, 768, 1280, 1600];

for (const width of WIDTHS) {
	test(`styleguide has no horizontal overflow at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/_styleguide');
		await expect(page.locator('h1')).toHaveText('Styleguide');
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});
}

test('styleguide passes axe (WCAG 2.2 AA)', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/_styleguide');
	// Wait for live contrast values to be computed.
	await expect(page.locator('table.contrast td.num').first()).not.toHaveText('…');
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(results.violations).toEqual([]);
});

test('every listed text pair passes its contrast rule', async ({ page }) => {
	await page.goto('/_styleguide');
	await expect(page.locator('table.contrast td.num').first()).not.toHaveText('…');
	await expect(page.locator('table.contrast')).not.toContainText('Fail');
});
