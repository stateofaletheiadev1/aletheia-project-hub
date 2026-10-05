/**
 * The five official languages of the Sovereign Covenant State (Constitution Art. 2).
 * English is the working language and the default, served without a URL prefix;
 * the others live under /de, /nl, /sr and /it.
 */

export const LOCALES = ['en', 'de', 'nl', 'sr', 'it'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie remembering an explicit language choice. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const LOCALE_META: Record<Locale, { native: string; english: string; intl: string; ogLocale: string }> = {
  en: { native: 'English', english: 'English', intl: 'en-GB', ogLocale: 'en_GB' },
  de: { native: 'Deutsch', english: 'German', intl: 'de-DE', ogLocale: 'de_DE' },
  nl: { native: 'Nederlands', english: 'Dutch', intl: 'nl-NL', ogLocale: 'nl_NL' },
  sr: { native: 'Српски', english: 'Serbian', intl: 'sr-Cyrl-RS', ogLocale: 'sr_RS' },
  it: { native: 'Italiano', english: 'Italian', intl: 'it-IT', ogLocale: 'it_IT' },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Paths that are never localised (files, PDFs, metadata routes). */
export function isUnlocalisedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/pdf') ||
    pathname.startsWith('/_next') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

/** "/de/citizenship" → { locale: 'de', path: '/citizenship' }; "/citizenship" → en. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const seg = pathname.split('/')[1];
  if (isLocale(seg) && seg !== DEFAULT_LOCALE) {
    const rest = pathname.slice(seg.length + 1);
    return { locale: seg, path: rest || '/' };
  }
  if (seg === DEFAULT_LOCALE) {
    const rest = pathname.slice(3);
    return { locale: DEFAULT_LOCALE, path: rest || '/' };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || '/' };
}

/** Prefixes an internal href with the locale (English stays unprefixed). */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//') || locale === DEFAULT_LOCALE) return href;
  const [pathAndQuery, hash] = href.split('#');
  const [path] = pathAndQuery.split('?');
  if (isUnlocalisedPath(path)) return href;
  if (splitLocale(path).locale !== DEFAULT_LOCALE) return href;
  const prefixed = `/${locale}${pathAndQuery === '/' ? '' : pathAndQuery}`;
  return hash !== undefined ? `${prefixed || `/${locale}`}#${hash}` : prefixed;
}
