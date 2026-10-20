<script lang="ts">
	import SimplePage from '$lib/components/layout/SimplePage.svelte';
	import { SITE } from '$lib/content';
</script>

{#snippet vision()}
	<p class="t-lead">A currency the people of Aletheia can trust, today and for generations.</p>
{/snippet}

{#snippet mission()}
	<p class="t-lead">
		To issue and safeguard the Aletheian Guilder, to keep its value stable, and to support a sound
		financial system for the {SITE.state}.
	</p>
{/snippet}

{#snippet values()}
	<dl>
		<div>
			<dt>Truth</dt>
			<dd>We say what is, and we keep an honest record. <em>Veritas in Foedere.</em></dd>
		</div>
		<div>
			<dt>Integrity</dt>
			<dd>We act in the public interest and never for private gain.</dd>
		</div>
		<div>
			<dt>Independence</dt>
			<dd>We decide on the evidence, within the law that founds us.</dd>
		</div>
		<div>
			<dt>Transparency</dt>
			<dd>We publish our decisions, our reasons and our accounts.</dd>
		</div>
		<div>
			<dt>Stewardship</dt>
			<dd>We take the long view, for the generations who will hold the Guilder.</dd>
		</div>
	</dl>
{/snippet}

<SimplePage
	title="Mission and Values"
	headTitle="Mission and values."
	description="The vision, mission and values of the Reserve Bank of Aletheia."
	path="/about/mission"
	trail={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/mission', label: 'Mission and values' }
	]}
	eyebrow="Mission and values"
	folio="§ 01.11"
	seed={151}
	sections={[
		{ eyebrow: 'Vision', title: 'What we work towards', body: vision },
		{ eyebrow: 'Mission', title: 'What we do', body: mission },
		{ eyebrow: 'Values', title: 'How we work', body: values }
	]}
	related={[
		{ href: '/about', label: 'About the Bank' },
		{ href: '/about/strategy', label: 'Strategic priorities' },
		{ href: '/about/integrity', label: 'Ethics and integrity' }
	]}
/>
