// Writes src/design/tokens.css from src/design/tokens.ts. Run after changing a token:
//   node scripts/build-tokens.ts
import { writeFileSync } from "node:fs";
import { toCss } from "../src/design/tokens.ts";

const out = new URL("../src/design/tokens.css", import.meta.url);
writeFileSync(out, toCss());
console.log(`wrote ${out.pathname}`);
