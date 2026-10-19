<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Crumb } from '$lib/seo/jsonld';
	import RelatedLinks from '../editorial/RelatedLinks.svelte';
	import SectionHeader from '../editorial/SectionHeader.svelte';
	import Seo from '../seo/Seo.svelte';
	import PageHead from './PageHead.svelte';

	/**
	 * A plain institutional page: navy head, then ruled sections of title and body. Used for the
	 * shorter pages (governance, careers, procurement and the like) so they stay consistent.
	 */
	let {
		title,
		headTitle,
		description,
		path,
		trail,
		eyebrow,
		folio,
		seed,
		lead: leadText,
		sections,
		related
	}: {
		title: string;
		headTitle: string;
		description: string;
		path: string;
		trail: Crumb[];
		eyebrow: string;
		folio?: string;
		seed: number;
		lead?: string;
		sections: { eyebrow: string; title: string; body: Snippet }[];
		related: { href: string; label: string }[];
	} = $props();
</script>

<Seo {title} {description} {path} />

<PageHead {trail} {folio} {eyebrow} title={headTitle} {seed}>
	{#snippet lead()}
		{#if leadText}<p>{leadText}</p>{/if}
	{/snippet}
</PageHead>

{#each sections as s, i (s.title)}
	<section
		class="section {i % 2 ? 'surface-raised' : 'surface-parchment'}"
		aria-labelledby="{path.replace(/\W+/g, '-')}-{i}"
	>
		<div class="container split">
			<SectionHeader
				folio={folio ? `${folio}.${i + 1}` : undefined}
				eyebrow={s.eyebrow}
				title={s.title}
				id="{path.replace(/\W+/g, '-')}-{i}"
			/>
			<div class="body">{@render s.body()}</div>
		</div>
	</section>
{/each}

<RelatedLinks links={related} />

<style>
	.split {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 1024px) {
		.split {
			grid-template-columns: 5fr 7fr;
			gap: var(--gutter);
		}
	}

	.body {
		display: grid;
		gap: var(--space-4);
		align-content: start;
		max-width: var(--measure);
	}

	.body :global(p) {
		color: var(--fg-muted);
	}

	.body :global(p.t-lead) {
		color: var(--fg);
	}

	.body :global(dl) {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.body :global(dl > div) {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-4);
		border-bottom: var(--hairline) solid var(--line);
	}

	.body :global(dt) {
		font-weight: 650;
	}

	.body :global(dd) {
		margin: 0;
		color: var(--fg-muted);
	}

	.body :global(ul) {
		display: grid;
		gap: var(--space-2);
		padding-left: 1.2em;
	}
</style>
