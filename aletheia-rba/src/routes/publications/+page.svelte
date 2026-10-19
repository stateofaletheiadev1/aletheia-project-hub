<script lang="ts">
	import { browser } from '$app/environment';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import { CATEGORY_LABELS } from '$lib/components/publications/format';
	import PublicationEntry from '$lib/components/publications/PublicationEntry.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { publications } from '$lib/content';
	import type { PublicationCategory } from '$lib/content/schema';
	import { collectionPage } from '$lib/seo/jsonld';

	const DESCRIPTION =
		'Monetary policy statements, currency notices, consultations, reports and other documents published by the Reserve Bank of Aletheia.';

	// Filters live in the URL. The page is static, so they apply in the browser; without JS the
	// full register is shown.
	// Empty while prerendering, where search params are unavailable.
	const params = $derived(browser ? page.url.searchParams : new SvelteURLSearchParams());
	const category = $derived(params.get('category') ?? '');
	const year = $derived(params.get('year') ?? '');
	let query = $state('');

	const categories = $derived([
		...new Set(publications.map((p) => p.meta.category))
	] as PublicationCategory[]);
	const years = $derived(
		[...new Set(publications.map((p) => p.meta.publishedAt.slice(0, 4)))].sort().reverse()
	);

	const filtered = $derived(
		publications.filter(
			(p) =>
				(!category || p.meta.category === category) &&
				(!year || p.meta.publishedAt.startsWith(year)) &&
				(!query || `${p.meta.title} ${p.meta.summary}`.toLowerCase().includes(query.toLowerCase()))
		)
	);

	function onFilterChange(e: Event) {
		const form = (e.currentTarget as HTMLSelectElement).form;
		if (!form) return;
		const data = new FormData(form);
		const next = new SvelteURLSearchParams();
		for (const key of ['category', 'year']) {
			const v = data.get(key);
			if (typeof v === 'string' && v) next.set(key, v);
		}
		goto(`?${next}`, { keepFocus: true, noScroll: true, replaceState: true });
	}
</script>

<Seo
	title="Publications"
	description={DESCRIPTION}
	path="/publications"
	ogImage="/og/publications.png"
	jsonLd={[collectionPage('Publications', '/publications', DESCRIPTION)]}
/>

<PageHead
	trail={[{ href: '/publications', label: 'Publications' }]}
	folio="§ 11"
	eyebrow="Publications"
	title="The written record."
	seed={29}
>
	{#snippet lead()}
		<p>Documents published by the Bank.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="register-title">
	<div class="container">
		<SectionHeader folio="§ 11.1" eyebrow="Register" title="All publications" id="register-title" />

		{#if publications.length === 0}
			<EmptyState title="Forthcoming" seed={29}>
				<p>Publications of the Bank will appear here.</p>
			</EmptyState>
		{:else}
			<form method="get" class="filters" aria-label="Filter publications">
				<label>
					<span class="t-meta">Category</span>
					<select name="category" value={category} onchange={onFilterChange}>
						<option value="">All categories</option>
						{#each categories as c (c)}
							<option value={c}>{CATEGORY_LABELS[c]}</option>
						{/each}
					</select>
				</label>
				<label>
					<span class="t-meta">Year</span>
					<select name="year" value={year} onchange={onFilterChange}>
						<option value="">All years</option>
						{#each years as y (y)}
							<option value={y}>{y}</option>
						{/each}
					</select>
				</label>
				{#if publications.length >= 10}
					<label class="search">
						<span class="t-meta">Search</span>
						<input type="search" bind:value={query} placeholder="Title or summary" />
					</label>
				{/if}
				<noscript><button type="submit">Apply</button></noscript>
			</form>

			<p class="count t-fine" aria-live="polite">
				{filtered.length} of {publications.length} publications
			</p>
			<ol role="list" class="list">
				{#each filtered as p (p.meta.slug)}
					<li><PublicationEntry meta={p.meta} /></li>
				{/each}
			</ol>
		{/if}
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/news', label: 'News and notices' },
		{ href: '/about', label: 'About the Bank' }
	]}
/>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4) var(--space-6);
		align-items: end;
		padding-bottom: var(--space-5);
	}

	.filters label {
		display: grid;
		gap: var(--space-2);
	}

	.filters span {
		color: var(--fg-muted);
	}

	select,
	input {
		min-height: 44px;
		padding: var(--space-2) var(--space-3);
		border: var(--hairline) solid var(--rule-strong);
		border-radius: var(--radius-control);
		background: var(--c-parchment-50);
		min-width: 12rem;
	}

	.count {
		margin-bottom: var(--space-2);
	}

	.list {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}
</style>
