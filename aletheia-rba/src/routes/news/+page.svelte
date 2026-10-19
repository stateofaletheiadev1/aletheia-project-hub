<script lang="ts">
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import { longDate } from '$lib/components/publications/format';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { news } from '$lib/content';

	const CATEGORY = { notice: 'Notice', announcement: 'Announcement', statement: 'Statement' };
</script>

<Seo
	title="News and Notices"
	description="Dated notices, announcements and statements from the Reserve Bank of Aletheia."
	path="/news"
/>

<PageHead
	trail={[{ href: '/news', label: 'News' }]}
	folio="§ 10"
	eyebrow="News and notices"
	title="Notices, dated and kept."
	seed={37}
>
	{#snippet lead()}
		<p>Announcements and notices from the Bank.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="register-title">
	<div class="container">
		<SectionHeader folio="§ 10.1" eyebrow="Register" title="All notices" id="register-title" />
		{#if news.length === 0}
			<EmptyState title="Forthcoming" seed={37}>
				<p>Notices from the Bank will appear here.</p>
			</EmptyState>
		{:else}
			<ol role="list" class="register">
				{#each news as n (n.meta.slug)}
					<li>
						<time datetime={n.meta.publishedAt} class="t-meta">{longDate(n.meta.publishedAt)}</time>
						<div>
							<p class="t-meta kind">{CATEGORY[n.meta.category]}</p>
							<h3 class="t-h3"><a href="/news/{n.meta.slug}">{n.meta.title}</a></h3>
							<p class="summary">{n.meta.summary}</p>
						</div>
					</li>
				{/each}
			</ol>
		{/if}
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/publications', label: 'Publications' },
		{ href: '/about', label: 'About the Bank' }
	]}
/>

<style>
	.register {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.register li {
		display: grid;
		gap: var(--space-2) var(--gutter);
		padding-block: var(--space-5);
		border-bottom: var(--hairline) solid var(--line);
	}

	@media (min-width: 1024px) {
		.register li {
			grid-template-columns: 3fr 9fr;
		}
	}

	.register time,
	.kind {
		color: var(--fg-muted);
	}

	.register h3 a {
		text-decoration: none;
	}

	.register h3 a:hover {
		text-decoration: underline;
	}

	.summary {
		color: var(--fg-muted);
		max-width: var(--measure);
	}
</style>
