<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import PullStatement from '$lib/components/editorial/PullStatement.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const stages = [
		{
			name: 'Research',
			body: 'Proposals are prepared with their evidence and the options considered.'
		},
		{
			name: 'Consultation',
			body: 'Proposals are published for public comment, with a period to respond.'
		},
		{
			name: 'Adoption',
			body: 'Policy is adopted by the competent body and the decision is recorded.'
		},
		{
			name: 'Publication',
			body: 'The adopted policy is published here, together with its reasons.'
		},
		{ name: 'Review', body: 'Each policy is reviewed on a set date, through the same process.' }
	];

	const principles = [
		[
			'Issuance follows rules',
			'Currency is issued only under adopted rules that say when, how much and on whose decision.'
		],
		[
			'Issuance is recorded',
			'Every issue is entered in a public register, so that the amount of money in existence is always known.'
		],
		[
			'The issuer does not spend',
			'The Bank does not create money to finance the State’s budget. Public spending is paid for by public revenue.'
		],
		[
			'Stability',
			'Keeping the Guilder’s purchasing power steady over time is the central consideration of policy.'
		]
	];
</script>

<Seo
	title="Monetary Policy Framework"
	description="The intended fiat framework for the Aletheian Guilder, its principles, and how monetary policy will be decided."
	path="/monetary-policy"
	ogImage="/og/monetary-policy.png"
/>

<PageHead
	trail={[{ href: '/monetary-policy', label: 'Monetary Policy' }]}
	folio="§ 02"
	eyebrow="Monetary policy"
	title="A framework decided in public."
	seed={5}
>
	{#snippet lead()}
		<p>The intended approach to the Aletheian Guilder, and how its policy will be decided.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="fiat-title">
	<div class="container split">
		<SectionHeader
			folio="§ 02.1"
			eyebrow="Intended framework"
			title="A fiat currency"
			id="fiat-title"
		/>
		<div class="body">
			<PullStatement>
				A fiat currency is trusted for the rules that govern it, not for a promise to exchange it.
			</PullStatement>
			<p class="measure">
				The intended direction for the Guilder is a fiat currency: money issued by the State’s
				monetary institution under law, as most of the world’s currencies are.
			</p>
		</div>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="principles-title">
	<div class="container">
		<SectionHeader
			folio="§ 02.2"
			eyebrow="Principles"
			title="Responsible issuance"
			id="principles-title"
		/>
		<dl class="principles">
			{#each principles as [term, desc], i (term)}
				<div data-reveal use:reveal={i}>
					<dt class="t-h4">{term}</dt>
					<dd>{desc}</dd>
				</div>
			{/each}
		</dl>
	</div>
</section>

<section class="section surface-parchment" aria-labelledby="process-title">
	<div class="container">
		<SectionHeader
			folio="§ 02.3"
			eyebrow="Process"
			title="How policy will be decided"
			id="process-title"
		/>
		<ol role="list" class="process">
			{#each stages as s, i (s.name)}
				<li data-reveal use:reveal={i}>
					<span class="process__num t-meta">Stage {i + 1}</span>
					<span class="process__tick" aria-hidden="true"></span>
					<h3 class="t-h3">{s.name}</h3>
					<p>{s.body}</p>
				</li>
			{/each}
		</ol>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="works-title">
	<div class="container split">
		<SectionHeader
			folio="§ 02.4"
			eyebrow="Explainer"
			title="How monetary policy works"
			id="works-title"
		/>
		<div class="body measure">
			<p class="t-lead">
				A central bank influences the cost and availability of money, and through them spending,
				saving and prices.
			</p>
			<p>
				When money is plentiful and cheap to borrow, households and businesses tend to spend and
				invest more; when it is scarcer, they save more and spend less. Over time this affects how
				fast prices rise. Monetary policy uses this connection to keep prices stable, adjusting with
				care because its effects take time to show.
			</p>
			<p>
				The instruments the Bank will use, and the measure by which it will judge its success, will
				be set out in its monetary policy framework.
			</p>
		</div>
	</div>
</section>

<section class="section surface-navy" aria-labelledby="comms-title">
	<div class="container split">
		<SectionHeader
			folio="§ 02.5"
			eyebrow="Communication"
			title="Decisions, explained"
			id="comms-title"
		/>
		<dl class="principles comms">
			<div>
				<dt class="t-h4">A published calendar</dt>
				<dd>Policy decisions will be taken on dates announced in advance.</dd>
			</div>
			<div>
				<dt class="t-h4">A statement with every decision</dt>
				<dd>Each decision will be published with a statement of its reasons.</dd>
			</div>
			<div>
				<dt class="t-h4">A regular report</dt>
				<dd>A monetary policy report will set out the Bank’s assessment of the economy.</dd>
			</div>
		</dl>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/issuance', label: 'Issuance' },
		{ href: '/reserves', label: 'Reserves and exchange' },
		{ href: '/currency', label: 'The Aletheian Guilder' }
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

	.body {
		display: grid;
		gap: var(--space-5);
		align-content: start;
	}

	.principles {
		display: grid;
		margin: 0;
		gap: 0 var(--gutter);
		border-top: var(--hairline) solid var(--line-strong);
	}

	@media (min-width: 768px) {
		.principles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.principles div {
		display: grid;
		gap: var(--space-2);
		padding-block: var(--space-5);
		border-bottom: var(--hairline) solid var(--line);
	}

	.comms {
		grid-template-columns: 1fr !important;
	}

	.principles dd {
		margin: 0;
		color: var(--fg-muted);
	}

	/* The process as a ruled timeline: one rule across, a tick at each stage. */
	.process {
		position: relative;
		display: grid;
		margin: 0;
		gap: var(--space-6);
	}

	@media (min-width: 1024px) {
		.process {
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: var(--gutter);
		}

		.process::before {
			content: '';
			position: absolute;
			left: 0;
			right: 0;
			top: calc(1.4rem + var(--space-3) + 4px);
			height: 1px;
			background: var(--line-strong);
		}
	}

	.process li {
		position: relative;
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding-left: var(--space-5);
		border-left: var(--hairline) solid var(--line-strong);
	}

	@media (min-width: 1024px) {
		.process li {
			padding-left: 0;
			border-left: 0;
		}
	}

	.process__num {
		color: var(--fg-accent);
	}

	.process__tick {
		display: none;
	}

	@media (min-width: 1024px) {
		.process__tick {
			display: block;
			width: 9px;
			height: 9px;
			border: 1.5px solid var(--fg);
			background: var(--bg);
			transform: rotate(45deg);
			position: relative;
			z-index: 1;
		}
	}

	.process p {
		color: var(--fg-muted);
	}
</style>
