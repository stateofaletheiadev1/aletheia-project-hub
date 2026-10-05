import type { PhotoKey } from '@/lib/imagery';

export type GazetteCategory = 'Executive Decree' | 'Territory & Engineering' | 'Diplomacy' | 'Regulatory';

export interface GazettePost {
  slug: string;
  number: string;
  title: string;
  category: GazetteCategory;
  date: string;
  summary: string;
  /** Full bulletin text, one paragraph per entry. */
  body: string[];
  signatory: string;
  image: PhotoKey;
  readMinutes: number;
}

export const GAZETTE_CATEGORIES: GazetteCategory[] = [
  'Executive Decree',
  'Territory & Engineering',
  'Diplomacy',
  'Regulatory',
];

/** Official Gazette bulletins, newest first. */
export const GAZETTE_POSTS: GazettePost[] = [
  {
    slug: 'icao-td3-passport-standard',
    number: 'DEC-2026-09',
    title: 'Promulgation of the ICAO TD3 eMRTD Passport Standard',
    category: 'Regulatory',
    date: '2026-09-28',
    summary:
      'The Ministry of Foreign Affairs & Justice adopts ICAO Doc 9303 standards for machine-readable biometric passports in Covenant Burgundy.',
    body: [
      'Pursuant to Article 8 of the Covenant of Aletheia, the Ministry of Foreign Affairs & Justice has finalised the technical baseline for the national biometric passport.',
      'The specification adopts ICAO Doc 9303 Part 4 (TD3) with an 80 KB contactless microcontroller, Supplemental Access Control (SAC), Extended Access Control (EAC) for fingerprint data groups, and a laser-engraved polycarbonate data page.',
      'Issuance begins in a pilot phase with the founding cohort of citizens. Production issuance follows certification of the Country Signing Certificate Authority and accession to the ICAO Public Key Directory.',
    ],
    signatory: 'Chancellor & Minister of Foreign Affairs',
    image: 'flight',
    readMinutes: 3,
  },
  {
    slug: 'st-brendan-maritime-terminus',
    number: 'DEC-2026-08',
    title: 'Groundbreaking on the St. Brendan Autonomous Maritime Terminus',
    category: 'Territory & Engineering',
    date: '2026-09-14',
    summary:
      'Engineering contracts awarded for Phase 1 of deepwater container logistics, marine renewables and automated border gates at Port Nicholas.',
    body: [
      'The Ministry of Territorial Development announces commencement of geotechnical survey and marine anchoring works for the St. Brendan port complex at Port Nicholas.',
      'Phase 1 comprises an automated container crane network, customs-bonded warehousing, a renewable marine microgrid and biometric e-gates for passenger traffic.',
      'All contract awards, milestone payments and inspection certificates are recorded on the public ledger and summarised quarterly by the Auditor-General.',
    ],
    signatory: 'Minister of Territorial Development',
    image: 'containerPort',
    readMinutes: 4,
  },
  {
    slug: 'public-key-directory',
    number: 'DEC-2026-07',
    title: 'Establishment of the Public Cryptographic State Key Directory',
    category: 'Executive Decree',
    date: '2026-08-30',
    summary:
      'Country signing root certificates to be distributed to international aviation and maritime border checkpoints.',
    body: [
      'Executive Order 2026-14 mandates public availability of the Country Signing CA (CSCA) root certificate to facilitate automated e-Gate passage for Aletheian passport holders.',
      'The directory will also publish validator keys for StableChain state nodes and the signing keys of the Official Gazette, so any citizen can verify a decree independently.',
    ],
    signatory: 'Chancellor of the Republic',
    image: 'circuitGlow',
    readMinutes: 2,
  },
  {
    slug: 'maritime-environmental-accord',
    number: 'DEC-2026-06',
    title: 'Scientific & Maritime Environmental Accord for the North Sea',
    category: 'Diplomacy',
    date: '2026-08-12',
    summary:
      'A partnership for high-resolution seabed mapping and sustainable North Sea ecology monitoring.',
    body: [
      'Aletheia enters into mutual environmental monitoring protocols to protect pelagic ecosystems within its proposed maritime zones.',
      'Autonomous solar-powered surface vessels will provide continuous oceanographic telemetry, published as open data under the transparency mandate.',
    ],
    signatory: 'Department of Maritime Affairs',
    image: 'oceanAerial',
    readMinutes: 2,
  },
  {
    slug: 'offshore-wind-concession-round',
    number: 'DEC-2026-05',
    title: 'First Offshore Wind Concession Round Opened for Benedict State',
    category: 'Territory & Engineering',
    date: '2026-07-21',
    summary:
      'Expressions of interest invited for a 1.2 GW offshore wind array to anchor the sovereign clean grid.',
    body: [
      'The Ministry of Infrastructure & Energy invites expressions of interest from qualified developers for the first offshore wind concession off the Benedict coast.',
      'Concession revenue flows to the Covenant Endowment rather than general taxation, consistent with the constitutional prohibition on personal income tax.',
      'Evaluation criteria, bidder questions and the final award will be published in full in the Official Gazette.',
    ],
    signatory: 'Minister of Infrastructure & Energy',
    image: 'offshoreWind',
    readMinutes: 3,
  },
  {
    slug: 'national-university-charter',
    number: 'DEC-2026-04',
    title: 'Charter Proposed for the National University of Aletheia',
    category: 'Regulatory',
    date: '2026-06-30',
    summary:
      'Draft charter tabled for a research university at Augustine State with faculties of medicine, law, engineering and maritime science.',
    body: [
      'The Ministry of Education & Science has tabled a draft charter establishing the National University of Aletheia at Port Luke, Augustine State.',
      'The charter guarantees academic freedom, publishes all research grants on the public ledger, and reserves founding scholarships for citizens and lawful residents.',
      'The draft is open for public comment for ninety days before consideration by the Covenant Assembly.',
    ],
    signatory: 'Minister of Education & Science',
    image: 'libraryAisle',
    readMinutes: 3,
  },
];

export function getGazettePost(slug: string): GazettePost | undefined {
  return GAZETTE_POSTS.find((p) => p.slug === slug);
}

export function formatGazetteDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
