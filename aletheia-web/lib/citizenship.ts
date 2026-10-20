/**
 * Single source of truth for citizenship criteria: by birth or naturalisation only, never for payment.
 * Used by /citizenship, /citizenship/apply, the FAQ and the registry, so the
 * rules can never drift between pages. Grounded in Constitution Art. 8 and the
 * Nationality & Citizenship Act.
 */

/** Years of lawful, continuous physical residence required for naturalisation (Art. 8(1)). */
export const NATURALISATION_RESIDENCE_YEARS = 5;

export const MINIMUM_AGE = 18;

// Literal (not templated) so the i18n extractor can find them; keep in step with the constants above.
export const NATURALISATION_CRITERIA = [
  'Aged 18 or over',
  '5 years of lawful, continuous physical residence in Aletheia',
  'Civic proficiency in English and one further official language',
  'Completion of the Civic Integration Programme and Covenant knowledge test',
  'No serious criminal conviction in the past 10 years',
  'The public Covenant Oath',
];

export function formatAey(amount: number, intl = 'en-GB'): string {
  return `${amount.toLocaleString(intl)} AEY`;
}
