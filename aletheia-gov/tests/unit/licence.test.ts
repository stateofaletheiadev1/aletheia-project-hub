import { describe, expect, it } from "vitest";
import { licenceFingerprint } from "@/lib/licence";

describe("validator licence fingerprint", () => {
  it("matches aletheia-cli validator licence-hash, whatever the case or spacing", () => {
    // aletheia-cli validator licence-hash AGV-EOI-2026-0001
    const cli = "4edd935090a7816ed27aca0f1ae312cd212da004f09fa8bdea9aba8665dd7d34";
    expect(licenceFingerprint("AGV-EOI-2026-0001")).toBe(cli);
    expect(licenceFingerprint(" agv-eoi-2026-0001 ")).toBe(cli);
    expect(licenceFingerprint("AGV-EOI-2026-0002")).not.toBe(cli);
  });
});
