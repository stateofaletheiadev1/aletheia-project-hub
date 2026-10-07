import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/routes';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/portal', '/admin', '/officer', '/login'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
