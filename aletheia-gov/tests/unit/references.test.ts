import { describe, expect, it } from "vitest";
import { formatReference, parseReference } from "@/lib/references";

describe("official references", () => {
  it("formats AGV-{TYPE}-{YEAR}-{SEQ} with a four-digit minimum sequence", () => {
    expect(formatReference("DOC", 2026, 12)).toBe("AGV-DOC-2026-0012");
    expect(formatReference("OPP", 2026, 3)).toBe("AGV-OPP-2026-0003");
    expect(formatReference("DEC", 2027, 12345)).toBe("AGV-DEC-2027-12345");
  });

  it("round-trips through parse", () => {
    expect(parseReference("AGV-APP-2026-0042")).toEqual({ type: "APP", year: 2026, seq: 42 });
  });

  it("rejects malformed input", () => {
    for (const bad of ["AGV-XYZ-2026-0001", "AGV-DOC-26-0001", "agv-doc-2026-0001", "AGV-DOC-2026-01", ""]) {
      expect(parseReference(bad)).toBeNull();
    }
    expect(() => formatReference("DOC", 2026, 0)).toThrow();
    expect(() => formatReference("DOC", 1999, 1)).toThrow();
  });
});
