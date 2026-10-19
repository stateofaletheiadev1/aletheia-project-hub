<script lang="ts">
	import Prose from '$lib/components/editorial/Prose.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Icon from '$lib/components/primitives/Icon.svelte';
	import { CATEGORY_LABELS, fileSize, longDate } from '$lib/components/publications/format';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { publications } from '$lib/content';
	import { article } from '$lib/seo/jsonld';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const entry = $derived(publications.find((p) => p.meta.slug === data.slug));
	const meta = $derived(entry?.meta);
	const Body = $derived(entry?.component);

	// Table of contents from the rendered headings.
	let body = $state<HTMLElement>();
	let toc = $state<{ id: string; text: string }[]>([]);
	$effect(() => {
		if (!body || !Body) return;
		toc = [...body.querySelectorAll('h2')].map((h, i) => {
			if (!h.id) h.id = `section-${i + 1}`;
			return { id: h.id, text: h.textContent ?? '' };
		});
	});
</script>

{#if meta && Body}
	<Seo
		title={`${meta.title} · Publications`}
		description={meta.summary}
		path="/publications/{meta.slug}"
		type="article"
		publishedAt={meta.publishedAt}
		modifiedAt={meta.updatedAt}
		jsonLd={[
			article({
				type: meta.category === 'annual-report' ? 'Report' : 'Article',
				headline: meta.title,
				path: `/publications/${meta.slug}`,
				description: meta.summary,
				publishedAt: meta.publishedAt,
				modifiedAt: meta.updatedAt
			})
		]}
	/>

	<PageHead
		trail={[
			{ href: '/publications', label: 'Publications' },
			{ href: `/publications/${meta.slug}`, label: meta.title }
		]}
		eyebrow={CATEGORY_LABELS[meta.category]}
		title={meta.title}
		seed={31}
	>
		{#snippet lead()}
			<p>{meta.summary}</p>
		{/snippet}
		{#snippet aside()}
			<dl class="docmeta">
				<div>
					<dt>Published</dt>
					<dd><time datetime={meta.publishedAt}>{longDate(meta.publishedAt)}</time></dd>
				</div>
				{#if meta.updatedAt}
					<div>
						<dt>Updated</dt>
						<dd><time datetime={meta.updatedAt}>{longDate(meta.updatedAt)}</time></dd>
					</div>
				{/if}
				{#if meta.status !== 'published'}
					<div>
						<dt>Status</dt>
						<dd>{meta.status}</dd>
					</div>
				{/if}
				{#if meta.documentUrl}
					<div>
						<dt>Document</dt>
						<dd>
							<a href={meta.documentUrl}>
								<Icon name="download" size={16} /> PDF{meta.documentSizeBytes
									? `, ${fileSize(meta.documentSizeBytes)}`
									: ''}
							</a>
						</dd>
					</div>
				{/if}
			</dl>
		{/snippet}
	</PageHead>

	<section class="section surface-parchment">
		<div class="container report">
			{#if toc.length > 1}
				<nav class="toc" aria-label="Contents">
					<p class="t-meta">Contents</p>
					<ol>
						{#each toc as item (item.id)}<li><a href="#{item.id}">{item.text}</a></li>{/each}
					</ol>
				</nav>
			{/if}
			<div bind:this={body}>
				<Prose>
					<Body />
				</Prose>
			</div>
		</div>
	</section>

	<RelatedLinks
		links={[
			{ href: '/publications', label: 'All publications' },
			{ href: '/news', label: 'News and notices' }
		]}
	/>
{/if}

<style>
	.docmeta {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--fs-meta);
	}

	.docmeta div {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: var(--space-3);
		border-bottom: var(--hairline) solid var(--line);
		padding-bottom: var(--space-2);
	}

	.docmeta dt {
		color: var(--fg-muted);
	}

	.docmeta dd {
		margin: 0;
	}

	.report {
		display: grid;
		gap: var(--space-7);
	}

	@media (min-width: 1024px) {
		.report {
			grid-template-columns: 3fr 9fr;
			gap: var(--gutter);
		}

		.toc {
			position: sticky;
			top: calc(var(--bar-h) + var(--space-5));
			align-self: start;
		}
	}

	.toc ol {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
		padding-left: 1.2em;
		font-size: var(--fs-meta);
	}
</style>
