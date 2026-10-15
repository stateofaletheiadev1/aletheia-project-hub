import { DEFAULT_TIMEZONE, formatDate, formatDateTime, formatRelative, formatTime } from "@/lib/time";
import { cx } from "@/lib/cx";

// A point in time (brief §12.2): relative or short in the text, the absolute time with its
// zone on hover ("15 Oct 2026, 15:59 WAT"), machine-readable in `datetime`.

export function Timestamp({
  at,
  now,
  mode = "relative",
  timeZone = DEFAULT_TIMEZONE,
  className,
}: {
  at: Date | string;
  now?: Date;
  mode?: "relative" | "date" | "time" | "datetime";
  timeZone?: string;
  className?: string;
}) {
  const d = typeof at === "string" ? new Date(at) : at;
  const text =
    mode === "date" ? formatDate(d, timeZone) : mode === "time" ? formatTime(d, timeZone) : mode === "datetime" ? formatDateTime(d, timeZone) : formatRelative(d, now ?? new Date(), timeZone);
  return (
    <time dateTime={d.toISOString()} title={formatDateTime(d, timeZone)} className={cx("tnum whitespace-nowrap", className)}>
      {text}
    </time>
  );
}
