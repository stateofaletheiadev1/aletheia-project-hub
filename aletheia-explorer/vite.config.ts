import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  // The SDK's imports resolve to this app's copy.
  resolve: { dedupe: ["@noble/hashes"] },
  server: { port: 5173, strictPort: true },
});
