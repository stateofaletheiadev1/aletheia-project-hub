<script lang="ts">
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet approach()}
	<p class="t-lead">Open, fair and recorded.</p>
	<p>
		The Bank buys goods and services through open competition, and publishes its tenders and the
		contracts it awards.
	</p>
{/snippet}

{#snippet tenders()}
	<EmptyState title="Forthcoming" headingLevel={3} seed={127}>
		<p>Tender notices will be published here.</p>
	</EmptyState>
{/snippet}

<SimplePage
	title="Procurement"
	headTitle="Procurement."
	description="How the Reserve Bank of Aletheia buys goods and services, and where its tenders are published."
	path="/procurement"
	trail={[{ href: '/procurement', label: 'Procurement' }]}
	eyebrow="Procurement"
	seed={127}
	sections={[
		{ eyebrow: 'Approach', title: 'How we buy', body: approach },
		{ eyebrow: 'Tenders', title: 'Current tenders', body: tenders }
	]}
	related={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/fraud-warning', label: 'Fraud warning' }
	]}
/>
