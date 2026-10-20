import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/lib/i18n/config';
import { CONSOLE_DOMAIN, CONSOLE_PREFIX, SITE_DOMAIN } from '@/lib/hosts';
import { applicationsOpen } from '@/lib/features';

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

// The officer console on its own address (lib/hosts.ts): on stateofaletheia.org, /admin,
// /officer and /api/admin live only on adss.oiss.stateofaletheia.org; the main site sends those
// there and the console's address sends everything else back. Automatic on those domains;
// elsewhere one address serves everything. ADMIN_HOST overrides the console's address
// (ADMIN_HOST=off: no split).
const CONSOLE_PAGE = /^\/(?:(?:de|nl|sr|it|en)\/)?(?:admin|officer)(?:\/|$)/;

/** A permanent redirect to another address, written out in full (NextResponse.redirect may shorten it). */
function crossSite(location: string): NextResponse {
  return new NextResponse(null, { status: 308, headers: { location } });
}

function hostSplit(request: NextRequest): NextResponse | null {
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').split(',')[0].trim().toLowerCase().split(':')[0];
  const override = (process.env.ADMIN_HOST ?? '').trim().toLowerCase();
  if (override === 'off') return null;
  const base = host.replace(/^www\./, '').replace(CONSOLE_PREFIX, '');
  const adminHost = override || (base === SITE_DOMAIN ? CONSOLE_DOMAIN : '');
  if (!adminHost) return null;
  const site = process.env.PUBLIC_SITE_URL || `https://${SITE_DOMAIN}`;

  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const consoleApi = pathname.startsWith('/api/admin/');
  const consolePage = CONSOLE_PAGE.test(pathname);

  if (host === adminHost) {
    if (isApi) return consoleApi ? NextResponse.next() : new NextResponse(null, { status: 404 });
    if (pathname === '/') return NextResponse.redirect(new URL('/admin/login', request.url), 307);
    if (consolePage) return null; // carry on with locale handling below
    // Anything public opened on the console's address belongs to the main site.
    return crossSite(new URL(pathname + search, site).toString());
  }
  if (consoleApi) return new NextResponse(null, { status: 404 });
  if (consolePage) return crossSite(`https://${adminHost}${pathname}${search}`);
  return isApi ? NextResponse.next() : null;
}

export function proxy(request: NextRequest) {
  // The portal API takes applications and identity documents: closed in the founding phase.
  if (request.nextUrl.pathname.startsWith('/api/portal/') && !applicationsOpen()) {
    return NextResponse.json({ error: 'Applications are closed. Aletheia does not accept applications in its founding phase.' }, { status: 403 });
  }
  const split = hostSplit(request);
  if (split) return split;
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/api/')) return NextResponse.next();
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
  // Everything except Next internals, the API, PDFs, metadata routes and files with an extension;
  // plus the portal and console APIs, so each stays on its own address.
  matcher: ['/((?!_next|api|pdf|sitemap\\.xml|robots\\.txt|.*\\.[a-zA-Z0-9]+$).*)', '/api/admin/:path*', '/api/portal/:path*'],
};

