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

describe("publication content hash for a job post", () => {
  // Shared with the other repository's tests: kind of position and closing date are hashed.
  it("matches the shared opportunity vector", () => {
    const V = {
      register: "opportunities",
      reference: "AGV-OPP-2026-0001",
      title: "Founding coordinator, seasteading working group",
      summary: "",
      body: [{ type: "paragraph", text: "Coordinate the working group." }],
      facts: [],
      version: 1,
      positionType: "volunteer",
      closingDate: "2026-11-30",
    };
    expect(publicationHash(V)).toBe("c7e4b88305cbd9f15a341616a3755c6249393d1fe3e0db74c33dfbc4c937130e");
    expect(publicationHash({ ...V, closingDate: "2026-12-01" })).not.toBe("c7e4b88305cbd9f15a341616a3755c6249393d1fe3e0db74c33dfbc4c937130e");
  });
});
