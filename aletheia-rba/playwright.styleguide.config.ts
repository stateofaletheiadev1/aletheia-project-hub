import { defineConfig, devices } from '@playwright/test';

/** The styleguide exists only in development, so it is tested against the dev server. */
const PORT = 5179;

export default defineConfig({
	testDir: 'tests/styleguide',
	forbidOnly: !!process.env.CI,
	reporter: 'list',
	// The dev server compiles modules on first request; hydration can take several seconds.
	expect: { timeout: 20_000 },
	use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
	webServer: {
		command: `pnpm dev --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } }
	]
});
