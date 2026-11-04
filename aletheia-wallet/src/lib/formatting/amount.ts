// Exact amounts (wallet prompt 12.8; `crates/wallet/src/uri.rs` parse_amount/format_amount).
// bigint base units end to end; decimal strings only at the edge. No floats, no rounding:
// the "significant" view only drops trailing zeros, which loses nothing.

import type { BaseUnits, DecimalString } from "$lib/types/brand";

export class AmountError extends Error {
  override name = "AmountError";
}

const U128_MAX = (1n << 128n) - 1n;

/** `"125.5"` with 18 decimals → base units, exactly, or an error. Accepts `.` or `,` as the separator. */
export function parseAmount(text: string, decimals: number): BaseUnits {
  const trimmed = text.trim().replace(",", ".");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) throw new AmountError(`"${text}" is not an amount`);
  const whole = match[1]!;
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) {
    throw new AmountError(decimals === 0 ? "this asset has no fractional units" : `at most ${decimals} decimal places`);
  }
  const value = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (value > U128_MAX) throw new AmountError("the amount is larger than the chain can represent");
  return value as BaseUnits;
}

/** Base units → `"125.500000000000000000"` (every decimal written), as the node's `display` field. */
export function formatAmount(units: bigint, decimals: number): DecimalString {
  if (units < 0n) throw new AmountError("amounts are never negative");
  if (decimals === 0) return units.toString() as DecimalString;
  const scale = 10n ** BigInt(decimals);
  return `${units / scale}.${(units % scale).toString().padStart(decimals, "0")}` as DecimalString;
}

/** The shortest exact input form: `"1000.250"` → `"1000.25"`, `"7.000"` → `"7"`, `"1000"` stays. */
export function trimAmount(text: string): string {
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}

/** Parses a node decimal string (`available`, `amount`) into base units. */
export function parseBaseUnits(text: string): BaseUnits {
  if (!/^\d+$/.test(text)) throw new AmountError(`"${text}" is not a whole number of base units`);
  const value = BigInt(text);
  if (value > U128_MAX) throw new AmountError("value exceeds u128");
  return value as BaseUnits;
}

export type Precision = "significant" | "full";

export interface AmountParts {
  /** Grouped for the locale, e.g. `1,284,551`. */
  readonly integer: string;
  /** The locale's decimal separator, or empty when there is no fraction to show. */
  readonly separator: string;
  readonly fraction: string;
  /** The exact value with every decimal, for copying and for screen readers. */
  readonly exact: DecimalString;
}

function localeSeparators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(10000.5);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };
}

function groupInteger(digits: string, group: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

/**
 * Display parts for the denomination style. `significant` keeps at least `minFraction` digits
 * and drops only trailing zeros beyond them; `full` writes every decimal.
 */
export function amountParts(
  units: bigint,
  decimals: number,
  {
    locale = "en",
    precision = "significant",
    minFraction = 2,
  }: { locale?: string; precision?: Precision; minFraction?: number } = {},
): AmountParts {
  const exact = formatAmount(units, decimals);
  const [whole = "0", fullFraction = ""] = exact.split(".");
  const { group, decimal } = localeSeparators(locale);
  let fraction = fullFraction;
  if (precision === "significant") {
    const keep = Math.min(minFraction, decimals);
    fraction = fullFraction.replace(/0+$/, "");
    if (fraction.length < keep) fraction = fullFraction.slice(0, keep);
  }
  return { integer: groupInteger(whole, group), separator: fraction ? decimal : "", fraction, exact };
}

/** One-line locale form, e.g. `1,000.25 ALnT`. */
export function formatDisplay(units: bigint, decimals: number, code: string, locale = "en"): string {
  const parts = amountParts(units, decimals, { locale });
  return `${parts.integer}${parts.separator}${parts.fraction} ${code}`;
}

/** Thousands-grouped whole number (block heights, nonces) without floats. */
export function groupWhole(value: bigint | number, locale = "en"): string {
  return groupInteger(BigInt(value).toString(), localeSeparators(locale).group);
}
