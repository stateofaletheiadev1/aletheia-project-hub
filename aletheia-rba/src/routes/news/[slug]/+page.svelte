<script lang="ts">
	import Prose from '$lib/components/editorial/Prose.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import { longDate } from '$lib/components/publications/format';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { news } from '$lib/content';
	import { article } from '$lib/seo/jsonld';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const entry = $derived(news.find((n) => n.meta.slug === data.slug));
	const meta = $derived(entry?.meta);
	const Body = $derived(entry?.component);
</script>

{#if meta && Body}
	<Seo
		title={meta.title}
		description={meta.summary}
		path="/news/{meta.slug}"
		type="article"
		ogImage={meta.ogImage}
		publishedAt={meta.publishedAt}
		modifiedAt={meta.updatedAt}
		jsonLd={[
			article({
				type: 'NewsArticle',
				headline: meta.title,
				path: `/news/${meta.slug}`,
				description: meta.summary,
				publishedAt: meta.publishedAt,
				modifiedAt: meta.updatedAt,
				image: meta.ogImage
			})
		]}
	/>

	<PageHead
		trail={[
			{ href: '/news', label: 'News' },
			{ href: `/news/${meta.slug}`, label: meta.title }
		]}
		eyebrow={meta.category}
		title={meta.title}
		seed={41}
	>
		{#snippet lead()}
			<p>
				<time datetime={meta.publishedAt}>{longDate(meta.publishedAt)}</time>{#if meta.updatedAt}
					· updated <time datetime={meta.updatedAt}>{longDate(meta.updatedAt)}</time>{/if}
			</p>
		{/snippet}
	</PageHead>

	<article class="section surface-parchment">
		<div class="container">
			<Prose>
				<p class="t-lead">{meta.summary}</p>
				<Body />
			</Prose>
		</div>
	</article>

	<RelatedLinks
		links={[
			{ href: '/news', label: 'All notices' },
			{ href: '/publications', label: 'Publications' }
		]}
	/>
{/if}
