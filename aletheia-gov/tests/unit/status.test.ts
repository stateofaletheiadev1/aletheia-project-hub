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

  // Brief §1.1–1.2: no institution claims to function as one of a place.
  it("claims no institution is operational or established", () => {
    for (const item of institutions) {
      expect(["operational", "established"]).not.toContain(item.status);
    }
  });

  // §5.2, §10.5: a programme is operational only with public evidence and verified milestones.
  it("backs every operational programme with evidence and milestones", () => {
    for (const p of programmes) {
      expect(p.status).not.toBe("established");
      if (p.status !== "operational") continue;
      expect(() => assertStatusEvidence(p.status, p.evidence)).not.toThrow();
      expect(p.evidence).toMatch(/^https:\/\//);
      expect(p.milestones?.length, p.slug).toBeGreaterThan(0);
    }
  });

  it("dates every milestone and links its evidence", () => {
    for (const m of programmes.flatMap((p) => p.milestones ?? [])) {
      expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Date.parse(m.date)).toBeLessThanOrEqual(Date.now());
      expect(m.evidence.href).toMatch(/^https:\/\//);
    }
  });

  it("uses unique slugs", () => {
    const slugs = institutions.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
