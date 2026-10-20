<script lang="ts">
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import BankSeal from '$lib/components/brand/BankSeal.svelte';
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Icon from '$lib/components/primitives/Icon.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const assets = [
		{ href: '/rba-mark.svg', label: 'Mark of the Bank', format: 'SVG, vector' },
		{ href: '/logo.png', label: 'Mark of the Bank', format: 'PNG, 512 × 512' },
		{ href: '/icon-512.png', label: 'Mark on navy', format: 'PNG, 512 × 512' },
		{ href: '/og/default.png', label: 'Title card', format: 'PNG, 1200 × 630' }
	];
</script>

<Seo
	title="Media Centre"
	description="Press releases, speeches and brand assets of the Reserve Bank of Aletheia."
	path="/media"
/>

<PageHead
	trail={[{ href: '/media', label: 'Media centre' }]}
	folio="§ 10.2"
	eyebrow="Media centre"
	title="For the press."
	seed={199}
>
	{#snippet lead()}
		<p>Announcements, speeches and the Bank’s official marks.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="releases-title">
	<div class="container split">
		<SectionHeader folio="§ 10.2.1" eyebrow="Releases" title="Press releases" id="releases-title" />
		<div class="stack">
			<p class="t-lead">Press releases and notices are published under News.</p>
			<p><a href="/news">News and notices</a></p>
		</div>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="speeches-title">
	<div class="container split">
		<SectionHeader folio="§ 10.2.2" eyebrow="Speeches" title="Speeches" id="speeches-title" />
		<EmptyState title="Forthcoming" headingLevel={3} seed={211}>
			<p>Speeches by the Governor and senior officials will be published here.</p>
		</EmptyState>
	</div>
</section>

<section class="section surface-navy" aria-labelledby="assets-title">
	<div class="container split">
		<div class="stack">
			<SectionHeader folio="§ 10.2.3" eyebrow="Brand" title="Official marks" id="assets-title" />
			<BankSeal variant="mark" size={140} />
		</div>
		<div class="stack">
			<ul role="list" class="assets">
				{#each assets as a (a.href)}
					<li>
						<a href={a.href} download>
							<Icon name="download" size={18} />
							<span class="asset__label">{a.label}</span>
							<span class="asset__format t-fine">{a.format}</span>
						</a>
					</li>
				{/each}
			</ul>
			<p class="t-fine use">
				The marks may be used to refer to the Bank in news reporting. They may not be altered, or
				used in a way that suggests endorsement. Banknote images are subject to the
				<a href="/banknotes/reproduction">reproduction rules</a>.
			</p>
		</div>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/news', label: 'News' },
		{ href: '/about/seal', label: 'The seal of the Bank' },
		{ href: '/contact', label: 'Contact' }
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

	.stack {
		display: grid;
		gap: var(--space-4);
		align-content: start;
	}

	.assets {
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.assets a {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-3);
		align-items: center;
		padding-block: var(--space-4);
		border-bottom: var(--hairline) solid var(--line);
		text-decoration: none;
	}

	.assets a:hover .asset__label {
		text-decoration: underline;
	}

	.asset__label {
		font-weight: 600;
	}

	.asset__format {
		color: var(--fg-muted);
	}

	.use {
		color: var(--fg-muted);
		max-width: 56ch;
	}
</style>
