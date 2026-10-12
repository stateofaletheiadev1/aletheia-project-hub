'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React, { useState } from 'react';
import Link from '@/components/i18n/Link';
import { PortalShell } from '@/components/layout/PortalShell';
import { Download, Plus, X } from 'lucide-react';
import { api, reload, useApi } from '@/lib/client/api';
import { day, ME, type CompanyRecord, type PortalAccount } from '@/lib/auth';

const PATH = '/api/portal/companies';
const STRUCTURES: CompanyRecord['structure'][] = ['SARL (Limited)', 'AG (Corporation)', 'Maritime Trust'];
const EMPTY = { name: '', structure: STRUCTURES[0], shareCapital: '', beneficialOwners: '', purpose: '' };

export default function PortalMyCompaniesPage() {
  const { t, tx, intl } = useI18n();
  const me = useApi<{ account: PortalAccount }>(ME);
  const { data, loading } = useApi<{ companies: CompanyRecord[] }>(PATH);
  const companies = data?.companies ?? [];
  const eligible = me.data?.account.status === 'e-resident' || me.data?.account.status === 'citizen';
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const startNew = () => { setForm(EMPTY); setEditing({ id: null }); setError(null); };
  const startAmend = (c: CompanyRecord) => {
    setForm({ name: c.name, structure: c.structure, shareCapital: String(c.shareCapital), beneficialOwners: c.beneficialOwners, purpose: c.purpose });
    setEditing({ id: c.id });
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...form, shareCapital: Number(form.shareCapital) };
      if (editing?.id) await api(`${PATH}/${editing.id}`, { method: 'PUT', body });
      else await api(PATH, { body });
      setNotice(editing?.id ? t('Your amended filing is back with the Registrar.') : t('Your formation has been filed with the Registrar of Companies.'));
      setEditing(null);
      await Promise.all([reload(PATH), reload('/api/portal/dashboard')]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('The filing could not be saved.'));
    }
    setBusy(false);
  };

  const active = companies.filter((c) => c.status === 'Active / Chartered').length;
  const input = 'w-full px-3 py-2 text-xs border border-navy/20 rounded-sm focus:outline-none focus:border-navy bg-white text-navy';

  return (
    <PortalShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy">{t("My Sovereign Entities")}</h1>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{t('{count} ACTIVE', { count: active })}</span>
            </div>
            <p className="text-[12px] text-navy/50 mt-0.5">{t("Corporate entities registered under the Covenant Commercial Code with 0% corporate tax")}</p>
          </div>
          {tx(eligible ? (
            <button type="button" onClick={startNew} className="px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-gold" />
              <span>{t("Incorporate New Entity")}</span>
            </button>
          ) : (
            <Link href="/portal/apply" className="px-3.5 py-1.5 bg-navy text-parchment text-xs font-semibold rounded-sm hover:bg-navy-deep transition-colors">{t("Apply for e-residency to form a company")}</Link>
          ))}
        </div>

        {tx(notice && <p role="status" className="p-3 text-xs rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-200">{tx(notice)}</p>)}

        {tx(editing && (
          <form onSubmit={submit} className="p-6 rounded-sm bg-white border border-gold/40 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy">{editing.id ? t("Amend your filing") : t("Form a new company")}</h2>
              <button type="button" aria-label={t("Close")} onClick={() => setEditing(null)} className="text-navy/40 hover:text-navy"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1 block text-[11px] font-bold text-navy uppercase tracking-wider">{t("Company name")}
                <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
              </label>
              <label className="space-y-1 block text-[11px] font-bold text-navy uppercase tracking-wider">{t("Legal form")}
                <select value={form.structure} onChange={(e) => setForm({ ...form, structure: e.target.value as CompanyRecord['structure'] })} className={input}>
                  {STRUCTURES.map((s) => <option key={s} value={s}>{tx(s)}</option>)}
                </select>
              </label>
              <label className="space-y-1 block text-[11px] font-bold text-navy uppercase tracking-wider">{t("Share capital (AEY)")}
                <input required type="number" min={1} step="0.01" value={form.shareCapital} onChange={(e) => setForm({ ...form, shareCapital: e.target.value })} className={input} />
              </label>
              <label className="space-y-1 block text-[11px] font-bold text-navy uppercase tracking-wider">{t("Beneficial owners and shares")}
                <input required maxLength={500} placeholder={t("e.g. Ada King (60%), C. Babbage (40%)")} value={form.beneficialOwners} onChange={(e) => setForm({ ...form, beneficialOwners: e.target.value })} className={input} />
              </label>
            </div>
            <label className="space-y-1 block text-[11px] font-bold text-navy uppercase tracking-wider">{t("Business purpose")}
              <textarea required maxLength={500} rows={3} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={input} />
            </label>
            {tx(error && <p role="alert" className="text-xs font-semibold text-red-700">{tx(error)}</p>)}
            <button type="submit" disabled={busy} className="px-5 py-2 bg-gold text-navy text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-gold-tint disabled:opacity-50">{editing.id ? t("Refile") : t("File with the Registrar")}</button>
          </form>
        ))}

        {tx(!loading && companies.length === 0 && !editing && (
          <p className="p-6 rounded-sm bg-white border border-navy/10 text-sm text-navy/60">{t("You have not registered a company yet.")}</p>
        ))}

        {companies.map((c) => (
          <div key={c.id} className="p-6 rounded-sm bg-white border border-navy/10 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-sm bg-navy text-gold flex items-center justify-center font-bold text-lg" translate="no">
                  {c.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-navy">{tx(c.name)}</h2>
                    <span className={`px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold border ${c.status === 'Active / Chartered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'Changes Requested' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{tx(c.status.toUpperCase())}</span>
                  </div>
                  <p className="text-xs text-navy/50 font-mono">{t('Registration # {reg}', { reg: c.regNumber })} · {tx(c.structure)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {tx(c.status === 'Active / Chartered' && (
                  <Link href="/portal/documents" className="px-3 py-1.5 bg-parchment-light border border-navy/15 text-navy text-xs font-semibold rounded-sm hover:border-gold transition-colors flex items-center gap-1">
                    <Download className="w-3 h-3 text-gold" />
                    <span>{t("Charter")}</span>
                  </Link>
                ))}
                {tx(c.status === 'Changes Requested' && (
                  <button type="button" onClick={() => startAmend(c)} className="px-3 py-1.5 bg-gold text-navy text-xs font-bold rounded-sm">{t("Amend and refile")}</button>
                ))}
              </div>
            </div>

            {tx(c.note && c.status === 'Changes Requested' && (
              <p className="text-xs p-3 rounded-sm bg-red-50 border border-red-200 text-red-800">{t('Registrar: {note}', { note: c.note })}</p>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
              {[
                ['Share Capital', `${c.shareCapital.toLocaleString(intl, { minimumFractionDigits: 2 })} AEY`],
                ['Founder', c.founder],
                ['Beneficial Owners', c.beneficialOwners],
                [c.decidedAt ? 'Decided' : 'Filed', day(c.decidedAt ?? c.submittedAt, intl)],
              ].map(([k, v]) => (
                <div key={k} className="p-4 rounded-sm bg-parchment-light border border-navy/5 space-y-1">
                  <span className="text-[10px] text-navy/40 uppercase block">{tx(k)}</span>
                  <span className="text-navy font-bold text-sm break-words">{tx(v)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">{t("Authorized Business Scope")}</h3>
              <p className="text-xs text-navy/70 leading-relaxed font-sans">{tx(c.purpose)}</p>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
