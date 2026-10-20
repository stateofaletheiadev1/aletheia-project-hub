<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet policy()}
	<dl>
		<div>
			<dt>Monetary Policy and Research</dt>
			<dd>Economic analysis, forecasts and the preparation of policy decisions.</dd>
		</div>
		<div>
			<dt>Statistics</dt>
			<dd>Monetary and financial statistics, compiled to international standards.</dd>
		</div>
		<div>
			<dt>Financial Stability</dt>
			<dd>Monitoring of risks across the financial system.</dd>
		</div>
	</dl>
{/snippet}

{#snippet operations()}
	<dl>
		<div>
			<dt>Currency</dt>
			<dd>Banknote design, production, issue and withdrawal.</dd>
		</div>
		<div>
			<dt>Payments and Settlement</dt>
			<dd>Settlement services, the digital Guilder and payment system oversight.</dd>
		</div>
		<div>
			<dt>Reserves and Markets</dt>
			<dd>Management of any reserve assets and the Bank’s market operations.</dd>
		</div>
	</dl>
{/snippet}

{#snippet corporate()}
	<dl>
		<div>
			<dt>Legal</dt>
			<dd>The Bank’s legal framework, rules and contracts.</dd>
		</div>
		<div>
			<dt>Finance and Risk</dt>
			<dd>The Bank’s own accounts, budget and risk management.</dd>
		</div>
		<div>
			<dt>Internal Audit</dt>
			<dd>Independent assurance, reporting to the Audit Committee.</dd>
		</div>
		<div>
			<dt>Communications</dt>
			<dd>Publications, media relations and public education.</dd>
		</div>
		<div>
			<dt>People and Technology</dt>
			<dd>The Bank’s staff, systems and information security.</dd>
		</div>
	</dl>
{/snippet}

<SimplePage
	title="Organisation"
	headTitle="Organisation."
	description="How the Reserve Bank of Aletheia is organised: its policy, operational and corporate functions."
	path="/about/organisation"
	trail={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/organisation', label: 'Organisation' }
	]}
	eyebrow="Organisation"
	folio="§ 01.13"
	seed={163}
	lead="Three groups of functions, under the Governor."
	sections={[
		{ eyebrow: 'Policy', title: 'Policy and analysis', body: policy },
		{ eyebrow: 'Operations', title: 'Operations', body: operations },
		{ eyebrow: 'Corporate', title: 'Corporate services', body: corporate }
	]}
	related={[
		{ href: '/about/governance', label: 'Governance' },
		{ href: '/about/careers', label: 'Careers' }
	]}
/>
