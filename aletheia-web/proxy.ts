import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/lib/i18n/config';

/** Picks the best supported language from Accept-Language ("de-AT,de;q=0.9,en;q=0.8" → de). */
function negotiate(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 };
    })
    .filter((x) => x.lang && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split('/')[1];

  // /en/... is the default language: canonicalise to the unprefixed URL.
  if (first === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || '/';
    const res = NextResponse.redirect(url, 308);
    res.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return res;
  }

  // Already localised (/de, /nl, /sr, /it): serve as is.
  if (isLocale(first)) return NextResponse.next();

  // Unprefixed: honour an explicit choice, else the browser's languages on first visit.
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const preferred = isLocale(cookie) ? cookie : negotiate(request.headers.get('accept-language'));

  if (preferred !== DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url, 307);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  // Everything except Next internals, the API, PDFs, metadata routes and files with an extension.
  matcher: ['/((?!_next|api|pdf|sitemap\\.xml|robots\\.txt|.*\\.[a-zA-Z0-9]+$).*)'],
};

