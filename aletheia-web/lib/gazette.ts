import type { PhotoKey } from '@/lib/imagery';
import type { ManualStatus } from '@/lib/status';

export type GazetteCategory = 'Founding Document' | 'Design Record' | 'Planning Note';

export interface GazettePost {
  slug: string;
  number: string;
  title: string;
  category: GazetteCategory;
  /** What the record describes: a design, a proposal or a plan. Never an event that did not happen. */
  status: ManualStatus;
  date: string;
  summary: string;
  /** Full text, one paragraph per entry. */
  body: string[];
  signatory: string;
  image: PhotoKey;
  readMinutes: number;
}

export const GAZETTE_CATEGORIES: GazetteCategory[] = ['Founding Document', 'Design Record', 'Planning Note'];

/** Shown at the top of the Gazette and on every record. */
export const GAZETTE_NOTICE = 'Founding-phase records. These documents have no legal force.';

/** Earlier addresses of records that were renamed, for redirects. */
export const GAZETTE_RENAMED: Record<string, string> = {
  'icao-td3-passport-standard': 'travel-document-design-concept',
  'offshore-wind-concession-round': 'offshore-wind-design-study',
  'maritime-environmental-accord': 'marine-environmental-monitoring',
};

/** Gazette records, newest first. */
export const GAZETTE_POSTS: GazettePost[] = [
  {
    slug: 'travel-document-design-concept',
    number: 'REC-2026-09',
    title: 'Design Concept: Aletheian Travel Document',
    category: 'Design Record',
    status: 'Proposed',
    date: '2026-09-28',
    summary:
      'A design concept for a future Aletheian travel document, in Covenant Burgundy, is published for comment.',
    body: [
      'The founding team has published a design concept for a future Aletheian travel document, drawn up with reference to international travel-document conventions.',
      'The concept describes a Covenant Burgundy booklet, a polycarbonate data page and an electronic chip. It is a design only: no document has been produced or issued, and none will be issued unless Aletheia is established by treaty and has the lawful authority to do so.',
      'The design concept is shown on the travel-document design page.',
    ],
    signatory: 'Founding Team',
    image: 'flight',
    readMinutes: 2,
  },
  {
    slug: 'st-brendan-maritime-terminus',
    number: 'REC-2026-08',
    title: 'Design Study Published: St. Brendan Maritime Terminus (Vision)',
    category: 'Design Record',
    status: 'Vision',
    date: '2026-09-14',
    summary:
      'A design study for a deepwater port at Port Nicholas, St. Brendan, is published. No site has been chosen and no works have begun.',
    body: [
      'The founding team has published a design study for the St. Brendan Maritime Terminus, a deepwater port at Port Nicholas in the long-term Antioch plan.',
      'The study sketches automated container handling, bonded warehousing, a renewable microgrid and passenger facilities. It is a vision for the future, not a project under way: no site has been chosen, no contracts have been awarded and no works have begun.',
      'Any port would be built only within a territory agreed by treaty with a host state, with that state’s consent and under international maritime law.',
    ],
    signatory: 'Founding Team',
    image: 'containerPort',
    readMinutes: 2,
  },
  {
    slug: 'public-key-directory',
    number: 'REC-2026-07',
    title: 'Design Record: A Public Key Directory',
    category: 'Design Record',
    status: 'Planned',
    date: '2026-08-30',
    summary:
      'How Aletheia plans to publish the keys that sign its records, so anyone can check them.',
    body: [
      'This record describes a planned public directory of the keys that sign Aletheia’s published records.',
      'In its first form it would publish the signing keys of the StableChain testnet validators and of the Gazette, so anyone can check a published record independently. Keys for travel documents would be added only if such documents were ever lawfully issued.',
    ],
    signatory: 'Founding Team',
    image: 'circuitGlow',
    readMinutes: 2,
  },
  {
    slug: 'marine-environmental-monitoring',
    number: 'REC-2026-06',
    title: 'Proposal: Marine Environmental Monitoring',
    category: 'Planning Note',
    status: 'Proposed',
    date: '2026-08-12',
    summary:
      'A proposal for open seabed mapping and marine-ecology monitoring, to be agreed with a future host state.',
    body: [
      'This note proposes how Aletheia would monitor the marine environment of any territory it is granted by treaty.',
      'The proposal includes seabed mapping, ecology monitoring by autonomous survey vessels, and the publication of all data as open data. No accord has been signed; any programme would be agreed with the host state.',
    ],
    signatory: 'Founding Team',
    image: 'oceanAerial',
    readMinutes: 2,
  },
  {
    slug: 'offshore-wind-design-study',
    number: 'REC-2026-05',
    title: 'Design Study: Offshore Wind for Benedict State (Vision)',
    category: 'Design Record',
    status: 'Vision',
    date: '2026-07-21',
    summary:
      'A design study for offshore wind in the long-term Benedict plan. No concession exists and none is offered.',
    body: [
      'The founding team has published a design study for offshore wind generation in Benedict State, part of the long-term Antioch plan.',
      'The study describes how concession revenue could flow to the Covenant Endowment rather than to general taxation, as the draft Constitution proposes. No concession exists, none is offered, and no expressions of interest are sought.',
    ],
    signatory: 'Founding Team',
    image: 'offshoreWind',
    readMinutes: 2,
  },
  {
    slug: 'national-university-charter',
    number: 'REC-2026-04',
    title: 'Draft Charter Published: National University of Aletheia',
    category: 'Founding Document',
    status: 'Proposed',
    date: '2026-06-30',
    summary:
      'A draft charter for a future research university with faculties of medicine, law, engineering and maritime science.',
    body: [
      'A draft charter for a future National University of Aletheia, with faculties of medicine, law, engineering and maritime science, has been published for comment.',
      'The draft guarantees academic freedom and the publication of all research grants. It has no legal force; it would be considered only once Aletheia has a lawful legislature. Comments are welcome through the contact page.',
    ],
    signatory: 'Founding Team',
    image: 'libraryAisle',
    readMinutes: 2,
  },
];

export function getGazettePost(slug: string): GazettePost | undefined {
  return GAZETTE_POSTS.find((p) => p.slug === slug);
}

export function formatGazetteDate(iso: string, intl = 'en-GB'): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(intl, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
