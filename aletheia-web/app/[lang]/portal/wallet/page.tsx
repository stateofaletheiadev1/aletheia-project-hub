'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';
import { api, reload, setCached, useApi } from '@/lib/client/api';
import { ME } from '@/lib/auth';
import { WALLET } from '@/lib/stablechain';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Link2, ShieldCheck } from 'lucide-react';

/** The person's AletheiaChain account, as /api/portal/wallet reads it from the chain. */
type View =
  | { linked: false; network: string }
  | {
      linked: true;
      network: string;
      address: string;
      explorer: string;
      height: number;
      balances: { asset: string; available: string; locked: string; display: string | null }[];
      transactions: {
        txId: string;
        direction: 'in' | 'out' | 'self';
        counterparty: string;
        asset: string;
        amount: string;
        display: string | null;
        status: 'finalized' | 'failed';
        height: number;
        explorer: string;
      }[];
      more: boolean;
    };

const PATH = '/api/portal/wallet';
const short = (id: string) => (id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id);

/** The node's display text with trailing zeros dropped; never rounded. */
const amount = (display: string | null, units: string) => (display ?? units).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

export default function PortalChainAccountPage() {
  const { t, intl } = useI18n();
  const { data, error, loading } = useApi<View>(PATH);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async (next: string | null) => {
    setBusy(true);
    setProblem(null);
    try {
      const view = await api<View>(PATH, { method: 'PUT', body: { address: next } });
      setCached(PATH, view);
      await reload(ME);
      setAddress('');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : t('The address could not be linked.'));
    }
    setBusy(false);
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-navy">{t('AletheiaChain account')}</h1>
          <p className="text-[12px] text-navy/50 mt-0.5">{t('Your balances and transfers, read from AletheiaChain Mainnet Beta. The portal holds no money and never sees your keys.')}</p>
        </div>

        {error && <p className="p-3 bg-red-50 border border-red-200 rounded-sm text-xs text-red-800">{error.message}</p>}
        {loading && !data && <p className="text-xs text-navy/50">{t('Reading AletheiaChain…')}</p>}

        {data && !data.linked && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save(address);
              }}
              className="md:col-span-2 p-6 rounded-sm bg-white border border-navy/10 space-y-4"
            >
              <h2 className="text-sm font-bold text-navy flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gold" />
                {t('Link your AletheiaChain address')}
              </h2>
              <p className="text-xs text-navy/60 leading-relaxed">{t('Paste the address your wallet shows (alt: followed by 40 characters). AletheiaChain checks it before it is linked.')}</p>
              <label htmlFor="chain-address" className="sr-only">{t('AletheiaChain address')}</label>
              <input
                id="chain-address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="alt:…"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 border border-navy/20 rounded-sm font-mono text-xs focus:outline-none focus:border-navy"
              />
              {problem && <p className="text-xs text-red-700">{problem}</p>}
              <button type="submit" disabled={busy || !address.trim()} className="px-4 py-2 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep disabled:opacity-50">
                {busy ? t('Checking with AletheiaChain…') : t('Link address')}
              </button>
            </form>
            <WalletNote />
          </div>
        )}

        {data && data.linked && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 p-6 rounded-sm text-parchment shadow-lg bg-navy space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono text-gold uppercase tracking-wider block">{data.network}</span>
                    <a href={data.explorer} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-parchment/80 hover:text-gold break-all" translate="no">
                      {data.address}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                  <button type="button" onClick={() => void save(null)} disabled={busy} className="text-[11px] text-parchment/60 underline underline-offset-2 hover:text-parchment">
                    {t('Unlink')}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.balances.map((b) => (
                    <div key={b.asset} className="border-t border-gold/20 pt-3">
                      <span className="text-[10px] font-mono text-gold uppercase tracking-wider">{b.asset}</span>
                      <div className="text-2xl font-extrabold font-mono mt-1">
                        {amount(b.display, b.available)} <span className="text-gold text-sm">{b.asset}</span>
                      </div>
                      {b.locked !== '0' && <div className="text-[11px] text-parchment/60 font-mono">{t('Locked: {units} base units', { units: b.locked })}</div>}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-parchment/50 font-mono">{t('As of finalized block {height}', { height: data.height.toLocaleString(intl) })}</p>
              </div>
              <WalletNote />
            </div>

            <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
              <div className="flex items-center justify-between border-b border-navy/10 pb-3">
                <h2 className="text-xs font-bold text-navy uppercase tracking-wider">{t('Finalized transfers')}</h2>
                <a href={data.explorer} target="_blank" rel="noopener noreferrer" className="text-[11px] text-navy/60 hover:text-navy inline-flex items-center gap-1">
                  {t('Full history on the explorer')}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {data.transactions.length === 0 ? (
                <p className="py-6 text-center text-xs text-navy/50">{t('No transfers on this account yet.')}</p>
              ) : (
                <ul className="divide-y divide-navy/5">
                  {data.transactions.map((tx) => (
                    <li key={tx.txId} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 min-w-0">
                        {tx.direction === 'in' ? <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" /> : <ArrowUpRight className="w-4 h-4 text-navy/60 shrink-0" />}
                        <span className="text-navy/70">{tx.direction === 'in' ? t('From') : t('To')}</span>
                        <span className="font-mono text-navy" translate="no" title={tx.counterparty}>{short(tx.counterparty)}</span>
                      </span>
                      <span className={`font-mono font-bold ${tx.direction === 'in' ? 'text-emerald-700' : 'text-navy'}`}>
                        {tx.direction === 'in' ? '+' : '−'}
                        {amount(tx.display, tx.amount)} {tx.asset}
                      </span>
                      <span className={tx.status === 'failed' ? 'text-red-700' : 'text-navy/50'}>
                        {tx.status === 'failed' ? t('Failed on chain') : t('Finalized at block {height}', { height: tx.height.toLocaleString(intl) })}
                      </span>
                      <a href={tx.explorer} target="_blank" rel="noopener noreferrer" className="font-mono text-navy/50 hover:text-navy" translate="no" title={tx.txId}>
                        {short(tx.txId)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

function WalletNote() {
  const { t } = useI18n();
  return (
    <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-3">
      <h3 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-gold" />
        {t('Sending and receiving')}
      </h3>
      <p className="text-xs text-navy/60 leading-relaxed">{t('AEY and ALnT move only on AletheiaChain, signed in your own wallet. Aletheia Wallet keeps your keys in your browser; no one else, the State included, can move your funds.')}</p>
      {WALLET.live && (
        <a href={WALLET.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:text-gold">
          {t('Open Aletheia Wallet')}
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
