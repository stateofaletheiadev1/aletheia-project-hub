/**
 * Single source of truth for citizenship routes and their criteria.
 * Used by /citizenship, /citizenship/apply, the FAQ and the registry, so the
 * rules can never drift between pages. Grounded in Constitution Art. 8 and the
 * Nationality & Citizenship Act.
 */

/** Years of lawful, continuous physical residence required for naturalisation (Art. 8(1)). */
export const NATURALISATION_RESIDENCE_YEARS = 5;

export const MINIMUM_AGE = 18;

export interface InvestmentOption {
  id: 'contribution' | 'bonds';
  title: string;
  /** Amount in AEY (1 AEY = 1 EUR). */
  amount: number;
  /** Additional amount per included family member. */
  perDependant: number;
  refundable: boolean;
  holdYears?: number;
  desc: string;
}

/** The Covenant Investor route (Art. 8(2), as amended). */
export const INVESTMENT_OPTIONS: InvestmentOption[] = [
  {
    id: 'contribution',
    title: 'National Development Contribution',
    amount: 250_000,
    perDependant: 25_000,
    refundable: false,
    desc: 'A one-time contribution to the Covenant Development Fund, applied to the maritime build-out: the St. Brendan port, the Antioch civic core and the sovereign energy grid.',
  },
  {
    id: 'bonds',
    title: 'Covenant Development Bonds',
    amount: 500_000,
    perDependant: 50_000,
    refundable: true,
    holdYears: 5,
    desc: 'Subscription to sovereign infrastructure bonds held for at least five years. The principal is returned at maturity; the capital builds the Sovereign Covenant State in the meantime.',
  },
];

// Literal (not templated) so the i18n extractor can find them; keep in step with the constants above.
export const NATURALISATION_CRITERIA = [
  'Aged 18 or over',
  '5 years of lawful, continuous physical residence in Aletheia',
  'Civic proficiency in English and one further official language',
  'Completion of the Civic Integration Programme and Covenant knowledge test',
  'No serious criminal conviction in the past 10 years',
  'The public Covenant Oath',
];

export const INVESTOR_CRITERIA = [
  'Aged 18 or over',
  'Qualifying investment under one of the two options',
  'Enhanced due diligence: identity, source of funds, sanctions and anti-money-laundering screening',
  'No serious criminal conviction in the past 10 years',
  'Civic orientation course on the Covenant',
  'The public Covenant Oath',
];

export function formatAey(amount: number, intl = 'en-GB'): string {
  return `${amount.toLocaleString(intl)} AEY`;
}

/** Total qualifying investment for an applicant with a given number of dependants. */
export function investmentTotal(option: InvestmentOption, dependants: number): number {
  return option.amount + option.perDependant * Math.max(0, dependants);
}
