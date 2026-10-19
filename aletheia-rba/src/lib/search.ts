/** Client-side search over build/search-index.json. Pure, so it can be unit-tested. */

export interface IndexedPage {
	url: string;
	title: string;
	description: string;
	headings: string[];
	text: string;
}

export interface Hit {
	page: IndexedPage;
	score: number;
	excerpt: string;
}

const normalise = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function terms(query: string): string[] {
	return normalise(query)
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length > 1);
}

function excerptFor(text: string, words: string[]): string {
	const lower = normalise(text);
	const at = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0));
	if (!Number.isFinite(at)) return text.slice(0, 160);
	const start = Math.max(0, at - 60);
	return `${start > 0 ? '…' : ''}${text.slice(start, start + 180).trim()}…`;
}

/** Every term must appear somewhere; titles weigh most, then headings, description and text. */
export function search(index: IndexedPage[], query: string, limit = 20): Hit[] {
	const words = terms(query);
	if (!words.length) return [];
	const hits: Hit[] = [];
	for (const page of index) {
		const title = normalise(page.title);
		const headings = normalise(page.headings.join(' '));
		const description = normalise(page.description);
		const text = normalise(page.text);
		let score = 0;
		let all = true;
		for (const w of words) {
			const s =
				(title.includes(w) ? 8 : 0) +
				(headings.includes(w) ? 4 : 0) +
				(description.includes(w) ? 2 : 0) +
				(text.includes(w) ? 1 : 0);
			if (s === 0) all = false;
			score += s;
		}
		if (all) hits.push({ page, score, excerpt: excerptFor(page.description || page.text, words) });
	}
	return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
