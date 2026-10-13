import { describe, expect, it, vi } from "vitest";
import { POSITION_SLUGS, POSITION_TYPES, positionName } from "@/content/positions";
import { institutions } from "@/content/institutions";
import { INTEREST_INSTITUTIONS, InterestInput } from "@/features/interest/schema";

vi.mock("server-only", () => ({}));
vi.mock("@/server/aletheiadb/client", () => ({ database: () => null }));
const { positionTypesOf } = await import("@/server/services/interest");

const base = { fullName: "Ada Okafor", email: "ADA@example.org", institutions: ["any"], expertise: "Law and governance", note: "", consent: "on" };

describe("kinds of position", () => {
  it("covers founding roles and the other kinds", () => {
    expect(POSITION_SLUGS).toEqual(["founding", "permanent", "fixed-term", "advisory", "volunteer"]);
    expect(new Set(POSITION_TYPES.map((p) => p.name)).size).toBe(POSITION_TYPES.length);
    expect(positionName("permanent")).toBe("Permanent positions");
    expect(positionName("unknown")).toBe("unknown");
  });

  it("registration needs at least one kind, from the list, without duplicates", () => {
    expect(InterestInput.safeParse({ ...base, positionTypes: [] }).success).toBe(false);
    expect(InterestInput.safeParse({ ...base, positionTypes: ["astronaut"] }).success).toBe(false);
    const ok = InterestInput.safeParse({ ...base, positionTypes: ["permanent", "volunteer", "permanent"] });
    expect(ok.success && ok.data.positionTypes).toEqual(["permanent", "volunteer"]);
  });

  it("is not limited to founding roles", () => {
    const ok = InterestInput.safeParse({ ...base, positionTypes: ["advisory"] });
    expect(ok.success).toBe(true);
  });

  it("offers every institution that is not suspended or archived, including operational ones", () => {
    const expected = institutions.filter((i) => i.status !== "suspended" && i.status !== "archived").map((i) => i.slug);
    expect(INTEREST_INSTITUTIONS.map((i) => i.slug)).toEqual(expected);
  });

  it("reads registrations made before kinds of position existed as founding", () => {
    expect(positionTypesOf({})).toEqual(["founding"]);
    expect(positionTypesOf({ positionTypes: [] })).toEqual(["founding"]);
    expect(positionTypesOf({ positionTypes: ["permanent"] })).toEqual(["permanent"]);
  });
});
