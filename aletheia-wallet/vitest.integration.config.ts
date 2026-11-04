// Integration tests against a real `aletheiad` devnet (wallet prompt 18.2). Start it first:
//   ../aletheia-node/target/debug/aletheiad.exe --config tests/devnet/node.toml
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
