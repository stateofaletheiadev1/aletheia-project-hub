<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet approach()}
	<p class="t-lead">
		A new financial system can be built on modern foundations from the first day.
	</p>
	<p>
		The Bank intends to welcome responsible innovation in payments and financial services, and to
		hold it to the same standards of safety and fairness as everything else.
	</p>
{/snippet}

{#snippet safeguards()}
	<p class="t-lead">Innovation and safety go together.</p>
	<p>
		New services that hold or move the public’s money must protect it: clear terms, sound security,
		honest marketing and a way to complain. The Bank intends to hold every provider to the same
		standards, whatever the technology.
	</p>
{/snippet}

{#snippet areas()}
	<dl>
		<div>
			<dt>Digital money</dt>
			<dd>The digital Guilder on AletheiaChain, issued only by the Bank.</dd>
		</div>
		<div>
			<dt>Payments</dt>
			<dd>Instant, low-cost payments between people and businesses.</dd>
		</div>
		<div>
			<dt>Open records</dt>
			<dd>Public ledgers that let anyone check what has been issued.</dd>
		</div>
		<div>
			<dt>Engagement</dt>
			<dd>A channel for innovators to discuss new services with the Bank, to be published here.</dd>
		</div>
	</dl>
{/snippet}

<SimplePage
	title="Innovation"
	headTitle="Innovation."
	description="The Reserve Bank of Aletheia's approach to innovation in money and payments."
	path="/innovation"
	trail={[
		{ href: '/financial-stability', label: 'Financial Stability' },
		{ href: '/innovation', label: 'Innovation' }
	]}
	eyebrow="Innovation"
	folio="§ 03.4"
	seed={191}
	sections={[
		{ eyebrow: 'Approach', title: 'Modern foundations', body: approach },
		{ eyebrow: 'Areas', title: 'Where we look', body: areas },
		{ eyebrow: 'Safeguards', title: 'Safety first', body: safeguards }
	]}
	related={[
		{ href: '/digital-guilder', label: 'Digital Guilder' },
		{ href: '/payments', label: 'Payments' }
	]}
/>
