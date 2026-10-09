import { describe, expect, it } from "vitest";
import { institutions } from "@/content/institutions";
import { programmes } from "@/content/programmes";
import { INSTITUTIONAL_STATUSES, STATUS_META, assertStatusEvidence } from "@/lib/status";

describe("status taxonomy", () => {
  it("has a label and meaning for every status", () => {
    for (const s of INSTITUTIONAL_STATUSES) {
      expect(STATUS_META[s].label).toBeTruthy();
      expect(STATUS_META[s].meaning).toBeTruthy();
    }
  });

  it("refuses operational without evidence", () => {
    expect(() => assertStatusEvidence("operational")).toThrow();
    expect(() => assertStatusEvidence("operational", "AGV-DEC-2026-0001")).not.toThrow();
    expect(() => assertStatusEvidence("proposed")).not.toThrow();
  });

  // Brief §1.1–1.2: nothing in the structural content may claim to be functioning.
  it("claims no institution or programme is operational or established", () => {
    for (const item of [...institutions, ...programmes]) {
      expect(["operational", "established"]).not.toContain(item.status);
    }
  });

  it("uses unique slugs", () => {
    const slugs = institutions.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
