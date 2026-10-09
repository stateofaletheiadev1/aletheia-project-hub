import { defineConfig, devices } from "@playwright/test";

// E2E, accessibility and visual tests run against the production build (brief §20 step 8).
// CHROMIUM_PATH lets a machine reuse an installed Chromium instead of downloading one.
const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const port = Number(process.env.PORT ?? 3210);

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: true,
  // One server encodes AVIF on first request; more workers than this saturate its CPU.
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["junit", { outputFile: "test-results/junit.xml" }]] : "list",
  snapshotPathTemplate: "tests/visual/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  expect: {
    // Generous: on a busy machine a full page can need more than the default 5 s to settle
    // into two identical screenshots.
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide", scale: "css" },
  },
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, launchOptions } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, launchOptions } },
  ],
  webServer: {
    command: `node scripts/start.mjs ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
