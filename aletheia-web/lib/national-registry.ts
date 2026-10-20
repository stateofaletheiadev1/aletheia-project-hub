/**
 * Number formatting shared by the public pages (CountUp).
 *
 * The founding register itself holds no citizens, e-residents or companies: Aletheia
 * accepts no applications in its founding phase and raises no funds through this site.
 */

// Million / billion words per official language. Kept here rather than taken from
// Intl's compact notation, whose wording differs between Node and browsers (4.2B vs
// 4.2bn) and so broke hydration.
const NBSP = ' ';
const SCALE_WORDS: Record<string, [million: string, billion: string]> = {
  en: ['m', 'bn'],
  de: [`${NBSP}Mio.`, `${NBSP}Mrd.`],
  nl: [`${NBSP}mln.`, `${NBSP}mld.`],
  sr: [`${NBSP}мил.`, `${NBSP}млрд.`],
  it: [`${NBSP}Mln`, `${NBSP}Mrd`],
};

/** Compact number in the reader's locale: 2.45bn, 2,45 Mrd., 612m. Identical on server and client. */
export function compactNumber(n: number, intl = 'en-GB'): string {
  if (n < 1e6) return Math.round(n).toLocaleString(intl);
  const [million, billion] = SCALE_WORDS[intl.split('-')[0]] ?? SCALE_WORDS.en;
  const big = n >= 1e9;
  const scaled = (n / (big ? 1e9 : 1e6)).toLocaleString(intl, { maximumFractionDigits: big ? 2 : 1 });
  return `${scaled}${big ? billion : million}`;
}
