import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/routes';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private surfaces, with and without a language prefix.
      disallow: ['/portal', '/admin', '/officer', '/login', '/*/portal', '/*/admin', '/*/officer', '/*/login', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
