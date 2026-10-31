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
			body: 'Payments between institutions are to settle across the Bank’s books, finally and irrevocably. Settlement in central bank money removes the risk that one party fails before a payment completes.'
		},
		{
			label: 'Infrastructure',
			title: 'AletheiaChain',
			body: 'The State’s settlement ledger, intended to carry the Guilder in digital form and to keep a public record. It is designed for fast finality and an open, verifiable history.'
		},
		{
			label: 'Oversight',
			title: 'Standards for payment systems',
			body: 'The Bank will publish the standards that systems handling the Guilder are expected to meet, in line with the principles followed by central banks internationally.'
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
			Issuance in digital form is intended to be recorded on AletheiaChain, so that the
			register of the Guilder can be checked by anyone.
		</p>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="everyday-title">
	<div class="container split">
		<SectionHeader
			folio="§ 04.3"
			eyebrow="Everyday payments"
			title="For people and businesses"
			id="everyday-title"
		/>
		<div class="text">
			<p class="t-lead">A good payment system is one that nobody has to think about.</p>
			<p>
				Wages arrive on time, bills are paid in seconds, and a shop can accept payment as easily
				from a visitor as from a neighbour. The Bank intends to foster payments that are instant,
				low in cost and open to every provider that meets its standards, with cash remaining
				available for those who prefer it.
			</p>
		</div>
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
	.text {
		display: grid;
		gap: var(--space-4);
		max-width: var(--measure);
	}

	.text p:not(.t-lead) {
		color: var(--fg-muted);
	}

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
