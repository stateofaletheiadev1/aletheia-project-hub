import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES, SITE_URL } from '@/lib/routes';
import { STATUTE_DATABASE } from '@/lib/statutes';
import { GAZETTE_POSTS } from '@/lib/gazette';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = Object.entries(PUBLIC_ROUTES).map(([path, route]) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const statutes = Object.values(STATUTE_DATABASE).map((s) => ({
    url: `${SITE_URL}/laws/${s.slug}`,
    lastModified: new Date(s.date),
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }));

  const gazette = GAZETTE_POSTS.map((p) => ({
    url: `${SITE_URL}/news/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: 'yearly' as const,
    priority: 0.6,
  }));

  return [...pages, ...statutes, ...gazette];
}
