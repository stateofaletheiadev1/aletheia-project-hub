<script lang="ts">
	import type { Publication } from '$lib/content/schema';
	import { CATEGORY_LABELS, fileSize, longDate } from './format';

	/** A ruled register row: date · category · title · summary · format and size. */
	let { meta, headingLevel = 3 }: { meta: Publication; headingLevel?: 2 | 3 } = $props();
</script>

<article class="entry">
	<p class="entry__meta t-meta">
		<time datetime={meta.publishedAt}>{longDate(meta.publishedAt)}</time>
		<span>{CATEGORY_LABELS[meta.category]}</span>
		{#if meta.status === 'superseded' || meta.status === 'withdrawn'}
			<span class="flag">{meta.status === 'superseded' ? 'Superseded' : 'Withdrawn'}</span>
		{/if}
	</p>
	<svelte:element this={`h${headingLevel}`} class="entry__title t-h3">
		<a href="/publications/{meta.slug}">{meta.title}</a>
	</svelte:element>
	<p class="entry__summary">{meta.summary}</p>
	<p class="entry__format t-fine">
		{#if meta.hasHtmlVersion}HTML{/if}{#if meta.hasHtmlVersion && meta.documentUrl}
			·
		{/if}{#if meta.documentUrl}PDF{#if meta.documentSizeBytes}, {fileSize(
					meta.documentSizeBytes
				)}{/if}{/if}
	</p>
</article>

<style>
	.entry {
		display: grid;
		gap: var(--space-2);
		padding-block: var(--space-5);
		border-bottom: var(--hairline) solid var(--line);
	}

	@media (min-width: 1024px) {
		.entry {
			grid-template-columns: 3fr 9fr;
			column-gap: var(--gutter);
		}

		.entry > :not(.entry__meta) {
			grid-column: 2;
		}

		.entry__meta {
			grid-row: 1 / span 3;
		}
	}

	.entry__meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		color: var(--fg-muted);
	}

	@media (min-width: 1024px) {
		.entry__meta {
			flex-direction: column;
		}
	}

	.flag {
		color: var(--fg-accent);
	}

	.entry__title a {
		text-decoration: none;
	}

	.entry__title a:hover {
		text-decoration: underline;
		text-decoration-color: var(--line-strong);
	}

	.entry__summary {
		color: var(--fg-muted);
		max-width: var(--measure);
	}
</style>
