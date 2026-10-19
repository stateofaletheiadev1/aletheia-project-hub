import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	// Each worker runs a full browser; more than four starve the preview server on a laptop.
	workers: process.env.CI ? 2 : 4,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		// Traces only on a retry: snapshotting every test's large SVG DOM slows page loads to a crawl.
		trace: 'on-first-retry'
	},
	webServer: {
		// Serves the prerendered build/ output exactly as a static host would.
		command: `tsx scripts/serve.ts ${PORT}`,
		// Serves build/ like the static host (scripts/serve.ts); `vite preview` stalls under load.
		url: `http://127.0.0.1:${PORT}/`,
		timeout: 120_000,
		reuseExistingServer: !process.env.CI
	},
	projects: [
		{ name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
		{ name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
		{ name: 'webkit-mobile', use: { ...devices['iPhone 15'] } }
	]
});
