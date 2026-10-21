'use client';

import { Printer } from 'lucide-react';

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-5 py-2.5 bg-navy-deep/80 backdrop-blur-sm border border-gold/35 text-parchment hover:text-gold hover:border-gold/60 rounded-sm flex items-center gap-2 transition-all text-xs font-semibold uppercase tracking-wider focus-visible:outline-2 focus-visible:outline-gold"
    >
      <Printer className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
