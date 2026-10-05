import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES, SITE_URL, languageAlternates } from '@/lib/routes';
import { STATUTE_DATABASE } from '@/lib/statutes';
import { GAZETTE_POSTS } from '@/lib/gazette';
import { LOCALES, localizeHref } from '@/lib/i18n/config';

type Entry = MetadataRoute.Sitemap[number];

/** One entry per page per official language, each listing its translations. */
function localized(path: string, base: Omit<Entry, 'url' | 'alternates'>): Entry[] {
  const languages = Object.fromEntries(
    Object.entries(languageAlternates(path)).map(([lang, href]) => [lang, `${SITE_URL}${href === '/' ? '' : href}`]),
  );
  return LOCALES.map((locale) => {
    const href = localizeHref(path, locale);
    return { ...base, url: `${SITE_URL}${href === '/' ? '' : href}`, alternates: { languages } };
  });
}

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = Object.entries(PUBLIC_ROUTES).flatMap(([path, route]) =>
    localized(path, { changeFrequency: route.changeFrequency, priority: route.priority }),
  );
  const statutes = Object.values(STATUTE_DATABASE).flatMap((s) =>
    localized(`/laws/${s.slug}`, { lastModified: new Date(s.date), changeFrequency: 'yearly', priority: 0.5 }),
  );
  const gazette = GAZETTE_POSTS.flatMap((p) =>
    localized(`/news/${p.slug}`, { lastModified: new Date(p.date), changeFrequency: 'yearly', priority: 0.6 }),
  );
  return [...pages, ...statutes, ...gazette];
}
