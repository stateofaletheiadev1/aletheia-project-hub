import { defineConfig } from "@playwright/test";

// End-to-end tests against a running workbench (npm run dev) and its local AletheiaDB
// (scripts/local-db.mjs). SLOW_MO slows every step so a person can follow it in a headed run:
//   SLOW_MO=400 npx playwright test --headed
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3300",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      slowMo: Number(process.env.SLOW_MO ?? 0),
    },
  },
});
