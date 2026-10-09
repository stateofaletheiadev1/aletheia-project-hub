import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { search } = await import("@/server/search");

describe("search", () => {
  it("ranks a title match first", () => {
    expect(search("monetary authority")[0]?.title).toBe("Aletheia Monetary Authority");
  });

  it("requires every term to match", () => {
    expect(search("monetary zzzzqq")).toEqual([]);
  });

  it("ignores empty and one-letter queries", () => {
    expect(search("")).toEqual([]);
    expect(search("a")).toEqual([]);
  });

  it("is accent- and case-insensitive", () => {
    expect(search("STABLECHAIN").length).toBeGreaterThan(0);
  });
});
