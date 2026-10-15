import { describe, expect, it } from "vitest";
import { diffParagraphs, diffWords } from "@/lib/diff";

const join = (parts: { kind: string; text: string }[], keep: string[]) => parts.filter((p) => keep.includes(p.kind)).map((p) => p.text).join("");

describe("diffWords", () => {
  it("reconstructs both versions", () => {
    const before = "The Treasury shall publish a budget each year.";
    const after = "The Treasury shall publish an audited budget each financial year.";
    const parts = diffWords(before, after);
    expect(join(parts, ["same", "removed"])).toBe(before);
    expect(join(parts, ["same", "added"])).toBe(after);
    expect(parts.filter((p) => p.kind === "added").map((p) => p.text.trim())).toContain("financial");
  });

  it("identical texts are all the same", () => {
    expect(diffWords("a b c", "a b c")).toEqual([{ kind: "same", text: "a b c" }]);
  });

  it("handles empty sides", () => {
    expect(diffWords("", "new text")).toEqual([{ kind: "added", text: "new text" }]);
    expect(diffWords("old", "")).toEqual([{ kind: "removed", text: "old" }]);
  });
});

describe("diffParagraphs", () => {
  it("marks paragraphs changed, added and removed", () => {
    const rows = diffParagraphs(["One.", "Two.", "Three."], ["One.", "Two, amended.", "Three.", "Four."]);
    expect(rows.map((r) => r.kind)).toEqual(["same", "changed", "same", "added"]);
    expect(diffParagraphs(["A.", "B."], ["A."]).map((r) => r.kind)).toEqual(["same", "removed"]);
  });
});
