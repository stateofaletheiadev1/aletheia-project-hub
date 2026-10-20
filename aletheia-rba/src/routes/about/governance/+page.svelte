<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
	import { SITE } from '$lib/content';
</script>

{#snippet structure()}
	<dl>
		<div>
			<dt>The Board</dt>
			<dd>
				Oversees the Bank’s management, approves its budget and accounts, and answers for its
				conduct.
			</dd>
		</div>
		<div>
			<dt>The Governor</dt>
			<dd>Leads the Bank, chairs its policy committee and speaks for it in public.</dd>
		</div>
		<div>
			<dt>Monetary Policy Committee</dt>
			<dd>Decides monetary policy on a published calendar, and explains each decision.</dd>
		</div>
		<div>
			<dt>Audit Committee</dt>
			<dd>Oversees the Bank’s accounts, its internal audit and its independent external audit.</dd>
		</div>
	</dl>
{/snippet}

{#snippet accountability()}
	<p class="t-lead">The Bank reports in public on its decisions, its accounts and its issuance.</p>
	<p>Its annual report and audited financial statements will be published under Publications.</p>
{/snippet}

{#snippet appointments()}
	<p class="t-lead">Appointments are made on merit, for fixed terms, under published rules.</p>
	<p>
		Members of the Bank’s governing bodies are to be chosen for their expertise and integrity, serve
		for fixed terms, declare their interests, and be removable only for the reasons set out in law.
		These safeguards protect the Bank’s independence and the public’s trust in it.
	</p>
{/snippet}

{#snippet legal()}
	<p>
		The Bank is to be established by law of the {SITE.state}. Its founding law, and the rules made
		under it, will be published here.
	</p>
{/snippet}

<SimplePage
	title="Governance"
	headTitle="Governance."
	description="How the Reserve Bank of Aletheia is governed: its Board, Governor, committees and legal framework."
	path="/about/governance"
	trail={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/governance', label: 'Governance' }
	]}
	eyebrow="Governance"
	folio="§ 01.8"
	seed={97}
	lead="Clear responsibilities, decided in public."
	sections={[
		{ eyebrow: 'Structure', title: 'Who decides', body: structure },
		{ eyebrow: 'Accountability', title: 'Answerable in public', body: accountability },
		{ eyebrow: 'Appointments', title: 'Chosen on merit', body: appointments },
		{ eyebrow: 'Legal framework', title: 'Founded in law', body: legal }
	]}
	related={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/monetary-policy', label: 'Monetary policy' },
		{ href: '/publications', label: 'Publications' }
	]}
/>
