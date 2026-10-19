import { news, publications, statusLedger } from '$lib/content';
import { canonical } from '$lib/seo/meta';

export const prerender = true;

/** Static routes with the date their content last changed (the status ledger date by default). */
const LEDGER_DATE =
	statusLedger
		.map((s) => s.statusAsOf)
		.sort()
		.at(-1) ?? '2026-10-19';

const STATIC_ROUTES = [
	'/',
	'/about',
	'/monetary-policy',
	'/explained',
	'/financial-stability',
	'/payments',
	'/statistics',
	'/fraud-warning',
	'/currency',
	'/banknotes',
	'/issuance',
	'/reserves',
	'/publications',
	'/news',
	'/faq',
	'/contact',
	'/privacy',
	'/terms',
	'/accessibility'
];

export function GET() {
	const entries = [
		...STATIC_ROUTES.map((path) => ({ path, lastmod: LEDGER_DATE })),
		...publications.map((p) => ({
			path: `/publications/${p.meta.slug}`,
			lastmod: p.meta.updatedAt ?? p.meta.publishedAt
		})),
		...news.map((n) => ({
			path: `/news/${n.meta.slug}`,
			lastmod: n.meta.updatedAt ?? n.meta.publishedAt
		}))
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `\t<url><loc>${canonical(e.path)}</loc><lastmod>${e.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
	return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
