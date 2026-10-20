<script lang="ts">
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import BankSeal from '$lib/components/brand/BankSeal.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const elements = [
		[
			'The star',
			'The eight-pointed star of Aletheia, which crowns the national arms, set in Seal Gold.'
		],
		[
			'The rosette',
			'Engine-turned linework of the kind engraved on banknotes, a sign of money made with care.'
		],
		['The rings', 'Two rings that hold the seal together, as the law holds the Bank.'],
		[
			'The legend',
			'The name of the Bank above; below, the national motto, Veritas in Foedere: truth in covenant.'
		]
	];
</script>

<Seo
	title="The Seal of the Bank"
	description="The seal of the Reserve Bank of Aletheia and what its elements mean."
	path="/about/seal"
/>

<PageHead
	trail={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/seal', label: 'The seal' }
	]}
	folio="§ 01.15"
	eyebrow="Symbols"
	title="The seal of the Bank."
	seed={173}
/>

<section class="section surface-navy" aria-labelledby="seal-title">
	<div class="container seal-grid">
		<div class="seal-figure">
			<BankSeal size={360} title="Seal of the Reserve Bank of Aletheia" />
		</div>
		<div>
			<SectionHeader folio="§ 01.15.1" eyebrow="Meaning" title="Four elements" id="seal-title" />
			<dl class="elements">
				{#each elements as [term, desc] (term)}
					<div>
						<dt>{term}</dt>
						<dd>{desc}</dd>
					</div>
				{/each}
			</dl>
		</div>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/about/mission', label: 'Mission and values' },
		{ href: '/media', label: 'Media centre' }
	]}
/>

<style>
	.seal-grid {
		display: grid;
		gap: var(--space-8);
		align-items: center;
	}

	@media (min-width: 1024px) {
		.seal-grid {
			grid-template-columns: 5fr 7fr;
			gap: var(--gutter);
		}
	}

	.seal-figure {
		display: grid;
		place-items: center;
	}

	.seal-figure :global(svg) {
		width: min(360px, 80vw);
		height: auto;
	}

	.elements {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.elements div {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-4);
		border-bottom: var(--hairline) solid var(--line);
	}

	.elements dt {
		font-weight: 650;
	}

	.elements dd {
		margin: 0;
		color: var(--fg-muted);
	}
</style>
