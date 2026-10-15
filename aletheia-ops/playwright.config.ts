import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// End-to-end tests (brief §38) against isolated data: `npm run e2e` first runs tests/e2e/setup.ts,
// which creates a fresh database in the local AletheiaDB (npm run db:local) with its own officials,
// then builds the app and starts it on port 3310 against that database only.
//   SLOW_MO=350 npm run e2e -- --headed      to watch it

function envFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3310",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      slowMo: Number(process.env.SLOW_MO ?? 0),
    },
  },
  webServer: [
    {
      command: "npx next start --port 3310",
      url: "http://localhost:3310/sign-in",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...envFile(".env.e2e.local"), NODE_ENV: "production" },
    },
    {
      // A test copy of aletheiagov.org (built with `npm run build` in ../aletheia-gov), on its own
      // test database, receiving real signed publications.
      command: "node scripts/start.mjs 3220",
      cwd: "../aletheia-gov",
      url: "http://localhost:3220/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...envFile(".env.e2e-portal.local"), NODE_ENV: "production" },
    },
  ],
});
