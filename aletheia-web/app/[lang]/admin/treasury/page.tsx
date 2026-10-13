'use client';

import React, { useState } from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { api, reload, useApi } from '@/lib/client/api';
import { OFFICER_ME, shortHash, type OfficerProfile } from '@/lib/auth';
import { fmtDate, ListState, Notice } from '@/components/admin/Notice';
import { Landmark } from 'lucide-react';

interface Issuance {
  id: string;
  reference: string;
  recipient: string;
  amount: number;
  reason: string | null;
  issuedBy: string | null;
  state: string;
  createdAt: string;
  hash: string;
}

const PATH = '/api/admin/treasury';
const field = 'w-full px-3 py-2 bg-navy-deep border border-gold/25 rounded-sm text-parchment focus:outline-none focus:border-gold';
const aey = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AdminTreasuryPage() {
  const me = useApi<{ officer: OfficerProfile }>(OFFICER_ME);
  const isAdmin = me.data?.officer.isAdministrator;
  const { data, error, loading } = useApi<{ issuances: Issuance[]; total: number }>(isAdmin ? PATH : null);
  const [form, setForm] = useState({ recipient: '', amount: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`Issue ${form.amount} AEY to ${form.recipient}? This creates new money and cannot be undone.`)) return;
    setBusy(true);
    try {
      const r = await api<{ issuance: { reference: string; amount: number } }>(PATH, { body: { ...form, amount: Number(form.amount) } });
      setNotice({ ok: true, text: `${r.issuance.reference}: ${aey(r.issuance.amount)} AEY issued to ${form.recipient}.` });
      setForm({ recipient: '', amount: '', reason: '' });
      await reload(PATH);
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'The issuance failed.' });
    }
    setBusy(false);
  };

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-parchment">Treasury Issuance</h1>
          <p className="text-[12px] text-parchment/50 font-mono mt-0.5">New AEY enters portal wallets only here: administrators, with a stated reason, every issuance audited</p>
        </div>

        {me.data && !isAdmin && <p className="text-xs font-mono text-parchment/50">Only administrators can issue AEY or see issuances.</p>}

        {isAdmin && (
          <>
            <Notice notice={notice} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form onSubmit={submit} className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-3 font-mono text-xs">
                <h3 className="text-xs font-bold text-parchment uppercase tracking-wider flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-gold" /> Issue AEY
                </h3>
                <input required aria-label="Recipient Aletheia ID" placeholder="Recipient Aletheia ID (ALE-ID-…)" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} className={field} />
                <input required aria-label="Amount (AEY)" type="number" min="0.01" step="0.01" placeholder="Amount (AEY)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={field} />
                <textarea required aria-label="Reason" minLength={5} maxLength={300} rows={3} placeholder="Reason (e.g. decree or programme reference)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={field} />
                <button type="submit" disabled={busy} className="w-full px-4 py-2.5 bg-gold text-navy font-bold rounded-sm hover:bg-gold-tint disabled:opacity-50">Issue</button>
              </form>

              <div className="lg:col-span-2 p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-parchment uppercase tracking-wider">Issuances</h3>
                  <span className="text-gold font-bold">Total issued: {aey(data?.total ?? 0)} AEY</span>
                </div>
                <ListState loading={loading} error={error} empty={(data?.issuances ?? []).length === 0} emptyText="No AEY has been issued yet." />
                <div className="divide-y divide-white/5">
                  {(data?.issuances ?? []).map((i) => (
                    <div key={i.id} className="py-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <span className="text-gold font-bold">{i.reference}</span>
                      <span className="text-parchment">{i.recipient}</span>
                      <span className="text-parchment font-bold">{aey(i.amount)} AEY</span>
                      <span className="text-parchment/50">{fmtDate(i.createdAt)} · {i.issuedBy}</span>
                      <span className="text-parchment/40" title={i.hash}>{shortHash(i.hash)}</span>
                      <span className="col-span-full text-parchment/60">{i.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
