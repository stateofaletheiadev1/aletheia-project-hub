import type { ClauseSource, PartSource, ScheduleSource } from './types';
import { PREAMBLE, PREAMBLE_NOTE, PARTS_I_III } from './text/part-01-03';
import { PARTS_IV_VI } from './text/part-04-06';
import { PARTS_VII_XI } from './text/part-07-11';
import { PARTS_XII_XV } from './text/part-12-15';
import { PARTS_XVI_XXIII } from './text/part-16-23';
import { SCHEDULES } from './text/schedules';

/**
 * The draft Constitution, assembled: articles numbered in document order, symbolic
 * cross-references resolved, and the result checked. Any unresolved reference throws,
 * so a broken cross-reference fails the build rather than reaching the page.
 */

export const EDITION = {
  code: 'CONST-2026-05',
  edition: '2026.5',
  status: 'Draft for consultation',
  date: '2026-10-21',
  summary: 'The complete text: a Preamble, twenty-three Parts and ten Schedules.',
};

export const CHANGELOG: { edition: string; date: string; summary: string }[] = [
  {
    edition: '2026.5',
    date: '2026-10-21',
    summary: 'A clause is added to the Article on the prohibition of monetary financing: the official reserves of the Reserve Bank may not be used to finance the construction of platforms, public works or any other expenditure of the State.',
  },
  {
    edition: '2026.4',
    date: '2026-10-21',
    summary:
      'Complete draft published for consultation. The nine provisions of edition 2026.3 are carried forward and renumbered within a full text covering Christian heritage and religion, the seastead territory, citizenship and dual citizenship, fundamental rights, the federal institutions, the judiciary, the Reserve Bank and the Guilder, public finance, security, emergency powers, amendment and the founding transition.',
  },
  { edition: '2026.3', date: '2026-01-15', summary: 'Nine provisions published for review.' },
];

export interface Clause {
  /** "1", "2", … */
  n: string;
  text: string;
  items?: string[];
}

export interface Article {
  number: number;
  key: string;
  /** Stable anchor: "article-42". */
  id: string;
  title: string;
  clauses: Clause[];
  part: string;
  chapter: string;
}

export interface Chapter {
  title: string;
  articles: Article[];
}

export interface Part {
  numeral: string;
  /** "part-iv". */
  id: string;
  title: string;
  chapters: Chapter[];
}

export interface Schedule {
  number: number;
  id: string;
  title: string;
  basis: Article[];
  sections: { heading: string; clauses: Clause[] }[];
}

/** Anchors of edition 2026.3, mapped to the articles that carry their substance now. */
const LEGACY: Record<string, string> = {
  'art-1': 'nature',
  'art-2': 'languages',
  'art-7': 'territory',
  'art-8': 'citizenship',
  'art-11': 'e-residency',
  'art-16': 'guilder',
  'art-23': 'nine',
  'art-46': 'adss',
  'art-53': 'cyber',
};

function build() {
  const sources: PartSource[] = [...PARTS_I_III, ...PARTS_IV_VI, ...PARTS_VII_XI, ...PARTS_XII_XV, ...PARTS_XVI_XXIII];

  // Pass 1: number every article.
  const numbers = new Map<string, { number: number; clauses: number }>();
  let n = 0;
  for (const p of sources) {
    for (const c of p.chapters) {
      for (const a of c.articles) {
        if (numbers.has(a.key)) throw new Error(`Constitution: duplicate article key "${a.key}"`);
        numbers.set(a.key, { number: ++n, clauses: a.clauses.length });
      }
    }
  }
  const scheduleNumbers = new Set(SCHEDULES.map((s) => s.number));

  const resolve = (text: string, where: string): string =>
    text.replace(/\[\[([a-z0-9-]+)(?:\((\d+)\))?\]\]/g, (_, key: string, clause?: string) => {
      const target = numbers.get(key);
      if (!target) throw new Error(`Constitution: unknown reference [[${key}]] in ${where}`);
      if (clause && Number(clause) > target.clauses) {
        throw new Error(`Constitution: [[${key}(${clause})]] in ${where} — Article ${target.number} has ${target.clauses} clauses`);
      }
      return `Article ${target.number}${clause ? `(${clause})` : ''}`;
    });

  const checkText = (text: string, where: string) => {
    for (const m of text.matchAll(/Schedule (\d+)/g)) {
      if (!scheduleNumbers.has(Number(m[1]))) throw new Error(`Constitution: Schedule ${m[1]} in ${where} does not exist`);
    }
    for (const m of text.matchAll(/Part ([IVX]+)\b/g)) {
      if (!sources.some((p) => p.numeral === m[1])) throw new Error(`Constitution: Part ${m[1]} in ${where} does not exist`);
    }
    return text;
  };

  const clauses = (list: ClauseSource[], where: string): Clause[] =>
    list.map((c, i) => {
      const [lead, items] = typeof c === 'string' ? [c, undefined] : c;
      const w = `${where}(${i + 1})`;
      return {
        n: String(i + 1),
        text: checkText(resolve(lead, w), w),
        items: items?.map((it) => checkText(resolve(it, w), w)),
      };
    });

  // Pass 2: resolve text.
  const articles: Article[] = [];
  const parts: Part[] = sources.map((p) => ({
    numeral: p.numeral,
    id: `part-${p.numeral.toLowerCase()}`,
    title: p.title,
    chapters: p.chapters.map((c) => ({
      title: c.title,
      articles: c.articles.map((a) => {
        const number = numbers.get(a.key)!.number;
        const article: Article = {
          number,
          key: a.key,
          id: `article-${number}`,
          title: a.title,
          clauses: clauses(a.clauses, `Article ${number}`),
          part: p.numeral,
          chapter: c.title,
        };
        articles.push(article);
        return article;
      }),
    })),
  }));

  const byKey = new Map(articles.map((a) => [a.key, a]));
  const schedules: Schedule[] = SCHEDULES.map((s: ScheduleSource) => ({
    number: s.number,
    id: `schedule-${s.number}`,
    title: s.title,
    basis: s.basis.map((k) => {
      const a = byKey.get(k);
      if (!a) throw new Error(`Constitution: Schedule ${s.number} cites unknown article "${k}"`);
      return a;
    }),
    sections: s.sections.map((sec, i) => ({ heading: sec.heading, clauses: clauses(sec.clauses, `Schedule ${s.number}.${i + 1}`) })),
  }));

  const legacy: Record<string, string> = {};
  for (const [old, key] of Object.entries(LEGACY)) {
    const a = byKey.get(key);
    if (!a) throw new Error(`Constitution: legacy anchor ${old} maps to unknown article "${key}"`);
    legacy[old] = a.id;
  }

  return {
    preamble: PREAMBLE,
    preambleNote: checkText(resolve(PREAMBLE_NOTE, 'Preamble note'), 'Preamble note'),
    parts,
    articles,
    schedules,
    legacy,
  };
}

export const CONSTITUTION = build();

/** The article that carries a given key; throws on an unknown key. */
export function articleByKey(key: string): Article {
  const a = CONSTITUTION.articles.find((x) => x.key === key);
  if (!a) throw new Error(`Constitution: unknown article "${key}"`);
  return a;
}

/** Plain text of the whole instrument, in reading order, for fingerprinting and search engines. */
export function canonicalText(): string {
  const lines: string[] = ['THE CONSTITUTION OF THE SOVEREIGN COVENANT STATE OF ALETHEIA', `Edition ${EDITION.edition}`, '', 'PREAMBLE', ...CONSTITUTION.preamble, ''];
  for (const p of CONSTITUTION.parts) {
    lines.push(`PART ${p.numeral} — ${p.title.toUpperCase()}`);
    for (const c of p.chapters) {
      lines.push(`Chapter: ${c.title}`);
      for (const a of c.articles) {
        lines.push(`Article ${a.number}. ${a.title}`);
        for (const cl of a.clauses) {
          lines.push(`(${cl.n}) ${cl.text}`);
          for (const [i, it] of (cl.items ?? []).entries()) lines.push(`  (${String.fromCharCode(97 + i)}) ${it}`);
        }
      }
    }
    lines.push('');
  }
  for (const s of CONSTITUTION.schedules) {
    lines.push(`SCHEDULE ${s.number} — ${s.title.toUpperCase()}`);
    for (const sec of s.sections) {
      lines.push(sec.heading);
      for (const cl of sec.clauses) {
        lines.push(`${cl.n}. ${cl.text}`);
        for (const [i, it] of (cl.items ?? []).entries()) lines.push(`  (${String.fromCharCode(97 + i)}) ${it}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** schema.org metadata for the Constitution page. */
export function constitutionJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    name: 'The Constitution of the Sovereign Covenant State of Aletheia (Draft)',
    alternateName: 'The Covenant of Aletheia',
    legislationIdentifier: EDITION.code,
    legislationDate: EDITION.date,
    legislationLegalForce: 'https://schema.org/NotInForce',
    legislationType: 'Draft constitution',
    inLanguage: 'en',
    url: 'https://www.stateofaletheia.org/constitution',
    encoding: { '@type': 'MediaObject', encodingFormat: 'application/pdf', contentUrl: 'https://www.stateofaletheia.org/pdf/constitution' },
  };
}
