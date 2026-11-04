import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import svelteConfig from "./svelte.config.js";

export default ts.config(
  {
    ignores: [
      ".svelte-kit/",
      ".svelte-kit-devnet/",
      "build/",
      ".vercel/",
      "coverage/",
      "test-results/",
      "static/",
      "node_modules/",
      "docs/",
      "tests/.console.mjs",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "error",
      // The app is served at the domain root with no base path, so plain hrefs are exact.
      "svelte/no-navigation-without-resolve": "off",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: { projectService: true, extraFileExtensions: [".svelte"], parser: ts.parser, svelteConfig },
    },
  },
  // Trust boundary (wallet prompt 10.2): public pages never import wallet or key code.
  {
    files: [
      "src/routes/+page.svelte",
      "src/routes/(public)/**",
      "src/lib/layouts/PublicShell.svelte",
      "src/lib/layouts/SiteFooter.svelte",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["$lib/wallet/*", "$lib/wallet/**", "$lib/state/session*"],
              message: "Public pages must not load wallet code.",
            },
          ],
        },
      ],
    },
  },
  // No floating point for amounts (wallet prompt 21.7).
  {
    files: [
      "src/lib/formatting/amount.ts",
      "src/lib/stablechain/transactions/**",
      "src/lib/stablechain/uri/**",
      "src/lib/components/inputs/AmountField.svelte",
    ],
    rules: {
      "no-restricted-globals": ["error", { name: "parseFloat", message: "Amounts are bigint base units." }],
      "no-restricted-syntax": [
        "error",
        { selector: "CallExpression[callee.name='Number']", message: "Amounts are bigint base units; no Number()." },
        {
          selector: "CallExpression[callee.object.name='Number'][callee.property.name='parseFloat']",
          message: "No floats for amounts.",
        },
      ],
    },
  },
  // Logging goes through the redacting logger only.
  { files: ["src/lib/security/redact.ts", "scripts/**", "tests/**"], rules: { "no-console": "off" } },
);
