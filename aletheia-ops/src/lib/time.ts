// Dates and times (brief §15): stored in UTC, shown in the official's timezone.
// "15 October 2026" in prose, "15 Oct 2026" in tables, 24-hour time with a zone: "15:59 WAT".

/** The government's reference timezone, used until an official chooses their own. */
export const DEFAULT_TIMEZONE = "Africa/Lagos";

// Intl prints most African zones as "GMT+1" in en-GB; officials know them by these names.
const ABBREVIATION: Record<string, string> = {
  "Africa/Lagos": "WAT",
  "Africa/Kinshasa": "WAT",
  "Africa/Luanda": "WAT",
  "Africa/Douala": "WAT",
  "Africa/Accra": "GMT",
  "Africa/Abidjan": "GMT",
  "Africa/Dakar": "GMT",
  "Africa/Nairobi": "EAT",
  "Africa/Addis_Ababa": "EAT",
  "Africa/Kampala": "EAT",
  "Africa/Johannesburg": "SAST",
  "Africa/Harare": "CAT",
  "Africa/Lusaka": "CAT",
};

function parts(at: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).format(at);
}

export function zoneName(at: Date, timeZone: string): string {
  const fixed = ABBREVIATION[timeZone];
  if (fixed) return fixed;
  const p = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" }).formatToParts(at);
  return p.find((x) => x.type === "timeZoneName")?.value ?? timeZone;
}

/** 15 Oct 2026 */
export function formatDate(at: Date, timeZone = DEFAULT_TIMEZONE): string {
  return parts(at, timeZone, { day: "numeric", month: "short", year: "numeric" });
}

/** 15 October 2026 */
export function formatDateLong(at: Date, timeZone = DEFAULT_TIMEZONE): string {
  return parts(at, timeZone, { day: "numeric", month: "long", year: "numeric" });
}

/** 15:59 WAT */
export function formatTime(at: Date, timeZone = DEFAULT_TIMEZONE): string {
  return `${parts(at, timeZone, { hour: "2-digit", minute: "2-digit", hour12: false })} ${zoneName(at, timeZone)}`;
}

/** 15 Oct 2026, 15:59 WAT */
export function formatDateTime(at: Date, timeZone = DEFAULT_TIMEZONE): string {
  return `${formatDate(at, timeZone)}, ${formatTime(at, timeZone)}`;
}

/** Thursday 15 October 2026: the briefing's edition line. */
export function formatEdition(at: Date, timeZone = DEFAULT_TIMEZONE): string {
  return `${parts(at, timeZone, { weekday: "long" })} ${formatDateLong(at, timeZone)}`;
}

/**
 * Short relative time for registers: "just now", "12 min ago", "3 h ago", "yesterday",
 * "4 days ago"; beyond a week, the date itself. The absolute time is always available on hover.
 */
export function formatRelative(at: Date, now: Date, timeZone = DEFAULT_TIMEZONE): string {
  const seconds = Math.round((now.getTime() - at.getTime()) / 1000);
  if (seconds < 0) return formatDate(at, timeZone);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const day = (d: Date) => parts(d, timeZone, { year: "numeric", month: "2-digit", day: "2-digit" });
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (day(at) === day(yesterday)) return "yesterday";
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days ago`;
  return formatDate(at, timeZone);
}

/** "Due in 3 days", "Due today", "2 days overdue". */
export function formatDue(due: Date, now: Date): { text: string; overdue: boolean } {
  const days = Math.floor((due.getTime() - now.getTime()) / 86_400_000);
  if (due.getTime() < now.getTime()) {
    const late = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / 86_400_000));
    return { text: late === 1 ? "1 day overdue" : `${late} days overdue`, overdue: true };
  }
  if (days === 0) return { text: "Due today", overdue: false };
  return { text: days === 1 ? "Due tomorrow" : `Due in ${days} days`, overdue: false };
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
