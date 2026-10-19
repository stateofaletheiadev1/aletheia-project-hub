/**
 * Typed JSON-LD builders. The Bank is an `Organization` with a description that says it is
 * proposed; financial-institution types are deliberately not used.
 */
import { SITE } from '$lib/content/site';
import type { Faq } from '$lib/content/schema';
import { canonical, SITE_URL } from './meta';

export type JsonLd = Record<string, unknown>;

export interface Crumb {
	href: string;
	label: string;
}

/** Serialises for a <script> element: `<` is escaped so content cannot close the tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
	return JSON.stringify(data).replace(/</g, '\\u003c');
}

const state = {
	'@type': 'GovernmentOrganization',
	name: SITE.state,
	url: SITE.stateUrl
};

export function organization(): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': `${SITE_URL}/#organization`,
		name: SITE.name,
		url: `${SITE_URL}/`,
		logo: `${SITE_URL}/logo.png`,
		description: SITE.description,
		parentOrganization: state
	};
}

export function website(): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': `${SITE_URL}/#website`,
		name: SITE.name,
		url: `${SITE_URL}/`,
		inLanguage: 'en-GB',
		publisher: { '@id': `${SITE_URL}/#organization` }
	};
}

export function breadcrumbList(crumbs: Crumb[]): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((c, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: c.label,
			item: canonical(c.href)
		}))
	};
}

export function faqPage(items: Faq[]): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items.map((f) => ({
			'@type': 'Question',
			name: f.question,
			acceptedAnswer: { '@type': 'Answer', text: f.answer.join('\n\n') }
		}))
	};
}

export function collectionPage(name: string, path: string, description: string): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name,
		url: canonical(path),
		description,
		isPartOf: { '@id': `${SITE_URL}/#website` }
	};
}

export function article(opts: {
	type: 'Article' | 'Report' | 'NewsArticle';
	headline: string;
	path: string;
	description: string;
	publishedAt: string;
	modifiedAt?: string;
	image?: string;
}): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': opts.type,
		headline: opts.headline,
		url: canonical(opts.path),
		description: opts.description,
		datePublished: opts.publishedAt,
		dateModified: opts.modifiedAt ?? opts.publishedAt,
		inLanguage: 'en-GB',
		image: opts.image ? canonical(opts.image) : undefined,
		author: { '@id': `${SITE_URL}/#organization` },
		publisher: { '@id': `${SITE_URL}/#organization` }
	};
}

export function imageObject(opts: { url: string; name: string; caption: string }): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'ImageObject',
		contentUrl: canonical(opts.url),
		name: opts.name,
		caption: opts.caption,
		creditText: SITE.state
	};
}
