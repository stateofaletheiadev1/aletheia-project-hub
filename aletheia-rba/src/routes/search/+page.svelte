<script lang="ts">
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { search, type IndexedPage } from '$lib/search';

	let query = $state('');
	let index = $state<IndexedPage[] | null>(null);
	let failed = $state(false);

	const hits = $derived(index && query.trim() ? search(index, query) : []);

	$effect(() => {
		if (!browser) return;
		query = new URL(location.href).searchParams.get('q') ?? '';
		fetch('/search-index.json')
			.then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
			.then((data: IndexedPage[]) => (index = data))
			.catch(() => (failed = true));
	});

	function onInput() {
		const url = new URL(location.href);
		if (query) url.searchParams.set('q', query);
		else url.searchParams.delete('q');
		replaceState(url, {});
	}
</script>

<Seo
	title="Search"
	description="Search the Reserve Bank of Aletheia website."
	path="/search"
	noindex
/>

<PageHead
	trail={[{ href: '/search', label: 'Search' }]}
	eyebrow="Search"
	title="Search."
	seed={139}
/>

<section class="section surface-parchment">
	<div class="container search">
		<form method="get" action="/search" role="search" onsubmit={(e) => e.preventDefault()}>
			<label for="q" class="t-meta">Search the website</label>
			<input
				id="q"
				name="q"
				type="search"
				autocomplete="off"
				bind:value={query}
				oninput={onInput}
				placeholder="For example: banknotes, monetary policy, governance"
			/>
		</form>

		<noscript>
			<p>Search needs JavaScript. Every page is listed in the <a href="/sitemap">sitemap</a>.</p>
		</noscript>

		{#if failed}
			<p class="note">
				Search is unavailable at the moment. See the <a href="/sitemap">sitemap</a>.
			</p>
		{:else if query.trim() && index}
			<p class="note t-fine" aria-live="polite">
				{hits.length}
				{hits.length === 1 ? 'result' : 'results'}
			</p>
			<ol role="list" class="results">
				{#each hits as hit (hit.page.url)}
					<li>
						<a href={hit.page.url} class="result">
							<span class="result__title">{hit.page.title}</span>
							<span class="result__url t-fine">{hit.page.url}</span>
							<span class="result__excerpt">{hit.excerpt}</span>
						</a>
					</li>
				{/each}
			</ol>
			{#if hits.length === 0}
				<p>No pages match. Try fewer words, or browse the <a href="/sitemap">sitemap</a>.</p>
			{/if}
		{/if}
	</div>
</section>

<style>
	.search {
		max-width: 56rem;
		display: grid;
		gap: var(--space-5);
	}

	form {
		display: grid;
		gap: var(--space-2);
	}

	label {
		color: var(--fg-muted);
	}

	input {
		min-height: 52px;
		padding: var(--space-3) var(--space-4);
		font-size: var(--fs-lead);
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-control);
		background: var(--c-parchment-50);
	}

	.note {
		color: var(--fg-muted);
	}

	.results {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.result {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-4);
		border-bottom: var(--hairline) solid var(--line);
		text-decoration: none;
	}

	.result__title {
		font-size: var(--fs-h4);
		font-weight: 650;
	}

	.result:hover .result__title {
		text-decoration: underline;
	}

	.result__url {
		color: var(--fg-accent);
	}

	.result__excerpt {
		color: var(--fg-muted);
	}
</style>
