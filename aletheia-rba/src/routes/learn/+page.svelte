<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const guides = [
		{
			id: 'budget',
			title: 'Making a budget',
			points: [
				'Write down what comes in each month and what goes out.',
				'Put essentials first: home, food, energy and transport.',
				'Set an amount aside before spending on anything else.',
				'Check your budget every month and adjust it.'
			]
		},
		{
			id: 'saving',
			title: 'Saving',
			points: [
				'Start small and save regularly; habit matters more than amount.',
				'Keep an emergency reserve for unexpected costs.',
				'Be wary of any promise of high returns with no risk.'
			]
		},
		{
			id: 'paying-safely',
			title: 'Paying safely',
			points: [
				'Never share passwords, codes or recovery phrases with anyone.',
				'Check who you are paying before you confirm a payment.',
				'Use trusted devices, and keep their software up to date.',
				'Report a lost card or phone to your provider at once.'
			]
		},
		{
			id: 'inflation',
			title: 'Understanding inflation',
			points: [
				'Inflation is a general rise in prices.',
				'When prices rise faster than your income, your money buys less.',
				'Stable prices protect savings and make planning easier.'
			]
		},
		{
			id: 'banknotes',
			title: 'Looking after banknotes',
			points: [
				'Keep notes flat and dry, away from heat.',
				'Do not write on, staple or tape banknotes.',
				'Learn the features of each note, so that you can check them.'
			]
		},
		{
			id: 'scams',
			title: 'Spotting a scam',
			points: [
				'Pressure to act quickly is a warning sign.',
				'Offers that seem too good to be true usually are.',
				'The Bank will never ask you for money or personal details.'
			]
		}
	];
</script>

<Seo
	title="Money and You"
	description="Practical guides from the Reserve Bank of Aletheia: budgeting, saving, paying safely, inflation, banknotes and scams."
	path="/learn"
/>

<PageHead
	trail={[{ href: '/learn', label: 'Money and you' }]}
	folio="§ 15"
	eyebrow="Money and you"
	title="Good habits with money."
	seed={197}
>
	{#snippet lead()}
		<p>Short, practical guides for every age.</p>
	{/snippet}
	{#snippet aside()}
		<nav aria-label="Guides" class="jump">
			<ul role="list">
				{#each guides as g (g.id)}<li><a href="#{g.id}">{g.title}</a></li>{/each}
			</ul>
		</nav>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="guides-title">
	<div class="container">
		<SectionHeader folio="§ 15.1" eyebrow="Guides" title="Six guides" id="guides-title" />
		<div class="guides">
			{#each guides as g, i (g.id)}
				<article id={g.id} class="guide" data-reveal use:reveal={i % 3}>
					<span class="t-meta num">{String(i + 1).padStart(2, '0')}</span>
					<h3 class="t-h3">{g.title}</h3>
					<ul>
						{#each g.points as p (p)}<li>{p}</li>{/each}
					</ul>
				</article>
			{/each}
		</div>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/explained', label: 'The Bank explained' },
		{ href: '/fraud-warning', label: 'Fraud warning' },
		{ href: '/financial-inclusion', label: 'Financial inclusion' }
	]}
/>

<style>
	.jump ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		border-left: var(--hairline) solid var(--line-strong);
		padding-left: var(--space-4);
	}

	.jump a {
		display: inline-block;
		padding-block: var(--space-1);
		font-weight: 600;
	}

	.guides {
		display: grid;
		gap: var(--space-7) var(--gutter);
	}

	@media (min-width: 768px) {
		.guides {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1280px) {
		.guides {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.guide {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 2px solid var(--fg);
		scroll-margin-top: calc(var(--bar-h) + var(--space-5));
	}

	.num {
		color: var(--fg-accent);
	}

	.guide ul {
		display: grid;
		gap: var(--space-2);
		padding-left: 1.1em;
		color: var(--fg-muted);
	}
</style>
