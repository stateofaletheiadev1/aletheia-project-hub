import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { color, toCss } from "@/design/tokens";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("design tokens", () => {
  it("tokens.css is generated from tokens.ts (run `npm run tokens`)", () => {
    const css = readFileSync(path.resolve(__dirname, "../../src/design/tokens.css"), "utf8").replace(/\r\n/g, "\n");
    expect(css).toBe(toCss());
  });

  // WCAG 2.2 AA: 4.5:1 for text, 3:1 for UI boundaries and large text (brief §10.4).
  const surfaces = [color.canvas, color.sheet, color.sunken] as const;
  const text: (keyof typeof color)[] = [
    "ink",
    "ink-2",
    "ink-3",
    "authority",
    "seal-ink",
    "status-draft",
    "status-review",
    "status-returned",
    "status-approved",
    "status-danger",
    "status-muted",
    "class-public",
    "class-internal",
    "class-restricted",
    "class-confidential",
  ];
  it.each(text)("%s text reaches 4.5:1 on every light surface", (role) => {
    for (const s of surfaces) expect(contrast(color[role], s)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["status-draft", "status-draft-tint"],
    ["status-review", "status-review-tint"],
    ["status-returned", "status-returned-tint"],
    ["status-approved", "status-approved-tint"],
    ["status-danger", "status-danger-tint"],
    ["class-confidential", "class-confidential-tint"],
  ] as const)("%s text reaches 4.5:1 on its tag tint", (fg, bg) => {
    expect(contrast(color[fg], color[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("control borders and the focus ring reach 3:1", () => {
    for (const s of surfaces) {
      expect(contrast(color["rule-control"], s)).toBeGreaterThanOrEqual(3);
      expect(contrast(color.focus, s)).toBeGreaterThanOrEqual(3);
    }
  });

  it("text on the masthead reaches 4.5:1", () => {
    for (const fg of [color["ink-inverse"], color["ink-inverse-2"], color["seal-on-navy"]]) {
      expect(contrast(fg, color.masthead)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("raw seal gold is never a text colour on light surfaces (it fails 4.5:1)", () => {
    expect(contrast(color.seal, color.sheet)).toBeLessThan(4.5);
  });
});
