import type { OfficialPdfSpec } from '@/lib/pdf/builder';
import { CONSTITUTION_DATA } from '@/lib/constitution-data';
import { STATUTE_DATABASE, type StatuteDetail } from '@/lib/statutes';
import { GAZETTE_POSTS, type GazettePost } from '@/lib/gazette';
import { REGISTER, type RegisterDocument } from '@/lib/documents';
import { BOND_TRANCHES, type BondTranche } from '@/lib/bonds';

/**
 * Turns canonical records into PDF specs. Each public PDF URL maps to exactly
 * one function here, fed by the same data module as the matching web page.
 */

type Spec = Omit<OfficialPdfSpec, 'arms'>;

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function constitutionSpec(): Spec {
  return {
    code: 'CONST-2026-01',
    kind: 'The Supreme Law of the Sovereign Covenant State',
    title: 'The Covenant of Aletheia',
    meta: [
      ['Promulgated', longDate('2026-01-15')],
      ['Edition', '2026.3 — authoritative working text'],
      ['Articles', `${CONSTITUTION_DATA.length} published provisions`],
    ],
    lead: 'We, the founding members of the Sovereign Covenant State of Aletheia, ordain this Covenant so that the public power of the Sovereign Covenant State shall be lawful, limited, and provable — Veritas in Foedere.',
    sections: CONSTITUTION_DATA.map((a) => ({
      number: `Article ${a.number}`,
      heading: `${a.title}  (${a.part})`,
      paragraphs: a.clauses.map((c) => `${c.number}  ${c.text}`),
    })),
    attestation: ['Promulgated by the Constituent Assembly', 'Inscribed on the public ledger and published in the Official Gazette'],
    hash: '0x8f2b7a4c91e3d085fa49b817e4521098ef7321ac90b34d76a218fce1b2049e91',
    subject: 'Constitution',
  };
}

export function statuteSpec(s: StatuteDetail): Spec {
  return {
    code: s.code,
    kind: 'Act of the Covenant Assembly',
    title: s.title,
    meta: [
      ['Enacted', longDate(s.date)],
      ['Constitutional basis', s.article],
      ['Ledger hash', s.hash],
    ],
    lead: s.preamble,
    sections: s.sections.map((sec) => ({ number: sec.number, heading: sec.heading, paragraphs: [sec.text] })),
    attestation: [s.signatory, `Covenant Assembly Gazette Publication No. ${s.code}`],
    hash: s.hash,
    subject: 'Statute',
  };
}

export function gazetteSpec(p: GazettePost): Spec {
  return {
    code: p.number,
    kind: `Official Gazette — ${p.category}`,
    title: p.title,
    meta: [
      ['Published', longDate(p.date)],
      ['Promulgating authority', p.signatory],
    ],
    lead: p.summary,
    sections: [{ paragraphs: p.body }],
    attestation: [p.signatory, `Official Gazette No. ${p.number}`],
    subject: 'Gazette bulletin',
  };
}

export function registerSpec(d: RegisterDocument): Spec | undefined {
  if (d.source?.kind === 'constitution') return constitutionSpec();
  if (d.source?.kind === 'statute') {
    const s = STATUTE_DATABASE[d.source.slug];
    return s ? statuteSpec(s) : undefined;
  }
  if (!d.body) return undefined;
  return {
    code: d.code,
    kind: d.category,
    title: d.title,
    meta: [
      ['Published', longDate(d.date)],
      ['Status', d.status],
      ['Ledger hash', d.hash],
    ],
    lead: d.body.lead,
    sections: d.body.sections,
    attestation: [d.body.signatory, `Public register entry ${d.code}`],
    hash: d.hash,
    subject: d.category,
  };
}

export function bondSpec(b: BondTranche): Spec {
  return {
    code: b.id.toUpperCase(),
    kind: 'Information Memorandum — Covenant Development Bonds',
    title: b.name,
    meta: [
      ['Use of proceeds', b.purpose],
      ['Indicative yield', b.yieldPct],
      ['Tenor', b.tenor],
      ['Coupon', b.coupon],
      ['Minimum subscription', b.minSub],
      ['Programme status', b.status],
    ],
    lead: 'This memorandum summarises the principal terms of the tranche for information only. It is not an offer of securities; subscriptions are accepted solely under the formal prospectus issued by the Ministry of Treasury & Finance.',
    sections: [
      { number: '1.', heading: 'Issuer', paragraphs: ['The Sovereign Covenant State of Aletheia, acting through the Ministry of Treasury & Finance, with the full faith of the Covenant Endowment.'] },
      { number: '2.', heading: 'Use of proceeds', paragraphs: [`Proceeds are ring-fenced for: ${b.purpose}. Every disbursement is receipted on the public ledger and summarised quarterly by the Auditor-General.`] },
      { number: '3.', heading: 'Denomination and settlement', paragraphs: ['Bonds are denominated in Aletheian Guilders (AEY), at par with the euro, and settle on StableChain. Coupons are payable in EUR or AEY at the holder\'s election.'] },
      { number: '4.', heading: 'Governing law', paragraphs: ['The bonds are governed by English commercial law. Disputes are resolved before the Court of Maritime & Commercial Disputes of Aletheia, with recourse to international arbitration.'] },
      { number: '5.', heading: 'Citizenship', paragraphs: ['A subscription of 500,000 AEY or more, held for at least five years, may qualify the holder for the Covenant Investor route to citizenship, subject to enhanced due diligence and the Covenant Oath. Qualification is determined solely by the Immigration Directorate.'] },
      { number: '6.', heading: 'Risk', paragraphs: ['The infrastructure financed by this tranche is at the status shown above. Investors should read the prospectus risk factors in full before subscribing.'] },
    ],
    attestation: ['Ministry of Treasury & Finance — Investor Desk', 'investor.desk@aletheia.gov'],
    subject: 'Information memorandum',
  };
}

/** Every statically generated PDF, for route params, the sitemap and tests. */
export const PDF_CATALOGUE = {
  statutes: Object.keys(STATUTE_DATABASE),
  gazette: GAZETTE_POSTS.map((p) => p.slug),
  documents: REGISTER.map((d) => d.id),
  bonds: BOND_TRANCHES.map((b) => b.id),
};
