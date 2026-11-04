// End-to-end tests (wallet prompt 18.3) against a local aletheiad devnet — never production funds.
// Start the node first: ../aletheia-node/target/debug/aletheiad.exe --config tests/devnet/node.toml
import { defineConfig, devices } from "@playwright/test";

const DEVNET = process.env.DEVNET_RPC ?? "http://127.0.0.1:7791";
const GENESIS = process.env.DEVNET_GENESIS ?? "alt:B76EBE551bcC828dCA59257D11431114D213CB302c90044870A94BD269F261910";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5181",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome-desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 1000 } },
    },
    { name: "chrome-mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, grep: /@mobile/ },
  ],
  webServer: {
    command: "npx vite dev --host 127.0.0.1 --port 5181 --strictPort",
    url: "http://127.0.0.1:5181",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      KIT_OUT_DIR: ".svelte-kit-devnet",
      DEVNET_PROXY: DEVNET,
      PUBLIC_STABLECHAIN_RPC_URL: "http://127.0.0.1:5181/__devnet/rpc/v1",
      PUBLIC_STABLECHAIN_REST_URL: "http://127.0.0.1:5181/__devnet/api/v1",
      PUBLIC_STABLECHAIN_WS_URL: "ws://127.0.0.1:5181/__devnet/ws/v1",
      PUBLIC_STABLECHAIN_CHAIN_ID: "7771",
      PUBLIC_STABLECHAIN_NETWORK: "devnet",
      PUBLIC_STABLECHAIN_GENESIS_BLOCK: GENESIS,
    },
  },
});
