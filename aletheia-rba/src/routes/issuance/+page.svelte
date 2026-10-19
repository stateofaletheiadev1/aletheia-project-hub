<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import IssuanceRegister from '$lib/components/institutional/IssuanceRegister.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import type { IssuanceRecord } from '$lib/content/schema';

	const records: IssuanceRecord[] = [];

	const lifecycle = [
		{ step: 'Authorise', body: 'Each issue is decided under adopted rules.' },
		{ step: 'Record', body: 'It is entered in the Bank’s accounts and register.' },
		{ step: 'Publish', body: 'The register entry is published here.' },
		{ step: 'Audit', body: 'The register is reviewed independently.' },
		{ step: 'Withdraw', body: 'Retired notes are recorded as they are withdrawn.' }
	];
</script>

<Seo
	title="Issuance Framework"
	description="How the Aletheian Guilder is to be authorised, recorded, published, audited and withdrawn, and the issuance register."
	path="/issuance"
	ogImage="/og/currency.png"
/>

<PageHead
	trail={[
		{ href: '/currency', label: 'The Guilder' },
		{ href: '/issuance', label: 'Issuance' }
	]}
	folio="§ 08"
	eyebrow="Issuance"
	title="Issued on the record."
	seed={17}
>
	{#snippet lead()}
		<p>How the Guilder is to be issued, recorded and accounted for.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="lifecycle-title">
	<div class="container">
		<SectionHeader folio="§ 08.1" eyebrow="Lifecycle" title="Five steps" id="lifecycle-title" />
		<ol role="list" class="lifecycle">
			{#each lifecycle as s, i (s.step)}
				<li class="step" data-reveal use:reveal={i}>
					<div class="step__head">
						<span class="step__num num">{String(i + 1).padStart(2, '0')}</span>
						<span class="step__arrow" aria-hidden="true"></span>
					</div>
					<h3 class="t-h3">{s.step}</h3>
					<p class="step__body">{s.body}</p>
				</li>
			{/each}
		</ol>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="register-title">
	<div class="container">
		<SectionHeader
			folio="§ 08.2"
			eyebrow="Register"
			title="The issuance register"
			id="register-title"
		/>
		<IssuanceRegister {records} />
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/monetary-policy', label: 'Monetary policy' },
		{ href: '/banknotes', label: 'Banknote designs' }
	]}
/>

<style>
	.lifecycle {
		display: grid;
		gap: var(--space-6);
		margin: 0;
	}

	@media (min-width: 1024px) {
		.lifecycle {
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 0;
			border-top: var(--hairline) solid var(--line-strong);
			border-bottom: var(--hairline) solid var(--line-strong);
		}
	}

	.step {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding: var(--space-5) 0 var(--space-5) var(--space-5);
		border-left: 2px solid var(--fg);
	}

	@media (min-width: 1024px) {
		.step {
			padding: var(--space-6) var(--space-5);
			border-left: 0;
		}

		.step + .step {
			border-left: var(--hairline) solid var(--line);
		}
	}

	.step__head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.step__num {
		font-size: var(--fs-meta);
		font-weight: 650;
		letter-spacing: var(--track-meta);
		color: var(--fg-accent);
	}

	.step__arrow {
		display: none;
	}

	@media (min-width: 1024px) {
		.step__arrow {
			display: block;
			position: relative;
			flex: 1;
			height: 1px;
			background: var(--line-strong);
		}

		.step__arrow::after {
			content: '';
			position: absolute;
			right: 0;
			top: -3px;
			width: 7px;
			height: 7px;
			border-top: 1px solid var(--rule-strong);
			border-right: 1px solid var(--rule-strong);
			transform: rotate(45deg);
		}

		.step:last-child .step__arrow {
			visibility: hidden;
		}
	}

	.step__body {
		color: var(--fg-muted);
	}
</style>
