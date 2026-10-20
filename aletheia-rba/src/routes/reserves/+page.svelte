<script lang="ts">
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import DisclosureNotice from '$lib/components/institutional/DisclosureNotice.svelte';
	import ReserveReports from '$lib/components/institutional/ReserveReports.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import type { ReserveReport } from '$lib/content/schema';

	/** Only validated reports with a source document may ever be listed here. */
	const reports: ReserveReport[] = [];
</script>

<Seo
	title="Foreign Reserves and Exchange Policy"
	description="Reserve and exchange policy of the Reserve Bank of Aletheia, and its reserve reports."
	path="/reserves"
	ogImage="/og/reserves.png"
/>

<PageHead
	trail={[{ href: '/reserves', label: 'Reserves' }]}
	folio="§ 05"
	eyebrow="Reserves and exchange"
	title="Reserves and exchange."
	seed={23}
/>

<section class="section surface-parchment" aria-labelledby="position-title">
	<div class="container split">
		<SectionHeader
			folio="§ 05.1"
			eyebrow="Approach"
			title="Policy and reporting"
			id="position-title"
		/>
		<div class="stack">
			<p class="t-lead">
				Reserves are the assets a central bank holds to meet the nation’s needs for foreign
				currency, and to support confidence in its own.
			</p>
			<p class="muted">
				Where they are held, central banks manage reserves with three aims, in order: safety first,
				then liquidity, so that they can be used when needed, and only then return. The Bank’s
				policy on reserves and on the exchange rate of the Guilder will be set through the same
				process as its monetary policy: research, consultation, adoption and publication.
			</p>
			<DisclosureNotice label="Policy">
				<p>
					The Bank’s reserve and exchange policy will be published here, together with regular
					reserve reports.
				</p>
			</DisclosureNotice>
		</div>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="reports-title">
	<div class="container">
		<SectionHeader folio="§ 05.2" eyebrow="Reporting" title="Reserve reports" id="reports-title" />
		<ReserveReports {reports} />
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/monetary-policy', label: 'Monetary policy' },
		{ href: '/faq', label: 'Questions and answers' }
	]}
/>

<style>
	.stack {
		display: grid;
		gap: var(--space-5);
		align-content: start;
	}

	.muted {
		color: var(--fg-muted);
		max-width: var(--measure);
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
