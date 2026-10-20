<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const explainers = [
		{
			id: 'what-is-a-central-bank',
			q: 'What is a central bank?',
			a: 'The public institution responsible for a country’s money. It issues the currency, sets monetary policy, keeps payments flowing between banks, and watches over the stability of the financial system.'
		},
		{
			id: 'what-is-money',
			q: 'What is money?',
			a: 'Anything people widely accept in payment, use to measure prices, and hold to spend later. Today most money is a record: notes issued by a central bank, and balances held with banks.'
		},
		{
			id: 'what-is-fiat-money',
			q: 'What is fiat money?',
			a: 'Money issued by a public institution under law. Its value rests on the rules and institutions behind it, and on people’s confidence that it will keep its purchasing power.'
		},
		{
			id: 'why-stable-prices-matter',
			q: 'Why do stable prices matter?',
			a: 'When prices are stable, money keeps its value, wages and savings hold up, and people can plan ahead. Keeping purchasing power steady is a central aim of monetary policy.'
		},
		{
			id: 'how-money-is-created',
			q: 'How is money created?',
			a: 'Banknotes are issued by the central bank. Most money, however, is created when banks lend: a loan becomes a deposit in the borrower’s account. The central bank’s policy shapes how much lending, and so how much money, the economy produces.'
		},
		{
			id: 'what-is-an-exchange-rate',
			q: 'What is an exchange rate?',
			a: 'The price of one currency in terms of another. Some countries let it be set by the market, others manage it closely. Each choice has consequences for prices, trade and reserves, and is a matter of published policy.'
		},
		{
			id: 'why-independence',
			q: 'Why are central banks independent?',
			a: 'Decisions about money work best when they look years ahead. Independence protects them from short-term pressures, while accountability makes sure the bank explains itself and answers for the results.'
		},
		{
			id: 'how-banknotes-are-protected',
			q: 'How are banknotes protected?',
			a: 'Modern notes combine features that are easy to check and hard to copy: fine engraved linework, watermarks, security threads, latent images and serial numbers.'
		}
	];

	const glossary = [
		['Central bank', 'The public institution responsible for a country’s money.'],
		['Denomination', 'The face value of a banknote or coin, such as 20 AEY.'],
		['Exchange rate', 'The price of one currency in terms of another.'],
		['Fiat currency', 'Money issued under law, valued for the institutions behind it.'],
		['Inflation', 'A general rise in prices, which reduces what money can buy.'],
		['Issuance', 'The creation of new currency by the central bank.'],
		['Monetary policy', 'The decisions a central bank takes to keep money’s value stable.'],
		['Policy rate', 'The interest rate a central bank sets to steer borrowing and saving.'],
		['Purchasing power', 'The amount of goods and services a unit of money can buy.'],
		['Reserves', 'Assets a central bank holds, often in foreign currencies.'],
		['Settlement', 'The final transfer of money that completes a payment.'],
		['Specimen', 'A sample of a banknote design, marked so it cannot be used as money.']
	];
</script>

<Seo
	title="The Bank Explained"
	description="Central banking in brief: what a central bank does, what fiat money is, why stable prices matter, and a glossary."
	path="/explained"
/>

<PageHead
	trail={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/explained', label: 'The Bank explained' }
	]}
	folio="§ 01.5"
	eyebrow="The Bank explained"
	title="Central banking, in brief."
	seed={83}
/>

<section class="section surface-parchment" aria-labelledby="explainers-title">
	<div class="container">
		<SectionHeader
			folio="§ 01.6"
			eyebrow="Explainers"
			title="Eight questions"
			id="explainers-title"
		/>
		<ol role="list" class="explainers">
			{#each explainers as e, i (e.id)}
				<li id={e.id} data-reveal use:reveal={i % 3}>
					<span class="t-meta num">{String(i + 1).padStart(2, '0')}</span>
					<h3 class="t-h3">{e.q}</h3>
					<p>{e.a}</p>
				</li>
			{/each}
		</ol>
	</div>
</section>

<section class="section surface-raised" id="glossary" aria-labelledby="glossary-title">
	<div class="container split">
		<SectionHeader
			folio="§ 01.7"
			eyebrow="Glossary"
			title="Terms used on this site"
			id="glossary-title"
		/>
		<dl class="glossary">
			{#each glossary as [term, desc] (term)}
				<div>
					<dt>{term}</dt>
					<dd>{desc}</dd>
				</div>
			{/each}
		</dl>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/monetary-policy', label: 'Monetary policy' },
		{ href: '/faq', label: 'Questions and answers' }
	]}
/>

<style>
	.explainers {
		display: grid;
		gap: 0 var(--gutter);
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	@media (min-width: 900px) {
		.explainers {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.explainers li {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding-block: var(--space-6);
		border-bottom: var(--hairline) solid var(--line);
		scroll-margin-top: calc(var(--bar-h) + var(--space-5));
	}

	.explainers .num {
		color: var(--fg-accent);
	}

	.explainers p {
		color: var(--fg-muted);
		max-width: 52ch;
	}

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

	.glossary {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.glossary div {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-3);
		border-bottom: var(--hairline) solid var(--line);
	}

	@media (min-width: 768px) {
		.glossary div {
			grid-template-columns: 12rem 1fr;
			gap: var(--space-5);
		}
	}

	.glossary dt {
		font-weight: 650;
	}

	.glossary dd {
		margin: 0;
		color: var(--fg-muted);
	}
</style>
