import { execSync } from "node:child_process";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

function buildHash(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unversioned";
  }
}

/** Public configuration, fixed at build time. Nothing here is secret (wallet prompt 12.2). */
const config = {
  rpcUrl: process.env.PUBLIC_STABLECHAIN_RPC_URL ?? "https://rpc.stateofaletheia.org/rpc/v1",
  restUrl: process.env.PUBLIC_STABLECHAIN_REST_URL ?? "https://rpc.stateofaletheia.org/api/v1",
  wsUrl: process.env.PUBLIC_STABLECHAIN_WS_URL ?? "wss://rpc.stateofaletheia.org/ws/v1",
  chainId: Number(process.env.PUBLIC_STABLECHAIN_CHAIN_ID ?? "7770"),
  network: process.env.PUBLIC_STABLECHAIN_NETWORK ?? "mainnet",
  genesisBlock:
    process.env.PUBLIC_STABLECHAIN_GENESIS_BLOCK ??
    "alt:B7d6ec0526856a85C12a0B95edC508D378b8dfF222e7caC6cE8C7D026278a4819",
  explorerUrl: process.env.PUBLIC_EXPLORER_URL ?? "https://aletheiascan.mainnet.stateofaletheia.org",
  siteUrl: process.env.PUBLIC_SITE_URL ?? "https://wallet.mainnet.stateofaletheia.org",
  mainnetSigning: process.env.PUBLIC_MAINNET_SIGNING === "enabled",
  buildHash: buildHash(),
};

export default defineConfig({
  plugins: [sveltekit()],
  // The devnet dev server (KIT_OUT_DIR set) keeps its own dependency cache; sharing one with the
  // main dev server makes each re-optimise the other's copy of Svelte mid-session.
  cacheDir: process.env.KIT_OUT_DIR ? "node_modules/.vite-devnet" : "node_modules/.vite",
  define: { __WALLET_CONFIG__: JSON.stringify(config) },
  worker: { format: "es" },
  build: { target: "es2022", sourcemap: false },
  server: {
    port: 5180,
    strictPort: true,
    // Development and tests only: a local aletheiad sends no CORS headers (production nginx does),
    // so the dev server forwards /__devnet/* to it. Never part of a build.
    proxy: process.env.DEVNET_PROXY
      ? {
          "/__devnet": {
            target: process.env.DEVNET_PROXY,
            ws: true,
            rewrite: (path) => path.replace(/^\/__devnet/, ""),
          },
        }
      : {},
  },
  preview: { port: 4180, strictPort: true },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: [
        "src/lib/wallet/**",
        "src/lib/stablechain/**",
        "src/lib/formatting/**",
        "src/lib/validation/**",
        "src/lib/security/**",
      ],
      exclude: ["**/*.svelte", "**/worker/wallet.worker.ts", "**/worker/client.ts", "**/*.svelte.ts"],
      thresholds: { lines: 95, branches: 90, functions: 95, statements: 95 },
    },
  },
});
