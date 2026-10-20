<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet sea()}
	<p class="t-lead">
		Aletheia is a maritime nation. The health of the sea is the health of its economy.
	</p>
	<p>
		Weather, rising seas and the shift to clean energy can all affect prices, institutions and the
		financial system. The Bank intends to take these risks into account in its work.
	</p>
{/snippet}

{#snippet work()}
	<dl>
		<div>
			<dt>Understanding risk</dt>
			<dd>
				Climate and environmental risks included in the Bank’s assessment of financial stability.
			</dd>
		</div>
		<div>
			<dt>Its own operations</dt>
			<dd>Efficient use of energy and materials, from offices to banknote production.</dd>
		</div>
		<div>
			<dt>Reporting</dt>
			<dd>Climate-related disclosures in the Bank’s annual report.</dd>
		</div>
	</dl>
{/snippet}

<SimplePage
	title="Sustainability"
	headTitle="Sustainability."
	description="How the Reserve Bank of Aletheia intends to consider climate and the sea in its work."
	path="/sustainability"
	trail={[
		{ href: '/financial-stability', label: 'Financial Stability' },
		{ href: '/sustainability', label: 'Sustainability' }
	]}
	eyebrow="Sustainability"
	folio="§ 03.5"
	seed={193}
	sections={[
		{ eyebrow: 'The sea', title: 'A maritime nation', body: sea },
		{ eyebrow: 'Our work', title: 'Three commitments', body: work }
	]}
	related={[
		{ href: '/financial-stability', label: 'Financial stability' },
		{ href: '/about/strategy', label: 'Strategic priorities' }
	]}
/>
