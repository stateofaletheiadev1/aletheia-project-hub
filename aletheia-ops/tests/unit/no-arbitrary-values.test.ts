import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Brief §36: Tailwind is driven entirely by the token layer, with no arbitrary values in
// components. `foo-[...]` and `[prop:value]` are refused; `foo-(--token)` references a token.
const roots = ["src/components", "src/app"].map((r) => path.resolve(__dirname, "../..", r));
const ARBITRARY = /(?:^|[\s"'`])(?:[a-z0-9:-]+:)?-?[a-z][a-z0-9-]*-\[[^\]]+\]|(?:^|[\s"'`])\[[a-z-]+:[^\]]+\]/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("no arbitrary Tailwind values", () => {
  it.each(roots.flatMap(files).map((f) => [path.relative(process.cwd(), f), f]))("%s", (_name, file) => {
    const offending = readFileSync(file, "utf8")
      .split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /className|cx\(|class=/.test(line) && ARBITRARY.test(line));
    expect(offending).toEqual([]);
  });
});
