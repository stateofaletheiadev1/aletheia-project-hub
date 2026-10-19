<script lang="ts">
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const series = [
		['Money and credit', 'The Guilder issued and the money held by the public.'],
		['Interest rates', 'The Bank’s policy rate and market rates.'],
		['Exchange rates', 'Reference rates for the Guilder.'],
		['The Bank’s balance sheet', 'The Bank’s assets and liabilities.'],
		['Banknotes', 'Notes issued and withdrawn, by denomination.']
	];
</script>

<Seo
	title="Statistics"
	description="Monetary and financial statistics published by the Reserve Bank of Aletheia."
	path="/statistics"
/>

<PageHead
	trail={[{ href: '/statistics', label: 'Statistics' }]}
	folio="§ 09"
	eyebrow="Statistics"
	title="Monetary and financial statistics."
	seed={79}
>
	{#snippet lead()}
		<p>Data published on a fixed calendar, with its methods.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="series-title">
	<div class="container split">
		<SectionHeader
			folio="§ 09.1"
			eyebrow="Series"
			title="What will be published"
			id="series-title"
		/>
		<dl class="series">
			{#each series as [term, desc] (term)}
				<div>
					<dt>{term}</dt>
					<dd>{desc}</dd>
				</div>
			{/each}
		</dl>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="releases-title">
	<div class="container">
		<SectionHeader folio="§ 09.2" eyebrow="Releases" title="Release calendar" id="releases-title" />
		<EmptyState title="Forthcoming" seed={79}>
			<p>The release calendar will be published here.</p>
		</EmptyState>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/publications', label: 'Publications' },
		{ href: '/monetary-policy', label: 'Monetary policy' }
	]}
/>

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

	.series {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.series div {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-4);
		border-bottom: var(--hairline) solid var(--line);
	}

	@media (min-width: 768px) {
		.series div {
			grid-template-columns: 14rem 1fr;
			gap: var(--space-5);
		}
	}

	.series dt {
		font-weight: 650;
	}

	.series dd {
		margin: 0;
		color: var(--fg-muted);
	}
</style>
