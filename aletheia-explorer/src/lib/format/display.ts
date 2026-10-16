// Small display helpers shared by the pages. Amounts stay BigInt; nothing here rounds value.

import { splitAmount } from "./amount.ts";

const DECIMALS: Record<string, number> = { AEY: 18, ALnT: 3 };

/** "38,673.05" for AEY (cents), "1,500.000" for ALnT; the exact value goes to `title`. */
export function amountText(units: string, asset: string, locale = "en-GB"): { text: string; exact: string } {
  const parts = amountParts(units, asset, locale);
  return { text: parts.whole + parts.fraction, exact: parts.exact };
}

/** The same figure split for typesetting: whole units, then the fraction with its separator. */
export function amountParts(units: string, asset: string, locale = "en-GB"): { whole: string; fraction: string; exact: string } {
  const decimals = DECIMALS[asset] ?? 0;
  const display = asset === "AEY" ? 2 : decimals;
  const parts = splitAmount(units, decimals, display, locale);
  return { whole: parts.whole, fraction: parts.fraction === "" ? "" : parts.decimalSeparator + parts.fraction, exact: parts.exact };
}

/** Large figures as "8.00 M" for tiles; exact value elsewhere. */
export function compactUnits(units: string | null, asset: string, locale = "en-GB"): string {
  if (units === null) return "—";
  const decimals = BigInt(DECIMALS[asset] ?? 0);
  const whole = BigInt(units) / 10n ** decimals;
  const steps: [bigint, string][] = [
    [1_000_000_000_000n, "T"],
    [1_000_000_000n, "B"],
    [1_000_000n, "M"],
  ];
  for (const [size, suffix] of steps) {
    if (whole >= size) {
      const hundredths = (whole * 100n) / size;
      const value = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        Number(hundredths) / 100,
      );
      return `${value} ${suffix}`;
    }
  }
  return new Intl.NumberFormat(locale).format(whole);
}

export function grouped(n: number, locale = "en-GB"): string {
  return new Intl.NumberFormat(locale).format(n);
}

/** Protocol time in UTC with the zone written out (spec 41A.10). */
export function timeUtc(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} UTC`;
}

export function dateTimeUtc(ms: number): string {
  const d = new Date(ms);
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return `${date}, ${timeUtc(ms)}`;
}

/** First and last characters of an identifier for dense rows; the full value is the title. */
export function short(id: string, head = 10, tail = 6): string {
  return id.length <= head + tail + 1 ? id : `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** PolygonScan-style age: "7 secs ago", "3 mins ago", "2 hrs ago", "4 days ago". */
export function age(ms: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - ms) / 1000));
  const unit = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many} ago`;
  if (s < 60) return unit(s, "sec", "secs");
  const m = Math.floor(s / 60);
  if (m < 60) return unit(m, "min", "mins");
  const h = Math.floor(m / 60);
  if (h < 48) return unit(h, "hr", "hrs");
  return unit(Math.floor(h / 24), "day", "days");
}

/** "2026-01-01 00:13:00" in UTC, for the Date Time column. */
export function stamp(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

export function typeLabel(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}
