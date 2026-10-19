<script lang="ts">
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Guilloche from '$lib/components/motion/Guilloche.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const pillars = [
		{
			label: 'Settlement',
			title: 'Final settlement in central bank money',
			body: 'Payments between institutions are to settle across the Bank’s books, finally and irrevocably.'
		},
		{
			label: 'Infrastructure',
			title: 'Aletheia StableChain',
			body: 'The State’s settlement ledger, intended to carry the Guilder in digital form and to keep a public record.'
		},
		{
			label: 'Oversight',
			title: 'Standards for payment systems',
			body: 'The Bank will publish the standards that systems handling the Guilder are expected to meet.'
		}
	];
</script>

<Seo
	title="Payments and Infrastructure"
	description="The Reserve Bank of Aletheia's role in settlement, payments infrastructure and the oversight of payment systems."
	path="/payments"
/>

<PageHead
	trail={[
		{ href: '/financial-stability', label: 'Financial Stability' },
		{ href: '/payments', label: 'Payments' }
	]}
	folio="§ 04"
	eyebrow="Payments and infrastructure"
	title="Payments that settle."
	seed={71}
>
	{#snippet lead()}
		<p>Safe, final and efficient payment is a core function of a central bank.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="pillars-title">
	<div class="container">
		<SectionHeader folio="§ 04.1" eyebrow="Functions" title="Three pillars" id="pillars-title" />
		<div class="pillars">
			{#each pillars as p (p.label)}
				<article class="pillar">
					<p class="t-meta pillar__label">{p.label}</p>
					<h3 class="t-h3">{p.title}</h3>
					<p class="pillar__body">{p.body}</p>
				</article>
			{/each}
		</div>
	</div>
</section>

<section class="section surface-navy ledger-band" aria-labelledby="ledger-title">
	<div class="ornament" aria-hidden="true">
		<Guilloche kind="lattice" seed={73} width={1440} height={360} lines={28} strokeWidth={0.5} />
	</div>
	<div class="container split">
		<SectionHeader
			folio="§ 04.2"
			eyebrow="The ledger"
			title="One record, open to inspection"
			id="ledger-title"
		/>
		<p class="t-lead measure">
			Issuance in digital form is intended to be recorded on Aletheia StableChain, so that the
			register of the Guilder can be checked by anyone.
		</p>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/financial-stability', label: 'Financial stability' },
		{ href: '/issuance', label: 'Issuance' },
		{ href: '/currency', label: 'The Aletheian Guilder' }
	]}
/>

<style>
	.pillars {
		display: grid;
		gap: var(--space-6) var(--gutter);
	}

	@media (min-width: 900px) {
		.pillars {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.pillar {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding-top: var(--space-5);
		border-top: 2px solid var(--fg);
	}

	.pillar__label {
		color: var(--fg-accent);
	}

	.pillar__body {
		color: var(--fg-muted);
	}

	.ledger-band {
		position: relative;
		overflow: hidden;
	}

	.ornament {
		position: absolute;
		inset: 0;
		opacity: 0.14;
		pointer-events: none;
	}

	.ornament :global(svg) {
		height: 100%;
	}

	.split {
		position: relative;
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 1024px) {
		.split {
			grid-template-columns: 5fr 7fr;
			gap: var(--gutter);
		}
	}
</style>
