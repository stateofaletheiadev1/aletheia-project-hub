<script lang="ts">
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet work()}
	<p class="t-lead">Public service at the heart of a new nation’s economy.</p>
	<p>
		The Bank looks for economists, statisticians, lawyers, engineers and specialists in payments,
		banknotes and finance, who value accuracy, integrity and discretion.
	</p>
{/snippet}

{#snippet vacancies()}
	<EmptyState title="Forthcoming" headingLevel={3} seed={103}>
		<p>Vacancies at the Bank will be published here.</p>
	</EmptyState>
{/snippet}

<SimplePage
	title="Careers"
	headTitle="Careers at the Bank."
	description="Working at the Reserve Bank of Aletheia, and where its vacancies are published."
	path="/about/careers"
	trail={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/careers', label: 'Careers' }
	]}
	eyebrow="Careers"
	folio="§ 01.10"
	seed={103}
	sections={[
		{ eyebrow: 'Working here', title: 'Who we look for', body: work },
		{ eyebrow: 'Vacancies', title: 'Current vacancies', body: vacancies }
	]}
	related={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/governance', label: 'Governance' }
	]}
/>
