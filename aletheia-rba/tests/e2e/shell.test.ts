import { expect, test } from '@playwright/test';

const isMobile = (name: string) => name.includes('mobile');

test('the skip link is the first focusable element and moves focus to main', async ({
	page,
	browserName
}) => {
	test.skip(browserName === 'webkit', 'WebKit only tabs to links when Option is held');
	await page.goto('/about');
	await page.keyboard.press('Tab');
	const skip = page.getByRole('link', { name: 'Skip to main content' });
	await expect(skip).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('main#main')).toBeFocused();
});

test.describe('desktop navigation', () => {
	test.beforeEach(({}, info) => {
		test.skip(isMobile(info.project.name), 'desktop only');
	});

	test('submenu is a disclosure: opens, closes on Escape and returns focus', async ({ page }) => {
		await page.goto('/about');
		const button = page.getByRole('button', { name: 'The Guilder' });
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await button.click();
		await expect(button).toHaveAttribute('aria-expanded', 'true');
		const panel = page.locator('#nav-the-guilder');
		await expect(panel.getByRole('link', { name: /Banknotes/ })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await expect(button).toBeFocused();
	});

	test('submenu closes on an outside click and after navigating', async ({ page }) => {
		await page.goto('/about');
		const button = page.getByRole('button', { name: 'The Guilder' });
		await button.click();
		await page.locator('main h1').click();
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await button.click();
		await page
			.locator('#nav-the-guilder')
			.getByRole('link', { name: /Issuance/ })
			.click();
		await expect(page).toHaveURL(/\/issuance$/);
		await expect(button).toHaveAttribute('aria-expanded', 'false');
	});

	test('the current page is marked', async ({ page }) => {
		await page.goto('/monetary-policy');
		await expect(
			page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Monetary Policy' })
		).toHaveAttribute('aria-current', 'page');
	});
});

test.describe('mobile navigation', () => {
	test.beforeEach(({}, info) => {
		test.skip(!isMobile(info.project.name), 'mobile only');
	});

	test('opens as a modal dialog, traps focus, closes on Escape and restores focus', async ({
		page
	}) => {
		await page.goto('/about');
		const trigger = page.getByRole('button', { name: 'Menu' });
		await trigger.click();
		const dialog = page.locator('dialog#mobile-nav');
		await expect(dialog).toBeVisible();
		for (let i = 0; i < 25; i++) {
			await page.keyboard.press('Tab');
			const inside = await page.evaluate(
				() =>
					!!document.activeElement?.closest('dialog#mobile-nav') ||
					document.activeElement === document.body
			);
			expect(inside).toBe(true);
		}
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();
	});

	test('closes when a link is followed', async ({ page }) => {
		await page.goto('/about');
		await page.getByRole('button', { name: 'Menu' }).click();
		await page.locator('dialog#mobile-nav').getByRole('link', { name: 'Statistics' }).click();
		await expect(page).toHaveURL(/\/statistics$/);
		await expect(page.locator('dialog#mobile-nav')).toBeHidden();
	});

	test('touch targets are at least 44 px tall', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Menu' }).click();
		const heights = await page
			.locator('dialog#mobile-nav a, dialog#mobile-nav button')
			.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
		for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
	});
});

test.describe('banknotes', () => {
	test('denomination selector is a radiogroup operated with arrow keys', async ({ page }) => {
		await page.goto('/banknotes');
		const group = page.getByRole('radiogroup', { name: 'Denomination' });
		const checked = group.getByRole('radio', { checked: true });
		await expect(checked).toHaveText('100');
		await checked.focus();
		await page.keyboard.press('ArrowLeft');
		await expect(group.getByRole('radio', { checked: true })).toHaveText('20');
		await expect(group.getByRole('radio', { name: '20' })).toBeFocused();
		const flip = page.getByRole('button', { name: 'Show back' }).first();
		await flip.click();
		await expect(flip).toHaveAttribute('aria-pressed', 'true');
	});

	test('the viewer opens, changes note, turns over, closes on Escape and restores focus', async ({
		page
	}) => {
		await page.goto('/banknotes');
		const opener = page.locator('#aey-5 .face__link').first();
		await opener.scrollIntoViewIfNeeded();
		await opener.click();
		const viewer = page.getByRole('dialog', { name: 'Banknote viewer' });
		await expect(viewer).toBeVisible();
		const live = viewer.locator('[aria-live="polite"]');
		await expect(live).toHaveText('5 AEY, front. Note 2 of 5.');
		await page.keyboard.press('ArrowRight');
		await expect(live).toHaveText('10 AEY, front. Note 3 of 5.');
		await page.keyboard.press('f');
		await expect(live).toHaveText('10 AEY, back. Note 3 of 5.');
		await viewer.getByRole('button', { name: 'Zoom in' }).click();
		await expect(viewer.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
		await page.keyboard.press('Escape');
		await expect(viewer).toBeHidden();
		await expect(opener).toBeFocused();
	});

	test('every image keeps its true aspect ratio', async ({ page }) => {
		await page.goto('/banknotes');
		const ratios = await page.locator('.face__link img').evaluateAll((imgs) =>
			imgs.map((img) => {
				const i = img as HTMLImageElement;
				const box = i.getBoundingClientRect();
				return { natural: i.naturalWidth / i.naturalHeight, shown: box.width / box.height };
			})
		);
		expect(ratios).toHaveLength(10);
		for (const r of ratios) expect(Math.abs(r.natural - r.shown)).toBeLessThan(0.02);
	});
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('content is visible and the menu is reachable', async ({ page }, info) => {
		await page.goto('/');
		await expect(page.locator('h1')).toBeVisible();
		await expect(page.locator('[data-reveal]').first()).toHaveCSS('opacity', '1');
		if (isMobile(info.project.name)) {
			const menu = page.getByRole('link', { name: 'Menu' });
			await expect(menu).toBeVisible();
			await expect(menu).toHaveAttribute('href', '#site-footer-nav');
		} else {
			await expect(page.getByRole('link', { name: 'The Guilder' }).first()).toBeAttached();
		}
		await expect(page.locator('#site-footer-nav')).toBeAttached();
	});

	test('banknote images link to the full-size files', async ({ page }) => {
		await page.goto('/banknotes');
		const href = await page.locator('#aey-1 .face__link').first().getAttribute('href');
		expect(href).toMatch(/aey-1-front.*\.jpg$/);
	});
});

test('with reduced motion, the hero is shown at once', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await expect(page.locator('.hero__stage .note')).toHaveCSS('opacity', '1');
});
