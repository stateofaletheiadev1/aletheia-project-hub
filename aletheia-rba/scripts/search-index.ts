/**
 * Builds build/search-index.json from the prerendered pages, after `vite build`. The index holds
 * each page's title, description, headings and main text, so search covers exactly what is
 * published. No external service is involved.
 *
 * Usage: tsx scripts/search-index.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { visibleText } from './claims-rules.ts';

const root = 'build';
const SKIP = new Set(['404.html', 'search.html']);

function pages(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === '_app' ? [] : pages(path);
		return name.endsWith('.html') && !SKIP.has(relative(root, path)) ? [path] : [];
	});
}

const decode = (s: string) => visibleText(s).trim();
const first = (html: string, re: RegExp) => decode(re.exec(html)?.[1] ?? '');

const index = pages(root)
	.map((file) => {
		const html = readFileSync(file, 'utf8');
		const rel = relative(root, file)
			.split(sep)
			.join('/')
			.replace(/\.html$/, '');
		const url = rel === 'index' ? '/' : `/${rel}`;
		const main = /<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1] ?? '';
		const headings = [...main.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/g)]
			.map((m) => decode(m[1] ?? ''))
			.filter(Boolean);
		return {
			url,
			title: first(html, /<title>([\s\S]*?)<\/title>/).replace(/ · Reserve Bank of Aletheia$/, ''),
			description: decode(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? ''),
			headings,
			text: decode(main).slice(0, 4000)
		};
	})
	.filter((p) => p.title)
	.sort((a, b) => a.url.localeCompare(b.url));

writeFileSync(join(root, 'search-index.json'), JSON.stringify(index));
console.log(`search-index.json: ${index.length} pages`);
