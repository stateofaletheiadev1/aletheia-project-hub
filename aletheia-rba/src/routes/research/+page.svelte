<script lang="ts">
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet themes()}
	<dl>
		<div>
			<dt>Monetary policy for a new currency</dt>
			<dd>How a young currency earns and keeps confidence.</dd>
		</div>
		<div>
			<dt>Payments and public ledgers</dt>
			<dd>Settlement, digital money and the design of open records.</dd>
		</div>
		<div>
			<dt>A small, open maritime economy</dt>
			<dd>Trade, prices and financial stability at sea.</dd>
		</div>
		<div>
			<dt>Banknotes</dt>
			<dd>Design, security and the life cycle of cash.</dd>
		</div>
	</dl>
{/snippet}

{#snippet approach()}
	<p class="t-lead">Research keeps policy honest.</p>
	<p>
		The Bank’s research is intended to test its own assumptions, to learn from the experience of
		other nations, and to build knowledge about an economy that has not been studied before. Work
		will be published in full, including findings that challenge the Bank’s views.
	</p>
{/snippet}

{#snippet papers()}
	<EmptyState title="Forthcoming" headingLevel={3} seed={107}>
		<p>Research papers will be published here and listed under Publications.</p>
	</EmptyState>
{/snippet}

<SimplePage
	title="Research"
	headTitle="Research."
	description="Research themes of the Reserve Bank of Aletheia: monetary policy, payments, the maritime economy and banknotes."
	path="/research"
	trail={[{ href: '/research', label: 'Research' }]}
	eyebrow="Research"
	folio="§ 11.2"
	seed={107}
	lead="Evidence behind policy, published in full."
	sections={[
		{ eyebrow: 'Themes', title: 'Research agenda', body: themes },
		{ eyebrow: 'Approach', title: 'Open research', body: approach },
		{ eyebrow: 'Papers', title: 'Research papers', body: papers }
	]}
	related={[
		{ href: '/publications', label: 'Publications' },
		{ href: '/statistics', label: 'Statistics' }
	]}
/>
