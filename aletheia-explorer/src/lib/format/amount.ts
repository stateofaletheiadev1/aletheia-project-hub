// Exact, calm amounts (spec 41A.7). Base units arrive as decimal strings (Section 37.1).
// BigInt only: a Number cannot hold 10^18-scaled values and would round silently.
//
// The display shows the "precision tail": the cent part in full ink, the remaining
// sub-cent digits faint and grouped in fours, trailing zeros of the tail dropped. The exact
// value always goes to the copy buffer and the tooltip.

export interface AmountParts {
  readonly whole: string; // locale-grouped
  readonly fraction: string; // the displayed decimals, e.g. "00"; "" for a 0-decimal asset
  readonly tail: string; // significant sub-display digits, grouped in fours, or ""
  readonly decimalSeparator: string;
  readonly exact: string; // canonical decimal string for copy and title
  readonly negative: boolean;
}

/** Display decimals per asset: AEY shows euro cents, ALnT its full Mite precision. */
export const ASSETS = {
  AEY: { decimals: 18, displayDecimals: 2 },
  ALnT: { decimals: 3, displayDecimals: 3 },
} as const;

const THIN_SPACE = " ";
const MINUS = "−";

export function splitAmount(baseUnits: string, decimals: number, displayDecimals: number, locale: string): AmountParts {
  if (!/^-?\d+$/.test(baseUnits)) {
    throw new TypeError(`amount must be a decimal string of base units; got "${baseUnits}"`);
  }
  if (!Number.isInteger(decimals) || decimals < 0 || displayDecimals < 0 || displayDecimals > decimals) {
    throw new RangeError(`display decimals ${displayDecimals} must lie within 0..${decimals}`);
  }
  const units = BigInt(baseUnits.replace(/^-/, ""));
  const negative = baseUnits.startsWith("-") && units !== 0n;
  const scale = 10n ** BigInt(decimals);
  const wholeUnits = units / scale;
  // Spec 41A.7 pads `units % scale` to `decimals`; for a 0-decimal asset that yields "0"
  // instead of "" and an exact value ending in "." (ERRATA E-14).
  const fractionDigits = decimals === 0 ? "" : (units % scale).toString().padStart(decimals, "0");

  const grouping = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 });
  const decimalSeparator =
    new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === "decimal")?.value ?? ".";

  const tailDigits = fractionDigits.slice(displayDecimals).replace(/0+$/, "");
  return {
    whole: grouping.format(wholeUnits),
    fraction: fractionDigits.slice(0, displayDecimals),
    tail: tailDigits.replace(/(\d{4})(?=\d)/g, `$1${THIN_SPACE}`),
    decimalSeparator,
    exact: `${negative ? "-" : ""}${wholeUnits}${decimals === 0 ? "" : `.${fractionDigits}`}`,
    negative,
  };
}

/** One-line text form: true minus sign, tail after a thin space, code after the amount. */
export function formatAmount(baseUnits: string, asset: keyof typeof ASSETS, locale: string): string {
  const { decimals, displayDecimals } = ASSETS[asset];
  const parts = splitAmount(baseUnits, decimals, displayDecimals, locale);
  const fraction = parts.fraction === "" ? "" : `${parts.decimalSeparator}${parts.fraction}`;
  const tail = parts.tail === "" ? "" : `${THIN_SPACE}${parts.tail}`;
  return `${parts.negative ? MINUS : ""}${parts.whole}${fraction}${tail} ${asset}`;
}
