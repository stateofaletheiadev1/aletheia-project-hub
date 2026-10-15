// Node module hooks so operator scripts can run the application's TypeScript services directly
// (Node strips the types): resolves "@/…" to src/, adds the .ts extension to relative imports,
// and treats "server-only" as an empty module. Used through scripts/lib/register.mjs.
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = path.resolve(fileURLToPath(new URL("../../src", import.meta.url)));

function candidate(base) {
  for (const p of [`${base}.ts`, `${base}.tsx`, base, path.join(base, "index.ts")]) {
    if (existsSync(p) && statSync(p).isFile()) return pathToFileURL(p).href;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const url = candidate(path.join(src, specifier.slice(2)));
    if (url) return { url, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && !path.extname(specifier)) {
    const url = candidate(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (url) return { url, shortCircuit: true };
  }
  return next(specifier, context);
}
