import type { NationalStatus } from '@/lib/status';

/** Covenant Development Bond tranches shown on /invest and published as information memoranda. */
export interface BondTranche {
  id: string;
  name: string;
  purpose: string;
  yieldPct: string;
  tenor: string;
  coupon: string;
  status: NationalStatus;
  minSub: string;
}

export const BOND_TRANCHES: BondTranche[] = [
  {
    id: 'sdb-2029',
    name: 'Sovereign Development Bond 2029 (Series A)',
    purpose: 'St. Brendan Deepwater Port & Logistics Terminal Phase 1',
    yieldPct: '4.85%',
    tenor: '3 Years (Maturity 2029)',
    coupon: 'Semi-Annual in EUR / AEY',
    status: 'Operational',
    minSub: '50,000 AEY',
  },
  {
    id: 'sdb-2031',
    name: 'Green Maritime Energy Bond 2031 (Series B)',
    purpose: 'Offshore Floating Wind Turbine Array & Subsea Interconnector',
    yieldPct: '5.40%',
    tenor: '5 Years (Maturity 2031)',
    coupon: 'Quarterly in EUR / AEY',
    status: 'Under Development',
    minSub: '100,000 AEY',
  },
  {
    id: 'sdb-2036',
    name: 'Antioch Concentric Capital Civic Bond 2036 (Series C)',
    purpose: 'Federal District Civil Infrastructure, Assembly Hall & Fiber Grid',
    yieldPct: '6.15%',
    tenor: '10 Years (Maturity 2036)',
    coupon: 'Annual in EUR / AEY',
    status: 'Planned',
    minSub: '250,000 AEY',
  },
];

export function getBond(id: string): BondTranche | undefined {
  return BOND_TRANCHES.find((b) => b.id === id);
}
