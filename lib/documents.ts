import type { PdfSection } from '@/lib/pdf/builder';

/**
 * The public document register (/documents). Entries either point at a
 * canonical source (the Constitution or a statute) or carry their own text.
 * The same records drive the page and the PDF route, so they cannot drift.
 */

export interface RegisterDocument {
  id: string;
  title: string;
  category: 'Constitutional' | 'Statute' | 'Gazette' | 'Technical Standard';
  code: string;
  date: string;
  hash: string;
  status: 'Operational' | 'Under Development' | 'Planned';
  description: string;
  /** Rendered from canonical data instead of `body`. */
  source?: { kind: 'constitution' } | { kind: 'statute'; slug: string };
  body?: { lead: string; sections: PdfSection[]; signatory: string };
}

export const REGISTER: RegisterDocument[] = [
  {
    id: 'covenant-main',
    title: 'The Covenant of Aletheia (Full Constitution)',
    category: 'Constitutional',
    code: 'CONST-2026-01',
    date: '2026-01-15',
    hash: '0x8f2b7a4c91e3d085fa49b817e4521098ef7321ac90b34d76a218fce1b2049e91',
    status: 'Operational',
    description: 'The fundamental supreme organic law establishing the Sovereign Covenant State, rights charter, and governance architecture.',
    source: { kind: 'constitution' },
  },
  {
    id: 'nationality-act',
    title: 'Nationality & Naturalisation Act',
    category: 'Statute',
    code: 'ACT-2026-04',
    date: '2026-02-10',
    hash: '0x3c9902ba14ff28e67a01d5e390c88461ab209ef731478201fa8892ca3401ef62',
    status: 'Operational',
    description: 'Governs citizenship by descent, naturalisation, the Covenant Investor route, civic integration and revocation.',
    source: { kind: 'statute', slug: 'nationality-act' },
  },
  {
    id: 'passport-spec',
    title: 'Passports & ICAO eMRTD Regulations',
    category: 'Statute',
    code: 'REG-2026-01',
    date: '2026-03-01',
    hash: '0x17fa9081e7d230198aa49b8214309eec8120fa87632190847b2c01948fe21980',
    status: 'Operational',
    description: 'Regulations for TD3 biometric travel document issuance, polycarbonate substrates, and ICAO PKD keys.',
    body: {
      lead: 'Regulations made under the Nationality & Naturalisation Act prescribing the form, security and issuance of the passport of the Sovereign Covenant State of Aletheia.',
      sections: [
        { number: 'Regulation 1', heading: 'Standard', paragraphs: ['The passport of Aletheia shall be a machine-readable travel document conforming to ICAO Doc 9303, Part 4 (TD3 size), issued as an electronic machine-readable travel document (eMRTD).'] },
        { number: 'Regulation 2', heading: 'Form and appearance', paragraphs: ['The cover shall be Covenant Burgundy and bear the national arms in gold foil, with the words "The Sovereign Covenant State of Aletheia" and "Passport" in the five official languages.', 'The data page shall be laser-engraved polycarbonate with a tactile surface relief, a ghost image and micro-text bearing the opening words of Article 1 of the Covenant.'] },
        { number: 'Regulation 3', heading: 'Electronic chip', paragraphs: ['Each passport shall contain a contactless microcontroller of not less than 80 KB storing Logical Data Structure version 1.7, including Data Group 1 (machine-readable zone), Data Group 2 (facial image) and Data Group 3 (fingerprints).', 'Access to the chip shall be protected by Supplemental Access Control (PACE). Data Group 3 shall be protected by Extended Access Control and released only to inspection systems holding a valid document verifier certificate.'] },
        { number: 'Regulation 4', heading: 'Public key infrastructure', paragraphs: ['The Country Signing Certificate Authority (CSCA) shall be operated by the Ministry of Foreign Affairs & Justice in hardware security modules certified to FIPS 140-3 Level 3.', 'The CSCA certificate and certificate revocation lists shall be published to the ICAO Public Key Directory and on the State Key Directory established by Executive Order 2026-14.'] },
        { number: 'Regulation 5', heading: 'Validity and issuance', paragraphs: ['A passport is valid for ten years for adults and five years for persons under eighteen. Issuance requires in-person biometric enrolment before an officer of the Immigration Directorate or a consular mission.'] },
      ],
      signatory: 'Minister of Foreign Affairs & Justice',
    },
  },
  {
    id: 'monetary-framework',
    title: 'Monetary Architecture & Reserve Backing Act',
    category: 'Statute',
    code: 'ACT-2026-06',
    date: '2026-04-18',
    hash: '0xaa18902ef34b890123ca78091ecb87201948ba209ef182049ec8720914be8721',
    status: 'Operational',
    description: 'Defines the legal tender status of the Aletheian Guilder (AEY) and its reserve backing invariants.',
    source: { kind: 'statute', slug: 'monetary-act' },
  },
  {
    id: 'gazette-01-2026',
    title: 'Official Gazette No. 01/2026 — Establishing Decree',
    category: 'Gazette',
    code: 'GAZ-2026-01',
    date: '2026-05-01',
    hash: '0x9920184fa9802ecb8720918ba340291ef732014890ecb8201948ea20914801fa',
    status: 'Operational',
    description: 'Official promulgation of inaugural executive orders, ministerial portfolios, and diplomatic notifications.',
    body: {
      lead: 'The Chancellor of the Sovereign Covenant State, acting under Article 23 of the Covenant, promulgates the following decrees establishing the institutions of the executive.',
      sections: [
        { number: 'Decree 1', heading: 'Establishment of the Ministries', paragraphs: ['The following nine ministries are established, and no other: Treasury & Finance; Digital State & Registries; Security & Civil Defence; Foreign Affairs & Justice; Health & Social Well-being; Education & Science; Maritime Affairs & Ports; Infrastructure & Energy; Agriculture & Environment.'] },
        { number: 'Decree 2', heading: 'Independent constitutional bodies', paragraphs: ['The Auditor-General, the Registry & Privacy Ombudsman and the Monetary Board are constituted as independent bodies reporting to the Covenant Assembly and not subject to ministerial direction.'] },
        { number: 'Decree 3', heading: 'The Official Gazette', paragraphs: ['The Official Gazette is established as the sole authoritative channel for the promulgation of statutes, decrees and appointments. Each entry shall be signed and its hash inscribed on the public ledger.'] },
        { number: 'Decree 4', heading: 'Diplomatic notification', paragraphs: ['The Ministry of Foreign Affairs & Justice is directed to notify foreign governments and international organisations of the establishment of the Sovereign Covenant State and of its intention to pursue bilateral covenants of friendship and recognition.'] },
      ],
      signatory: 'Chancellor of the Sovereign Covenant State',
    },
  },
  {
    id: 'aps-01-spec',
    title: 'Aletheia Protocol Standard 01: StableChain Consensus & Settlement',
    category: 'Technical Standard',
    code: 'APS-01',
    date: '2026-06-12',
    hash: '0x4489021fa89023ebc87201948ea20914bca890214890ec8201948ea20914801e',
    status: 'Under Development',
    description: 'Technical standard for 500 ms slot finality, deterministic fees, and state registry verification.',
    body: {
      lead: 'This standard specifies the consensus, settlement and verification rules of StableChain, the national ledger of the Sovereign Covenant State. Draft for engineering review; normative language follows RFC 2119.',
      sections: [
        { number: '1.', heading: 'Scope', paragraphs: ['APS-01 governs block production, finality, fee determination and the verification of state registry records. It does not govern the monetary policy of the AEY, which is set by the Monetary Architecture & Reserve Backing Act.'] },
        { number: '2.', heading: 'Validator set', paragraphs: ['Consensus SHALL be operated by state-authorised validators partitioned across at least three physically separate facilities. The validator set and each validator public key SHALL be published in the State Key Directory.', 'A change to the validator set REQUIRES a signed decree published in the Official Gazette at least one epoch before it takes effect.'] },
        { number: '3.', heading: 'Slots and finality', paragraphs: ['Time is divided into slots of 500 milliseconds. A block proposed in a slot is final once it has been attested by more than two thirds of the validator weight; there is no probabilistic finality and no reorganisation of final blocks.', 'An epoch comprises 86,400 slots (12 hours). Reserve attestations and the Auditor-General receipts digest are produced at each epoch boundary.'] },
        { number: '4.', heading: 'Fees', paragraphs: ['Settlement fees SHALL be fixed in AEY by statutory schedule and SHALL NOT vary with network demand. Fee revenue accrues to the Treasury and is reported in each epoch digest.'] },
        { number: '5.', heading: 'Reserve invariants', paragraphs: ['Validators SHALL evaluate the twelve monetary invariants (I1–I12) before finalising any block that mints or burns AEY. If any invariant fails, validators SHALL halt minting and burning until the Monetary Board publishes a signed remediation.'] },
        { number: '6.', heading: 'Registry verification', paragraphs: ['State registries (land, companies, identity credentials, Gazette entries) SHALL store records off-ledger and inscribe only the SHA-256 hash of each record together with a timestamp and the signing key.', 'Any person MAY verify a record by recomputing its hash and checking the inclusion proof against a finalised block. Personal data SHALL NOT be written to the ledger.'] },
        { number: '7.', heading: 'Security', paragraphs: ['Validator keys SHALL be held in hardware security modules. The Aletheian Cybersecurity Department SHALL operate continuous monitoring and a coordinated vulnerability disclosure programme for the protocol.'] },
      ],
      signatory: 'Ministry of Digital State & Registries — Protocol Standards Board',
    },
  },
];

export function getRegisterDocument(id: string): RegisterDocument | undefined {
  return REGISTER.find((d) => d.id === id);
}

/** Where the HTML (accessible) version of a register document lives. */
export function registerReadHref(d: RegisterDocument): string {
  if (d.source?.kind === 'constitution') return '/constitution';
  if (d.source?.kind === 'statute') return `/laws/${d.source.slug}`;
  const pages: Record<string, string> = { 'passport-spec': '/passport', 'gazette-01-2026': '/news', 'aps-01-spec': '/stablechain' };
  return pages[d.id] ?? '/documents';
}

export function registerPdfHref(id: string): string {
  return `/pdf/documents/${id}`;
}
