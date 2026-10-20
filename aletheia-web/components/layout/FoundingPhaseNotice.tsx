'use client';

import { useSyncExternalStore } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import Link from '@/components/i18n/Link';
import { X } from 'lucide-react';

export const FOUNDING_PHASE_STATEMENT =
  'Aletheia is a new-country project in its founding phase. It is not a recognised state, holds no territory, exercises no legal authority, and issues no passports, legal currency or citizenship.';

const KEY = 'aletheia:founding-notice-dismissed';
const listeners = new Set<() => void>();
// Falls back to memory when storage is blocked, so dismissal still works for the visit.
let dismissedInMemory = false;

function readDismissed(): boolean {
  if (dismissedInMemory) return true;
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismiss() {
  dismissedInMemory = true;
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage unavailable: the in-memory flag covers this visit.
  }
  listeners.forEach((l) => l());
}

/** The founding-phase statement and its link, shared by the banner and the footer. */
export function FoundingPhaseStatement({ linkClassName = '' }: { linkClassName?: string }) {
  const { t } = useI18n();
  return (
    <>
      {t(FOUNDING_PHASE_STATEMENT)}{' '}
      <Link href="/transparency" className={`underline underline-offset-2 whitespace-nowrap font-semibold ${linkClassName}`}>
        {t('Read our status & disclaimers →')}
      </Link>
    </>
  );
}

/** Slim banner at the top of every public page, dismissible for the session. */
export function FoundingPhaseBanner() {
  const { t } = useI18n();
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false);
  if (dismissed) return null;

  return (
    <div role="region" aria-label={t('Founding-phase notice')} className="w-full bg-[#F4EEDF] border-b border-[#C49A4E]/45 text-[#15294A]">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-start sm:items-center gap-3">
        <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#C49A4E] shrink-0" aria-hidden="true" />
        <p className="flex-1 text-[11.5px] leading-snug">
          <FoundingPhaseStatement linkClassName="text-[#8F5800] hover:text-[#15294A]" />
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('Dismiss this notice for this visit')}
          className="shrink-0 p-1 -m-1 rounded-sm text-[#15294A]/60 hover:text-[#15294A] hover:bg-[#15294A]/5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
