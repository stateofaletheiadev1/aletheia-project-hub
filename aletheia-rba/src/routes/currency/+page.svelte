<script lang="ts">
	import FaqList from '$lib/components/editorial/FaqList.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Guilloche from '$lib/components/motion/Guilloche.svelte';
	import Link from '$lib/components/primitives/Link.svelte';
	import JsonLd from '$lib/components/seo/JsonLd.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { faq, SITE } from '$lib/content';
	import { faqPage } from '$lib/seo/jsonld';

	const subset = faq.filter((f) => f.group === 'currency');
</script>

<Seo
	title="The Aletheian Guilder (AEY) · Currency"
	description="The Aletheian Guilder (AEY), the currency of the Sovereign Covenant State of Aletheia."
	path="/currency"
	ogImage="/og/currency.png"
/>
<JsonLd data={faqPage(subset)} />

<PageHead
	trail={[{ href: '/currency', label: 'The Guilder' }]}
	folio="§ 06"
	eyebrow="The currency"
	title="The Aletheian Guilder."
	seed={8}
>
	{#snippet lead()}
		<p>The currency of the {SITE.state}, to be issued by the {SITE.name}.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="sheet-title">
	<div class="container">
		<div class="sheet">
			<div class="sheet__ornament" aria-hidden="true">
				<Guilloche kind="rosette" seed={14} size={300} layers={3} />
			</div>
			<header class="sheet__head">
				<p class="t-meta">Specimen sheet</p>
				<h2 id="sheet-title" class="t-h2">AEY</h2>
			</header>
			<dl class="sheet__rows">
				<div>
					<dt>Name</dt>
					<dd>Aletheian Guilder <span class="t-muted">(plural: Aletheian Guilders)</span></dd>
				</div>
				<div>
					<dt>Code</dt>
					<dd class="num">AEY</dd>
				</div>
				<div>
					<dt>Issuer</dt>
					<dd>{SITE.name}</dd>
				</div>
				<div>
					<dt>Model</dt>
					<dd>Fiat</dd>
				</div>
				<div>
					<dt>Forms</dt>
					<dd>Banknotes and digital</dd>
				</div>
				<div>
					<dt>Banknote designs</dt>
					<dd class="num">1 · 5 · 10 · 20 · 100 AEY</dd>
				</div>
			</dl>
		</div>
	</div>
</section>

<section class="section surface-raised" id="forms" aria-labelledby="forms-title">
	<div class="container">
		<SectionHeader folio="§ 06.1" eyebrow="Forms" title="Physical and digital" id="forms-title" />
		<div class="forms">
			<article class="form">
				<p class="t-meta form__label">Physical</p>
				<h3 class="t-h3">Banknotes</h3>
				<p>
					A series of five denominations, from 1 to 100 AEY, each with its own colour, portrait and
					theme, drawn in the engraved tradition of banknote art.
				</p>
				<Link href="/banknotes" arrow>The banknote designs</Link>
			</article>
			<article class="form">
				<p class="t-meta form__label">Digital</p>
				<h3 class="t-h3">Aletheia StableChain</h3>
				<p>
					The Guilder is intended to be carried in digital form on Aletheia StableChain, with the
					same value as the banknote and the same single issuer.
				</p>
			</article>
		</div>
	</div>
</section>

<section class="section surface-navy" aria-labelledby="name-title">
	<div class="container split">
		<SectionHeader folio="§ 06.2" eyebrow="The name" title="Guilder" id="name-title" />
		<div class="text">
			<p class="t-lead">
				The guilder is one of Europe’s oldest names for money, long associated with trade across the
				North Sea.
			</p>
			<p>
				The Aletheian Guilder carries that name into a new nation. Its code is AEY. The plural is
				guilders, and amounts are written with the code after the number: 20 AEY.
			</p>
		</div>
	</div>
</section>

<section class="section surface-parchment" aria-labelledby="faq-title">
	<div class="container split">
		<SectionHeader folio="§ 06.3" eyebrow="Questions" title="About the Guilder" id="faq-title">
			{#snippet intro()}
				<p><a href="/faq">All questions and answers</a></p>
			{/snippet}
		</SectionHeader>
		<FaqList items={subset} />
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/banknotes', label: 'Banknote designs' },
		{ href: '/monetary-policy', label: 'Monetary policy' },
		{ href: '/publications', label: 'Publications' }
	]}
/>

<style>
	.sheet {
		position: relative;
		overflow: hidden;
		max-width: 60rem;
		margin-inline: auto;
		padding: clamp(var(--space-5), 4vw, var(--space-8));
		background: var(--c-parchment-50);
		border: var(--hairline) solid var(--rule-strong);
		outline: var(--hairline) solid var(--rule);
		outline-offset: 6px;
	}

	.sheet__ornament {
		position: absolute;
		right: -4rem;
		top: -4rem;
		width: 18rem;
		opacity: 0.45;
		pointer-events: none;
	}

	.sheet__head {
		position: relative;
		display: grid;
		gap: var(--space-2);
		margin-bottom: var(--space-6);
	}

	.sheet__head p {
		color: var(--fg-accent);
	}

	.sheet__head h2 {
		font-size: clamp(3rem, 2rem + 4vw, 5.5rem);
		font-weight: 250;
		letter-spacing: 0.06em;
		line-height: 1;
	}

	.sheet__rows {
		position: relative;
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.sheet__rows div {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-3);
		border-bottom: var(--hairline) solid var(--line);
	}

	@media (min-width: 640px) {
		.sheet__rows div {
			grid-template-columns: 12rem 1fr;
			gap: var(--space-5);
			align-items: baseline;
		}
	}

	.sheet__rows dt {
		font-size: var(--fs-meta);
		font-weight: 600;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	.sheet__rows dd {
		margin: 0;
	}

	.forms {
		display: grid;
		gap: var(--space-6) var(--gutter);
	}

	@media (min-width: 768px) {
		.forms {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.form {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding-top: var(--space-5);
		border-top: 2px solid var(--fg);
	}

	.form__label {
		color: var(--fg-accent);
	}

	.form p:not(.form__label) {
		color: var(--fg-muted);
		max-width: 48ch;
	}

	.text {
		display: grid;
		gap: var(--space-4);
		max-width: var(--measure);
	}

	.text p:not(.t-lead) {
		color: var(--fg-muted);
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
</style>
