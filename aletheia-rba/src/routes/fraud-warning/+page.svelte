<script lang="ts">
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import DisclosureNotice from '$lib/components/institutional/DisclosureNotice.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const never = [
		'contact you to ask for passwords, bank details or personal information;',
		'sell, or authorise anyone to sell, Aletheian Guilders or digital tokens;',
		'offer investments, accounts or returns of any kind;',
		'ask for payment to release funds, prizes or documents.'
	];
</script>

<Seo
	title="Fraud Warning"
	description="How to recognise scams that misuse the name of the Reserve Bank of Aletheia or the Aletheian Guilder."
	path="/fraud-warning"
/>

<PageHead
	trail={[{ href: '/fraud-warning', label: 'Fraud warning' }]}
	eyebrow="Fraud warning"
	title="Protect yourself from scams."
	seed={89}
>
	{#snippet lead()}
		<p>Criminals may use the name of the Bank or of the Guilder to deceive people.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="never-title">
	<div class="container split">
		<SectionHeader
			folio="§ 14.1"
			eyebrow="Know the signs"
			title="The Bank will never"
			id="never-title"
		/>
		<ul class="never">
			{#each never as item (item)}<li>{item}</li>{/each}
		</ul>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="official-title">
	<div class="container split">
		<SectionHeader
			folio="§ 14.2"
			eyebrow="Official sources"
			title="Where to check"
			id="official-title"
		/>
		<DisclosureNotice label="Official website">
			<p>
				The Bank’s official information is published only at rba.aletheiagov.org. If in doubt, do
				not pay, do not share your details, and check this website.
			</p>
		</DisclosureNotice>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/contact', label: 'Contact' },
		{ href: '/faq', label: 'Questions and answers' }
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

	.never {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.never li {
		position: relative;
		padding: var(--space-4) 0 var(--space-4) var(--space-6);
		border-bottom: var(--hairline) solid var(--line);
		font-size: var(--fs-lead);
	}

	.never li::before {
		content: '';
		position: absolute;
		left: 0;
		top: calc(var(--space-4) + 0.7em);
		width: 0.9rem;
		height: 2px;
		background: var(--fg);
	}
</style>
