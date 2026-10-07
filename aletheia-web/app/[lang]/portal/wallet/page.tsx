'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import { PortalShell } from '@/components/layout/PortalShell';
import {
  CreditCard,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  X,
} from 'lucide-react';

interface Transaction {
  id: string;
  type: 'Credit' | 'Debit';
  description: string;
  amount: string;
  date: string;
  hash: string;
}

const TRANSACTIONS: Transaction[] = [
  {
    id: 'TX-901',
    type: 'Credit',
    description: 'Quarterly Sovereign Development Bond Coupon',
    amount: '+240.00 AEY',
    date: '2026-10-02',
    hash: '0xfa12...9901',
  },
  {
    id: 'TX-900',
    type: 'Debit',
    description: 'Antioch Municipal Platform Berth Retainer',
    amount: '-150.00 AEY',
    date: '2026-09-28',
    hash: '0x88c1...e014',
  },
  {
    id: 'TX-899',
    type: 'Credit',
    description: 'Inward Settlement from Kaelen Vance Marine Ltd',
    amount: '+4,500.00 AEY',
    date: '2026-09-15',
    hash: '0x33b9...aa82',
  },
  {
    id: 'TX-898',
    type: 'Debit',
    description: 'E-Residency 3-Year Statutory Registration Fee',
    amount: '-100.00 AEY',
    date: '2026-09-01',
    hash: '0x0012...771e',
  },
];

export default function PortalAeyWalletPage() {
  const { t, tx, intl } = useI18n();
  const [balance, setBalance] = useState('12,400.00');
  const [transactions, setTransactions] = useState(TRANSACTIONS);
  const [sendModal, setSendModal] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    const num = Number(amount);
    const newBal = (Number(balance.replace(',', '')) - num).toFixed(2);
    setBalance(Number(newBal).toLocaleString('en-US', { minimumFractionDigits: 2 }));
    setTransactions([
      {
        id: `TX-${Math.floor(Math.random() * 900) + 100}`,
        type: 'Debit',
        description: t('Direct transfer to {recipient}', { recipient: `${recipient.slice(0, 10)}...` }),
        amount: `-${num.toFixed(2)} AEY`,
        date: 'Just now',
        hash: '0x' + Math.random().toString(16).slice(2, 10) + '...',
      },
      ...transactions,
    ]);
    setSendModal(false);
    setRecipient('');
    setAmount('');
    setNotice(t('Transfer of {amount} AEY confirmed on StableChain.', { amount: num.toLocaleString(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
    setTimeout(() => setNotice(null), 4000);
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
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Zero-gas transaction rails governed by Central Bank Reserve Invariants § 12")}</p>
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
                <div className="text-xs text-parchment/60 font-mono mt-1">
                  ≈ €{tx(balance)}{' '}{t("EUR Guaranteed Parity")}</div>
              </div>

              <div className="p-3 rounded-full bg-navy border border-gold/40 text-gold shadow-md">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gold/20 flex flex-wrap items-center justify-between text-xs font-mono text-parchment/60 gap-3">
              <span>{t("Settlement Slot Time:")}{' '}<strong>{t("500 ms")}</strong></span>
              <span>{t("Gas Volatility:")}{' '}<strong>{t("Zero Gas Fee")}</strong></span>
              <span className="text-emerald-400">{t("Reserve Backing:")}{' '}<strong>100%</strong></span>
            </div>
          </div>

          <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Bond Portfolio Holdings")}</h3>
            <div>
              <div className="text-xl font-bold font-mono text-navy">{t("25,000.00 AEY")}</div>
              <div className="text-[11px] text-navy/50 font-mono">{t("SDB Tranche 2026-A (4.2% Yield)")}</div>
            </div>
            <div className="pt-2 border-t border-navy/5 text-xs text-navy/60 font-sans leading-relaxed">{t("Next quarterly coupon distribution scheduled for")}{' '}<strong>2027-01-02</strong>.
            </div>
          </div>
        </div>

        {/* Transaction History Table */}
        <div className="p-6 rounded-sm bg-white border border-navy/10 space-y-4">
          <div className="flex items-center justify-between border-b border-navy/10 pb-3">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Recent Settlement Ledger")}</h3>
            <span className="text-[11px] font-mono text-navy/40">{t("Real-Time Consensus")}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-navy/40 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2">{t("Description")}</th>
                  <th className="py-2">{t("Date")}</th>
                  <th className="py-2">{t("Transaction Hash")}</th>
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
                    <td className="py-3 text-navy/50">{tx(txn.date)}</td>
                    <td className="py-3 text-gold">{tx(txn.hash)}</td>
                    <td
                      className={`py-3 text-right font-bold ${
                        txn.type === 'Credit' ? 'text-emerald-700' : 'text-navy'
                      }`}
                    >
                      {tx(txn.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <label className="text-[10px] uppercase tracking-wider text-navy/60 block">{t("Recipient DID or AEY Address")}</label>
                <input
                  type="text"
                  required
                  placeholder={t("did:aletheia:0x... or 0x...")}
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
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-parchment-light border border-navy/20 rounded-sm text-navy focus:outline-none focus:border-gold font-bold text-sm"
                />
              </div>

              <div className="p-3 rounded-sm bg-parchment-light text-[11px] text-navy/60 space-y-1">
                <div className="flex justify-between">
                  <span>{t("Network Gas Fee:")}</span>
                  <span className="text-emerald-700 font-bold">{t("0.00 AEY (Subsidized)")}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("Settlement Guarantee:")}</span>
                  <span className="text-navy font-bold">{t("500ms DAG Finality")}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-navy/10">
                <button
                  type="button"
                  onClick={() => setSendModal(false)}
                  className="px-3 py-1.5 bg-white border border-navy/20 text-navy text-xs rounded-sm hover:bg-navy/5"
                >{t("Cancel")}</button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep"
                >{t("Authorize Payment")}</button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
