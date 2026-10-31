import type { PdfSection } from '@/lib/pdf/builder';
import type { ManualStatus } from '@/lib/status';

/**
 * The public document register (/documents): founding-phase documents without legal force. Entries either point at a
 * canonical source (the Constitution or a statute) or carry their own text.
 * The same records drive the page and the PDF route, so they cannot drift.
 */

export interface RegisterDocument {
  id: string;
  title: string;
  category: 'Constitutional' | 'Statute' | 'Founding Document' | 'Design Record' | 'Technical Standard';
  code: string;
  date: string;
  hash: string;
  status: ManualStatus;
  description: string;
  /** Rendered from canonical data instead of `body`. */
  source?: { kind: 'constitution' } | { kind: 'statute'; slug: string };
  body?: { lead: string; sections: PdfSection[]; signatory: string };
}

export const REGISTER: RegisterDocument[] = [
  {
    id: 'covenant-main',
    title: 'The Covenant of Aletheia (Draft Constitution)',
    category: 'Constitutional',
    code: 'CONST-2026-05',
    date: '2026-10-21',
    hash: '06bbb3288f095a5eb1aa82c5fdbbb3382f0fa717c65882ced2704d98f9850b0f',
    status: 'Proposed',
    description: 'The complete draft Constitution, edition 2026.5: a Preamble, twenty-three Parts and ten Schedules, published for consultation. No legal force.',
    source: { kind: 'constitution' },
  },
  {
    id: 'nationality-act',
    title: 'Nationality & Naturalisation Act',
    category: 'Statute',
    code: 'ACT-2026-04',
    date: '2026-02-10',
    hash: '62c38c614d4e59bbd1aa762296f101f262c3f731034383dccc46d0ff9ecb879a',
    status: 'Proposed',
    description: 'Proposed rules for citizenship by birth and by naturalisation, civic integration and revocation.',
    source: { kind: 'statute', slug: 'nationality-act' },
  },
  {
    id: 'passport-spec',
    title: 'Travel Document Design Notes',
    category: 'Design Record',
    code: 'DES-2026-01',
    date: '2026-03-01',
    hash: '837599c9598132bade12bfa4668ae019ebd697f43d1f4e8ae856f4f07a707805',
    status: 'Proposed',
    description: 'Design notes for a future travel document. Not a regulation: no document is issued.',
    body: {
      lead: 'Design notes for a travel document of the Sovereign Covenant State of Aletheia, drawn up with reference to international travel-document conventions. They are not a regulation and have no legal force. No document will be issued unless Aletheia is established as a state and has the lawful authority to do so.',
      sections: [
        { number: 'Note 1', heading: 'Form', paragraphs: ['A booklet in the conventional passport size, with a machine-readable zone on the data page.'] },
        { number: 'Note 2', heading: 'Appearance', paragraphs: ['A Covenant Burgundy cover bearing the national arms in gold foil, with the name of the State in the five proposed official languages.', 'A laser-engraved polycarbonate data page with a tactile surface relief, a ghost image and micro-text bearing the opening words of Article 1 of the Covenant.'] },
        { number: 'Note 3', heading: 'Electronic chip', paragraphs: ['A contactless chip holding the data page, a facial image and, where the law requires it, fingerprints, protected by modern access control.'] },
        { number: 'Note 4', heading: 'Public keys', paragraphs: ['Signing certificates would be published for border systems, but only if a document were ever lawfully issued.'] },
        { number: 'Note 5', heading: 'Status', paragraphs: ['These notes describe a design only. Aletheia issues no passports, travel or identity documents, and does not sell them.'] },
      ],
      signatory: 'Founding Team',
    },
  },
  {
    id: 'monetary-framework',
    title: 'Monetary Architecture Act',
    category: 'Statute',
    code: 'ACT-2026-06',
    date: '2026-04-18',
    hash: 'bee5ed66b8935fd4ee0c11db3adb79337ed73bdd5299f54a9dbd0476991b8450',
    status: 'Proposed',
    description: 'Proposes the Aletheian Guilder (AEY) as the national currency and the rules for its issue. The AEY is not issued to the public.',
    source: { kind: 'statute', slug: 'monetary-act' },
  },
  {
    id: 'gazette-01-2026',
    title: 'Founding Document No. 01/2026 — The Proposed Executive',
    category: 'Founding Document',
    code: 'FND-2026-01',
    date: '2026-05-01',
    hash: '2535912f471cbd24a597a98ed86b8e4887be14e6adcfd79624bdba4d18f8dc03',
    status: 'Proposed',
    description: 'The proposed structure of the executive: nine ministries, independent bodies, and how Aletheia would approach other states.',
    body: {
      lead: 'This founding document sets out the executive structure proposed in the draft Covenant. It has no legal force: no ministry or body exists, and none exercises authority.',
      sections: [
        { number: 'Part 1', heading: 'The nine ministries', paragraphs: ['Nine ministries are proposed, and no more: Treasury & Finance; Digital State & Registries; Resilience & Civil Protection; Foreign Affairs & Justice; Health & Social Well-being; Education & Science; Maritime Affairs & Ports; Infrastructure & Energy; Agriculture & Environment.'] },
        { number: 'Part 2', heading: 'Independent bodies', paragraphs: ['An Auditor-General, a Registry & Privacy Ombudsman and a Reserve Bank are proposed as independent bodies, answerable to the Covenant Assembly and not to ministers.'] },
        { number: 'Part 3', heading: 'The Gazette', paragraphs: ['In the founding phase, the Gazette publishes founding documents, design studies and planning notes. They have no legal force.'] },
        { number: 'Part 4', heading: 'Relations with other states', paragraphs: ['Aletheia would approach other states only openly and by consent, seeking recognition once its first platform is built.'] },
      ],
      signatory: 'Founding Team',
    },
  },
  {
    id: 'aps-01-spec',
    title: 'Aletheia Protocol Standard 01: AletheiaChain Consensus & Settlement',
    category: 'Technical Standard',
    code: 'APS-01',
    date: '2026-06-12',
    hash: 'cc694a2b7459f5a5d61d836714262feb816517b6223aada35f4dc9d54bcea968',
    status: 'Under Development',
    description: 'Draft technical standard for 500 ms slots with 2-chain finality, deterministic fees, and registry verification, as run on AletheiaChain Mainnet Beta.',
    body: {
      lead: 'This draft standard specifies the consensus, settlement and verification rules of AletheiaChain, the ledger Aletheia is developing, now running as Mainnet Beta. Draft for engineering review; normative language follows RFC 2119.',
      sections: [
        { number: '1.', heading: 'Scope', paragraphs: ['APS-01 governs block production, finality, fee determination and the verification of registry records. It does not govern the issue of any currency; the AEY is not issued to the public.'] },
        { number: '2.', heading: 'Validator set', paragraphs: ['Consensus SHALL be operated by authorised validators across at least three physically separate facilities. The validator set and each validator public key SHALL be published in the public key directory.', 'A change to the validator set SHALL be published at least one epoch before it takes effect.'] },
        { number: '3.', heading: 'Slots and finality', paragraphs: ['Time is divided into slots of 500 milliseconds. A block proposed in a slot is final once it has been attested by more than two thirds of the validator weight; there is no probabilistic finality and no reorganisation of final blocks.', 'An epoch comprises 86,400 slots (12 hours). An integrity digest of the ledger is produced at each epoch boundary.'] },
        { number: '4.', heading: 'Fees', paragraphs: ['Settlement fees SHALL be fixed by a published schedule and SHALL NOT vary with network demand. Fee revenue is reported in each epoch digest.'] },
        { number: '5.', heading: 'Supply rules', paragraphs: ['Validators SHALL check the published supply rules before finalising any block that creates or retires units. If a rule fails, validators SHALL stop creating and retiring units until a signed remediation is published.'] },
        { number: '6.', heading: 'Registry verification', paragraphs: ['Registries (land, companies, identity credentials, Gazette entries) SHALL store records off-ledger and inscribe only the SHA-256 hash of each record together with a timestamp and the signing key.', 'Any person MAY verify a record by recomputing its hash and checking the inclusion proof against a finalised block. Personal data SHALL NOT be written to the ledger.'] },
        { number: '7.', heading: 'Security', paragraphs: ['Validator keys SHALL be held in hardware security modules. Continuous monitoring and a coordinated vulnerability disclosure programme SHALL cover the protocol.'] },
      ],
      signatory: 'Founding Team — Protocol Engineering',
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
  const pages: Record<string, string> = { 'passport-spec': '/design/travel-document', 'gazette-01-2026': '/news', 'aps-01-spec': '/aletheiachain' };
  return pages[d.id] ?? '/documents';
}

export function registerPdfHref(id: string): string {
  return `/pdf/documents/${id}`;
}
