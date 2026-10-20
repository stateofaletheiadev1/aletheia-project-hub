import type { OfficialPdfSpec } from '@/lib/pdf/builder';
import { CONSTITUTION_DATA } from '@/lib/constitution-data';
import { STATUTE_DATABASE, type StatuteDetail } from '@/lib/statutes';
import { GAZETTE_POSTS, type GazettePost } from '@/lib/gazette';
import { REGISTER, type RegisterDocument } from '@/lib/documents';

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
    kind: 'Draft Constitution — a proposal without legal force',
    title: 'The Covenant of Aletheia (Draft)',
    meta: [
      ['Published', longDate('2026-01-15')],
      ['Edition', '2026.3 — working draft'],
      ['Articles', `${CONSTITUTION_DATA.length} published provisions`],
    ],
    lead: 'We, the founding members of the Sovereign Covenant State of Aletheia, ordain this Covenant so that the public power of the Sovereign Covenant State shall be lawful, limited, and provable — Veritas in Foedere.',
    sections: CONSTITUTION_DATA.map((a) => ({
      number: `Article ${a.number}`,
      heading: `${a.title}  (${a.part})`,
      paragraphs: a.clauses.map((c) => `${c.number}  ${c.text}`),
    })),
    attestation: ['Published as a draft by the founding team', 'A proposal: it has no legal force until adopted by Aletheia’s citizens'],
    hash: '8f2b7a4c91e3d085fa49b817e4521098ef7321ac90b34d76a218fce1b2049e91',
    subject: 'Constitution',
  };
}

export function statuteSpec(s: StatuteDetail): Spec {
  return {
    code: s.code,
    kind: 'Proposed Act — a draft without legal force',
    title: s.title,
    meta: [
      ['Published', longDate(s.date)],
      ['Constitutional basis', s.article],
      ['Ledger hash', s.hash],
    ],
    lead: s.preamble,
    sections: s.sections.map((sec) => ({ number: sec.number, heading: sec.heading, paragraphs: [sec.text] })),
    attestation: [`Proposed signatory: ${s.signatory}`, `Draft ${s.code}: no legal force`],
    hash: s.hash,
    subject: 'Statute',
  };
}

export function gazetteSpec(p: GazettePost): Spec {
  return {
    code: p.number,
    kind: `Gazette — ${p.category}`,
    title: p.title,
    meta: [
      ['Published', longDate(p.date)],
      ['Status', p.status],
      ['Published by', p.signatory],
    ],
    lead: p.summary,
    sections: [{ paragraphs: p.body }],
    attestation: [p.signatory, `Gazette record ${p.number}: founding-phase record, no legal force`],
    subject: 'Gazette record',
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

/** Every statically generated PDF, for route params, the sitemap and tests. */
export const PDF_CATALOGUE = {
  statutes: Object.keys(STATUTE_DATABASE),
  gazette: GAZETTE_POSTS.map((p) => p.slug),
  documents: REGISTER.map((d) => d.id),
};
