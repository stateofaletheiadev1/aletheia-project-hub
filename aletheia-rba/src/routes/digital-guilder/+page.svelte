<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet what()}
	<p class="t-lead">The same Guilder as the banknote, held and paid in digital form.</p>
	<p>
		The digital Guilder is intended to be carried on Aletheia StableChain, the State’s settlement
		ledger, and issued only by the Reserve Bank of Aletheia.
	</p>
{/snippet}

{#snippet principles()}
	<dl>
		<div>
			<dt>One currency</dt>
			<dd>A digital Guilder is worth exactly one Guilder in banknotes.</dd>
		</div>
		<div>
			<dt>One issuer</dt>
			<dd>Only the Reserve Bank of Aletheia can create it.</dd>
		</div>
		<div>
			<dt>One record</dt>
			<dd>Every issue is entered in the Bank’s public register.</dd>
		</div>
	</dl>
{/snippet}

<SimplePage
	title="The Digital Guilder"
	headTitle="The digital Guilder."
	description="The Aletheian Guilder in digital form, intended to be carried on Aletheia StableChain and issued by the Reserve Bank of Aletheia."
	path="/digital-guilder"
	trail={[
		{ href: '/currency', label: 'The Guilder' },
		{ href: '/digital-guilder', label: 'Digital Guilder' }
	]}
	eyebrow="Digital Guilder"
	folio="§ 06.3"
	seed={109}
	sections={[
		{ eyebrow: 'What it is', title: 'Money in digital form', body: what },
		{ eyebrow: 'Principles', title: 'Three rules', body: principles }
	]}
	related={[
		{ href: '/currency', label: 'The Aletheian Guilder' },
		{ href: '/payments', label: 'Payments' },
		{ href: '/issuance', label: 'Issuance' }
	]}
/>
