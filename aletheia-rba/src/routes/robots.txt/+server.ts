import { INDEXABLE, SITE_URL } from '$lib/seo/meta';

export const prerender = true;

/** Production allows all and points at the sitemap; previews disallow everything. */
export function GET() {
	const body = INDEXABLE
		? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
		: `User-agent: *\nDisallow: /\n`;
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
