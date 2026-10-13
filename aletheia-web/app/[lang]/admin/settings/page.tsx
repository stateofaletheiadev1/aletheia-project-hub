'use client';

import React, { useState } from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { api, reload, useApi } from '@/lib/client/api';
import { OFFICER_ME, type OfficerProfile } from '@/lib/auth';
import { fmtDate, Notice } from '@/components/admin/Notice';
import { KeyRound, Lock, UserCheck, UserPlus } from 'lucide-react';

const field = 'w-full px-3 py-2 bg-navy-deep border border-gold/25 rounded-sm text-parchment focus:outline-none focus:border-gold';

export default function AdminSettingsConsolePage() {
  const me = useApi<{ officer: OfficerProfile }>(OFFICER_ME);
  const officer = me.data?.officer;
  const settings = useApi<{ settings: { sessionTimeoutMinutes: number } }>('/api/admin/settings');
  const officers = useApi<{ officers: OfficerProfile[] }>(officer?.isAdministrator ? '/api/admin/officers' : null);
  const [timeoutMinutes, setTimeoutMinutes] = useState<string | null>(null);
  const [pass, setPass] = useState({ current: '', next: '' });
  const [newOfficer, setNewOfficer] = useState({ name: '', email: '', role: 'officer', department: '', clearance: '', badgeNumber: '', temporaryPassphrase: '' });
  const [created, setCreated] = useState<{ id: string; secret: string; uri: string } | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      setNotice({ ok: true, text: await fn() });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'The change could not be saved.' });
    }
    setBusy(false);
  };

  const timeout = timeoutMinutes ?? String(settings.data?.settings.sessionTimeoutMinutes ?? 30);

  return (
    <AdminShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-parchment">Console Administration &amp; Policies</h1>
          <p className="text-[12px] text-parchment/50 font-mono mt-0.5">Your officer profile, session policy, passphrase and officer accounts</p>
        </div>

        <Notice notice={notice} />

        <div className="space-y-6 max-w-2xl font-mono text-xs">
          <div className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-4">
            <h3 className="text-xs font-bold text-parchment uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-gold" />
              <span>Officer Profile &amp; Clearance</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Officer Name', officer?.name],
                ['Officer ID', officer?.id],
                ['Department', officer?.department],
                ['Role', officer?.role],
                ['Clearance', officer?.clearance],
                ['Sign-in method', officer?.tokenType],
              ].map(([k, v]) => (
                <div key={k}>
                  <span className="text-[10px] text-parchment/40 block">{k}</span>
                  <span className="text-parchment font-bold">{v || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api('/api/admin/settings', { method: 'PATCH', body: { sessionTimeoutMinutes: Number(timeout) } });
                await reload('/api/admin/settings');
                return `Officer sessions now end after ${timeout} minutes of inactivity (applies to new sign-ins).`;
              });
            }}
            className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-4"
          >
            <h3 className="text-xs font-bold text-parchment uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-gold" />
              <span>Session Inactivity Timeout</span>
            </h3>
            <label htmlFor="timeout" className="text-[11px] text-parchment/70 block">Automatic console session inactivity timeout</label>
            <select id="timeout" value={timeout} disabled={!officer?.isAdministrator} onChange={(e) => setTimeoutMinutes(e.target.value)} className={field}>
              <option value="15">15 Minutes (High Security Mode)</option>
              <option value="30">30 Minutes (Standard Mandate)</option>
              <option value="60">60 Minutes (Supervisory Shift)</option>
            </select>
            {officer?.isAdministrator ? (
              <button type="submit" disabled={busy} className="px-6 py-2.5 bg-gold text-navy font-bold rounded-sm hover:bg-gold-tint transition-colors text-xs disabled:opacity-50">Save Session Policy</button>
            ) : (
              <p className="text-parchment/40">Only administrators can change the session policy.</p>
            )}
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api('/api/admin/me/passphrase', { body: pass });
                setPass({ current: '', next: '' });
                return 'Passphrase changed. Your other sessions have been signed out.';
              });
            }}
            className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-3"
          >
            <h3 className="text-xs font-bold text-parchment uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-gold" />
              <span>Change Passphrase</span>
            </h3>
            <input type="password" required autoComplete="current-password" placeholder="Current passphrase" aria-label="Current passphrase" value={pass.current} onChange={(e) => setPass({ ...pass, current: e.target.value })} className={field} />
            <input type="password" required minLength={12} autoComplete="new-password" placeholder="New passphrase (12+ characters)" aria-label="New passphrase" value={pass.next} onChange={(e) => setPass({ ...pass, next: e.target.value })} className={field} />
            <button type="submit" disabled={busy} className="px-6 py-2.5 bg-gold text-navy font-bold rounded-sm hover:bg-gold-tint transition-colors text-xs disabled:opacity-50">Change Passphrase</button>
          </form>

          {officer?.isAdministrator && (
            <div className="p-5 rounded-sm bg-[#111827] border border-gold/15 space-y-4">
              <h3 className="text-xs font-bold text-parchment uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-gold" />
                <span>Officer Accounts</span>
              </h3>
              <div className="divide-y divide-white/5">
                {(officers.data?.officers ?? []).map((o) => (
                  <div key={o.officerId} className="py-2 flex items-center justify-between gap-3">
                    <span className={o.disabled ? 'text-parchment/40 line-through' : 'text-parchment'}><strong>{o.id}</strong> · {o.name} · {o.role}</span>
                    <span className="text-parchment/40">last sign-in {fmtDate(o.lastSignInAt)}</span>
                    {o.id !== officer?.id && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api(`/api/admin/officers/${o.id}`, { method: 'PATCH', body: { disabled: !o.disabled } });
                            await reload('/api/admin/officers');
                            return `${o.id} ${o.disabled ? 're-enabled' : 'disabled and signed out'}.`;
                          })
                        }
                        className={`px-2 py-1 rounded-sm border text-[11px] ${o.disabled ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`}
                      >
                        {o.disabled ? 'Enable' : 'Disable'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const r = await api<{ officer: OfficerProfile; totpSecret: string; otpauthUri: string }>('/api/admin/officers', { body: newOfficer });
                    setCreated({ id: r.officer.id, secret: r.totpSecret, uri: r.otpauthUri });
                    setNewOfficer({ name: '', email: '', role: 'officer', department: '', clearance: '', badgeNumber: '', temporaryPassphrase: '' });
                    await reload('/api/admin/officers');
                    return `Officer ${r.officer.id} created.`;
                  });
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"
              >
                <input required placeholder="Full name" aria-label="Full name" value={newOfficer.name} onChange={(e) => setNewOfficer({ ...newOfficer, name: e.target.value })} className={field} />
                <input required type="email" placeholder="Email" aria-label="Email" value={newOfficer.email} onChange={(e) => setNewOfficer({ ...newOfficer, email: e.target.value })} className={field} />
                <input placeholder="Department" aria-label="Department" value={newOfficer.department} onChange={(e) => setNewOfficer({ ...newOfficer, department: e.target.value })} className={field} />
                <input placeholder="Clearance" aria-label="Clearance" value={newOfficer.clearance} onChange={(e) => setNewOfficer({ ...newOfficer, clearance: e.target.value })} className={field} />
                <input placeholder="Badge number" aria-label="Badge number" value={newOfficer.badgeNumber} onChange={(e) => setNewOfficer({ ...newOfficer, badgeNumber: e.target.value })} className={field} />
                <select aria-label="Role" value={newOfficer.role} onChange={(e) => setNewOfficer({ ...newOfficer, role: e.target.value })} className={field}>
                  <option value="officer">Registry Officer</option>
                  <option value="administrator">Administrator</option>
                </select>
                <input required minLength={12} type="text" placeholder="Temporary passphrase (12+ characters)" aria-label="Temporary passphrase" value={newOfficer.temporaryPassphrase} onChange={(e) => setNewOfficer({ ...newOfficer, temporaryPassphrase: e.target.value })} className={`${field} sm:col-span-2`} />
                <button type="submit" disabled={busy} className="sm:col-span-2 px-6 py-2.5 bg-gold text-navy font-bold rounded-sm hover:bg-gold-tint transition-colors text-xs disabled:opacity-50">Create Officer</button>
              </form>
              {created && (
                <div className="p-3 rounded-sm border border-gold/40 bg-navy-deep space-y-1 break-all">
                  <p className="text-gold font-bold">Give these to {created.id} now. The secret is not shown again.</p>
                  <p className="text-parchment">Authenticator secret: <strong>{created.secret}</strong></p>
                  <p className="text-parchment/60">{created.uri}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
