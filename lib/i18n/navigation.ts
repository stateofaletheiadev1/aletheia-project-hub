'use client';

import { useCallback } from 'react';
import { usePathname as useNextPathname, useRouter as useNextRouter } from 'next/navigation';
import { LOCALE_COOKIE, localizeHref, splitLocale, type Locale } from '@/lib/i18n/config';
import { useI18n } from '@/components/i18n/I18nProvider';

/** The current path without its locale prefix ("/de/portal" → "/portal"). */
export function usePathname(): string {
  return splitLocale(useNextPathname() ?? '/').path;
}

/** next/navigation's router, with push/replace keeping the current language. */
export function useRouter() {
  const router = useNextRouter();
  const { locale } = useI18n();
  return {
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localizeHref(href, locale), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(localizeHref(href, locale), options),
  };
}

/** Switches language on the current page and remembers the choice. */
export function useSwitchLocale() {
  const router = useNextRouter();
  const path = usePathname();
  return useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      const hash = window.location.hash;
      router.push(localizeHref(path, next) + window.location.search + hash);
    },
    [router, path],
  );
}
