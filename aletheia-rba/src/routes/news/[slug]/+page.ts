import { error } from '@sveltejs/kit';
import { news } from '$lib/content';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => news.map((n) => ({ slug: n.meta.slug }));

export const load: PageLoad = ({ params }) => {
	const entry = news.find((n) => n.meta.slug === params.slug);
	if (!entry) error(404, 'Not found');
	return { slug: entry.meta.slug };
};
