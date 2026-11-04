import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** Origins the browser may talk to besides this one: the node's RPC and REST (ADR-0003). */
function rpcOrigins() {
  const urls = [
    process.env.PUBLIC_STABLECHAIN_RPC_URL ?? "https://rpc.stateofaletheia.org/rpc/v1",
    process.env.PUBLIC_STABLECHAIN_REST_URL ?? "https://rpc.stateofaletheia.org/api/v1",
    process.env.PUBLIC_STABLECHAIN_WS_URL ?? "wss://rpc.stateofaletheia.org/ws/v1",
  ];
  return [...new Set(urls.filter(Boolean).map((url) => new URL(url).origin))];
}

const dev = process.env.NODE_ENV === "development";
// adapter-vercel links shared functions with symlinks, which Windows refuses without Developer
// Mode. Vercel builds on Linux; a local Windows build stops after SvelteKit's own output, which is
// what the budget and bundle checks read.
const localWindows = process.platform === "win32" && !process.env.VERCEL;

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  compilerOptions: { runes: true },
  kit: {
    ...(localWindows ? {} : { adapter: adapter({ runtime: "nodejs22.x" }) }),
    // The theme bootstrap in app.html is hashed by Kit; everything else is a file from 'self'.
    csp: {
      mode: "auto",
      directives: {
        "default-src": ["self"],
        "script-src": ["self", "wasm-unsafe-eval"],
        "style-src": ["self"],
        // Svelte builds DOM from template strings, so static style attributes need this (ADR-0005).
        "style-src-attr": ["unsafe-inline"],
        "font-src": ["self"],
        "img-src": ["self", "data:"],
        "connect-src": dev ? ["self", "ws:", ...rpcOrigins(), "http://127.0.0.1:7781"] : ["self", ...rpcOrigins()],
        "worker-src": ["self"],
        "frame-ancestors": ["none"],
        "base-uri": ["none"],
        "form-action": ["self"],
        "object-src": ["none"],
        "manifest-src": ["self"],
        "upgrade-insecure-requests": !dev,
      },
    },
    prerender: { handleHttpError: "fail" },
    // A second dev server (the devnet one used by tests) must not share generated files with the
    // main one: the CSP and config Kit writes there differ per network.
    outDir: process.env.KIT_OUT_DIR ?? ".svelte-kit",
    version: { pollInterval: 0 },
  },
};
