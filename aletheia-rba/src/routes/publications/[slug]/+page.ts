import { error } from '@sveltejs/kit';
import { publications } from '$lib/content';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => publications.map((p) => ({ slug: p.meta.slug }));

export const load: PageLoad = ({ params }) => {
	const entry = publications.find((p) => p.meta.slug === params.slug);
	if (!entry) error(404, 'Not found');
	return { slug: entry.meta.slug };
};
