import { describe, expect, it } from "vitest";
import { publicationHash } from "@/lib/content-hash";

// Shared vector: aletheia-gov/tests/unit/publication.test.ts asserts the same hash for the same
// input. If either implementation changes, both tests fail.
export const VECTOR = {
  register: "dispatches",
  reference: "AGV-DSP-2026-0001",
  title: "Notice of the first public session of the Treasury",
  summary: "When and where the Treasury will hold its first public session.",
  body: [
    { type: "paragraph", text: "The Treasury will hold its first public session on 1 November 2026 in Antioch." },
    { type: "heading", text: "Agenda" },
    { type: "list", items: ["Founding budget", "Questions from the public"] },
  ],
  facts: [{ label: "Date", value: "1 November 2026" }],
  version: 2,
};

describe("publication content hash", () => {
  it("matches the shared vector", () => {
    expect(publicationHash(VECTOR)).toBe("efc3303cf11a1f442820dd3f969be6d2d7d823307890ed4eb2536f95983ddfed");
  });
});
