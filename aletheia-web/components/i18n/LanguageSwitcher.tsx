'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { LOCALES, LOCALE_META, type Locale } from '@/lib/i18n/config';
import { useSwitchLocale } from '@/lib/i18n/navigation';
import { useI18n } from '@/components/i18n/I18nProvider';

/** Compact dropdown for the dark sovereign ribbon. */
export function LanguageMenu() {
  const { locale, t } = useI18n();
  const switchTo = useSwitchLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('Choose language')}
        className="flex items-center gap-1 hover:text-[#C49A4E] transition-colors uppercase"
      >
        <Globe className="w-2.5 h-2.5" /> {locale} <ChevronDown className="w-2 h-2" />
      </button>
      {open && (
        <ul role="listbox" aria-label={t('Languages')} className="absolute right-0 top-full mt-1 w-48 bg-[#0E1B31] border border-[#C49A4E]/30 shadow-2xl z-50 animate-fade-in">
          <li className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-[#C49A4E]/50 border-b border-white/10">
            {t('5 Languages')}
          </li>
          {LOCALES.map((l) => (
            <li key={l} role="option" aria-selected={l === locale}>
              <button
                type="button"
                lang={LOCALE_META[l].intl}
                onClick={() => { setOpen(false); if (l !== locale) switchTo(l); }}
                className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center justify-between ${
                  l === locale ? 'text-[#C49A4E] bg-white/5' : 'text-white/60 hover:text-[#C49A4E] hover:bg-white/5'
                }`}
              >
                <span>
                  {LOCALE_META[l].native}
                  {l === 'en' && <span className="text-white/35"> · {t('working language')}</span>}
                </span>
                {l === locale && <Check className="w-3 h-3" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Inline list of the five languages (footer, mobile drawer). */
export function LanguageLinks({ tone = 'dark', onSwitch }: { tone?: 'dark' | 'light'; onSwitch?: () => void }) {
  const { locale, t } = useI18n();
  const switchTo = useSwitchLocale();
  const idle = tone === 'dark' ? 'text-parchment/55 hover:text-gold' : 'text-[#15294A]/55 hover:text-[#15294A]';
  const active = tone === 'dark' ? 'text-parchment font-semibold' : 'text-[#15294A] font-bold';

  return (
    <nav aria-label={t('Languages')} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {LOCALES.map((l: Locale, i) => (
        <span key={l} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden="true" className="opacity-40">•</span>}
          <button
            type="button"
            lang={LOCALE_META[l].intl}
            aria-current={l === locale ? 'true' : undefined}
            onClick={() => { onSwitch?.(); if (l !== locale) switchTo(l); }}
            className={`transition-colors ${l === locale ? active : idle}`}
          >
            {LOCALE_META[l].native}
          </button>
        </span>
      ))}
    </nav>
  );
}
