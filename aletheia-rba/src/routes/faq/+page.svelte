<script lang="ts">
	import FaqList from '$lib/components/editorial/FaqList.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { faq, faqGroups } from '$lib/content';
	import { faqPage } from '$lib/seo/jsonld';

	const groups = (Object.keys(faqGroups) as (keyof typeof faqGroups)[])
		.map((key) => ({ key, label: faqGroups[key], items: faq.filter((f) => f.group === key) }))
		.filter((g) => g.items.length > 0);
</script>

<Seo
	title="Frequently Asked Questions · Aletheian Guilder"
	description="Plain answers about the Aletheian Guilder: whether it has been issued, fiat currency, euro reserves and conversion, banknote designs and AletheiaChain."
	path="/faq"
	jsonLd={[faqPage(faq)]}
/>

<PageHead
	trail={[{ href: '/faq', label: 'FAQ' }]}
	folio="§ 12"
	eyebrow="Questions and answers"
	title="Plain answers."
	seed={43}
>
	{#snippet lead()}
		<p>About the Guilder, its banknotes, reserves and exchange, and the Bank itself.</p>
	{/snippet}
	{#snippet aside()}
		<nav aria-label="Question groups" class="jump">
			<ul role="list">
				{#each groups as g (g.key)}
					<li><a href="#group-{g.key}">{g.label}</a></li>
				{/each}
			</ul>
		</nav>
	{/snippet}
</PageHead>

{#each groups as g, i (g.key)}
	<section
		class="section--tight {i % 2 ? 'surface-raised' : 'surface-parchment'}"
		aria-labelledby="group-{g.key}"
	>
		<div class="container group">
			<h2 id="group-{g.key}" class="t-h2">{g.label}</h2>
			<FaqList items={g.items} />
		</div>
	</section>
{/each}

<RelatedLinks
	links={[
		{ href: '/currency', label: 'The Aletheian Guilder' },
		{ href: '/about', label: 'About the Bank' }
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
		padding-block: var(--space-2);
		font-weight: 600;
	}

	.group {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 1024px) {
		.group {
			grid-template-columns: 4fr 8fr;
			gap: var(--gutter);
		}
	}

	.group h2 {
		scroll-margin-top: calc(var(--bar-h) + var(--space-5));
	}
</style>
