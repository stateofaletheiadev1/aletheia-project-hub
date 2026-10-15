import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Dependency direction (ADR 0001): routes and components never reach adapters; the domain,
// workflow and policy layers are pure and import nothing from the outer layers.
const outer = ["@/app/*", "@/components/*", "@/services/*", "@/adapters/*", "@/server/*", "next", "next/*", "react", "react-dom"];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/adapters/*"], message: "Go through services/ (ADR 0001)." }] },
      ],
    },
  },
  {
    files: ["src/domain/**/*.ts", "src/workflow/**/*.ts", "src/policy/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: outer, message: "domain, workflow and policy are pure (ADR 0001)." }] },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "react/no-danger": "error" },
  },
  globalIgnores([".next/**", "out/**", "node_modules/**", "next-env.d.ts", "docs/design/screenshots/**"]),
]);
