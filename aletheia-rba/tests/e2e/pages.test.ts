import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, ROUTES } from './routes';

for (const path of ROUTES) {
	test.describe(path, () => {
		test('renders with one h1, no skipped heading levels and no horizontal overflow', async ({
			page
		}) => {
			const response = await page.goto(path);
			expect(response?.status()).toBe(200);
			await expect(page.locator('h1')).toHaveCount(1);

			const levels = await page
				.locator('main h1, main h2, main h3, main h4, main h5, main h6')
				.evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
			for (let i = 1; i < levels.length; i++) {
				const prev = levels[i - 1] ?? 1;
				expect(levels[i] ?? 1, `heading after h${prev}`).toBeLessThanOrEqual(prev + 1);
			}

			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow).toBeLessThanOrEqual(0);
		});

		test('has a canonical URL and, below home, breadcrumbs ending on the current page', async ({
			page
		}) => {
			await page.goto(path);
			const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
			expect(canonical).toBe(
				path === '/' ? 'https://rbaletheia.org/' : `https://rbaletheia.org${path}`
			);
			if (path !== '/') {
				const crumbs = page.locator('nav[aria-label="Breadcrumb"] ol li');
				await expect(crumbs.first()).toHaveText(/Home/);
				await expect(crumbs.last().locator('[aria-current="page"]')).toHaveCount(1);
				expect(await page.locator('script[type="application/ld+json"]').allTextContents()).toEqual(
					expect.arrayContaining([expect.stringContaining('BreadcrumbList')])
				);
			}
		});

		test('passes axe (WCAG 2.2 AA)', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto(path);
			const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
			expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
		});
	});
}

test('titles and descriptions are unique across routes', async ({ request }) => {
	const titles = new Set<string>();
	const descriptions = new Set<string>();
	for (const path of ROUTES) {
		const html = await (await request.get(path)).text();
		titles.add(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '');
		descriptions.add(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '');
	}
	expect(titles.size).toBe(ROUTES.length);
	expect(descriptions.size).toBe(ROUTES.length);
});

test('previews are not indexed', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('an unknown address shows the designed 404 page', async ({ page }) => {
	const response = await page.goto('/no-such-page');
	expect(response?.status()).toBe(404);
	await expect(page.locator('h1')).toHaveText('There is no page at this address.');
});

test('Open Graph images and the logo exist in the build', async ({ request }) => {
	for (const path of ROUTES) {
		const html = await (await request.get(path)).text();
		const og = /<meta property="og:image" content="([^"]*)"/.exec(html)?.[1] ?? '';
		expect(og, path).toMatch(/^https:\/\/rbaletheia\.org\/og\/[\w-]+\.png$/);
		const local = new URL(og).pathname;
		expect((await request.get(local)).status(), local).toBe(200);
	}
	expect((await request.get('/logo.png')).status()).toBe(200);
});
