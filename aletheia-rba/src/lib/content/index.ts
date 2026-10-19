/**
 * All site content, parsed with Zod when this module loads. Because every page is prerendered,
 * an invalid entry fails the build. Drafts are dropped from production builds.
 */
import { dev } from '$app/environment';
import type { Component } from 'svelte';
import { z } from 'zod';
import { banknotes as rawBanknotes } from './banknotes';
import { faq as rawFaq } from './faq';
import { Banknote, Faq, NewsArticle, Publication, StatusItem } from './schema';
import { statusLedger as rawLedger } from './status-ledger';

export { CONTACT, FOOTER_NAV, LEGAL_NAV, PRIMARY_NAV, SITE, UTILITY_NAV, isGroup } from './site';
export { faqGroups } from './faq';
export { STATUS, STATUS_KEYS, type StatusKey } from './status';

function parseAll<T extends z.ZodType>(schema: T, items: unknown[], label: string): z.infer<T>[] {
	return items.map((item, i) => {
		const result = schema.safeParse(item);
		if (!result.success) {
			throw new Error(`Invalid ${label} entry #${i + 1}:\n${z.prettifyError(result.error)}`);
		}
		return result.data;
	});
}

function unique<T>(items: T[], key: (item: T) => string, label: string): T[] {
	const seen = new Set<string>();
	for (const item of items) {
		const k = key(item);
		if (seen.has(k)) throw new Error(`Duplicate ${label}: ${k}`);
		seen.add(k);
	}
	return items;
}

export const banknotes = unique(
	parseAll(Banknote, rawBanknotes, 'banknote'),
	(b) => String(b.denomination),
	'banknote denomination'
).sort((a, b) => a.denomination - b.denomination);

export const statusLedger = unique(
	parseAll(StatusItem, rawLedger, 'status ledger'),
	(s) => s.id,
	'status item id'
);

export const faq = unique(parseAll(Faq, rawFaq, 'FAQ'), (f) => f.id, 'FAQ id');

/* Markdown documents: frontmatter is validated, the body is an mdsvex component. */

interface MarkdownModule {
	default: Component;
	metadata?: Record<string, unknown>;
}

function slugOf(path: string): string {
	return path.split('/').pop()?.replace(/\.md$/, '') ?? path;
}

function loadMarkdown<T extends z.ZodType>(
	modules: Record<string, MarkdownModule>,
	schema: T,
	label: string
) {
	return Object.entries(modules).map(([path, mod]) => {
		const slug = slugOf(path);
		const result = schema.safeParse({ slug, ...mod.metadata });
		if (!result.success) {
			throw new Error(`Invalid ${label} frontmatter in ${path}:\n${z.prettifyError(result.error)}`);
		}
		const meta = result.data as z.infer<T> & { slug: string };
		if (meta.slug !== slug) throw new Error(`${path}: slug must match the file name`);
		return { meta, component: mod.default };
	});
}

const byDateDesc = (a: { meta: { publishedAt: string } }, b: { meta: { publishedAt: string } }) =>
	b.meta.publishedAt.localeCompare(a.meta.publishedAt);

export const publications = loadMarkdown(
	import.meta.glob<MarkdownModule>('./publications/*.md', { eager: true }),
	Publication,
	'publication'
)
	.filter((p) => dev || p.meta.status !== 'draft')
	.sort(byDateDesc);

export const news = loadMarkdown(
	import.meta.glob<MarkdownModule>('./news/*.md', { eager: true }),
	NewsArticle,
	'news'
)
	.filter((n) => dev || !n.meta.draft)
	.sort(byDateDesc);

export type PublicationEntry = (typeof publications)[number];
export type NewsEntry = (typeof news)[number];
