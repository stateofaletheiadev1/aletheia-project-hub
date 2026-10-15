import { describe, expect, it } from "vitest";
import { formatDate, formatDateLong, formatDateTime, formatDue, formatEdition, formatRelative, formatTime, isValidTimezone } from "@/lib/time";

const at = new Date("2026-10-15T14:59:00Z");

describe("time formatting", () => {
  it("uses the house formats", () => {
    expect(formatDate(at)).toBe("15 Oct 2026");
    expect(formatDateLong(at)).toBe("15 October 2026");
    expect(formatTime(at)).toBe("15:59 WAT");
    expect(formatDateTime(at)).toBe("15 Oct 2026, 15:59 WAT");
    expect(formatEdition(at)).toBe("Thursday 15 October 2026");
  });

  it("shows the official's own timezone", () => {
    expect(formatTime(at, "Europe/London")).toBe("15:59 BST");
    expect(formatTime(at, "Europe/Berlin")).toBe("16:59 CEST");
    expect(formatTime(at, "Africa/Nairobi")).toBe("17:59 EAT");
    expect(formatTime(at, "UTC")).toBe("14:59 UTC");
  });

  it("dates follow the timezone across midnight", () => {
    const late = new Date("2026-10-15T23:30:00Z");
    expect(formatDate(late, "UTC")).toBe("15 Oct 2026");
    expect(formatDate(late, "Africa/Lagos")).toBe("16 Oct 2026");
  });

  it("relative times", () => {
    const now = new Date("2026-10-15T15:00:00Z");
    expect(formatRelative(new Date("2026-10-15T14:59:40Z"), now)).toBe("just now");
    expect(formatRelative(new Date("2026-10-15T14:48:00Z"), now)).toBe("12 min ago");
    expect(formatRelative(new Date("2026-10-15T11:00:00Z"), now)).toBe("4 h ago");
    expect(formatRelative(new Date("2026-10-14T09:00:00Z"), now)).toBe("yesterday");
    expect(formatRelative(new Date("2026-10-11T09:00:00Z"), now)).toBe("4 days ago");
    expect(formatRelative(new Date("2026-09-01T09:00:00Z"), now)).toBe("1 Sept 2026");
  });

  it("due dates", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(formatDue(new Date("2026-10-18T13:00:00Z"), now)).toEqual({ text: "Due in 3 days", overdue: false });
    expect(formatDue(new Date("2026-10-15T18:00:00Z"), now)).toEqual({ text: "Due today", overdue: false });
    expect(formatDue(new Date("2026-10-13T12:00:00Z"), now)).toEqual({ text: "2 days overdue", overdue: true });
  });

  it("validates timezones", () => {
    expect(isValidTimezone("Africa/Lagos")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
  });
});
