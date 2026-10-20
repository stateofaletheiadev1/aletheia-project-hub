/**
 * National registry & revenue figures shown on /registry.
 *
 * Real figures only. No e-resident, citizen or company is registered yet and nothing has been
 * raised, so every count is zero. When the registry service exists, replace
 * `getRegistrySnapshot()` with a fetch from it; the shape of `RegistrySnapshot` is the contract.
 */

export interface RegistrySnapshot {
  asOf: string;
  registrations: {
    eResidents: number;
    eResidencyApplicationsPending: number;
    companies: number;
    citizens: { founding: number; investor: number; naturalised: number; covenantAward: number };
    residencyInterest: number;
  };
  /** Funds raised to date, in Aletheian Guilders (AEY). */
  revenue: { id: string; label: string; amount: number; note: string }[];
  /** How raised capital is committed. Shares sum to 1. */
  allocation: { label: string; share: number; href: string }[];
  /** Phase 1 build-out funding target, in AEY. */
  phaseOneTarget: number;
  /** New registrations per month, oldest first. */
  monthly: { month: string; eResidents: number; citizens: number }[];
}

const SNAPSHOT: RegistrySnapshot = {
  asOf: '2026-10-10',
  registrations: {
    eResidents: 0,
    eResidencyApplicationsPending: 0,
    companies: 0,
    citizens: { founding: 0, investor: 0, naturalised: 0, covenantAward: 0 },
    residencyInterest: 0,
  },
  revenue: [
    { id: 'endowment', label: 'Founding endowment capital', amount: 0, note: 'Initial capital of the Covenant Endowment' },
    { id: 'bonds', label: 'Covenant Development Bonds', amount: 0, note: 'Subscriptions to infrastructure bonds' },
    { id: 'investor', label: 'Covenant Investor contributions', amount: 0, note: 'National Development Contributions' },
    { id: 'registry', label: 'Company registry fees', amount: 0, note: 'Incorporations and annual licences' },
    { id: 'concessions', label: 'Port & energy concessions', amount: 0, note: 'Concession fees, St. Brendan & Benedict' },
    { id: 'eresidency', label: 'E-residency fees', amount: 0, note: '150 AEY per e-resident per year' },
  ],
  allocation: [
    { label: 'St. Brendan deepwater port', share: 0.38, href: '/infrastructure' },
    { label: 'Antioch civic core', share: 0.22, href: '/development#antioch' },
    { label: 'Sovereign energy grid', share: 0.18, href: '/energy' },
    { label: 'Retained in the Endowment', share: 0.15, href: '/treasury' },
    { label: 'Digital state & StableChain', share: 0.07, href: '/stablechain' },
  ],
  phaseOneTarget: 4_200_000_000,
  monthly: [
    { month: '2025-11', eResidents: 0, citizens: 0 },
    { month: '2025-12', eResidents: 0, citizens: 0 },
    { month: '2026-01', eResidents: 0, citizens: 0 },
    { month: '2026-02', eResidents: 0, citizens: 0 },
    { month: '2026-03', eResidents: 0, citizens: 0 },
    { month: '2026-04', eResidents: 0, citizens: 0 },
    { month: '2026-05', eResidents: 0, citizens: 0 },
    { month: '2026-06', eResidents: 0, citizens: 0 },
    { month: '2026-07', eResidents: 0, citizens: 0 },
    { month: '2026-08', eResidents: 0, citizens: 0 },
    { month: '2026-09', eResidents: 0, citizens: 0 },
    { month: '2026-10', eResidents: 0, citizens: 0 },
  ],
};

export function getRegistrySnapshot(): RegistrySnapshot {
  return SNAPSHOT;
}

export function totalCitizens(s: RegistrySnapshot): number {
  const c = s.registrations.citizens;
  return c.founding + c.investor + c.naturalised + c.covenantAward;
}

export function totalRaised(s: RegistrySnapshot): number {
  return s.revenue.reduce((sum, r) => sum + r.amount, 0);
}

// Million / billion words per official language. Kept here rather than taken from
// Intl's compact notation, whose wording differs between Node and browsers (4.2B vs
// 4.2bn) and so broke hydration.
const NBSP = ' ';
const SCALE_WORDS: Record<string, [million: string, billion: string]> = {
  en: ['m', 'bn'],
  de: [`${NBSP}Mio.`, `${NBSP}Mrd.`],
  nl: [`${NBSP}mln.`, `${NBSP}mld.`],
  sr: [`${NBSP}мил.`, `${NBSP}млрд.`],
  it: [`${NBSP}Mln`, `${NBSP}Mrd`],
};

/** Compact number in the reader's locale: 2.45bn, 2,45 Mrd., 612m. Identical on server and client. */
export function compactNumber(n: number, intl = 'en-GB'): string {
  if (n < 1e6) return Math.round(n).toLocaleString(intl);
  const [million, billion] = SCALE_WORDS[intl.split('-')[0]] ?? SCALE_WORDS.en;
  const big = n >= 1e9;
  const scaled = (n / (big ? 1e9 : 1e6)).toLocaleString(intl, { maximumFractionDigits: big ? 2 : 1 });
  return `${scaled}${big ? billion : million}`;
}

/** Compact AEY formatting in the reader's locale: 2.45bn AEY, 2,45 Mrd. AEY, 612m AEY. */
export function compactAey(amount: number, intl = 'en-GB'): string {
  return `${compactNumber(amount, intl)} AEY`;
}

export function monthLabel(ym: string, intl = 'en-GB'): string {
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(intl, { month: 'short', year: '2-digit', timeZone: 'UTC' });
}
