<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet code()}
	<p class="t-lead">Everyone who works for the Bank serves the public interest alone.</p>
	<ul>
		<li>Interests that could conflict with the Bank’s work are declared and recorded.</li>
		<li>Confidential information is never used for personal gain.</li>
		<li>Gifts and hospitality are declined or declared.</li>
		<li>Personal financial dealings are subject to the Bank’s rules.</li>
	</ul>
{/snippet}

{#snippet reporting()}
	<p>
		Anyone may report suspected wrongdoing at the Bank in confidence, without fear of reprisal. The
		reporting channel will be published here.
	</p>
{/snippet}

{#snippet oversight()}
	<p>
		Internal Audit reports to the Audit Committee, and the Bank’s accounts are examined by an
		independent external auditor. Audit reports are published.
	</p>
{/snippet}

<SimplePage
	title="Ethics and Integrity"
	headTitle="Ethics and integrity."
	description="The code of conduct, whistleblowing and audit arrangements of the Reserve Bank of Aletheia."
	path="/about/integrity"
	trail={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/integrity', label: 'Ethics and integrity' }
	]}
	eyebrow="Ethics and integrity"
	folio="§ 01.14"
	seed={167}
	sections={[
		{ eyebrow: 'Conduct', title: 'Code of conduct', body: code },
		{ eyebrow: 'Reporting', title: 'Raising a concern', body: reporting },
		{ eyebrow: 'Oversight', title: 'Audit', body: oversight }
	]}
	related={[
		{ href: '/about/governance', label: 'Governance' },
		{ href: '/about/mission', label: 'Mission and values' }
	]}
/>
