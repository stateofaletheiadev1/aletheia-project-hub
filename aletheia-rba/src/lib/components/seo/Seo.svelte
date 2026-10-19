<script lang="ts">
	import { SITE } from '$lib/content/site';
	import type { JsonLd as JsonLdData } from '$lib/seo/jsonld';
	import { canonical, INDEXABLE, pageTitle } from '$lib/seo/meta';
	import JsonLd from './JsonLd.svelte';

	/** Every route renders this once. Previews (non-production builds) are never indexed. */
	let {
		title,
		description,
		path,
		ogImage = '/og/default.png',
		ogImageAlt = 'Reserve Bank of Aletheia',
		type = 'website',
		publishedAt,
		modifiedAt,
		noindex = false,
		jsonLd = []
	}: {
		title: string;
		description: string;
		path: string;
		ogImage?: string;
		ogImageAlt?: string;
		type?: 'website' | 'article';
		publishedAt?: string;
		modifiedAt?: string;
		noindex?: boolean;
		jsonLd?: JsonLdData[];
	} = $props();

	const fullTitle = $derived(pageTitle(title));
	const url = $derived(canonical(path));
	const image = $derived(canonical(ogImage));
	const robots = $derived(noindex || !INDEXABLE ? 'noindex, nofollow' : 'index, follow');
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta name="robots" content={robots} />

	<meta property="og:site_name" content={SITE.name} />
	<meta property="og:locale" content={SITE.locale} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={ogImageAlt} />
	{#if type === 'article' && publishedAt}
		<meta property="article:published_time" content={publishedAt} />
		<meta property="article:modified_time" content={modifiedAt ?? publishedAt} />
	{/if}

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>

{#if jsonLd.length}
	<JsonLd data={jsonLd} />
{/if}
