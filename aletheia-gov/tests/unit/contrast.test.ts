import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM build script without type declarations
import { contrast } from "../../scripts/color.mjs";
// @ts-expect-error plain ESM build script without type declarations
import { buildScales } from "../../scripts/tokens.mjs";

// Every token pair used for text (docs/design/contrast.md). WCAG AA: 4.5:1 body, 3:1 large.
const PAIRS: [fg: string, bg: string, min: number][] = [
  ["ink-900", "parchment-100", 4.5],
  ["ink-900", "parchment-50", 4.5],
  ["ink-700", "parchment-100", 4.5],
  ["ink-600", "parchment-100", 4.5],
  ["ink-500", "parchment-100", 4.5],
  ["ink-600", "parchment-50", 4.5],
  ["gold-700", "parchment-100", 4.5],
  ["gold-700", "parchment-50", 4.5],
  ["green-700", "parchment-100", 4.5],
  ["navy-800", "parchment-100", 4.5],
  ["navy-600", "parchment-100", 4.5],
  ["parchment-50", "navy-950", 4.5],
  ["parchment-100", "navy-950", 4.5],
  ["parchment-200", "navy-950", 4.5],
  ["parchment-300", "navy-950", 4.5],
  ["parchment-400", "navy-950", 4.5],
  ["parchment-300", "navy-900", 4.5],
  ["gold-300", "navy-950", 4.5],
  ["gold-400", "navy-950", 4.5],
  ["gold-500", "navy-950", 4.5],
  ["gold-400", "navy-900", 4.5],
  ["green-300", "navy-950", 4.5],
  ["navy-400", "navy-950", 3],
  ["parchment-50", "navy-800", 4.5],
  ["navy-800", "parchment-50", 4.5],
];

describe("text contrast", () => {
  const scales = buildScales() as Record<string, { hex: string }>;
  it.each(PAIRS)("%s on %s meets %s:1", (fg, bg, min) => {
    expect(contrast(scales[fg]!.hex, scales[bg]!.hex)).toBeGreaterThanOrEqual(min);
  });

  it("Seal Gold is never body text on parchment (fails AA)", () => {
    expect(contrast(scales["gold-500"]!.hex, scales["parchment-100"]!.hex)).toBeLessThan(4.5);
  });
});
