import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Brief §8.2: routes and components never reach persistence directly.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/server/repositories/*", "@/server/aletheiadb/*"], message: "Go through server/services or server/records." },
          ],
        },
      ],
    },
  },
  {
    // Brief §14: no raw HTML injection outside sanitizer output.
    files: ["src/**/*.{ts,tsx}"],
    rules: { "react/no-danger": "error" },
  },
  globalIgnores([".next/**", "out/**", ".cache/**", "node_modules/**", "next-env.d.ts", "docs/design/review/**"]),
]);
