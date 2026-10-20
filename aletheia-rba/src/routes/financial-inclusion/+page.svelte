<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
</script>

{#snippet why()}
	<p class="t-lead">
		Everyone in Aletheia should be able to save, pay and be paid, safely and simply.
	</p>
	<p>
		A new nation has the chance to build an inclusive financial system from the start, rather than
		repair one later.
	</p>
{/snippet}

{#snippet measuring()}
	<p>
		Progress will be measured, not assumed. The Bank intends to survey how residents save, pay and
		borrow, and to publish the results, so that policy can follow the evidence.
	</p>
{/snippet}

{#snippet principles()}
	<dl>
		<div>
			<dt>Access</dt>
			<dd>Basic payment services within reach of every resident, wherever they live.</dd>
		</div>
		<div>
			<dt>Affordability</dt>
			<dd>Everyday payments at low cost, with fees published plainly.</dd>
		</div>
		<div>
			<dt>Protection</dt>
			<dd>Clear information, fair treatment and a way to complain.</dd>
		</div>
		<div>
			<dt>Understanding</dt>
			<dd>Financial education for every age, through the Bank’s Money and you guides.</dd>
		</div>
	</dl>
{/snippet}

<SimplePage
	title="Financial Inclusion"
	headTitle="Financial inclusion."
	description="The Reserve Bank of Aletheia's approach to an inclusive financial system."
	path="/financial-inclusion"
	trail={[
		{ href: '/financial-stability', label: 'Financial Stability' },
		{ href: '/financial-inclusion', label: 'Financial inclusion' }
	]}
	eyebrow="Financial inclusion"
	folio="§ 03.3"
	seed={181}
	sections={[
		{ eyebrow: 'Why', title: 'A system for everyone', body: why },
		{ eyebrow: 'Principles', title: 'Four principles', body: principles },
		{ eyebrow: 'Evidence', title: 'Measuring progress', body: measuring }
	]}
	related={[
		{ href: '/learn', label: 'Money and you' },
		{ href: '/payments', label: 'Payments' }
	]}
/>
