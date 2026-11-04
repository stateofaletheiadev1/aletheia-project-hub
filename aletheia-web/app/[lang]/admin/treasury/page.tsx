'use client';

import { AdminShell } from '@/components/layout/AdminShell';
import { useApi } from '@/lib/client/api';
import { OFFICER_ME, shortHash, type OfficerProfile } from '@/lib/auth';
import { fmtDate, ListState } from '@/components/admin/Notice';
import { explorerUrl } from '@/lib/stablechain';
import { Landmark } from 'lucide-react';

interface Supply {
  asset: string;
  height?: number;
  issuedTotal?: string;
  circulating?: string;
  locked?: string;
  burnedTotal?: string;
  unavailable?: boolean;
}

interface Issuance {
  id: string;
  reference: string;
  recipient: string;
  amount: number;
  reason: string | null;
  issuedBy: string | null;
  createdAt: string;
  hash: string;
}

const PATH = '/api/admin/treasury';
const DECIMALS: Record<string, number> = { AEY: 18, ALnT: 3 };

/** Base units → grouped decimal text, exactly (no floating point). */
function units(value: string | undefined, asset: string): string {
  if (value === undefined || !/^\d+$/.test(value)) return '—';
  const decimals = DECIMALS[asset] ?? 0;
  const padded = value.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = decimals ? padded.slice(-decimals).replace(/0+$/, '') : '';
  return fraction ? `${whole}.${fraction}` : whole;
}

export default function AdminTreasuryPage() {
  const me = useApi<{ officer: OfficerProfile }>(OFFICER_ME);
  const isAdmin = me.data?.officer.isAdministrator;
  const { data, error, loading } = useApi<{ supply: Supply[]; archive: { issuances: Issuance[]; total: number } }>(isAdmin ? PATH : null);

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-parchment">Treasury on AletheiaChain</h1>
          <p className="text-[12px] text-parchment/50 font-mono mt-0.5">
            Supply as AletheiaChain Mainnet Beta reports it. AEY is issued only on the chain, by mint authorizations under the Reserve Bank&apos;s monetary authority keys.
          </p>
        </div>

        {me.data && !isAdmin && <p className="text-xs font-mono text-parchment/50">Only administrators can see the Treasury view.</p>}

        {isAdmin && (
          <>
            <ListState loading={loading} error={error} empty={false} emptyText="" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(data?.supply ?? []).map((s) => (
                <div key={s.asset} className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-3 font-mono text-xs">
                  <h3 className="text-xs font-bold text-parchment uppercase tracking-wider flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-gold" /> {s.asset}
                  </h3>
                  {s.unavailable ? (
                    <p className="text-parchment/50">The chain did not return this supply ledger.</p>
                  ) : (
                    <dl className="divide-y divide-white/5">
                      {[
                        ['Issued', s.issuedTotal],
                        ['Circulating', s.circulating],
                        ['Locked', s.locked],
                        ['Burned', s.burnedTotal],
                      ].map(([label, value]) => (
                        <div key={label} className="py-2 flex justify-between gap-4">
                          <dt className="text-parchment/60">{label}</dt>
                          <dd className="text-parchment font-bold">{units(value, s.asset)} {s.asset}</dd>
                        </div>
                      ))}
                      <div className="py-2 flex justify-between gap-4">
                        <dt className="text-parchment/60">As of block</dt>
                        <dd>
                          <a href={explorerUrl.block(s.height ?? 0)} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
                            {(s.height ?? 0).toLocaleString('en-GB')}
                          </a>
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              ))}
            </div>

            <div className="p-5 rounded-sm bg-[#111827] border border-white/10 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-parchment/70 uppercase tracking-wider">Retired portal ledger (read-only)</h3>
                <span className="text-parchment/50">Recorded total: {(data?.archive.total ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-parchment/50">
                Entries the portal recorded before AEY moved to AletheiaChain alone. They are kept as recorded and are not balances on the chain.
              </p>
              <ListState loading={loading} empty={(data?.archive.issuances ?? []).length === 0} emptyText="No entries were recorded." />
              <div className="divide-y divide-white/5">
                {(data?.archive.issuances ?? []).map((i) => (
                  <div key={i.id} className="py-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-parchment/60">
                    <span>{i.reference}</span>
                    <span>{i.recipient}</span>
                    <span>{i.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                    <span>{fmtDate(i.createdAt)} · {i.issuedBy}</span>
                    <span title={i.hash}>{shortHash(i.hash)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
