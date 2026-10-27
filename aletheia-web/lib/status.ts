/**
 * ALETHEIA STATUS TAXONOMY (Strict Enforcement per §3.1)
 * Every institution, service, project, law, infrastructure and capability
 * carries exactly one status.
 */

export type NationalStatus = 
  | 'Operational' 
  | 'Under Development' 
  | 'Planned' 
  | 'Proposed' 
  | 'Vision';

export interface StatusMeta {
  status: NationalStatus;
  description: string;
  badgeClass: string;
  dotColor: string;
}

export const STATUS_CONFIG: Record<NationalStatus, StatusMeta> = {
  'Operational': {
    status: 'Operational',
    description: 'Actually functioning and provable today.',
    badgeClass: 'bg-[#EAF6EE] text-[#1B5E38] border-[#9AD6AF]',
    dotColor: '#1B5E38',
  },
  'Under Development': {
    status: 'Under Development',
    description: 'Currently in active engineering or construction.',
    badgeClass: 'bg-[#FDF6E2] text-[#8F5800] border-[#ECC974]',
    dotColor: '#C49A4E',
  },
  'Planned': {
    status: 'Planned',
    description: 'Approved or scheduled in the national roadmap.',
    badgeClass: 'bg-[#EBF3FB] text-[#1A4A7A] border-[#9DC3EA]',
    dotColor: '#1A4A7A',
  },
  'Proposed': {
    status: 'Proposed',
    description: 'Formulated policy or design proposal awaiting constitutional sanction.',
    badgeClass: 'bg-[#F5EFFD] text-[#583688] border-[#CBB2EC]',
    dotColor: '#583688',
  },
  'Vision': {
    status: 'Vision',
    description: 'Long-term design studies, not current holdings or works.',
    badgeClass: 'bg-[#F0F2F5] text-[#4A5568] border-[#CBD5E0]',
    dotColor: '#718096',
  },
};

/** The five statuses in display order, for legends. */
export const STATUS_ORDER: NationalStatus[] = ['Operational', 'Under Development', 'Planned', 'Proposed', 'Vision'];

/**
 * The status register: the single source of truth for what is real today.
 * Only the digital platform is Operational. Pages show these statuses through
 * <StatusBadge asset="…" />; a page cannot pass 'Operational' by hand.
 */
export const NATIONAL_ASSETS = {
  platform: { label: 'Digital platform & public registry', status: 'Operational', note: 'This website, its published documents and the founding-phase record.' },
  stablechain: { label: 'StableChain protocol', status: 'Under Development', note: 'Mainnet Beta and reference implementation.' },
  finality: { label: 'Ledger finality ≈ 1 s', status: 'Under Development', note: 'A design target of StableChain Mainnet Beta.' },
  apn: { label: 'Aletheian PayNet (APN)', status: 'Under Development', note: 'Payment rails in design and testing.' },
  aey: { label: 'The Aletheian Guilder (AEY)', status: 'Planned', note: 'Not issued to the public. Any future issuance only through a licensed issuer.' },
  reserveBank: { label: 'Reserve Bank of Aletheia', status: 'Planned', note: 'The proposed monetary institution.' },
  constitution: { label: 'The Constitution (draft Covenant)', status: 'Proposed', note: 'A published draft, without legal force.' },
  incomeTax: { label: '0% personal income tax', status: 'Proposed', note: 'A constitutional proposal.' },
  institutions: { label: 'Assembly, Cabinet, courts & ministries', status: 'Planned', note: 'Designed in the draft Constitution; none exercises authority.' },
  cyber: { label: 'Cybersecurity Department', status: 'Planned', note: 'To protect digital infrastructure.' },
  police: { label: 'Police Directorate', status: 'Planned', note: 'Civilian policing, within a future territory.' },
  immigration: { label: 'Immigration Directorate', status: 'Planned', note: 'Residence and border administration, within a future territory.' },
  eResidency: { label: 'E-Residency', status: 'Planned', note: 'No applications are accepted.' },
  residence: { label: 'Lawful Residence', status: 'Planned', note: 'Depends on statehood and a built platform.' },
  citizenship: { label: 'Citizenship & travel document', status: 'Proposed', note: 'Citizenship only by birth or naturalisation, once Aletheia is established as a state.' },
  territory: { label: 'Territory', status: 'Planned', note: 'A seastead: platforms Aletheia builds and owns.' },
  antioch: { label: 'Antioch & the four founding states', status: 'Vision', note: 'Design studies, to be built at sea.' },
  maritime: { label: 'Port Nicholas & maritime works', status: 'Vision', note: 'Design studies; no works have begun.' },
  population: { label: 'Permanent population', status: 'Under Development', note: 'Founding community forming.' },
  government: { label: 'Effective government', status: 'Under Development', note: 'Constitution and institutions designed, not yet exercising authority.' },
  foreignRelations: { label: 'Capacity for international relations', status: 'Proposed', note: 'To follow the first platform.' },
} as const satisfies Record<string, { label: string; status: NationalStatus; note: string }>;

export type AssetKey = keyof typeof NATIONAL_ASSETS;

/** Assets listed in the public status register on /transparency, in order. */
export const STATUS_REGISTER: AssetKey[] = [
  'platform', 'stablechain', 'finality', 'apn', 'aey', 'reserveBank', 'constitution', 'incomeTax',
  'institutions', 'cyber', 'police', 'immigration', 'eResidency', 'residence', 'citizenship',
  'territory', 'antioch', 'maritime',
];

/** The four Montevideo criteria, measured honestly. */
export const MONTEVIDEO: { criterion: string; asset: AssetKey }[] = [
  { criterion: 'Defined territory', asset: 'territory' },
  { criterion: 'Permanent population', asset: 'population' },
  { criterion: 'Effective government', asset: 'government' },
  { criterion: 'Capacity for international relations', asset: 'foreignRelations' },
];

/** A status a page may set by hand. 'Operational' only ever comes from the register. */
export type ManualStatus = Exclude<NationalStatus, 'Operational'>;

export function assetStatus(key: AssetKey): NationalStatus {
  return NATIONAL_ASSETS[key].status;
}
