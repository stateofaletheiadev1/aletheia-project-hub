'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { useEffect } from 'react';
import Link from '@/components/i18n/Link';
import { RotateCcw, ShieldAlert } from 'lucide-react';

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t, tx } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="guilloche-hero relative overflow-hidden text-parchment min-h-[70vh] flex items-center">
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-7">
        <div className="w-16 h-16 mx-auto rounded-full border border-gold/40 bg-navy-deep/70 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-gold" />
        </div>
        <div className="space-y-3">
          <p className="text-[11px] font-bold tracking-[0.3em] uppercase text-gold">{t("Service interruption")}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t("Something went wrong on our side.")}</h1>
          <p className="text-parchment/70 leading-relaxed font-light">{t("The incident has been logged. You can retry, or return to the homepage.")}{tx(error.digest && <span className="block mt-2 font-mono text-xs text-parchment/45">{t("Reference:")}{' '}{tx(error.digest)}</span>)}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="btn-sovereign-gold inline-flex items-center gap-2 px-7 py-3.5 rounded-sm text-sm">
            <RotateCcw className="w-4 h-4" />{' '}{t("Try again")}</button>
          <Link href="/" className="btn-sovereign-ghost px-7 py-3.5 rounded-sm text-sm">{t("Homepage")}</Link>
        </div>
      </div>
    </section>
  );
}
