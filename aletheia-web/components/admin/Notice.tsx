'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

/** The one-line result banner the console pages show after an action. */
export function Notice({ notice }: { notice: { ok: boolean; text: string } | null }) {
  if (!notice) return null;
  return (
    <div
      role="status"
      className={`p-3 rounded-sm text-xs font-mono flex items-center gap-2 animate-fadeIn border ${notice.ok ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200' : 'bg-red-950/60 border-red-500/40 text-red-200'}`}
    >
      {notice.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
      <span>{notice.text}</span>
    </div>
  );
}

/** Loading, error and empty states for a console list. */
export function ListState({ loading, error, empty, emptyText }: { loading: boolean; error?: Error; empty: boolean; emptyText: string }) {
  if (error) return <p className="py-10 text-center text-xs font-mono text-red-300">{error.message}</p>;
  if (loading && empty) return <p className="py-10 text-center text-xs font-mono text-parchment/40">Loading…</p>;
  if (empty) return <p className="py-10 text-center text-xs font-mono text-parchment/40">{emptyText}</p>;
  return null;
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
