import { news, SITE } from '$lib/content';
import { canonical } from '$lib/seo/meta';

export const prerender = true;

const escape = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** RSS 2.0 feed of news and notices. Linked from pages only once there is at least one item. */
export function GET() {
	const items = news
		.map(
			(n) => `\t\t<item>
			<title>${escape(n.meta.title)}</title>
			<link>${canonical(`/news/${n.meta.slug}`)}</link>
			<guid>${canonical(`/news/${n.meta.slug}`)}</guid>
			<pubDate>${new Date(`${n.meta.publishedAt}T00:00:00Z`).toUTCString()}</pubDate>
			<description>${escape(n.meta.summary)}</description>
		</item>`
		)
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel>
		<title>${escape(SITE.name)}: News and notices</title>
		<link>${canonical('/news')}</link>
		<description>Announcements and notices from the ${escape(SITE.name)}.</description>
		<language>en-gb</language>
${items}
	</channel>
</rss>
`;
	return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
