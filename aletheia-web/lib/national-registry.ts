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
  /** Funds raised to date, in AEY (1 AEY = 1 EUR). */
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
    { id: 'eresidency', label: 'E-residency fees', amount: 0, note: '500 AEY per e-resident per year' },
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

/** Compact AEY formatting in the reader's locale: 2.45B AEY, 2,45 Mrd. AEY, 612M AEY. */
export function compactAey(amount: number, intl = 'en-GB'): string {
  if (amount < 1e6) return `${amount.toLocaleString(intl)} AEY`;
  const compact = new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: amount >= 1e9 ? 2 : 1 }).format(amount);
  return `${compact} AEY`;
}

export function monthLabel(ym: string, intl = 'en-GB'): string {
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(intl, { month: 'short', year: '2-digit', timeZone: 'UTC' });
}
