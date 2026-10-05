'use client';

import { Download, Printer } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export function StatuteActions({ code }: { code: string }) {
  const { notify } = useToast();
  return (
    <div className="flex gap-2" data-print-hide>
      <button
        type="button"
        onClick={() => window.print()}
        className="px-3 py-1.5 border border-navy/20 text-navy font-semibold rounded-sm hover:border-gold hover:text-gold transition-colors flex items-center gap-1.5"
      >
        <Printer className="w-3.5 h-3.5" /> Print
      </button>
      <button
        type="button"
        onClick={() =>
          notify(
            `${code}: signed edition`,
            'Cryptographically signed PDF editions are issued through the Official Gazette registry. Use Print for a faithful copy today.',
            'info',
          )
        }
        className="px-3 py-1.5 bg-navy text-gold font-bold uppercase tracking-wider rounded-sm hover:bg-navy-deep transition-colors flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" /> Official PDF
      </button>
    </div>
  );
}
