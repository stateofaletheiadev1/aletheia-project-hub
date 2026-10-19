<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import BanknoteStage from '$lib/components/currency/BanknoteStage.svelte';
	import DenominationStrip from '$lib/components/currency/DenominationStrip.svelte';
	import Eyebrow from '$lib/components/editorial/Eyebrow.svelte';
	import PullStatement from '$lib/components/editorial/PullStatement.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import Link from '$lib/components/primitives/Link.svelte';
	import ButtonLink from '$lib/components/primitives/ButtonLink.svelte';
	import PublicationEntry from '$lib/components/publications/PublicationEntry.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { banknotes, publications, SITE } from '$lib/content';
	import { artworkFor } from '$lib/content/banknote-artwork';
	import { organization, website } from '$lib/seo/jsonld';

	const hundred = banknotes.find((b) => b.denomination === 100) ?? banknotes[banknotes.length - 1];
	const heroArt = hundred ? artworkFor(hundred.front.src) : null;

	const latest = publications.slice(0, 3);

	const columns = [
		{
			title: 'A fiat currency',
			body: 'Money issued by a public institution under law, as most of the world’s currencies are.'
		},
		{
			title: 'Issued by rule',
			body: 'Issuance under published rules, recorded and reported in public.'
		},
		{
			title: 'Decided in public',
			body: 'Policy prepared, consulted on and published before it is adopted.'
		}
	];

	const mandate = [
		['Issue', 'To issue and safeguard the Aletheian Guilder.'],
		['Set policy', 'To set and publish monetary policy.'],
		['Keep the record', 'To account in public for all it issues.']
	];
</script>

<Seo
	title="Reserve Bank of Aletheia: Monetary Institution of the Aletheian Guilder"
	description="The Reserve Bank of Aletheia: the monetary institution being established for the Sovereign Covenant State of Aletheia, and issuer of the Aletheian Guilder (AEY)."
	path="/"
	jsonLd={[organization(), website()]}
/>

<section class="hero surface-navy" aria-labelledby="hero-title">
	<div class="container hero__grid">
		<div class="hero__text">
			<Eyebrow>{SITE.name}</Eyebrow>
			<h1 id="hero-title" class="t-display">
				<span class="line"><span>Stewardship of</span></span>
				<span class="line"><span>the Aletheian</span></span>
				<span class="line"><span>Guilder.</span></span>
			</h1>
			<p class="t-lead hero__lead">
				The monetary institution being established for the {SITE.state}, and the issuer of its
				currency, the Aletheian Guilder.
			</p>
			<div class="hero__actions">
				<ButtonLink href="/currency">The Aletheian Guilder</ButtonLink>
				<ButtonLink href="/about" variant="secondary">About the Bank</ButtonLink>
			</div>
		</div>
		{#if hundred && heroArt}
			<div class="hero__stage">
				<BanknoteStage
					art={heroArt}
					alt={hundred.front.alt}
					caption="100 AEY, front. Specimen."
					eager
					seed={11}
				/>
			</div>
		{/if}
	</div>
</section>

<section class="section surface-parchment" aria-labelledby="guilder-title">
	<div class="container">
		<div class="guilder__head">
			<SectionHeader
				folio="§ 01"
				eyebrow="The Guilder"
				title="Five denominations, in design."
				id="guilder-title"
			>
				{#snippet intro()}
					<p>The banknote series of the Guilder, designed in five denominations.</p>
				{/snippet}
			</SectionHeader>
		</div>
		<DenominationStrip notes={banknotes} />
		<div class="guilder__foot">
			<p class="t-meta guilder__note">1 · 5 · 10 · 20 · 100 AEY</p>
			<Link href="/banknotes" arrow>See the banknote designs</Link>
		</div>
	</div>
</section>

<section class="section surface-raised framework" aria-labelledby="framework-title">
	<div class="container">
		<SectionHeader
			folio="§ 02"
			eyebrow="Monetary framework"
			title="A currency held to account."
			id="framework-title"
		/>
		<div class="framework__grid">
			<div class="framework__pull">
				<PullStatement>
					A fiat currency is trusted for the rules that govern it, not for a promise to exchange it.
				</PullStatement>
			</div>
			<ol role="list" class="framework__cols">
				{#each columns as col, i (col.title)}
					<li data-reveal use:reveal={i}>
						<span class="t-meta col__num">{String(i + 1).padStart(2, '0')}</span>
						<h3 class="t-h4">{col.title}</h3>
						<p>{col.body}</p>
					</li>
				{/each}
			</ol>
		</div>
		<p class="framework__more">
			<Link href="/monetary-policy" arrow>The monetary policy framework</Link>
		</p>
	</div>
</section>

<section class="section surface-navy" aria-labelledby="bank-title">
	<div class="container status__grid">
		<div class="status__intro">
			<SectionHeader
				folio="§ 03"
				eyebrow="The Bank"
				title="Steward of the Guilder."
				id="bank-title"
			/>
			<Link href="/about" arrow>About the Bank</Link>
		</div>
		<dl class="mandate">
			{#each mandate as [term, desc], i (term)}
				<div data-reveal use:reveal={i}>
					<dt class="t-h3">{term}</dt>
					<dd>{desc}</dd>
				</div>
			{/each}
		</dl>
	</div>
</section>

<section class="section surface-parchment" aria-labelledby="pubs-title">
	<div class="container">
		<SectionHeader
			folio="§ 04"
			eyebrow="Publications"
			title="The written record."
			id="pubs-title"
		/>
		{#if latest.length}
			<ol role="list" class="pubs">
				{#each latest as p (p.meta.slug)}
					<li><PublicationEntry meta={p.meta} /></li>
				{/each}
			</ol>
			<p class="pubs__more"><Link href="/publications" arrow>All publications</Link></p>
		{:else}
			<EmptyState title="Forthcoming">
				<p>Publications of the Bank will appear here.</p>
				{#snippet actions()}
					<Link href="/publications" arrow>About publications</Link>
				{/snippet}
			</EmptyState>
		{/if}
	</div>
</section>

<style>
	.hero {
		position: relative;
		overflow: hidden;
		padding-top: calc(var(--masthead-h) + clamp(var(--space-7), 6vw, var(--space-9)));
		padding-bottom: clamp(var(--space-8), 8vw, var(--space-10));
	}

	.hero__grid {
		display: grid;
		gap: var(--space-8);
		align-items: center;
	}

	@media (min-width: 1024px) {
		.hero__grid {
			grid-template-columns: 7fr 5fr;
			gap: var(--gutter);
		}
	}

	.hero__text {
		display: grid;
		gap: var(--space-6);
		position: relative;
		z-index: 1;
	}

	.hero h1 {
		max-width: 12ch;
	}

	/* Line-masked headline: each line slides up from behind its own clip. */
	.line {
		display: block;
		overflow: hidden;
		padding-bottom: 0.06em;
	}

	.line > span {
		display: inline-block;
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.js) .line > span {
			animation: rise var(--dur-4) var(--ease-out-quart) both;
		}

		:global(.js) .line:nth-child(2) > span {
			animation-delay: 80ms;
		}

		:global(.js) .line:nth-child(3) > span {
			animation-delay: 160ms;
		}
	}

	@keyframes rise {
		from {
			transform: translateY(105%);
		}
		to {
			transform: none;
		}
	}

	.hero__lead {
		color: var(--fg-muted);
		max-width: 46ch;
	}

	.hero__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}

	.hero__stage {
		position: relative;
	}

	@media (max-width: 1023px) {
		.hero__stage {
			margin-inline: calc(-1 * var(--gutter));
		}

		.hero__stage :global(figcaption) {
			margin-inline: var(--gutter);
		}
	}

	.guilder__head {
		max-width: 48rem;
	}

	.guilder__foot {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: var(--hairline) solid var(--line-strong);
	}

	.guilder__note {
		color: var(--fg-muted);
	}

	.framework__grid {
		display: grid;
		gap: var(--space-7);
	}

	@media (min-width: 1024px) {
		.framework__grid {
			grid-template-columns: 4fr 8fr;
			gap: var(--gutter);
		}
	}

	.framework__cols {
		display: grid;
		gap: var(--space-6) var(--gutter);
		margin: 0;
	}

	@media (min-width: 768px) {
		.framework__cols {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.framework__cols li {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: var(--hairline) solid var(--line-strong);
	}

	@media (min-width: 768px) {
		.framework__cols li + li {
			border-left: var(--hairline) solid var(--line);
			padding-left: var(--space-5);
			margin-left: calc(-1 * var(--space-5) + var(--hairline));
		}
	}

	.col__num {
		color: var(--fg-accent);
	}

	.framework__cols p {
		color: var(--fg-muted);
	}

	.framework__more {
		margin-top: var(--space-7);
	}

	.status__grid {
		display: grid;
		gap: var(--space-7);
	}

	@media (min-width: 1024px) {
		.status__grid {
			grid-template-columns: 4fr 8fr;
			gap: calc(var(--gutter) * 2);
		}
	}

	.status__intro {
		display: grid;
		align-content: start;
		gap: var(--space-4);
	}

	.status__intro :global(.section-header) {
		margin-bottom: var(--space-3);
	}

	.mandate {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.mandate div {
		display: grid;
		gap: var(--space-2);
		padding-block: var(--space-5);
		border-bottom: var(--hairline) solid var(--line);
	}

	@media (min-width: 768px) {
		.mandate div {
			grid-template-columns: 14rem 1fr;
			align-items: baseline;
		}
	}

	.mandate dd {
		margin: 0;
		color: var(--fg-muted);
		font-size: var(--fs-lead);
	}

	.pubs {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.pubs__more {
		margin-top: var(--space-6);
	}
</style>
