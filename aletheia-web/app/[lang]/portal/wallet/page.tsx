'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';
import { api, reload, setCached, useApi } from '@/lib/client/api';
import { day, ME, shortHash } from '@/lib/auth';
import {
  CreditCard,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  X,
} from 'lucide-react';

interface Wallet {
  balance: number;
  address: string;
  transactions: { id: string; type: 'Credit' | 'Debit'; description: string; amount: number; date: string; hash: string }[];
}

const PATH = '/api/portal/wallet';

export default function PortalAeyWalletPage() {
  const { t, tx, intl } = useI18n();
  const { data } = useApi<Wallet>(PATH);
  const money = (n: number) => n.toLocaleString(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const balance = money(data?.balance ?? 0);
  const transactions = data?.transactions ?? [];
  const [sendModal, setSendModal] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ transfer: { reference: string; amount: number }; wallet: Wallet }>('/api/portal/wallet/transfers', { body: { recipient, amount: Number(amount), memo } });
      setCached(PATH, r.wallet);
      await reload(ME);
      setSendModal(false);
      setRecipient('');
      setAmount('');
      setMemo('');
      setNotice(t('Transfer of {amount} AEY completed ({reference}).', { amount: money(r.transfer.amount), reference: r.transfer.reference }));
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('The transfer failed.'));
    }
    setBusy(false);
  };

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy">{t("Aletheian Guilder (AEY) Wallet")}</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{t("1 AEY = 1.00 EUR (100% Reserve Parity)")}</span>
            </div>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Fixed-fee transaction rails governed by Aletheian Reserve Bank Invariants § 12")}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSendModal(true)}
              className="px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-gold" />
              <span>{t("Send AEY Payment")}</span>
            </button>
          </div>
        </div>

        {tx(notice && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-sm text-xs font-mono text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{tx(notice)}</span>
          </div>
        ))}

        {/* Balance Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="md:col-span-2 p-6 rounded-sm text-parchment relative overflow-hidden shadow-lg"
            style={{ background: 'linear-gradient(135deg, #0E1B31 0%, #15294A 100%)' }}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono text-gold uppercase tracking-wider block">{t("Available Spendable Balance")}</span>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-parchment mt-1">
                  {tx(balance)} <span className="text-gold text-xl">{t("AEY")}</span>
                </div>
                <div className="text-xs text-parchment/60 font-mono mt-1">{t('Wallet ID: {id}', { id: data?.address ?? '' })}</div>
              </div>

              <div className="p-3 rounded-full bg-navy border border-gold/40 text-gold shadow-md">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gold/20 flex flex-wrap items-center justify-between text-xs font-mono text-parchment/60 gap-3">
              <span>{t("Transfers between portal accounts settle immediately in the national registry.")}</span>
            </div>
          </div>

          <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("How AEY reaches your wallet")}</h3>
            <p className="text-xs text-navy/60 font-sans leading-relaxed">{t("Other account holders can send you AEY using your Aletheia ID. Every transfer is recorded with a SHA-256 fingerprint in both wallets.")}</p>
          </div>
        </div>

        {/* Transaction History Table */}
        <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
          <div className="flex items-center justify-between border-b border-navy/10 pb-3">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Recent Settlement Ledger")}</h3>
            <span className="text-[11px] font-mono text-navy/40">{t('{count} entries', { count: transactions.length })}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-navy/40 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2">{t("Description")}</th>
                  <th className="py-2">{t("Date")}</th>
                  <th className="py-2">{t("Fingerprint")}</th>
                  <th className="py-2 text-right">{t("Amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-navy/[0.01]">
                    <td className="py-3 font-medium text-navy flex items-center gap-2">
                      {tx(txn.type === 'Credit' ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-navy/50 shrink-0" />
                      ))}
                      <span>{tx(txn.description)}</span>
                    </td>
                    <td className="py-3 text-navy/50">{day(txn.date, intl)}</td>
                    <td className="py-3 text-gold" translate="no" data-i18n-skip="">{shortHash(txn.hash)}</td>
                    <td
                      className={`py-3 text-right font-bold ${
                        txn.type === 'Credit' ? 'text-emerald-700' : 'text-navy'
                      }`}
                    >
                      {txn.type === 'Credit' ? '+' : '-'}{money(txn.amount)} AEY
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tx(transactions.length === 0 && <p className="py-8 text-center text-xs text-navy/50">{t("No transactions yet.")}</p>)}
          </div>
        </div>

        {/* Send Modal */}
        {tx(sendModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleSend}
              className="w-full max-w-md rounded-sm bg-white p-6 space-y-4 shadow-2xl border border-navy/15 font-mono text-xs"
            >
              <div className="flex items-center justify-between border-b border-navy/10 pb-3">
                <span className="font-bold text-navy text-sm font-sans">{t("Send AEY Transfer")}</span>
                <button onClick={() => setSendModal(false)} type="button" className="text-navy/40 hover:text-navy">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-navy/60 block">{t("Recipient Aletheia ID")}</label>
                <input
                  type="text"
                  required
                  placeholder={t("e.g. ALE-ID-2026-000002")}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full px-3 py-2 bg-parchment-light border border-navy/20 rounded-sm text-navy focus:outline-none focus:border-gold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-navy/60 block">{t("Amount (AEY)")}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-parchment-light border border-navy/20 rounded-sm text-navy focus:outline-none focus:border-gold font-bold text-sm"
                />
              </div>

              <div className="p-3 rounded-sm bg-parchment-light text-[11px] text-navy/60 space-y-1">
                <div className="flex justify-between">
                  <span>{t("Fee:")}</span>
                  <span className="text-emerald-700 font-bold">{t("0.00 AEY")}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("Available:")}</span>
                  <span className="text-navy font-bold">{balance} AEY</span>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="wallet-memo" className="text-[10px] uppercase tracking-wider text-navy/60 block">{t("Reference (optional)")}</label>
                <input id="wallet-memo" type="text" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full px-3 py-2 bg-parchment-light border border-navy/20 rounded-sm text-navy focus:outline-none focus:border-gold" />
              </div>

              {tx(error && <p role="alert" className="text-xs font-semibold text-red-700 font-sans">{tx(error)}</p>)}

              <div className="flex justify-end gap-2 pt-2 border-t border-navy/10">
                <button
                  type="button"
                  onClick={() => setSendModal(false)}
                  className="px-3 py-1.5 bg-white border border-navy/20 text-navy text-xs rounded-sm hover:bg-navy/5"
                >{t("Cancel")}</button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep"
                  disabled={busy}
                >{t("Authorize Payment")}</button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
