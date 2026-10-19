<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import PullStatement from '$lib/components/editorial/PullStatement.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const roles = [
		{
			title: 'Monitor',
			body: 'Watch for risks that build up across banks, markets and payment systems.'
		},
		{
			title: 'Assess',
			body: 'Judge how well the financial system could withstand a shock.'
		},
		{
			title: 'Report',
			body: 'Publish its assessment regularly in a Financial Stability Review.'
		},
		{
			title: 'Respond',
			body: 'Act with others to keep essential financial services running in a disruption.'
		}
	];
</script>

<Seo
	title="Financial Stability"
	description="The Reserve Bank of Aletheia's role in keeping Aletheia's financial system safe and resilient."
	path="/financial-stability"
/>

<PageHead
	trail={[{ href: '/financial-stability', label: 'Financial Stability' }]}
	folio="§ 03"
	eyebrow="Financial stability"
	title="A sound financial system."
	seed={67}
>
	{#snippet lead()}
		<p>A financial system that households and businesses can rely on, in good times and in bad.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="why-title">
	<div class="container split">
		<SectionHeader
			folio="§ 03.1"
			eyebrow="Why it matters"
			title="Confidence, kept"
			id="why-title"
		/>
		<PullStatement>
			Money is only as useful as the system that moves it, holds it and lends it.
		</PullStatement>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="role-title">
	<div class="container">
		<SectionHeader folio="§ 03.2" eyebrow="The Bank’s role" title="Four tasks" id="role-title" />
		<ol role="list" class="roles">
			{#each roles as r, i (r.title)}
				<li data-reveal use:reveal={i}>
					<span class="t-meta num">{String(i + 1).padStart(2, '0')}</span>
					<h3 class="t-h3">{r.title}</h3>
					<p>{r.body}</p>
				</li>
			{/each}
		</ol>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/payments', label: 'Payments' },
		{ href: '/monetary-policy', label: 'Monetary policy' },
		{ href: '/publications', label: 'Publications' }
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

	.roles {
		display: grid;
		gap: var(--space-6) var(--gutter);
		margin: 0;
	}

	@media (min-width: 768px) {
		.roles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1280px) {
		.roles {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	.roles li {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 2px solid var(--fg);
	}

	.roles .num {
		color: var(--fg-accent);
	}

	.roles p {
		color: var(--fg-muted);
	}
</style>
