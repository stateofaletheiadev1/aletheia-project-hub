// The end-to-end funding helper runs without the SvelteKit plugin, so it never regenerates
// .svelte-kit and never makes the dev server reload the page under test.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) } },
  test: { include: ["tests/integration/fund.test.ts"], environment: "node", testTimeout: 60_000 },
});
