/**
 * National registry & revenue figures shown on /registry.
 *
 * Until the live registry API is connected, these are DEMONSTRATION figures and
 * the page says so. To go live, replace `getRegistrySnapshot()` with a fetch
 * from the registry service; the shape of `RegistrySnapshot` is the contract.
 */

export interface RegistrySnapshot {
  asOf: string;
  /** 'demonstration' until the live registry feed is connected. */
  source: 'demonstration' | 'live';
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
  asOf: '2026-09-30',
  source: 'demonstration',
  registrations: {
    eResidents: 12_480,
    eResidencyApplicationsPending: 1_936,
    companies: 3_150,
    citizens: { founding: 412, investor: 1_214, naturalised: 0, covenantAward: 37 },
    residencyInterest: 6_310,
  },
  revenue: [
    { id: 'endowment', label: 'Founding endowment capital', amount: 1_500_000_000, note: 'Initial capital of the Covenant Endowment' },
    { id: 'bonds', label: 'Covenant Development Bonds', amount: 612_000_000, note: 'Subscriptions to infrastructure bonds' },
    { id: 'investor', label: 'Covenant Investor contributions', amount: 303_500_000, note: 'National Development Contributions' },
    { id: 'registry', label: 'Company registry fees', amount: 15_750_000, note: 'Incorporations and annual licences' },
    { id: 'concessions', label: 'Port & energy concessions', amount: 12_510_000, note: 'Concession fees, St. Brendan & Benedict' },
    { id: 'eresidency', label: 'E-residency fees', amount: 6_240_000, note: '500 AEY per e-resident per year' },
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
    { month: '2025-10', eResidents: 420, citizens: 38 },
    { month: '2025-11', eResidents: 510, citizens: 44 },
    { month: '2025-12', eResidents: 580, citizens: 51 },
    { month: '2026-01', eResidents: 760, citizens: 72 },
    { month: '2026-02', eResidents: 840, citizens: 80 },
    { month: '2026-03', eResidents: 910, citizens: 96 },
    { month: '2026-04', eResidents: 1_020, citizens: 104 },
    { month: '2026-05', eResidents: 1_140, citizens: 118 },
    { month: '2026-06', eResidents: 1_260, citizens: 131 },
    { month: '2026-07', eResidents: 1_390, citizens: 142 },
    { month: '2026-08', eResidents: 1_510, citizens: 160 },
    { month: '2026-09', eResidents: 1_640, citizens: 174 },
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

/** Compact AEY formatting: 2.45B AEY, 612M AEY, 6.2M AEY. */
export function compactAey(amount: number): string {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2).replace(/\.?0+$/, '')}B AEY`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(1).replace(/\.0$/, '')}M AEY`;
  return `${amount.toLocaleString('en-GB')} AEY`;
}

export function monthLabel(ym: string): string {
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}
