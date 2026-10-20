<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { SITE } from '$lib/content';

	const articles = [
		{
			numeral: 'I',
			title: 'Candour',
			body: 'The Bank says what is, and what is intended. Its statements are dated, and it corrects them openly when they change.'
		},
		{
			numeral: 'II',
			title: 'Rules before money',
			body: 'Currency is issued only under rules that have been adopted and published. No exception is made for convenience.'
		},
		{
			numeral: 'III',
			title: 'Separation',
			body: 'The body that issues money does not spend it. The Bank is kept apart from the Treasury, and does not finance the budget.'
		},
		{
			numeral: 'IV',
			title: 'A public record',
			body: 'Every issue and withdrawal of currency is recorded in a register, and the register is published.'
		},
		{
			numeral: 'V',
			title: 'Independent review',
			body: 'The Bank’s accounts and register are examined by an independent auditor, whose reports are published in full.'
		},
		{
			numeral: 'VI',
			title: 'Restraint',
			body: 'The Bank makes no undertaking it does not have the means to keep, and says so plainly.'
		}
	];

	const mandate = [
		[
			'The Aletheian Guilder',
			'To issue the Guilder in banknotes and in digital form, and to safeguard its integrity against counterfeiting and misuse.'
		],
		[
			'Monetary policy',
			'To set the policy that governs the Guilder, with the aim of stable prices, and to explain each decision in public.'
		],
		[
			'Banknotes',
			'To design, commission, issue and withdraw the State’s banknotes, and to keep the series secure.'
		],
		[
			'Statistics',
			'To compile and publish monetary and financial statistics to international standards.'
		],
		[
			'Cooperation',
			'To work with other central banks and international institutions, and to represent Aletheia in monetary matters.'
		]
	];
</script>

<Seo
	title="About the Bank"
	description="The purpose, mandate and founding principles of the Reserve Bank of Aletheia."
	path="/about"
/>

<PageHead
	trail={[{ href: '/about', label: 'About' }]}
	folio="§ 01"
	eyebrow="About the Bank"
	title="The monetary institution of Aletheia."
	seed={3}
>
	{#snippet lead()}
		<p>
			The Reserve Bank of Aletheia is being established as the central banking institution of the
			{SITE.state}.
		</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="purpose-title">
	<div class="container two-col">
		<SectionHeader folio="§ 01.1" eyebrow="Purpose" title="Why a reserve bank" id="purpose-title" />
		<div class="prose-block">
			<p class="t-lead">
				A currency is only as sound as the institution that issues it. The Bank is intended to issue
				the Aletheian Guilder under published rules, and to account for it in public.
			</p>
			<p>
				Every modern nation entrusts its money to a central bank, because money must be managed for
				the long term and for everyone, not for the needs of a single budget or a single moment. The
				Reserve Bank of Aletheia is being established on the same footing: independent in its
				decisions, accountable for its results, and open about its reasoning.
			</p>
		</div>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="articles-title">
	<div class="container">
		<SectionHeader
			folio="§ 01.2"
			eyebrow="Founding principles"
			title="Six articles"
			id="articles-title"
		/>
		<ol role="list" class="articles">
			{#each articles as a, i (a.numeral)}
				<li class="article" data-reveal use:reveal={i % 3}>
					<span class="article__folio" aria-hidden="true">{a.numeral}</span>
					<div class="article__body">
						<p class="t-meta article__label">Article {a.numeral}</p>
						<h3 class="t-h3">{a.title}</h3>
						<p>{a.body}</p>
					</div>
				</li>
			{/each}
		</ol>
	</div>
</section>

<section class="section surface-parchment" aria-labelledby="mandate-title">
	<div class="container two-col">
		<div class="stack">
			<SectionHeader
				folio="§ 01.3"
				eyebrow="Mandate"
				title="What the Bank is to do"
				id="mandate-title"
			/>
			<p class="t-muted measure">
				The Bank is intended to be established by law of the {SITE.state}, and to be governed by a
				board answerable for its decisions in public.
			</p>
		</div>
		<dl class="mandate">
			{#each mandate as [term, desc] (term)}
				<div>
					<dt>{term}</dt>
					<dd>{desc}</dd>
				</div>
			{/each}
		</dl>
	</div>
</section>

<section class="section surface-navy" aria-labelledby="independence-title">
	<div class="container two-col">
		<SectionHeader
			folio="§ 01.4"
			eyebrow="Independence"
			title="Independent and accountable"
			id="independence-title"
		/>
		<div class="prose-block">
			<p class="t-lead">
				Independence lets the Bank take the long view. Accountability makes sure it uses that
				freedom well.
			</p>
			<p>
				The Bank is intended to decide monetary policy within its legal mandate, without instruction
				on individual decisions. In return it explains every decision, publishes its accounts and
				reports regularly to the institutions of the State.
			</p>
		</div>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/monetary-policy', label: 'Monetary policy' },
		{ href: '/currency', label: 'The Aletheian Guilder' },
		{ href: '/faq', label: 'Questions and answers' }
	]}
/>

<style>
	.two-col {
		display: grid;
		gap: var(--space-6);
	}

	@media (min-width: 1024px) {
		.two-col {
			grid-template-columns: 5fr 7fr;
			gap: var(--gutter);
		}
	}

	.stack {
		display: grid;
		align-content: start;
		gap: var(--space-2);
	}

	.articles {
		display: grid;
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	@media (min-width: 768px) {
		.articles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: var(--gutter);
		}
	}

	@media (min-width: 1280px) {
		.articles {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.article {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-5);
		padding-block: var(--space-6);
		border-bottom: var(--hairline) solid var(--line);
	}

	.article__folio {
		font-size: clamp(2.5rem, 2rem + 2vw, 3.75rem);
		font-weight: 200;
		line-height: 1;
		color: var(--fg-accent);
		min-width: 2.2ch;
		letter-spacing: -0.02em;
	}

	.article__body {
		display: grid;
		gap: var(--space-2);
	}

	.article__label,
	.article__body p:last-child {
		color: var(--fg-muted);
	}

	.mandate {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.mandate div {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-4);
		border-bottom: var(--hairline) solid var(--line);
	}

	@media (min-width: 768px) {
		.mandate div {
			grid-template-columns: 14rem 1fr;
			gap: var(--space-5);
		}
	}

	.prose-block {
		display: grid;
		gap: var(--space-4);
		max-width: var(--measure);
	}

	.prose-block p:not(.t-lead) {
		color: var(--fg-muted);
	}

	.mandate dt {
		font-weight: 650;
	}

	.mandate dd {
		margin: 0;
		color: var(--fg-muted);
	}
</style>
