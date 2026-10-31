<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const priorities = [
		{
			title: 'Foundations in law',
			body: 'Establish the Bank on a clear legal basis, with its mandate, powers and governance set in law.'
		},
		{
			title: 'A trusted currency',
			body: 'Prepare the Aletheian Guilder for issue: the rules, the register and the banknote series.'
		},
		{
			title: 'Payments that work',
			body: 'Build safe settlement and payment infrastructure, with the digital Guilder on AletheiaChain.'
		},
		{
			title: 'Sound policy',
			body: 'Develop the monetary policy framework through research, consultation and publication.'
		},
		{
			title: 'An institution of standing',
			body: 'Recruit the people, build the systems and form the international relationships a central bank needs.'
		},
		{
			title: 'Openness',
			body: 'Publish the Bank’s decisions, statistics and accounts, and explain them plainly.'
		}
	];
</script>

<Seo
	title="Strategic Priorities"
	description="The founding priorities of the Reserve Bank of Aletheia."
	path="/about/strategy"
/>

<PageHead
	trail={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/strategy', label: 'Strategic priorities' }
	]}
	folio="§ 01.12"
	eyebrow="Strategic priorities"
	title="Building the Bank."
	seed={157}
>
	{#snippet lead()}
		<p>Six priorities guide the Bank’s founding years.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="priorities-title">
	<div class="container">
		<SectionHeader
			folio="§ 01.12.1"
			eyebrow="Priorities"
			title="The founding programme"
			id="priorities-title"
		/>
		<ol role="list" class="priorities">
			{#each priorities as p, i (p.title)}
				<li data-reveal use:reveal={i % 3}>
					<span class="num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
					<div>
						<h3 class="t-h3">{p.title}</h3>
						<p>{p.body}</p>
					</div>
				</li>
			{/each}
		</ol>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/about/mission', label: 'Mission and values' },
		{ href: '/about/organisation', label: 'Organisation' },
		{ href: '/about/governance', label: 'Governance' }
	]}
/>

<style>
	.priorities {
		display: grid;
		gap: 0 var(--gutter);
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	@media (min-width: 900px) {
		.priorities {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1280px) {
		.priorities {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.priorities li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-5);
		padding-block: var(--space-6);
		border-bottom: var(--hairline) solid var(--line);
	}

	.num {
		font-size: clamp(2rem, 1.6rem + 1.5vw, 3rem);
		font-weight: 200;
		line-height: 1;
		color: var(--fg-accent);
		font-variant-numeric: tabular-nums;
	}

	.priorities div {
		display: grid;
		gap: var(--space-2);
	}

	.priorities p {
		color: var(--fg-muted);
	}
</style>
